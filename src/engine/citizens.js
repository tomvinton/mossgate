// ── Mossgate — Citizen AI (general worker system) ──────────────────────────────
// Phase 1: all citizens are general workers. They pick tasks dynamically
// (forage / chop / build) based on what the settlement needs most.
// Specialised roles (farmer, logger, guard, …) come in a later phase.

import { TASKS, BUILDING_DEFS, ARRIVE_MIN_TICKS, ARRIVE_MAX_TICKS, REVEAL_RADIUS } from './config.js'
import { key, makeCitizen, addEvent, revealAround } from './world.js'
import { getNightProgress } from './daynight.js'

const MOVE_SPEED  = 0.035   // tiles per tick
const STOCKPILE   = { x: 0, y: 0 }
const ARRIVE_DIST = 0.15

// ── Farmland expansion ─────────────────────────────────────────────────────────
// When a farm is completed, flood-fill up to 8 adjacent grass tiles as farmland.

const MAX_FARMLAND = 8

function expandFarmland(world, farm) {
  const occupied = new Set(world.buildings.map(b => `${b.col},${b.row}`))
  const queue    = [[farm.col, farm.row]]
  const visited  = new Set([`${farm.col},${farm.row}`])
  let   count    = 0

  while (queue.length > 0 && count < MAX_FARMLAND) {
    const [c, r] = queue.shift()
    for (const [nc, nr] of [[c+1,r],[c-1,r],[c,r+1],[c,r-1]]) {
      if (count >= MAX_FARMLAND) break
      const k    = `${nc},${nr}`
      if (visited.has(k)) continue
      visited.add(k)
      const tile = world.tiles.get(k)
      if (!tile || occupied.has(k)) continue
      if (tile.type === 'grass' || tile.type === 'stump') {
        tile.type = 'farmland'
        delete tile.decayAt
        count++
        queue.push([nc, nr])
      }
    }
  }
  if (count > 0) world.bgDirty = true
}

// ── Road laying ────────────────────────────────────────────────────────────────
// Traces a diagonal path from a building toward the world center (0,0),
// converting tiles to 'path' as it goes.

function layRoadToCenter(world, fromCol, fromRow) {
  let c = fromCol, r = fromRow
  let changed = false
  const maxSteps = Math.abs(c) + Math.abs(r) + 2
  for (let i = 0; i < maxSteps; i++) {
    if (c === 0 && r === 0) break
    const dc = c > 0 ? -1 : c < 0 ? 1 : 0
    const dr = r > 0 ? -1 : r < 0 ? 1 : 0
    c += dc; r += dr
    const tile = world.tiles.get(key(c, r))
    if (tile) { tile.type = 'path'; delete tile.decayAt; changed = true }
    revealAround(world, c, r, 3)   // reveal a corridor along the road
  }
  if (changed) world.bgDirty = true
}

// ── Movement ───────────────────────────────────────────────────────────────────

function moveToward(citizen, tx, ty) {
  const dx = tx - citizen.x
  const dy = ty - citizen.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist <= ARRIVE_DIST) {
    citizen.x = tx
    citizen.y = ty
    return true
  }
  citizen.x += (dx / dist) * MOVE_SPEED
  citizen.y += (dy / dist) * MOVE_SPEED
  return false
}

// ── Forest tile targeting ──────────────────────────────────────────────────────

function claimedTiles(world, excludeId) {
  const claimed = new Set()
  for (const c of world.citizens) {
    if (c.id !== excludeId && c.targetTile) claimed.add(c.targetTile)
  }
  return claimed
}

function nearestForestTile(world, cx, cy, excludeId) {
  const claimed = claimedTiles(world, excludeId)
  let best = null, bestDist = Infinity
  for (const [k, t] of world.tiles) {
    if (!world.revealedTiles.has(k)) continue
    if (t.type !== 'forest') continue
    if (claimed.has(k)) continue
    const [c, r] = k.split(',').map(Number)
    const d = Math.abs(c - cx) + Math.abs(r - cy)
    if (d < bestDist) { bestDist = d; best = { col: c, row: r, key: k } }
  }
  return best
}

