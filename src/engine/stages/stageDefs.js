// ── Mossgate — Stage Definitions ───────────────────────────────────────────────

import { addEvent } from '../world.js'

// ── Module-level helpers ───────────────────────────────────────────────────────

const DIRECTIONS = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest']

function _fireScoutReport(world) {
  const farmCount = world.scoutReports.filter(r => r.type === 'farmland').length
  const nbrCount  = world.scoutReports.filter(r => r.type === 'neighbor').length
  const rng = Math.random()
  let type
  if (farmCount < 3 && rng < 0.55)     type = 'farmland'
  else if (nbrCount < 1 && rng < 0.80) type = 'neighbor'
  else                                  type = 'terrain'
  const dir  = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]
  const desc = {
    farmland: `Scout finds fertile land to the ${dir}.`,
    neighbor: `Scout spotted a neighboring group to the ${dir}.`,
    terrain:  `Scout notes rugged terrain to the ${dir}.`,
  }[type]
  world.scoutReports.push({ type, direction: dir, description: desc, tick: world.tick })
  addEvent(world, `Scout: ${desc}`)
}

function _findDirectionalSite(world, direction) {
  const passes = {
    north:     (c, r) => r < -8,
    south:     (c, r) => r > 8,
    east:      (c, r) => c > 8,
    west:      (c, r) => c < -8,
    northeast: (c, r) => c > 6 && r < -6,
    northwest: (c, r) => c < -6 && r < -6,
    southeast: (c, r) => c > 6 && r > 6,
    southwest: (c, r) => c < -6 && r > 6,
  }
  const ok       = passes[direction] || (() => true)
  const occupied = new Set(world.buildings.map(b => `${b.col},${b.row}`))
  let best = null, bestD = Infinity
  for (const [k, t] of world.tiles) {
    if (t.type !== 'grass' && t.type !== 'stump') continue
    if (occupied.has(k)) continue
    const [c, r] = k.split(',').map(Number)
    if (!ok(c, r)) continue
    const d = Math.sqrt(c * c + r * r)
    if (d < 10 || d > 20) continue
    if (d < bestD) { bestD = d; best = { col: c, row: r } }
  }
  return best
}

const FORESHADOW_HINTS = {
  flood:        [
    'The river runs unusually high.',
    'Downstream reports of swelling waters.',
    'Fish move to shallower pools — an ill sign.',
  ],
  harsh_winter: [
    'An old farmer predicts the worst winter in memory.',
    'Birds fly south weeks early.',
    'Night chills arrive earlier each day.',
  ],
  raiders:      [
    'Distant smoke signals at the horizon.',
    'A wanderer warns of hostile groups nearby.',
    'Livestock disappearing at the settlement edges.',
  ],
}

function _maybeFireForeshadow(world, tick) {
  if ((world._foreshadowCount || 0) >= 3) return
  if (tick % 2000 !== 0) return
  const hints = FORESHADOW_HINTS[world.challengeType] || []
  const idx   = world._foreshadowCount || 0
  if (hints[idx]) {
    addEvent(world, hints[idx])
    world._foreshadowCount = idx + 1
  }
}

function _spawnRaiders(world) {
  const targets = world.buildings.filter(b => b.isBuilt && !b.burned && b.type !== 'town_center').slice(0, 3)
  world.raiders = targets.map((b, i) => {
    const angle = (i / targets.length) * Math.PI * 2
    return {
      x: Math.round(Math.cos(angle) * 16),
      y: Math.round(Math.sin(angle) * 16),
      targetBuilding: b.id,
      timer: 0,
      arrived: false,
      bounce: Math.random() * Math.PI * 2,
    }
  })
}

function _tickRaiders(world) {
  for (const rd of world.raiders) {
    rd.bounce = (rd.bounce || 0) + 0.18
    if (rd.arrived) {
      if (++rd.timer >= 300) {
        const b = world.buildings[rd.targetBuilding]
        if (b && b.isBuilt) {
          b.isBuilt = false; b.burned = true; world.bgDirty = true
          addEvent(world, `Raiders burned the ${b.type}!`)
        }
      }
    } else {
      const b = world.buildings[rd.targetBuilding]
      if (!b || b.burned) { rd.arrived = true; continue }
      const dx = b.col - rd.x, dy = b.row - rd.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.3) { rd.arrived = true; rd.timer = 0 }
      else { rd.x += (dx / dist) * 0.02; rd.y += (dy / dist) * 0.02 }
    }
  }
  world.raiders = world.raiders.filter(r => r.timer < 300)
}

