// ── Mossgate — Weighted A* Pathfinding ─────────────────────────────────────────
// Roads are strongly preferred (cost 1). Grass/forest are passable but expensive.
// Built buildings and water are impassable.

import { key, unkey } from './world.js'

const DIRS = [[1,0],[-1,0],[0,1],[0,-1]]

// ── Terrain cost ───────────────────────────────────────────────────────────────

function tileCost(type) {
  switch (type) {
    case 'path':
    case 'plaza':
    case 'bridge':
      return 1
    case 'grass':
    case 'stump':
    case 'farmland':
    case 'tombstone':
      return 8
    case 'forest':
    case 'rock':
    case 'coal_seam':
    case 'iron_deposit':
    case 'uranium_ore':
    case 'rubble':
      return 20
    default:
      return Infinity   // water, contamination, nuclear_ruin, etc.
  }
}

// ── Min-heap priority queue ────────────────────────────────────────────────────

class MinHeap {
  constructor() { this._h = [] }
  get size() { return this._h.length }
  push(item) {
    this._h.push(item)
    this._up(this._h.length - 1)
  }
  pop() {
    const top  = this._h[0]
    const last = this._h.pop()
    if (this._h.length > 0) { this._h[0] = last; this._down(0) }
    return top
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this._h[p].f <= this._h[i].f) break
      ;[this._h[p], this._h[i]] = [this._h[i], this._h[p]]
      i = p
    }
  }
  _down(i) {
    const n = this._h.length
    for (;;) {
      let m = i, l = 2*i+1, r = 2*i+2
      if (l < n && this._h[l].f < this._h[m].f) m = l
      if (r < n && this._h[r].f < this._h[m].f) m = r
      if (m === i) break
      ;[this._h[m], this._h[i]] = [this._h[i], this._h[m]]
      i = m
    }
  }
}

function manhattan(c, r, ec, er) { return Math.abs(c - ec) + Math.abs(r - er) }

// ── A* pathfinding ─────────────────────────────────────────────────────────────
// Returns [{col,row}] from start (exclusive) to end (inclusive), or [] if unreachable.
// buildings: world.buildings array — built buildings block movement.

export function findPath(tiles, buildings, startC, startR, endC, endR) {
  if (startC === endC && startR === endR) return []

  // Pre-build impassable set from built buildings
  const blocked = new Set()
  for (const b of buildings) {
    if (b.isBuilt) blocked.add(key(b.col, b.row))
  }

  const startKey = key(startC, startR)
  const endKey   = key(endC, endR)

  const gScore   = new Map([[startKey, 0]])
  const cameFrom = new Map()
  const open     = new MinHeap()
  const closed   = new Set()

  open.push({ f: manhattan(startC, startR, endC, endR), c: startC, r: startR })

  while (open.size > 0) {
    const { c, r } = open.pop()
    const curKey = key(c, r)

    if (closed.has(curKey)) continue
    closed.add(curKey)

    if (c === endC && r === endR) {
      const path = []
      let cur = endKey
      while (cur !== startKey) {
        const [pc, pr] = unkey(cur)
        path.unshift({ col: pc, row: pr })
        cur = cameFrom.get(cur)
      }
      return path
    }

    const curG = gScore.get(curKey) ?? Infinity

    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr
      const nk = key(nc, nr)
      if (closed.has(nk)) continue

      // The destination is always reachable even if it's a building tile
      if (nk !== endKey && blocked.has(nk)) continue

      const tile = tiles.get(nk)
      if (!tile) continue

      const cost = tileCost(tile.type)
      if (!isFinite(cost)) continue

      const ng = curG + cost
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng)
        cameFrom.set(nk, curKey)
        open.push({ f: ng + manhattan(nc, nr, endC, endR), c: nc, r: nr })
      }
    }
  }

  return []   // unreachable
}

// ── Random reachable road tile (used by villager entities) ─────────────────────
// Pick a random path/plaza tile reachable from (c, r) via BFS over road tiles only.
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
  const choices = reachable.filter(p => !(p.col === startC && p.row === startR))
  return choices[Math.floor(Math.random() * choices.length)] || null
}
