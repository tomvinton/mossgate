// ── Mossgate — Random Events ───────────────────────────────────────────────────
// Events fire periodically to keep the city lively and put pressure on resources.
// Each event has a weight (relative probability), a display label, and an apply()
// function that mutates the world in-place.

import { addEvent, key, awardLegacy } from './world.js'
import { BUILDING_DEFS } from './config.js'

// ── Weighted random pick ───────────────────────────────────────────────────────

function weightedPick(pool) {
  const total = pool.reduce((s, e) => s + e.weight, 0)
  let r = Math.random() * total
  for (const ev of pool) {
    r -= ev.weight
    if (r <= 0) return ev
  }
  return pool[pool.length - 1]
}

// ── Era 1 event pool ───────────────────────────────────────────────────────────

const ERA1_EVENTS = [
  // ── Good events ─────────────────────────────────────────────────────────────
  {
    id: 'rich_harvest',
    weight: 28,
    label: '🌾 A rich harvest season — food stores swell.',
    apply(world) {
      world.resources.food = Math.min(world.resources.food + 20, 120)
    },
  },
  {
    id: 'windfall',
    weight: 22,
    label: '🪵 A storm fells trees across the forest — easy timber.',
    apply(world) {
      world.resources.wood = Math.min(world.resources.wood + 24, 120)
    },
  },
  {
    id: 'traveler',
    weight: 15,
    label: '🧳 A wandering family seeks shelter. They bring supplies.',
    apply(world) {
      world.resources.food = Math.min(world.resources.food + 10, 120)
      world.resources.wood = Math.min(world.resources.wood + 8,  120)
      // One extra arrival, sooner than normal
      world.pendingArrivals.push({ timer: 150 + Math.floor(Math.random() * 200) })
    },
  },
  {
    id: 'surface_stone',
    weight: 12,
    label: '🪨 Heavy rains expose fresh rock near the village.',
    apply(world) {
      // Sprinkle 3 rock tiles near the lit zone perimeter
      let added = 0
      for (const [k, t] of world.tiles) {
        if (added >= 3) break
        if (t.type === 'grass' || t.type === 'stump') {
          const [c, r] = k.split(',').map(Number)
          const d = Math.sqrt(c * c + r * r)
          if (d > 5 && d < world.heart.lightRadius - 1) {
            t.type = 'rock'
            added++
            world.bgDirty = true
          }
        }
      }
    },
  },

  // ── Neutral events ───────────────────────────────────────────────────────────
  {
    id: 'forest_regrowth',
    weight: 10,
    label: '🌱 A section of forest has grown back thick.',
    apply(world) {
      // Convert a few stumps and grass tiles back to forest inside lit zone
      let grown = 0
      for (const [k, t] of world.tiles) {
        if (grown >= 5) break
        if (t.type === 'stump' || t.type === 'grass') {
          const [c, r] = k.split(',').map(Number)
          const d = Math.sqrt(c * c + r * r)
          if (d > 4 && d < world.heart.lightRadius) {
            t.type = 'forest'
            delete t.decayAt
            grown++
            world.bgDirty = true
          }
        }
      }
    },
  },

  // ── Bad events ───────────────────────────────────────────────────────────────
  {
    id: 'drought',
    weight: 12,
    label: '☀️ Drought grips the land. Foragers return empty-handed.',
    apply(world) {
      world.resources.food = Math.max(0, world.resources.food - 15)
    },
  },
  {
    id: 'blight',
    weight: 10,
    label: '🍄 Blight sweeps through the farmland. Crops are lost.',
    apply(world) {
      let cleared = 0
      for (const [, t] of world.tiles) {
        if (t.type === 'farmland' && cleared < 5) {
          t.type = 'grass'
          delete t.decayAt
          cleared++
        }
      }
      if (cleared > 0) {
        world.bgDirty = true
        world.resources.food = Math.max(0, world.resources.food - 8)
      }
    },
  },
  {
    id: 'harsh_winter',
    weight: 8,
    label: '❄️ A harsh winter drains stockpiles.',
    apply(world) {
      world.resources.food = Math.max(0, world.resources.food - 10)
      world.resources.wood = Math.max(0, world.resources.wood - 12)
    },
  },
  {
    id: 'fire',
    weight: 6,
    label: '🔥 Fire tears through the settlement! A building is lost.',
    apply(world) {
      // Guards intercept fire — each guard has a 25% interception chance
      const guardCount = world.citizens.filter(c => c.role === 'guard').length
      if (guardCount > 0 && Math.random() < 1 - Math.pow(0.75, guardCount)) {
        world.legacyCounters.fireIntercepts = (world.legacyCounters.fireIntercepts || 0) + 1
        if (world.legacyCounters.fireIntercepts >= 3) {
          awardLegacy(world, 'legacy_guard', '⚔️ The Guardian Stone stands. Three fires stopped before they spread.')
        }
        addEvent(world, '⚔️ Guards spotted the fire early — disaster averted.')
        return
      }

      // Pick a random built building to burn (not the campfire / heart)
      const candidates = world.buildings.filter(b => b.isBuilt && !b.burned && b.type !== 'campfire')
      if (!candidates.length) {
        addEvent(world, '🔥 Flames swept through but found nothing to take.')
        return
      }
      const target = candidates[Math.floor(Math.random() * candidates.length)]
      target.isBuilt = false
      target.burned  = true

      // Leave rubble (or tombstone if residents die) on the building's tile
      const tileKey = key(target.col, target.row)
      const tile    = world.tiles.get(tileKey)
      if (tile) { tile.type = 'rubble'; delete tile.decayAt }

      // Kill some residents — 50% chance per resident; tombstone marks the site
      if (target.residents?.length > 0) {
        const dead = target.residents.filter(() => Math.random() < 0.5)
        for (const resId of dead) {
          const idx = world.citizens.findIndex(c => c.id === resId)
          if (idx !== -1) world.citizens.splice(idx, 1)
        }
        if (dead.length > 0) {
          if (tile) { tile.type = 'tombstone'; tile.decayAt = world.tick + 4000 }
          addEvent(world, dead.length > 1
            ? `💀 ${dead.length} workers perished in the fire.`
            : '💀 A worker perished in the fire.')
          world.legacyCounters.fireDeaths = (world.legacyCounters.fireDeaths || 0) + dead.length
          if (world.legacyCounters.fireDeaths >= 5) {
            awardLegacy(world, 'legacy_pyre', '🔥 The Pyre Stone was raised. Fire has claimed many lives here.')
          }
        }
      }

      // Reduce housing capacity if it was a shelter building
      const def = BUILDING_DEFS[target.type]
      if (def?.shelter) {
        world.housingCapacity = Math.max(0, world.housingCapacity - def.shelter)
        for (const c of world.citizens) {
          if (c.homeId === target.id) c.homeId = null
        }
      }

      world.bgDirty = true
    },
  },
]

