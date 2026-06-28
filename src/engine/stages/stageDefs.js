// ── Mossgate — Stage Definitions ───────────────────────────────────────────────
// All 9 narrative stages defined as data. Stage 0 is fully implemented;
// Stages 1–8 are stubs with the correct config shape.

import { addEvent } from '../world.js'

export const STAGE_DEFS = [

  // ── Stage 0: Dawn of the Settlement ──────────────────────────────────────────
  // Campfire, 1 citizen, no shelter. Chop trees, collect logs, build first house.
  {
    id: 0,
    name: 'Dawn of the Settlement',
    enterConditions: () => true,
    exitConditions:  (world) => world.buildings.some(b => b.type === 'house' && b.isBuilt),
    activeMechanics: ['woodFuel', 'treeChopping'],

    onEnter(world) {
      // Only houses are available in Stage 0 — nothing else
      world.unlocks = new Set(['house'])
      // Flush any non-house items in the build queue
      world.buildQueue = world.buildQueue.filter(b => b.type === 'house')
    },

    onTick(_world, _tick) {},
  },

  // ── Stage 1: First Shelter ────────────────────────────────────────────────────
  // House built. Farm needed. A second citizen is on the way.
  {
    id: 1,
    name: 'First Shelter',
    enterConditions: (world) => world.buildings.some(b => b.type === 'house' && b.isBuilt),
    exitConditions:  (world) => world.buildings.some(b => b.type === 'farm' && b.isBuilt)
                             && world.citizens.length >= 2,
    activeMechanics: ['woodFuel', 'treeChopping', 'farming'],

    onEnter(world) {
      world.unlocks.add('farm')
      world.unlocks.add('town_center')
      addEvent(world, 'Stage 1: A new arrival is expected. Plant a farm.')
    },

    onTick(_world, _tick) {},
  },

  // ── Stage 2: Scout Expeditions ────────────────────────────────────────────────
  // Unlocks after farm + second citizen settled.
  {
    id: 2,
    name: 'Scout Expeditions',
    enterConditions: (world) => world.buildings.some(b => b.type === 'farm' && b.isBuilt)
                             && world.citizens.length >= 2,
    exitConditions:  (_world) => false, // stub
    activeMechanics: ['woodFuel', 'treeChopping', 'farming', 'scouting'],
    onEnter(world) { addEvent(world, 'Stage 2: Scouts venture beyond the forest.') },
    onTick(_world, _tick) {},
  },

  // ── Stage 3: Road Network ─────────────────────────────────────────────────────
  // Unlocks after scouts report 3 farm sites + 1 neighbor found.
  {
    id: 3,
    name: 'Road Network',
    enterConditions: (_world) => false, // stub
    exitConditions:  (_world) => false,
    activeMechanics: ['woodFuel', 'farming', 'roads', 'diplomacy'],
    onEnter(world) { addEvent(world, 'Stage 3: Roads connect the growing settlement.') },
    onTick(_world, _tick) {},
  },

  // ── Stage 4: Second Wave ──────────────────────────────────────────────────────
  // Neighboring group merged. Winter warning incoming.
  {
    id: 4,
    name: 'Second Wave',
    enterConditions: (_world) => false,
    exitConditions:  (_world) => false,
    activeMechanics: ['farming', 'roads', 'population'],
    onEnter(world) { addEvent(world, 'Stage 4: New arrivals flood the settlement. Winter approaches.') },
    onTick(_world, _tick) {},
  },

  // ── Stage 5: Stone Construction ───────────────────────────────────────────────
  // Map fills up — time to build in stone and open the mine.
  {
    id: 5,
    name: 'Stone Construction',
    enterConditions: (_world) => false,
    exitConditions:  (_world) => false,
    activeMechanics: ['mining', 'stoneBuilding'],
    onEnter(world) { addEvent(world, 'Stage 5: The quarry opens. Stone replaces wood.') },
    onTick(_world, _tick) {},
  },

  // ── Stage 6: Winter ───────────────────────────────────────────────────────────
  // No farms. Survive on stored goods. Hidden research mechanic unlocks.
  {
    id: 6,
    name: 'Winter',
    enterConditions: (_world) => false,
    exitConditions:  (_world) => false,
    activeMechanics: ['woodFuel', 'storedFood', 'research'],
    onEnter(world) { addEvent(world, 'Stage 6: Winter falls. The farms lie dormant.') },
    onTick(_world, _tick) {},
  },

  // ── Stage 7: Spring Restart ───────────────────────────────────────────────────
  // Seasonal loop established.
  {
    id: 7,
    name: 'Spring Restart',
    enterConditions: (_world) => false,
    exitConditions:  (_world) => false,
    activeMechanics: ['farming', 'seasonal'],
    onEnter(world) { addEvent(world, 'Stage 7: Spring returns. The cycle begins again.') },
    onTick(_world, _tick) {},
  },

  // ── Stage 8: The Reckoning ────────────────────────────────────────────────────
  // Random disaster. City preparation determines outcome.
  {
    id: 8,
    name: 'The Reckoning',
    enterConditions: (_world) => false,
    exitConditions:  (_world) => false,
    activeMechanics: ['crisis', 'legacy'],
    onEnter(world) { addEvent(world, 'Stage 8: A reckoning arrives. What you have built will be tested.') },
    onTick(_world, _tick) {},
  },

  // ── Stage 9 (Endless) ─────────────────────────────────────────────────────────
  // Stage 8 survived. Random events continue indefinitely.
  {
    id: 9,
    name: 'Endless',
    enterConditions: (_world) => false,
    exitConditions:  (_world) => false,
    activeMechanics: ['all'],
    onEnter(world) { addEvent(world, 'The settlement endures. The story continues.') },
    onTick(_world, _tick) {},
  },
]
