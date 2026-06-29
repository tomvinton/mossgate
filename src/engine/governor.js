// ── MossGate — The governor (settlement AI) ────────────────────────────────────
//
// Believable, unhurried decisions made from SEPARATE pressures — never "stability > N
// → expand". Each decision cycle the governor weighs food, wood, shelter and roads
// against three real constraints:
//
//   • LAND     — is there a spaced-out, suitable site to claim? (findParcelSite)
//   • LABOUR   — are there spare hands to work new land, or do we need people first?
//   • DISTANCE — is a far parcel worth a road instead of more sprawl?
//
// It also does ONE project at a time. While something is developing, the governor
// mostly waits — which is the single biggest reason growth feels gradual and legible.
//
// When all survival needs are met, the PEACEFUL DEVELOPMENT ENGINE fires instead of
// leaving the world frozen. It slowly extends paths, clears ground, and scouts ahead —
// keeping the settlement visibly alive even during a long population plateau.

import {
  PRESSURE, PARCEL_DEFS, GOVERNOR_DECISION_TICKS, VILLAGE_ROAD_UPGRADE_BATCH,
  CLAIM_MAX_RADIUS, TRAFFIC_TRAIL_UPGRADE, TRAFFIC_PATH_UPGRADE,
} from './config.js'
import { claimParcel, findParcelSite, developingParcels } from './parcels.js'
import { addEvent, setTile, tileType, dist } from './world.js'
import { revealAround, unkey } from './terrain.js'
import { foodDays } from './economy.js'

// Sum of work slots across active food/wood/other parcels — our current labour demand.
function activeJobSlots(world) {
  return world.parcels
    .filter(p => p.state === 'active')
    .reduce((n, p) => n + p.jobs, 0)
}

function hasSpareLabour(world) {
  return world.citizens.length > activeJobSlots(world)
}

function freeHutCount(world) {
  const taken = new Set(world.households.map(h => h.homeBuildingId))
  return world.buildings.filter(b => b.type === 'hut' && b.isBuilt && !taken.has(b.id)).length
}

// ── Branching orthogonal road network ─────────────────────────────────────────
// Rather than always drawing a straight line to the hearth (hub-and-spoke),
// new paths branch from the nearest existing path tile. Over time this produces
// a grid-like network that grows organically outward.
function layPath(world, target) {
  // Find the existing path/road tile closest to the target — that becomes the
  // branch point so new segments join the existing network, not the center.
  let sc = world.hearth.col, sr = world.hearth.row
  let bestD = dist(target.col, target.row, sc, sr)
  for (const [k, t] of world.tiles) {
    if (t.type !== 'path' && t.type !== 'road') continue
    const [c, r] = unkey(k)
    const d = dist(target.col, target.row, c, r)
    if (d < bestD) { bestD = d; sc = c; sr = r }
  }
  layOrthogonalPath(world, sc, sr, target.col, target.row)
}

// L-shaped orthogonal route: col-axis first, then row-axis.
// Produces clean 90° elbows instead of diagonals.
// Only writes 'path' on tiles that aren't already a path/trail/road — don't downgrade.
function layOrthogonalPath(world, c0, r0, c1, r1) {
  const SKIP = new Set(['water', 'hearth', 'field', 'path', 'trail', 'road'])
  let c = c0, r = r0
  const dc = Math.sign(c1 - c0)
  const dr = Math.sign(r1 - r0)

  while (c !== c1) {
    c += dc
    const ty = tileType(world, c, r)
    if (!ty || !SKIP.has(ty)) setTile(world, c, r, 'path')
    revealAround(world, c, r, 1)
  }
  while (r !== r1) {
    r += dr
    const ty = tileType(world, c, r)
    if (!ty || !SKIP.has(ty)) setTile(world, c, r, 'path')
    revealAround(world, c, r, 1)
  }
}

