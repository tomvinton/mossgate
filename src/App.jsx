import { useEffect, useRef, useState } from 'react'

// ── Calibration overlay ────────────────────────────────────────────────────────
const FPS_TARGETS = [
  { fps: 60,  color: '#00ff88', label: '60 fps' },
  { fps: 30,  color: '#ffdd00', label: '30 fps' },
  { fps: 24,  color: '#ff8800', label: '24 fps' },
  { fps: 15,  color: '#ff3333', label: '15 fps' },
  { fps: 10,  color: '#cc00ff', label: '10 fps' },
]

function Calibration({ onClose }) {
  const canvasRef = useRef(null)
  const pageRef   = useRef('edge')   // 'edge' | 'fps'
  const [page, setPage] = useState('edge')

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    let   raf

    const dpr = window.devicePixelRatio || 1
    canvas.width  = window.innerWidth  * dpr
    canvas.height = window.innerHeight * dpr
    ctx.scale(dpr, dpr)

    const W = window.innerWidth
    const H = window.innerHeight

    // FPS tracking
    const frameTimes = []

    // Balls for fps test — each moves at its own update rate
    const balls = FPS_TARGETS.map((t, i) => ({
      ...t,
      x:      W * 0.1,
      y:      H * 0.25 + i * (H * 0.12),
      speed:  W * 0.55 / 1000,  // cross track width in 1 second
      dir:    1,
      acc:    0,
      interval: 1000 / t.fps,
    }))
    const trackX  = W * 0.2
    const trackW  = W * 0.6
    const ballR   = H * 0.025

    function drawEdge(now) {
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, W, H)

      // ── Full-edge border — drawn at pixel 0 so 1px hangs outside, 1px inside ──
      // Using lineWidth=4 centered on edge = 2px visible inside
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth   = 4
      ctx.strokeRect(2, 2, W - 4, H - 4)

      // Corner markers — filled squares at exact corners
      const csz = 28
      const corners = [[0,0],[W-csz,0],[0,H-csz],[W-csz,H-csz]]
      for (const [cx, cy] of corners) {
        ctx.fillStyle = '#ffff00'
        ctx.fillRect(cx, cy, csz, csz)
      }

      // Corner labels
      ctx.font         = 'bold 13px monospace'
      ctx.fillStyle    = '#ffff00'
      ctx.textBaseline = 'top'
      ctx.textAlign    = 'left';  ctx.fillText('TOP LEFT',     csz + 6, 8)
      ctx.textAlign    = 'right'; ctx.fillText('TOP RIGHT',    W - csz - 6, 8)
      ctx.textBaseline = 'bottom'
      ctx.textAlign    = 'left';  ctx.fillText('BOTTOM LEFT',  csz + 6, H - 8)
      ctx.textAlign    = 'right'; ctx.fillText('BOTTOM RIGHT', W - csz - 6, H - 8)

      // Center crosshair
      const cx = W / 2, cy = H / 2
      ctx.strokeStyle = '#00ff88'
      ctx.lineWidth   = 1.5
      ctx.beginPath(); ctx.moveTo(cx, cy - 40); ctx.lineTo(cx, cy + 40); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx - 40, cy); ctx.lineTo(cx + 40, cy); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx, cy, 36, 0, Math.PI * 2); ctx.stroke()

      // Color bars — horizontal strip in center
      const colors = ['#f00','#0f0','#00f','#ff0','#0ff','#f0f','#fff','#000']
      const bw = W / colors.length, bh = H * 0.1, by = cy - bh - 60
      colors.forEach((c, i) => {
        ctx.fillStyle = c; ctx.fillRect(i * bw, by, bw, bh)
      })
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1
      colors.forEach((_, i) => ctx.strokeRect(i * bw, by, bw, bh))

      // Grayscale ramp
      const steps = 12, sw = W / steps, sh = H * 0.07, sy = cy + 60
      for (let i = 0; i < steps; i++) {
        const v = Math.round((i / (steps - 1)) * 255)
        ctx.fillStyle = `rgb(${v},${v},${v})`
        ctx.fillRect(i * sw, sy, sw, sh)
      }

      // Info block
      ctx.fillStyle    = 'rgba(0,0,0,0.7)'
      ctx.fillRect(cx - 160, cy - 28, 320, 58)
      ctx.font         = '13px monospace'
      ctx.fillStyle    = '#aaa'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${W} × ${H}  ·  DPR ${dpr}x  ·  ${W*dpr} × ${H*dpr} physical`, cx, cy - 10)
      ctx.fillStyle = '#555'
      ctx.fillText('yellow squares should sit in every corner', cx, cy + 10)
    }

    function drawFps(now) {
      // Track real frame rate
      frameTimes.push(now)
      if (frameTimes.length > 120) frameTimes.shift()
      let measuredFps = 0
      if (frameTimes.length > 10) {
        const span = frameTimes[frameTimes.length - 1] - frameTimes[0]
        measuredFps = ((frameTimes.length - 1) / span) * 1000
      }

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, W, H)

      // Big FPS readout
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'top'
      ctx.font         = `bold ${Math.floor(H * 0.14)}px monospace`
      ctx.fillStyle    = measuredFps > 55 ? '#00ff88' : measuredFps > 28 ? '#ffdd00' : '#ff3333'
      ctx.fillText(`${measuredFps.toFixed(1)}`, W / 2, H * 0.04)
      ctx.font      = `${Math.floor(H * 0.03)}px monospace`
      ctx.fillStyle = '#555'
      ctx.fillText('measured fps', W / 2, H * 0.04 + H * 0.155)

      // Moving balls, each at its own rate
      for (const b of balls) {
        b.acc += now * 0  // just using now directly
        // Update position using real time
        const newX = trackX + ((now * b.speed * b.dir) % trackW + trackW) % trackW

        // Draw track
        ctx.strokeStyle = '#222'
        ctx.lineWidth   = 2
        ctx.beginPath()
        ctx.moveTo(trackX, b.y)
        ctx.lineTo(trackX + trackW, b.y)
        ctx.stroke()

        // Label
        ctx.font         = `bold ${Math.floor(ballR * 1.1)}px monospace`
        ctx.fillStyle    = b.color
        ctx.textAlign    = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(b.label, trackX - 12, b.y)

        // Ball — position based on time, but stepped to simulate the target fps
        const frameN  = Math.floor(now / b.interval)
        const steppedX = trackX + (frameN * b.speed * b.interval) % trackW

        ctx.beginPath()
        ctx.arc(steppedX, b.y, ballR, 0, Math.PI * 2)
        ctx.fillStyle   = b.color
        ctx.shadowColor = b.color
        ctx.shadowBlur  = 12
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Legend
      ctx.font         = `${Math.floor(H * 0.022)}px monospace`
      ctx.fillStyle    = '#444'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText('the smoothest-looking ball matches your display refresh rate', W / 2, H - 16)
    }

    function loop(now) {
      if (pageRef.current === 'edge') drawEdge(now)
      else drawFps(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const btnStyle = (active) => ({
    padding: '8px 22px', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'monospace', fontSize: 13,
    background: active ? '#1a3a1a' : '#1a1a1a',
    color: active ? '#00ff88' : '#666',
    border: `1px solid ${active ? '#00ff88' : '#333'}`,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {/* Controls overlay */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <button style={btnStyle(page === 'edge')} onClick={() => { setPage('edge'); pageRef.current = 'edge' }}>
          Edge test
        </button>
        <button style={btnStyle(page === 'fps')} onClick={() => { setPage('fps'); pageRef.current = 'fps' }}>
          Frame rate
        </button>
        <button style={{ ...btnStyle(false), color: '#888' }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
import { revealAround } from './engine/world.js'
import { buildWorld } from './engine/worldCompositor.js'
import { seedToWorld } from './engine/seed.js'
import { getBuildingIso } from './render/styleResolver.js'
import { tick }                     from './engine/tick.js'
import { createCamera, updateCamera, updateZoom, panCamera } from './render/camera.js'
import { getNightProgress, makeStars }           from './engine/daynight.js'
import { tileToScreen, drawTile, drawBox, drawVillager, drawWoodPile, drawFoodSacks, drawHeart, drawLogPiles } from './render/iso.js'
import { BUILDING_DEFS, TICK_MS, ERA_DEFS, TILE_H, CYCLE_TICKS, DAY_TICKS, NIGHT_TICKS, DUSK_TICKS } from './engine/config.js'
import { fireRandomEvent } from './engine/events.js'

export default function App() {
  const canvasRef     = useRef(null)
  const bgCanvasRef   = useRef(null)    // offscreen canvas — tiles + built buildings
  const sortedKeysRef  = useRef(null)    // revealed tiles sorted for painter's algorithm
  const lastRevealRef  = useRef({ x: null, y: null, zoom: null })
  const fuelBarRef     = useRef(null)    // DOM ref — updated each frame, no re-render
  const eraLabelRef    = useRef(null)
  const resourcesRef   = useRef(null)    // DOM ref — resource counts
  const crisisRef      = useRef(null)    // DOM ref — fuel crisis warning
  const eventsLogRef   = useRef(null)    // DOM ref — scrolling events log
  const flashRef       = useRef(null)    // DOM ref — nuclear meltdown flash overlay
  const dprRef         = useRef(1)
  const worldRef      = useRef(null)
  const cameraRef     = useRef(null)
  const dragRef       = useRef(null)    // { id, x, y, startX, startY, t, moved }
  const starsRef        = useRef(makeStars())
  const speedRef        = useRef(1)
  const speedAccRef     = useRef(0)
  const devKeyTimesRef  = useRef([])
  const fuelTapRef      = useRef({ count: 0, last: 0 })
  const timeLabelRef    = useRef(null)
  const [speed, setSpeed]       = useState(1)
  const [devMenu, setDevMenu]   = useState(false)
  const [cal, setCal]           = useState(false)
  const [selected, setSelected] = useState(null)  // { type, data } snapshot

  // ── Dev menu actions (refs are stable, safe to call from JSX handlers) ────────
  const handleFuelTap = () => {
    const now = Date.now()
    const ft  = fuelTapRef.current
    if (now - ft.last > 1500) ft.count = 0   // reset if too slow
    ft.last = now
    ft.count++
    if (ft.count >= 5) { ft.count = 0; setDevMenu(v => !v) }
  }

  const jumpToEra = (era) => {
    const w = worldRef.current; if (!w) return
    const def = ERA_DEFS[era]
    w.era = era; w.heart.era = era
    w.heart.fuelMax = def.fuelMax; w.heart.fuelTank = def.fuelMax
    w.heart.lightRadius = def.lightRadius; w.collapseTimer = 0; w.bgDirty = true
  }
  const forceEvent    = () => { if (worldRef.current) fireRandomEvent(worldRef.current) }
  const forceCollapse = () => { if (worldRef.current) worldRef.current.collapsed = true }

  useEffect(() => {
    const initSeed = Math.random() * 99999
    const initIds  = seedToWorld(initSeed)
    const world    = buildWorld(initIds.layoutId, initIds.eraId, initIds.cultureId, initIds.biomeId, initSeed)
    worldRef.current  = world
    cameraRef.current = createCamera()

    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    let   raf

    // Offscreen canvas for tiles + built buildings (redrawn only when bgDirty)
    const bgCanvas = document.createElement('canvas')
    bgCanvasRef.current = bgCanvas

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      dprRef.current = dpr
      canvas.width  = Math.round(window.innerWidth  * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      worldRef.current.bgDirty = true   // canvas size changed — rebuild bg
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // ── Simulation loop ───────────────────────────────────────────────────────
    const simInterval = setInterval(() => {
      speedAccRef.current += speedRef.current
      const reps = Math.floor(speedAccRef.current)
      speedAccRef.current -= reps
      for (let i = 0; i < reps; i++) tick(worldRef.current)
      updateCamera(cameraRef.current, worldRef.current)

      // ── Collapse check ─────────────────────────────────────────────────────
      const w = worldRef.current
      if (w.collapsed || w.nuclearCollapse) {
        const wasNuclear = w.nuclearCollapse
        const prevReveal = w.nuclearRevealed || wasNuclear

        if (wasNuclear && flashRef.current) {
          // Nuclear flash: white flare then fade over 2 seconds
          flashRef.current.style.transition = 'none'
          flashRef.current.style.opacity    = '1'
          setTimeout(() => {
            if (flashRef.current) {
              flashRef.current.style.transition = 'opacity 2s ease'
              flashRef.current.style.opacity    = '0'
            }
          }, 200)
        }

        const newSeed = Math.random() * 99999
        const newIds  = seedToWorld(newSeed)
        const newWorld = buildWorld(newIds.layoutId, newIds.eraId, newIds.cultureId, newIds.biomeId, newSeed, { nuclearRevealed: prevReveal })
        worldRef.current  = newWorld
        sortedKeysRef.current = null
        lastRevealRef.current = { x: null, y: null, zoom: null }
        cameraRef.current.x = 0
        cameraRef.current.y = 0
      }
    }, TICK_MS)

    // ── Render loop ───────────────────────────────────────────────────────────
    const FRAME_MS = 1000 / 24   // ~41.7 ms — 24 fps cap
    let lastFrameTime = 0

    function draw(now) {
      // 24 fps cap — skip frame if not enough time has elapsed
      const elapsed = now - lastFrameTime
      if (elapsed < FRAME_MS) { raf = requestAnimationFrame(draw); return }
      lastFrameTime = now - (elapsed % FRAME_MS)

      const dpr    = dprRef.current
      const W      = canvas.width  / dpr
      const H      = canvas.height / dpr
      const world  = worldRef.current
      const camera = cameraRef.current

      // Zoom-to-fit: lerp toward the zoom that keeps all built buildings on screen
      updateZoom(camera, W, H)
      const zoom = camera.zoom

      // ── Viewport-driven tile generation — ensures the world extends beyond view ──
      // Convert camera world-coords to tile-coords (inverse of tileToScreen at center)
      {
        const TW2 = 32, TH2 = 16   // TILE_W/2, TILE_H/2
        const camCol = Math.round((camera.x / TW2 + camera.y / TH2) / 2)
        const camRow = Math.round((camera.y / TH2 - camera.x / TW2) / 2)
        const lr     = lastRevealRef.current
        const moved  = lr.x == null ||
          Math.abs(camCol - lr.x) > 4 ||
          Math.abs(camRow - lr.y) > 4 ||
          Math.abs(zoom  - lr.zoom) > 0.08
        if (moved) {
          // Radius that covers the visible viewport plus a buffer, capped to prevent
          // unbounded tile growth at low zoom (50k+ tiles degrades to near-freeze).
          const viewRadius = Math.min(70, Math.ceil(Math.max(W, H) / (64 * zoom)) + 12)
          revealAround(world, camCol, camRow, viewRadius)
          lr.x = camCol; lr.y = camRow; lr.zoom = zoom
        }
      }

      // ── Sorted revealed tile keys — re-sorted whenever new tiles are revealed ──
      // Pre-parse col/row once here so the draw loop never calls split().map().
      const revCount = world.revealedTiles.size
      if (!sortedKeysRef.current || sortedKeysRef.current.length !== revCount) {
        sortedKeysRef.current = [...world.revealedTiles].map(k => {
          const ci = k.indexOf(',')
          return { k, col: +k.slice(0, ci), row: +k.slice(ci + 1) }
        }).sort((a, b) => {
          const da = a.col + a.row, db = b.col + b.row
          return da !== db ? da - db : a.col - b.col
        })
      }
      const keys = sortedKeysRef.current

      // ── Background canvas — tiles + BUILT buildings ────────────────────────────
      // Invalidated when: bgDirty flag set (building/stump change) OR camera moved
      const bg    = bgCanvasRef.current
      const bgCtx = bg.getContext('2d')
      const camMoved  = Math.abs(camera.x    - (bg._camX  ?? camera.x    + 1)) > 0.5 ||
                        Math.abs(camera.y    - (bg._camY  ?? camera.y    + 1)) > 0.5 ||
                        Math.abs(camera.zoom - (bg._zoom  ?? camera.zoom  + 1)) > 0.005

      if (world.bgDirty || camMoved || bg.width !== canvas.width || bg.height !== canvas.height) {
        // Match physical pixel dimensions
        if (bg.width !== canvas.width || bg.height !== canvas.height) {
          bg.width  = canvas.width
          bg.height = canvas.height
        }

        // Background fill — full canvas, no zoom
        bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        bgCtx.fillStyle = '#1a2a12'
        bgCtx.fillRect(0, 0, W, H)

        // Zoom transform for tile drawing: scale around screen center
        bgCtx.setTransform(
          dpr * zoom, 0, 0, dpr * zoom,
          dpr * W / 2 * (1 - zoom),
          dpr * H / 2 * (1 - zoom)
        )

        const builtAt  = new Map()
        for (const b of world.buildings) if (b.isBuilt) builtAt.set(`${b.col},${b.row}`, b)

        // Zoom-correct viewport culling.
        // tileToScreen returns unzoomed logical coords; the bgCtx applies zoom centered
        // on (W/2, H/2). A tile at logical sx is visible when:
        //   0 ≤ sx*zoom + W/2*(1-zoom) ≤ W  →  W/2 ± W/(2*zoom)
        // We add a small pixel buffer so tiles at the edge aren't clipped.
        const halfVW = W / (2 * zoom) + 96
        const halfVH = H / (2 * zoom) + 96
        const minSX = W / 2 - halfVW, maxSX = W / 2 + halfVW
        const minSY = H / 2 - halfVH, maxSY = H / 2 + halfVH

        for (const { k, col, row } of keys) {
          const tile = world.tiles.get(k)
          const { sx, sy } = tileToScreen(col, row, camera.x, camera.y, W, H)
          if (sx < minSX || sx > maxSX || sy < minSY || sy > maxSY) continue
          drawTile(bgCtx, sx, sy, tile.type)
          const b = builtAt.get(k)
          if (b) {
            const def = BUILDING_DEFS[b.type]?.iso
            if (def) drawBox(bgCtx, sx, sy, getBuildingIso(b.type) ?? def, 100)
          }
        }

        bg._camX = camera.x
        bg._camY = camera.y
        bg._zoom = camera.zoom
        world.bgDirty = false
      }

      // ── Composite frame ────────────────────────────────────────────────────────
      // bg canvas has zoom baked in — draw at 1:1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.drawImage(bg, 0, 0, W, H)

      // Zoom transform for world-space foreground elements
      const zoomTx = dpr * zoom
      const zoomEx = dpr * W / 2 * (1 - zoom)
      const zoomEy = dpr * H / 2 * (1 - zoom)
      ctx.setTransform(zoomTx, 0, 0, zoomTx, zoomEx, zoomEy)

      // Under-construction buildings — dynamic (animated progress bar)
      const underConstruction = world.buildings
        .filter(b => !b.isBuilt)
        .sort((a, b) => (a.col + a.row) - (b.col + b.row))
      for (const b of underConstruction) {
        const { sx, sy } = tileToScreen(b.col, b.row, camera.x, camera.y, W, H)
        const def = BUILDING_DEFS[b.type]?.iso
        if (def) drawBox(ctx, sx, sy, getBuildingIso(b.type) ?? def, b.buildProgress)
      }

      // Resource stockpile at center tile (offset left; heart occupies center)
      const { sx: csx, sy: csy } = tileToScreen(0, 0, camera.x, camera.y, W, H)
      drawWoodPile(ctx, csx, csy, world.resources.wood)
      drawFoodSacks(ctx, csx, csy, world.resources.food)

      // Heart — campfire (Era 1) drawn on top of the nuclear ruin tile
      const fuelFrac = world.heart.fuelTank / world.heart.fuelMax
      drawHeart(ctx, csx, csy, world.heart.era, fuelFrac)

      // Log piles scattered from felled trees
      drawLogPiles(ctx, world, camera.x, camera.y, W, H)

      // Citizens — zoom-correct culling
      const cHW = W / (2 * zoom) + 80, cHH = H / (2 * zoom) + 80
      const sorted = [...world.citizens].sort((a, b) => (a.x + a.y) - (b.x + b.y))
      for (const v of sorted) {
        const { sx, sy } = tileToScreen(v.x, v.y, camera.x, camera.y, W, H)
        if (sx < W/2 - cHW || sx > W/2 + cHW || sy < H/2 - cHH || sy > H/2 + cHH) continue
        drawVillager(ctx, sx, sy, v)
      }

      // Reset to no-zoom for full-screen overlays
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // ── Light radius — radial darkness from heart outward ──────────────────────
      // Heart tile (0,0) screen position after zoom transform
      const hsx = csx * zoom + W / 2 * (1 - zoom)
      const hsy = (csy + TILE_H / 2) * zoom + H / 2 * (1 - zoom)
      const lightPx = world.heart.lightRadius * 32 * zoom

      // Era light color tint — warm glow inside lit radius
      const [lr, lg, lb] = ERA_DEFS[world.heart.era].lightColor
      const tint = ctx.createRadialGradient(hsx, hsy, 0, hsx, hsy, lightPx * 0.9)
      tint.addColorStop(0,   `rgba(${lr},${lg},${lb},0.20)`)
      tint.addColorStop(0.5, `rgba(${lr},${lg},${lb},0.06)`)
      tint.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.fillStyle = tint
      ctx.fillRect(0, 0, W, H)

      // Outer darkness — tiles beyond light radius fade to black
      const dark = ctx.createRadialGradient(hsx, hsy, lightPx * 0.55, hsx, hsy, lightPx * 1.35)
      dark.addColorStop(0, 'rgba(0,0,0,0)')
      dark.addColorStop(0.6, 'rgba(0,0,0,0.15)')
      dark.addColorStop(1,   'rgba(0,0,0,0.96)')
      ctx.fillStyle = dark
      ctx.fillRect(0, 0, W, H)

      // HUD update — direct DOM, no React re-render
      if (fuelBarRef.current) {
        const pct = Math.round(fuelFrac * 100)
        fuelBarRef.current.style.width = `${pct}%`
        fuelBarRef.current.style.background = pct > 60 ? '#ff9930' : pct > 30 ? '#ffcc44' : '#ff4444'
      }
      if (eraLabelRef.current) eraLabelRef.current.textContent = ERA_DEFS[world.heart.era].name
      if (timeLabelRef.current) {
        const cp  = ((world.tick % CYCLE_TICKS) + CYCLE_TICKS) % CYCLE_TICKS
        const day = (world.day || 0) + 1
        const phase = cp < DAY_TICKS - DUSK_TICKS ? 'Day'
                    : cp < DAY_TICKS              ? 'Dusk'
                    : cp < DAY_TICKS + NIGHT_TICKS - DUSK_TICKS ? 'Night'
                    : 'Dawn'
        timeLabelRef.current.textContent = `Day ${day} · ${phase}`
      }
      if (resourcesRef.current) {
        const r    = world.resources
        const era  = world.era
        const f    = v => Math.floor(v || 0)
        const lines = [`🍎 ${f(r.food)}  🪵 ${f(r.wood)}  🪨 ${f(r.stone)}`]
        if (era >= 2)  lines.push(`📦 ${f(r.planks)} planks  🧱 ${f(r.cut_stone)} stone`)
        if (era >= 3)  lines.push(`🪨 ${f(r.coal)} coal  🔩 ${f(r.iron_ore)} ore  ⚙️ ${f(r.iron)} iron`)
        if (era >= 4)  lines.push(`🔧 ${f(r.steel)} steel`)
        if (era >= 5)  lines.push(`☢️ ${f(r.uranium)} uranium`)
        resourcesRef.current.textContent = lines.join('\n')
        resourcesRef.current.style.whiteSpace = 'pre'
      }
      // Events log — show last 5 events, newest on top
      if (eventsLogRef.current && world.events.length > 0) {
        eventsLogRef.current.innerHTML = world.events.slice(0, 5).map((e, i) => {
          const alpha = 1 - i * 0.18
          return `<div style="color:rgba(210,190,155,${alpha});font-size:11px;line-height:1.55;text-shadow:0 1px 3px rgba(0,0,0,0.9)">${e.msg}</div>`
        }).join('')
      }

      if (crisisRef.current) {
        const timer = world.collapseTimer || 0
        if (timer > 0) {
          const pct   = Math.round((timer / 600) * 100)
          const label = world.era === 5 ? `☢️ MELTDOWN ${pct}%` : `💀 COLLAPSE ${pct}%`
          crisisRef.current.textContent = label
          crisisRef.current.style.display = 'block'
          crisisRef.current.style.color   = world.era === 5 ? '#80ff60' : '#ff4444'
          crisisRef.current.style.opacity = (world.tick % 30 < 15) ? '1' : '0.4'
        } else {
          crisisRef.current.style.display = 'none'
        }
      }

      // ── Day / night ────────────────────────────────────────────────────────────
      const night = getNightProgress(world.tick)
      if (night > 0) {
        // Warm horizon glow — only during dusk and dawn transitions, not full night
        // night rises during dusk (0→1) and falls during dawn (1→0);
        // we want glow to peak at the middle of each transition.
        // Derive that from the raw tick position within the cycle.
        const warmPeak = night > 0 && night < 1 ? Math.sin(night * Math.PI) : 0
        if (warmPeak > 0) {
          const wg = ctx.createLinearGradient(0, H * 0.35, 0, H)
          wg.addColorStop(0, `rgba(220, 90, 30, 0)`)
          wg.addColorStop(1, `rgba(220, 60, 10, ${warmPeak * 0.28})`)
          ctx.fillStyle = wg
          ctx.fillRect(0, 0, W, H)
        }

        // Dark blue night overlay
        ctx.fillStyle = `rgba(8, 12, 45, ${night * 0.70})`
        ctx.fillRect(0, 0, W, H)

        // Stars — drawn after overlay so they shine through
        if (night > 0.15) {
          const starAlpha = Math.min(1, (night - 0.15) / 0.25)
          const now = performance.now()
          ctx.save()
          for (const s of starsRef.current) {
            const twinkle = 0.5 + 0.5 * Math.sin(now * 0.0008 + s.twinkle * 6)
            const a = starAlpha * (0.4 + 0.6 * twinkle)
            ctx.beginPath()
            ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(220, 230, 255, ${a})`
            ctx.fill()
          }
          ctx.restore()
        }

        // Lantern glows — world-space positions, need zoom transform
        if (night > 0.25) {
          const lanternAlpha = Math.min(1, (night - 0.25) / 0.3)
          ctx.save()
          ctx.setTransform(zoomTx, 0, 0, zoomTx, zoomEx, zoomEy)
          ctx.globalCompositeOperation = 'screen'
          const lHW = W / (2 * zoom) + 100, lHH = H / (2 * zoom) + 100
          for (const b of world.buildings) {
            if (!b.isBuilt) continue
            const { sx, sy } = tileToScreen(b.col, b.row, camera.x, camera.y, W, H)
            if (sx < W/2 - lHW || sx > W/2 + lHW || sy < H/2 - lHH || sy > H/2 + lHH) continue
            const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 38)
            glow.addColorStop(0, `rgba(255, 160, 40, ${0.30 * lanternAlpha})`)
            glow.addColorStop(0.4, `rgba(255, 100, 20, ${0.12 * lanternAlpha})`)
            glow.addColorStop(1, 'rgba(255, 80, 10, 0)')
            ctx.fillStyle = glow
            ctx.fillRect(sx - 38, sy - 20, 76, 58)
          }

          // Heart glow — larger, warmer than building lanterns; scales with fuel
          {
            const { sx: hgx, sy: hgy } = tileToScreen(0, 0, camera.x, camera.y, W, H)
            const [er, eg, eb] = ERA_DEFS[world.heart.era].lightColor
            const heartR = (55 + 35 * fuelFrac) * lanternAlpha
            const hg = ctx.createRadialGradient(hgx, hgy, 0, hgx, hgy, heartR)
            hg.addColorStop(0,   `rgba(${er},${eg},${eb},${0.65 * lanternAlpha * fuelFrac})`)
            hg.addColorStop(0.45, `rgba(${er},${eg},${eb},${0.25 * lanternAlpha * fuelFrac})`)
            hg.addColorStop(1,   'rgba(0,0,0,0)')
            ctx.fillStyle = hg
            ctx.fillRect(hgx - heartR, hgy - heartR, heartR * 2, heartR * 2)
          }
          ctx.restore()
        }
      }

      // Vignette — full-screen, no zoom
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const vg = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.85)
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(0,0,0,0.55)')
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, W, H)

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    // ── Tap → inspect entity ──────────────────────────────────────────────────
    function handleTap(clientX, clientY) {
      const dpr    = dprRef.current
      const W      = canvas.width  / dpr
      const H      = canvas.height / dpr
      const camera = cameraRef.current
      const world  = worldRef.current
      const TW2 = 32, TH2 = 16
      const zoom = camera.zoom || 1

      // Inverse isometric transform accounting for zoom:
      // Forward: sx = ((col-row)*TW2 - camX) * zoom + W/2
      // Inverse: (col-row) = ((screenX - W/2) / zoom + camX) / TW2
      const a    = ((clientX - W / 2) / zoom + camera.x) / TW2   // col - row
      const b    = ((clientY - H / 2) / zoom + camera.y) / TH2   // col + row
      const wCol = (a + b) / 2
      const wRow = (b - a) / 2

      // Buildings checked FIRST — they're stationary so prioritise them at close range
      let bestB = null, bestBD = 0.85
      for (const bldg of world.buildings) {
        const d = Math.hypot(bldg.col - wCol, bldg.row - wRow)
        if (d < bestBD) { bestBD = d; bestB = bldg }
      }
      if (bestB) {
        const res  = (bestB.residents || []).length
        const work = (bestB.workerIds || []).length
        setSelected({ type: 'building', data: { ...bestB, _res: res, _work: work } })
        return
      }

      // Then citizens within ~1.8 tiles
      let bestC = null, bestD = 1.8
      for (const c of world.citizens) {
        const d = Math.hypot(c.x - wCol, c.y - wRow)
        if (d < bestD) { bestD = d; bestC = c }
      }
      if (bestC) {
        setSelected({ type: 'citizen', data: { ...bestC } })
        return
      }

      setSelected(null)
    }

    // ── Pointer events (unified mouse + touch, reliable tap detection) ───────────
    // Uses PointerEvents API: one handler for mouse, pen, and touch.
    // setPointerCapture keeps events routed to canvas even if finger drifts off.

    const onPointerDown = (e) => {
      if (dragRef.current) return  // ignore extra fingers
      canvas.setPointerCapture(e.pointerId)
      dragRef.current = {
        id: e.pointerId,
        x: e.clientX, y: e.clientY,
        startX: e.clientX, startY: e.clientY,
        t: Date.now(), moved: false,
      }
    }

    const onPointerMove = (e) => {
      const d = dragRef.current
      if (!d || d.id !== e.pointerId) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 14) d.moved = true
      if (d.moved) panCamera(cameraRef.current, dx, dy)
      d.x = e.clientX
      d.y = e.clientY
    }

    const onPointerUp = (e) => {
      const d = dragRef.current
      if (!d || d.id !== e.pointerId) return
      // Tap: small movement AND fast enough
      if (!d.moved && (Date.now() - d.t) < 500) handleTap(d.startX, d.startY)
      dragRef.current = null
    }

    const onKey = (e) => {
      if (e.key === 'c' || e.key === 'C') setCal(v => !v)
      // Triple-D within 1.5 seconds opens dev menu
      if (e.key === 'd' || e.key === 'D') {
        const now = Date.now()
        devKeyTimesRef.current.push(now)
        devKeyTimesRef.current = devKeyTimesRef.current.filter(t => now - t < 1500)
        if (devKeyTimesRef.current.length >= 3) {
          devKeyTimesRef.current = []
          setDevMenu(v => !v)
        }
      }
    }

    canvas.addEventListener('pointerdown',   onPointerDown)
    canvas.addEventListener('pointermove',   onPointerMove)
    canvas.addEventListener('pointerup',     onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('keydown',       onKey)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(simInterval)
      ro.disconnect()
      canvas.removeEventListener('pointerdown',   onPointerDown)
      canvas.removeEventListener('pointermove',   onPointerMove)
      canvas.removeEventListener('pointerup',     onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown',    onKey)
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100vw', height: '100vh', touchAction: 'none', cursor: 'grab' }}
      />

      {/* Nuclear meltdown flash overlay */}
      <div ref={flashRef} style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(80,255,60,0.85)',
        pointerEvents: 'none',
        opacity: 0,
      }} />
      {/* Era + Fuel HUD — top-left, DOM-ref updated each frame (no re-render) */}
      <div style={{
        position: 'fixed', top: 14, left: 14, zIndex: 10,
        background: 'rgba(0,0,0,0.55)', borderRadius: 8,
        padding: '8px 12px', fontFamily: 'monospace',
        minWidth: 140, backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,200,80,0.18)',
      }}>
        <div ref={eraLabelRef} style={{ color: '#ffcc44', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 }}>
          Tribal
        </div>
        <div ref={timeLabelRef} style={{ color: '#886644', fontSize: 10, marginBottom: 5, marginTop: 1 }}>
          Day 1 · Day
        </div>
        {/* Fuel bar — tap 5× to open dev menu */}
        <div onClick={handleFuelTap} style={{ cursor: 'default', userSelect: 'none' }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>FUEL</div>
          <div style={{ background: '#111', borderRadius: 3, height: 6, overflow: 'hidden' }}>
            <div ref={fuelBarRef} style={{ width: '100%', height: '100%', background: '#ff9930', transition: 'width 0.3s, background 0.3s' }} />
          </div>
        </div>
        {/* Resource counts */}
        <div ref={resourcesRef} style={{ marginTop: 8, fontSize: 11, color: '#aaa', letterSpacing: 0.5 }}>
          🍎 0  🪵 0  🪨 0
        </div>
        {/* Fuel crisis warning — hidden by default, shown by crisisRef update */}
        <div ref={crisisRef} style={{
          display: 'none', marginTop: 6,
          fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
          color: '#ff4444',
        }} />
      </div>

      {/* Events log — bottom-left, last 5 events, DOM-ref updated each frame */}
      <div
        ref={eventsLogRef}
        style={{
          position: 'fixed', bottom: 18, left: 14, zIndex: 10,
          maxWidth: 290, pointerEvents: 'none',
          fontFamily: 'monospace',
        }}
      />

      {/* Info panel — shown when a citizen or building is tapped */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
            background: 'rgba(8,12,24,0.92)',
            borderTop: '1px solid rgba(255,255,255,0.10)',
            padding: '16px 20px 24px',
            fontFamily: 'monospace', color: '#ccc', fontSize: 13,
            backdropFilter: 'blur(6px)',
          }}
        >
          {selected.type === 'citizen' ? (
            <>
              <div style={{ color: '#ffcc44', fontWeight: 'bold', marginBottom: 8, fontSize: 15 }}>👤 Worker</div>
              {(() => {
                const TASK_L  = {
                  forage: 'Foraging', chop: 'Chopping wood', quarry: 'Quarrying stone', build: 'Building',
                  mine_coal: 'Mining coal', mine_iron: 'Mining iron', mine_uranium: 'Mining uranium',
                  decontaminate: 'Decontaminating', guard: 'Patrolling',
                }
                const STATE_L = {
                  idle: 'Looking for work', going_to_source: 'Heading out',
                  working: 'Working', going_to_storage: 'Returning to stockpile',
                  going_to_build: 'Heading to build site', building: 'Building',
                  going_home: 'Heading home', sleeping: 'Sleeping', arriving: 'Arriving',
                  guard_patrol: 'On patrol', guard_rest: 'Resting (off duty)',
                }
                const d = selected.data
                return (
                  <>
                    <div>Role: <span style={{ color: '#aef' }}>{d.role === 'guard' ? '⚔️ Guard' : '👷 Worker'}</span></div>
                    <div>Task: <span style={{ color: '#aef' }}>{d.task ? (TASK_L[d.task] || d.task) : 'Idle'}</span></div>
                    <div>Status: <span style={{ color: '#aef' }}>{STATE_L[d.state] || d.state.replace(/_/g, ' ')}</span></div>
                    <div>Home: <span style={{ color: '#aef' }}>{d.homeId != null ? `House #${d.homeId}` : 'Homeless'}</span></div>
                    {d.carrying && <div>Carrying: <span style={{ color: '#aef' }}>{d.carrying.amount} {d.carrying.resource}</span></div>}
                  </>
                )
              })()}
            </>
          ) : (
            <>
              <div style={{ color: '#ffcc44', fontWeight: 'bold', marginBottom: 8, fontSize: 15 }}>
                🏠 {(BUILDING_DEFS[selected.data.type]?.label || selected.data.type)}
              </div>
              <div>Status: <span style={{ color: '#aef' }}>{selected.data.isBuilt ? 'Built' : `Building… ${selected.data.buildProgress}%`}</span></div>
              {selected.data._res > 0 && <div>Residents: <span style={{ color: '#aef' }}>{selected.data._res}</span></div>}
              {selected.data._work > 0 && <div>Workers: <span style={{ color: '#aef' }}>{selected.data._work}</span></div>}
              <div>Location: <span style={{ color: '#aef' }}>({selected.data.col}, {selected.data.row})</span></div>
            </>
          )}
          <div style={{ marginTop: 10, color: '#555', fontSize: 11 }}>tap to dismiss</div>
        </div>
      )}

      {/* Dev menu — opened by pressing D three times within 1.5 seconds */}
      {devMenu && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 200, background: 'rgba(8,12,20,0.96)', borderRadius: 10,
          padding: '20px 24px', fontFamily: 'monospace', color: '#aaa', fontSize: 13,
          border: '1px solid rgba(255,200,80,0.2)', minWidth: 300,
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ color: '#ffcc44', fontWeight: 'bold', fontSize: 14, marginBottom: 16, letterSpacing: 2 }}>
            ⚙️ DEV MENU
          </div>

          {/* Speed */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: '#555', fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>SPEED</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[0.25, 0.5, 1, 2, 5, 20].map(s => (
                <button key={s} onClick={() => { speedRef.current = s; setSpeed(s) }} style={{
                  padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: 12,
                  background: speed === s ? 'rgba(255,200,80,0.18)' : 'rgba(255,255,255,0.05)',
                  color: speed === s ? '#ffcc44' : '#777',
                  border: `1px solid ${speed === s ? 'rgba(255,200,80,0.45)' : 'rgba(255,255,255,0.08)'}`,
                }}>{s}×</button>
              ))}
            </div>
          </div>

          {/* Jump to era */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: '#555', fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>JUMP TO ERA</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1,2,3,4,5,6].map(e => (
                <button key={e} onClick={() => jumpToEra(e)} style={{
                  padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: 12,
                  background: 'rgba(255,255,255,0.05)', color: '#888',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>Era {e}</button>
              ))}
            </div>
          </div>

          {/* Force actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={forceEvent} style={{
              padding: '5px 14px', borderRadius: 4, cursor: 'pointer',
              fontFamily: 'monospace', fontSize: 12,
              background: 'rgba(80,200,100,0.12)', color: '#80cc80',
              border: '1px solid rgba(80,200,100,0.28)',
            }}>Force Event</button>
            <button onClick={forceCollapse} style={{
              padding: '5px 14px', borderRadius: 4, cursor: 'pointer',
              fontFamily: 'monospace', fontSize: 12,
              background: 'rgba(255,60,40,0.12)', color: '#ff8060',
              border: '1px solid rgba(255,60,40,0.28)',
            }}>Force Collapse</button>
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#383838', fontSize: 10 }}>D × 3 or fuel × 5 to toggle</div>
            <button onClick={() => setDevMenu(false)} style={{
              padding: '4px 14px', borderRadius: 4, cursor: 'pointer',
              fontFamily: 'monospace', fontSize: 12,
              background: 'rgba(255,255,255,0.06)', color: '#666',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>Close</button>
          </div>
        </div>
      )}

      <div
        style={{ position: 'fixed', bottom: 0, right: 0, width: 60, height: 60, zIndex: 99 }}
        onClick={() => setCal(v => !v)}
      />
      {cal && <Calibration onClose={() => setCal(false)} />}
    </>
  )
}