// ── Era 2: Ancient event pool ─────────────────────────────────────────────────

const ERA2_EVENTS = [
  { id: 'merchant',    weight: 28, label: '🛒 Merchants pass through and trade planks for food.',
    apply(world) { if (world.resources.planks >= 5) { world.resources.planks -= 5; world.resources.food = Math.min(world.resources.food + 25, 150) } else { world.resources.food = Math.min(world.resources.food + 10, 150) } } },
  { id: 'quarry_find', weight: 22, label: '🪨 A rich vein of stone is found nearby.',
    apply(world) { world.resources.stone = Math.min(world.resources.stone + 30, 150) } },
  { id: 'timber',      weight: 20, label: '🪵 A forest giant falls — a season of timber.',
    apply(world) { world.resources.wood = Math.min(world.resources.wood + 30, 150) } },
  { id: 'drought',     weight: 12, label: '☀️ Drought parches the land. Food stores dwindle.',
    apply(world) { world.resources.food = Math.max(0, world.resources.food - 18) } },
  { id: 'flood',       weight: 8,  label: '🌊 Flooding damages farmland and roads.',
    apply(world) {
      let cleared = 0
      for (const [, t] of world.tiles) { if (t.type === 'farmland' && cleared < 6) { t.type = 'grass'; cleared++ } }
      if (cleared) world.bgDirty = true
    } },
  { id: 'fire',        weight: 6,  label: '🔥 Fire in the market district! A building is lost.',
    apply: ERA1_EVENTS.find(e => e.id === 'fire').apply },
]

