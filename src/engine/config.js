// ── MossGate — Configuration & tuning ──────────────────────────────────────────
//
// MossGate is a slow, zero-player civilisation terrarium. Everything here is tuned
// for a CALM default experience: small visible changes over minutes, settlement
// changes over hours. Dev speed multipliers (see App.jsx) compress time for testing
// WITHOUT changing any of these constants — the world only ever runs more ticks per
// real second, never differently.
//
// One golden rule lives in these numbers: growth is throttled by LAND, LABOUR and
// CONFIDENCE — never by a hidden survival death-timer. Nothing here drains toward a
// hard reset.

// ── Isometric geometry ─────────────────────────────────────────────────────────
export const TILE_W = 64
export const TILE_H = 32
export const UNIT_H = 20    // pixel height of one "storey" for extruded boxes

// ── Simulation clock ───────────────────────────────────────────────────────────
// The sim advances in fixed ticks. At 1× the loop runs TICK_MS apart; dev speed
// simply runs N ticks per loop. All durations below are expressed in ticks with the
// real-time-at-1× noted, so the calm pacing is legible at a glance.
export const TICK_MS = 50          // 20 ticks per second at 1×

export const TICKS_PER_SEC = 1000 / TICK_MS   // 20
const SEC = TICKS_PER_SEC
const MIN = 60 * SEC                            // 1200 ticks = 1 real minute at 1×

// ── Day / night / seasons ──────────────────────────────────────────────────────
// A gentle clock you notice when you check back. ~5 min per full day at 1×.
// Citizens work by day and rest by night, which is the cozy heartbeat of the scene.
export const DAY_TICKS   = Math.round(3.2 * MIN)   // daylight
export const NIGHT_TICKS = Math.round(2.0 * MIN)   // night
export const CYCLE_TICKS = DAY_TICKS + NIGHT_TICKS // one full day
export const DUSK_TICKS  = Math.round(0.5 * MIN)   // fade length at each edge
export const DAWN_TICKS  = Math.round(0.5 * MIN)

export const SEASONS       = ['spring', 'summer', 'autumn', 'winter']
export const DAYS_PER_SEASON = 6                   // a season is a handful of days
export const SEASON_TICKS  = DAYS_PER_SEASON * CYCLE_TICKS

// Seasonal multiplier on outdoor yields (food). Winter is lean → more foragers,
// less building — a visible rhythm, never a famine spiral.
export const SEASON_YIELD = { spring: 1.1, summer: 1.25, autumn: 1.0, winter: 0.55 }

// ── Movement ───────────────────────────────────────────────────────────────────
// Distance and travel time MATTER — that is why roads are worth building. A citizen
// crossing ~12 tiles of open ground takes ~30s at 1×; on a path they move ~1.8× as
// fast, so a long supply line visibly rewards a road.
export const WALK_SPEED      = 0.020   // tiles per tick on open ground
export const PATH_SPEED_MULT = 1.8     // multiplier when standing on a path tile
export const ARRIVE_EPS      = 0.12    // how close counts as "arrived" at a tile

// ── Work cycles ────────────────────────────────────────────────────────────────
// Production is LABOUR-driven and VISIBLE: a worker walks to a parcel, performs a
// work cycle, then hauls the yield back to storage. No invisible passive ticking.
export const CARRY_CAPACITY  = 4       // units a worker hauls per trip
export const WORK_CYCLE = {
  forage: { ticks: Math.round(7  * SEC), yield: 1, resource: 'food' },
  farm:   { ticks: Math.round(9  * SEC), yield: 2, resource: 'food' },
  chop:   { ticks: Math.round(11 * SEC), yield: 2, resource: 'wood' },
}
export const DEPOSIT_TICKS   = Math.round(1.2 * SEC)

// Rest / social beats so citizens never robot-chain forever. After a few work trips
// a worker takes a breather at the hearth.
export const TRIPS_BEFORE_REST = 3
export const REST_TICKS_MIN  = Math.round(6  * SEC)
export const REST_TICKS_MAX  = Math.round(14 * SEC)
export const IDLE_WANDER_CHANCE = 0.25   // chance an idle citizen ambles a little

// ── The hearth ─────────────────────────────────────────────────────────────────
// The hearth is the heart of the settlement — a cozy landmark, NOT a fuel tank that
// can collapse the world. Firewood feeds it for warmth/comfort (affecting confidence
// and visuals), but letting it run low never kills anyone; it just makes the place
// feel bleak and slows migration until wood returns.
export const HEARTH = {
  col: 0, row: 0,
  woodComfortTarget: 30,   // wood stock at/above which the settlement feels warm
  burnPerDay: 6,           // firewood the hearth consumes per full day
}

