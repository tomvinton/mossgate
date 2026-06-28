// ── Mossgate — Isometric Renderer ─────────────────────────────────────────────

import { TILE_W, TILE_H, UNIT_H, GROUND, TASKS } from '../engine/config.js'
import { getTileColor } from './styleResolver.js'

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
    drawForestTile(ctx, sx, sy, getTileColor('forest'))
  } else if (type === 'stump') {
    drawStumpTile(ctx, sx, sy)
  } else if (type === 'farmland') {
    drawFarmlandTile(ctx, sx, sy)
  } else if (type === 'water') {
    drawWaterTile(ctx, sx, sy)
  } else if (type === 'bridge') {
    drawBridgeTile(ctx, sx, sy)
  } else if (type === 'rock') {
    drawRockTile(ctx, sx, sy)
  } else if (type === 'nuclear_ruin') {
    drawNuclearRuinTile(ctx, sx, sy)
  } else if (type === 'nuclear_ruin_revealed') {
    drawNuclearRuinRevealedTile(ctx, sx, sy)
  } else if (type === 'rubble') {
    drawRubbleTile(ctx, sx, sy)
  } else if (type === 'coal_seam') {
    drawCoalSeamTile(ctx, sx, sy)
  } else if (type === 'iron_deposit') {
    drawIronDepositTile(ctx, sx, sy)
  } else if (type === 'uranium_ore') {
    drawUraniumOreTile(ctx, sx, sy)
  } else if (type === 'contamination') {
    drawContaminationTile(ctx, sx, sy)
  } else if (type === 'tombstone') {
    drawTombstoneTile(ctx, sx, sy)
  } else if (type === 'legacy_arc') {
    drawLegacyArc(ctx, sx, sy)
  } else if (type === 'legacy_pyre') {
    drawLegacyPyre(ctx, sx, sy)
  } else if (type === 'legacy_guard') {
    drawLegacyGuard(ctx, sx, sy)
  } else if (type === 'legacy_elder') {
    drawLegacyElder(ctx, sx, sy)
  } else if (type === 'legacy_famine') {
    drawLegacyFamine(ctx, sx, sy)
  } else if (type === 'legacy_resilience') {
    drawLegacyResilience(ctx, sx, sy)
  } else {
    diamond(ctx, sx, sy, getTileColor(type) ?? GROUND[type] ?? GROUND.grass)
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

function drawWaterTile(ctx, sx, sy) {
  diamond(ctx, sx, sy, '#2a5880', 'rgba(0,0,0,0.15)')

  // Ripple lines — clipped to diamond shape
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx,       sy)
  ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx,       sy + TILE_H)
  ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath()
  ctx.clip()
  ctx.strokeStyle = 'rgba(120,195,255,0.28)'
  ctx.lineWidth   = 1.2
  for (let i = 5; i < TILE_H; i += 7) {
    ctx.beginPath()
    ctx.moveTo(sx - TW2 - 4, sy + i)
    ctx.lineTo(sx + TW2 + 4, sy + i)
    ctx.stroke()
  }
  // Highlight glint near top
  ctx.strokeStyle = 'rgba(200,235,255,0.18)'
  ctx.lineWidth   = 2
  ctx.beginPath()
  ctx.moveTo(sx - TW2 * 0.5, sy + TH2 * 0.6)
  ctx.lineTo(sx + TW2 * 0.2, sy + TH2 * 0.35)
  ctx.stroke()
  ctx.restore()
}

function drawBridgeTile(ctx, sx, sy) {
  // Stone planks — slightly lighter than path
  diamond(ctx, sx, sy, '#9a8a68', 'rgba(0,0,0,0.2)')

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx,       sy)
  ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx,       sy + TILE_H)
  ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath()
  ctx.clip()
  // Plank lines
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth   = 1
  for (let i = 3; i < TILE_H; i += 5) {
    ctx.beginPath()
    ctx.moveTo(sx - TW2 - 4, sy + i)
    ctx.lineTo(sx + TW2 + 4, sy + i)
    ctx.stroke()
  }
  // Side railings — darker edges
  ctx.strokeStyle = 'rgba(80,60,30,0.4)'
  ctx.lineWidth   = 1.5
  ctx.beginPath(); ctx.moveTo(sx - TW2, sy + TH2); ctx.lineTo(sx, sy + TILE_H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx + TW2, sy + TH2); ctx.lineTo(sx, sy + TILE_H); ctx.stroke()
  ctx.restore()
}

function drawRockTile(ctx, sx, sy) {
  // Stony ground base
  diamond(ctx, sx, sy, '#6a6858', 'rgba(0,0,0,0.2)')
  // Pebble cluster — a few irregular ellipses near center of tile
  const boulders = [
    { ox: -6, oy: TH2 - 4, rx: 7,  ry: 4  },
    { ox:  5, oy: TH2 - 2, rx: 5,  ry: 3  },
    { ox: -1, oy: TH2 + 1, rx: 4,  ry: 2.5 },
    { ox:  9, oy: TH2 - 6, rx: 3.5,ry: 2  },
  ]
  for (const { ox, oy, rx, ry } of boulders) {
    ctx.beginPath()
    ctx.ellipse(sx + ox, sy + oy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#8a887a'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 0.6
    ctx.stroke()
    // Highlight top
    ctx.beginPath()
    ctx.ellipse(sx + ox - 1, sy + oy - 1, rx * 0.5, ry * 0.4, -0.3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fill()
  }
}

function drawNuclearRuinTile(ctx, sx, sy) {
  // Cracked concrete base — reads as "some kind of old stone structure"
  // (the full reactor detail is revealed by the nuclearRevealed flag at a higher level)
  diamond(ctx, sx, sy, '#4a4840', 'rgba(0,0,0,0.3)')

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx,       sy)
  ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx,       sy + TILE_H)
  ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath()
  ctx.clip()

  // Cracked concrete texture lines
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth   = 0.8
  // Diagonal crack 1
  ctx.beginPath(); ctx.moveTo(sx - 8, sy + 4); ctx.lineTo(sx + 4, sy + TILE_H - 2); ctx.stroke()
  // Diagonal crack 2
  ctx.beginPath(); ctx.moveTo(sx + 6, sy + 6); ctx.lineTo(sx - 2, sy + TILE_H - 4); ctx.stroke()
  // Rubble chunks
  for (const [ox, oy, w, h] of [[-10,TH2-2,6,4],[4,TH2+2,5,3],[0,TH2-4,4,3]]) {
    ctx.fillStyle = '#5a5848'
    ctx.fillRect(sx + ox, sy + oy, w, h)
  }
  ctx.restore()
}

