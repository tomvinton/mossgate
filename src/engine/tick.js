// ── Mossgate — Master Tick ─────────────────────────────────────────────────────

import { ERA_DEFS, CYCLE_TICKS } from './config.js'
import { updateCitizens, spawnNewCitizen } from './citizens.js'
import { checkUnlocks, updateBuildQueue } from './needs.js'
import { maybeFireEvent } from './events.js'
import { addEvent, hasBuilt, key, awardLegacy } from './world.js'

// ── Helper: check if world has a living (built, not burned) building of type ──
function has(world, type) { return hasBuilt(world, type) && world.buildings.some(b => b.type === type && b.isBuilt && !b.burned) }

// ── Helper: transition to a new era ──────────────────────────────────────────
function transitionEra(world, toEra, starterResources = {}, msg) {
  const def = ERA_DEFS[toEra]
  if (!def) return
  world.heart.era      = toEra
  world.era            = toEra
  world.heart.fuelMax  = def.fuelMax
  world.heart.fuelTank = def.fuelMax
  world.heart.lightRadius = def.lightRadius
  world.collapseTimer  = 0
  for (const [res, amt] of Object.entries(starterResources)) {
    world.resources[res] = Math.max(world.resources[res] || 0, amt)
  }
  addEvent(world, msg)
  world.bgDirty = true
}

