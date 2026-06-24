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
import { createWorld }              from './engine/world.js'
import { tick }                     from './engine/tick.js'
import { createCamera, updateCamera, updateZoom, panCamera } from './render/camera.js'
import { getNightProgress, makeStars }           from './engine/daynight.js'
import { sortedTileKeys, tileToScreen, drawTile, drawBox, drawVillager, drawWoodPile, drawFoodSacks } from './render/iso.js'
import { BUILDING_DEFS, TICK_MS }   from './engine/config.js'

export default function App() {
  const canvasRef     = useRef(null)
  const bgCanvasRef   = useRef(null)    // offscreen canvas — tiles + built buildings
  const sortedKeysRef = useRef(null)    // cached sorted tile key array (never changes)
  const dprRef        = useRef(1)
  const worldRef      = useRef(null)
  const cameraRef     = useRef(null)
  const dragRef       = useRef(null)    // { id, x, y, startX, startY, t, moved }
  const starsRef      = useRef(makeStars())
  const speedRef      = useRef(1)
  const [speed, setSpeed]       = useState(1)
  const [cal, setCal]           = useState(false)
  const [selected, setSelected] = useState(null)  // { type, data } snapshot

  useEffect(() => {
    const world  = createWorld()
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
      const reps = speedRef.current
      for (let i = 0; i < reps; i++) tick(worldRef.current)
      updateCamera(cameraRef.current, worldRef.current)
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

      // ── Cached sorted tile keys — computed once, tiles are never added/removed ─
      if (!sortedKeysRef.current) sortedKeysRef.current = sortedTileKeys(world.tiles)
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
        // Cull based on pre-zoom logical coords; widen margin for low zoom values
        const viewPad = Math.max(200, W / Math.min(zoom, 1))

        for (const k of keys) {
          const [col, row] = k.split(',').map(Number)
          const tile = world.tiles.get(k)
          const { sx, sy } = tileToScreen(col, row, camera.x, camera.y, W, H)
          if (sx < -viewPad || sx > W + viewPad || sy < -viewPad || sy > H + viewPad) continue
          drawTile(bgCtx, sx, sy, tile.type)
          const b = builtAt.get(k)
          if (b) {
            const def = BUILDING_DEFS[b.type]?.iso
            if (def) drawBox(bgCtx, sx, sy, def, 100)
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
        if (def) drawBox(ctx, sx, sy, def, b.buildProgress)
      }

      // Resource stockpile at center tile
      const { sx: csx, sy: csy } = tileToScreen(0, 0, camera.x, camera.y, W, H)
      drawWoodPile(ctx, csx, csy, world.resources.wood)
      drawFoodSacks(ctx, csx, csy, world.resources.food)

      // Citizens
      const viewPadC = Math.max(80, 80 / Math.min(zoom, 1))
      const sorted = [...world.citizens].sort((a, b) => (a.x + a.y) - (b.x + b.y))
      for (const v of sorted) {
        const { sx, sy } = tileToScreen(v.x, v.y, camera.x, camera.y, W, H)
        if (sx < -viewPadC || sx > W + viewPadC || sy < -viewPadC || sy > H + viewPadC) continue
        drawVillager(ctx, sx, sy, v)
      }

      // Reset to no-zoom for full-screen overlays
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

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
          const viewPadL = Math.max(100, 100 / Math.min(zoom, 1))
          for (const b of world.buildings) {
            if (!b.isBuilt) continue
            const { sx, sy } = tileToScreen(b.col, b.row, camera.x, camera.y, W, H)
            if (sx < -viewPadL || sx > W + viewPadL || sy < -viewPadL || sy > H + viewPadL) continue
            const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 38)
            glow.addColorStop(0, `rgba(255, 160, 40, ${0.30 * lanternAlpha})`)
            glow.addColorStop(0.4, `rgba(255, 100, 20, ${0.12 * lanternAlpha})`)
            glow.addColorStop(1, 'rgba(255, 80, 10, 0)')
            ctx.fillStyle = glow
            ctx.fillRect(sx - 38, sy - 20, 76, 58)
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
      if (e.key === '1') { speedRef.current = 1;  setSpeed(1)  }
      if (e.key === '2') { speedRef.current = 5;  setSpeed(5)  }
      if (e.key === '3') { speedRef.current = 20; setSpeed(20) }
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
      {/* Speed toggle button — cycles 1×→5×→20×→1× */}
      <button
        onClick={() => {
          const next = speed === 1 ? 5 : speed === 5 ? 20 : 1
          speedRef.current = next
          setSpeed(next)
        }}
        style={{
          position: 'fixed', top: 14, right: 14, zIndex: 10,
          background: speed > 1 ? 'rgba(30,20,0,0.75)' : 'rgba(0,0,0,0.45)',
          color: speed > 1 ? '#ffcc44' : '#888',
          fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold',
          padding: '6px 14px', borderRadius: 6,
          border: speed > 1 ? '1px solid #ffcc4488' : '1px solid #33333388',
          cursor: 'pointer', letterSpacing: 1,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {speed}×
      </button>

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
                const TASK_L  = { forage: 'Foraging', chop: 'Chopping wood', build: 'Building' }
                const STATE_L = {
                  idle: 'Looking for work', going_to_source: 'Heading out',
                  working: 'Working', going_to_storage: 'Returning to stockpile',
                  going_to_build: 'Heading to build site', building: 'Building',
                  going_home: 'Heading home', sleeping: 'Sleeping', arriving: 'Arriving',
                }
                const d = selected.data
                return (
                  <>
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

      <div
        style={{ position: 'fixed', bottom: 0, right: 0, width: 60, height: 60, zIndex: 99 }}
        onClick={() => setCal(v => !v)}
      />
      {cal && <Calibration onClose={() => setCal(false)} />}
    </>
  )
}