function _resolveChallengeScore(world) {
  if (!world._challengeStartTick) world._challengeStartTick = world.tick
  if (world.tick - world._challengeStartTick < 3000) return
  const pop    = world.citizens.length
  const burned = world.buildings.filter(b => b.burned).length
  let score = 100
  if (burned > 0)                           score -= Math.min(40, burned * 15)
  if ((world.resources.food || 0) < pop * 5) score -= 20
  if ((world.resources.wood || 0) < 10)      score -= 10
  if (pop < 6)                               score -= 20
  world.challengeScore = Math.max(0, score)

  if (world.challengeScore >= 70) {
    addEvent(world, `The reckoning is overcome. Score: ${world.challengeScore}/100. A trophy is placed.`)
    world.buildQueue.push({ type: 'trophy', col: 3, row: 0, costPrepaid: true })
  } else if (world.challengeScore >= 40) {
    addEvent(world, `The settlement survives, barely. Score: ${world.challengeScore}/100.`)
  } else {
    addEvent(world, `The settlement was overwhelmed. Score: ${world.challengeScore}/100.`)
    world.resources.food  = Math.floor((world.resources.food  || 0) * 0.7)
    world.resources.wood  = Math.floor((world.resources.wood  || 0) * 0.7)
    world.resources.stone = Math.floor((world.resources.stone || 0) * 0.7)
  }
  world.challengeResolved = true
  world._challengeActive  = false
}

// ── Stage definitions ──────────────────────────────────────────────────────────