// ── Home assignment ────────────────────────────────────────────────────────────

export function assignHome(citizen, world) {
  for (const b of world.buildings) {
    if (b.type !== 'house' || !b.isBuilt) continue
    if (!b.residents) b.residents = []
    const cap = b.shelter ?? BUILDING_DEFS.house.shelter
    if (b.residents.length < cap) {
      b.residents.push(citizen.id)
      citizen.homeId = b.id
      return
    }
  }
  citizen.homeId = null
}

function shouldGoHome(world) { return getNightProgress(world.tick) > 0.82 }
function shouldWake(world)   { return getNightProgress(world.tick) < 0.12 }

function tryGoHome(citizen, world) {
  if (!shouldGoHome(world)) return false
  if (citizen.homeId == null) return false
  const home = world.buildings.find(b => b.id === citizen.homeId)
  if (!home) return false
  citizen.state   = 'going_home'
  citizen.targetX = home.col
  citizen.targetY = home.row
  return true
}

// ── Task picking ───────────────────────────────────────────────────────────────

function pickResourceTask(world) {
  const food = world.resources.food
  const wood = world.resources.wood
  // Food system disabled — workers chop wood unless surplus is needed
  if (wood < 25) return 'chop'
  return food <= wood ? 'forage' : 'chop'
}

function pickTask(citizen, world) {
  // Only one worker builds at a time to avoid resource race conditions
  const activeBuilder = world.citizens.find(c =>
    c.id !== citizen.id && c.task === 'build' &&
    (c.state === 'going_to_build' || c.state === 'building')
  )
  if (world.buildQueue.length > 0 && !activeBuilder) return 'build'
  return pickResourceTask(world)
}

// ── Build task initiation ──────────────────────────────────────────────────────

function startBuild(citizen, world) {
  if (!world.buildQueue.length) return false

  const item = world.buildQueue[0]
  const cost = item.cost || BUILDING_DEFS[item.type]?.cost || {}

  for (const [res, amt] of Object.entries(cost)) {
    if ((world.resources[res] || 0) < amt) return false  // can't afford yet
  }

  // Deduct cost and remove from queue
  for (const [res, amt] of Object.entries(cost)) {
    world.resources[res] -= amt
  }
  world.buildQueue.shift()

  const id = world.buildings.length
  world.buildings.push({
    id, type: item.type, col: item.col, row: item.row,
    isBuilt: false, buildProgress: 0, workerIds: [], residents: [],
  })

  citizen.buildTarget = { col: item.col, row: item.row, buildingId: id }
  citizen.targetX     = item.col
  citizen.targetY     = item.row
  citizen.state       = 'going_to_build'
  return true
}

// ── Unified worker update ──────────────────────────────────────────────────────

