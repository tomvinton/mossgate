// ── MossGate — Households & migration ──────────────────────────────────────────
//
// THE rule that kills house-spam: a dwelling creates CAPACITY, not demand. People
// arrive only as migration waves, and only when the settlement feels CONFIDENT
// (food in store, a warm hearth, a spare bed, recent calm). An empty hut is fine and
// normal. When confidence collapses, migration stops and households quietly drift
// away — a visible decline, never a hard reset.

import {
  MIGRATION_CONFIDENCE, DEPARTURE_CONFIDENCE, SETTLE_DELAY_TICKS,
  HOUSEHOLD_SIZE_MIN, HOUSEHOLD_SIZE_MAX, WALK_SPEED, ARRIVE_EPS,
  CITIZEN_REVEAL, INITIAL_REVEAL,
} from './config.js'
import { nextId, addEvent, addHistory, noteDisturbance, bedCapacity, dist } from './world.js'
import { revealAround } from './terrain.js'
import { makeCitizen } from './citizens.js'
import { citizenName, householdName } from './names.js'

// A hut nobody lives in yet — capacity waiting for a household.
function freeHut(world) {
  const taken = new Set(world.households.map(h => h.homeBuildingId))
  return world.buildings.find(b => b.type === 'hut' && b.isBuilt && !taken.has(b.id))
}

function randSize(world) {
  const span = HOUSEHOLD_SIZE_MAX - HOUSEHOLD_SIZE_MIN
  return HOUSEHOLD_SIZE_MIN + Math.floor(((world.tick * 2654435761) % 1000) / 1000 * (span + 1))
}

// ── Migration waves ────────────────────────────────────────────────────────────
// Considered on a slow cadence (see sim.js). Confident settlement + a spare bed → a
// small group appears at the forest edge and walks in toward the hearth.
export function considerMigration(world) {
  if (world.confidence < MIGRATION_CONFIDENCE) return
  if (!freeHut(world)) return                 // capacity, not demand: no bed → no invite
  if (world.migrants.length > 0) return        // one wave at a time, unhurried

  const size = randSize(world)
  const angle = (world.tick * 0.618) % (Math.PI * 2)
  const r = INITIAL_REVEAL + 4
  const m = {
    id: nextId(),
    size,
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
    state: 'arriving',
    timer: 0,
  }
  world.migrants.push(m)
  addEvent(world, `A small group of ${size} approaches through the trees.`)
}

// ── Decline ────────────────────────────────────────────────────────────────────
// Sustained low confidence → a household leaves. People depart abstractly; their hut
// goes empty and can be re-settled later. The place loses life but keeps its history.
export function considerDeparture(world) {
  if (world.confidence > DEPARTURE_CONFIDENCE) return
  if (world.households.length <= 1) return      // never empty the founding family
  const h = world.households[world.households.length - 1]
  removeHousehold(world, h)
  noteDisturbance(world, 'A household has packed up and left. The hut stands empty.')
}

function removeHousehold(world, h) {
  world.citizens = world.citizens.filter(c => !h.memberIds.includes(c.id))
  world.households = world.households.filter(x => x.id !== h.id)
}

// ── Settling ───────────────────────────────────────────────────────────────────
// Walk the migrant group to the hearth, let them linger a moment, then move them into
// a free hut as a new household with real citizens.
export function updateMigrants(world) {
  for (const m of world.migrants) {
    if (m.state === 'arriving') {
      const d = dist(m.x, m.y, world.hearth.col, world.hearth.row)
      if (d < 2.5) { m.state = 'settling'; m.timer = SETTLE_DELAY_TICKS }
      else {
        const dx = world.hearth.col - m.x, dy = world.hearth.row - m.y
        m.x += (dx / d) * WALK_SPEED
        m.y += (dy / d) * WALK_SPEED
        revealAround(world, Math.round(m.x), Math.round(m.y), CITIZEN_REVEAL)
      }
    } else if (m.state === 'settling') {
      if (--m.timer <= 0) settleMigrant(world, m)
    }
  }
  world.migrants = world.migrants.filter(m => m.state !== 'done')
}

function settleMigrant(world, m) {
  const hut = freeHut(world)
  if (!hut) {
    m.state = 'done'
    addEvent(world, 'With no room to spare, the newcomers wandered on.')
    return
  }
  const hid = nextId()
  const hname = householdName(world.seed, hid)
  const h = { id: hid, name: hname, homeBuildingId: hut.id, size: m.size, memberIds: [], history: [] }
  addHistory(h, world, `Arrived and settled the empty hut.`)
  world.households.push(h)
  for (let i = 0; i < m.size; i++) {
    const c = makeCitizen(world, hut.col + (Math.random() - 0.5), hut.row + (Math.random() - 0.5))
    c.householdId = h.id
    c.name = citizenName(world.seed, c.id)
    c.homeBuildingId = hut.id
    addHistory(c, world, `Arrived with the ${hname}.`)
    world.citizens.push(c)
    h.memberIds.push(c.id)
  }
  m.state = 'done'
  addEvent(world, `${m.size} newcomers have made the empty hut a home.`)
}

// Used by founding.js to seat the very first family without a migration walk.
export function seatHousehold(world, hut, size) {
  const hid = nextId()
  const hname = householdName(world.seed, hid)
  const h = { id: hid, name: hname, homeBuildingId: hut.id, size, memberIds: [], history: [] }
  addHistory(h, world, `Founded MossGate on Day 0.`)
  world.households.push(h)
  for (let i = 0; i < size; i++) {
    const c = makeCitizen(world, hut.col + (Math.random() - 0.5), hut.row + (Math.random() - 0.5))
    c.householdId = h.id
    c.name = citizenName(world.seed, c.id)
    c.homeBuildingId = hut.id
    addHistory(c, world, `Founded MossGate.`)
    world.citizens.push(c)
    h.memberIds.push(c.id)
  }
  return h
}
