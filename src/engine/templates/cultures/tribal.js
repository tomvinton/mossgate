// ── Culture: Tribal ────────────────────────────────────────────────────────────
// Earthy, organic aesthetic — roundhouses, dirt paths, warm brown/tan palette.
// buildingIso overrides replace the default BUILDING_DEFS iso colors in the renderer.

export default {
  id:   'tribal',
  name: 'Tribal',

  buildingStyles: {
    house:        'roundhouse',
    farm:         'field_plot',
    logging_camp: 'log_circle',
    granary:      'wicker_store',
    well:         'mud_well',
    town_center:  'fire_circle',
  },

  colorPalette: {
    primary:   '#8a6a40',
    secondary: '#5a4020',
    accent:    '#c8a050',
    roof:      '#6a4a28',
    wall:      '#a07840',
  },

  // Iso color overrides for Era 1 buildings (earthy, less saturated than defaults)
  buildingIso: {
    house:        { top: '#c89060', left: '#8a5a28', right: '#6a4018', h: 1.4 },
    farm:         { top: '#6a8a3a', left: '#4a6a1a', right: '#3a5a0a', h: 0.4 },
    logging_camp: { top: '#8a7050', left: '#5a4828', right: '#3a3018', h: 0.8 },
    granary:      { top: '#c8a060', left: '#8a6830', right: '#6a5018', h: 1.6 },
    well:         { top: '#7a7060', left: '#504840', right: '#403830', h: 1.2 },
    town_center:  { top: '#d4a84a', left: '#a07820', right: '#805808', h: 2.0 },
  },

  citizenStyle: {
    bodyColor: '#8a6840',
    headColor: '#d0a870',
  },

  roadStyle:      { color: '#7a6050' },
  ambientDetails: ['cooking_fire', 'totem'],
}
