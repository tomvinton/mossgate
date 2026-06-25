// ── Mossgate — Isometric Renderer ─────────────────────────────────────────────

import { TILE_W, TILE_H, UNIT_H, GROUND, TASKS } from '../engine/config.js'

const TW2 = TILE_W / 2
const TH2 = TILE_H / 2

// ── Coordinate transform ───────────────────────────────────────────────────────

export function tileToScreen(col, row, camX, camY, canvasW, canvasH) {
  return {
    sx: (col - row) * TW2 - camX + canvasW / 2,
    sy: (col + row) * TH2 - camY + canvasH / 2,
  }
}

// Painter's algorithm sort (back to front)
export function sortedTileKeys(tiles) {
  return [...tiles.keys()].sort((a, b) => {
    const [ac, ar] = a.split(',').map(Number)
    const [bc, br] = b.split(',').map(Number)
    const da = ac + ar, db = bc + br
    return da !== db ? da - db : ac - bc
  })
}

// ── Diamond (flat ground tile) ─────────────────────────────────────────────────

function diamond(ctx, sx, sy, color, edgeColor = 'rgba(0,0,0,0.15)') {
  ctx.beginPath()
  ctx.moveTo(sx,       sy)
  ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx,       sy + TILE_H)
  ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = edgeColor
  ctx.lineWidth   = 0.5
  ctx.stroke()
}

// ── Tile drawing ───────────────────────────────────────────────────────────────

export function drawTile(ctx, sx, sy, type) {
  if (type === 'forest') {
    drawForestTile(ctx, sx, sy)
  } else if (type === 'stump') {
    drawStumpTile(ctx, sx, sy)
  } else if (type === 'farmland') {
    drawFarmlandTile(ctx, sx, sy)
  } else {
    diamond(ctx, sx, sy, GROUND[type] || GROUND.grass)
  }
}

function drawFarmlandTile(ctx, sx, sy) {
  // Tilled soil base
  diamond(ctx, sx, sy, '#7a5530', 'rgba(0,0,0,0.2)')

  // Crop rows — clip to diamond, draw horizontal stripes
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx,       sy)
  ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx,       sy + TILE_H)
  ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath()
  ctx.clip()
  ctx.strokeStyle = '#5a3a18'
  ctx.lineWidth   = 0.9
  for (let i = 2; i < TILE_H; i += 5) {
    ctx.beginPath()
    ctx.moveTo(sx - TW2 - 4, sy + i)
    ctx.lineTo(sx + TW2 + 4, sy + i)
    ctx.stroke()
  }
  ctx.restore()
}