function drawRubbleTile(ctx, sx, sy) {
  // Scorched earth base
  diamond(ctx, sx, sy, '#4e4438', 'rgba(0,0,0,0.35)')

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx,       sy)
  ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx,       sy + TILE_H)
  ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath()
  ctx.clip()

  // Scorched debris chunks — irregular rectangles at different angles
  const chunks = [
    { ox: -9, oy: TH2 - 3, w: 7, h: 4, a: 0.3  },
    { ox:  3, oy: TH2 + 1, w: 6, h: 3, a: -0.2 },
    { ox: -2, oy: TH2 - 6, w: 5, h: 3, a: 0.5  },
    { ox:  8, oy: TH2 - 2, w: 4, h: 3, a: -0.4 },
  ]
  for (const { ox, oy, w, h, a } of chunks) {
    ctx.save()
    ctx.translate(sx + ox + w / 2, sy + oy + h / 2)
    ctx.rotate(a)
    ctx.fillStyle = '#6a5848'
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(-w / 2, -h / 2, w, h)
    // Charred highlight edge
    ctx.fillStyle = 'rgba(255,100,20,0.08)'
    ctx.fillRect(-w / 2, -h / 2, w, 1.5)
    ctx.restore()
  }

  // Ash smudges
  ctx.fillStyle = 'rgba(200,180,160,0.12)'
  ctx.beginPath(); ctx.ellipse(sx - 5, sy + TH2 + 2, 5, 2.5, 0.2, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(sx + 6, sy + TH2 - 3, 4, 2,   -0.1, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// ── Heart — the city's power source, drawn in foreground above nuclear ruin ────
// era: current era number (1=campfire, future=hearth/steam/etc.)
// fuelFraction: 0–1, controls flame intensity

export function drawHeart(ctx, sx, sy, era, fuelFraction = 1) {
  if      (era === 1) drawCampfire(ctx, sx, sy, fuelFraction)
  else if (era === 2) drawHearth(ctx, sx, sy, fuelFraction)
  else if (era === 3) drawForge(ctx, sx, sy, fuelFraction)
  else if (era === 4) drawBoiler(ctx, sx, sy, fuelFraction)
  else if (era === 5) drawReactor(ctx, sx, sy, fuelFraction)
  else if (era >= 6)  drawSolar(ctx, sx, sy)
}

function drawCampfire(ctx, sx, sy, fuelFraction) {
  const base = sy + TH2 + 2   // ground level center

  // Stone ring
  const stones = [
    { ox: -7, oy: 0  }, { ox: -4, oy: 4  }, { ox:  2, oy: 5  },
    { ox:  7, oy: 1  }, { ox:  5, oy: -3 }, { ox: -1, oy: -4 },
  ]
  for (const { ox, oy } of stones) {
    ctx.beginPath()
    ctx.ellipse(sx + ox, base + oy, 3.5, 2, Math.PI * 0.2, 0, Math.PI * 2)
    ctx.fillStyle = '#6a6050'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }

  // Logs (two crossed) — slightly above stone ring
  ctx.save()
  ctx.translate(sx, base - 1)
  for (const angle of [0.4, -0.4]) {
    ctx.save()
    ctx.rotate(angle)
    ctx.fillStyle = '#5a3818'
    ctx.fillRect(-9, -1.5, 18, 3)
    ctx.strokeStyle = '#3a2208'
    ctx.lineWidth = 0.5
    ctx.strokeRect(-9, -1.5, 18, 3)
    ctx.restore()
  }
  ctx.restore()

  // Flames — intensity based on fuel level
  const flameH  = 6 + fuelFraction * 8   // 6–14px tall
  const flameA  = 0.75 + fuelFraction * 0.25
  const layers  = [
    { oy: 0,        rx: 5,   ry: flameH,       color: `rgba(255,80,10,${flameA})` },
    { oy: -flameH * 0.3, rx: 3.5, ry: flameH * 0.7, color: `rgba(255,160,20,${flameA})` },
    { oy: -flameH * 0.5, rx: 2,   ry: flameH * 0.45, color: `rgba(255,220,60,${flameA * 0.9})` },
  ]
  for (const { oy, rx, ry, color } of layers) {
    ctx.beginPath()
    ctx.ellipse(sx, base - 3 + oy, rx, ry, 0, Math.PI, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  // Ember sparks — static dots, flickered by caller if needed
  if (fuelFraction > 0.15) {
    ctx.fillStyle = 'rgba(255,200,50,0.7)'
    for (const [ox, oy] of [[-3,-flameH-2],[2,-flameH-4],[0,-flameH-1]]) {
      ctx.beginPath()
      ctx.arc(sx + ox, base + oy, 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// ── New tile renderers ────────────────────────────────────────────────────────

function drawCoalSeamTile(ctx, sx, sy) {
  diamond(ctx, sx, sy, '#222226', 'rgba(0,0,0,0.45)')
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx, sy); ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx, sy + TILE_H); ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath(); ctx.clip()
  // Glistening coal veins
  ctx.strokeStyle = 'rgba(80,80,100,0.6)'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(sx - 12, sy + TH2 - 3); ctx.lineTo(sx + 8,  sy + TH2 + 4); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx + 4,  sy + TH2 - 6); ctx.lineTo(sx - 4,  sy + TH2 + 5); ctx.stroke()
  // Highlight glint
  ctx.fillStyle = 'rgba(130,130,160,0.25)'
  for (const [ox, oy] of [[-8, TH2-1],[4, TH2+2],[-2, TH2-4]]) {
    ctx.beginPath(); ctx.ellipse(sx+ox, sy+oy, 2.5, 1.2, 0.3, 0, Math.PI*2); ctx.fill()
  }
  ctx.restore()
}

function drawIronDepositTile(ctx, sx, sy) {
  diamond(ctx, sx, sy, '#6a3830', 'rgba(0,0,0,0.3)')
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx, sy); ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx, sy + TILE_H); ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath(); ctx.clip()
  // Rusty iron ore chunks
  const chunks = [{ ox:-8, oy:TH2-2, rx:6,ry:3.5 },{ ox:5, oy:TH2+1, rx:5,ry:3 },{ ox:-1, oy:TH2-5, rx:4,ry:2.5 }]
  for (const { ox, oy, rx, ry } of chunks) {
    ctx.beginPath(); ctx.ellipse(sx+ox, sy+oy, rx, ry, 0.2, 0, Math.PI*2)
    ctx.fillStyle = '#a05040'; ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.6; ctx.stroke()
    // Rust highlight
    ctx.beginPath(); ctx.ellipse(sx+ox-1, sy+oy-1, rx*0.5, ry*0.4, 0, 0, Math.PI*2)
    ctx.fillStyle = 'rgba(200,100,60,0.2)'; ctx.fill()
  }
  ctx.restore()
}

function drawUraniumOreTile(ctx, sx, sy) {
  diamond(ctx, sx, sy, '#384830', 'rgba(0,0,0,0.35)')
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx, sy); ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx, sy + TILE_H); ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath(); ctx.clip()
  // Green-tinged crystals
  const crystals = [{ ox:-6,oy:TH2-3,h:8 },{ ox:5,oy:TH2-5,h:6 },{ ox:0,oy:TH2+1,h:5 }]
  for (const { ox, oy, h } of crystals) {
    ctx.beginPath()
    ctx.moveTo(sx+ox, sy+oy-h)
    ctx.lineTo(sx+ox+3, sy+oy)
    ctx.lineTo(sx+ox, sy+oy+2)
    ctx.lineTo(sx+ox-3, sy+oy)
    ctx.closePath()
    ctx.fillStyle = '#50843a'; ctx.fill()
    ctx.strokeStyle = 'rgba(100,200,80,0.5)'; ctx.lineWidth = 0.5; ctx.stroke()
  }
  // Eerie green glow
  const g = ctx.createRadialGradient(sx, sy+TH2, 0, sx, sy+TH2, 18)
  g.addColorStop(0, 'rgba(80,200,60,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(sx-18, sy, 36, TILE_H)
  ctx.restore()
}

function drawContaminationTile(ctx, sx, sy) {
  diamond(ctx, sx, sy, '#4a5228', 'rgba(0,0,0,0.3)')
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx, sy); ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx, sy + TILE_H); ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath(); ctx.clip()
  // Sickly yellow-green patches
  for (const [ox, oy, r] of [[-5,TH2-2,5],[4,TH2+2,4],[-1,TH2-5,3],[7,TH2-3,3.5]]) {
    ctx.beginPath(); ctx.arc(sx+ox, sy+oy, r, 0, Math.PI*2)
    ctx.fillStyle = 'rgba(150,170,40,0.35)'; ctx.fill()
  }
  // Hazard stripes suggestion
  ctx.strokeStyle = 'rgba(180,160,20,0.3)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(sx-14, sy+TH2+1); ctx.lineTo(sx+6, sy+TH2-3); ctx.stroke()
  ctx.restore()
}

