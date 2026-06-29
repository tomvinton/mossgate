// ── MossGate — World state ─────────────────────────────────────────────────────
// The single source of truth. `createWorld` builds a BARE world (terrain + hearth +
// empty stockpile). The actual founding settlement (first hut, founders, foraging
// ground) is assembled by founding.js so this module stays dependency-free and easy
// to reason about.

import { HEARTH, BASE_STORAGE, CYCLE_TICKS } from './config.js'
import { generateWater, revealInitial, key } from './terrain.js'

export { key } from './terrain.js'

// ── id allocation ──────────────────────────────────────────────────────────────
let _id = 1
export function nextId() { return _id++ }
export function resetIds() { _id = 1 }
export function setNextId(n) { _id = n }

// ── events: a short human log, surfaced only in debug for now ───────────────────
export function addEvent(world, msg) {
  world.events.unshift({ msg, tick: world.tick })
  if (world.events.length > 24) world.events.pop()
}

// Append a history entry to a citizen, household, or parcel (capped at 20).
export function addHistory(entity, world, msg) {
  if (!entity) return
  if (!entity.history) entity.history = []
  const day = Math.floor(world.tick / (world._cycleTicks || 6240))
  entity.history.push({ day, msg })
  if (entity.history.length > 20) entity.history.shift()
}

// A "disturbance" is anything that should dent confidence and the village's calm:
// a poor harvest, a cold snap, a hut lost. Rare and gentle by design.
export function noteDisturbance(world, msg) {
  world.lastDisturbanceTick = world.tick
  if (msg) addEvent(world, msg)
}

// ── world factory ──────────────────────────────────────────────────────────────
export function createWorld(seed = Math.random() * 99999) {
  resetIds()
  const water = generateWater(seed)

  const world = {
    seed,
    water,

    // terrain + fog
    tiles: new Map(),            // key -> { type, decayAt? }
    revealedTiles: new Set(),

    // clock
    tick: 0,

    // entities
    parcels: [],                 // claimed land zones (the core unit of growth)
    buildings: [],               // structures inside parcels (huts, granary…)
    citizens: [],
    households: [],
    migrants: [],                // groups walking in / lingering before they settle

    // central stockpile, kept at the hearth
    resources: { food: 12, wood: 8 },
    storageCap: { ...BASE_STORAGE },

    // the hearth — a cozy landmark, not a fuel tank
    hearth: { col: HEARTH.col, row: HEARTH.row, woodFed: HEARTH.woodComfortTarget * 0.5 },

    // governor + readouts (debug surfaces these; no single score rules the AI)
    governor: { lastDecisionTick: 0, lastAction: 'founding', lastVisibleProjectTick: 0, lastPeacefulTick: 0, notes: [] },
    pressures: { food: 0, wood: 0, shelter: 0, road: 0 },
    confidence: 0.7,

    // mood
    lastDisturbanceTick: -1e9,
    events: [],

    // render hints
    bgDirty: true,
    revealedVersion: 0,   // increments whenever revealedTiles grows (throttles sort rebuilds)

    // development band: 'settlement' → 'village'
    band: 'settlement',
    bandStableSince: 0,   // tick when high-confidence stability began

    // expose CYCLE_TICKS on world so persist doesn't need to import config
    _cycleTicks: CYCLE_TICKS,
  }

  // The home clearing is visible from the first frame; everything else is forest-dark.
  revealInitial(world)
  return world
}

// ── geometry helpers ───────────────────────────────────────────────────────────
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by) }

export function tileType(world, col, row) {
  const t = world.tiles.get(key(col, row))
  return t ? t.type : null
}

export function setTile(world, col, row, type, decayAt) {
  const k = key(col, row)
  const t = world.tiles.get(k) || {}
  t.type = type
  if (decayAt != null) t.decayAt = decayAt; else delete t.decayAt
  world.tiles.set(k, t)
  world.bgDirty = true
}

// ── lookups other systems lean on ──────────────────────────────────────────────
export function parcelById(world, id) { return world.parcels.find(p => p.id === id) }
export function buildingById(world, id) { return world.buildings.find(b => b.id === id) }

export function activeParcels(world, type) {
  return world.parcels.filter(p => p.type === type && p.state === 'active')
}

// Total beds (dwelling capacity) and how many are spoken for by households.
export function bedCapacity(world) {
  return world.buildings
    .filter(b => b.type === 'hut' && b.isBuilt)
    .reduce((n, b) => n + (b.beds || 1), 0)
}

// The nearest place a worker should drop a haul: an active store-yard if one exists,
// otherwise the hearth stockpile. This is what makes storage parcels worth claiming —
// they shorten supply lines.
export function dropPoint(world, fromX, fromY) {
  let best = { col: world.hearth.col, row: world.hearth.row }
  let bestD = dist(fromX, fromY, best.col, best.row)
  for (const p of world.parcels) {
    if (p.type !== 'storage' || p.state !== 'active') continue
    const d = dist(fromX, fromY, p.col, p.row)
    if (d < bestD) { bestD = d; best = { col: p.col, row: p.row } }
  }
  return best
}
