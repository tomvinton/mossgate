// ── Mossgate — Camera System ───────────────────────────────────────────────────

import { TILE_W, TILE_H } from '../engine/config.js'

const TILE_W2 = TILE_W / 2
const TILE_H2 = TILE_H / 2

export function createCamera() {
  return {
    x:      0,
    y:      -TILE_H * 2,
    tx:     0,
    ty:     -TILE_H * 2,
    zoom:   2.0,    // current zoom (starts close-up)
    tz:     2.0,    // target zoom
    ease:   0.04,   // pan lerp speed per tick
    zEase:  0.025,  // zoom lerp speed per render frame
    // Bounds set each tick from built building extents; consumed by updateZoom in draw loop
    _boundsW: 0,
    _boundsH: 0,
  }
}

// Called each sim tick — tracks centroid and bounds of all built buildings
export function updateCamera(camera, world) {
  const built = world.buildings.filter(b => b.isBuilt)

  if (built.length > 0) {
    let sumX = 0, sumY = 0
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

    for (const b of built) {
      const wx = (b.col - b.row) * TILE_W2
      const wy = (b.col + b.row) * TILE_H2
      sumX += wx; sumY += wy
      if (wx < minX) minX = wx
      if (wx > maxX) maxX = wx
      if (wy < minY) minY = wy
      if (wy > maxY) maxY = wy
    }

    // Pan target: centroid of all built buildings
    camera.tx = sumX / built.length
    camera.ty = sumY / built.length

    // Bounds with generous padding so city isn't clipped at edges
    camera._boundsW = (maxX - minX) + TILE_W * 8
    camera._boundsH = (maxY - minY) + TILE_H * 14
  }

  // Lerp pan position toward target
  camera.x += (camera.tx - camera.x) * camera.ease
  camera.y += (camera.ty - camera.y) * camera.ease
}

// Called each render frame — computes target zoom from building bounds and lerps
export function updateZoom(camera, W, H) {
  if (camera._boundsW > 0 && W > 0 && H > 0) {
    const targetZoom = Math.min(
      W / camera._boundsW,
      H / camera._boundsH,
      2.0    // never zoom in beyond 2× starting scale
    )
    camera.tz = Math.max(0.3, targetZoom)
  }
  camera.zoom += (camera.tz - camera.zoom) * camera.zEase
}

// Called by pan input — dx/dy are screen-space deltas; divide by zoom for world-space
export function panCamera(camera, dx, dy) {
  const z = camera.zoom || 1
  camera.x  -= dx / z
  camera.y  -= dy / z
  camera.tx  = camera.x
  camera.ty  = camera.y
}