function drawTombstoneTile(ctx, sx, sy) {
  // Dark bare earth — grief-scorched ground
  diamond(ctx, sx, sy, '#333028', 'rgba(0,0,0,0.4)')
  const cx = sx, cy = sy + TH2 - 2
  // Stone slab shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(cx - 3, cy - 13, 8, 13)
  // Slab face
  ctx.fillStyle = '#706860'
  ctx.fillRect(cx - 4, cy - 14, 7, 12)
  // Slab lighter top edge
  ctx.fillStyle = '#908878'
  ctx.fillRect(cx - 4, cy - 14, 7, 2)
  // Slab right edge (shadow)
  ctx.fillStyle = '#504840'
  ctx.fillRect(cx + 3, cy - 13, 1, 11)
  // Cross bar
  ctx.fillStyle = '#605850'
  ctx.fillRect(cx - 5, cy - 10, 11, 2)
  // Small base slab on ground
  ctx.fillStyle = '#605858'
  ctx.fillRect(cx - 5, cy - 3, 9, 3)
  ctx.fillStyle = '#807068'
  ctx.fillRect(cx - 5, cy - 3, 9, 1)
}

// ── Legacy marker tile renderers ──────────────────────────────────────────────
// Each monument is a permanent tile placed near the heart when a milestone fires.
// They share the same isometric space as regular tiles but rise above ground.

