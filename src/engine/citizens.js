// ── MossGate — Citizen behaviour ───────────────────────────────────────────────
//
// Citizens must read as PURPOSEFUL. Each one has a clear, visible intent: walking to
// work, chopping, farming, hauling a load home, building a site, resting at the
// hearth, or sleeping at night. They take rest/social beats so they never robotically
// chain tasks forever, and they work by day and go home by night — the cozy heartbeat
// of the scene.

import {
  WALK_SPEED, PATH_SPEED_MULT, ROAD_SPEED_MULT, ARRIVE_EPS, WORK_CYCLE, CARRY_CAPACITY,
  DEPOSIT_TICKS, TRIPS_BEFORE_REST, REST_TICKS_MIN, REST_TICKS_MAX,
  IDLE_WANDER_CHANCE, CITIZEN_REVEAL,
} from './config.js'
import { dropPoint, tileType, dist, buildingById, parcelById } from './world.js'
import { revealAround, key } from './terrain.js'
import { isNight, seasonYield } from './time.js'
import { addResource } from './economy.js'
import {
  hiringParcels, developingParcels, freeWorkSpot, advanceDevelopment, fellTree,
} from './parcels.js'

const MAX_BUILDERS_PER_SITE = 2

let _cid = 1
function nextCitizenId() { return _cid++ }
export function setNextCitizenId(n) { _cid = n }

export function makeCitizen(world, x, y) {
  const id = nextCitizenId()
  return {
    id,
    name: '',           // assigned by caller (population.js / founding.js)
    householdId: null,
    homeBuildingId: null,
    x, y,
    tx: x, ty: y,
    state: 'idle',
    task: null,                 // 'forage' | 'farm' | 'chop' | 'build' | null
    workParcelId: null,
    buildParcelId: null,
    spot: null,                 // tile the citizen stands on to work
    carrying: null,             // { res, amt }
    workTimer: 0,
    restTimer: 0,
    tripsSinceRest: 0,
    chopPhase: 0,               // animates the axe swing while chopping
    bounce: Math.random() * Math.PI * 2,
    arrivalDay: Math.floor(world.tick / (world._cycleTicks || 6240)),
    history: [],
  }
}

// ── Movement ───────────────────────────────────────────────────────────────────
// Returns true on arrival. Walking a PATH tile is markedly faster — this is the whole
// reason roads are worth the governor's time.
function moveToward(world, c, tx, ty, nightSlow) {
  const d = dist(c.x, c.y, tx, ty)
  if (d < ARRIVE_EPS) { c.x = tx; c.y = ty; return true }
  const onType = tileType(world, Math.round(c.x), Math.round(c.y))
  let speed = onType === 'road'  ? WALK_SPEED * ROAD_SPEED_MULT
            : onType === 'path' || onType === 'trail' ? WALK_SPEED * PATH_SPEED_MULT
            : WALK_SPEED
  if (nightSlow) speed *= 0.7              // people dawdle home in the dark
  c.x += (tx - c.x) / d * speed
  c.y += (ty - c.y) / d * speed
  c.bounce += 0.32
  return false
}

function homePoint(world, c) {
  const b = c.homeBuildingId != null ? buildingById(world, c.homeBuildingId) : null
  return b ? { col: b.col, row: b.row } : { col: world.hearth.col, row: world.hearth.row }
}

// ── Per-tick update ────────────────────────────────────────────────────────────
export function updateCitizens(world) {
  const night = isNight(world)
  for (const c of world.citizens) stepCitizen(world, c, night)

  // Citizens uncover the world as they move through it — exploration reveals the map.
  if (world.tick % 12 === 0) {
    for (const c of world.citizens) revealAround(world, Math.round(c.x), Math.round(c.y), CITIZEN_REVEAL)
  }

  // Footfall tracking: tiles accumulate traffic from citizens passing through them.
  // High-traffic grass/cleared tiles will spontaneously become trails (see sim.js).
  if (world.tick % 8 === 0) {
    for (const c of world.citizens) {
      const t = world.tiles.get(key(Math.round(c.x), Math.round(c.y)))
      if (t) t.traffic = (t.traffic || 0) + 1
    }
  }
}

function stepCitizen(world, c, night) {
  switch (c.state) {
    case 'idle':       return decideNext(world, c, night)
    case 'wander':     return doWander(world, c, night)
    case 'to_work':    return doToWork(world, c, night)
    case 'working':    return doWorking(world, c, night)
    case 'to_storage': return doToStorage(world, c, night)
    case 'depositing': return doDepositing(world, c)
    case 'to_build':   return doToBuild(world, c, night)
    case 'building':   return doBuilding(world, c, night)
    case 'to_rest':    return doToRest(world, c)
    case 'resting':    return doResting(world, c, night)
    case 'to_home':    return doToHome(world, c)
    case 'sleeping':   return doSleeping(world, c, night)
    default:           c.state = 'idle'
  }
}