function updateWorker(citizen, world) {
  switch (citizen.state) {

    case 'going_home': {
      const arrived = moveToward(citizen, citizen.targetX, citizen.targetY)
      if (arrived) citizen.state = 'sleeping'
      return
    }

    case 'sleeping': {
      if (shouldWake(world)) { citizen.task = null; citizen.state = 'idle' }
      return
    }

    case 'idle': {
      if (tryGoHome(citizen, world)) return

      citizen.task = pickTask(citizen, world)

      if (citizen.task === 'build') {
        if (startBuild(citizen, world)) return
        // Can't build yet (queue empty or can't afford) — gather instead
        citizen.task = pickResourceTask(world)
      }

      // Gather resource from forest
      const taskDef = TASKS[citizen.task]
      if (!taskDef?.sourceTile) return

      const target = nearestForestTile(world, citizen.x, citizen.y, citizen.id)
      if (!target) {
        // No forest available — swap task
        citizen.task = citizen.task === 'chop' ? 'forage' : 'chop'
        return
      }
      citizen.targetTile = target.key
      citizen.targetX    = target.col
      citizen.targetY    = target.row
      citizen.state      = 'going_to_source'
      break
    }

    case 'going_to_source': {
      const arrived = moveToward(citizen, citizen.targetX, citizen.targetY)
      if (arrived) {
        citizen.workTimer = TASKS[citizen.task]?.workTicks || 100
        citizen.state     = 'working'
      }
      break
    }

    case 'working': {
      citizen.workTimer--
      if (citizen.workTimer <= 0) {
        const taskDef = TASKS[citizen.task]
        if (taskDef?.chops && citizen.targetTile) {
          const tile = world.tiles.get(citizen.targetTile)
          if (tile) { tile.type = 'stump'; tile.decayAt = world.tick + 600 }
          citizen.targetTile = null
        }
        citizen.carrying = { resource: taskDef?.resource, amount: taskDef?.yield || 1 }
        citizen.targetX  = STOCKPILE.x
        citizen.targetY  = STOCKPILE.y
        citizen.state    = 'going_to_storage'
      }
      break
    }

    case 'going_to_storage': {
      const arrived = moveToward(citizen, citizen.targetX, citizen.targetY)
      if (arrived && citizen.carrying) {
        world.resources[citizen.carrying.resource] =
          (world.resources[citizen.carrying.resource] || 0) + citizen.carrying.amount
        citizen.carrying   = null
        citizen.targetTile = null
        citizen.state      = 'idle'
      }
      break
    }

    case 'going_to_build': {
      const arrived = moveToward(citizen, citizen.targetX, citizen.targetY)
      if (arrived) {
        const bt  = citizen.buildTarget
        const bld = bt ? world.buildings[bt.buildingId] : null
        if (!bld) { citizen.task = null; citizen.state = 'idle'; return }
        citizen.workTimer = BUILDING_DEFS[bld.type]?.buildTicks || 200
        citizen.state     = 'building'
      }
      break
    }

    case 'building': {
      citizen.workTimer--
      const bt  = citizen.buildTarget
      const bld = bt ? world.buildings[bt.buildingId] : null
      if (bld) {
        bld.buildProgress = Math.min(100,
          100 - Math.round((citizen.workTimer / (BUILDING_DEFS[bld.type]?.buildTicks || 200)) * 100)
        )
      }

      if (citizen.workTimer <= 0 && bld) {
        bld.isBuilt       = true
        bld.buildProgress = 100

        const def     = BUILDING_DEFS[bld.type]
        const shelter = bld.shelter ?? def?.shelter ?? 0
        if (shelter) {
          world.housingCapacity += shelter
          for (let s = 0; s < shelter; s++) {
            const timer = ARRIVE_MIN_TICKS + Math.floor(Math.random() * (ARRIVE_MAX_TICKS - ARRIVE_MIN_TICKS))
            world.pendingArrivals.push({ timer })
          }
        }
        addEvent(world, `${def?.label || bld.type} completed`)
        world.newBuilding = { col: bld.col, row: bld.row }
        world.bgDirty     = true   // building is now in the bg layer
        revealAround(world, bld.col, bld.row, REVEAL_RADIUS)
        if (bld.type === 'farm') expandFarmland(world, bld)
        layRoadToCenter(world, bld.col, bld.row)

        citizen.buildTarget = null
        citizen.task        = null
        citizen.state       = 'idle'
      }
      break
    }

    default:
      citizen.task  = null
      citizen.state = 'idle'
  }
}

// ── Arriving citizen ───────────────────────────────────────────────────────────

function updateArriving(citizen, world) {
  const arrived = moveToward(citizen, STOCKPILE.x, STOCKPILE.y)
  if (arrived) {
    citizen.state = 'idle'
    addEvent(world, 'A new worker has arrived')
  }
}

// ── Master citizen update ──────────────────────────────────────────────────────

export function updateCitizens(world) {
  for (const c of world.citizens) {
    c.bounce += 0.18
    if (c.state === 'arriving') updateArriving(c, world)
    else updateWorker(c, world)
  }
}

// ── Spawn new citizen from forest edge ────────────────────────────────────────

export function spawnNewCitizen(world) {
  const angle  = Math.random() * Math.PI * 2
  const radius = 10 + Math.random() * 5
  const sx = Math.round(Math.cos(angle) * radius)
  const sy = Math.round(Math.sin(angle) * radius)
  const c = makeCitizen('worker', sx, sy, 'arriving')
  assignHome(c, world)
  world.citizens.push(c)
  return c
}
