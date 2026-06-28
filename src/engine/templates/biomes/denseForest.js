// ── Biome: Dense Forest ────────────────────────────────────────────────────────
// Current Mossgate appearance — dark green canopy, high tree density.
// groundColor and forestColor override the GROUND constants in the renderer.

export default {
  id:   'denseForest',
  name: 'Dense Forest',

  treeDensity: 0.85,

  groundColor: '#3a5c28',   // overrides GROUND.grass
  forestColor: '#1a3810',   // overrides GROUND.forest (floor), canopy stays procedural

  weatherPatterns: ['clear', 'overcast', 'light_rain'],
  wildlifeTypes:   ['deer', 'rabbit'],

  seasonalColors: {
    spring: { ground: '#4a7a30', forest: '#2a5020' },
    summer: { ground: '#3a5c28', forest: '#1a3810' },
    autumn: { ground: '#6a5a28', forest: '#4a3810' },
    winter: { ground: '#8a9a80', forest: '#3a4a30' },
  },
}
