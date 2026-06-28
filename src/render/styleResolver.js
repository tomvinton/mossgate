// ── Mossgate — Style Resolver ──────────────────────────────────────────────────
// Thin override layer between templates and the renderer.
// The renderer falls back to hardcoded constants when no override is active.

let _culture = null
let _biome   = null

export function setActiveStyle(culture, biome) {
  _culture = culture
  _biome   = biome
}

// Returns { top, left, right, h } override or null (renderer falls back to config.js)
export function getBuildingIso(buildingType) {
  return _culture?.buildingIso?.[buildingType] ?? null
}

// Returns a color string override or null (renderer falls back to GROUND constant)
export function getTileColor(tileType) {
  if (!_biome) return null
  if (tileType === 'grass')  return _biome.groundColor
  if (tileType === 'forest') return _biome.forestColor
  return null
}
