import type { Graph } from './graph';

export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 600;
export const TERRAIN_COLS = 90;
export const TERRAIN_ROWS = 60;

export interface TerrainField {
  cols: number;
  rows: number;
  data: Float32Array;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Create an empty 90x60 light/obstacle cost field aligned to the 900x600 canvas. */
export function createTerrain(): TerrainField {
  return {
    cols: TERRAIN_COLS,
    rows: TERRAIN_ROWS,
    data: new Float32Array(TERRAIN_COLS * TERRAIN_ROWS),
  };
}

/** Reset all terrain cells back to clear (0). */
export function clearTerrain(field: TerrainField): void {
  field.data.fill(0);
}

/** Return a deep copy of a terrain field. */
export function cloneTerrain(field: TerrainField): TerrainField {
  return {
    cols: field.cols,
    rows: field.rows,
    data: new Float32Array(field.data),
  };
}

/** Check whether any terrain cell has non-trivial obstacle weight. */
export function hasTerrainObstacles(field: TerrainField | null | undefined, threshold = 0.01): boolean {
  if (!field) return false;
  for (let i = 0; i < field.data.length; i++) {
    if (field.data[i] > threshold) return true;
  }
  return false;
}

/** Paint a circular obstacle/light brush (value=1 blocks, value=0 erases). */
export function paintTerrainDisk(
  field: TerrainField,
  x: number,
  y: number,
  radiusPx: number,
  value: number,
): void {
  const cellW = CANVAS_WIDTH / field.cols;
  const cellH = CANVAS_HEIGHT / field.rows;
  const clampedValue = clamp01(value);
  const r2 = radiusPx * radiusPx;
  const minCol = Math.max(0, Math.floor((x - radiusPx) / cellW));
  const maxCol = Math.min(field.cols - 1, Math.ceil((x + radiusPx) / cellW));
  const minRow = Math.max(0, Math.floor((y - radiusPx) / cellH));
  const maxRow = Math.min(field.rows - 1, Math.ceil((y + radiusPx) / cellH));

  for (let row = minRow; row <= maxRow; row++) {
    const cy = (row + 0.5) * cellH;
    const dy = cy - y;
    for (let col = minCol; col <= maxCol; col++) {
      const cx = (col + 0.5) * cellW;
      const dx = cx - x;
      if (dx * dx + dy * dy <= r2) {
        field.data[row * field.cols + col] = clampedValue;
      }
    }
  }
}

function pointInPolygon(x: number, y: number, polygon: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Rasterize a polygon region (e.g. Tokyo Bay) onto the terrain cost grid. */
export function paintTerrainPolygon(
  field: TerrainField,
  points: Array<[number, number]>,
  value = 0.9,
): void {
  if (points.length < 3) return;
  const cellW = CANVAS_WIDTH / field.cols;
  const cellH = CANVAS_HEIGHT / field.rows;
  const clampedValue = clamp01(value);

  for (let row = 0; row < field.rows; row++) {
    const cy = (row + 0.5) * cellH;
    for (let col = 0; col < field.cols; col++) {
      const cx = (col + 0.5) * cellW;
      if (pointInPolygon(cx, cy, points)) {
        field.data[row * field.cols + col] = Math.max(field.data[row * field.cols + col], clampedValue);
      }
    }
  }
}

/** Sample obstacle intensity in [0, 1] at canvas pixel coordinates (x, y). */
export function sampleTerrain(field: TerrainField, x: number, y: number): number {
  const col = Math.min(field.cols - 1, Math.max(0, Math.floor((x / CANVAS_WIDTH) * field.cols)));
  const row = Math.min(field.rows - 1, Math.max(0, Math.floor((y / CANVAS_HEIGHT) * field.rows)));
  return field.data[row * field.cols + col] ?? 0;
}

/** Apply terrain impedance to graph edges via edge.costFactor = 1 + strength * meanTerrain. */
export function applyTerrainToGraph(
  graph: Graph,
  field: TerrainField | null,
  strength = 4.0,
): void {
  if (!field || !hasTerrainObstacles(field, 0)) {
    for (const edge of graph.edges) edge.costFactor = 1;
    return;
  }
  const samples = 5;
  for (const edge of graph.edges) {
    const a = graph.nodes[edge.i];
    const b = graph.nodes[edge.j];
    let sum = 0;
    for (let s = 0; s < samples; s++) {
      const t = s / (samples - 1);
      sum += sampleTerrain(field, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }
    const meanTerrain = sum / samples;
    edge.costFactor = 1 + strength * meanTerrain;
  }
}

/** Convert an image's luminance into a light/obstacle terrain grid (bright=obstacle by default). */
export function terrainFromImageData(imageData: ImageData, invert = false): TerrainField {
  const field = createTerrain();
  const { width, height, data } = imageData;
  if (width <= 0 || height <= 0) return field;

  for (let row = 0; row < field.rows; row++) {
    const py = Math.min(height - 1, Math.floor(((row + 0.5) / field.rows) * height));
    for (let col = 0; col < field.cols; col++) {
      const px = Math.min(width - 1, Math.floor(((col + 0.5) / field.cols) * width));
      const idx = (py * width + px) * 4;
      const r = data[idx] ?? 0;
      const g = data[idx + 1] ?? 0;
      const b = data[idx + 2] ?? 0;
      const a = (data[idx + 3] ?? 255) / 255;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const raw = invert ? 1 - lum : lum;
      field.data[row * field.cols + col] = clamp01(raw * a);
    }
  }
  return field;
}
