// ── Mossgate — City Growth ─────────────────────────────────────────────────────

import { BUILDINGS } from './config.js'
import { key, unkey, computeBounds } from './world.js'

const DIRS = [[1,0],[-1,0],[0,1],[0,-1]]

const BUILDING_POOL = [
  'house','house','house','cottage','cottage',
  'shop','bakery','market','smithy','inn',
  'garden','garden','tree','tree','tree',
]

function neighbors(c, r) {
  return DIRS.map(([dc, dr]) => [c + dc, r + dr])
}

function hasBuilding(buildings, c, r) {
  return buildings.some(b => b.col === c && b.row === r)
}

// Returns empty cells adjacent to any road tile
function roadAdjacentEmpty(tiles, buildings) {
  const candidates = new Set()
  for (const [k, t] of tiles) {
    if (t.type !== 'path' && t.type !== 'plaza') continue
    const [c, r] = unkey(k)
    for (const [nc, nr] of neighbors(c, r)) {
      const nk = key(nc, nr)
      const nt = tiles.get(nk)
      if ((!nt || nt.type === 'grass') && !hasBuilding(buildings, nc, nr)) {
        candidates.add(nk)
      }
    }
  }
  return [...candidates].map(k => unkey(k))
}

// Returns road endpoint tiles (path tiles with only 1 road neighbor)
function roadEndpoints(tiles) {
  const endpoints = []
  for (const [k, t] of tiles) {
    if (t.type !== 'path') continue
    const [c, r] = unkey(k)
    let roadNeighbors = 0
    for (const [nc, nr] of neighbors(c, r)) {
      const nt = tiles.get(key(nc, nr))
      if (nt && (nt.type === 'path' || nt.type === 'plaza')) roadNeighbors++
    }
    if (roadNeighbors <= 1) endpoints.push([c, r])
  }
  return endpoints
}

export function growCity(world) {
  const roll = Math.random()

  if (roll < 0.35) {
    // Extend a road by 1 tile
    const endpoints = roadEndpoints(world.tiles)
    if (!endpoints.length) return

    const [c, r] = endpoints[Math.floor(Math.random() * endpoints.length)]
    // Pick a direction that doesn't already have a road
    const options = []
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr
      const t  = world.tiles.get(key(nc, nr))
      if (!t || t.type === 'grass') options.push([nc, nr])
    }
    if (!options.length) return
    const [nc, nr] = options[Math.floor(Math.random() * options.length)]
    world.tiles.set(key(nc, nr), { type: 'path' })
    world.frontier.add(key(nc, nr))

  } else if (roll < 0.75) {
    // Place a building adjacent to road
    const candidates = roadAdjacentEmpty(world.tiles, world.buildings)
    if (!candidates.length) return

    const [c, r] = candidates[Math.floor(Math.random() * candidates.length)]
    const type   = BUILDING_POOL[Math.floor(Math.random() * BUILDING_POOL.length)]

    if (!world.tiles.has(key(c, r))) world.tiles.set(key(c, r), { type: 'grass' })
    world.buildings.push({ id: world.buildings.length, col: c, row: r, type, age: 0 })
    world.newBuilding = { col: c, row: r }   // signal camera to look here

  } else {
    // Scatter a tree on grass near city edge
    const { minC, maxC, minR, maxR } = world.bounds
    for (let attempt = 0; attempt < 10; attempt++) {
      const c = minC - 2 + Math.floor(Math.random() * (maxC - minC + 5))
      const r = minR - 2 + Math.floor(Math.random() * (maxR - minR + 5))
      const k = key(c, r)
      if (!world.tiles.has(k) && !hasBuilding(world.buildings, c, r)) {
        world.tiles.set(k, { type: 'grass' })
        world.buildings.push({ id: world.buildings.length, col: c, row: r, type: 'tree', age: 0 })
        break
      }
    }
  }

  world.bounds = computeBounds(world.tiles)
}
