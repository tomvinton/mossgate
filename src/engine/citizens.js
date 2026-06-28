// ── Mossgate — Citizen AI (general worker system) ──────────────────────────────
// Phase 1: all citizens are general workers. They pick tasks dynamically
// (forage / chop / build) based on what the settlement needs most.
// Specialised roles (farmer, logger, guard, …) come in a later phase.

import {
  TASKS, BUILDING_DEFS, ARRIVE_MIN_TICKS, ARRIVE_MAX_TICKS, REVEAL_RADIUS,
  LOG_COUNT_PER_TREE, LOG_CARRY_COUNT, CHOP_TICKS_PER_CYCLE, STUMP_DECAY_TICKS,
} from './config.js'
import { key, makeCitizen, addEvent, revealAround, isLit, hasTileType } from './world.js'
import { findPath } from './pathfind.js'

const MOVE_SPEED  = 0.035   // tiles per tick
const STOCKPILE   = { x: 0, y: 0 }
const ARRIVE_DIST = 0.15

// ── Log pile helpers ───────────────────────────────────────────────────────────

function scatterLogs(world, col, row) {
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]
  let remaining = LOG_COUNT_PER_TREE
  for (const [dc, dr] of offsets) {
    if (remaining <= 0) break
    const c = col + dc, r = row + dr
    const tile = world.tiles.get(key(c, r))
    if (tile && tile.type !== 'water' && tile.type !== 'bridge') {
      const count = Math.min(LOG_CARRY_COUNT, remaining)
      world.logPiles.push({ col: c, row: r, count, decayAt: world.tick + 2000 })
      remaining -= count
    }
  }
  if (remaining > 0) world.logPiles.push({ col, row, count: remaining, decayAt: world.tick + 2000 })
}

function findNearestLogPile(world, cx, cy) {
  let best = null, bestDist = Infinity
  for (const p of world.logPiles) {
    if (p.count <= 0) continue
    const d = Math.abs(p.col - cx) + Math.abs(p.row - cy)
    if (d < bestDist) { bestDist = d; best = p }
  }
  return best
}

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

function moveToward(citizen, tx, ty, speed = MOVE_SPEED) {
  const dx = tx - citizen.x
  const dy = ty - citizen.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist <= ARRIVE_DIST) {
    citizen.x = tx
    citizen.y = ty
    return true
  }
  citizen.x += (dx / dist) * speed
  citizen.y += (dy / dist) * speed
  return false
}

// Follow the citizen's precomputed A* path waypoint by waypoint.
// Falls back to direct movement if path is empty (no path found or early game).
function moveAlongPath(citizen, speed = MOVE_SPEED) {
  if (!citizen.path || citizen.pathIdx >= citizen.path.length) {
    return moveToward(citizen, citizen.targetX, citizen.targetY, speed)
  }
  const wp = citizen.path[citizen.pathIdx]
  const arrived = moveToward(citizen, wp.col, wp.row, speed)
  if (arrived) citizen.pathIdx++
  return citizen.pathIdx >= citizen.path.length
}