// ── The decision ───────────────────────────────────────────────────────────────
export function governorDecide(world) {
  const P = world.pressures
  const developing = developingParcels(world)

  // One project at a time. While a site is being developed, only allow an instant
  // road (no construction crew needed) if a far parcel badly wants one.
  if (developing.length > 0) {
    maybeLayRoad(world)
    world.governor.lastAction = 'tending the works'
    return
  }

  // Gather the candidate moves that clear their threshold AND their constraints.
  const candidates = []
  const rejected = []

  // FOOD — claim a foraging ground early (cheap, fast) or a real field once settled.
  // Only if there are spare hands to work it; otherwise the answer is "we need people".
  if (P.food > PRESSURE.food) {
    if (hasSpareLabour(world)) {
      const earlyGame = world.citizens.length < 6 &&
        !world.parcels.some(p => p.type === 'field')
      const type = earlyGame ? 'forage' : 'field'
      if (findParcelSite(world, type)) candidates.push({ type: 'claim', parcel: type, score: P.food })
      else rejected.push(`food: no site for ${type}`)
    } else {
      rejected.push(`food: pressure ${(P.food*100).toFixed(0)} but no spare labour`)
    }
  }

  // WOOD — claim a woodlot when the pile and the hearth comfort run thin.
  if (P.wood > PRESSURE.wood) {
    if (hasSpareLabour(world)) {
      if (findParcelSite(world, 'woodlot')) candidates.push({ type: 'claim', parcel: 'woodlot', score: P.wood })
      else rejected.push('wood: no site for woodlot')
    } else {
      rejected.push(`wood: pressure ${(P.wood*100).toFixed(0)} but no spare labour`)
    }
  }

  // SHELTER — add ONE homestead only when every bed is spoken for and food isn't in
  // crisis. This is the anti-house-spam guard: capacity is added reluctantly, never
  // speculatively, and never while people are hungry.
  if (P.shelter > PRESSURE.shelter) {
    if (freeHutCount(world) === 0) {
      if (foodDays(world) > 1.5) {
        if (findParcelSite(world, 'dwelling')) candidates.push({ type: 'claim', parcel: 'dwelling', score: P.shelter })
        else rejected.push('shelter: no site for dwelling')
      } else {
        rejected.push(`shelter: food too low (${foodDays(world).toFixed(1)} days)`)
      }
    } else {
      rejected.push(`shelter: pressure ${(P.shelter*100).toFixed(0)} but free huts exist`)
    }
  } else {
    rejected.push(`shelter: pressure ${(P.shelter*100).toFixed(0)} < threshold ${(PRESSURE.shelter*100).toFixed(0)}`)
  }

  // STORAGE — one store-yard per ~30 citizens (up to 3 total). Each raises capacity
  // so the settlement can hold enough food to stay confident as population grows.
  // Without this, a 100-citizen village has <1 day of food visible in the store
  // even when production is healthy, which collapses confidence and stalls migration.
  const nearCap = world.resources.food > world.storageCap.food * 0.85 ||
                  world.resources.wood > world.storageCap.wood * 0.85
  const storageCount  = world.parcels.filter(p => p.type === 'storage').length
  const storageWanted = Math.min(3, Math.floor(world.citizens.length / 30) + 1)
  if (storageCount < storageWanted && world.citizens.length >= 6 && nearCap) {
    if (findParcelSite(world, 'storage')) candidates.push({ type: 'claim', parcel: 'storage', score: 0.65 })
  }

  // ROAD — a far, busy parcel with no path.
  const roadTarget = farParcelNeedingRoad(world)
  if (P.road > PRESSURE.road && roadTarget) candidates.push({ type: 'road', target: roadTarget, score: P.road })

  // Store rejection notes for the debug overlay (capped so it doesn't grow forever).
  world.governor.notes = rejected.slice(0, 6)

  if (candidates.length === 0) {
    // Survival needs are met. Hand off to the peaceful development loop so the world
    // keeps slowly changing rather than freezing at a stable population plateau.
    if (!choosePeacefulProject(world)) {
      world.governor.lastAction = hasSpareLabour(world) ? 'content' : 'short of hands'
    }
    return
  }

  candidates.sort((a, b) => b.score - a.score)
  const move = candidates[0]
  if (move.type === 'claim') {
    claimParcel(world, move.parcel)
    world.governor.lastAction = `claiming ${PARCEL_DEFS[move.parcel].label.toLowerCase()}`
    world.governor.lastVisibleProjectTick = world.tick
  } else if (move.type === 'road') {
    layPath(world, move.target)
    move.target.hasPath = true
    world.governor.lastAction = 'laying a path'
    world.governor.lastVisibleProjectTick = world.tick
    addEvent(world, 'A path now runs out to the far work.')
  }
}

