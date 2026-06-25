// ── Mossgate — World State ─────────────────────────────────────────────────────

export const key   = (c, r) => `${c},${r}`
export const unkey = (k)    => k.split(',').map(Number)

// ── Infinite procedural tile generation ───────────────────────────────────────
// Deterministic hash — same (col, row, seed) always produces the same tile type.

function hashTile(col, row, seed) {
  const n = Math.sin(col * 127.1 + row * 311.7 + seed * 74.3) * 43758.5453123
  return n - Math.floor(n)
}

export function generateTileType(col, row, seed) {
  if (Math.abs(col) <= 3 && Math.abs(row) <= 3) return 'grass'  // central clearing
  const rand    = hashTile(col, row, seed)
  const dist    = Math.sqrt(col * col + row * row)
  const density = Math.max(0.50, 0.82 - dist * 0.002)   // forest thins slightly with distance
  return rand < density ? 'forest' : 'grass'
}

// Initialise a small seed tile set just for the starter setup (roads, houses).
// Everything beyond this area is generated on demand by revealAround.
function initTiles(seed) {
  const tiles = new Map()
  const INIT_R = 8
  for (let c = -INIT_R; c <= INIT_R; c++) {
    for (let r = -INIT_R; r <= INIT_R; r++) {
      if (Math.sqrt(c * c + r * r) > INIT_R) continue
      tiles.set(key(c, r), { type: generateTileType(c, r, seed) })
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
    task:        null,       // current task: 'forage' | 'chop' | 'build' | null (idle)
    state,       // idle | going_to_source | working | going_to_storage | going_to_build | building | arriving | going_home | sleeping
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

export function createWorld() {
  _nextId = 0
  const seed  = Math.random() * 99999
  const tiles = initTiles(seed)

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
    buildings,
    citizens,

    // Resources — central stockpile
    resources: { food: 3, wood: 0 },

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

    // Camera hint
    newBuilding: null,

    // Renderer hint — set true whenever background canvas needs a full redraw
    bgDirty: true,

    // Fog of war — Set of tile keys visible to the player
    revealedTiles: new Set(),
  }

  // Seed initial fog reveal from starter buildings and center stockpile
  for (const b of buildings) revealAround(world, b.col, b.row, 12)
  revealAround(world, 0, 0, 8)

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
        world.tiles.set(k, { type: generateTileType(c, ro, world.seed) })
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

export function computeBounds(tiles) {
  let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity
  for (const k of tiles.keys()) {
    const [c, r] = unkey(k)
    if (c < minC) minC = c; if (c > maxC) maxC = c
    if (r < minR) minR = r; if (r > maxR) maxR = r
  }
  return { minC, maxC, minR, maxR }
}
