// ── Layout: River Valley ───────────────────────────────────────────────────────
// Circular forest world with a river cutting through the upper-left quadrant.
// Terrain logic mirrors world.js generateTileType with a defined river feature.

export default {
  id:   'riverValley',
  name: 'River Valley',

  worldRadius:           50,
  startingClearingRadius: 3,

  resourceModifiers: { wood: 1.2, stone: 0.8, food: 1.1 },

  specialFeatures: [
    { type: 'river', rowMin: -12, rowMax: -5, amplitude: 5, sinFactor: 0.35 },
  ],

  // Returns a (col, row) => tileType closure seeded from the world seed.
  // rng: a seeded random function from the compositor (already advanced past layout's
  // allocation in the seed stream, so lakes are deterministic but world-unique).
  createTerrainFn(seed, rng) {
    // Inline hash — same formula as world.js hashTile so seeds are compatible
    function hash(col, row, s) {
      const n = Math.sin(col * 127.1 + row * 311.7 + s * 74.3) * 43758.5453123
      return n - Math.floor(n)
    }

    // 6 lakes placed in an outer ring (mirrors world.js generateLakes)
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

    // River: sinusoidal stripe at rows -12 to -5 (left-center of the map)
    function isRiver(col, row) {
      if (row < -12 || row > -5) return false
      const center = Math.sin(row * 0.35) * 5
      return Math.abs(col - center) < 1.5
    }

    // Lake check: noisy radius (same noise as world.js isWaterTile)
    function isLake(col, row) {
      if (Math.abs(col) <= 9 && Math.abs(row) <= 9) return false  // keep center dry
      for (const lk of lakes) {
        const d = Math.sqrt((col - lk.col) ** 2 + (row - lk.row) ** 2)
        if (d < lk.radius * (0.7 + hash(col, row, seed + 999) * 0.6)) return true
      }
      return false
    }

    return (col, row) => {
      // Starting clearing
      if (Math.abs(col) <= 3 && Math.abs(row) <= 3) return 'grass'

      // River valley feature
      if (isRiver(col, row)) return 'water'

      // Lakes
      if (isLake(col, row)) return 'water'

      const dist = Math.sqrt(col * col + row * row)

      // Resource strata — deeper = rarer (same thresholds as world.js)
      if (dist >= 30 && hash(col * 7.3 + 1.1, row * 5.1 + 0.7, seed + 9999) > 0.990) return 'uranium_ore'
      if (dist >= 18 && hash(col * 4.1 + 1.1, row * 3.7 + 0.7, seed + 7777) > 0.968) return 'iron_deposit'
      if (dist >= 12 && hash(col * 2.3 + 0.3, row * 1.9 + 0.8, seed + 5555) > 0.952) return 'coal_seam'
      if (dist >= 8  && hash(col * 3.7 + 0.5, row * 2.9 + 0.5, seed + 333)  > 0.94)  return 'rock'

      // Forest / grass blend — density decreases with distance
      const rand    = hash(col, row, seed)
      const density = Math.max(0.50, 0.82 - dist * 0.002)
      return rand < density ? 'forest' : 'grass'
    }
  },
}
