import type { FlowMode, GraphMode, Node } from './graph';

export interface SharedStateV1 {
  version: 1;
  nodes: Node[];
  mode: GraphMode;
  mu: number;
  dt: number;
  speed: number;
  seed: number;
}

export interface SharedStateV2 {
  version: 2;
  nodes: Node[];
  mode: GraphMode;
  flowMode: FlowMode;
  mu: number;
  dt: number;
  speed: number;
  seed: number;
}

export type SharedState = SharedStateV1 | SharedStateV2;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function sanitizeState(candidate: unknown): SharedState | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const raw = candidate as Partial<SharedStateV2> & { version?: number };
  if (!Array.isArray(raw.nodes) || raw.nodes.length > 100) return null;

  const nodes: Node[] = [];
  for (let index = 0; index < raw.nodes.length; index++) {
    const value = raw.nodes[index] as Partial<Node>;
    if (!value || typeof value !== 'object') return null;
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.flow)) {
      return null;
    }
    const cleanNode: Node = {
      id: index,
      x: clamp(Number(value.x), 0, 900),
      y: clamp(Number(value.y), 0, 600),
      flow: Math.sign(Number(value.flow)),
    };
    if (typeof value.label === 'string' && value.label.trim().length > 0) {
      cleanNode.label = value.label.trim().slice(0, 24);
    }
    nodes.push(cleanNode);
  }

  const mode: GraphMode = raw.mode === 'delaunay' ? 'delaunay' : 'complete';
  const mu = clamp(Number(raw.mu) || 1.2, 0.5, 2);
  const dt = clamp(Number(raw.dt) || 0.05, 0.01, 0.2);
  const speed = Math.round(clamp(Number(raw.speed) || 8, 1, 24));
  const seed = Math.max(1, Math.trunc(Number(raw.seed) || 1) >>> 0);

  if (raw.version === 2 || raw.flowMode === 'multi-terminal') {
    const flowMode: FlowMode = raw.flowMode === 'multi-terminal' ? 'multi-terminal' : 'source-sink';
    return { version: 2, nodes, mode, flowMode, mu, dt, speed, seed };
  }

  return { version: 1, nodes, mode, mu, dt, speed, seed };
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
