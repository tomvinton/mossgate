// ── MossGate — Land & parcels ──────────────────────────────────────────────────
//
// A parcel is a CLAIMED PLACE, not a building on a tile. Fields, woodlots, foraging
// grounds, homesteads and store-yards are all parcels with a real footprint. The
// settlement claims land (spaced out, land-hungry) BEFORE it fills that land, which
// is what makes the early village sparse and spacious.
//
// Lifecycle:  surveying → developing → active  (→ declining → abandoned, later)
//   • claim     marks a footprint and reveals it; ground is staked/cleared
//   • develop   a builder works the site up from 0→100 (visible construction)
//   • active    fields till, huts house, woodlots can be felled & regrow

import {
  PARCEL_DEFS, GROUND, PARCEL_REVEAL, CLAIM_MIN_RADIUS, CLAIM_MAX_RADIUS,
  STUMP_REGROW_TICKS, GRANARY_BONUS, STOREYARD_BONUS,
} from './config.js'
import { nextId, addEvent, addHistory, setTile, tileType } from './world.js'
import { revealAround, key, tileTypeAt } from './terrain.js'
import { parcelName } from './names.js'

// Work performed at a parcel maps to a citizen work-cycle kind.
const WORK_KIND = { field: 'farm', forage: 'forage', woodlot: 'chop' }

// Terrain a clearing parcel is allowed to sit on (never water/rock/another claim).
const CLEARABLE = new Set(['grass', 'forest', 'cleared', 'meadow', 'stump'])

function footprintTiles(col, row, half) {
  const out = []
  for (let dc = -half; dc <= half; dc++)
    for (let dr = -half; dr <= half; dr++)
      out.push({ col: col + dc, row: row + dr })
  return out
}

function isClaimed(world, c, r) {
  for (const p of world.parcels)
    for (const t of p.tiles)
      if (t.col === c && t.row === r) return true
  return false
}

// Does a candidate footprint keep the required gap from every existing parcel?
function respectsSpacing(world, col, row, def) {
  for (const p of world.parcels) {
    const pdef = PARCEL_DEFS[p.type]
    const gap  = Math.max(def.spacing, pdef.spacing)
    const need = def.half + p.half + gap + 1
    if (Math.max(Math.abs(col - p.col), Math.abs(row - p.row)) < need) return false
  }
  return true
}

// Count how much of a footprint is forest — used to site woodlots on real woodland
// and foraging grounds on mixed wild land.
function forestFraction(world, tiles) {
  let f = 0
  for (const t of tiles) if (tileType(world, t.col, t.row) === 'forest') f++
  return f / tiles.length
}

function footprintBuildable(world, tiles, def) {
  for (const t of tiles) {
    if (isClaimed(world, t.col, t.row)) return false
    // Use tileTypeAt for tiles not yet generated — unknown tiles used to return null
    // and silently pass the water check, allowing buildings on lakes/rivers.
    const stored = world.tiles.get(key(t.col, t.row))
    const ty = stored ? stored.type : tileTypeAt(t.col, t.row, world.seed, world.water)
    if (ty === 'water' || ty === 'path' || ty === 'road' || ty === 'hearth') return false
    if (def.clears && ty === 'rock') return false
  }
  return true
}

