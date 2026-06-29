// ── MossGate — Save / load (localStorage) ──────────────────────────────────────
// Serialises the world to JSON and restores it on reload. Maps → arrays,
// Sets → arrays; the world's water features are re-derived from the seed so we
// don't have to store them. Migrants are intentionally NOT saved (ephemeral).

import { generateWater, revealInitial } from './terrain.js'
import { BASE_STORAGE, HEARTH } from './config.js'
import { setNextId } from './world.js'
import { setNextCitizenId } from './citizens.js'
import { recomputeConfidence, recomputePressures } from './economy.js'

const SAVE_KEY     = 'mossgate_save'
const SAVE_VERSION = 2

// ── Save ───────────────────────────────────────────────────────────────────────
export function saveWorld(world) {
  try {
    const payload = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      seed:    world.seed,
      tick:    world.tick,
      band:    world.band || 'settlement',
      bandStableSince: world.bandStableSince || 0,
      resources:    { ...world.resources },
      storageCap:   { ...world.storageCap },
      warmth:       world.warmth ?? 0.5,
      hearth:       { ...world.hearth },
      tiles:        [...world.tiles.entries()],
      revealedTiles:[...world.revealedTiles],
      parcels:      world.parcels,
      buildings:    world.buildings,
      citizens:     world.citizens,
      households:   world.households,
      governor:     { ...world.governor },
      pressures:    { ...world.pressures },
      confidence:   world.confidence,
      lastDisturbanceTick: world.lastDisturbanceTick,
      events:       world.events,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
    return true
  } catch (e) {
    console.warn('[MossGate] save failed:', e)
    return false
  }
}

// ── Load ───────────────────────────────────────────────────────────────────────
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.version !== SAVE_VERSION) return null
    return data
  } catch (e) {
    console.warn('[MossGate] load failed:', e)
    return null
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY)
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY)
}

// ── Restore ────────────────────────────────────────────────────────────────────
// Builds a live world object from a plain-JSON save payload.
// Uses createWorld's bare skeleton, then overlays all saved state.
export function restoreWorld(data) {
  // Re-derive terrain features from seed (deterministic, no need to store them).
  const water = generateWater(data.seed)

  const world = {
    seed:   data.seed,
    water,
    tick:   data.tick,
    band:   data.band   || 'settlement',
    bandStableSince: data.bandStableSince || 0,

    tiles:         new Map(data.tiles),
    revealedTiles: new Set(data.revealedTiles),

    resources:    { ...data.resources },
    storageCap:   { ...data.storageCap },
    warmth:       data.warmth ?? 0.5,
    hearth:       { ...data.hearth },

    parcels:    data.parcels.map(p => ({ ...p, tiles: p.tiles || [] })),
    buildings:  data.buildings.map(b => ({ ...b })),
    citizens:   data.citizens.map(c => ({ ...c })),
    households: data.households.map(h => ({ ...h })),
    migrants:   [],

    governor:   { ...data.governor },
    pressures:  { ...data.pressures },
    confidence: data.confidence,

    lastDisturbanceTick: data.lastDisturbanceTick,
    events:   data.events || [],
    bgDirty:  true,
    revealedVersion: 0,
  }

  // Restore ID counters so new entities don't collide with saved ones.
  const ids = [
    ...world.parcels.map(p => p.id),
    ...world.buildings.map(b => b.id),
    ...world.households.map(h => h.id),
  ].filter(Number.isFinite)
  setNextId(ids.length ? Math.max(...ids) + 1 : 1)

  const cids = world.citizens.map(c => c.id).filter(Number.isFinite)
  setNextCitizenId(cids.length ? Math.max(...cids) + 1 : 1)

  // Recompute derived read-outs so UI has fresh numbers from tick 0.
  recomputeConfidence(world)
  recomputePressures(world)
  return world
}