export function tick(world) {
  world.tick++

  const era    = world.heart.era
  const eraDef = ERA_DEFS[era]

  // ── Heart fuel — drain + auto-refuel from era's fuel resource ──────────────
  const fuelRes = eraDef.fuelResource
  if (fuelRes) {
    world.heart.fuelTank = Math.max(0, world.heart.fuelTank - eraDef.fuelDrainPerTick)
    if (world.heart.fuelTank < world.heart.fuelMax && (world.resources[fuelRes] || 0) >= 1) {
      const refuel = Math.min(world.heart.fuelMax - world.heart.fuelTank, 0.15, world.resources[fuelRes])
      world.heart.fuelTank     += refuel
      world.resources[fuelRes] -= refuel
    }
  } else {
    // Era 6: solar — fuel tank always full, no drain
    world.heart.fuelTank = world.heart.fuelMax
  }

  const fuelFraction      = world.heart.fuelTank / world.heart.fuelMax
  world.heart.lightRadius = eraDef.lightRadius * Math.max(0.25, fuelFraction)

  // ── Fuel crisis / collapse ─────────────────────────────────────────────────
  if (fuelRes && world.heart.fuelTank <= 0) {
    world.collapseTimer = (world.collapseTimer || 0) + 1
    if (world.collapseTimer === 1) {
      addEvent(world, era === 5
        ? '☢️ CRITICAL: Reactor cooling failure! Core temperature rising!'
        : `⚠️ The ${eraDef.heartType} has gone cold! Supply ${fuelRes} — fast!`)
    } else if (world.collapseTimer === 300) {
      addEvent(world, era === 5
        ? '💥 MELTDOWN IMMINENT. Evacuate!'
        : '💀 The darkness closes in. The settlement is failing...')
    }
    if (world.collapseTimer >= 600) {
      if (era === 5) world.nuclearCollapse = true
      else           world.collapsed = true
    }
    // Near-collapse milestone — fire once per crisis when things get dire
    if (world.collapseTimer === 300 && !world._nearCollapseFired) {
      world._nearCollapseFired = true
    }
  } else {
    if ((world.collapseTimer || 0) > 0) {
      addEvent(world, era === 5
        ? '☢️ Reactor stabilised. Crisis averted.'
        : '🔥 The fire catches again. Crisis averted.')
      // Award resilience legacy if they pulled back from the brink
      if (world._nearCollapseFired) {
        world.legacyCounters.nearCollapses = (world.legacyCounters.nearCollapses || 0) + 1
        if (world.legacyCounters.nearCollapses >= 3) {
          awardLegacy(world, 'legacy_resilience', '🪨 The Cracked Column stands. Three times this light nearly died.')
        }
      }
    }
    world._nearCollapseFired = false
    world.collapseTimer = 0
  }

  // ── Day counter — increments once per full day/night cycle ──────────────────
  if (world.tick > 0 && world.tick % CYCLE_TICKS === 0) {
    world.day = (world.day || 0) + 1
  }

  // ── Famine deaths — sustained food deficit slowly kills citizens ─────────────
  if (world.deficits.food >= 40 && world.tick % 600 === 0 && world.citizens.length > 2) {
    // Prefer non-guard, non-arriving citizens
    const victim = world.citizens.find(c => c.role !== 'guard' && c.state !== 'arriving')
                 || world.citizens[0]
    if (victim) {
      // Tombstone at citizen's current position
      const tombCol = Math.round(victim.x), tombRow = Math.round(victim.y)
      const tombTile = world.tiles.get(key(tombCol, tombRow))
      if (tombTile && tombTile.type !== 'water') {
        tombTile.type = 'tombstone'; tombTile.decayAt = world.tick + 4000; world.bgDirty = true
      }
      // Remove from home building's residents list
      for (const b of world.buildings) {
        if (b.residents) b.residents = b.residents.filter(id => id !== victim.id)
      }
      const idx = world.citizens.findIndex(c => c.id === victim.id)
      if (idx !== -1) world.citizens.splice(idx, 1)
      addEvent(world, '💀 A worker has died of hunger.')
      world.legacyCounters.famineDeaths = (world.legacyCounters.famineDeaths || 0) + 1
      if (world.legacyCounters.famineDeaths >= 3) {
        awardLegacy(world, 'legacy_famine', '🥣 The Empty Bowl was carved. Hunger has taken many here.')
      }
    }
  }

  // ── Guard assignment — one guard per watchtower ───────────────────────────────
  if (era >= 3 && world.tick % 200 === 0) {
    const watchtowerCount = world.buildings.filter(b => b.type === 'watchtower' && b.isBuilt && !b.burned).length
    const guardCount      = world.citizens.filter(c => c.role === 'guard').length
    if (watchtowerCount > guardCount) {
      // Promote an idle worker
      const recruit = world.citizens.find(c => c.role === 'worker' && (c.state === 'idle' || c.state === 'sleeping'))
      if (recruit) {
        recruit.role = 'guard'; recruit.state = 'idle'
        addEvent(world, '⚔️ A citizen has been posted as a guard.')
      }
    } else if (guardCount > watchtowerCount) {
      // Demote a guard if watchtower burned
      const demoted = world.citizens.find(c => c.role === 'guard')
      if (demoted) {
        demoted.role = 'worker'; demoted.state = 'idle'
        addEvent(world, '⚔️ Guard returned to the workforce — watchtower lost.')
      }
    }
  }

  // Update citizens
  updateCitizens(world)

  // ── Tile decay — throttled to every 20 ticks (1 sec at 1×) ───────────────
  // Decay timers are 600–4000 ticks long, so 1-sec resolution is imperceptible.
  // Scanning all tiles every tick is O(N) on a map that can reach 50k+ entries.
  if (world.tick % 20 === 0) {
    for (const [, t] of world.tiles) {
      if (t.decayAt && world.tick >= t.decayAt) {
        t.type = 'grass'; delete t.decayAt; world.bgDirty = true
      }
    }
  }

  // ── Processing buildings (every 150 ticks) ────────────────────────────────
  if (world.tick % 150 === 0) {
    const b = type => world.buildings.some(b => b.type === type && b.isBuilt && !b.burned)

    // Era 2 processing
    if (b('sawmill')    && world.resources.wood     >= 2) { world.resources.wood     -= 2; world.resources.planks    = (world.resources.planks    || 0) + 1 }
    if (b('stonemason') && world.resources.stone    >= 2) { world.resources.stone    -= 2; world.resources.cut_stone = (world.resources.cut_stone || 0) + 1 }

    // Era 3 processing: forge converts iron_ore + coal → iron
    if (b('forge_building') && world.resources.iron_ore >= 2 && world.resources.coal >= 1) {
      world.resources.iron_ore -= 2
      world.resources.coal     -= 1
      world.resources.iron      = (world.resources.iron || 0) + 1
    }

    // Era 4 processing: factory converts iron + coal → steel
    if (b('factory') && world.resources.iron >= 3 && world.resources.coal >= 2) {
      world.resources.iron  -= 3
      world.resources.coal  -= 2
      world.resources.steel  = (world.resources.steel || 0) + 1
    }

    // Era 6: solar farms boost light (already full tank from above), but also
    // slowly reclaim contamination tiles near them
    if (era >= 6 && world.tick % 600 === 0) {
      const solarCount = world.buildings.filter(b => b.type === 'solar_farm' && b.isBuilt && !b.burned).length
      if (solarCount > 0) {
        let cleaned = 0
        for (const [, t] of world.tiles) {
          if (t.type === 'contamination' && cleaned < solarCount) {
            t.type = 'rubble'; t.decayAt = world.tick + 2000; cleaned++; world.bgDirty = true
          }
        }
      }
    }
  }

  // ── Era transitions ───────────────────────────────────────────────────────
  const pop = world.citizens.length
  const r   = world.resources

  // Track peak population — elder legacy at 75 citizens
  if (pop > (world.legacyCounters.peakPop || 0)) {
    world.legacyCounters.peakPop = pop
    if (pop >= 75) {
      awardLegacy(world, 'legacy_elder', '🗿 The Elder Stone rises. Seventy-five souls call this place home.')
    }
  }

  if (era === 1 && pop >= 10  && r.stone  >= 20 && has(world,'town_center') && has(world,'sawmill')) {
    transitionEra(world, 2, { planks: 30 }, '🌅 Era II: Ancient Age. The hearth burns with new purpose.')
  }

  if (era === 2 && pop >= 20  && r.iron   >= 10 && has(world,'forge_building') && r.coal >= 15) {
    transitionEra(world, 3, { coal: 40 }, '⚒️ Era III: Medieval Age. The forge roars to life.')
  }

  if (era === 3 && pop >= 35  && r.steel  >= 15 && has(world,'factory') && r.iron >= 30) {
    transitionEra(world, 4, { coal: 80, steel: 20 }, '🏭 Era IV: Industrial Age. Steam fills the air.')
  }

  if (era === 4 && pop >= 50  && r.steel  >= 40 && has(world,'nuclear_plant') && r.uranium >= 5) {
    transitionEra(world, 5, { uranium: 20 }, '☢️ Era V: Nuclear Age. The reactor comes online.')
  }

  // Era 6 unlocks after nuclear reveal + all contamination cleaned
  if (era < 6 && world.nuclearRevealed && world.tick % 200 === 0) {
    const hasContam = [...world.tiles.values()].some(t => t.type === 'contamination')
    if (!hasContam && has(world, 'decontam_center')) {
      transitionEra(world, 6, {}, '🌞 Era VI: Clean Age. The world breathes again.')
      awardLegacy(world, 'legacy_arc', '🏛️ The Survivor Stone was raised. This civilization endured.')
    }
  }

  // Random world events
  maybeFireEvent(world)

  // Unlocks + build queue
  checkUnlocks(world)
  updateBuildQueue(world)

  // Pending arrivals
  for (const a of world.pendingArrivals) a.timer--
  const ready = world.pendingArrivals.filter(a => a.timer <= 0)
  world.pendingArrivals = world.pendingArrivals.filter(a => a.timer > 0)
  for (const _ of ready) spawnNewCitizen(world)
}