function farParcelNeedingRoad(world) {
  let best = null, bestD = 9
  for (const p of world.parcels) {
    if (p.state !== 'active' || p.jobs === 0 || p.hasPath) continue
    const d = dist(p.col, p.row, world.hearth.col, world.hearth.row)
    if (d > bestD) { bestD = d; best = p }
  }
  return best
}

function maybeLayRoad(world) {
  if (world.pressures.road <= PRESSURE.road) return
  const t = farParcelNeedingRoad(world)
  if (t) { layPath(world, t); t.hasPath = true; addEvent(world, 'A path now runs out to the far work.') }
}

// ── Parcel connection ─────────────────────────────────────────────────────────
// Every active/developing parcel should have a visible path, trail or road within
// arm's reach. The governor checks for disconnected parcels first in its peaceful
// project loop — connectivity is the highest-priority maintenance task.

function isParcelConnected(world, parcel) {
  const reach = parcel.half + 2
  for (let dc = -reach; dc <= reach; dc++) {
    for (let dr = -reach; dr <= reach; dr++) {
      const ty = tileType(world, parcel.col + dc, parcel.row + dr)
      if (ty === 'path' || ty === 'road' || ty === 'trail') return true
    }
  }
  return false
}

function tryConnectParcel(world) {
  for (const p of world.parcels) {
    if (p.type === 'hearth') continue
    if (p.state !== 'active' && p.state !== 'developing') continue
    if (isParcelConnected(world, p)) { p.connected = true; continue }
    p.connected = false

    // Branch from the nearest existing network tile so we grow the network rather
    // than always drawing from the hearth.
    let sc = world.hearth.col, sr = world.hearth.row
    let bestD = dist(p.col, p.row, sc, sr)
    for (const [k, t] of world.tiles) {
      if (t.type !== 'path' && t.type !== 'road' && t.type !== 'trail') continue
      const [c, r] = unkey(k)
      const d = dist(p.col, p.row, c, r)
      if (d < bestD) { bestD = d; sc = c; sr = r }
    }

    layOrthogonalPath(world, sc, sr, p.col, p.row)
    p.connected = true
    world.bgDirty = true
    world.governor.lastAction = `connecting ${p.name || p.type} to the road network`
    world.governor.lastVisibleProjectTick = world.tick
    addEvent(world, `A path now reaches ${p.name || 'an outlying ' + p.type}.`)
    return true
  }
  return false
}

// ── Traffic-based road upgrade ────────────────────────────────────────────────
// Trails worn heavily by citizens get paved to paths; busy paths become roads.
// The governor picks the single most-trafficked eligible tile each cycle.

function tryUpgradeByTraffic(world) {
  let bestKey = null, bestTraffic = 0, bestType = null
  for (const [k, t] of world.tiles) {
    if (!t.traffic) continue
    if (t.type === 'trail' && t.traffic >= TRAFFIC_TRAIL_UPGRADE && t.traffic > bestTraffic) {
      bestKey = k; bestTraffic = t.traffic; bestType = 'trail'
    } else if (t.type === 'path' && t.traffic >= TRAFFIC_PATH_UPGRADE && t.traffic > bestTraffic) {
      bestKey = k; bestTraffic = t.traffic; bestType = 'path'
    }
  }
  if (!bestKey) return false

  const [c, r] = unkey(bestKey)
  const newType = bestType === 'trail' ? 'path' : 'road'
  setTile(world, c, r, newType)
  world.bgDirty = true
  world.governor.lastAction = `paving a busy ${bestType} to ${newType}`
  world.governor.lastVisibleProjectTick = world.tick
  addEvent(world, `A well-worn ${bestType} has been improved to a ${newType}.`)
  return true
}

// ── Village-band peaceful projects ────────────────────────────────────────────
// After the settlement band transitions to 'village', the governor gains two
// additional peaceful options: building a village common and upgrading paths.

function hasCommon(world) {
  return world.parcels.some(p => p.type === 'common')
}

function tryBuildCommon(world) {
  if (hasCommon(world)) return false
  const site = findParcelSite(world, 'common')
  if (!site) return false
  claimParcel(world, 'common', site)
  world.governor.lastAction = 'planning the village common'
  world.governor.lastVisibleProjectTick = world.tick
  addEvent(world, 'A village common is being laid out near the hearth.')
  return true
}

