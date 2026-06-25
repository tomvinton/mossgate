// ── Mossgate — Master Tick ─────────────────────────────────────────────────────

import { STUMP_DECAY_TICKS } from './config.js'
import { updateCitizens, spawnNewCitizen } from './citizens.js'
import { checkUnlocks, updateBuildQueue } from './needs.js'

export function tick(world) {
  world.tick++

  // Update all citizens
  updateCitizens(world)

  // Stump decay → grass
  for (const [k, t] of world.tiles) {
    if (t.type === 'stump' && world.tick >= (t.decayAt || 0)) {
      t.type = 'grass'
      delete t.decayAt
      world.bgDirty = true   // tile changed — background cache must rebuild
    }
  }

  // Check if new building types become available
  checkUnlocks(world)

  // Update builder's queue
  updateBuildQueue(world)

  // Pending arrivals — count down timers; spawn when they expire
  for (const a of world.pendingArrivals) a.timer--
  const ready = world.pendingArrivals.filter(a => a.timer <= 0)
  world.pendingArrivals = world.pendingArrivals.filter(a => a.timer > 0)
  for (const _ of ready) {
    spawnNewCitizen(world)
  }
}