// ── Resources ──────────────────────────────────────────────────────────────────
// Deliberately tiny backend: just food and wood. Visible STATE is what matters, not
// resource breadth. Storage capacity grows as storage parcels/granaries are built.
export const BASE_STORAGE = { food: 40, wood: 40 }
export const GRANARY_BONUS = 80      // each granary adds this much food capacity
export const STOREYARD_BONUS = 60    // each store-yard adds this much wood capacity

// Daily food consumption per citizen (charged once per in-sim day, evenly).
export const FOOD_PER_CITIZEN_PER_DAY = 1.4

// ── Households, migration & confidence ─────────────────────────────────────────
// THE central anti-house-spam rule: a dwelling creates CAPACITY, never demand.
// People arrive as migration waves only when the settlement is CONFIDENT (food in
// store, a warm hearth, spare beds, recent calm). Weak confidence slows or reverses
// migration. A hut sitting empty is normal and fine.
export const HOUSEHOLD_SIZE_MIN = 2
export const HOUSEHOLD_SIZE_MAX = 3

export const MIGRATION_CHECK_TICKS = Math.round(2.5 * MIN)  // how often we consider a wave
export const MIGRATION_CONFIDENCE  = 0.6    // confidence needed to invite a household
export const DEPARTURE_CONFIDENCE  = 0.22   // below this, a household may drift away
export const SETTLE_DELAY_TICKS    = Math.round(0.6 * MIN)  // newcomers linger before moving in

// Confidence is a BLEND of separate signals (not one hidden stability score driving
// everything). Weights here only shape migration & mood; the governor reads the raw
// pressures directly, so no single number rules the AI.
export const CONFIDENCE_WEIGHTS = {
  food:    0.40,   // days of food in store, normalised
  shelter: 0.25,   // spare bed headroom
  warmth:  0.20,   // hearth firewood comfort
  calm:    0.15,   // time since last disturbance
}
export const FOOD_CONFIDENCE_DAYS = 5   // food stock covering this many days = full marks

// ── The governor (settlement AI) ───────────────────────────────────────────────
// Acts SLOWLY and from SEPARATE pressures, not "stability > N → expand". One
// considered decision every couple of minutes keeps growth gradual and legible.
export const GOVERNOR_DECISION_TICKS = Math.round(2.0 * MIN)
// Pressure thresholds above which the governor wants to act on a need.
export const PRESSURE = {
  food:    0.45,   // food per worker running thin → claim a field / forage ground
  wood:    0.45,   // wood thin → claim a woodlot
  // Shelter threshold sits just below the full-beds base (0.35) so any fully-occupied
  // village with adequate food crosses it automatically. The real growth limiters are
  // land availability (findParcelSite fails when crowded) and the food guard (>1.8 days).
  // A decaying prosperity bonus used to gate this, but it kept converging to a near-miss
  // just below whatever threshold we set — structural near-miss, not a tuning problem.
  shelter: 0.34,
  road:    0.55,   // a work parcel is far from the hearth → lay a path
}

// ── Land & parcels ─────────────────────────────────────────────────────────────
// Settlements CLAIM land before they FILL it. Parcels are large lived-in spaces, not
// one-tile buildings, so the early village is sparse, spacious and land-hungry.
// `half` is the half-extent of the (2·half+1) square footprint. `spacing` is the
// minimum gap (in tiles) the placement search keeps between this parcel and others —
// this is what spreads the early settlement out.
export const PARCEL_DEFS = {
  hearth:   { half: 1, spacing: 0, clears: true,  jobs: 0, label: 'Hearth',          develop: 0 },
  // A homestead: a cleared yard with a hut at its centre and room to breathe.
  dwelling: { half: 1, spacing: 2, clears: true,  jobs: 0, label: 'Homestead',       develop: Math.round(50 * SEC), beds: 1 },
  // A real field: a broad block of tilled rows worked by hand.
  field:    { half: 2, spacing: 2, clears: true,  jobs: 2, label: 'Field',           develop: Math.round(70 * SEC) },
  // Foraging ground: a wide patch of wild forest/meadow gleaned for food. Early-game
  // food before fields exist; low yield, no clearing.
  forage:   { half: 2, spacing: 2, clears: false, jobs: 1, label: 'Foraging Ground', develop: Math.round(20 * SEC) },
  // Woodlot: a managed stand of trees, felled and regrown over time.
  woodlot:  { half: 2, spacing: 1, clears: false, jobs: 2, label: 'Woodlot',         develop: Math.round(35 * SEC) },
  // Store-yard: granary + woodpile near the hearth; raises storage and confidence.
  storage:  { half: 1, spacing: 1, clears: true,  jobs: 0, label: 'Stores',          develop: Math.round(45 * SEC) },
  // Village Common — a civic gathering space that appears in the Village band.
  // Citizens occasionally visit to rest/socialise; purely visual/behavioural, no labour.
  common:   { half: 1, spacing: 4, clears: true,  jobs: 0, label: 'Village Common',  develop: Math.round(60 * SEC) },
  // Protected grove — the governor claims a stand of trees to prevent them being cleared.
  // The claim itself is the protection; tiles stay as-is (forest remains forest).
  grove:    { half: 2, spacing: 5, clears: false, jobs: 0, label: 'Grove',            develop: 0 },
}