// Upgrade a batch of path tiles near parcels/hearth into proper road tiles.
function tryUpgradeRoads(world) {
  let upgraded = 0
  // Upgrade paths close to the hearth first (most travelled).
  for (const [k, t] of world.tiles) {
    if (t.type !== 'path') continue
    const i = k.indexOf(',')
    const c = +k.slice(0, i), r = +k.slice(i + 1)
    const d = Math.hypot(c, r)
    if (d <= 20) {  // only upgrade paths within ~20 tiles of hearth
      setTile(world, c, r, 'road')
      world.bgDirty = true
      if (++upgraded >= VILLAGE_ROAD_UPGRADE_BATCH) break
    }
  }
  if (upgraded === 0) return false
  world.governor.lastAction = 'paving the roads'
  world.governor.lastVisibleProjectTick = world.tick
  addEvent(world, 'Well-trodden paths near the hearth are being paved into roads.')
  return true
}

// ── Peaceful development engine ────────────────────────────────────────────────
// When all survival pressures are below their thresholds the settlement could just
// sit frozen for thousands of in-game days. Instead, the governor makes slow, small
// improvements — extending a path, clearing ground, scouting ahead. One quiet act
// per N governor-decision intervals (currently every 2 decisions ≈ 4 real minutes at 1×).
//
// These acts are immediate (no construction queue). They're the settlement's version
// of ordinary maintenance and quiet curiosity.

const PEACEFUL_MIN_DECISIONS  = 2  // minimum gap between any peaceful act
const CLEAR_MIN_DECISIONS      = 5  // clearing is the most reliable fallback, so
                                    // throttle it hard — every 5 decisions ≈ 10 min at 1×

function choosePeacefulProject(world) {
  const gov = world.governor
  const currentDecision = Math.floor(world.tick / GOVERNOR_DECISION_TICKS)
  const decisionsSinceLast = currentDecision - (gov.lastPeacefulDecision || 0)

  // 1. Connect any parcel lacking road access — always fires immediately, no cooldown.
  if (tryConnectParcel(world)) {
    gov.lastPeacefulDecision = currentDecision
    return true
  }

  if (decisionsSinceLast < PEACEFUL_MIN_DECISIONS) return false

  // 2. Upgrade a heavily-trafficked tile (trail→path, path→road).
  if (tryUpgradeByTraffic(world)) {
    gov.lastPeacefulDecision = currentDecision
    return true
  }

  // 3. Village-band exclusive projects.
  if (world.band === 'village') {
    if (!hasCommon(world) && tryBuildCommon(world)) { gov.lastPeacefulDecision = currentDecision; return true }
    const roadDecisions = currentDecision - (gov.lastRoadUpgradeDecision || 0)
    if (roadDecisions >= 3 && tryUpgradeRoads(world)) {
      gov.lastRoadUpgradeDecision = currentDecision
      gov.lastPeacefulDecision = currentDecision
      return true
    }
  }

  // 4. Extend the frontier path into unexplored forest.
  if (tryExtendExploratoryPath(world)) {
    gov.lastPeacefulDecision = currentDecision
    return true
  }

  // 5. Clear ground near the network (throttled — repetitive but reliable).
  const clearDecisionsSinceLast = currentDecision - (gov.lastClearDecision || 0)
  if (clearDecisionsSinceLast >= CLEAR_MIN_DECISIONS && tryClearNearPath(world)) {
    gov.lastClearDecision = currentDecision
    gov.lastPeacefulDecision = currentDecision
    return true
  }

  // 6. Scout ahead — quiet, no visible change, keeps the map growing.
  tryLocalScout(world)
  gov.lastPeacefulDecision = currentDecision
  return true
}

