// ── Mossgate — Seed System ─────────────────────────────────────────────────────
// Maps a seed (number or string) deterministically to a set of template IDs.
// Adding new templates to an array expands the pool — existing seeds shift to new
// combinations, which is intentional (new content = new worlds).

const LAYOUTS  = ['riverValley']
const ERAS     = ['wood']
const CULTURES = ['tribal']
const BIOMES   = ['denseForest']

function djb2(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h ^ str.charCodeAt(i)) >>> 0
  return h
}

export function seedToWorld(seed) {
  const n = typeof seed === 'string' ? djb2(seed) : Math.abs(seed | 0)
  return {
    layoutId:  LAYOUTS [(n)              % LAYOUTS.length],
    eraId:     ERAS    [(n * 13 + 7)     % ERAS.length],
    cultureId: CULTURES[(n * 31 + 11)    % CULTURES.length],
    biomeId:   BIOMES  [(n * 71 + 17)    % BIOMES.length],
  }
}
