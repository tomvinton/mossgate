// ── MossGate — Isometric renderer ──────────────────────────────────────────────
// Pure drawing helpers. The world communicates its state through terrain and people,
// so these functions aim for cozy, readable diorama visuals — not UI. Colours come
// from config so terrain stays consistent with the simulation's notion of each tile.

import { TILE_W, TILE_H, UNIT_H, GROUND } from '../engine/config.js'

const TW2 = TILE_W / 2
const TH2 = TILE_H / 2

// ── Coordinate transform ───────────────────────────────────────────────────────
export function tileToScreen(col, row, camX, camY, canvasW, canvasH) {
  return {
    sx: (col - row) * TW2 - camX + canvasW / 2,
    sy: (col + row) * TH2 - camY + canvasH / 2,
  }
}

function diamondPath(ctx, sx, sy) {
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx, sy + TILE_H)
  ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath()
}

function diamond(ctx, sx, sy, color, edge = 'rgba(0,0,0,0.13)') {
  diamondPath(ctx, sx, sy)
  ctx.fillStyle = color
  ctx.fill()
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 0.5; ctx.stroke() }
}

// ── Tile dispatch ──────────────────────────────────────────────────────────────
export function drawTile(ctx, sx, sy, type) {
  switch (type) {
    case 'forest':  return drawForest(ctx, sx, sy)
    case 'stump':   return drawStump(ctx, sx, sy)
    case 'field':   return drawField(ctx, sx, sy)
    case 'meadow':  return drawMeadow(ctx, sx, sy)
    case 'cleared': return drawCleared(ctx, sx, sy)
    case 'trail':   return drawTrail(ctx, sx, sy)
    case 'path':    return drawPath(ctx, sx, sy)
    case 'road':    return drawRoad(ctx, sx, sy)
    case 'common':  return drawCommon(ctx, sx, sy)
    case 'water':   return drawWater(ctx, sx, sy)
    case 'rock':    return drawRock(ctx, sx, sy)
    case 'hearth':  return diamond(ctx, sx, sy, GROUND.hearth)
    default:        return diamond(ctx, sx, sy, GROUND[type] || GROUND.grass)
  }
}

function drawCleared(ctx, sx, sy) {
  diamond(ctx, sx, sy, GROUND.cleared, 'rgba(0,0,0,0.18)')
  // A few trodden specks so bare earth doesn't read as flat.
  ctx.fillStyle = 'rgba(0,0,0,0.10)'
  for (const [ox, oy] of [[-6, TH2 - 2], [5, TH2 + 1], [0, TH2 - 5]])
    ctx.fillRect(sx + ox, sy + oy, 2, 1.4)
}

function drawMeadow(ctx, sx, sy) {
  diamond(ctx, sx, sy, GROUND.meadow, 'rgba(0,0,0,0.12)')
  // Tufts of wild grass + a couple of berry dots — a tended foraging ground.
  ctx.strokeStyle = 'rgba(120,160,80,0.5)'
  ctx.lineWidth = 1
  for (const [ox, oy] of [[-10, TH2 + 2], [-2, TH2 - 3], [8, TH2 + 3], [3, TH2 + 6]]) {
    ctx.beginPath(); ctx.moveTo(sx + ox, sy + oy); ctx.lineTo(sx + ox, sy + oy - 4); ctx.stroke()
  }
  ctx.fillStyle = 'rgba(200,80,90,0.7)'
  for (const [ox, oy] of [[-6, TH2], [9, TH2 - 1]]) {
    ctx.beginPath(); ctx.arc(sx + ox, sy + oy, 1.2, 0, Math.PI * 2); ctx.fill()
  }
}

function drawField(ctx, sx, sy) {
  diamond(ctx, sx, sy, GROUND.field, 'rgba(0,0,0,0.2)')
  ctx.save(); diamondPath(ctx, sx, sy); ctx.clip()
  // Tilled crop rows.
  ctx.strokeStyle = 'rgba(90,140,50,0.55)'
  ctx.lineWidth = 1.1
  for (let i = 2; i < TILE_H; i += 4) {
    ctx.beginPath(); ctx.moveTo(sx - TW2 - 4, sy + i); ctx.lineTo(sx + TW2 + 4, sy + i); ctx.stroke()
  }
  ctx.restore()
}

function drawTrail(ctx, sx, sy) {
  // A faint desire path — barely wider than a footstep. Shows footfall before the
  // governor commits to a real path; subtler than path, lighter than cleared ground.
  diamond(ctx, sx, sy, GROUND.trail, 'rgba(0,0,0,0.10)')
  ctx.fillStyle = 'rgba(0,0,0,0.07)'
  for (const [ox, oy] of [[-3, TH2 + 1], [3, TH2 - 2]])
    ctx.beginPath(), ctx.ellipse(sx + ox, sy + oy, 1.6, 0.8, 0, 0, Math.PI * 2), ctx.fill()
}

