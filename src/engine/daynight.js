// ── Mossgate — Day / Night ─────────────────────────────────────────────────────

import { DAY_TICKS, NIGHT_TICKS, CYCLE_TICKS, DUSK_TICKS, DAWN_TICKS } from './config.js'

// Returns a 0→1 value where 0 = full day, 1 = full night
// Transitions smoothly through dusk and dawn.
export function getNightProgress(tick) {
  const t = ((tick % CYCLE_TICKS) + CYCLE_TICKS) % CYCLE_TICKS

  const duskStart  = DAY_TICKS - DUSK_TICKS       // day fading to night
  const nightStart = DAY_TICKS                     // full night begins
  const dawnStart  = DAY_TICKS + NIGHT_TICKS - DAWN_TICKS  // night fading to day

  if (t < duskStart)  return 0                            // full day
  if (t < nightStart) return (t - duskStart) / DUSK_TICKS // dusk 0→1
  if (t < dawnStart)  return 1                            // full night
  return 1 - (t - dawnStart) / DAWN_TICKS                 // dawn 1→0
}

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
