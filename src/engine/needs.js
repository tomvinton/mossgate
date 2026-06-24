// ── Mossgate — Needs, Deficits, Unlocks, Build Decisions ─────────────────────

import { UNLOCK_CONDITIONS, BUILDING_DEFS, FOOD_PER_CITIZEN, FOOD_CONSUME_EVERY } from './config.js'
import { hasBuilt, addEvent, key, unkey, getHouseCost } from './world.js'

// ── Food consumption ───────────────────────────────────────────────────────────

export function consumeFood(world) {
  const consumed = world.citizens.length * FOOD_PER_CITIZEN
  if (world.resources.food >= consumed) {
    world.resources.food -= consumed
    // Deficit decays when food is plentiful
    if (world.deficits.food > 0) world.deficits.food = Math.max(0, world.deficits.food - 2)
  } else {
    world.resources.food = 0
    world.deficits.food  = (world.deficits.food || 0) + 5
  }
}

// ── Check and fire unlock conditions ──────────────────────────────────────────

export function checkUnlocks(world) {
  for (const [buildingType, condition] of Object.entries(UNLOCK_CONDITIONS)) {
    if (!world.unlocks.has(buildingType) && condition(world)) {
      world.unlocks.add(buildingType)
      addEvent(world, `${BUILDING_DEFS[buildingType]?.label || buildingType} is now possible`)
    }
  }
}

// ── Build queue management — builder auto-decides what to build ───────────────

export function updateBuildQueue(world) {
  // Don't pile up — only queue one thing at a time
  if (world.buildQueue.length > 0) return

  const pop     = world.citizens.length
  const wood    = world.resources.wood
  const headroom = world.housingCapacity - pop

  // Priority 0: Town center — build one first, it's the heart of the settlement
  if (world.unlocks.has('town_center') && !hasBuilt(world, 'town_center') && wood >= BUILDING_DEFS.town_center.cost.wood) {
    const site = findBuildSite(world, 'town_center')
    if (site) {
      world.buildQueue.push({ type: 'town_center', ...site })
      addEvent(world, 'Builder planning a town center')
      return
    }
  }

  // Priority 1: Housing — if population is at or near housing cap
  const houseCost = getHouseCost(world)
  if (headroom <= 1 && world.unlocks.has('house') && wood >= houseCost) {
    const site = findBuildSite(world, 'house')
    if (site) {
      world.buildQueue.push({ type: 'house', ...site, cost: { wood: houseCost } })
      addEvent(world, `Builder planning a house (${houseCost} wood)`)
      return
    }
  }

  // Priority 2: Farm — if unlocked and none built yet
  if (world.unlocks.has('farm') && !hasBuilt(world, 'farm') && wood >= BUILDING_DEFS.farm.cost.wood) {
    const site = findBuildSite(world, 'farm')
    if (site) {
      world.buildQueue.push({ type: 'farm', ...site })
      addEvent(world, 'Builder planning a farm')
      return
    }
  }

  // Priority 3: Logging camp — if unlocked and none built
  if (world.unlocks.has('logging_camp') && !hasBuilt(world, 'logging_camp') && wood >= BUILDING_DEFS.logging_camp.cost.wood) {
    const site = findBuildSite(world, 'logging_camp')
    if (site) {
      world.buildQueue.push({ type: 'logging_camp', ...site })
      addEvent(world, 'Builder planning a logging camp')
      return
    }
  }

  // Priority 4: Granary
  if (world.unlocks.has('granary') && !hasBuilt(world, 'granary') && wood >= BUILDING_DEFS.granary.cost.wood) {
    const site = findBuildSite(world, 'granary')
    if (site) {
      world.buildQueue.push({ type: 'granary', ...site })
      addEvent(world, 'Builder planning a granary')
      return
    }
  }

  // Priority 5: Additional houses if growing
  const houseCost2 = getHouseCost(world)
  if (headroom <= 2 && world.unlocks.has('house') && wood >= houseCost2) {
    const site = findBuildSite(world, 'house')
    if (site) {
      world.buildQueue.push({ type: 'house', ...site, cost: { wood: houseCost2 } })
      addEvent(world, `Builder planning a house (${houseCost2} wood)`)
    }
  }
}

// ── Find a suitable build site (nearest available grass tile to center) ────────

function findBuildSite(world, type) {
  const occupied = new Set(world.buildings.map(b => key(b.col, b.row)))

  // Prefer tiles adjacent to existing developed area, closer to center
  let best = null, bestScore = Infinity

  for (const [k, t] of world.tiles) {
    if (t.type !== 'grass' && t.type !== 'stump') continue
    if (occupied.has(k)) continue

    const [c, r] = unkey(k)

    // Farms prefer open area (farther from center)
    const dist = Math.sqrt(c * c + r * r)
    const score = type === 'farm'
      ? Math.abs(dist - 8)   // farms like to be ~8 tiles from center
      : dist                 // everything else as close to center as possible

    // Must have at least one grass neighbor (adjacent to developed area)
    const hasGrassNeighbor = [
      [c+1,r],[c-1,r],[c,r+1],[c,r-1]
    ].some(([nc,nr]) => {
      const t2 = world.tiles.get(key(nc,nr))
      return t2 && t2.type === 'grass'
    })

    if (!hasGrassNeighbor && dist > 4) continue
    if (score < bestScore) { bestScore = score; best = { col: c, row: r } }
  }

  return best
}