// ── Decision: what should an idle citizen do next? ─────────────────────────────
function decideNext(world, c, night) {
  c.task = null
  if (night) { headHome(world, c); return }

  // Time for a breather — a rest/social beat at the hearth.
  if (c.tripsSinceRest >= TRIPS_BEFORE_REST) {
    c.tripsSinceRest = 0
    c.state = 'to_rest'
    c.tx = world.hearth.col; c.ty = world.hearth.row
    return
  }

  // 1) Finish what the settlement started — construction takes priority over routine
  //    work, so a worker will set down its job and help raise a site (capped, so the
  //    fields and woodlots never empty out entirely). Without this, a fully-employed
  //    village can never complete a new homestead, and growth stalls.
  const site = developingParcels(world).find(p =>
    world.citizens.filter(x => x.buildParcelId === p.id).length < MAX_BUILDERS_PER_SITE)
  if (site) {
    c.workParcelId = null            // release the day job to go build
    c.buildParcelId = site.id
    c.task = 'build'
    c.state = 'to_build'
    c.tx = site.col; c.ty = site.row
    return
  }

  // 2) Keep an existing job if it's still hiring.
  if (c.workParcelId) {
    const p = parcelById(world, c.workParcelId)
    if (p && p.state === 'active' && p.jobs > 0) { goWork(world, c, p); return }
    c.workParcelId = null
  }

  // 3) Take an open job at a parcel that wants workers (nearest first).
  const hiring = hiringParcels(world)
  if (hiring.length > 0) {
    hiring.sort((a, b) => dist(c.x, c.y, a.col, a.row) - dist(c.x, c.y, b.col, b.row))
    goWork(world, c, hiring[0])
    return
  }

  // 4) Nothing to do — amble a little or linger by the hearth.
  if (Math.random() < IDLE_WANDER_CHANCE) {
    c.state = 'wander'
    const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 3
    c.tx = world.hearth.col + Math.cos(a) * r
    c.ty = world.hearth.row + Math.sin(a) * r
  } else {
    headHome(world, c)
  }
}

function goWork(world, c, p) {
  c.workParcelId = p.id
  c.spot = freeWorkSpot(world, p)
  c.task = p.workKind
  c.state = 'to_work'
  c.tx = c.spot.col; c.ty = c.spot.row
}

function headHome(world, c) {
  c.state = 'to_home'
  const h = homePoint(world, c); c.tx = h.col; c.ty = h.row
}

// ── State handlers ─────────────────────────────────────────────────────────────
function doWander(world, c, night) {
  if (moveToward(world, c, c.tx, c.ty, night) || Math.random() < 0.01) c.state = 'idle'
}

function doToWork(world, c, night) {
  const p = parcelById(world, c.workParcelId)
  if (!p || p.state !== 'active') { c.workParcelId = null; c.state = 'idle'; return }
  if (moveToward(world, c, c.tx, c.ty, night)) {
    c.state = 'working'
    c.workTimer = WORK_CYCLE[c.task]?.ticks || 120
  }
}

function doWorking(world, c, night) {
  const p = parcelById(world, c.workParcelId)
  if (!p || p.state !== 'active') { c.workParcelId = null; c.state = 'idle'; return }

  c.bounce += 0.2
  if (c.task === 'chop') c.chopPhase = Math.floor(c.workTimer / 6)

  if (--c.workTimer > 0) return

  // One work cycle complete → produce yield, haul once the arms are full.
  const cyc = WORK_CYCLE[c.task]
  if (!cyc) { c.state = 'idle'; return }
  let amt = cyc.yield
  if (cyc.resource === 'food') amt = Math.max(1, Math.round(amt * seasonYield(world)))

  if (c.task === 'chop') {
    // Fell the standing tree at this spot; pick a fresh tree for next time. The lot
    // regrows, so it's a renewable place rather than a patch stripped bare.
    fellTree(world, c.spot.col, c.spot.row)
    const fresh = p.workSpots.find(ws => tileType(world, ws.col, ws.row) === 'forest')
    if (fresh) c.spot = fresh
  }

  c.carrying = { res: cyc.resource, amt: (c.carrying?.amt || 0) + amt }
  if (c.carrying.amt >= CARRY_CAPACITY) {
    const drop = dropPoint(world, c.x, c.y)
    c.state = 'to_storage'; c.tx = drop.col; c.ty = drop.row
  } else {
    c.workTimer = cyc.ticks      // keep working this spot
    if (night) headHome(world, c)
  }
}

function doToStorage(world, c, night) {
  if (moveToward(world, c, c.tx, c.ty, night)) { c.state = 'depositing'; c.workTimer = DEPOSIT_TICKS }
}

function doDepositing(world, c) {
  if (--c.workTimer > 0) return
  if (c.carrying) { addResource(world, c.carrying.res, c.carrying.amt); c.carrying = null }
  c.tripsSinceRest++
  c.state = 'idle'
}

function doToBuild(world, c, night) {
  const p = parcelById(world, c.buildParcelId)
  if (!p || p.state !== 'developing') { c.buildParcelId = null; c.task = null; c.state = 'idle'; return }
  if (moveToward(world, c, c.tx, c.ty, night)) c.state = 'building'
}

function doBuilding(world, c, night) {
  const p = parcelById(world, c.buildParcelId)
  if (!p || p.state !== 'developing') { c.buildParcelId = null; c.task = null; c.state = 'idle'; return }
  c.bounce += 0.18
  advanceDevelopment(world, p, 1)             // one builder-tick of progress
  if (night) { c.buildParcelId = null; c.task = null; headHome(world, c) }
}

function doToRest(world, c) {
  if (moveToward(world, c, c.tx, c.ty, false)) {
    c.state = 'resting'
    c.restTimer = REST_TICKS_MIN + Math.floor(Math.random() * (REST_TICKS_MAX - REST_TICKS_MIN))
  }
}

function doResting(world, c, night) {
  c.bounce += 0.05
  if (--c.restTimer <= 0) c.state = 'idle'
  else if (night) headHome(world, c)
}

function doToHome(world, c) {
  const night = isNight(world)
  if (moveToward(world, c, c.tx, c.ty, night)) c.state = night ? 'sleeping' : 'idle'
}

function doSleeping(world, c, night) {
  if (!night) c.state = 'idle'
}
