// ── Mossgate — World Compositor ───────────────────────────────────────────────
// Assembles a world object from four template axes: Layout × Era × Culture × Biome.
// The returned world has the exact same shape as world.js createWorld() so the
// tick engine, citizens AI, and needs system run without any changes.

import riverValleyLayout from './templates/layouts/riverValley.js'
import woodEra           from './templates/eras/wood.js'
import tribalCulture     from './templates/cultures/tribal.js'
import denseForestBiome  from './templates/biomes/denseForest.js'
import { setActiveStyle } from '../render/styleResolver.js'
import { key, makeCitizen, resetCitizenIds, revealAround } from './world.js'
import { ERA_DEFS } from './config.js'
import { initStageManager } from './stages/stageManager.js'

const LAYOUTS  = { riverValley: riverValleyLayout }
const ERAS     = { wood: woodEra }
const CULTURES = { tribal: tribalCulture }
const BIOMES   = { denseForest: denseForestBiome }

// ── Public API ─────────────────────────────────────────────────────────────────

export function buildWorld(layoutId, eraId, cultureId, biomeId, seed, opts = {}) {
  const layout  = LAYOUTS[layoutId]
  const era     = ERAS[eraId]
  const culture = CULTURES[cultureId]
  const biome   = BIOMES[biomeId]

  if (!layout || !era || !culture || !biome) {
    throw new Error(`Unknown template: ${layoutId}/${eraId}/${cultureId}/${biomeId}`)
  }

  // Seeded RNG (same LCG as world.js seededRng) — layout uses this for feature placement
  let s = Math.floor(seed * 9301 + 49297) % 233280
  const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }

  // Build a deterministic terrain function from the layout
  const terrainFn = layout.createTerrainFn(seed, rng)

  // Activate visual style (picked up by iso.js via styleResolver)
  setActiveStyle(culture, biome)

  // Reset citizen ID counter before creating the three founders
  resetCitizenIds()

  // ── Initial tile map ─────────────────────────────────────────────────────────
  const tiles = initTiles(terrainFn)

  const nuclearRevealed = opts.nuclearRevealed || false
  if (nuclearRevealed) {
    tiles.set(key(0, 0), { type: 'nuclear_ruin_revealed' })
    for (let c = -10; c <= 10; c++) {
      for (let r = -10; r <= 10; r++) {
        const d = Math.sqrt(c * c + r * r)
        if (d < 1 || d > 10) continue
        const prob = 0.95 - (d / 10) * 0.55
        if (contaminationHash(c, r, seed) < prob) tiles.set(key(c, r), { type: 'contamination' })
      }
    }
  } else {
    tiles.set(key(0, 0), { type: 'nuclear_ruin' })
  }

  // ── Stage 0: no starter buildings — campfire (heart) only ───────────────────
  const buildings = []

  // ── Stage 0: single founding citizen, no home yet ────────────────────────────
  const founder = makeCitizen('worker', 0, 0)
  const citizens = [founder]

  // ── Stage 0: only house is available — stage system expands unlocks over time ─
  const unlocks = new Set(['house'])

  // ── World object ─────────────────────────────────────────────────────────────
  const world = {
    tiles,
    seed,
    lakes:  [],   // unused when terrainFn is set — kept for field-shape compat
    rivers: [],   // same

    // Layout terrain function — used by revealAround for on-demand tile generation
    terrainFn,

    // Template IDs — stored for debugging and future hot-swap
    layoutId, eraId, cultureId, biomeId,

    era: 1,
    nuclearRevealed,
    heart: {
      era:         1,
      col:         0,
      row:         0,
      fuelTank:    ERA_DEFS[1].fuelMax * 0.5,  // Stage 0: start at 50% fuel
      fuelMax:     ERA_DEFS[1].fuelMax,
      lightRadius: ERA_DEFS[1].lightRadius,
    },

    buildings,
    citizens,

    resources: {
      food: 0, wood: 0, stone: 0,
      planks: 0, cut_stone: 0,
      coal: 0, iron_ore: 0, iron: 0,
      steel: 0,
      uranium: 0,
    },

    housingCapacity: 0,
    deficits: { food: 0 },
    unlocks,
    buildQueue: [],
    pendingArrivals: [],
    events: [],
    tick: 0,
    day:  0,
    collapseTimer:   0,
    collapsed:       false,
    nuclearCollapse: false,

    // Stage system
    stage:      0,
    fireCrisis: false,
    stability:  100,

    // Log piles scattered from felled trees
    logPiles: [],

    legacy:         new Set(),
    legacyCounters: { fireDeaths: 0, fireIntercepts: 0, famineDeaths: 0, nearCollapses: 0, peakPop: 0 },
    newBuilding:    null,
    bgDirty:        true,
    revealedTiles:  new Set(),

    // ── Season system ──────────────────────────────────────────────────────────
    season:     'spring',
    seasonTick: 0,
    year:       1,

    // ── Scout system (Stage 2) ─────────────────────────────────────────────────
    scout:        { active: false, reportTimer: 0 },
    scoutReports: [],

    // ── Caravan (Stage 3) ──────────────────────────────────────────────────────
    caravan: null,

    // ── Culture (Stage 3) ──────────────────────────────────────────────────────
    culture: { clothingPattern: null },

    // ── Stage 4 tracking ──────────────────────────────────────────────────────
    winterWarning:     false,
    winterRequirement: null,
    _equilibriumTicks: 0,

    // ── Stage 5 ────────────────────────────────────────────────────────────────
    mineDiscovery:  false,
    _mineBuiltTick: 0,

    // ── Stage 6 ────────────────────────────────────────────────────────────────
    researchPoints: 0,
    farmsDormant:   false,

    // ── Stage 7 seasonal bonuses ───────────────────────────────────────────────
    farmProductivityBonus: 1.0,
    citizenSpeedBonus:     1.0,
    citizenSpeedPenalty:   1.0,
    _wintersCompleted:     0,

    // ── Stage 8 challenge (seeded so same world always gets same challenge) ────
    challengeType:       ['flood', 'harsh_winter', 'raiders'][Math.floor(seed % 3)],
    challengeScore:      0,
    challengeResolved:   false,
    _challengeActive:    false,
    _challengeStartTick: 0,
    _foreshadowCount:    0,
    raiders:             [],

    // ── Stage 9 endgame ────────────────────────────────────────────────────────
    endgame:            false,
    ngPlusUnlocked:     false,
    secretModeUnlocked: false,
  }

  // Initial fog-of-war reveal around the heart
  revealAround(world, 0, 0, ERA_DEFS[1].lightRadius + 4)

  // Boot the stage system
  initStageManager(world)

  return world
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initTiles(terrainFn) {
  const tiles  = new Map()
  const INIT_R = 8
  for (let c = -INIT_R; c <= INIT_R; c++) {
    for (let r = -INIT_R; r <= INIT_R; r++) {
      if (Math.sqrt(c * c + r * r) > INIT_R) continue
      tiles.set(key(c, r), { type: terrainFn(c, r) })
    }
  }
  return tiles
}

function contaminationHash(c, r, seed) {
  const n = Math.sin(c * 3.1 * 127.1 + r * 2.7 * 311.7 + (seed + 12345) * 74.3) * 43758.5453123
  return n - Math.floor(n)
}