// Extend the outermost path tile 3–4 tiles further into the forest.
// Capped so paths don't run off infinitely in one direction — they stop once
// they reach a modest buffer past the farthest claimed parcel.
function tryExtendExploratoryPath(world) {
  // Never extend beyond the farthest parcel + a small scout buffer.
  let farthestParcel = 8
  for (const p of world.parcels) {
    const d = Math.hypot(p.col, p.row)
    if (d > farthestParcel) farthestParcel = d
  }
  const maxDist = Math.min(CLAIM_MAX_RADIUS + 4, farthestParcel + 8)

  let best = null, bestD = 0
  for (const [k, t] of world.tiles) {
    if (t.type !== 'path' && t.type !== 'road') continue
    const [c, r] = unkey(k)
    const d = Math.hypot(c, r)
    if (d > bestD && d < maxDist) { bestD = d; best = { col: c, row: r } }
  }
  if (!best || bestD < 3) return false

  // Walk outward in the direction this path tile lies from the hearth.
  const len = Math.max(1, bestD)
  const dc = best.col / len, dr = best.row / len
  let col = best.col, row = best.row
  let laid = 0
  for (let i = 0; i < 4; i++) {
    col = Math.round(col + dc)
    row = Math.round(row + dr)
    const ty = tileType(world, col, row)
    if (ty === 'water' || ty === 'hearth' || ty === 'field') break
    // Only count truly new tiles — don't claim a visible project for re-tracing existing paths.
    if (ty !== 'path' && ty !== 'road' && ty !== 'trail') {
      setTile(world, col, row, 'path')
      laid++
    }
    revealAround(world, col, row, 2)
  }
  if (laid === 0) return false

  world.bgDirty = true
  world.governor.lastPeacefulTick = world.tick
  world.governor.lastVisibleProjectTick = world.tick
  world.governor.lastAction = 'extending a path into the forest'
  addEvent(world, 'A path was extended a little further into the trees.')
  return true
}

// Clear a small patch of unclaimed forest/grass within the already-revealed area.
// Starts path-adjacent (most visible), then falls back to anywhere revealed.
// This keeps working even after paths are fully cleared — as long as there is any
// revealed uncleared land between parcels, something happens.
function tryClearNearPath(world) {
  const CLEARABLE = new Set(['forest', 'grass', 'meadow'])
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]

  // Build a set of tiles claimed by any parcel (don't clear managed land).
  const claimedKeys = new Set()
  for (const p of world.parcels)
    for (const t of p.tiles) claimedKeys.add(`${t.col},${t.row}`)

  let cleared = 0

  // Pass 1: prefer tiles adjacent to an existing path.
  for (const [k, t] of world.tiles) {
    if (t.type !== 'path') continue
    const [c, r] = unkey(k)
    for (const [dc, dr] of dirs) {
      const nk = `${c + dc},${r + dr}`
      if (claimedKeys.has(nk)) continue
      const ty = tileType(world, c + dc, r + dr)
      if (CLEARABLE.has(ty)) {
        setTile(world, c + dc, r + dr, 'cleared')
        revealAround(world, c + dc, r + dr, 1)
        if (++cleared >= 2) break
      }
    }
    if (cleared >= 2) break
  }

  // Pass 2: if nothing path-adjacent is left, clear any revealed unclaimed forest.
  if (cleared === 0) {
    for (const k of world.revealedTiles) {
      if (claimedKeys.has(k)) continue
      const t = world.tiles.get(k)
      if (!t || !CLEARABLE.has(t.type)) continue
      const [c, r] = unkey(k)
      setTile(world, c, r, 'cleared')
      revealAround(world, c, r, 1)
      if (++cleared >= 2) break
    }
  }

  if (cleared === 0) return false

  world.bgDirty = true
  world.governor.lastPeacefulTick = world.tick
  world.governor.lastVisibleProjectTick = world.tick
  world.governor.lastAction = cleared > 0 ? 'clearing ground in the settlement' : 'clearing near a path'
  addEvent(world, 'A patch of forest was cleared within the settlement.')
  return true
}

// Reveal a small area in the direction of the settlement's outer edge.
// Visually: map fog retreats a little, hinting at what lies beyond.
function tryLocalScout(world) {
  let farthest = null, farthestD = 0
  for (const p of world.parcels) {
    const d = Math.hypot(p.col, p.row)
    if (d > farthestD) { farthestD = d; farthest = p }
  }
  // Scout beyond the farthest parcel in the same general direction.
  const angle = farthest
    ? Math.atan2(farthest.row, farthest.col)
    : (world.tick * 0.618) % (Math.PI * 2)
  const scoutDist = Math.max(8, farthestD) + 6
  const sc = Math.round(Math.cos(angle) * scoutDist)
  const sr = Math.round(Math.sin(angle) * scoutDist)
  revealAround(world, sc, sr, 4)

  world.governor.lastPeacefulTick = world.tick
  // Scouting is quiet — it doesn't change the visible settlement, so don't reset
  // lastVisibleProjectTick. Only path extension and clearing count as visible acts.
  world.governor.lastAction = 'scouting ahead'
  addEvent(world, 'Folk walked out to look at the land ahead.')
}

