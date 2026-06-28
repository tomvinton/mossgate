// ── Mossgate — Stage Manager ────────────────────────────────────────────────────
// Tracks the current narrative stage and drives transitions.

import { STAGE_DEFS } from './stageDefs.js'
import { addEvent } from '../world.js'

export function initStageManager(world) {
  world.stage = world.stage ?? 0
  STAGE_DEFS[world.stage].onEnter(world)
}

export function checkAdvance(world) {
  const current = STAGE_DEFS[world.stage]
  if (!current) return
  if (!current.exitConditions(world)) return

  const next = STAGE_DEFS[world.stage + 1]
  if (!next) return

  world.stage++
  addEvent(world, `Stage ${world.stage}: ${next.name}`)
  next.onEnter(world)
}

export function tickStage(world, tick) {
  STAGE_DEFS[world.stage]?.onTick?.(world, tick)
}