function computePath(world, fromC, fromR, toC, toR) {
  return findPath(world.tiles, world.buildings, fromC, fromR, toC, toR)
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

// ── Guard behaviour ────────────────────────────────────────────────────────────
// Guards rest near the center during the day; pick a new loiter spot occasionally.

function updateGuard(citizen, world) {
  citizen.task = null
  if (citizen.state === 'guard_rest') {
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

// ── Task picking ───────────────────────────────────────────────────────────────

function pickResourceTask(world) {
  const era = world.heart.era
  const r   = world.resources

  // Era 6: clean up contamination first, then sustain
  if (era >= 6) {
    const hasContam = hasTileType(world, 'contamination')
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
  // Fire crisis — drop everything and chop wood for the fire
  if (world.fireCrisis) return 'chop'

  // Low stability — prioritise survival over construction
  if ((world.stability ?? 100) < 30) return pickResourceTask(world)

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

  if (!item.costPrepaid) {
    // Legacy path: check and deduct cost at build time
    const cost = item.cost || BUILDING_DEFS[item.type]?.cost || {}
    for (const [res, amt] of Object.entries(cost)) {
      if ((world.resources[res] || 0) < amt) return false
    }
    for (const [res, amt] of Object.entries(cost)) world.resources[res] -= amt
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
  citizen.path        = computePath(world, Math.round(citizen.x), Math.round(citizen.y), item.col, item.row)
  citizen.pathIdx     = 0
  citizen.state       = 'going_to_build'
  return true
}

// ── Unified worker update ──────────────────────────────────────────────────────

function updateWorker(citizen, world) {
  // Guards have their own behaviour — skip the normal worker state machine
  if (citizen.role === 'guard') { updateGuard(citizen, world); return }

  // Effective speed: base × seasonal bonus × food-crisis penalty
  const spd = MOVE_SPEED * (world.citizenSpeedBonus ?? 1) * (world.citizenSpeedPenalty ?? 1)

  switch (citizen.state) {

    case 'idle': {
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
      citizen.path       = computePath(world, Math.round(citizen.x), Math.round(citizen.y), target.col, target.row)
      citizen.pathIdx    = 0
      citizen.state      = 'going_to_source'
      break
    }

    case 'going_to_source': {
      const arrived = moveAlongPath(citizen, spd)
      if (arrived) {
        if (citizen.task === 'chop') {
          citizen.chopPhase = 0
          citizen.workTimer = CHOP_TICKS_PER_CYCLE
        } else {
          citizen.workTimer = TASKS[citizen.task]?.workTicks || 100
        }
        citizen.state = 'working'
      }
      break
    }

    case 'working': {
      citizen.workTimer--

      if (citizen.task === 'chop') {
        // 9-cycle chop animation — each cycle flashes the citizen's colour
        if (citizen.workTimer <= 0) {
          citizen.chopPhase++
          if (citizen.chopPhase < LOG_COUNT_PER_TREE) {
            citizen.workTimer = CHOP_TICKS_PER_CYCLE   // next chop cycle
          } else {
            // All 9 chops done — fell the tree
            const tile = world.tiles.get(citizen.targetTile)
            if (tile) {
              tile.type = 'stump'
              tile.decayAt = world.tick + STUMP_DECAY_TICKS
              world.bgDirty = true
            }
            citizen.chopSite   = { col: Math.round(citizen.targetX), row: Math.round(citizen.targetY) }
            citizen.targetTile = null
            citizen.chopPhase  = 0
            scatterLogs(world, citizen.chopSite.col, citizen.chopSite.row)
            citizen.state = 'going_to_logs'
          }
        }
        break
      }

      // All other tasks — original single-trip logic
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
      const arrived = moveToward(citizen, citizen.targetX, citizen.targetY, spd)
      if (arrived && citizen.carrying) {
        // null resource tasks (decontaminate) have no yield to deposit
        if (citizen.carrying.resource) {
          world.resources[citizen.carrying.resource] =
            (world.resources[citizen.carrying.resource] || 0) + citizen.carrying.amount
        }
        citizen.carrying   = null
        citizen.targetTile = null

        // Log collection loop — return for another trip if nearby logs remain
        if (citizen.task === 'chop' && citizen.chopSite) {
          const hasNearbyLogs = world.logPiles.some(p =>
            p.count > 0 &&
            Math.abs(p.col - citizen.chopSite.col) <= 4 &&
            Math.abs(p.row - citizen.chopSite.row) <= 4
          )
          if (hasNearbyLogs) { citizen.state = 'going_to_logs'; break }
          citizen.chopSite = null
        }

        citizen.state = 'idle'
      }
      break
    }

    case 'going_to_logs': {
      const pile = findNearestLogPile(world, citizen.x, citizen.y)
      if (!pile) { citizen.chopSite = null; citizen.task = null; citizen.state = 'idle'; break }

      citizen.targetX = pile.col
      citizen.targetY = pile.row
      const arrived = moveToward(citizen, citizen.targetX, citizen.targetY, spd)
      if (arrived) {
        // Re-check the pile in case another citizen took it while we walked
        const p = world.logPiles.find(lp => lp.col === pile.col && lp.row === pile.row && lp.count > 0)
        if (!p) break  // gone — next tick will pick a different pile

        const take = Math.min(LOG_CARRY_COUNT, p.count)
        p.count -= take
        if (p.count <= 0) world.logPiles = world.logPiles.filter(lp => lp !== p)

        citizen.carrying = { resource: 'wood', amount: take }
        citizen.targetX  = STOCKPILE.x
        citizen.targetY  = STOCKPILE.y
        citizen.state    = 'going_to_storage'
      }
      break
    }

    case 'going_to_build': {
      const arrived = moveAlongPath(citizen, spd)
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
        if (bld.type === 'mine') world._mineBuiltTick = world.tick
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
