// ── Mossgate — Config ──────────────────────────────────────────────────────────

export const TILE_W   = 64
export const TILE_H   = 32
export const UNIT_H   = 20
export const TICK_MS  = 50   // 20 ticks/sec

// ── Tasks — what a general worker can be assigned to ──────────────────────────
// Phase 1: all workers are general purpose (forage / chop / build).
// Phase 2 (future): specialized jobs (farmer, logger, etc.) unlocked via skill.
export const TASKS = {
  forage: { resource: 'food', yield: 1, workTicks: 100, sourceTile: 'forest', chops: false, color: '#78d878', label: 'Foraging' },
  chop:   { resource: 'wood', yield: 2, workTicks: 140, sourceTile: 'forest', chops: true,  color: '#c8a060', label: 'Chopping wood' },
  build:  { resource: null,   yield: 0, workTicks: 0,   sourceTile: null,     chops: false, color: '#e8a840', label: 'Building' },
}

// Keep JOBS for backward compat and future specialized workers
export const JOBS = {
  farmer:  { resource: 'food', yield: 3, workTicks: 200, color: '#a8d840', needsBuilding: 'farm' },
  logger:  { resource: 'wood', yield: 5, workTicks: 180, color: '#8a5820', needsBuilding: 'logging_camp' },
}

// ── Buildings ──────────────────────────────────────────────────────────────────
// cost: resources consumed to build
// buildTicks: how long builder spends constructing
// shelter: how many additional citizens this houses
// workerJob: if set, citizens can be assigned here as this job type
// maxWorkers: max workers at this building
export const BUILDING_DEFS = {
  town_center: {
    cost: { wood: 20 }, buildTicks: 500, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#d4a84a', left: '#a07820', right: '#805808', h: 2.8 },
    label: 'Town Center',
  },
  house: {
    cost: { wood: 25 }, buildTicks: 300, shelter: 1,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#d4845a', left: '#a05a30', right: '#8a4a20', h: 1.4 },
    label: 'House',
  },
  farm: {
    cost: { wood: 5 }, buildTicks: 300, shelter: 0,
    workerJob: 'farmer', maxWorkers: 2,
    iso: { top: '#6a9a3a', left: '#4a7a1a', right: '#3a6a0a', h: 0.4 },
    label: 'Farm',
  },
  logging_camp: {
    cost: { wood: 6 }, buildTicks: 250, shelter: 0,
    workerJob: 'logger', maxWorkers: 2,
    iso: { top: '#8a6030', left: '#5a3810', right: '#4a2808', h: 1.0 },
    label: 'Logging Camp',
  },
  granary: {
    cost: { wood: 12 }, buildTicks: 400, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#e8c040', left: '#b89010', right: '#987800', h: 1.8 },
    label: 'Granary',
  },
  well: {
    cost: { wood: 4 }, buildTicks: 150, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#9a9a8a', left: '#6a6a5a', right: '#5a5a4a', h: 0.6 },
    label: 'Well',
  },
}

// ── Unlock conditions ──────────────────────────────────────────────────────────
// Each entry is a function(world) → boolean
// When true, that building type becomes available for the builder to construct
export const UNLOCK_CONDITIONS = {
  // town_center starts unlocked (in world initial unlocks Set)
  farm:         (w) => w.citizens.length >= 5 || w.deficits.food >= 20,
  logging_camp: (w) => w.citizens.filter(c => c.task === 'chop').length >= 2,
  granary:      (w) => w.citizens.length >= 8,
  well:         (w) => w.citizens.length >= 10,
}

// ── Resource consumption ───────────────────────────────────────────────────────
export const FOOD_PER_CITIZEN   = 1    // food consumed per citizen per 400 ticks
export const FOOD_CONSUME_EVERY = 400  // ticks between consumption events

// ── Arrivals ──────────────────────────────────────────────────────────────────
// When a new house is built a random arrival timer is started in this range.
// 20 ticks/sec → 1 min = 1 200 ticks, 15 min = 18 000 ticks
export const ARRIVE_MIN_TICKS = 1_200
export const ARRIVE_MAX_TICKS = 18_000

// ── Tile types ─────────────────────────────────────────────────────────────────
export const GROUND = {
  grass:    '#3a5c28',
  forest:   '#1a3810',
  stump:    '#5a4828',
  path:     '#8a7a60',
  plaza:    '#9a8a70',
  farmland: '#7a5530',
}

export const STUMP_DECAY_TICKS = 600   // ticks before stump becomes grass
export const REVEAL_RADIUS     = 10   // tiles revealed around each completed building

// ── Day / Night cycle ──────────────────────────────────────────────────────────
// 20 ticks/sec → 20 min day = 24 000 ticks, 10 min night = 12 000 ticks
export const DAY_TICKS   = 24_000   // full-day portion
export const NIGHT_TICKS = 12_000   // full-night portion
export const CYCLE_TICKS = DAY_TICKS + NIGHT_TICKS   // 36 000 per full cycle
export const DUSK_TICKS  = 2_400    // 2-min dusk transition (day → night)
export const DAWN_TICKS  = 2_400    // 2-min dawn transition (night → day)