function drawLegacyArc(ctx, sx, sy) {
  // The Survivor Stone — dark green obelisk with a glowing tip. Era 6 reached.
  diamond(ctx, sx, sy, '#1c3020', 'rgba(0,0,0,0.45)')
  const cx = sx, cy = sy + TH2 - 2

  // Obelisk right side (shadow face)
  ctx.fillStyle = '#182818'
  ctx.beginPath()
  ctx.moveTo(cx + 3, cy)
  ctx.lineTo(cx + 6, cy - 2)
  ctx.lineTo(cx + 5, cy - 22)
  ctx.lineTo(cx + 2, cy - 26)
  ctx.closePath()
  ctx.fill()

  // Obelisk front face
  ctx.fillStyle = '#2e4a30'
  ctx.beginPath()
  ctx.moveTo(cx - 3, cy)
  ctx.lineTo(cx + 3, cy)
  ctx.lineTo(cx + 2, cy - 26)
  ctx.lineTo(cx, cy - 28)
  ctx.lineTo(cx - 2, cy - 26)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 0.7
  ctx.stroke()

  // Carved rune line (horizontal groove)
  ctx.strokeStyle = 'rgba(80,160,80,0.4)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(cx - 2, cy - 12)
  ctx.lineTo(cx + 2, cy - 12)
  ctx.stroke()

  // Glowing orb at the tip — the clean energy captured
  const glow = ctx.createRadialGradient(cx, cy - 32, 0, cx, cy - 32, 9)
  glow.addColorStop(0, 'rgba(120,255,140,0.95)')
  glow.addColorStop(0.45, 'rgba(60,200,80,0.4)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy - 32, 9, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy - 32, 3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(200,255,200,0.95)'
  ctx.fill()
}

function drawLegacyPyre(ctx, sx, sy) {
  // The Pyre Stone — scorched black pillar with ember cracks. 5+ fire deaths.
  diamond(ctx, sx, sy, '#1a1010', 'rgba(0,0,0,0.55)')
  const cx = sx, cy = sy + TH2 - 2

  // Pillar right shadow face
  ctx.fillStyle = '#0e0808'
  ctx.beginPath()
  ctx.moveTo(cx + 4, cy)
  ctx.lineTo(cx + 8, cy - 2)
  ctx.lineTo(cx + 7, cy - 18)
  ctx.lineTo(cx + 4, cy - 20)
  ctx.closePath()
  ctx.fill()

  // Pillar front face — charred black
  ctx.fillStyle = '#221414'
  ctx.beginPath()
  ctx.moveTo(cx - 4, cy)
  ctx.lineTo(cx + 4, cy)
  ctx.lineTo(cx + 4, cy - 20)
  ctx.lineTo(cx, cy - 22)
  ctx.lineTo(cx - 4, cy - 20)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  // Ember crack lines
  ctx.strokeStyle = 'rgba(255,80,20,0.7)'
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.moveTo(cx - 2, cy - 4)
  ctx.lineTo(cx + 1, cy - 10)
  ctx.lineTo(cx - 1, cy - 16)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,140,20,0.5)'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(cx + 2, cy - 6)
  ctx.lineTo(cx - 1, cy - 12)
  ctx.stroke()

  // Ember glow at base
  const ember = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12)
  ember.addColorStop(0, 'rgba(255,60,10,0.18)')
  ember.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = ember
  ctx.beginPath()
  ctx.arc(cx, cy, 12, 0, Math.PI * 2)
  ctx.fill()
}

