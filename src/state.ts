import type { DynamicsMode, FlowMode, GraphMode, LabDomain, Node } from './graph';
import { readPoEdits, type PoOperationEdit } from './po-routing';

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

export interface SharedStateV3 {
  version: 3;
  domain: LabDomain;
  dynamicsMode: DynamicsMode;
  nodes: Node[];
  mode: GraphMode;
  flowMode: FlowMode;
  mu: number;
  dt: number;
  speed: number;
  seed: number;
  presetId?: string;
  maxRadiusMm?: number;
  poEdits?: PoOperationEdit[];
  fjspShiftCap?: boolean;
  capacities?: Array<{ i: number; j: number; capacity: number }>;
}

export type SharedState = SharedStateV1 | SharedStateV2 | SharedStateV3;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function sanitizeState(candidate: unknown): SharedState | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const raw = candidate as Omit<Partial<SharedStateV3>, 'version'> & { version?: number };
  if (!Array.isArray(raw.nodes) || raw.nodes.length > 100) return null;

  const isV3 = raw.version === 3;
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
      flow: isV3 ? clamp(Number(value.flow), -100, 100) : Math.sign(Number(value.flow)),
    };
    if (typeof value.label === 'string' && value.label.trim().length > 0) {
      cleanNode.label = value.label.trim().slice(0, 24);
    }
    if (
      isV3 &&
      (value.role === 'query' ||
        value.role === 'supplier' ||
        value.role === 'hub' ||
        value.role === 'evidence' ||
        value.role === 'private' ||
        value.role === 'noise')
    ) {
      cleanNode.role = value.role;
    }
    if (isV3 && typeof value.room === 'string' && value.room.trim().length > 0) {
      cleanNode.room = value.room.trim().slice(0, 32);
    }
    nodes.push(cleanNode);
  }

  const mode: GraphMode =
    raw.mode === 'delaunay' ? 'delaunay' : raw.mode === 'explicit' ? 'explicit' : 'complete';
  const mu = clamp(Number(raw.mu) || 1.2, 0.5, 2);
  const dt = clamp(Number(raw.dt) || 0.05, 0.01, 0.2);
  const speed = Math.round(clamp(Number(raw.speed) || 8, 1, 24));
  const seed = Math.max(1, Math.trunc(Number(raw.seed) || 1) >>> 0);

  if (isV3) {
    const domain: LabDomain =
      raw.domain === 'vascular' ||
      raw.domain === 'optimization' ||
      raw.domain === 'fjsp' ||
      raw.domain === 'graphrag' ||
      raw.domain === 'systems'
        ? raw.domain
        : 'transport';
    const dynamicsMode: DynamicsMode =
      raw.dynamicsMode === 'murray' || raw.dynamicsMode === 'linear-lp'
        ? raw.dynamicsMode
        : 'tero';
    const flowMode: FlowMode = raw.flowMode === 'multi-terminal' ? 'multi-terminal' : 'source-sink';
    const stateV3: SharedStateV3 = {
      version: 3,
      domain,
      dynamicsMode,
      nodes,
      mode,
      flowMode,
      mu,
      dt,
      speed,
      seed,
    };
    if (typeof raw.presetId === 'string' && raw.presetId.trim().length > 0) {
      stateV3.presetId = raw.presetId.trim().slice(0, 48);
    }
    if (Number.isFinite(raw.maxRadiusMm)) {
      stateV3.maxRadiusMm = clamp(Number(raw.maxRadiusMm), 0.2, 5.0);
    }
    if (Array.isArray(raw.capacities) && raw.capacities.length > 0) {
      const caps: Array<{ i: number; j: number; capacity: number }> = [];
      for (const entry of raw.capacities.slice(0, 200)) {
        if (!entry || typeof entry !== 'object') continue;
        const ci = Math.trunc(Number(entry.i));
        const cj = Math.trunc(Number(entry.j));
        const cap = Number(entry.capacity);
        if (
          Number.isInteger(ci) &&
          Number.isInteger(cj) &&
          ci >= 0 &&
          cj >= 0 &&
          ci < nodes.length &&
          cj < nodes.length &&
          ci !== cj &&
          Number.isFinite(cap) &&
          cap > 0
        ) {
          caps.push({ i: Math.min(ci, cj), j: Math.max(ci, cj), capacity: clamp(cap, 0.01, 100) });
        }
      }
      if (caps.length > 0) stateV3.capacities = caps;
    }
    if (domain === 'fjsp') {
      if (typeof raw.fjspShiftCap === 'boolean') stateV3.fjspShiftCap = raw.fjspShiftCap;
      const edits = readPoEdits(raw.poEdits);
      if (edits.length) stateV3.poEdits = edits;
    }
    return stateV3;
  }

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
