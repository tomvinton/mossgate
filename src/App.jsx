import { useEffect, useRef, useState } from 'react'

import { foundWorld } from './engine/founding.js'
import { tick } from './engine/sim.js'
import { TICK_MS, TILE_H, TILE_W, CYCLE_TICKS, MIGRATION_CONFIDENCE, PRESSURE } from './engine/config.js'
import { foodDays } from './engine/economy.js'
import { darkness, clockLabel, season } from './engine/time.js'
import { createCamera, updateCamera, updateZoom, panCamera } from './render/camera.js'
import {
  tileToScreen, drawTile, drawBuilding, drawYard, drawHearth, drawStockpile,
  drawCitizen, drawMigrant, drawScaffold,
} from './render/iso.js'
import { saveWorld, loadSave, restoreWorld, clearSave } from './engine/persist.js'
import { dist } from './engine/world.js'

const SPEEDS = [1, 3, 10, 30, 100]
const TW2 = TILE_W / 2
const TH2 = TILE_H / 2

// ── Isometric hit-testing helpers ─────────────────────────────────────────────
// Convert a CSS-pixel click to the pre-zoom screen coords used by tileToScreen.
function clientToPreZoom(clientX, clientY, zoom, W, H) {
  return {
    sx: (clientX - W / 2 * (1 - zoom)) / zoom,
    sy: (clientY - H / 2 * (1 - zoom)) / zoom,
  }
}

function hitTestClick(world, camera, clientX, clientY, W, H) {
  const zoom = camera.zoom
  const { sx: cx, sy: cy } = clientToPreZoom(clientX, clientY, zoom, W, H)

  // Citizens — generous radius.
  let bestC = null, bestCD = 14
  for (const c of world.citizens) {
    const { sx, sy } = tileToScreen(c.x, c.y, camera.x, camera.y, W, H)
    const d = Math.hypot(cx - sx, cy - (sy + TH2 - 9))
    if (d < bestCD) { bestCD = d; bestC = c }
  }
  if (bestC) return { type: 'citizen', entity: bestC }

  // Parcels — check if click is within the parcel's footprint radius.
  let bestP = null, bestPD = Infinity
  for (const p of world.parcels) {
    const { sx, sy } = tileToScreen(p.col, p.row, camera.x, camera.y, W, H)
    const reach = (p.half + 0.5) * TW2          // screen-space approximate radius
    const d = Math.hypot(cx - sx, cy - (sy + TH2))
    if (d < reach && d < bestPD) { bestPD = d; bestP = p }
  }
  if (bestP) return { type: 'parcel', entity: bestP }

  return null
}

