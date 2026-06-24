// ── Mossgate — World State ─────────────────────────────────────────────────────

export const key   = (c, r) => `${c},${r}`
export const unkey = (k)    => k.split(',').map(Number)

// ── Map generation — forested area with a central clearing ────────────────────

function generateMap() {
  const tiles = new Map()
  const RADIUS = 28

  for (let c = -RADIUS; c <= RADIUS; c++) {
    for (let r = -RADIUS; r <= RADIUS; r++) {
      const dist = Math.sqrt(c * c + r * r)
      if (dist > RADIUS) continue

      const inClearing = Math.abs(c) <= 3 && Math.abs(r) <= 3
      if (inClearing) {
        tiles.set(key(c, r), { type: 'grass' })
      } else {
        // Dense forest — vary coverage slightly for natural look
        const density = 0.82 - dist * 0.006
        tiles.set(key(c, r), { type: Math.random() < density ? 'forest' : 'grass' })
      }
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
  const tiles = generateMap()

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

  return {
    tiles,
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
  }
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