function drawPath(ctx, sx, sy) {
  diamond(ctx, sx, sy, GROUND.path, 'rgba(0,0,0,0.15)')
  ctx.fillStyle = 'rgba(0,0,0,0.10)'
  for (const [ox, oy] of [[-4, TH2], [4, TH2 - 2], [0, TH2 + 3]])
    ctx.beginPath(), ctx.ellipse(sx + ox, sy + oy, 2.2, 1.1, 0, 0, Math.PI * 2), ctx.fill()
}

function drawRoad(ctx, sx, sy) {
  // An upgraded road: wider, lighter, with a subtle central line suggesting paving.
  diamond(ctx, sx, sy, GROUND.road, 'rgba(0,0,0,0.10)')
  ctx.save(); diamondPath(ctx, sx, sy); ctx.clip()
  ctx.strokeStyle = 'rgba(180,150,90,0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(sx - TW2, sy + TH2); ctx.lineTo(sx + TW2, sy + TH2); ctx.stroke()
  ctx.restore()
}

function drawCommon(ctx, sx, sy) {
  // Village green / common: compacted earth with a small central marker.
  diamond(ctx, sx, sy, GROUND.common, 'rgba(0,0,0,0.16)')
  // Central marker: a simple ring of stones.
  ctx.strokeStyle = 'rgba(80,60,30,0.55)'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.ellipse(sx, sy + TH2, 5, 2.8, 0, 0, Math.PI * 2); ctx.stroke()
  // Bench / stone dots.
  ctx.fillStyle = '#7a6a4a'
  for (const [ox, oy] of [[-7, TH2 - 2], [7, TH2 - 1], [0, TH2 + 4]]) {
    ctx.beginPath(); ctx.ellipse(sx + ox, sy + oy, 2.2, 1.1, 0, 0, Math.PI * 2); ctx.fill()
  }
}

function drawWater(ctx, sx, sy) {
  diamond(ctx, sx, sy, GROUND.water, 'rgba(0,0,0,0.12)')
  ctx.save(); diamondPath(ctx, sx, sy); ctx.clip()
  ctx.strokeStyle = 'rgba(130,200,255,0.22)'
  ctx.lineWidth = 1.1
  for (let i = 6; i < TILE_H; i += 8) {
    ctx.beginPath(); ctx.moveTo(sx - TW2 - 4, sy + i); ctx.lineTo(sx + TW2 + 4, sy + i); ctx.stroke()
  }
  ctx.restore()
}

