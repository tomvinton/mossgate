// ── Mossgate — Config ──────────────────────────────────────────────────────────

export const TILE_W   = 64
export const TILE_H   = 32
export const UNIT_H   = 20
export const TICK_MS  = 50   // 20 ticks/sec

// ── Era definitions ────────────────────────────────────────────────────────────
// Each era has a heart building, fuel type, light properties, and population cap.
// fuelDrainPerTick: units drained per tick at 1× speed
// lightRadius: tile-space radius at full fuel
// lightColor: [r, g, b] ambient tint inside light radius
// fuelResource: null → no fuel needed (Era 6 solar)
export const ERA_DEFS = {
  1: {
    name:             'Tribal',
    heartType:        'campfire',
    fuelResource:     'wood',
    fuelDrainPerTick: 0.002,
    fuelMax:          150,
    lightRadius:      14,
    lightColor:       [255, 140, 45],
    maxPop:           12,
  },
  2: {
    name:             'Ancient',
    heartType:        'hearth',
    fuelResource:     'planks',
    fuelDrainPerTick: 0.0025,
    fuelMax:          200,
    lightRadius:      22,
    lightColor:       [255, 170, 60],
    maxPop:           30,
  },
  3: {
    name:             'Medieval',
    heartType:        'forge',
    fuelResource:     'coal',
    fuelDrainPerTick: 0.003,
    fuelMax:          280,
    lightRadius:      30,
    lightColor:       [255, 130, 50],
    maxPop:           60,
  },
  4: {
    name:             'Industrial',
    heartType:        'boiler',
    fuelResource:     'coal',
    fuelDrainPerTick: 0.005,
    fuelMax:          400,
    lightRadius:      44,
    lightColor:       [255, 110, 30],
    maxPop:           150,
  },
  5: {
    name:             'Nuclear',
    heartType:        'reactor',
    fuelResource:     'uranium',
    fuelDrainPerTick: 0.0008,
    fuelMax:          80,
    lightRadius:      65,
    lightColor:       [100, 255, 80],
    maxPop:           999,
  },
  6: {
    name:             'Clean',
    heartType:        'solar',
    fuelResource:     null,    // solar — no fuel drain
    fuelDrainPerTick: 0,
    fuelMax:          999,
    lightRadius:      80,
    lightColor:       [180, 230, 255],
    maxPop:           9999,
  },
}

// ── Tasks — what a general worker can be assigned to ──────────────────────────
// resultTile: what the source tile becomes after work (null = unchanged)
// decayAfter: ticks until resultTile auto-reverts (0 = permanent)
// resource: null means no yield (decontaminate task)
export const TASKS = {
  // Era 1
  forage:        { resource: 'food',     yield: 1, workTicks: 100, sourceTile: 'forest',       chops: false, resultTile: null,    decayAfter: 0,    color: '#78d878', label: 'Foraging' },
  chop:          { resource: 'wood',     yield: 2, workTicks: 140, sourceTile: 'forest',       chops: true,  resultTile: 'stump', decayAfter: 600,  color: '#c8a060', label: 'Chopping wood' },
  quarry:        { resource: 'stone',    yield: 3, workTicks: 200, sourceTile: 'rock',         chops: true,  resultTile: 'grass', decayAfter: 0,    color: '#9a9a8a', label: 'Quarrying stone' },
  build:         { resource: null,       yield: 0, workTicks: 0,   sourceTile: null,           chops: false, resultTile: null,    decayAfter: 0,    color: '#e8a840', label: 'Building' },
  // Era 3
  mine_coal:     { resource: 'coal',     yield: 3, workTicks: 160, sourceTile: 'coal_seam',    chops: true,  resultTile: 'rock',  decayAfter: 0,    color: '#555560', label: 'Mining coal' },
  mine_iron:     { resource: 'iron_ore', yield: 2, workTicks: 200, sourceTile: 'iron_deposit', chops: true,  resultTile: 'rock',  decayAfter: 0,    color: '#aa7060', label: 'Mining iron' },
  // Era 5
  mine_uranium:  { resource: 'uranium',  yield: 1, workTicks: 320, sourceTile: 'uranium_ore',  chops: true,  resultTile: 'rock',  decayAfter: 0,    color: '#60aa40', label: 'Mining uranium' },
  // Era 6
  decontaminate: { resource: null,       yield: 0, workTicks: 400, sourceTile: 'contamination',chops: true,  resultTile: 'rubble',decayAfter: 3000, color: '#80c070', label: 'Decontaminating' },
  // Guard role (Era 3+, assigned by watchtower)
  guard:         { resource: null,       yield: 0, workTicks: 0,   sourceTile: null,           chops: false, resultTile: null,    decayAfter: 0,    color: '#a06040', label: 'Patrolling' },
}

