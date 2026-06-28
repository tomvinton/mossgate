// ── Era: Wood Age ──────────────────────────────────────────────────────────────
// Earliest era — only basic hand-built structures, no stone processing.
// The tick engine still controls era transitions; this template declares the
// initial set of available buildings and resource types.

export default {
  id:   'wood',
  name: 'Wood Age',

  availableBuildings: ['house', 'town_center', 'farm', 'logging_camp', 'granary', 'well'],
  resourceTypes:      ['food', 'wood', 'stone'],

  populationCap:       12,   // data only — tick.js ERA_DEFS[1].maxPop controls this
  productionModifiers: { buildSpeed: 1.0, foodProduction: 0.9 },

  // Placeholder — tick.js handles era transitions via hardcoded conditions.
  // These will drive the transition logic in a future refactor.
  unlockConditions: {},
}
