// ── Mossgate — Day / Night ─────────────────────────────────────────────────────

// Night cycle removed — always daytime.
export function getNightProgress(_tick) { return 0 }

// Generates a stable list of star screen positions (call once, reuse every frame)
export function makeStars(count = 180) {
  // Pseudo-random but deterministic — same stars every run
  const stars = []
  let seed = 0x4d6f7373  // "Moss"
  function rand() {
    seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5
    return ((seed >>> 0) / 0xffffffff)
  }
  for (let i = 0; i < count; i++) {
    stars.push({
      x:    rand(),        // 0-1 of canvas width
      y:    rand() * 0.7,  // top 70% of screen (sky)
      r:    0.6 + rand() * 1.2,
      twinkle: rand() * Math.PI * 2,  // phase offset for twinkle
    })
  }
  return stars
}
