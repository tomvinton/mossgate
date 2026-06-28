// ── Mossgate — Needs, Deficits, Unlocks, Build Decisions ─────────────────────

import { UNLOCK_CONDITIONS, BUILDING_DEFS, FOOD_PER_CITIZEN, FOOD_CONSUME_EVERY } from './config.js'
import { hasBuilt, addEvent, key, unkey } from './world.js'

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

// Check whether the world can afford a building's full cost
function canAfford(world, type) {
  const cost = BUILDING_DEFS[type]?.cost || {}
  return Object.entries(cost).every(([res, amt]) => (world.resources[res] || 0) >= amt)
}

// Deduct cost immediately and push to queue. This prevents auto-refuel from
// consuming wood that has been earmarked for construction between queue and build.
function queueBuild(world, type, site, msg) {
  const cost = BUILDING_DEFS[type]?.cost || {}
  for (const [res, amt] of Object.entries(cost)) {
    world.resources[res] = (world.resources[res] || 0) - amt
  }
  world.buildQueue.push({ type, ...site, costPrepaid: true })
  addEvent(world, msg)
}

export function updateBuildQueue(world) {
  // Don't pile up — only queue one thing at a time
  if (world.buildQueue.length > 0) return

  const pop      = world.citizens.length
  const wood     = world.resources.wood
  const headroom = world.housingCapacity - pop

  // Priority 0: Town center — build one first, it's the heart of the settlement
  if (world.unlocks.has('town_center') && !hasBuilt(world, 'town_center') && wood >= BUILDING_DEFS.town_center.cost.wood) {
    const site = findBuildSite(world, 'town_center')
    if (site) { queueBuild(world, 'town_center', site, 'Builder planning a town center'); return }
  }

  // Priority 1: Housing — if population is at or near housing cap
  if (headroom <= 1 && world.unlocks.has('house') && wood >= BUILDING_DEFS.house.cost.wood) {
    const site = findBuildSite(world, 'house')
    if (site) { queueBuild(world, 'house', site, 'Builder planning a house'); return }
  }

  // Priority 2: Farm — if unlocked and none built yet
  if (world.unlocks.has('farm') && !hasBuilt(world, 'farm') && wood >= BUILDING_DEFS.farm.cost.wood) {
    const site = findBuildSite(world, 'farm')
    if (site) { queueBuild(world, 'farm', site, 'Builder planning a farm'); return }
  }

  // Priority 3: Logging camp — if unlocked and none built
  if (world.unlocks.has('logging_camp') && !hasBuilt(world, 'logging_camp') && wood >= BUILDING_DEFS.logging_camp.cost.wood) {
    const site = findBuildSite(world, 'logging_camp')
    if (site) { queueBuild(world, 'logging_camp', site, 'Builder planning a logging camp'); return }
  }

  // Priority 4: Granary
  if (world.unlocks.has('granary') && !hasBuilt(world, 'granary') && wood >= BUILDING_DEFS.granary.cost.wood) {
    const site = findBuildSite(world, 'granary')
    if (site) { queueBuild(world, 'granary', site, 'Builder planning a granary'); return }
  }

  // Priority 4b: Mine (Stage 5+)
  if (world.unlocks.has('mine') && !hasBuilt(world, 'mine') && canAfford(world, 'mine')) {
    const site = findBuildSite(world, 'mine')
    if (site) { queueBuild(world, 'mine', site, 'Builder planning a mine'); return }
  }

  // Priority 4c: Research Hall (after mine discovery)
  if (world.unlocks.has('research_building') && !hasBuilt(world, 'research_building') && canAfford(world, 'research_building')) {
    const site = findBuildSite(world, 'research_building')
    if (site) { queueBuild(world, 'research_building', site, 'Builder planning a research hall'); return }
  }

  // Priority 5: Era 2 processing buildings — sawmill before stonemason
  if (world.unlocks.has('sawmill') && !hasBuilt(world, 'sawmill') && canAfford(world, 'sawmill')) {
    const site = findBuildSite(world, 'sawmill')
    if (site) { queueBuild(world, 'sawmill', site, 'Builder planning a sawmill'); return }
  }

  if (world.unlocks.has('stonemason') && !hasBuilt(world, 'stonemason') && canAfford(world, 'stonemason')) {
    const site = findBuildSite(world, 'stonemason')
    if (site) { queueBuild(world, 'stonemason', site, 'Builder planning a stonemason'); return }
  }

  // Priority 6: Era 2 housing — longhouse (shelters 4, requires planks)
  if (world.era >= 2 && headroom <= 3 && world.unlocks.has('longhouse') && canAfford(world, 'longhouse')) {
    const site = findBuildSite(world, 'longhouse')
    if (site) { queueBuild(world, 'longhouse', site, 'Builder planning a longhouse'); return }
  }

  // Priority 7: Market (Era 2 milestone)
  if (world.unlocks.has('market') && !hasBuilt(world, 'market') && canAfford(world, 'market')) {
    const site = findBuildSite(world, 'market')
    if (site) { queueBuild(world, 'market', site, 'Builder planning a market'); return }
  }

  // Priority 8: Additional Era 1 houses if still needed and not yet era 2
  if (world.era < 2 && headroom <= 2 && world.unlocks.has('house') && wood >= BUILDING_DEFS.house.cost.wood) {
    const site = findBuildSite(world, 'house')
    if (site) { queueBuild(world, 'house', site, 'Builder planning a house'); return }
  }

  // ── Era 3 buildings ────────────────────────────────────────────────────────
  if (world.unlocks.has('forge_building') && !hasBuilt(world, 'forge_building') && canAfford(world, 'forge_building')) {
    const site = findBuildSite(world, 'forge_building')
    if (site) { queueBuild(world, 'forge_building', site, 'Builder planning a forge'); return }
  }

  if (world.era >= 3 && headroom <= 3 && world.unlocks.has('great_hall') && canAfford(world, 'great_hall')) {
    const site = findBuildSite(world, 'great_hall')
    if (site) { queueBuild(world, 'great_hall', site, 'Builder planning a great hall'); return }
  }

  if (world.unlocks.has('watchtower') && !hasBuilt(world, 'watchtower') && canAfford(world, 'watchtower')) {
    const site = findBuildSite(world, 'watchtower')
    if (site) { queueBuild(world, 'watchtower', site, 'Builder planning a watchtower'); return }
  }

  // ── Era 4 buildings ────────────────────────────────────────────────────────
  if (world.unlocks.has('factory') && !hasBuilt(world, 'factory') && canAfford(world, 'factory')) {
    const site = findBuildSite(world, 'factory')
    if (site) { queueBuild(world, 'factory', site, 'Builder planning a factory'); return }
  }

  if (world.era >= 4 && headroom <= 4 && world.unlocks.has('tenement') && canAfford(world, 'tenement')) {
    const site = findBuildSite(world, 'tenement')
    if (site) { queueBuild(world, 'tenement', site, 'Builder planning a tenement'); return }
  }

  if (world.unlocks.has('power_station') && !hasBuilt(world, 'power_station') && canAfford(world, 'power_station')) {
    const site = findBuildSite(world, 'power_station')
    if (site) { queueBuild(world, 'power_station', site, 'Builder planning a power station'); return }
  }

  // ── Era 5 buildings ────────────────────────────────────────────────────────
  if (world.unlocks.has('nuclear_plant') && !hasBuilt(world, 'nuclear_plant') && canAfford(world, 'nuclear_plant')) {
    const site = findBuildSite(world, 'nuclear_plant')
    if (site) { queueBuild(world, 'nuclear_plant', site, 'Builder planning a nuclear plant'); return }
  }

  // ── Era 6 buildings ────────────────────────────────────────────────────────
  if (world.unlocks.has('decontam_center') && !hasBuilt(world, 'decontam_center') && canAfford(world, 'decontam_center')) {
    const site = findBuildSite(world, 'decontam_center')
    if (site) { queueBuild(world, 'decontam_center', site, 'Builder planning a decontamination center'); return }
  }

  if (world.unlocks.has('solar_farm') && canAfford(world, 'solar_farm')) {
    const solarCount = world.buildings.filter(b => b.type === 'solar_farm' && b.isBuilt).length
    if (solarCount < 4) {  // build up to 4 solar farms
      const site = findBuildSite(world, 'solar_farm')
      if (site) { queueBuild(world, 'solar_farm', site, 'Builder planning a solar farm'); return }
    }
  }
}

// ── Find a suitable build site (nearest available grass tile to center) ────────

function findBuildSite(world, type) {
  const occupied = new Set(world.buildings.map(b => key(b.col, b.row)))

  // Prefer tiles adjacent to existing developed area, closer to center
  let best = null, bestScore = Infinity

  for (const [k, t] of world.tiles) {
    if (!world.revealedTiles.has(k)) continue
    if (t.type !== 'grass' && t.type !== 'stump') continue   // water/bridge/farmland excluded
    if (occupied.has(k)) continue

    const [c, r] = unkey(k)

    // Farms prefer open area (farther from center)
    const dist = Math.sqrt(c * c + r * r)
    const score = type === 'farm'
      ? Math.abs(dist - 8)   // farms like to be ~8 tiles from center
      : dist                 // everything else as close to center as possible

    // Houses: require at least 3 tiles of breathing room from any built building
    if (type === 'house') {
      const tooClose = world.buildings.some(b =>
        b.isBuilt && Math.sqrt((b.col - c) ** 2 + (b.row - r) ** 2) < 3
      )
      if (tooClose) continue
    }

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
