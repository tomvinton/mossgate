// ── Mossgate — BFS Pathfinding ─────────────────────────────────────────────────

import { key, unkey } from './world.js'

const DIRS = [[1,0],[-1,0],[0,1],[0,-1]]

// BFS on path/plaza tiles. Returns array of {col,row} from start (exclusive) to end (inclusive).
export function findPath(tiles, startC, startR, endC, endR) {
  if (startC === endC && startR === endR) return []

  const visited = new Map()   // key → parent key
  const queue   = [[startC, startR]]
  visited.set(key(startC, startR), null)

  while (queue.length) {
    const [c, r] = queue.shift()
    if (c === endC && r === endR) {
      // Reconstruct path
      const path = []
      let cur = key(endC, endR)
      while (cur !== null) {
        const [pc, pr] = unkey(cur)
        path.unshift({ col: pc, row: pr })
        cur = visited.get(cur)
      }
      return path.slice(1)   // exclude start position
    }
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr
      const nk = key(nc, nr)
      if (!visited.has(nk)) {
        const t = tiles.get(nk)
        if (t && (t.type === 'path' || t.type === 'plaza')) {
          visited.set(nk, key(c, r))
          queue.push([nc, nr])
        }
      }
    }
  }
  return []   // no path found
}

// Pick a random path tile reachable from (c, r). Returns {col, row} or null.
export function randomReachable(tiles, startC, startR) {
  const reachable = []
  const visited   = new Set([key(startC, startR)])
  const queue     = [[startC, startR]]

  while (queue.length) {
    const [c, r] = queue.shift()
    reachable.push({ col: c, row: r })
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr
      const nk = key(nc, nr)
      if (!visited.has(nk)) {
        const t = tiles.get(nk)
        if (t && (t.type === 'path' || t.type === 'plaza')) {
          visited.add(nk)
          queue.push([nc, nr])
        }
      }
    }
  }

  if (reachable.length <= 1) return null
  // Pick a random one that isn't the start
  const choices = reachable.filter(p => !(p.col === startC && p.row === startR))
  return choices[Math.floor(Math.random() * choices.length)] || null
}
