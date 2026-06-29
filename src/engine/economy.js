// ── MossGate — Economy, confidence & pressures ─────────────────────────────────
//
// The backend is deliberately tiny (food + wood). What matters is that production is
// VISIBLE and LABOUR-driven, and that the settlement's mood is a BLEND of separate
// signals — never a single hidden stability number that secretly runs everything.

import {
  FOOD_PER_CITIZEN_PER_DAY, CYCLE_TICKS, HEARTH, CONFIDENCE_WEIGHTS,
  FOOD_CONFIDENCE_DAYS, BASE_STORAGE, GRANARY_BONUS, STOREYARD_BONUS,
} from './config.js'
import { bedCapacity, noteDisturbance } from './world.js'

const clamp01 = (x) => Math.max(0, Math.min(1, x))

// Storage caps depend on how many store-yards exist; recompute when buildings change.
export function recomputeStorage(world) {
  const granaries = world.buildings.filter(b => b.type === 'granary' && b.isBuilt).length
  world.storageCap = {
    food: BASE_STORAGE.food + granaries * GRANARY_BONUS,
    wood: BASE_STORAGE.wood + granaries * STOREYARD_BONUS,
  }
}

// Deposit a haul into the central stockpile, clamped to capacity (overflow is simply
// not stored — a full granary reads as prosperity, not waste).
export function addResource(world, res, amt) {
  const cap = world.storageCap[res] ?? Infinity
  world.resources[res] = Math.min(cap, (world.resources[res] || 0) + amt)
}

export function dailyFoodNeed(world) {
  return Math.max(0.1, world.citizens.length * FOOD_PER_CITIZEN_PER_DAY)
}

export function foodDays(world) {
  return (world.resources.food || 0) / dailyFoodNeed(world)
}

// ── Per-tick upkeep ────────────────────────────────────────────────────────────
// Food is eaten gradually across the day; the hearth burns firewood for warmth.
// Neither can kill anyone — running out only dents confidence and the look of the
// place, which slows growth until things recover.
export function tickUpkeep(world) {
  // Food consumption, spread evenly over the day.
  const eat = dailyFoodNeed(world) / CYCLE_TICKS
  const before = world.resources.food
  world.resources.food = Math.max(0, world.resources.food - eat)
  if (before > 0 && world.resources.food === 0 && world.tick % CYCLE_TICKS < 2) {
    noteDisturbance(world, 'The stores ran empty — folk are foraging hard.')
  }

  // Hearth warmth buffer. Burns slowly; tops up from the woodpile toward a comfy level.
  const target = HEARTH.woodComfortTarget
  const burn = HEARTH.burnPerDay / CYCLE_TICKS
  world.hearth.woodFed = Math.max(0, world.hearth.woodFed - burn)
  if (world.hearth.woodFed < target && world.resources.wood >= 1) {
    const take = Math.min(target - world.hearth.woodFed, world.resources.wood, burn * 6)
    world.hearth.woodFed += take
    world.resources.wood -= take
  }
  world.warmth = clamp01(world.hearth.woodFed / target)
}

// ── Confidence ─────────────────────────────────────────────────────────────────
// A weighted blend the migration system reads to decide whether newcomers feel
// welcome. The governor does NOT use this number — it reads the raw pressures below.
export function recomputeConfidence(world) {
  const fScore = clamp01(foodDays(world) / FOOD_CONFIDENCE_DAYS)

  const beds = bedCapacity(world)
  const houses = world.households.length
  const housed   = clamp01(beds / Math.max(1, houses))
  const headroom = clamp01((beds - houses + 1) / 2)
  const sScore = 0.6 * housed + 0.4 * headroom

  const wScore = clamp01(world.warmth ?? 0)

  const sinceCalm = world.tick - world.lastDisturbanceTick
  const cScore = clamp01(sinceCalm / (1.5 * CYCLE_TICKS))

  const w = CONFIDENCE_WEIGHTS
  world.confidence = clamp01(
    w.food * fScore + w.shelter * sScore + w.warmth * wScore + w.calm * cScore
  )
  world._confParts = { food: fScore, shelter: sScore, warmth: wScore, calm: cScore }
}

// ── Pressures ──────────────────────────────────────────────────────────────────
// SEPARATE needs the governor weighs against land and distance. High pressure means
// "this need is getting thin" — but the governor still only acts if land is available
// and the move makes sense, so growth stays gradual.
export function recomputePressures(world) {
  const workers = Math.max(1, world.citizens.length)

  // Food: thin store, and few food parcels per worker.
  const foodCap = world.parcels.filter(p =>
    (p.type === 'field' || p.type === 'forage')).reduce((n, p) => n + p.jobs, 0)
  const foodScore = clamp01(foodDays(world) / FOOD_CONFIDENCE_DAYS)
  const foodSlots = clamp01(foodCap / workers)
  const food = clamp01((1 - foodScore) * 0.7 + (1 - foodSlots) * 0.3)

  // Wood: stockpile + hearth comfort relative to a healthy buffer.
  const woodTarget = HEARTH.woodComfortTarget * 1.2
  const wood = clamp01(1 - (world.resources.wood || 0) / woodTarget) * 0.7
             + clamp01(1 - (world.warmth ?? 1)) * 0.3

  // Shelter: migrants waiting with nowhere to live, or households crowding the huts.
  const beds = bedCapacity(world)
  const waiting = world.migrants.reduce((n, m) => n + m.size, 0)
  const crowd = Math.max(0, world.households.length - beds)
  const full = beds - world.households.length <= 0
  let shelter = (waiting > 0 ? 0.5 : 0) + crowd * 0.4 + (full ? 0.35 : 0)
  // Prosperity-driven growth: a confident, well-fed village with every bed taken
  // slowly wants to raise ONE more homestead, which migration then fills. This is the
  // engine of growth — gentle, conditional, and never speculative house-spam. The urge
  // FADES as the settlement fills, so early eras spread out eagerly while a larger
  // village settles toward a calm equilibrium instead of sprawling forever.
  if (full && foodDays(world) > 1.8) {
    // Confidence gate removed — it kept forming near-miss deadlocks (e.g. 70% vs 72%
    // threshold) without adding meaningful protection. The food guard (1.8 days) and
    // the shelter-pressure threshold (0.50) are the real growth governors.
    shelter += 0.4 * clamp01(1 - workers / 60)
  }
  shelter = clamp01(shelter)

  // Roads: the farthest active work parcel that has no path yet.
  let road = 0
  for (const p of world.parcels) {
    if (p.state !== 'active' || p.jobs === 0) continue
    const d = Math.hypot(p.col, p.row)
    if (d > 9 && !p.hasPath) road = Math.max(road, clamp01((d - 9) / 14))
  }

  world.pressures = { food, wood, shelter, road }
}