// Keep JOBS for backward compat
export const JOBS = {
  farmer: { resource: 'food', yield: 3, workTicks: 200, color: '#a8d840', needsBuilding: 'farm' },
  logger: { resource: 'wood', yield: 5, workTicks: 180, color: '#8a5820', needsBuilding: 'logging_camp' },
}

// ── Buildings ──────────────────────────────────────────────────────────────────
export const BUILDING_DEFS = {
  // ── Era 1: Tribal ──────────────────────────────────────────────────────────
  town_center: {
    cost: { wood: 20 }, buildTicks: 500, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#d4a84a', left: '#a07820', right: '#805808', h: 2.8 },
    label: 'Town Center',
  },
  house: {
    cost: { wood: 3 }, buildTicks: 300, shelter: 1,
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

  // ── Era 2: Ancient ─────────────────────────────────────────────────────────
  sawmill: {
    cost: { wood: 18 }, buildTicks: 350, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#8a6838', left: '#5a4018', right: '#4a3008', h: 1.3 },
    label: 'Sawmill',
  },
  stonemason: {
    cost: { wood: 8, stone: 12 }, buildTicks: 420, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#8a8878', left: '#5a5848', right: '#4a4838', h: 1.5 },
    label: 'Stonemason',
  },
  longhouse: {
    cost: { planks: 20, cut_stone: 8 }, buildTicks: 600, shelter: 4,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#c07040', left: '#904020', right: '#782010', h: 2.2 },
    label: 'Longhouse',
  },
  market: {
    cost: { planks: 12, cut_stone: 6 }, buildTicks: 450, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#d4c050', left: '#a09020', right: '#807000', h: 1.6 },
    label: 'Market',
  },

  // ── Era 3: Medieval ────────────────────────────────────────────────────────
  forge_building: {
    cost: { cut_stone: 20, coal: 10 }, buildTicks: 500, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#805040', left: '#503020', right: '#402010', h: 1.8 },
    label: 'Forge',
  },
  great_hall: {
    cost: { iron: 10, planks: 30 }, buildTicks: 800, shelter: 8,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#b08858', left: '#786028', right: '#604808', h: 3.0 },
    label: 'Great Hall',
  },
  watchtower: {
    cost: { cut_stone: 15, iron: 5 }, buildTicks: 500, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#909080', left: '#606050', right: '#505040', h: 3.5 },
    label: 'Watchtower',
  },

  // ── Era 4: Industrial ──────────────────────────────────────────────────────
  factory: {
    cost: { iron: 25, cut_stone: 20 }, buildTicks: 600, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#707878', left: '#404848', right: '#303838', h: 2.5 },
    label: 'Factory',
  },
  tenement: {
    cost: { iron: 15, planks: 25 }, buildTicks: 500, shelter: 10,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#a08870', left: '#705840', right: '#584830', h: 3.2 },
    label: 'Tenement',
  },
  power_station: {
    cost: { steel: 30, cut_stone: 25 }, buildTicks: 900, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#606880', left: '#303848', right: '#202838', h: 3.0 },
    label: 'Power Station',
  },

  // ── Era 5: Nuclear ─────────────────────────────────────────────────────────
  nuclear_plant: {
    cost: { steel: 50, cut_stone: 40 }, buildTicks: 1400, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#708878', left: '#405848', right: '#303838', h: 4.0 },
    label: 'Nuclear Plant',
  },

  // ── Era 6: Clean ───────────────────────────────────────────────────────────
  solar_farm: {
    cost: { steel: 20, cut_stone: 12 }, buildTicks: 400, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#4878a8', left: '#284858', right: '#183848', h: 0.5 },
    label: 'Solar Farm',
  },
  decontam_center: {
    cost: { steel: 12, cut_stone: 10 }, buildTicks: 350, shelter: 0,
    workerJob: null, maxWorkers: 0,
    iso: { top: '#70a870', left: '#408040', right: '#306030', h: 1.5 },
    label: 'Decontam. Center',
  },
}

// ── Unlock conditions ──────────────────────────────────────────────────────────
export const UNLOCK_CONDITIONS = {
  // Era 1
  farm:            (w) => w.citizens.length >= 5 || w.deficits.food >= 20,
  logging_camp:    (w) => w.citizens.filter(c => c.task === 'chop').length >= 2,
  granary:         (w) => w.citizens.length >= 8,
  well:            (w) => w.citizens.length >= 10,
  // Era 2
  sawmill:         (w) => w.citizens.length >= 6  && w.resources.wood  >= 30,
  stonemason:      (w) => w.citizens.length >= 6  && w.resources.stone >= 15,
  longhouse:       (w) => w.era >= 2,
  market:          (w) => w.era >= 2 && w.buildings.some(b => b.type === 'longhouse' && b.isBuilt),
  // Era 3
  forge_building:  (w) => w.era >= 2 && w.resources.coal >= 5,
  great_hall:      (w) => w.era >= 3,
  watchtower:      (w) => w.era >= 3 && w.resources.iron >= 5,
  // Era 4
  factory:         (w) => w.era >= 3 && w.resources.iron >= 20,
  tenement:        (w) => w.era >= 4,
  power_station:   (w) => w.era >= 4 && w.resources.steel >= 10,
  // Era 5
  nuclear_plant:   (w) => w.era >= 4 && w.resources.steel >= 30,
  // Era 6
  solar_farm:      (w) => w.era >= 6,
  decontam_center: (w) => w.nuclearRevealed,
}

// ── Resource consumption ───────────────────────────────────────────────────────
export const FOOD_PER_CITIZEN   = 1
export const FOOD_CONSUME_EVERY = 400

// ── Arrivals ──────────────────────────────────────────────────────────────────
export const ARRIVE_MIN_TICKS = 1_200
export const ARRIVE_MAX_TICKS = 18_000

// ── Tile types ─────────────────────────────────────────────────────────────────
export const GROUND = {
  grass:                 '#3a5c28',
  forest:                '#1a3810',
  stump:                 '#5a4828',
  path:                  '#8a7a60',
  plaza:                 '#9a8a70',
  farmland:              '#7a5530',
  water:                 '#2a5880',
  bridge:                '#9a8a68',
  rock:                  '#7a7870',
  nuclear_ruin:          '#4a4840',
  nuclear_ruin_revealed: '#2e2c2a',
  rubble:                '#4e4438',
  tombstone:             '#3a3830',
  coal_seam:             '#28282a',
  iron_deposit:          '#8a5040',
  uranium_ore:           '#506840',
  contamination:         '#5a6830',
  // Legacy markers — permanent monuments awarded for rare world events
  legacy_arc:            '#1c3020',
  legacy_pyre:           '#1a1010',
  legacy_guard:          '#20203a',
  legacy_elder:          '#4a3818',
  legacy_famine:         '#28202e',
  legacy_resilience:     '#2c2c2c',
}

export const STUMP_DECAY_TICKS     = 600
export const REVEAL_RADIUS         = 10

// ── Tree chopping + log system ─────────────────────────────────────────────────
export const LOG_COUNT_PER_TREE    = 9    // logs scattered when a tree is felled
export const LOG_CARRY_COUNT       = 3    // logs a citizen can carry per trip
export const CHOP_TICKS_PER_CYCLE  = 30   // ticks per chop animation cycle (9 cycles total)

// ── Fire crisis ────────────────────────────────────────────────────────────────
export const FIRE_CRISIS_THRESHOLD = 0.15  // fuelTank fraction below which crisis begins
export const FIRE_CRISIS_RECOVER   = 0.25  // fuelTank fraction at which crisis clears

// ── Day / Night cycle ──────────────────────────────────────────────────────────
// Time scale (at 1× speed, 20 ticks/sec):
//   1 day   = 200 ticks = 10 sec real
//   1 night = 200 ticks = 10 sec real
//   1 week  = 7 cycles  = ~2.3 min
//   1 month = 4 weeks   = ~9.3 min
//   1 season= 2 months  = ~18.6 min
export const DAY_TICKS   = 200
export const NIGHT_TICKS = 200
export const CYCLE_TICKS = DAY_TICKS + NIGHT_TICKS
export const DUSK_TICKS  = 40
export const DAWN_TICKS  = 40