// ── Site search ────────────────────────────────────────────────────────────────
// Scans outward from the hearth in rings and returns the best legal site for a parcel
// of `type`. "Best" = closest valid site (keeps the village connected) that still
// respects spacing (keeps it spread out) and suits the parcel's purpose.
export function findParcelSite(world, type) {
  const def = PARCEL_DEFS[type]
  let best = null, bestScore = -Infinity

  for (let radius = CLAIM_MIN_RADIUS; radius <= CLAIM_MAX_RADIUS; radius++) {
    // Sample points around the ring; a deterministic-ish jitter keeps growth organic.
    const steps = Math.max(8, Math.round(radius * 1.6))
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2 + radius * 0.7
      const col = Math.round(Math.cos(a) * radius)
      const row = Math.round(Math.sin(a) * radius)
      const tiles = footprintTiles(col, row, def.half)

      if (!footprintBuildable(world, tiles, def)) continue
      if (!respectsSpacing(world, col, row, def)) continue

      // Suitability: woodlots want trees; foraging wants wild land; fields & homes want
      // open ground; everything prefers being closer in (shorter walks).
      const ff = forestFraction(world, tiles)
      let suit = 0
      if (type === 'woodlot' || type === 'grove') {
        suit = ff                          // more trees = better
      } else if (type === 'forage') {
        suit = 0.5 + ff * 0.5             // wild, some trees
      } else {
        suit = 1 - ff                     // open ground for fields/homes
      }

      // Dwellings near an existing road/path/trail are preferred — road frontage.
      let bonus = 0
      if (type === 'dwelling') {
        const reach = def.half + 2
        outer: for (let dc = -reach; dc <= reach; dc++) {
          for (let dr = -reach; dr <= reach; dr++) {
            const ty = tileType(world, col + dc, row + dr)
            if (ty === 'path' || ty === 'road' || ty === 'trail') { bonus += 0.35; break outer }
          }
        }
      }

      // Fields cluster near other fields — creates an agricultural zone.
      if (type === 'field') {
        for (const p2 of world.parcels) {
          if (p2.type !== 'field') continue
          const d = Math.hypot(col - p2.col, row - p2.row)
          if (d < 14 && d > 2) { bonus += 0.25; break }
        }
      }

      const score = suit * 2 - radius * 0.08 + bonus

      if (score > bestScore) { bestScore = score; best = { col, row, tiles } }
    }
    // Once we've found a good site within a ring, stop — don't sprawl further than needed.
    if (best && radius >= CLAIM_MIN_RADIUS + 3) break
  }
  return best
}

// ── Claiming ───────────────────────────────────────────────────────────────────
export function claimParcel(world, type, site = null) {
  const def = PARCEL_DEFS[type]
  const s = site || findParcelSite(world, type)
  if (!s) return null
  if (!s.tiles) s.tiles = footprintTiles(s.col, s.row, def.half)   // allow a fixed site (e.g. the hearth)

  const id = nextId()
  const parcel = {
    id,
    type,
    col: s.col, row: s.row, half: def.half,
    tiles: s.tiles,
    state: def.develop > 0 ? 'developing' : 'active',
    develop: def.develop,
    progress: def.develop > 0 ? 0 : def.develop,
    jobs: def.jobs,
    workerIds: [],
    buildingId: null,
    workKind: WORK_KIND[type] || null,
    workSpots: [],
    name: parcelName(world.seed, id, type, s.col, s.row),
    history: [],
  }
  world.parcels.push(parcel)

  // Reveal the footprint so the claim is visible, but don't clear yet —
  // clearing happens progressively during development (see advanceDevelopment).
  revealAround(world, parcel.col, parcel.row, def.half + PARCEL_REVEAL)
  if (parcel.state === 'active') finalizeParcel(world, parcel)

  addEvent(world, `Claimed a ${def.label.toLowerCase()} ${distLabel(parcel)}.`)
  addHistory(parcel, world, `Claimed ${distLabel(parcel)}.`)
  return parcel
}

function distLabel(p) {
  const d = Math.hypot(p.col, p.row)
  return d < 8 ? 'near the hearth' : d < 16 ? 'out past the trees' : 'at the forest edge'
}

// ── Development ────────────────────────────────────────────────────────────────
// Called by a builder citizen each tick they're working the site. Returns true when
// the parcel becomes active.
export function advanceDevelopment(world, parcel, amount) {
  if (parcel.state !== 'developing') return false
  parcel.progress += amount

  // Progressive clearing: land is cleared in stages as work advances so the
  // site reads as gradually being prepared rather than instantly bulldozed.
  const def = PARCEL_DEFS[parcel.type]
  if (def.clears) progressivelyClear(world, parcel)

  if (parcel.progress >= parcel.develop) {
    parcel.progress = parcel.develop
    finalizeParcel(world, parcel)
    return true
  }
  return false
}

// Clear tiles proportional to construction progress (roughly 4 visible stages).
function progressivelyClear(world, parcel) {
  const ratio  = Math.min(1, parcel.progress / parcel.develop)
  const target = Math.ceil(ratio * parcel.tiles.length)
  let count = 0
  for (const t of parcel.tiles) {
    if (count >= target) break
    const stored = world.tiles.get(key(t.col, t.row))
    const ty = stored ? stored.type : null
    if (ty && ty !== 'water' && ty !== 'cleared' && ty !== 'hearth' &&
        ty !== 'field' && ty !== 'common') {
      setTile(world, t.col, t.row, 'cleared')
    }
    count++
  }
}

