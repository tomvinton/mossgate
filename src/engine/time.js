// ── MossGate — Time of day & seasons ───────────────────────────────────────────
// A small pure module that turns the tick counter into a readable clock. The render
// layer uses `dayPhase` for lighting; the sim uses `isNight` for the rest rhythm.

import {
  CYCLE_TICKS, DAY_TICKS, NIGHT_TICKS, DUSK_TICKS, DAWN_TICKS,
  SEASONS, SEASON_TICKS, SEASON_YIELD,
} from './config.js'

// 0 at dawn, runs to CYCLE_TICKS. Daylight occupies [0, DAY_TICKS).
export function timeOfDay(world) {
  return world.tick % CYCLE_TICKS
}

export function isNight(world) {
  return timeOfDay(world) >= DAY_TICKS
}

// Whole days elapsed since the world began.
export function dayNumber(world) {
  return Math.floor(world.tick / CYCLE_TICKS)
}

// Darkness amount, 0 (full day) → 1 (deep night), with smooth dusk/dawn ramps.
// Drives the ambient screen tint so the scene breathes between warm day and cool
// night without ever going pitch black.
export function darkness(world) {
  const t = timeOfDay(world)
  const NIGHT_MAX = 0.55
  if (t < DAY_TICKS - DUSK_TICKS) return 0                       // full day
  if (t < DAY_TICKS) return ((t - (DAY_TICKS - DUSK_TICKS)) / DUSK_TICKS) * NIGHT_MAX  // dusk
  const nt = t - DAY_TICKS
  if (nt < NIGHT_TICKS - DAWN_TICKS) return NIGHT_MAX            // full night
  return (1 - (nt - (NIGHT_TICKS - DAWN_TICKS)) / DAWN_TICKS) * NIGHT_MAX               // dawn
}

export function season(world) {
  return SEASONS[Math.floor(world.tick / SEASON_TICKS) % SEASONS.length]
}

export function seasonYield(world) {
  return SEASON_YIELD[season(world)] ?? 1
}

// Human-readable clock for the (hidden) debug overlay.
export function clockLabel(world) {
  const day = dayNumber(world) + 1
  return `Day ${day} · ${season(world)} · ${isNight(world) ? 'night' : 'day'}`
}