// ── Village / development band ─────────────────────────────────────────────────
// The second development band ('village') unlocks after the settlement is stable,
// well-fed, and large enough that maturing in place makes more sense than sprawling.
export const VILLAGE_BAND_MIN_POP       = 70
export const VILLAGE_BAND_MIN_DAY       = 30
export const VILLAGE_BAND_MIN_FIELDS    = 3     // active field/forage/woodlot parcels
export const VILLAGE_BAND_MIN_STORAGE   = 1     // active storage parcel
export const VILLAGE_BAND_STABLE_TICKS  = Math.round(4 * MIN)  // must hold confidence ≥0.65 this long
export const VILLAGE_BAND_CONFIDENCE    = 0.65
// Max road upgrades the governor may commission in village mode (throttle).
export const VILLAGE_ROAD_UPGRADE_BATCH = 6

// How far out the very first parcels may be placed, and the outward bias that keeps
// the village growing into the forest rather than piling onto the hearth.
export const CLAIM_MIN_RADIUS = 4
export const CLAIM_MAX_RADIUS = 38   // ~4500 usable tiles → room for ~50 dwellings + fields → ~100 citizens

// Woodlot regrowth: felled tiles become stumps, then regrow to forest, so a woodlot
// is a renewable place rather than a patch that's stripped bare and abandoned.
export const STUMP_REGROW_TICKS = Math.round(2.2 * MIN)

// ── Tile palette ───────────────────────────────────────────────────────────────
// Terrain communicates state by itself (no UI). Cleared ground, tilled fields,
// stumps and paths are all readable at a glance.
export const GROUND = {
  grass:    '#3f6130',
  meadow:   '#4c6f33',   // lighter wild grass, used inside foraging grounds
  forest:   '#1d3a14',
  cleared:  '#6b5a3c',   // bare claimed earth
  field:    '#7a5530',   // tilled soil
  stump:    '#5a4828',
  grove:    '#1e4815',   // protected forest stand — slightly brighter than raw forest
  trail:    '#937e5a',   // faint desire path worn by footfall
  path:     '#a88e64',   // established dirt path
  road:     '#c4a87a',   // upgraded road — wider, lighter, more finished-looking
  water:    '#2a5880',
  rock:     '#6a6858',
  hearth:   '#5a4632',
  common:   '#8a7a58',   // village common — compacted earth
}

// ── Forest stewardship ────────────────────────────────────────────────────────
// The settlement tracks tree coverage across revealed land. When it drops below
// the minimum, clearing is suspended and the governor plants protective groves.
// Unclaimed cleared tiles slowly regrow so barren wasteland can't accumulate.
export const FOREST_COVERAGE_MIN   = 0.18   // clearing blocked below this ratio
export const FOREST_COVERAGE_GROVE = 0.26   // governor plants a grove below this ratio

// ── Traffic & organic road growth ─────────────────────────────────────────────
// Citizens leave footfall on tiles as they walk. High-traffic tiles spontaneously
// become trails, and the governor upgrades heavily-used trails/paths over time.
export const TRAFFIC_TO_TRAIL      = 80    // cumulative footfall to auto-create a trail
export const TRAFFIC_TRAIL_UPGRADE = 300   // governor upgrades trail → path at this level
export const TRAFFIC_PATH_UPGRADE  = 1200  // governor upgrades path  → road at this level
export const TRAFFIC_DECAY_RATE    = 0.93  // multiply all traffic by this on each decay pass
export const TRAFFIC_DECAY_TICKS   = 2000  // ticks between decay passes (~100s at 1×)

// Road speed — road tiles are faster than paths, incentivising the network.
export const ROAD_SPEED_MULT = 2.4   // on road tile (vs PATH_SPEED_MULT 1.8 on path/trail)

// ── Reveal ─────────────────────────────────────────────────────────────────────
// The world is hidden until the settlement reaches toward it. Reveal grows as
// parcels are claimed and citizens travel.
export const INITIAL_REVEAL  = 9    // tiles revealed around the hearth at world birth
export const PARCEL_REVEAL    = 3    // extra reveal halo around each claimed parcel
export const CITIZEN_REVEAL   = 2    // small halo a moving citizen uncovers

// ── Starting settlement ────────────────────────────────────────────────────────
// Almost too sparse on purpose: a hearth, ONE hut, a few founders, and a single
// foraging ground. The map reveals itself as they expand.
export const START_FOUNDERS = 3
