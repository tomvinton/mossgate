// ── Mossgate — World State ─────────────────────────────────────────────────────

export const key   = (c, r) => `${c},${r}`
export const unkey = (k)    => k.split(',').map(Number)

import { ERA_DEFS } from './config.js'

// Returns true if (col, row) is within the heart's current light radius
export function isLit(world, col, row) {
  return Math.sqrt(col * col + row * row) <= world.heart.lightRadius
}

// ── Infinite procedural tile generation ───────────────────────────────────────
// Deterministic hash — same (col, row, seed) always produces the same tile type.

function hashTile(col, row, seed) {
  const n = Math.sin(col * 127.1 + row * 311.7 + seed * 74.3) * 43758.5453123
  return n - Math.floor(n)
}

// Simple seeded RNG (LCG) for world feature generation
function seededRng(seed) {
  let s = Math.floor(seed * 9301 + 49297) % 233280
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

// ── World feature generation — lakes and rivers ────────────────────────────────

export function generateLakes(seed) {
  const rng = seededRng(seed)
  const lakes = []
  for (let i = 0; i < 6; i++) {
    const angle = rng() * Math.PI * 2
    const dist  = 14 + rng() * 38
    lakes.push({
      col:    Math.round(Math.cos(angle) * dist),
      row:    Math.round(Math.sin(angle) * dist),
      radius: 2.5 + rng() * 4,
    })
  }
  return lakes
}

export function generateRivers(seed) {
  const rng    = seededRng(seed + 7777)
  const rivers = []
  for (let i = 0; i < 2; i++) {
    rivers.push({
      angle:     rng() * Math.PI * 2,
      amplitude: 3 + rng() * 5,
      frequency: 0.05 + rng() * 0.05,
      phase:     rng() * Math.PI * 2,
    })
  }
  return rivers
}

function isWaterTile(col, row, seed, lakes, rivers) {
  // Keep the starting area dry
  if (Math.abs(col) <= 9 && Math.abs(row) <= 9) return false

  // Parametric sinusoidal rivers — extend to infinity in both directions
  for (const rv of rivers) {
    const cosA = Math.cos(rv.angle), sinA = Math.sin(rv.angle)
    const t    =  col * cosA + row * sinA          // along river axis
    const perp = -col * sinA + row * cosA          // perpendicular offset
    const center = rv.amplitude * Math.sin(rv.frequency * t + rv.phase)
    if (Math.abs(perp - center) < 1.4) return true
  }

  // Lakes — noisy radius around each center
  for (const lk of lakes) {
    const d      = Math.sqrt((col - lk.col) ** 2 + (row - lk.row) ** 2)
    const noisyR = lk.radius * (0.7 + hashTile(col, row, seed + 999) * 0.6)
    if (d < noisyR) return true
  }

  return false
}

export function generateTileType(col, row, seed, lakes = [], rivers = []) {
  if (Math.abs(col) <= 3 && Math.abs(row) <= 3) return 'grass'  // central clearing
  if (isWaterTile(col, row, seed, lakes, rivers)) return 'water'
  const dist = Math.sqrt(col * col + row * row)

  // ── Resource strata — deeper = rarer ──────────────────────────────────────
  // Uranium ore: ultra-rare, deep exploration (era 5 resource)
  if (dist >= 30) {
    const uHash = hashTile(col * 7.3 + 1.1, row * 5.1 + 0.7, seed + 9999)
    if (uHash > 0.990) return 'uranium_ore'
  }
  // Iron deposits: rare, mid-range (era 3 resource)
  if (dist >= 18) {
    const iHash = hashTile(col * 4.1 + 1.1, row * 3.7 + 0.7, seed + 7777)
    if (iHash > 0.968) return 'iron_deposit'
  }
  // Coal seams: moderate density, closer in (era 3 resource)
  if (dist >= 12) {
    const cHash = hashTile(col * 2.3 + 0.3, row * 1.9 + 0.8, seed + 5555)
    if (cHash > 0.952) return 'coal_seam'
  }
  // Rock nodes: surface stone (era 1-2 resource)
  if (dist >= 8) {
    const rockHash = hashTile(col * 3.7 + 0.5, row * 2.9 + 0.5, seed + 333)
    if (rockHash > 0.94) return 'rock'
  }

  const rand    = hashTile(col, row, seed)
  const density = Math.max(0.50, 0.82 - dist * 0.002)
  return rand < density ? 'forest' : 'grass'
}

// Initialise a small seed tile set just for the starter setup (roads, houses).
// Everything beyond this area is generated on demand by revealAround.
function initTiles(seed, lakes, rivers) {
  const tiles = new Map()
  const INIT_R = 8
  for (let c = -INIT_R; c <= INIT_R; c++) {
    for (let r = -INIT_R; r <= INIT_R; r++) {
      if (Math.sqrt(c * c + r * r) > INIT_R) continue
      tiles.set(key(c, r), { type: generateTileType(c, r, seed, lakes, rivers) })
    }
  }
  return tiles
}

// ── Citizen factory ────────────────────────────────────────────────────────────

let _nextId = 0

export function makeCitizen(_job, x, y, state = 'idle') {
  return {
    id:          _nextId++,
    job:         'worker',   // all citizens are general workers (phase 1)
    role:        'worker',   // 'worker' | 'guard'
    task:        null,       // current task: 'forage' | 'chop' | 'build' | null (idle)
    state,       // idle | going_to_source | working | going_to_storage | going_to_build | building | arriving | going_home | sleeping | guard_patrol | guard_rest
    x,           // fractional tile col
    y,           // fractional tile row
    targetTile:  null,   // key(col, row) of work target
    targetX:     x,      // world tile coords to walk toward
    targetY:     y,
    workTimer:   0,
    carrying:    null,   // null | { resource: 'food'|'wood', amount: N }
    bounce:      Math.random() * Math.PI * 2,
    arriveFrom:  null,
    buildTarget: null,   // { col, row, buildingId } — used when task === 'build'
    homeId:      null,   // id of the house building this citizen lives in
  }
}

// ── World factory ──────────────────────────────────────────────────────────────

export function createWorld(opts = {}) {
  _nextId = 0
  const nuclearRevealed = opts.nuclearRevealed || false
  const seed   = Math.random() * 99999
  const lakes  = generateLakes(seed)
  const rivers = generateRivers(seed)
  const tiles  = initTiles(seed, lakes, rivers)

  // ── The twist: the world ALWAYS starts in nuclear ruins ───────────────────────
  // The heart (campfire) sits on top of this. Players won't know what it is
  // until they've built a nuclear plant and watched it explode — revealing the same
  // structure they started on.
  if (nuclearRevealed) {
    // After the twist is revealed, the starting tile clearly shows what it is.
    // Contamination rings out from the old reactor core.
    tiles.set(key(0, 0), { type: 'nuclear_ruin_revealed' })
    const contaminationHash = (c, r) => hashTile(c * 3.1, r * 2.7, seed + 12345)
    for (let c = -10; c <= 10; c++) {
      for (let r = -10; r <= 10; r++) {
        const d = Math.sqrt(c * c + r * r)
        if (d < 1 || d > 10) continue
        const prob = 0.95 - (d / 10) * 0.55
        if (contaminationHash(c, r) < prob) {
          tiles.set(key(c, r), { type: 'contamination' })
        }
      }
    }
  } else {
    tiles.set(key(0, 0), { type: 'nuclear_ruin' })
  }

  // ── Starter houses — 3 small huts, one per founding citizen ─────────────────
  // Placed at the corners of the grass clearing, shelter:1 each (personal huts)
  const buildings = [
    { id: 0, type: 'house', col: -3, row:  1, isBuilt: true, buildProgress: 100, workerIds: [], residents: [], shelter: 1 },
    { id: 1, type: 'house', col:  1, row: -3, isBuilt: true, buildProgress: 100, workerIds: [], residents: [], shelter: 1 },
    { id: 2, type: 'house', col:  3, row:  1, isBuilt: true, buildProgress: 100, workerIds: [], residents: [], shelter: 1 },
  ]

  // ── Starter roads — diagonal paths from each hut to center ───────────────────
  const starterPositions = [[-3, 1], [1, -3], [3, 1]]
  for (const [fc, fr] of starterPositions) {
    let c = fc, r = fr
    const maxSteps = Math.abs(c) + Math.abs(r) + 2
    for (let i = 0; i < maxSteps; i++) {
      if (c === 0 && r === 0) break
      const dc = c > 0 ? -1 : c < 0 ? 1 : 0
      const dr = r > 0 ? -1 : r < 0 ? 1 : 0
      c += dc; r += dr
      const tile = tiles.get(key(c, r))
      if (tile) tile.type = 'path'
    }
  }

  // ── Starting citizens — each assigned to one starter house ───────────────────
  const forager    = makeCitizen('forager',    0, 0)
  const woodcutter = makeCitizen('woodcutter', 0, 0)
  const builder    = makeCitizen('builder',    0, 0)

  forager.homeId    = 0;  buildings[0].residents.push(forager.id)
  woodcutter.homeId = 1;  buildings[1].residents.push(woodcutter.id)
  builder.homeId    = 2;  buildings[2].residents.push(builder.id)

  const citizens = [forager, woodcutter, builder]

  const world = {
    tiles,
    seed,
    lakes,
    rivers,

    // ── Era / heart ─────────────────────────────────────────────────────────────
    era: 1,
    nuclearRevealed,          // true after nuclear catastrophe — reveals the twist
    heart: {
      era:         1,
      col:         0,
      row:         0,
      fuelTank:    ERA_DEFS[1].fuelMax,
      fuelMax:     ERA_DEFS[1].fuelMax,
      lightRadius: ERA_DEFS[1].lightRadius,
    },

    buildings,
    citizens,

    // Resources — central stockpile
    resources: {
      // Era 1 raw
      food: 3, wood: 0, stone: 0,
      // Era 2 processed
      planks: 0, cut_stone: 0,
      // Era 3 raw + processed
      coal: 0, iron_ore: 0, iron: 0,
      // Era 4 processed
      steel: 0,
      // Era 5 raw
      uranium: 0,
    },

    // Housing — starts at 3 (one slot per starter hut)
    housingCapacity: 3,

    // Needs tracking
    deficits: { food: 0 },

    // Unlocked building types
    unlocks: new Set(['house', 'town_center']),

    // Build queue — { type, col, row } entries
    buildQueue: [],

    // Pending arrivals — { timer } entries; when timer hits 0 a new citizen spawns
    pendingArrivals: [],

    // Events log
    events: [],

    // Tick counter
    tick: 0,
    day:  0,   // completed day/night cycles (each cycle = DAY_TICKS + NIGHT_TICKS)

    // Legacy marker system — tracks rare milestones and earned monument types
    legacy:         new Set(),
    legacyCounters: { fireDeaths: 0, fireIntercepts: 0, famineDeaths: 0, nearCollapses: 0, peakPop: 0 },

    // Camera hint
    newBuilding: null,

    // Renderer hint — set true whenever background canvas needs a full redraw
    bgDirty: true,

    // Fog of war — Set of tile keys visible to the player
    revealedTiles: new Set(),
  }

  // Reveal the initial lit zone around the heart
  revealAround(world, 0, 0, ERA_DEFS[1].lightRadius + 4)

  return world
}

// ── Fog of war + infinite world ────────────────────────────────────────────────
// Marks all tiles within `radius` of (col, row) as revealed.
// Any tile not yet in world.tiles is generated on demand via the seeded hash.

export function revealAround(world, col, row, radius) {
  const r = Math.ceil(radius)
  let changed = false
  for (let dc = -r; dc <= r; dc++) {
    for (let dr = -r; dr <= r; dr++) {
      if (dc * dc + dr * dr > radius * radius) continue
      const c = col + dc, ro = row + dr
      const k = key(c, ro)
      // Generate tile on demand if not yet in the world
      if (!world.tiles.has(k)) {
        world.tiles.set(k, { type: generateTileType(c, ro, world.seed, world.lakes, world.rivers) })
      }
      if (!world.revealedTiles.has(k)) {
        world.revealedTiles.add(k)
        changed = true
      }
    }
  }
  if (changed) world.bgDirty = true
}

// ── Utility helpers ────────────────────────────────────────────────────────────

export function getBuilder(world) {
  return world.citizens.find(c => c.job === 'builder')
}

export function housingHeadroom(world) {
  return world.housingCapacity - world.citizens.length
}

export function builtCount(world, type) {
  return world.buildings.filter(b => b.type === type && b.isBuilt).length
}

export function hasBuilt(world, type) {
  return world.buildings.some(b => b.type === type && b.isBuilt)
}

export function addEvent(world, msg) {
  world.events.unshift({ msg, tick: world.tick })
  if (world.events.length > 20) world.events.pop()
}

// ── Legacy marker system ───────────────────────────────────────────────────────
// Monuments placed near the heart when rare conditions are met.
// Each type can only be awarded once per world.

const LEGACY_SLOTS = [
  [2, -2], [-2, -2], [3, 0], [-3, 0], [2, 2], [-2, 2],
]

export function awardLegacy(world, type, message) {
  if (!world.legacy)         world.legacy         = new Set()
  if (!world.legacyCounters) world.legacyCounters = { fireDeaths: 0, fireIntercepts: 0, famineDeaths: 0, nearCollapses: 0, peakPop: 0 }
  if (world.legacy.has(type)) return

  const slotIdx = world.legacy.size   // use size before add as slot index
  world.legacy.add(type)

  if (slotIdx < LEGACY_SLOTS.length) {
    const [dc, dr] = LEGACY_SLOTS[slotIdx]
    world.tiles.set(key(dc, dr), { type })
    world.bgDirty = true
  }

  addEvent(world, message)
}

export function computeBounds(tiles) {
  let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity
  for (const k of tiles.keys()) {
    const [c, r] = unkey(k)
    if (c < minC) minC = c; if (c > maxC) maxC = c
    if (r < minR) minR = r; if (r > maxR) maxR = r
  }
  return { minC, maxC, minR, maxR }
}
