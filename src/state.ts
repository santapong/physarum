import type { GraphMode, Node } from './graph';

export interface SharedState {
  version: 1;
  nodes: Node[];
  mode: GraphMode;
  mu: number;
  dt: number;
  speed: number;
  seed: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function sanitizeState(candidate: unknown): SharedState | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const raw = candidate as Partial<SharedState>;
  if (!Array.isArray(raw.nodes) || raw.nodes.length > 80) return null;
  const nodes: Node[] = [];
  for (let index = 0; index < raw.nodes.length; index++) {
    const value = raw.nodes[index] as Partial<Node>;
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.flow)) return null;
    nodes.push({
      id: index,
      x: clamp(Number(value.x), 0, 900),
      y: clamp(Number(value.y), 0, 600),
      flow: Math.sign(Number(value.flow)),
    });
  }
  return {
    version: 1,
    nodes,
    mode: raw.mode === 'delaunay' ? 'delaunay' : 'complete',
    mu: clamp(Number(raw.mu) || 1.2, 0.5, 2),
    dt: clamp(Number(raw.dt) || 0.05, 0.01, 0.2),
    speed: Math.round(clamp(Number(raw.speed) || 8, 1, 24)),
    seed: Math.max(1, Math.trunc(Number(raw.seed) || 1) >>> 0),
  };
}

export function encodeState(state: SharedState): string {
  return encodeURIComponent(JSON.stringify(state));
}

export function decodeState(encoded: string): SharedState | null {
  try {
    return sanitizeState(JSON.parse(decodeURIComponent(encoded)));
  } catch {
    return null;
  }
}

export function stateFromHash(hash: string): SharedState | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const encoded = params.get('state');
  return encoded ? decodeState(encoded) : null;
}

