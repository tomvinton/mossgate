// ── MossGate — Master tick ─────────────────────────────────────────────────────
// Orchestrates one simulation step. Cheap per-tick work (citizen movement, upkeep)
// runs every tick; the heavier, deliberative systems (governor, migration) run on
// slow modulo intervals so the settlement evolves gradually and legibly.

import {
  GOVERNOR_DECISION_TICKS, MIGRATION_CHECK_TICKS, CYCLE_TICKS,
  VILLAGE_BAND_MIN_POP, VILLAGE_BAND_MIN_DAY, VILLAGE_BAND_MIN_FIELDS,
  VILLAGE_BAND_MIN_STORAGE, VILLAGE_BAND_STABLE_TICKS, VILLAGE_BAND_CONFIDENCE,
  TRAFFIC_DECAY_RATE, TRAFFIC_DECAY_TICKS, TRAFFIC_TO_TRAIL,
} from './config.js'
import { updateCitizens } from './citizens.js'
import { regrowStumps } from './parcels.js'
import { tickUpkeep, recomputeConfidence, recomputePressures } from './economy.js'
import { considerMigration, considerDeparture, updateMigrants } from './population.js'
import { governorDecide } from './governor.js'
import { setTile } from './world.js'
import { key } from './terrain.js'

export function tick(world) {
  world.tick++

  // ── Per-tick: the living, visible layer ──────────────────────────────────────
  tickUpkeep(world)          // food eaten gradually; hearth warmth
  updateCitizens(world)      // movement, work cycles, hauling, rest, sleep
  updateMigrants(world)      // arriving groups walking in / settling

  // ── Light periodic upkeep ─────────────────────────────────────────────────────
  if (world.tick % 30 === 0) regrowStumps(world)          // woodlots renew themselves

  // ── Read-outs the governor & migration weigh (kept fresh, cheap to compute) ───
  if (world.tick % 20 === 0) {
    recomputeConfidence(world)
    recomputePressures(world)
  }

  // ── The governor: one considered decision every couple of minutes ─────────────
  if (world.tick % GOVERNOR_DECISION_TICKS === 0) {
    governorDecide(world)
    world.governor.lastDecisionTick = world.tick
  }

  // ── Migration & decline: unhurried, confidence-gated ──────────────────────────
  if (world.tick % MIGRATION_CHECK_TICKS === 0) {
    considerMigration(world)
    considerDeparture(world)
  }

  // ── Village band evaluation ───────────────────────────────────────────────────
  if (world.tick % 300 === 0) evaluateBand(world)

  // ── Autosave signal (set flag; actual save called from App.jsx) ───────────────
  if (world.tick % 600 === 0) world._autosaveDue = true

  // ── Traffic decay: footfall fades over time so paths worn out of use disappear ─
  if (world.tick % TRAFFIC_DECAY_TICKS === 0) decayTraffic(world)

  // ── Desire paths: heavily-walked grass/cleared tiles spontaneously become trails
  if (world.tick % 500 === 0) createDesirePaths(world)

  // ── Bound memory for week/month-long runs: drop far, unrevealed, plain tiles ──
  if (world.tick % 2000 === 0) pruneTiles(world)
}

// ── Traffic decay ─────────────────────────────────────────────────────────────
function decayTraffic(world) {
  for (const t of world.tiles.values()) {
    if (t.traffic) t.traffic = Math.floor(t.traffic * TRAFFIC_DECAY_RATE)
  }
}

// ── Desire paths ──────────────────────────────────────────────────────────────
// Grass or cleared ground walked on heavily enough spontaneously becomes a trail.
// This happens organically between parcels, not just where the governor lays paths.
const DESIRE_ELIGIBLE = new Set(['grass', 'cleared', 'meadow'])
function createDesirePaths(world) {
  let created = 0
  for (const [k, t] of world.tiles) {
    if (!DESIRE_ELIGIBLE.has(t.type)) continue
    if (!t.traffic || t.traffic < TRAFFIC_TO_TRAIL) continue
    const i = k.indexOf(',')
    setTile(world, +k.slice(0, i), +k.slice(i + 1), 'trail')
    world.bgDirty = true
    if (++created >= 3) break
  }
}

// ── Village band transition ───────────────────────────────────────────────────
function evaluateBand(world) {
  if (world.band !== 'settlement') return   // already village or beyond

  const day       = Math.floor(world.tick / CYCLE_TICKS)
  const popOk     = world.citizens.length >= VILLAGE_BAND_MIN_POP
  const dayOk     = day >= VILLAGE_BAND_MIN_DAY
  const workCount = world.parcels.filter(p =>
    p.state === 'active' && (p.type === 'field' || p.type === 'forage' || p.type === 'woodlot')
  ).length
  const workOk    = workCount >= VILLAGE_BAND_MIN_FIELDS
  const storageOk = world.parcels.filter(p => p.type === 'storage' && p.state === 'active').length >= VILLAGE_BAND_MIN_STORAGE
  const confOk    = world.confidence >= VILLAGE_BAND_CONFIDENCE

  if (confOk && popOk && dayOk && workOk && storageOk) {
    if (!world.bandStableSince) {
      world.bandStableSince = world.tick
    } else if (world.tick - world.bandStableSince >= VILLAGE_BAND_STABLE_TICKS) {
      world.band = 'village'
    }
  } else {
    world.bandStableSince = 0   // reset timer if conditions slip
  }
}

// Removes generated-but-unseen terrain that no parcel or path depends on, so the tile
// map can't grow without bound while MossGate runs as a wallpaper for days.
function pruneTiles(world) {
  if (world.tiles.size < 12000) return
  const keep = new Set()
  for (const p of world.parcels) for (const t of p.tiles) keep.add(key(t.col, t.row))
  const PLAIN = new Set(['grass', 'forest', 'water', 'rock', 'meadow'])
  let pruned = 0
  for (const [k, t] of world.tiles) {
    if (pruned >= 4000) break
    if (world.revealedTiles.has(k) || keep.has(k)) continue
    if (!PLAIN.has(t.type) || t.decayAt) continue
    world.tiles.delete(k)
    pruned++
  }
}
