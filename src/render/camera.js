// ── MossGate — Camera ──────────────────────────────────────────────────────────
// A slow, hands-off camera. It frames the CLAIMED LAND (plus the people roaming it),
// so the view starts tight on the hearth and gently opens out as the settlement
// claims more ground — the world revealing itself as it grows.

import { TILE_W, TILE_H } from '../engine/config.js'

const TW2 = TILE_W / 2
const TH2 = TILE_H / 2
const MAX_ZOOM = 2.2     // closest framing (world birth)
const MIN_ZOOM = 0.45    // furthest framing (large settlement)

export function createCamera() {
  return {
    x: 0, y: -TILE_H,
    tx: 0, ty: -TILE_H,
    zoom: MAX_ZOOM, tz: MAX_ZOOM,
    ease: 0.035, zEase: 0.03,
    _bw: TILE_W * 6, _bh: TILE_H * 6,
  }
}

const wx = (col, row) => (col - row) * TW2
const wy = (col, row) => (col + row) * TH2

// Each sim tick: track the centroid and bounding box of all claimed parcels and the
// citizens working them.
export function updateCamera(camera, world) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  let sumX = 0, sumY = 0, n = 0

  const acc = (x, y) => {
    sumX += x; sumY += y; n++
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }

  for (const p of world.parcels) {
    // Include the parcel's footprint corners so big fields/woodlots frame fully.
    acc(wx(p.col - p.half, p.row - p.half), wy(p.col - p.half, p.row - p.half))
    acc(wx(p.col + p.half, p.row + p.half), wy(p.col + p.half, p.row + p.half))
    acc(wx(p.col + p.half, p.row - p.half), wy(p.col + p.half, p.row - p.half))
    acc(wx(p.col - p.half, p.row + p.half), wy(p.col - p.half, p.row + p.half))
  }
  for (const c of world.citizens) acc(wx(c.x, c.y), wy(c.x, c.y))
  if (n === 0) acc(0, 0)

  camera.tx = sumX / n
  camera.ty = sumY / n
  camera._bw = (maxX - minX) + TILE_W * 5    // padding so nothing hugs the edge
  camera._bh = (maxY - minY) + TILE_H * 7

  camera.x += (camera.tx - camera.x) * camera.ease
  camera.y += (camera.ty - camera.y) * camera.ease
}

// Each render frame: pick the zoom that fits the bounds, and lerp toward it.
export function updateZoom(camera, W, H) {
  if (camera._bw > 0 && W > 0 && H > 0) {
    const fit = Math.min(W / camera._bw, H / camera._bh, MAX_ZOOM)
    camera.tz = Math.max(MIN_ZOOM, fit)
  }
  camera.zoom += (camera.tz - camera.zoom) * camera.zEase
}

// Manual pan (drag). dx/dy are screen pixels; divide by zoom for world space.
export function panCamera(camera, dx, dy) {
  const z = camera.zoom || 1
  camera.x -= dx / z; camera.y -= dy / z
  camera.tx = camera.x; camera.ty = camera.y
}
