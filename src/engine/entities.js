// ── Mossgate — Villagers ───────────────────────────────────────────────────────

import { VILLAGER_COUNT, VILLAGER_COLORS } from './config.js'
import { getPathKeys, key, unkey } from './world.js'
import { findPath, randomReachable } from './pathfind.js'

const SPEED = 0.04   // tiles per tick

function makeVillager(id, col, row) {
  return {
    id,
    col:    col,
    row:    row,
    x:      col,    // fractional world position
    y:      row,
    path:   [],     // remaining waypoints [{col,row}]
    wait:   0,      // pause ticks before picking next destination
    color:  VILLAGER_COLORS[id % VILLAGER_COLORS.length],
    bounce: Math.random() * Math.PI * 2,  // walk bob phase
  }
}

export function spawnVillagers(world) {
  const pathKeys = getPathKeys(world)
  if (!pathKeys.length) return

  for (let i = 0; i < VILLAGER_COUNT; i++) {
    const k = pathKeys[Math.floor(Math.random() * pathKeys.length)]
    const [c, r] = unkey(k)
    world.entities.push(makeVillager(i, c, r))
  }
}

export function updateEntities(world) {
  for (const v of world.entities) {
    v.bounce += 0.18

    if (v.wait > 0) {
      v.wait--
      continue
    }

    // If no path, pick a new destination
    if (v.path.length === 0) {
      const dest = randomReachable(world.tiles, Math.round(v.x), Math.round(v.y))
      if (!dest) { v.wait = 40; continue }
      v.path = findPath(world.tiles, Math.round(v.x), Math.round(v.y), dest.col, dest.row)
      if (!v.path.length) { v.wait = 40; continue }
    }

    // Step toward next waypoint
    const next = v.path[0]
    const dx   = next.col - v.x
    const dy   = next.row - v.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist <= SPEED) {
      v.x    = next.col
      v.y    = next.row
      v.path = v.path.slice(1)
      if (v.path.length === 0) v.wait = 20 + Math.floor(Math.random() * 60)
    } else {
      v.x += (dx / dist) * SPEED
      v.y += (dy / dist) * SPEED
    }
  }
}