function drawLegacyGuard(ctx, sx, sy) {
  // The Guardian Stone — squat blue-grey stone with shield carving. 3+ intercepts.
  diamond(ctx, sx, sy, '#20203a', 'rgba(0,0,0,0.45)')
  const cx = sx, cy = sy + TH2 - 2

  // Block right shadow face
  ctx.fillStyle = '#141428'
  ctx.beginPath()
  ctx.moveTo(cx + 5, cy)
  ctx.lineTo(cx + 9, cy - 2)
  ctx.lineTo(cx + 9, cy - 16)
  ctx.lineTo(cx + 5, cy - 18)
  ctx.closePath()
  ctx.fill()

  // Block front face
  ctx.fillStyle = '#28284a'
  ctx.beginPath()
  ctx.moveTo(cx - 5, cy)
  ctx.lineTo(cx + 5, cy)
  ctx.lineTo(cx + 5, cy - 18)
  ctx.lineTo(cx, cy - 20)
  ctx.lineTo(cx - 5, cy - 18)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  // Carved shield — V-notch outline on front face
  ctx.strokeStyle = 'rgba(160,180,220,0.6)'
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.moveTo(cx - 3, cy - 14)
  ctx.lineTo(cx - 3, cy - 7)
  ctx.lineTo(cx, cy - 4)
  ctx.lineTo(cx + 3, cy - 7)
  ctx.lineTo(cx + 3, cy - 14)
  ctx.closePath()
  ctx.stroke()
  // Centre boss
  ctx.beginPath()
  ctx.arc(cx, cy - 10, 1.2, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(160,180,220,0.55)'
  ctx.fill()
}

function drawLegacyElder(ctx, sx, sy) {
  // The Elder Stone — large bulbous ancestor stone, warm and mossy. Pop hit 75.
  diamond(ctx, sx, sy, '#4a3818', 'rgba(0,0,0,0.3)')
  const cx = sx, cy = sy + TH2 - 2

  // Base plinth shadow
  ctx.fillStyle = '#2e2010'
  ctx.beginPath()
  ctx.moveTo(cx + 6, cy + 1)
  ctx.lineTo(cx + 10, cy - 1)
  ctx.lineTo(cx + 10, cy - 5)
  ctx.lineTo(cx + 6, cy - 4)
  ctx.closePath()
  ctx.fill()

  // Base plinth face
  ctx.fillStyle = '#5a4020'
  ctx.beginPath()
  ctx.moveTo(cx - 6, cy + 1)
  ctx.lineTo(cx + 6, cy + 1)
  ctx.lineTo(cx + 6, cy - 4)
  ctx.lineTo(cx, cy - 5)
  ctx.lineTo(cx - 6, cy - 4)
  ctx.closePath()
  ctx.fill()

  // Bulbous stone — rounded, leaning slightly left, aged look
  ctx.beginPath()
  ctx.ellipse(cx - 1, cy - 16, 8, 12, -0.1, 0, Math.PI * 2)
  ctx.fillStyle = '#7a6030'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  // Stone texture — weathered lighter patches
  ctx.fillStyle = 'rgba(200,170,100,0.15)'
  ctx.beginPath(); ctx.ellipse(cx - 3, cy - 20, 3, 2, 0.3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(cx + 2, cy - 14, 2, 1.5, -0.2, 0, Math.PI * 2); ctx.fill()

  // Mossy patches — green dots
  ctx.fillStyle = 'rgba(60,120,40,0.4)'
  for (const [ox, oy] of [[-5, cy - 11], [-2, cy - 24], [4, cy - 17]]) {
    ctx.beginPath(); ctx.arc(cx + ox, oy, 1.8, 0, Math.PI * 2); ctx.fill()
  }
}

function drawLegacyFamine(ctx, sx, sy) {
  // The Empty Bowl — hollow bowl on a stone pedestal. 3+ famine deaths.
  diamond(ctx, sx, sy, '#28202e', 'rgba(0,0,0,0.45)')
  const cx = sx, cy = sy + TH2 - 2

  // Pedestal right shadow
  ctx.fillStyle = '#181018'
  ctx.beginPath()
  ctx.moveTo(cx + 3, cy)
  ctx.lineTo(cx + 6, cy - 1)
  ctx.lineTo(cx + 6, cy - 10)
  ctx.lineTo(cx + 3, cy - 10)
  ctx.closePath()
  ctx.fill()

  // Pedestal front face
  ctx.fillStyle = '#302038'
  ctx.beginPath()
  ctx.moveTo(cx - 3, cy)
  ctx.lineTo(cx + 3, cy)
  ctx.lineTo(cx + 3, cy - 10)
  ctx.lineTo(cx, cy - 11)
  ctx.lineTo(cx - 3, cy - 10)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 0.7
  ctx.stroke()

  // Bowl rim (top ellipse)
  ctx.beginPath()
  ctx.ellipse(cx, cy - 13, 7, 3.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#3a2a42'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 0.7
  ctx.stroke()

  // Bowl inner darkness — hollow and empty
  ctx.beginPath()
  ctx.ellipse(cx, cy - 13, 5, 2.2, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#100810'
  ctx.fill()

  // Bowl outer curve (front half)
  ctx.strokeStyle = 'rgba(80,60,90,0.7)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(cx, cy - 10, 7, 4, 0, 0, Math.PI)
  ctx.stroke()
}

function drawLegacyResilience(ctx, sx, sy) {
  // The Cracked Column — stone pillar with a visible fissure, still standing. 3+ near-collapses.
  diamond(ctx, sx, sy, '#2c2c2c', 'rgba(0,0,0,0.5)')
  const cx = sx, cy = sy + TH2 - 2

  // Column right shadow face
  ctx.fillStyle = '#181818'
  ctx.beginPath()
  ctx.moveTo(cx + 4, cy)
  ctx.lineTo(cx + 8, cy - 2)
  ctx.lineTo(cx + 7, cy - 20)
  ctx.lineTo(cx + 4, cy - 21)
  ctx.closePath()
  ctx.fill()

  // Column front face
  ctx.fillStyle = '#3a3a3a'
  ctx.beginPath()
  ctx.moveTo(cx - 4, cy)
  ctx.lineTo(cx + 4, cy)
  ctx.lineTo(cx + 4, cy - 21)
  ctx.lineTo(cx, cy - 23)
  ctx.lineTo(cx - 4, cy - 21)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 0.7
  ctx.stroke()

  // Capital (top wider block)
  ctx.fillStyle = '#484848'
  ctx.beginPath()
  ctx.moveTo(cx - 5, cy - 21)
  ctx.lineTo(cx + 5, cy - 21)
  ctx.lineTo(cx + 5, cy - 23)
  ctx.lineTo(cx, cy - 25)
  ctx.lineTo(cx - 5, cy - 23)
  ctx.closePath()
  ctx.fill()

  // Main crack — jagged vertical fissure
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(cx + 1, cy - 2)
  ctx.lineTo(cx - 1, cy - 7)
  ctx.lineTo(cx + 2, cy - 12)
  ctx.lineTo(cx - 1, cy - 17)
  ctx.lineTo(cx + 1, cy - 21)
  ctx.stroke()

  // Mortar fill in crack — lighter grey, suggesting repair
  ctx.strokeStyle = 'rgba(160,150,130,0.45)'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(cx + 1, cy - 2)
  ctx.lineTo(cx - 1, cy - 7)
  ctx.lineTo(cx + 2, cy - 12)
  ctx.lineTo(cx - 1, cy - 17)
  ctx.lineTo(cx + 1, cy - 21)
  ctx.stroke()
}

function drawNuclearRuinRevealedTile(ctx, sx, sy) {
  // Clearly a reactor after the twist — circular containment dome remnant,
  // warning chevrons, broken coolant pipes.
  diamond(ctx, sx, sy, '#2a2826', 'rgba(0,0,0,0.5)')
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx, sy); ctx.lineTo(sx + TW2, sy + TH2)
  ctx.lineTo(sx, sy + TILE_H); ctx.lineTo(sx - TW2, sy + TH2)
  ctx.closePath(); ctx.clip()

  // Containment ring — oval outline of the dome footprint
  ctx.beginPath(); ctx.ellipse(sx, sy+TH2, TW2*0.65, TH2*0.55, 0, 0, Math.PI*2)
  ctx.strokeStyle = '#5a5450'; ctx.lineWidth = 2.5; ctx.stroke()
  ctx.strokeStyle = 'rgba(200,180,60,0.35)'; ctx.lineWidth = 1.2; ctx.stroke()

  // Warning chevrons — yellow/black pattern on the ring
  ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.ellipse(sx, sy+TH2, TW2*0.65, TH2*0.55, 0, 0, Math.PI*2)
  ctx.strokeStyle = 'rgba(220,200,40,0.4)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.setLineDash([])

  // Broken coolant pipes stubs
  for (const [ox, oy] of [[-TW2*0.4, 0],[TW2*0.4, 0]]) {
    ctx.fillStyle = '#5a5050'
    ctx.fillRect(sx+ox-2, sy+TH2+oy-3, 4, 6)
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.5
    ctx.strokeRect(sx+ox-2, sy+TH2+oy-3, 4, 6)
  }

  // Partial trefoil radiation symbol, cracked and faded
  ctx.globalAlpha = 0.22
  ctx.fillStyle = '#d4c040'
  ctx.beginPath(); ctx.arc(sx, sy+TH2-1, 4, 0, Math.PI*2); ctx.fill()
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2 / 3) - Math.PI / 2
    ctx.beginPath()
    ctx.arc(sx + Math.cos(a)*7, sy+TH2-1 + Math.sin(a)*4.5, 3.5, 0, Math.PI*2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Crack lines
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(sx-8, sy+TH2-4); ctx.lineTo(sx+2, sy+TH2+5); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx+7, sy+TH2-2); ctx.lineTo(sx-1, sy+TH2+6); ctx.stroke()
  ctx.restore()
}

// ── Era 3 heart: forge ────────────────────────────────────────────────────────

function drawForge(ctx, sx, sy, fuelFraction) {
  const base = sy + TH2 + 4
  ctx.save()
  ctx.translate(sx, base)

  // Forge body — squat stone box with a front opening
  // Back wall
  ctx.fillStyle = '#4a3828'; ctx.fillRect(-12, -24, 24, 16)
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5; ctx.strokeRect(-12, -24, 24, 16)
  // Left side (darker)
  ctx.fillStyle = '#382818'
  ctx.beginPath(); ctx.moveTo(-12,-24); ctx.lineTo(-16,-20); ctx.lineTo(-16,-6); ctx.lineTo(-12,-8); ctx.closePath(); ctx.fill()
  // Top (lighter)
  ctx.fillStyle = '#5a4838'
  ctx.beginPath(); ctx.moveTo(-12,-24); ctx.lineTo(0,-28); ctx.lineTo(12,-24); ctx.lineTo(0,-20); ctx.closePath(); ctx.fill()
  // Forge mouth — glowing opening
  const mouthColor = `rgba(255,${100 + fuelFraction*80},20,${0.8 + fuelFraction*0.2})`
  ctx.fillStyle = mouthColor
  ctx.fillRect(-7, -20, 14, 10)
  // Inner glow
  const ig = ctx.createRadialGradient(0, -14, 0, 0, -14, 10)
  ig.addColorStop(0, `rgba(255,200,50,${0.7*fuelFraction})`); ig.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = ig; ctx.fillRect(-10, -22, 20, 14)
  // Chimney stack
  ctx.fillStyle = '#3a2818'; ctx.fillRect(-4, -36, 8, 14)
  ctx.fillStyle = '#4a3828'; ctx.fillRect(-5, -38, 10, 4)

  ctx.restore()

  // Smoke from chimney
  if (fuelFraction > 0.2) {
    ctx.fillStyle = `rgba(60,50,40,${0.25 * fuelFraction})`
    for (const [ox, oy] of [[-1,-46],[1,-52],[-2,-58]]) {
      ctx.beginPath(); ctx.arc(sx+ox, base+oy, 3.5+Math.abs(oy)*0.04, 0, Math.PI*2); ctx.fill()
    }
  }
  // Sparks from mouth
  if (fuelFraction > 0.3) {
    ctx.fillStyle = `rgba(255,180,30,${0.7*fuelFraction})`
    for (const [ox, oy] of [[-5,-26],[3,-28],[0,-30],[6,-24]]) {
      ctx.beginPath(); ctx.arc(sx+ox, base+oy, 0.8, 0, Math.PI*2); ctx.fill()
    }
  }
}

// ── Era 4 heart: steam boiler ─────────────────────────────────────────────────

function drawBoiler(ctx, sx, sy, fuelFraction) {
  const base = sy + TH2 + 6
  ctx.save()
  ctx.translate(sx, base)

  // Boiler drum — horizontal cylinder in iso
  // Main barrel (dark metal)
  ctx.fillStyle = '#4a5060'
  ctx.beginPath(); ctx.ellipse(0, -20, 14, 8, 0, 0, Math.PI*2); ctx.fill()
  ctx.strokeStyle = '#606878'; ctx.lineWidth = 1; ctx.stroke()
  // Barrel body rectangle
  ctx.fillStyle = '#505868'
  ctx.fillRect(-14, -30, 28, 14)
  ctx.strokeStyle = '#606878'; ctx.lineWidth = 0.5; ctx.strokeRect(-14, -30, 28, 14)
  // Heat-reddened bottom
  const heatG = ctx.createLinearGradient(0, -16, 0, -8)
  heatG.addColorStop(0, 'rgba(255,80,20,0)'); heatG.addColorStop(1, `rgba(255,80,20,${0.4*fuelFraction})`)
  ctx.fillStyle = heatG; ctx.fillRect(-14, -16, 28, 8)
  // Boiler end cap
  ctx.fillStyle = '#686e80'
  ctx.beginPath(); ctx.ellipse(-14, -22, 5, 10, 0, 0, Math.PI*2); ctx.fill()
  ctx.strokeStyle = '#808898'; ctx.lineWidth = 0.7; ctx.stroke()
  // Pressure gauge
  ctx.fillStyle = '#a0a8b0'; ctx.beginPath(); ctx.arc(6, -28, 3.5, 0, Math.PI*2); ctx.fill()
  ctx.strokeStyle = '#606878'; ctx.lineWidth = 0.5; ctx.stroke()
  // Steam pipes — vertical
  for (const ox of [-8, 6]) {
    ctx.fillStyle = '#606878'; ctx.fillRect(ox-2, -44, 4, 16)
    // Steam puffs
    if (fuelFraction > 0.25) {
      const sa = 0.35 * fuelFraction
      ctx.fillStyle = `rgba(200,210,220,${sa})`
      ctx.beginPath(); ctx.arc(ox, -46, 5, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc(ox+2, -52, 4, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc(ox-1, -57, 3, 0, Math.PI*2); ctx.fill()
    }
  }
  // Firebox glow at base
  const fbG = ctx.createRadialGradient(0, -6, 0, 0, -6, 16)
  fbG.addColorStop(0, `rgba(255,120,20,${0.5*fuelFraction})`); fbG.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = fbG; ctx.fillRect(-16, -16, 32, 16)

  ctx.restore()
}

// ── Era 5 heart: nuclear reactor ─────────────────────────────────────────────

function drawReactor(ctx, sx, sy, fuelFraction) {
  const base = sy + TH2 + 2
  ctx.save()
  ctx.translate(sx, base)

  // Containment dome — low concrete dome in iso view
  // Base ring
  ctx.fillStyle = '#4a5250'
  ctx.beginPath(); ctx.ellipse(0, -4, 18, 8, 0, 0, Math.PI*2); ctx.fill()
  ctx.strokeStyle = '#606a68'; ctx.lineWidth = 1; ctx.stroke()
  // Dome body
  ctx.fillStyle = '#505a58'
  ctx.beginPath(); ctx.ellipse(0, -4, 18, 8, 0, Math.PI, 0); ctx.fill()
  // Safety stripe ring
  ctx.strokeStyle = 'rgba(220,180,20,0.6)'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.ellipse(0, -4, 18, 8, 0, 0, Math.PI*2); ctx.stroke()
  // Dome
  ctx.fillStyle = '#587070'
  for (let i = 0; i > -20; i -= 4) {
    const r = 18 - Math.abs(i) * 0.5
    ctx.beginPath(); ctx.ellipse(0, i-4, r, r*0.4, 0, Math.PI, 0)
    ctx.fillStyle = `hsl(175,15%,${30 + Math.abs(i)*1.2}%)`; ctx.fill()
  }
  // Central vent chimney
  ctx.fillStyle = '#405058'; ctx.fillRect(-4, -32, 8, 14)
  ctx.fillStyle = '#506068'; ctx.fillRect(-5, -34, 10, 4)

  // Reactor glow — green radiation light
  const glowA = 0.25 + fuelFraction * 0.25
  const rg = ctx.createRadialGradient(0, -4, 0, 0, -4, 22)
  rg.addColorStop(0, `rgba(80,255,60,${glowA})`); rg.addColorStop(0.5, `rgba(40,200,30,${glowA*0.3})`); rg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = rg; ctx.fillRect(-22, -30, 44, 36)

  // Cooling tower outlines (suggestion — Era 5 landmark)
  for (const ox of [-22, 22]) {
    ctx.strokeStyle = 'rgba(80,100,90,0.7)'; ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(ox-4, 4); ctx.lineTo(ox-2, -16); ctx.lineTo(ox+2, -16); ctx.lineTo(ox+4, 4)
    ctx.stroke()
    // Steam
    if (fuelFraction > 0.2) {
      ctx.fillStyle = `rgba(160,180,180,${0.2*fuelFraction})`
      ctx.beginPath(); ctx.arc(ox, -20, 4, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc(ox+1, -26, 3, 0, Math.PI*2); ctx.fill()
    }
  }

  ctx.restore()
}

// ── Era 6 heart: solar array ──────────────────────────────────────────────────

function drawSolar(ctx, sx, sy) {
  const base = sy + TH2 + 2
  ctx.save()
  ctx.translate(sx, base)

  // Central energy node — crystalline pillar
  ctx.fillStyle = '#607898'
  ctx.fillRect(-5, -28, 10, 22)
  ctx.strokeStyle = '#90b0d0'; ctx.lineWidth = 0.8; ctx.strokeRect(-5, -28, 10, 22)
  // Pillar glow
  const pg = ctx.createRadialGradient(0, -16, 0, 0, -16, 12)
  pg.addColorStop(0, 'rgba(150,210,255,0.5)'); pg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = pg; ctx.fillRect(-12, -30, 24, 28)

  // Solar panels — flat blue-grey tiles arranged in fan
  const panels = [{ ox:-18, oy:-8, a:-0.3 },{ ox:-10, oy:-14, a:-0.15 },{ ox:10, oy:-14, a:0.15 },{ ox:18, oy:-8, a:0.3 }]
  for (const { ox, oy, a } of panels) {
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(a)
    // Panel face
    ctx.fillStyle = '#4060a0'
    ctx.fillRect(-5, -2, 10, 6)
    // Panel grid lines
    ctx.strokeStyle = 'rgba(100,150,220,0.6)'; ctx.lineWidth = 0.5
    ctx.strokeRect(-5, -2, 10, 6)
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-5, 1); ctx.lineTo(5, 1); ctx.stroke()
    // Panel sheen
    ctx.fillStyle = 'rgba(140,200,255,0.2)'
    ctx.fillRect(-5, -2, 5, 3)
    // Support arm
    ctx.fillStyle = '#808898'; ctx.fillRect(-1, 4, 2, 8)
    ctx.restore()
  }

  // Ambient clean energy glow — cool white-blue
  const ag = ctx.createRadialGradient(0, -12, 0, 0, -12, 28)
  ag.addColorStop(0, 'rgba(180,220,255,0.22)'); ag.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = ag; ctx.fillRect(-28, -40, 56, 50)

  ctx.restore()
}

// ── Era 2 heart: stone hearth ─────────────────────────────────────────────────
// A squat stone arch enclosing a stronger, more even flame than the campfire.

function drawHearth(ctx, sx, sy, fuelFraction) {
  const base = sy + TH2 + 2

  // Stone base slab — isometric rectangle low to the ground
  ctx.save()
  ctx.translate(sx, base)

  // Left face (dark)
  ctx.beginPath()
  ctx.moveTo(-14, -4)
  ctx.lineTo(-14, 2)
  ctx.lineTo(0,   8)
  ctx.lineTo(0,   2)
  ctx.closePath()
  ctx.fillStyle = '#5a5040'
  ctx.fill()

  // Right face (mid)
  ctx.beginPath()
  ctx.moveTo(14, -4)
  ctx.lineTo(14, 2)
  ctx.lineTo(0,  8)
  ctx.lineTo(0,  2)
  ctx.closePath()
  ctx.fillStyle = '#6a6050'
  ctx.fill()

  // Top face (lighter)
  ctx.beginPath()
  ctx.moveTo(-14, -4)
  ctx.lineTo(0,   -10)
  ctx.lineTo(14,  -4)
  ctx.lineTo(0,    2)
  ctx.closePath()
  ctx.fillStyle = '#7a7060'
  ctx.fill()

  // Stone arch pillars — two upright blocks on left/right
  for (const ox of [-10, 10]) {
    // Pillar body
    ctx.fillStyle = '#6a6050'
    ctx.fillRect(ox - 3.5, -18, 7, 10)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(ox - 3.5, -18, 7, 10)
    // Pillar cap
    ctx.fillStyle = '#8a8070'
    ctx.fillRect(ox - 4, -20, 8, 3)
  }

  // Arch lintel connecting the pillars (slightly concave suggestion)
  ctx.fillStyle = '#6e6454'
  ctx.fillRect(-10, -22, 20, 4)
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 0.5
  ctx.strokeRect(-10, -22, 20, 4)

  ctx.restore()

  // Flames inside the hearth — taller and more golden than campfire
  const flameH = 9 + fuelFraction * 12
  const flameA = 0.80 + fuelFraction * 0.20
  const flameLayers = [
    { oy: 0,              rx: 7,   ry: flameH,        color: `rgba(255,90,15,${flameA})` },
    { oy: -flameH * 0.3,  rx: 4.5, ry: flameH * 0.75, color: `rgba(255,170,30,${flameA})` },
    { oy: -flameH * 0.55, rx: 2.5, ry: flameH * 0.5,  color: `rgba(255,230,80,${flameA * 0.9})` },
    { oy: -flameH * 0.72, rx: 1.2, ry: flameH * 0.28, color: `rgba(255,255,200,${flameA * 0.7})` },
  ]
  for (const { oy, rx, ry, color } of flameLayers) {
    ctx.beginPath()
    ctx.ellipse(sx, base - 10 + oy, rx, ry, 0, Math.PI, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  // Embers
  if (fuelFraction > 0.1) {
    ctx.fillStyle = 'rgba(255,210,60,0.75)'
    for (const [ox, oy] of [[-4, -flameH - 12], [3, -flameH - 16], [0, -flameH - 10], [-2, -flameH - 18]]) {
      ctx.beginPath()
      ctx.arc(sx + ox, base + oy, 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawForestTile(ctx, sx, sy, floorColor = '#1e3a12') {
  // Dark forest floor
  diamond(ctx, sx, sy, floorColor, 'rgba(0,0,0,0.2)')

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

// ── Chimney (house upgrade) ───────────────────────────────────────────────────

export function drawChimney(ctx, sx, sy) {
  const cx = sx + 6, cy = sy - 24
  ctx.fillStyle = '#6a4830'
  ctx.fillRect(cx - 3, cy - 10, 6, 10)
  ctx.fillStyle = '#2a1a0a'
  ctx.fillRect(cx - 2, cy - 10, 4, 3)
  ctx.fillStyle = '#4a3020'
  ctx.fillRect(cx + 3, cy - 9, 2, 9)
  ctx.fillStyle = '#8a6040'
  ctx.fillRect(cx - 4, cy - 11, 8, 2)
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

// ── Log piles ──────────────────────────────────────────────────────────────────
// Drawn as small stacked brown ovals at each log pile position.

export function drawLogPiles(ctx, world, camX, camY, canvasW, canvasH) {
  for (const pile of (world.logPiles || [])) {
    if (pile.count <= 0) continue
    const { sx, sy } = tileToScreen(pile.col, pile.row, camX, camY, canvasW, canvasH)
    const n = Math.min(pile.count, 3)
    for (let i = 0; i < n; i++) {
      ctx.save()
      ctx.translate(sx + (i - 1) * 7, sy + TH2 - 6 - i * 3)
      ctx.scale(1, 0.5)
      ctx.beginPath()
      ctx.arc(0, 0, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#8a5c28'
      ctx.fill()
      ctx.strokeStyle = '#5a3808'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }
    if (pile.count > 3) {
      ctx.fillStyle = '#ffe0a0'
      ctx.font = 'bold 8px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`×${pile.count}`, sx, sy + TH2 - 14)
      ctx.textAlign = 'left'
    }
  }
}

// ── Villager ───────────────────────────────────────────────────────────────────

export function drawVillager(ctx, sx, sy, citizen) {
  const bob        = Math.sin(citizen.bounce) * 2.5
  const isGuard    = citizen.role === 'guard'
  // Flash amber on odd chop phases to visualise the axe swing
  const isChopping = citizen.task === 'chop' && citizen.state === 'working' && ((citizen.chopPhase || 0) % 2 === 1)
  const color      = isGuard ? '#a06040' : isChopping ? '#e8c050' : ((citizen.task && TASKS[citizen.task]?.color) || '#a8a098')
  const px       = sx
  const py       = sy + TH2 - 10 + bob

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

  // Guard helmet — small dark cap
  if (isGuard) {
    ctx.beginPath()
    ctx.arc(px, py - 11, 3.5, Math.PI, 0)
    ctx.fillStyle = '#604030'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = 0.6
    ctx.stroke()
  }

  // Carrying indicator (workers only)
  if (!isGuard && citizen.carrying) {
    const dotColor = citizen.carrying.resource === 'food' ? '#78d878' : '#c8a060'
    ctx.beginPath()
    ctx.arc(px + 7, py - 4, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = dotColor
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  // Guard spear — small dot-and-line indicator above body
  if (isGuard && citizen.state === 'guard_patrol') {
    ctx.strokeStyle = 'rgba(160,120,60,0.85)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px + 7, py - 2)
    ctx.lineTo(px + 7, py - 16)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(px + 5, py - 16)
    ctx.lineTo(px + 9, py - 14)
    ctx.strokeStyle = 'rgba(200,180,80,0.9)'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
}