function finalizeParcel(world, parcel) {
  parcel.state = 'active'
  const def = PARCEL_DEFS[parcel.type]

  if (parcel.type === 'field') {
    for (const t of parcel.tiles) setTile(world, t.col, t.row, 'field')
    parcel.workSpots = parcel.tiles.map(t => ({ ...t }))
  } else if (parcel.type === 'forage') {
    // Tend the wild ground: grass becomes meadow, forest stays (berries under canopy).
    for (const t of parcel.tiles)
      if (tileType(world, t.col, t.row) === 'grass') setTile(world, t.col, t.row, 'meadow')
    parcel.workSpots = parcel.tiles.map(t => ({ ...t }))
  } else if (parcel.type === 'woodlot') {
    // Work spots are the standing trees; they'll be felled and regrow over time.
    parcel.workSpots = parcel.tiles
      .filter(t => tileType(world, t.col, t.row) === 'forest')
      .map(t => ({ ...t }))
    if (parcel.workSpots.length === 0) parcel.workSpots = parcel.tiles.map(t => ({ ...t }))
  } else if (parcel.type === 'dwelling') {
    placeBuilding(world, parcel, 'hut', { beds: def.beds || 1 })
  } else if (parcel.type === 'storage') {
    placeBuilding(world, parcel, 'granary', {})
    world.storageCap.food += GRANARY_BONUS
    world.storageCap.wood += STOREYARD_BONUS
  } else if (parcel.type === 'hearth') {
    setTile(world, parcel.col, parcel.row, 'hearth')
  } else if (parcel.type === 'common') {
    for (const t of parcel.tiles) setTile(world, t.col, t.row, 'common')
  } else if (parcel.type === 'grove') {
    // A protected grove — tiles stay as-is. The parcel claim itself is the protection;
    // clearing logic skips claimed tiles so this forest will not be bulldozed.
  }

  addEvent(world, `The ${def.label.toLowerCase()} is ready.`)
  addHistory(parcel, world, `Became active.`)
}

function placeBuilding(world, parcel, type, extra) {
  const b = {
    id: nextId(), type, parcelId: parcel.id,
    col: parcel.col, row: parcel.row,
    isBuilt: true, ...extra,
  }
  world.buildings.push(b)
  parcel.buildingId = b.id
  return b
}

// ── Woodlot felling & regrowth ─────────────────────────────────────────────────
// A chopped tree becomes a stump that regrows to forest, so a woodlot is a renewable
// PLACE — never stripped bare and abandoned.
export function fellTree(world, col, row) {
  if (tileType(world, col, row) !== 'forest') return false
  setTile(world, col, row, 'stump', world.tick + STUMP_REGROW_TICKS)
  return true
}

export function regrowStumps(world) {
  for (const [k, t] of world.tiles) {
    if (t.type === 'stump' && t.decayAt && world.tick >= t.decayAt) {
      const [c, r] = k.split(',').map(Number)
      // Regrow only inside a woodlot (tended), otherwise leave bare ground reclaiming.
      setTile(world, c, r, 'forest')
    }
  }
}

// ── Work-slot assignment ───────────────────────────────────────────────────────
// Free work spots a newly-tasked worker can claim within an active parcel.
export function freeWorkSpot(world, parcel) {
  const taken = new Set(
    world.citizens.filter(c => c.workParcelId === parcel.id && c.spot)
      .map(c => key(c.spot.col, c.spot.row))
  )
  for (const ws of parcel.workSpots) if (!taken.has(key(ws.col, ws.row))) return ws
  return parcel.workSpots[0] || { col: parcel.col, row: parcel.row }
}

// Parcels that still want workers (have an active job and an open slot).
export function hiringParcels(world) {
  return world.parcels.filter(p =>
    p.state === 'active' && p.jobs > 0 &&
    world.citizens.filter(c => c.workParcelId === p.id).length < p.jobs)
}

// Parcels still under construction that want a builder.
export function developingParcels(world) {
  return world.parcels.filter(p => p.state === 'developing')
}
