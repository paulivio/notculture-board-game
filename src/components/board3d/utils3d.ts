import { SPIRAL_PATH, GRID_SIZE } from "../../lib/constants";

export const CELL_SIZE = 1.0;
export const TILE_HEIGHT = 0.18;
export const BOARD_THICKNESS = 0.12;
export const PAWN_SCALE = 0.28;

export const HOP_HEIGHT = 0.25;
export const CHARACTER_SCALE = 0.30;

// Ordered fallback lists — first matching clip in the loaded GLTF wins
export const ANIM_IDLE = ['Idle_A', 'Idle_B', 'Idle_C', 'Idle', 'idle', 'Stand'];
export const ANIM_WALK = ['Jump_Full_Short', 'Jump_Full_Long', 'Walking_A', 'Walking_B', 'Walking_C', 'Running_A', 'Running_B', 'Walk', 'Run'];

/** Map an 8×8 grid index (0–63) to world [x, TILE_HEIGHT, z]. Board centred at origin. */
export function gridIndexTo3D(gridIndex: number): [number, number, number] {
  const row = Math.floor(gridIndex / GRID_SIZE);
  const col = gridIndex % GRID_SIZE;
  const x = (col - 3.5) * CELL_SIZE;
  const z = (row - 3.5) * CELL_SIZE;
  return [x, TILE_HEIGHT, z];
}

/** Map a spiral path index (0–47) to world coordinates. */
export function pathIndexTo3D(pathIndex: number): [number, number, number] {
  return gridIndexTo3D(SPIRAL_PATH[pathIndex]);
}

/**
 * For N players sharing a position, return the world [x, y, z] for player myIndex.
 * Mirrors the 2D PlayerToken circle logic but on the XZ plane.
 */
export function multiPlayerPositions(
  pathIndex: number,
  myIndex: number,
  totalAtPos: number,
): [number, number, number] {
  const [cx, cy, cz] = pathIndexTo3D(pathIndex);
  if (totalAtPos <= 1) return [cx, cy, cz];
  const radius = CELL_SIZE * 0.22;
  const angle = (2 * Math.PI * myIndex) / totalAtPos;
  return [cx + Math.cos(angle) * radius, cy, cz + Math.sin(angle) * radius];
}