function drawForestTile(ctx, sx, sy) {
  // Dark forest floor
  diamond(ctx, sx, sy, '#1e3a12', 'rgba(0,0,0,0.2)')

  // Tree canopy — compact, designed for dense tiling
  const tx = sx
  const ty = sy - 14

  // Shadow blob on floor
  ctx.beginPath()
  ctx.ellipse(tx, sy + TH2, TW2 * 0.55, TH2 * 0.45, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.fill()

  // Canopy layers (bottom to top = darker to lighter)
  const layers = [
    { oy: 6,  rx: 17, ry: 10, color: '#1e4010' },
    { oy: -2, rx: 14, ry:  9, color: '#265218' },
    { oy:-10, rx: 10, ry:  7, color: '#2e6020' },
    { oy:-16, rx:  6, ry:  5, color: '#366828' },
  ]
  for (const l of layers) {
    ctx.beginPath()
    ctx.ellipse(tx, ty + l.oy, l.rx, l.ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = l.color
    ctx.fill()
  }
}

function drawStumpTile(ctx, sx, sy) {
  diamond(ctx, sx, sy, '#4a3820', 'rgba(0,0,0,0.2)')
  // Stump cross-section
  ctx.beginPath()
  ctx.ellipse(sx, sy + TH2 - 2, 7, 4, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#7a5830'
  ctx.fill()
  ctx.strokeStyle = '#5a3810'
  ctx.lineWidth = 1
  ctx.stroke()
  // Ring
  ctx.beginPath()
  ctx.ellipse(sx, sy + TH2 - 2, 4, 2.5, 0, 0, Math.PI * 2)
  ctx.strokeStyle = '#6a4820'
  ctx.lineWidth = 0.7
  ctx.stroke()
}

// ── Isometric box (building) ───────────────────────────────────────────────────

export function drawBox(ctx, sx, sy, def, progress = 100) {
  const bh  = def.h * UNIT_H * (progress / 100)
  const top = sy - bh

  // Under-construction stipple
  if (progress < 100) {
    ctx.globalAlpha = 0.5 + 0.5 * (progress / 100)
  }

  // Top face
  ctx.beginPath()
  ctx.moveTo(sx,       top)
  ctx.lineTo(sx + TW2, top + TH2)
  ctx.lineTo(sx,       top + TILE_H)
  ctx.lineTo(sx - TW2, top + TH2)
  ctx.closePath()
  ctx.fillStyle = def.top; ctx.fill()

  // Left face
  ctx.beginPath()
  ctx.moveTo(sx - TW2, top + TH2)
  ctx.lineTo(sx,       top + TILE_H)
  ctx.lineTo(sx,       sy  + TILE_H)
  ctx.lineTo(sx - TW2, sy  + TH2)
  ctx.closePath()
  ctx.fillStyle = def.left; ctx.fill()

  // Right face
  ctx.beginPath()
  ctx.moveTo(sx,       top + TILE_H)
  ctx.lineTo(sx + TW2, top + TH2)
  ctx.lineTo(sx + TW2, sy  + TH2)
  ctx.lineTo(sx,       sy  + TILE_H)
  ctx.closePath()
  ctx.fillStyle = def.right; ctx.fill()

  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth   = 0.8
  ctx.beginPath()
  ctx.moveTo(sx, top); ctx.lineTo(sx + TW2, top + TH2)
  ctx.lineTo(sx, top + TILE_H); ctx.lineTo(sx - TW2, top + TH2)
  ctx.closePath(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx - TW2, top + TH2); ctx.lineTo(sx - TW2, sy + TH2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx + TW2, top + TH2); ctx.lineTo(sx + TW2, sy + TH2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx,       top + TILE_H); ctx.lineTo(sx, sy + TILE_H);  ctx.stroke()

  // Construction progress bar
  if (progress < 100) {
    ctx.globalAlpha = 1
    const barW = TILE_W * 0.6
    const barX = sx - barW / 2
    const barY = top - 8
    ctx.fillStyle = '#333'
    ctx.fillRect(barX, barY, barW, 4)
    ctx.fillStyle = '#ffcc44'
    ctx.fillRect(barX, barY, barW * (progress / 100), 4)
  }
}

// ── Resource stockpile visuals ────────────────────────────────────────────────
// Both functions receive the tile's top-of-diamond (sx, sy) and the resource amount.
// The left side of the tile is used for wood, the right for food.

export function drawWoodPile(ctx, sx, sy, amount) {
  if (amount <= 0) return

  // How many log bundles to show (1 bundle = 3 logs in a triangle)
  const bundles = amount <= 3 ? 1 : amount <= 9 ? 2 : amount <= 20 ? 3 : amount <= 36 ? 4 : 5

  // Positions within the left half of the diamond, anchored to ground level
  const base = sy + TH2 + 2
  const bpos = [
    { ox: -16, oy: 0  },
    { ox:  -6, oy: 3  },
    { ox: -22, oy: 4  },
    { ox: -12, oy: 7  },
    { ox:  -2, oy: 7  },
  ]

  for (let b = 0; b < bundles; b++) {
    const { ox, oy } = bpos[b]
    const bx = sx + ox
    const by = base + oy

    // Three log ends in a triangle arrangement (draw back to front)
    const logs = [
      { dx:  0, dy: -4.5 },   // top log
      { dx: -4, dy:  2   },   // bottom left
      { dx:  4, dy:  2   },   // bottom right
    ]
    for (const { dx, dy } of logs) {
      const lx = bx + dx, ly = by + dy
      // Bark ring
      ctx.beginPath()
      ctx.arc(lx, ly, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = '#7a4f22'
      ctx.fill()
      ctx.strokeStyle = '#4a2e0e'
      ctx.lineWidth = 0.7
      ctx.stroke()
      // Heartwood
      ctx.beginPath()
      ctx.arc(lx, ly, 2.4, 0, Math.PI * 2)
      ctx.fillStyle = '#a06830'
      ctx.fill()
      // Growth ring
      ctx.beginPath()
      ctx.arc(lx, ly, 1.2, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(74,46,14,0.45)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
    // Rope binding
    ctx.beginPath()
    ctx.moveTo(bx - 6, by + 1)
    ctx.lineTo(bx + 6, by + 1)
    ctx.strokeStyle = '#c8a050'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

export function drawFoodSacks(ctx, sx, sy, amount) {
  if (amount <= 0) return

  const count = Math.min(Math.ceil(amount / 2.5), 10)

  // Scatter positions within the right half of the tile diamond
  const base = sy + TH2
  const spots = [
    [  8, -2 ], [ 16,  2 ], [ 12, 5 ],
    [ 20, -4 ], [  4,  5 ], [ 22,  3 ],
    [ 10, -6 ], [ 18,  7 ], [ 24, -1 ],
    [  6,  8 ],
  ]

  for (let i = 0; i < count; i++) {
    const [ox, oy] = spots[i]
    const bx = sx + ox
    const by = base + oy

    // Sack body — rounded squarish blob
    ctx.beginPath()
    ctx.ellipse(bx, by, 4, 5, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#d4b87a'
    ctx.fill()
    ctx.strokeStyle = '#8a7040'
    ctx.lineWidth = 0.7
    ctx.stroke()

    // Neck pinch
    ctx.beginPath()
    ctx.ellipse(bx, by - 4.5, 2.2, 1.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#b09050'
    ctx.fill()

    // Tie knot
    ctx.beginPath()
    ctx.arc(bx, by - 5.8, 1.2, 0, Math.PI * 2)
    ctx.fillStyle = '#7a5830'
    ctx.fill()
  }
}

// ── Villager ───────────────────────────────────────────────────────────────────

export function drawVillager(ctx, sx, sy, citizen) {
  const sleeping = citizen.state === 'sleeping' || citizen.state === 'going_home'
  if (sleeping) ctx.globalAlpha = 0.35
  const bob   = sleeping ? 0 : Math.sin(citizen.bounce) * 2.5
  const color = (citizen.task && TASKS[citizen.task]?.color) || '#a8a098'
  const px    = sx
  const py    = sy + TH2 - 10 + bob

  // Shadow
  ctx.beginPath()
  ctx.ellipse(px, sy + TH2 - 1, 5, 2.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()

  // Body
  ctx.beginPath()
  ctx.arc(px, py, 6, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth   = 1
  ctx.stroke()

  // Head
  ctx.beginPath()
  ctx.arc(px, py - 9, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#f0c890'
  ctx.fill()
  ctx.stroke()

  if (sleeping) { ctx.globalAlpha = 1; return }

  // Carrying indicator
  if (citizen.carrying) {
    const dotColor = citizen.carrying.resource === 'food' ? '#78d878' : '#c8a060'
    ctx.beginPath()
    ctx.arc(px + 7, py - 4, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = dotColor
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
}
