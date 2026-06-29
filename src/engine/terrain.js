// ── MossGate — Terrain & reveal ────────────────────────────────────────────────
// Infinite, deterministic, seed-driven terrain. Every (col,row) hashes to the same
// tile for a given seed, so a world is unique and reproducible. Tiles are generated
// lazily as the settlement reveals them — the map literally does not exist until the
// people reach toward it.

import { INITIAL_REVEAL } from './config.js'

export const key   = (c, r) => `${c},${r}`
export const unkey = (k) => { const i = k.indexOf(','); return [+k.slice(0, i), +k.slice(i + 1)] }

// Deterministic value-noise hash → [0,1).
export function hashTile(col, row, seed) {
  const n = Math.sin(col * 127.1 + row * 311.7 + seed * 74.3) * 43758.5453123
  return n - Math.floor(n)
}

// Small seeded LCG for world-feature placement.
export function seededRng(seed) {
  let s = Math.floor(seed * 9301 + 49297) % 233280
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

// ── World features: lakes & a meandering river ─────────────────────────────────
// These give each seed its own landmarks (a river bend, a couple of ponds), which is
// a big part of why one world feels different from the next.
export function generateWater(seed) {
  const rng = seededRng(seed)
  const lakes = []
  for (let i = 0; i < 4; i++) {
    const angle = rng() * Math.PI * 2
    const dist  = 16 + rng() * 30
    lakes.push({
      col: Math.round(Math.cos(angle) * dist),
      row: Math.round(Math.sin(angle) * dist),
      radius: 2.5 + rng() * 3.5,
    })
  }
  const rivers = []
  for (let i = 0; i < 1 + Math.floor(rng() * 2); i++) {
    rivers.push({
      angle: rng() * Math.PI * 2,
      amplitude: 3 + rng() * 5,
      frequency: 0.05 + rng() * 0.05,
      phase: rng() * Math.PI * 2,
    })
  }
  return { lakes, rivers }
}

function isWater(col, row, seed, water) {
  if (Math.abs(col) <= 8 && Math.abs(row) <= 8) return false   // keep the home clearing dry
  for (const rv of water.rivers) {
    const cosA = Math.cos(rv.angle), sinA = Math.sin(rv.angle)
    const t    =  col * cosA + row * sinA
    const perp = -col * sinA + row * cosA
    const center = rv.amplitude * Math.sin(rv.frequency * t + rv.phase)
    if (Math.abs(perp - center) < 1.3) return true
  }
  for (const lk of water.lakes) {
    const d = Math.hypot(col - lk.col, row - lk.row)
    const noisyR = lk.radius * (0.7 + hashTile(col, row, seed + 999) * 0.6)
    if (d < noisyR) return true
  }
  return false
}

// The terrain rule. The starting area is a friendly grassy clearing ringed by forest;
// stone outcrops appear further out. Forest thins gently with distance so the eye has
// somewhere open to settle.
export function tileTypeAt(col, row, seed, water) {
  const dist = Math.hypot(col, row)
  if (dist <= 2) return 'grass'                         // home clearing
  if (isWater(col, row, seed, water)) return 'water'
  if (dist >= 7) {
    const rockHash = hashTile(col * 3.7 + 0.5, row * 2.9 + 0.5, seed + 333)
    if (rockHash > 0.945) return 'rock'
  }
  const rand    = hashTile(col, row, seed)
  const density = Math.max(0.45, 0.80 - dist * 0.004)   // forest a touch denser near home
  return rand < density ? 'forest' : 'grass'
}

// Ensure a tile object exists in the map (lazy generation).
export function ensureTile(world, col, row) {
  const k = key(col, row)
  let t = world.tiles.get(k)
  if (!t) {
    t = { type: tileTypeAt(col, row, world.seed, world.water) }
    world.tiles.set(k, t)
  }
  return t
}

// Reveal every tile within `radius` of (col,row), generating terrain on demand.
export function revealAround(world, col, row, radius) {
  const r = Math.ceil(radius)
  let changed = false
  for (let dc = -r; dc <= r; dc++) {
    for (let dr = -r; dr <= r; dr++) {
      if (dc * dc + dr * dr > radius * radius) continue
      const c = col + dc, ro = row + dr
      const k = key(c, ro)
      if (!world.tiles.has(k)) world.tiles.set(k, { type: tileTypeAt(c, ro, world.seed, world.water) })
      if (!world.revealedTiles.has(k)) { world.revealedTiles.add(k); changed = true; world.revealedVersion = (world.revealedVersion || 0) + 1 }
    }
  }
  if (changed) world.bgDirty = true
}

export function revealInitial(world) {
  revealAround(world, 0, 0, INITIAL_REVEAL)
}
