// ── MossGate — Name generation ──────────────────────────────────────────────────
// Deterministic from world seed + entity id so names survive reloads.
// Small, cozy, fictional — no famous real names, no fantasy-epic weight.

function lcg(seed) {
  let s = ((seed * 1664525 + 1013904223) >>> 0)
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

const FIRST  = ['Mira','Tovin','Lessa','Orin','Bren','Calla','Marsh','Wren',
                 'Fenn','Sable','Rowan','Ashe','Ivy','Gale','Nessa','Cole',
                 'Ember','Arden','Brynn','Dusk','Finch','Haze','Lorne','Tess']
const FAMILY = ['Fen','Reed','Moss','Vale','Brook','Stone','Birch','Ash',
                'Glen','Croft','Dell','Ford','Mire','Thatch','Wold','Larch']

export function citizenName(worldSeed, citizenId) {
  const rng = lcg(Math.floor(worldSeed) * 1000 + citizenId)
  const first  = FIRST [Math.floor(rng() * FIRST.length)]
  const family = FAMILY[Math.floor(rng() * FAMILY.length)]
  return `${first} ${family}`
}

export function householdName(worldSeed, householdId) {
  const rng = lcg(Math.floor(worldSeed) * 2000 + householdId)
  const family = FAMILY[Math.floor(rng() * FAMILY.length)]
  return `${family} Household`
}

const PARCEL_SUFFIXES = {
  field:    ['Field','Plot','Tillage'],
  forage:   ['Foraging Ground','Gleaning','Berry Patch'],
  woodlot:  ['Woodlot','Timber Stand','Copse'],
  storage:  ['Granary','Storehouse','Stock Yard'],
  dwelling: ['Homestead','Holding','Croft'],
  hearth:   ['Hearthstone','The Hearth'],
  common:   ['Village Green','Hearthgreen','The Common'],
}

export function parcelName(worldSeed, parcelId, type, col, row) {
  const rng = lcg(Math.floor(worldSeed) * 3000 + parcelId)
  const suffixes = PARCEL_SUFFIXES[type] || ['Place']
  const suffix   = suffixes[Math.floor(rng() * suffixes.length)]

  if (type === 'hearth' || type === 'common') return suffix

  const angle = Math.atan2(row, col)
  const deg   = ((angle * 180 / Math.PI) + 360) % 360
  const dir   = deg < 45 || deg >= 315 ? 'East'
              : deg < 135              ? 'South'
              : deg < 225              ? 'West'
              :                         'North'

  if (rng() < 0.4) {
    const alt = ['Old','High','Far','Near'][Math.floor(rng() * 4)]
    return `${alt} ${suffix}`
  }
  return `${dir} ${suffix}`
}
