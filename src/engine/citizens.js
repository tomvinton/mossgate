// ── Mossgate — Citizen AI (general worker system) ──────────────────────────────
// Phase 1: all citizens are general workers. They pick tasks dynamically
// (forage / chop / build) based on what the settlement needs most.
// Specialised roles (farmer, logger, guard, …) come in a later phase.

import { TASKS, BUILDING_DEFS, ARRIVE_MIN_TICKS, ARRIVE_MAX_TICKS, REVEAL_RADIUS } from './config.js'
import { key, makeCitizen, addEvent, revealAround, isLit } from './world.js'
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
      if (tile.type === 'grass' || tile.type === 'stump') {  // never overwrite water/bridge
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

function paveRoadTile(world, c, r) {
  const tile = world.tiles.get(key(c, r))
  if (!tile) return false
  // Water becomes a bridge; everything else becomes path
  if (tile.type !== 'path' && tile.type !== 'bridge') {
    tile.type = tile.type === 'water' ? 'bridge' : 'path'
    delete tile.decayAt
    return true
  }
  return false
}

function layRoadToCenter(world, fromCol, fromRow) {
  let c = fromCol, r = fromRow
  let changed = false
  const maxSteps = Math.abs(c) + Math.abs(r) + 2
  for (let i = 0; i < maxSteps; i++) {
    if (c === 0 && r === 0) break
    const dc = c > 0 ? -1 : c < 0 ? 1 : 0
    const dr = r > 0 ? -1 : r < 0 ? 1 : 0
    c += dc; r += dr
    if (paveRoadTile(world, c, r)) changed = true
    revealAround(world, c, r, 3)
  }
  if (changed) world.bgDirty = true
}

// Connect a newly built building to the nearest existing built building
function layRoadToNearest(world, fromCol, fromRow) {
  let best = null, bestDist = Infinity
  for (const b of world.buildings) {
    if (!b.isBuilt) continue
    if (b.col === fromCol && b.row === fromRow) continue
    const d = Math.abs(b.col - fromCol) + Math.abs(b.row - fromRow)
    if (d < bestDist) { bestDist = d; best = b }
  }
  if (!best || bestDist > 25) return   // skip if too far / isolated

  let c = fromCol, r = fromRow
  let changed = false
  const maxSteps = bestDist + 2
  for (let i = 0; i < maxSteps; i++) {
    if (c === best.col && r === best.row) break
    const dc = c > best.col ? -1 : c < best.col ? 1 : 0
    const dr = r > best.row ? -1 : r < best.row ? 1 : 0
    c += dc; r += dr
    if (paveRoadTile(world, c, r)) changed = true
    revealAround(world, c, r, 2)
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

// Mining/decontamination tiles exist beyond the light radius — allow workers to
// venture out to them. For gathering/farming tasks, enforce light radius safety.
const LIGHT_REQUIRED_TASKS = new Set(['forage', 'chop', 'build'])

function nearestSourceTile(world, cx, cy, excludeId, tileType, task = '') {
  const claimed = claimedTiles(world, excludeId)
  const needsLight = LIGHT_REQUIRED_TASKS.has(task)
  let best = null, bestDist = Infinity
  for (const [k, t] of world.tiles) {
    if (!world.revealedTiles.has(k)) continue
    if (t.type !== tileType) continue
    if (claimed.has(k)) continue
    const [c, r] = k.split(',').map(Number)
    if (needsLight && !isLit(world, c, r)) continue
    const d = Math.abs(c - cx) + Math.abs(r - cy)
    if (d < bestDist) { bestDist = d; best = { col: c, row: r, key: k } }
  }
  return best
}

// ── Home assignment ────────────────────────────────────────────────────────────

export function assignHome(citizen, world) {
  for (const b of world.buildings) {
    if (b.type !== 'house' || !b.isBuilt || b.burned) continue
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
  const home = world.buildings.find(b => b.id === citizen.homeId && b.isBuilt && !b.burned)
  if (!home) {
    citizen.homeId = null   // home was burned down — clear reference
    return false
  }
  citizen.state   = 'going_home'
  citizen.targetX = home.col
  citizen.targetY = home.row
  return true
}

// ── Guard behaviour ────────────────────────────────────────────────────────────
// Guards skip the normal worker loop. At night they patrol the lit perimeter;
// during the day they rest near the center.

function updateGuard(citizen, world) {
  const night = getNightProgress(world.tick)

  if (night > 0.3) {
    // Night / dusk — patrol points on the light radius perimeter
    const atTarget = Math.hypot(citizen.x - citizen.targetX, citizen.y - citizen.targetY) < ARRIVE_DIST
    if (citizen.state !== 'guard_patrol' || atTarget) {
      const angle = Math.random() * Math.PI * 2
      const r = Math.max(3, world.heart.lightRadius * 0.80)
      citizen.targetX = Math.cos(angle) * r
      citizen.targetY = Math.sin(angle) * r
      citizen.state   = 'guard_patrol'
    }
    moveToward(citizen, citizen.targetX, citizen.targetY)
    citizen.task    = 'guard'
    citizen.carrying = null
  } else {
    // Day — rest near center; pick a new loiter spot occasionally
    citizen.task = null
    if (citizen.state === 'guard_patrol') {
      // Just came off night patrol — pick a daytime loiter spot
      citizen.targetX = (Math.random() - 0.5) * 4
      citizen.targetY = (Math.random() - 0.5) * 4
      citizen.state   = 'guard_rest'
    } else if (citizen.state === 'guard_rest') {
      const arrived = moveToward(citizen, citizen.targetX, citizen.targetY)
      if (arrived && Math.random() < 0.004) {
        citizen.targetX = (Math.random() - 0.5) * 5
        citizen.targetY = (Math.random() - 0.5) * 5
      }
    } else {
      citizen.state   = 'guard_rest'
      citizen.targetX = 0; citizen.targetY = 0
    }
  }
}

// ── Task picking ───────────────────────────────────────────────────────────────

function pickResourceTask(world) {
  const era = world.heart.era
  const r   = world.resources

  // Era 6: clean up contamination first, then sustain
  if (era >= 6) {
    const hasContam = [...world.tiles.values()].some(t => t.type === 'contamination')
    if (hasContam) return 'decontaminate'
    return r.food < 30 ? 'forage' : 'chop'
  }

  // Era 5: uranium is the priority
  if (era >= 5) {
    if (r.uranium < 15) return 'mine_uranium'
    if (r.food    < 40) return 'forage'
    if (r.coal    < 60) return 'mine_coal'
    return 'mine_uranium'
  }

  // Era 4: coal and iron dominate
  if (era >= 4) {
    if (r.food     < 30) return 'forage'
    if (r.coal     < 60) return 'mine_coal'
    if (r.iron_ore < 40) return 'mine_iron'
    if (r.wood     < 20) return 'chop'
    return 'mine_coal'
  }

  // Era 3: coal and iron ore needed, food still matters
  if (era >= 3) {
    if (r.food     < 20) return 'forage'
    if (r.coal     < 30) return 'mine_coal'
    if (r.iron_ore < 20) return 'mine_iron'
    if (r.wood     < 20) return 'chop'
    if (r.stone    < 30) return 'quarry'
    return 'mine_coal'
  }

  // Era 2: same as era 1 but more relaxed thresholds
  if (era >= 2) {
    if (r.wood  < 30) return 'chop'
    if (r.food  < 12) return 'forage'
    if (r.stone < 50) return 'quarry'
    return r.food <= r.wood ? 'forage' : 'chop'
  }

  // Era 1: core loop
  if (r.wood  < 25) return 'chop'
  if (r.food  < 10) return 'forage'
  if (r.stone < 40) return 'quarry'
  return r.food <= r.wood ? 'forage' : 'chop'
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
  // Guards have their own behaviour — skip the normal worker state machine
  if (citizen.role === 'guard') { updateGuard(citizen, world); return }

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

      // Gather resource from nearest matching source tile
      const taskDef = TASKS[citizen.task]
      if (!taskDef?.sourceTile) return

      const target = nearestSourceTile(world, citizen.x, citizen.y, citizen.id, taskDef.sourceTile, citizen.task)
      if (!target) {
        // No suitable tile — fall back to a different task
        const miningTasks = ['quarry', 'mine_coal', 'mine_iron', 'mine_uranium']
        if (miningTasks.includes(citizen.task)) citizen.task = 'chop'
        else if (citizen.task === 'decontaminate') citizen.task = 'forage'
        else citizen.task = citizen.task === 'chop' ? 'forage' : 'chop'
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
          if (tile) {
            tile.type = taskDef.resultTile || 'grass'
            if (taskDef.decayAfter) tile.decayAt = world.tick + taskDef.decayAfter
            else delete tile.decayAt
          }
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
        // null resource tasks (decontaminate) have no yield to deposit
        if (citizen.carrying.resource) {
          world.resources[citizen.carrying.resource] =
            (world.resources[citizen.carrying.resource] || 0) + citizen.carrying.amount
        }
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
        layRoadToNearest(world, bld.col, bld.row)

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