// ── Inspector panel ────────────────────────────────────────────────────────────
function Inspector({ hit, world, onClose }) {
  if (!hit) return null
  const { type, entity: e } = hit

  const day = n => `Day ${n}`
  const rows = []

  if (type === 'citizen') {
    const hh = world.households.find(h => h.id === e.householdId)
    const task = e.task ? e.task.charAt(0).toUpperCase() + e.task.slice(1) : '—'
    const stateFmt = e.state.replace(/_/g, ' ')
    rows.push(['Name',      e.name   || '—'])
    rows.push(['Household', hh?.name || '—'])
    rows.push(['Arrived',   day(e.arrivalDay ?? 0)])
    rows.push(['Task',      task])
    rows.push(['State',     stateFmt])
    if (e.carrying) rows.push(['Carrying', `${e.carrying.amt} ${e.carrying.res}`])
  } else if (type === 'parcel') {
    const workerNames = world.citizens
      .filter(c => c.workParcelId === e.id)
      .map(c => c.name || '?')
    rows.push(['Name',    e.name || PARCEL_LABEL[e.type] || e.type])
    rows.push(['Type',    PARCEL_LABEL[e.type] || e.type])
    rows.push(['State',   e.state])
    if (e.jobs > 0) rows.push(['Workers', workerNames.join(', ') || 'none'])
    if (e.state === 'developing') {
      rows.push(['Progress', `${Math.round((e.progress / e.develop) * 100)}%`])
    }
  }

  const history = e.history || []

  return (
    <div style={{
      position: 'fixed', bottom: 18, right: 18, zIndex: 20,
      background: 'rgba(6,12,6,0.82)', border: '1px solid rgba(160,220,120,0.22)',
      borderRadius: 7, padding: '10px 14px', font: '11px/1.6 monospace', color: '#bfe0a0',
      maxWidth: 260, pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: '#e0f0b0', fontWeight: 'bold', textTransform: 'capitalize' }}>
          {type === 'citizen' ? '👤' : '🏡'} {type}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#789', cursor: 'pointer',
          font: '12px monospace', lineHeight: 1, padding: '0 2px',
        }}>✕</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map(([label, val]) => (
            <tr key={label}>
              <td style={{ color: '#789', paddingRight: 8, whiteSpace: 'nowrap' }}>{label}</td>
              <td style={{ color: '#cce0a8' }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {history.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(160,220,120,0.12)', paddingTop: 6 }}>
          <div style={{ color: '#789', marginBottom: 3 }}>History</div>
          {history.slice(-6).map((h, i) => (
            <div key={i} style={{ color: '#9ab880', fontSize: 10, lineHeight: 1.4 }}>
              <span style={{ color: '#567', marginRight: 4 }}>Day {h.day}</span>{h.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const PARCEL_LABEL = {
  hearth: 'Hearth', dwelling: 'Homestead', field: 'Field', forage: 'Foraging Ground',
  woodlot: 'Woodlot', storage: 'Stores', common: 'Village Common',
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef       = useRef(null)
  const worldRef        = useRef(null)
  const cameraRef       = useRef(null)
  const bgRef           = useRef(null)
  const sortedKeysRef   = useRef(null)
  const sortVersionRef  = useRef(-1)       // last revealedVersion we sorted at
  const sortTimeRef     = useRef(0)        // last real-time sort happened
  const dprRef          = useRef(1)
  const speedRef        = useRef(1)
  const dragRef         = useRef(null)
  const speedAccRef     = useRef(0)
  const vignetteRef     = useRef(null)
  const saveStatusRef   = useRef('ok')     // 'ok' | 'saving' | 'failed'

  const [speed,     setSpeed]     = useState(1)
  const [debug,     setDebug]     = useState(false)
  const [selected,  setSelected]  = useState(null)  // { type, entity }
  const debugRef    = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => {
    // ── World: load saved or start fresh ───────────────────────────────────────
    let world
    const saved = loadSave()
    if (saved) {
      try {
        world = restoreWorld(saved)
        console.log('[MossGate] Loaded saved world (day', Math.floor(saved.tick / CYCLE_TICKS), ')')
      } catch (e) {
        console.warn('[MossGate] Restore failed, starting fresh:', e)
        world = foundWorld()
      }
    } else {
      world = foundWorld()
    }
    worldRef.current   = world
    cameraRef.current  = createCamera()

    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const bg     = document.createElement('canvas')
    bgRef.current = bg
    let raf

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      dprRef.current = dpr
      canvas.width  = Math.round(window.innerWidth  * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      worldRef.current.bgDirty = true
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // ── Simulation loop ────────────────────────────────────────────────────────
    const simInterval = setInterval(() => {
      speedAccRef.current += speedRef.current
      let reps = Math.floor(speedAccRef.current)
      speedAccRef.current -= reps
      if (reps > 400) reps = 400
      for (let i = 0; i < reps; i++) tick(worldRef.current)
      updateCamera(cameraRef.current, worldRef.current)

      // Autosave when the sim sets the flag.
      if (worldRef.current._autosaveDue) {
        worldRef.current._autosaveDue = false
        const ok = saveWorld(worldRef.current)
        saveStatusRef.current = ok ? 'ok' : 'failed'
      }
    }, TICK_MS)

    // ── Render loop (24fps cap) ────────────────────────────────────────────────
    const FRAME_MS = 1000 / 24
    let lastFrame  = 0

    function draw(now) {
      if (now - lastFrame < FRAME_MS) { raf = requestAnimationFrame(draw); return }
      lastFrame = now

      const dpr    = dprRef.current
      const W      = canvas.width / dpr
      const H      = canvas.height / dpr
      const world  = worldRef.current
      const camera = cameraRef.current

      updateZoom(camera, W, H)
      const zoom = camera.zoom

      // ── Painter-order list: rebuild only when reveal changes, debounced ──────
      // At 100+ citizens, revealedTiles grows every ~0.3s real time. Without
      // debouncing, this O(n log n) sort would run on every render frame (24/s),
      // causing 1–2s stutter bursts. Instead we rebuild at most ~2/second.
      const rv  = world.revealedVersion || 0
      const now2 = performance.now()
      if (!sortedKeysRef.current ||
          (rv !== sortVersionRef.current && now2 - sortTimeRef.current > 500)) {
        sortedKeysRef.current = [...world.revealedTiles].map(k => {
          const i = k.indexOf(',')
          return { k, col: +k.slice(0, i), row: +k.slice(i + 1) }
        }).sort((a, b) => (a.col + a.row) - (b.col + b.row) || a.col - b.col)
        sortVersionRef.current = rv
        sortTimeRef.current    = now2
      }
      const keys = sortedKeysRef.current

      // ── Static background: terrain + built structures ──────────────────────
      const camMoved =
        Math.abs(camera.x - (bg._cx ?? 1e9)) > 0.4 ||
        Math.abs(camera.y - (bg._cy ?? 1e9)) > 0.4 ||
        Math.abs(camera.zoom - (bg._cz ?? 1e9)) > 0.004
      if (world.bgDirty || camMoved || bg.width !== canvas.width || bg.height !== canvas.height) {
        if (bg.width !== canvas.width || bg.height !== canvas.height) {
          bg.width = canvas.width; bg.height = canvas.height
        }
        const bx = bg.getContext('2d')
        bx.setTransform(dpr, 0, 0, dpr, 0, 0)
        bx.fillStyle = '#0c160a'
        bx.fillRect(0, 0, W, H)
        bx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * W / 2 * (1 - zoom), dpr * H / 2 * (1 - zoom))

        const builtAt = new Map()
        for (const b of world.buildings) if (b.isBuilt) builtAt.set(`${b.col},${b.row}`, b)

        const halfVW = W / (2 * zoom) + 96, halfVH = H / (2 * zoom) + 96
        for (const { k, col, row } of keys) {
          const { sx, sy } = tileToScreen(col, row, camera.x, camera.y, W, H)
          if (Math.abs(sx - W / 2) > halfVW || Math.abs(sy - H / 2) > halfVH) continue
          drawTile(bx, sx, sy, world.tiles.get(k).type)
          const b = builtAt.get(k)
          if (b) { if (b.type === 'hut') drawYard(bx, sx, sy); drawBuilding(bx, sx, sy, b.type) }
        }
        bg._cx = camera.x; bg._cy = camera.y; bg._cz = camera.zoom
        world.bgDirty = false
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.drawImage(bg, 0, 0, W, H)

      // ── Dynamic foreground ────────────────────────────────────────────────────
      const ztx = dpr * zoom, zex = dpr * W / 2 * (1 - zoom), zey = dpr * H / 2 * (1 - zoom)
      ctx.setTransform(ztx, 0, 0, ztx, zex, zey)

      // Construction scaffolds.
      for (const p of world.parcels) {
        if (p.state !== 'developing') continue
        const { sx, sy } = tileToScreen(p.col, p.row, camera.x, camera.y, W, H)
        drawScaffold(ctx, sx, sy, Math.round((p.progress / p.develop) * 100))
      }

      // Selected highlight.
      const sel = selectedRef.current
      if (sel) {
        const e = sel.entity
        const ex = sel.type === 'citizen' ? e.x : e.col
        const ey = sel.type === 'citizen' ? e.y : e.row
        const { sx, sy } = tileToScreen(ex, ey, camera.x, camera.y, W, H)
        ctx.beginPath()
        ctx.ellipse(sx, sy + TH2, 10, 5, 0, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(220,255,160,0.7)'; ctx.lineWidth = 1.5; ctx.stroke()
      }

      // Hearth stockpile + flame.
      const { sx: hx, sy: hy } = tileToScreen(world.hearth.col, world.hearth.row, camera.x, camera.y, W, H)
      drawStockpile(ctx, hx, hy, world.resources.wood, world.resources.food)
      const flicker = Math.sin(world.tick * 0.3) * 1.2 + Math.sin(world.tick * 0.7) * 0.6
      drawHearth(ctx, hx, hy, world.warmth ?? 0.5, flicker)

      // Migrant groups.
      for (const m of world.migrants) {
        const { sx, sy } = tileToScreen(m.x, m.y, camera.x, camera.y, W, H)
        drawMigrant(ctx, sx, sy, m)
      }

      // Citizens, back-to-front.
      const cit = [...world.citizens].sort((a, b) => (a.x + a.y) - (b.x + b.y))
      for (const c of cit) {
        const { sx, sy } = tileToScreen(c.x, c.y, camera.x, camera.y, W, H)
        drawCitizen(ctx, sx, sy, c)
      }

      // ── Lighting & mood ───────────────────────────────────────────────────────
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const dark = darkness(world)
      const glowR = (90 + 60 * (world.warmth ?? 0.5)) * zoom
      const ghx = (hx) * zoom + W / 2 * (1 - zoom)
      const ghy = (hy + TILE_H / 2) * zoom + H / 2 * (1 - zoom)
      const glowA = 0.10 + dark * 0.5
      const glow = ctx.createRadialGradient(ghx, ghy, 0, ghx, ghy, glowR)
      glow.addColorStop(0, `rgba(255,170,70,${glowA})`)
      glow.addColorStop(0.5, `rgba(255,130,40,${glowA * 0.3})`)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'screen'
      ctx.fillStyle = glow
      ctx.fillRect(ghx - glowR, ghy - glowR, glowR * 2, glowR * 2)
      ctx.globalCompositeOperation = 'source-over'

      if (dark > 0) {
        ctx.fillStyle = `rgba(18,28,54,${dark})`
        ctx.fillRect(0, 0, W, H)
      }

      // Vignette (cached).
      const vc   = vignetteRef.current
      const rW   = Math.round(W), rH = Math.round(H)
      if (!vc || vc.width !== rW || vc.height !== rH) {
        const nc = document.createElement('canvas'); nc.width = rW; nc.height = rH
        const vx = nc.getContext('2d')
        const vg = vx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85)
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)')
        vx.fillStyle = vg; vx.fillRect(0, 0, rW, rH)
        vignetteRef.current = nc
      }
      ctx.drawImage(vignetteRef.current, 0, 0)

      // ── Debug overlay ─────────────────────────────────────────────────────────
      if (debugRef.current) {
        const p    = world.pressures, cp = world._confParts || {}
        const gov  = world.governor
        const counts = {}
        for (const par of world.parcels) counts[par.type] = (counts[par.type] || 0) + 1

        const beds         = world.buildings.filter(b => b.type === 'hut' && b.isBuilt).length
        const freeBeds     = Math.max(0, beds - world.households.length)
        const dayN         = Math.floor(world.tick / CYCLE_TICKS)
        const fDays        = foodDays(world)
        const daysSinceP   = ((world.tick - (gov.lastVisibleProjectTick || 0)) / CYCLE_TICKS).toFixed(1)

        // Band eligibility
        const workCount    = world.parcels.filter(q =>
          q.state === 'active' && ['field','forage','woodlot'].includes(q.type)).length
        const storCount    = world.parcels.filter(q => q.type === 'storage' && q.state === 'active').length
        const bandBlockers = []
        if (world.band !== 'village') {
          if (world.citizens.length < 70) bandBlockers.push(`pop ${world.citizens.length}<70`)
          if (dayN < 30)                  bandBlockers.push(`day ${dayN}<30`)
          if (workCount < 3)              bandBlockers.push(`work parcels ${workCount}<3`)
          if (storCount < 1)              bandBlockers.push('need storage')
          if (world.confidence < 0.65)    bandBlockers.push(`conf ${(world.confidence*100).toFixed(0)}%<65%`)
        }
        const stableFor = world.bandStableSince
          ? ((world.tick - world.bandStableSince) / CYCLE_TICKS).toFixed(1)
          : '0'

        // Migration blockers
        const migBlocks = []
        if (world.confidence < MIGRATION_CONFIDENCE) migBlocks.push(`conf ${(world.confidence*100).toFixed(0)}%<${(MIGRATION_CONFIDENCE*100).toFixed(0)}%`)
        const taken = new Set(world.households.map(h => h.homeBuildingId))
        const freeHuts = world.buildings.filter(b => b.type === 'hut' && b.isBuilt && !taken.has(b.id)).length
        if (freeHuts === 0)              migBlocks.push('no free huts')
        if (world.migrants.length > 0)   migBlocks.push('wave in progress')
        const migStatus = migBlocks.length === 0 ? 'open' : `BLOCKED (${migBlocks.join(', ')})`

        const sortRebuildAge = ((now2 - sortTimeRef.current) / 1000).toFixed(1)

        debugRef.current.textContent = [
          `${clockLabel(world)}   day ${dayN}   speed ${speedRef.current}×`,
          ``,
          `── Population ───────────────────────`,
          `citizens ${world.citizens.length}   households ${world.households.length}   migrants ${world.migrants.length}`,
          `huts ${beds}   free beds ${freeBeds}`,
          ``,
          `── Economy ──────────────────────────`,
          `food ${world.resources.food.toFixed(1)}/${world.storageCap.food}   (${fDays.toFixed(1)} days)`,
          `wood ${world.resources.wood.toFixed(1)}/${world.storageCap.wood}`,
          ``,
          `── Confidence & Pressure ────────────`,
          `confidence ${(world.confidence*100).toFixed(0)}%  food ${(cp.food*100||0).toFixed(0)} shelter ${(cp.shelter*100||0).toFixed(0)} warmth ${(cp.warmth*100||0).toFixed(0)} calm ${(cp.calm*100||0).toFixed(0)}`,
          `pressure  food ${(p.food*100).toFixed(0)}/${(PRESSURE.food*100).toFixed(0)}  wood ${(p.wood*100).toFixed(0)}/${(PRESSURE.wood*100).toFixed(0)}  shelter ${(p.shelter*100).toFixed(0)}/${(PRESSURE.shelter*100).toFixed(0)}  road ${(p.road*100).toFixed(0)}/${(PRESSURE.road*100).toFixed(0)}`,
          ``,
          `── Migration ────────────────────────`,
          `status: ${migStatus}`,
          ``,
          `── Governor ─────────────────────────`,
          `action: ${gov.lastAction}`,
          `days since visible project: ${daysSinceP}`,
          `parcels  ${Object.entries(counts).map(([t, n]) => `${t}:${n}`).join('  ')}`,
          ``,
          `── Development Band ─────────────────`,
          `band: ${world.band}${world.band === 'settlement' ? '' : ' ✦'}`,
          world.band === 'village'
            ? 'conditions: met'
            : `stable for: ${stableFor} days  blockers: ${bandBlockers.join(', ') || 'none'}`,
          ``,
          `── Render / Perf ────────────────────`,
          `revealed tiles: ${world.revealedTiles.size}   sort age: ${sortRebuildAge}s`,
          `save: ${saveStatusRef.current}   seed: ${Math.floor(world.seed)}`,
          ``,
          `── Rejected candidates ──────────────`,
          ...(gov.notes && gov.notes.length > 0 ? gov.notes.map(n => `  ${n}`) : ['  (none)']),
        ].join('\n')
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    // ── Input ─────────────────────────────────────────────────────────────────
    let pointerDownAt = null

    const onDown = (e) => {
      canvas.setPointerCapture(e.pointerId)
      dragRef.current  = { id: e.pointerId, x: e.clientX, y: e.clientY }
      pointerDownAt    = { x: e.clientX, y: e.clientY }
    }
    const onMove = (e) => {
      const d = dragRef.current; if (!d || d.id !== e.pointerId) return
      panCamera(cameraRef.current, e.clientX - d.x, e.clientY - d.y)
      d.x = e.clientX; d.y = e.clientY
    }
    const onUp = (e) => {
      if (dragRef.current?.id !== e.pointerId) return
      dragRef.current = null

      // Click = pointer didn't move much.
      if (pointerDownAt) {
        const dx = Math.abs(e.clientX - pointerDownAt.x)
        const dy = Math.abs(e.clientY - pointerDownAt.y)
        if (dx < 5 && dy < 5) {
          const dpr = dprRef.current
          const W   = canvas.width / dpr
          const H   = canvas.height / dpr
          const hit = hitTestClick(worldRef.current, cameraRef.current, e.clientX, e.clientY, W, H)
          selectedRef.current = hit
          setSelected(hit)
        }
        pointerDownAt = null
      }
    }

    const onKey = (e) => {
      if (e.key === 'd' || e.key === 'D') {
        setDebug(v => { debugRef.current && (debugRef.current.style.display = v ? 'none' : 'block'); return !v })
      } else if (e.key === 'n' || e.key === 'N') {
        worldRef.current    = foundWorld()
        sortedKeysRef.current = null
        sortVersionRef.current = -1
        cameraRef.current   = createCamera()
        selectedRef.current = null
        setSelected(null)
        clearSave()
      } else if (e.key === 's' || e.key === 'S') {
        const ok = saveWorld(worldRef.current)
        saveStatusRef.current = ok ? 'ok' : 'failed'
      } else if (e.key >= '1' && e.key <= '5') {
        const s = SPEEDS[+e.key - 1]; speedRef.current = s; setSpeed(s)
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup',   onUp)
    canvas.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf); clearInterval(simInterval); ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup',   onUp)
      canvas.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100vw', height: '100vh', touchAction: 'none', cursor: 'grab' }}
      />

      {/* Debug overlay — D key */}
      <pre
        ref={debugRef}
        style={{
          position: 'fixed', top: 12, left: 12, margin: 0, display: 'none', zIndex: 10,
          font: '11px/1.5 monospace', color: '#bfe0a0', whiteSpace: 'pre',
          background: 'rgba(6,12,6,0.6)', padding: '8px 12px', borderRadius: 6,
          border: '1px solid rgba(160,220,120,0.18)', pointerEvents: 'none',
        }}
      />

      {/* Speed controls — visible only in debug mode */}
      {debug && (
        <div style={{ position: 'fixed', bottom: 14, left: 12, zIndex: 10, display: 'flex', gap: 6 }}>
          {SPEEDS.map(s => (
            <button key={s} onClick={() => { speedRef.current = s; setSpeed(s) }} style={{
              padding: '3px 10px', borderRadius: 4, cursor: 'pointer', font: '11px monospace',
              background: speed === s ? 'rgba(160,220,120,0.2)' : 'rgba(255,255,255,0.05)',
              color:  speed === s ? '#cdeaa8' : '#789',
              border: `1px solid ${speed === s ? 'rgba(160,220,120,0.4)' : 'rgba(255,255,255,0.08)'}`,
            }}>{s}×</button>
          ))}
          <span style={{ font: '10px monospace', color: '#567', alignSelf: 'center', marginLeft: 8 }}>
            D debug · N new world · S save · 1–5 speed · drag to pan · click to inspect
          </span>
        </div>
      )}

      {/* Inspector panel */}
      {selected && (
        <Inspector
          hit={selected}
          world={worldRef.current}
          onClose={() => { setSelected(null); selectedRef.current = null }}
        />
      )}
    </>
  )
}