function drawRock(ctx, sx, sy) {
  diamond(ctx, sx, sy, GROUND.rock, 'rgba(0,0,0,0.2)')
  for (const [ox, oy, rx, ry] of [[-6, TH2 - 3, 6, 4], [5, TH2 - 1, 5, 3], [-1, TH2 + 2, 4, 2.4]]) {
    ctx.beginPath(); ctx.ellipse(sx + ox, sy + oy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#8a887a'; ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6; ctx.stroke()
  }
}

function drawStump(ctx, sx, sy) {
  diamond(ctx, sx, sy, GROUND.stump, 'rgba(0,0,0,0.2)')
  ctx.beginPath(); ctx.ellipse(sx, sy + TH2 - 2, 5, 3, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#7a5830'; ctx.fill()
  ctx.strokeStyle = '#5a3810'; ctx.lineWidth = 0.8; ctx.stroke()
}

function drawForest(ctx, sx, sy) {
  diamond(ctx, sx, sy, GROUND.forest, 'rgba(0,0,0,0.18)')
  const tx = sx, ty = sy - 12
  ctx.beginPath(); ctx.ellipse(tx, sy + TH2, TW2 * 0.5, TH2 * 0.42, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fill()
  for (const l of [
    { oy: 6, rx: 15, ry: 9, c: '#1e4010' },
    { oy: -1, rx: 12, ry: 8, c: '#265218' },
    { oy: -8, rx: 9, ry: 6, c: '#2e6020' },
    { oy: -14, rx: 5, ry: 4, c: '#366828' },
  ]) {
    ctx.beginPath(); ctx.ellipse(tx, ty + l.oy, l.rx, l.ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = l.c; ctx.fill()
  }
}

// ── Buildings (huts, granary) ──────────────────────────────────────────────────
export const BUILDING_ISO = {
  hut:     { top: '#caa06a', left: '#8a6038', right: '#6f4a28', h: 1.25, roof: '#7a4a2a' },
  granary: { top: '#d8c25e', left: '#a08a34', right: '#857018', h: 1.7 },
}

export function drawBuilding(ctx, sx, sy, type) {
  const def = BUILDING_ISO[type] || BUILDING_ISO.hut
  drawBox(ctx, sx, sy, def)
  if (type === 'hut') drawHutRoof(ctx, sx, sy, def)
}

export function drawBox(ctx, sx, sy, def, progress = 100) {
  const bh = def.h * UNIT_H * (progress / 100)
  const top = sy - bh
  if (progress < 100) ctx.globalAlpha = 0.45 + 0.55 * (progress / 100)

  diamondPath(ctx, sx, top); ctx.fillStyle = def.top; ctx.fill()        // top

  ctx.beginPath()                                                        // left
  ctx.moveTo(sx - TW2, top + TH2); ctx.lineTo(sx, top + TILE_H)
  ctx.lineTo(sx, sy + TILE_H); ctx.lineTo(sx - TW2, sy + TH2); ctx.closePath()
  ctx.fillStyle = def.left; ctx.fill()

  ctx.beginPath()                                                        // right
  ctx.moveTo(sx, top + TILE_H); ctx.lineTo(sx + TW2, top + TH2)
  ctx.lineTo(sx + TW2, sy + TH2); ctx.lineTo(sx, sy + TILE_H); ctx.closePath()
  ctx.fillStyle = def.right; ctx.fill()

  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.8
  diamondPath(ctx, sx, top); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx - TW2, top + TH2); ctx.lineTo(sx - TW2, sy + TH2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx + TW2, top + TH2); ctx.lineTo(sx + TW2, sy + TH2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx, top + TILE_H); ctx.lineTo(sx, sy + TILE_H); ctx.stroke()
  ctx.globalAlpha = 1
}

function drawHutRoof(ctx, sx, sy, def) {
  // A little peaked thatch so a homestead reads as a home, not a crate.
  const top = sy - def.h * UNIT_H
  ctx.beginPath()
  ctx.moveTo(sx, top - 9)
  ctx.lineTo(sx + TW2, top + TH2)
  ctx.lineTo(sx, top + TILE_H)
  ctx.lineTo(sx - TW2, top + TH2)
  ctx.closePath()
  ctx.fillStyle = def.roof; ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8; ctx.stroke()
}

// ── Homestead yard detail (firewood pile) ──────────────────────────────────────
export function drawYard(ctx, sx, sy) {
  const base = sy + TH2 + 6
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.ellipse(sx - 16 + i * 4, base - i * 2, 3, 1.6, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#7a4f22'; ctx.fill()
    ctx.strokeStyle = '#4a2e0e'; ctx.lineWidth = 0.5; ctx.stroke()
  }
}

// ── Hearth (campfire) ──────────────────────────────────────────────────────────
export function drawHearth(ctx, sx, sy, warmth = 1, flicker = 0) {
  const base = sy + TH2 + 2
  for (const [ox, oy] of [[-7, 0], [-4, 4], [2, 5], [7, 1], [5, -3], [-1, -4]]) {
    ctx.beginPath(); ctx.ellipse(sx + ox, base + oy, 3.4, 2, 0.2, 0, Math.PI * 2)
    ctx.fillStyle = '#6a6050'; ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5; ctx.stroke()
  }
  // Crossed logs.
  ctx.save(); ctx.translate(sx, base - 1)
  for (const a of [0.4, -0.4]) {
    ctx.save(); ctx.rotate(a)
    ctx.fillStyle = '#5a3818'; ctx.fillRect(-8, -1.4, 16, 2.8); ctx.restore()
  }
  ctx.restore()
  // Flames scale with warmth; a gentle flicker is passed in by the caller.
  const h = 5 + warmth * 9 + flicker
  const a = 0.6 + warmth * 0.4
  for (const [oy, rx, ry, col] of [
    [0, 5, h, `rgba(255,80,10,${a})`],
    [-h * 0.3, 3.4, h * 0.7, `rgba(255,160,20,${a})`],
    [-h * 0.5, 1.9, h * 0.45, `rgba(255,225,80,${a * 0.9})`],
  ]) {
    ctx.beginPath(); ctx.ellipse(sx, base - 3 + oy, rx, ry, 0, Math.PI, Math.PI * 2)
    ctx.fillStyle = col; ctx.fill()
  }
}

// ── Central stockpile ──────────────────────────────────────────────────────────
// Wood on the left of the hearth tile, food sacks on the right. Their size is a
// direct read on prosperity — low stocks look bare, full stocks look plentiful.
export function drawStockpile(ctx, sx, sy, wood, food) {
  if (wood > 0) {
    const bundles = wood <= 4 ? 1 : wood <= 12 ? 2 : wood <= 26 ? 3 : 4
    const base = sy + TH2 + 2
    const bp = [[-18, 0], [-9, 3], [-24, 4], [-14, 7]]
    for (let b = 0; b < bundles; b++) {
      const [ox, oy] = bp[b], bx = sx + ox, by = base + oy
      for (const [dx, dy] of [[0, -4], [-3.5, 1.5], [3.5, 1.5]]) {
        ctx.beginPath(); ctx.arc(bx + dx, by + dy, 3.8, 0, Math.PI * 2)
        ctx.fillStyle = '#7a4f22'; ctx.fill()
        ctx.strokeStyle = '#4a2e0e'; ctx.lineWidth = 0.6; ctx.stroke()
        ctx.beginPath(); ctx.arc(bx + dx, by + dy, 1.8, 0, Math.PI * 2)
        ctx.fillStyle = '#a06830'; ctx.fill()
      }
    }
  }
  if (food > 0) {
    const count = Math.min(Math.ceil(food / 4), 8)
    const base = sy + TH2
    const spots = [[9, -1], [16, 2], [12, 5], [20, -3], [6, 5], [22, 3], [11, -5], [18, 7]]
    for (let i = 0; i < count; i++) {
      const [ox, oy] = spots[i], bx = sx + ox, by = base + oy
      ctx.beginPath(); ctx.ellipse(bx, by, 3.6, 4.6, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#d4b87a'; ctx.fill()
      ctx.strokeStyle = '#8a7040'; ctx.lineWidth = 0.6; ctx.stroke()
      ctx.beginPath(); ctx.arc(bx, by - 4.8, 1.1, 0, Math.PI * 2)
      ctx.fillStyle = '#7a5830'; ctx.fill()
    }
  }
}

// ── Citizens ───────────────────────────────────────────────────────────────────
// Colour signals INTENT at a glance: green at the fields, brown at the woodlot, amber
// building, neutral while resting or asleep. A carried load shows as a coloured bundle.
const TASK_COLOR = { farm: '#86c060', forage: '#9ad06a', chop: '#c89a55', build: '#e3a949' }

export function drawCitizen(ctx, sx, sy, c) {
  const resting = c.state === 'resting' || c.state === 'sleeping'
  const bob = resting ? 0 : Math.sin(c.bounce) * 2.4
  const chopFlash = c.task === 'chop' && c.state === 'working' && ((c.chopPhase || 0) % 2 === 1)
  let color = TASK_COLOR[c.task] || '#b8b0a0'
  if (chopFlash) color = '#ecd060'

  const px = sx
  const py = sy + TH2 - 9 + bob + (resting ? 3 : 0)

  ctx.beginPath(); ctx.ellipse(px, sy + TH2 - 1, 5, 2.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.fill()

  ctx.beginPath(); ctx.arc(px, py, 5.4, 0, Math.PI * 2)
  ctx.fillStyle = color; ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke()

  ctx.beginPath(); ctx.arc(px, py - 8, 3.6, 0, Math.PI * 2)
  ctx.fillStyle = '#f0c890'; ctx.fill(); ctx.stroke()

  if (c.carrying) {
    ctx.beginPath(); ctx.arc(px + 6.5, py - 3, 3.2, 0, Math.PI * 2)
    ctx.fillStyle = c.carrying.res === 'food' ? '#86d070' : '#c8a060'; ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.7; ctx.stroke()
  }
  if (c.state === 'sleeping') {
    ctx.fillStyle = 'rgba(220,220,255,0.8)'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('z', px + 7, py - 11); ctx.textAlign = 'left'
  }
}

// A migrant group walking in — drawn as a small huddle so a "wave" reads as more than
// one person without spawning citizens before they've settled.
export function drawMigrant(ctx, sx, sy, m) {
  const base = sy + TH2 - 8
  for (let i = 0; i < Math.min(m.size, 3); i++) {
    const ox = (i - 1) * 6
    ctx.beginPath(); ctx.arc(sx + ox, base, 4.4, 0, Math.PI * 2)
    ctx.fillStyle = '#9a8f80'; ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.8; ctx.stroke()
    ctx.beginPath(); ctx.arc(sx + ox, base - 6, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#f0c890'; ctx.fill(); ctx.stroke()
  }
}

// A site under construction — a couple of survey posts so a claim reads as "being
// worked on" before its building or field appears.
export function drawScaffold(ctx, sx, sy, progress) {
  const base = sy + TH2
  ctx.strokeStyle = 'rgba(180,150,90,0.8)'; ctx.lineWidth = 1.4
  for (const ox of [-8, 8]) {
    ctx.beginPath(); ctx.moveTo(sx + ox, base); ctx.lineTo(sx + ox, base - 12); ctx.stroke()
  }
  ctx.beginPath(); ctx.moveTo(sx - 8, base - 12); ctx.lineTo(sx + 8, base - 12); ctx.stroke()
  // Progress pip.
  ctx.fillStyle = '#e3c060'
  ctx.fillRect(sx - 8, base - 12, 16 * (progress / 100), 2)
}