export const STAGE_DEFS = [

  // ── Stage 0: Dawn of the Settlement ──────────────────────────────────────────
  {
    id: 0,
    name: 'Dawn of the Settlement',
    enterConditions: () => true,
    exitConditions:  (world) => world.buildings.some(b => b.type === 'house' && b.isBuilt),
    activeMechanics: ['woodFuel', 'treeChopping'],

    onEnter(world) {
      world.unlocks = new Set(['house'])
      world.buildQueue = world.buildQueue.filter(b => b.type === 'house')
    },

    onTick(_world, _tick) {},
  },

  // ── Stage 1: First Shelter ────────────────────────────────────────────────────
  {
    id: 1,
    name: 'First Shelter',
    enterConditions: (world) => world.buildings.some(b => b.type === 'house' && b.isBuilt),
    exitConditions:  (world) =>
      world.buildings.some(b => b.type === 'farm' && b.isBuilt) &&
      world.citizens.length >= 2,
    activeMechanics: ['woodFuel', 'treeChopping', 'farming'],

    onEnter(world) {
      world.unlocks.add('farm')
      world.unlocks.add('town_center')
      addEvent(world, 'A new arrival is expected. Plant a farm to feed them.')
    },

    onTick(_world, _tick) {},
  },

  // ── Stage 2: Scout Expeditions ────────────────────────────────────────────────
  {
    id: 2,
    name: 'Scout Expeditions',
    enterConditions: (world) =>
      world.buildings.some(b => b.type === 'farm' && b.isBuilt) &&
      world.citizens.length >= 2,
    exitConditions: (world) =>
      (world.scoutReports || []).filter(r => r.type === 'farmland').length >= 3 &&
      (world.scoutReports || []).some(r => r.type === 'neighbor'),
    activeMechanics: ['woodFuel', 'treeChopping', 'farming', 'scouting'],

    onEnter(world) {
      world.scout = { active: true, reportTimer: 0 }
      world.scoutReports = []
      addEvent(world, 'A scout ventures into the unknown forest.')
    },

    onTick(world, _tick) {
      if (!world.scout?.active) return
      world.scout.reportTimer = (world.scout.reportTimer || 0) + 1
      if (world.scout.reportTimer >= 400) {
        world.scout.reportTimer = 0
        _fireScoutReport(world)
      }
    },
  },

  // ── Stage 3: Expansion ────────────────────────────────────────────────────────
  {
    id: 3,
    name: 'Expansion',
    enterConditions: (_world) => false,
    exitConditions: (world) =>
      world.buildings.filter(b => b.type === 'farm' && b.isBuilt).length >= 3 &&
      world.citizens.length >= 8,
    activeMechanics: ['woodFuel', 'farming', 'roads', 'diplomacy'],

    onEnter(world) {
      addEvent(world, 'Expansion begins! A caravan approaches from the neighbor settlement.')
      world.culture.clothingPattern = ['stripes', 'patches', 'plain'][Math.floor(world.seed % 3)]

      // Queue 3 farms at directional sites found by scouts
      const farmReports = (world.scoutReports || []).filter(r => r.type === 'farmland').slice(0, 3)
      for (const report of farmReports) {
        const site = _findDirectionalSite(world, report.direction)
        if (site) {
          world.resources.wood = (world.resources.wood || 0) + 20
          world.buildQueue.push({ type: 'farm', ...site, costPrepaid: false })
        }
      }

      // Spawn caravan from edge
      const angle = Math.random() * Math.PI * 2
      world.caravan = {
        x: Math.round(Math.cos(angle) * 14),
        y: Math.round(Math.sin(angle) * 14),
        state: 'arriving', timer: 0,
        bounce: Math.random() * Math.PI * 2,
        _angle: angle,
      }
    },

    onTick(_world, _tick) {},
  },

  // ── Stage 4: Second Wave ──────────────────────────────────────────────────────
  {
    id: 4,
    name: 'Second Wave',
    enterConditions: (_world) => false,
    exitConditions: (world) =>
      world.housingCapacity >= world.citizens.length &&
      (world._equilibriumTicks || 0) >= 300 &&
      world.season === 'fall',
    activeMechanics: ['farming', 'roads', 'population'],

    onEnter(world) {
      world.winterWarning = true
      const pop = world.citizens.length
      world.winterRequirement = { food: pop * 15, wood: pop * 8 }
      world.pendingArrivals.push({ timer: 400 }, { timer: 800 }, { timer: 1200 })
      addEvent(world, 'New arrivals bring word: a bitter winter approaches.')
    },

    onTick(_world, _tick) {},
  },

  // ── Stage 5: Stone Construction ───────────────────────────────────────────────
  {
    id: 5,
    name: 'Stone Construction',
    enterConditions: (_world) => false,
    exitConditions: (world) => {
      const houses = world.buildings.filter(b => b.type === 'house' && b.isBuilt && !b.burned)
      return houses.length > 0 &&
        houses.every(b => b.hasChimney) &&
        world.buildings.some(b => b.type === 'mine' && b.isBuilt) &&
        world.buildings.some(b => b.type === 'research_building' && b.isBuilt) &&
        world.season === 'winter'
    },
    activeMechanics: ['mining', 'stoneBuilding'],

    onEnter(world) {
      world.unlocks.add('mine')
      addEvent(world, 'Fall arrives. The quarry opens — stone construction begins.')
    },

    onTick(world, tick) {
      // Auto-upgrade houses with chimneys
      if (tick % 100 === 0 && (world.resources.stone || 0) >= 8) {
        const h = world.buildings.find(b =>
          b.type === 'house' && b.isBuilt && !b.burned && !b.hasChimney
        )
        if (h) {
          h.hasChimney = true
          world.resources.stone -= 8
          world.bgDirty = true
          addEvent(world, 'A chimney was added to a house.')
        }
      }
      _maybeFireForeshadow(world, tick)
    },
  },

  // ── Stage 6: Winter ───────────────────────────────────────────────────────────
  {
    id: 6,
    name: 'Winter',
    enterConditions: (_world) => false,
    exitConditions: (world) =>
      world.season === 'spring' && (world.researchPoints || 0) >= 100,
    activeMechanics: ['woodFuel', 'storedFood', 'research'],

    onEnter(world) {
      world.farmsDormant = true
      world.researchPoints = 0
      addEvent(world, 'Winter falls. Farms lie dormant. The research hall hums with activity.')
    },

    onTick(world, _tick) {
      world.citizenSpeedPenalty = (world.resources.food || 0) <= 0 ? 0.25 : 1.0
      _maybeFireForeshadow(world, world.tick)
    },
  },

  // ── Stage 7: Spring Restart ───────────────────────────────────────────────────
  {
    id: 7,
    name: 'Spring Restart',
    enterConditions: (_world) => false,
    exitConditions: (world) => (world._wintersCompleted || 0) >= 3,
    activeMechanics: ['farming', 'seasonal'],

    onEnter(world) {
      world.farmsDormant = false
      world._wintersCompleted = (world._wintersCompleted || 0) + 1
      addEvent(world, 'Spring returns. The seasonal cycle is now established.')
    },

    onTick(world, tick) {
      const s  = world.season
      const st = world.seasonTick || 0
      if (s === 'spring') {
        world.farmsDormant = false
        world.farmProductivityBonus = st < 100 ? 1.5 : 1.0
        world.citizenSpeedBonus = 1.0
      } else if (s === 'summer') {
        world.farmsDormant = false
        world.farmProductivityBonus = 1.0
        world.citizenSpeedBonus = 1.1
      } else if (s === 'fall') {
        world.farmsDormant = false
        world.farmProductivityBonus = st < 200 ? 2.0 : 1.0
        world.citizenSpeedBonus = 1.0
      } else if (s === 'winter') {
        world.farmsDormant = true
        world.farmProductivityBonus = 1.0
        world.citizenSpeedBonus = 1.0
        if (st === 1) {
          world._wintersCompleted = (world._wintersCompleted || 0) + 1
          addEvent(world, `Winter ${world._wintersCompleted}. Year ${world.year || 1}.`)
        }
      }
      _maybeFireForeshadow(world, tick)
    },
  },

  // ── Stage 8: The Reckoning ────────────────────────────────────────────────────
  {
    id: 8,
    name: 'The Reckoning',
    enterConditions: (_world) => false,
    exitConditions: (world) => world.challengeResolved === true,
    activeMechanics: ['crisis', 'legacy'],

    onEnter(world) {
      world._challengeActive = true
      if (!world.challengeType) {
        world.challengeType = ['flood', 'harsh_winter', 'raiders'][Math.floor(world.seed % 3)]
      }
      const msgs = {
        flood:        'The rivers swell. Floods threaten the settlement.',
        harsh_winter: 'An unseasonable cold — supplies may not last.',
        raiders:      'Raiders spotted at the forest edge.',
      }
      addEvent(world, `Reckoning: ${msgs[world.challengeType]}`)
      if (world.challengeType === 'raiders') _spawnRaiders(world)
    },

    onTick(world, tick) {
      if (!world._challengeActive || world.challengeResolved) return
      if (!world._challengeStartTick) world._challengeStartTick = tick

      if (world.challengeType === 'harsh_winter' && tick % 400 === 0) {
        world.resources.food = Math.max(0, (world.resources.food || 0) - world.citizens.length * 2)
      }

      if (world.challengeType === 'raiders') _tickRaiders(world)

      if (world.challengeType === 'flood' && tick % 200 === 0) {
        // Spread one water tile per 200 ticks from existing water edges
        for (const [k, t] of world.tiles) {
          if (t.type !== 'water') continue
          const [c, r] = k.split(',').map(Number)
          for (const [nc, nr] of [[c+1,r],[c-1,r],[c,r+1],[c,r-1]]) {
            const nk = `${nc},${nr}`
            const nt = world.tiles.get(nk)
            if (nt && (nt.type === 'grass' || nt.type === 'farmland')) {
              nt.type = 'water'; world.bgDirty = true
              const b = world.buildings.find(b =>
                b.col === nc && b.row === nr && b.isBuilt && !b.floodDamaged
              )
              if (b) { b.floodDamaged = true; addEvent(world, `${b.type} flooded.`) }
              break
            }
          }
          break
        }
      }

      _resolveChallengeScore(world)
    },
  },

  // ── Stage 9: Endless ─────────────────────────────────────────────────────────
  {
    id: 9,
    name: 'Endless',
    enterConditions: (_world) => false,
    exitConditions:  (_world) => false,
    activeMechanics: ['all'],

    onEnter(world) {
      world.endgame = true
      world.ngPlusUnlocked = true
      world.secretModeUnlocked = (world.challengeScore || 0) >= 70
      if ((world.challengeScore || 0) >= 70) {
        world.farmProductivityBonus = (world.farmProductivityBonus || 1) + 0.1
      }
      addEvent(world, world.secretModeUnlocked
        ? 'The settlement endures triumphant. Legends will be told.'
        : 'The settlement endures. The story continues.')
    },

    onTick(_world, _tick) {},
  },
]