// ── Era 3: Medieval event pool ────────────────────────────────────────────────

const ERA3_EVENTS = [
  { id: 'iron_vein',   weight: 25, label: '⛏️ Miners uncover a rich iron vein!',
    apply(world) { world.resources.iron_ore = Math.min(world.resources.iron_ore + 25, 200) } },
  { id: 'coal_seam',   weight: 22, label: '⛏️ A coal seam collapses, exposing more fuel.',
    apply(world) { world.resources.coal = Math.min(world.resources.coal + 30, 200) } },
  { id: 'harvest',     weight: 18, label: '🌾 Bountiful harvest feeds the growing population.',
    apply(world) { world.resources.food = Math.min(world.resources.food + 30, 200) } },
  { id: 'plague',      weight: 10, label: '🤒 Plague sweeps the settlement. Citizens fall ill.',
    apply(world) {
      // Randomly slow down a few citizens for a period (simulate via food drain)
      world.resources.food = Math.max(0, world.resources.food - 20)
      world.resources.wood = Math.max(0, world.resources.wood - 10)
    } },
  { id: 'raid',        weight: 8,  label: '⚔️ Raiders strike! Stockpiles are plundered.',
    apply(world) {
      world.resources.food  = Math.max(0, world.resources.food  - 15)
      world.resources.iron  = Math.max(0, world.resources.iron  - 8)
      world.resources.planks= Math.max(0, world.resources.planks- 10)
    } },
  { id: 'fire',        weight: 7,  label: '🔥 Fire rips through a building!',
    apply: ERA1_EVENTS.find(e => e.id === 'fire').apply },
]

// ── Era 4: Industrial event pool ──────────────────────────────────────────────

const ERA4_EVENTS = [
  { id: 'coal_strike', weight: 22, label: '⛏️ A vast coal seam is blasted open.',
    apply(world) { world.resources.coal  = Math.min(world.resources.coal  + 50, 300) } },
  { id: 'steel_boom',  weight: 18, label: '🏭 Factory output surges — steel production doubles.',
    apply(world) { world.resources.steel = Math.min(world.resources.steel + 20, 300) } },
  { id: 'invention',   weight: 15, label: '💡 A new invention speeds construction.',
    apply(world) {
      // Shortens next building's work timer
      for (const b of world.buildings) { if (!b.isBuilt) { b.buildProgress = Math.min(100, b.buildProgress + 30); break } }
    } },
  { id: 'labour_strike',weight:12, label: '✊ Labour strike! Workers down tools briefly.',
    apply(world) { world.resources.coal  = Math.max(0, world.resources.coal  - 20); world.resources.iron = Math.max(0, world.resources.iron - 10) } },
  { id: 'explosion',   weight: 8,  label: '💥 Boiler explosion destroys a building!',
    apply: ERA1_EVENTS.find(e => e.id === 'fire').apply },
  { id: 'smog',        weight: 6,  label: '🌫️ Thick smog from factories chokes the farmland.',
    apply(world) { world.resources.food = Math.max(0, world.resources.food - 25) } },
]

// ── Era 5: Nuclear event pool ─────────────────────────────────────────────────

