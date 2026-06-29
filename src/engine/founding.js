// ── MossGate — Founding a settlement ───────────────────────────────────────────
// Assembles the starting scene: a hearth, ONE standing hut with a founding family,
// and a single foraging ground. Deliberately almost too sparse — the map reveals
// itself as these first folk reach outward. Kept here (not in world.js) so the world
// factory stays dependency-free.

import { START_FOUNDERS } from './config.js'
import { createWorld } from './world.js'
import { claimParcel, advanceDevelopment } from './parcels.js'
import { seatHousehold } from './population.js'
import { recomputeConfidence, recomputePressures, tickUpkeep } from './economy.js'

export function foundWorld(seed = Math.random() * 99999) {
  const world = createWorld(seed)

  // The hearth sits at the exact centre and is "active" the moment it's claimed.
  claimParcel(world, 'hearth', { col: 0, row: 0 })

  // One homestead already stands, a little way off through the trees. We claim it then
  // immediately finish its construction so a family can move straight in.
  const dwelling = claimParcel(world, 'dwelling')
  if (dwelling) advanceDevelopment(world, dwelling, dwelling.develop)
  const hut = world.buildings.find(b => b.type === 'hut')
  if (hut) seatHousehold(world, hut, START_FOUNDERS)

  // A foraging ground gives the founders immediate, visible work.
  const forage = claimParcel(world, 'forage')
  if (forage) advanceDevelopment(world, forage, forage.develop)

  // Prime the read-outs so the first governor tick has real numbers to weigh.
  world.warmth = 0.5
  tickUpkeep(world)
  recomputeConfidence(world)
  recomputePressures(world)
  return world
}
