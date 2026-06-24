// ── Mossgate — Camera System ───────────────────────────────────────────────────

import { TILE_W, TILE_H } from '../engine/config.js'

const TILE_W2 = TILE_W / 2
const TILE_H2 = TILE_H / 2

function tileToCamPos(col, row) {
  return {
    x: (col - row) * TILE_W2,
    y: (col + row) * TILE_H2 + TILE_H2,
  }
}

export function createCamera() {
  return {
    x:    0,
    y:    -TILE_H * 2,
    tx:   0,
    ty:   -TILE_H * 2,
    ease: 0.06,   // lerp speed toward snap target
  }
}

// Called every tick — only snaps when a new building is completed
export function updateCamera(camera, world) {
  if (world.newBuilding) {
    const pos = tileToCamPos(world.newBuilding.col, world.newBuilding.row)
    camera.tx = pos.x
    camera.ty = pos.y
    world.newBuilding = null
  }

  // Lerp toward target (only meaningful right after a snap)
  camera.x += (camera.tx - camera.x) * camera.ease
  camera.y += (camera.ty - camera.y) * camera.ease
}

// Called by pan input — immediately shifts both current and target position
export function panCamera(camera, dx, dy) {
  camera.x  -= dx
  camera.y  -= dy
  camera.tx  = camera.x
  camera.ty  = camera.y
}