const ERA5_EVENTS = [
  { id: 'power_surge',  weight: 22, label: '⚡ Power surge — the grid crackles with energy.',
    apply(world) { world.heart.fuelTank = Math.min(world.heart.fuelMax, world.heart.fuelTank + 20) } },
  { id: 'uranium_find', weight: 18, label: '☢️ Survey team finds a rich uranium deposit.',
    apply(world) { world.resources.uranium = Math.min(world.resources.uranium + 10, 100) } },
  { id: 'steel_delivery',weight:15, label: '🚂 Steel shipment arrives from the industrial quarter.',
    apply(world) { world.resources.steel = Math.min(world.resources.steel + 25, 300) } },
  { id: 'rad_warning',  weight: 12, label: '☢️ Radiation warning issued. Perimeter sealed.',
    apply(world) { world.resources.food = Math.max(0, world.resources.food - 20) } },
  { id: 'containment',  weight: 8,  label: '⚠️ Minor containment breach repaired quickly.',
    apply(world) { world.heart.fuelTank = Math.max(0, world.heart.fuelTank - 15) } },
  { id: 'meltdown_scare',weight:5,  label: '🚨 Meltdown scare — reactor briefly shut down.',
    apply(world) { world.heart.fuelTank = Math.max(0, world.heart.fuelTank - 30) } },
]

// ── Era 6: Clean event pool ───────────────────────────────────────────────────

const ERA6_EVENTS = [
  { id: 'solar_peak',    weight: 30, label: '🌞 Peak solar output — city glows with clean light.',
    apply(world) { world.heart.fuelTank = world.heart.fuelMax } },
  { id: 'wind_harvest',  weight: 25, label: '💨 Strong winds boost energy generation.',
    apply(world) { world.resources.food = Math.min(world.resources.food + 20, 300) } },
  { id: 'breakthrough',  weight: 18, label: '✨ Fusion breakthrough — energy is unlimited.',
    apply(world) { /* era 6 is already the end state — bonus event */ world.heart.fuelTank = world.heart.fuelMax } },
  { id: 'solar_flare',   weight: 10, label: '🌑 Solar flare disrupts panels briefly.',
    apply(world) { world.heart.fuelTank = Math.max(world.heart.fuelMax * 0.5, world.heart.fuelTank - 50) } },
  { id: 'reclamation',   weight: 8,  label: '🌿 Nature reclaims another patch of wasteland.',
    apply(world) {
      for (const [, t] of world.tiles) {
        if (t.type === 'rubble' && Math.random() < 0.4) { t.type = 'grass'; world.bgDirty = true; break }
      }
    } },
]

// ── Era event pools ────────────────────────────────────────────────────────────

const EVENT_POOLS = {
  1: ERA1_EVENTS,
  2: ERA2_EVENTS,
  3: ERA3_EVENTS,
  4: ERA4_EVENTS,
  5: ERA5_EVENTS,
  6: ERA6_EVENTS,
}

// ── Public: called each tick from tick.js ─────────────────────────────────────
// Fires roughly every 600–1400 ticks (at 20 ticks/sec ≈ 30–70 seconds real time,
// which at 20× dev speed is 1.5–3.5 seconds — frequent enough to feel alive).

export function maybeFireEvent(world) {
  // Only sample on multiples of 100 to avoid per-tick random() cost
  if (world.tick % 100 !== 0) return
  // ~20% chance per 100-tick window → expected interval ~500 ticks
  if (Math.random() > 0.20) return

  const pool = EVENT_POOLS[world.heart.era] || ERA1_EVENTS
  const ev   = weightedPick(pool)
  ev.apply(world)
  addEvent(world, ev.label)
}

// ── Dev menu: fire a random event immediately ─────────────────────────────────
export function fireRandomEvent(world) {
  const pool = EVENT_POOLS[world.heart.era] || ERA1_EVENTS
  const ev   = weightedPick(pool)
  ev.apply(world)
  addEvent(world, ev.label)
}
