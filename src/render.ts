import type { AlloyType, CellSpec, FjspSolution } from './fjsp';
import type { FlowMode, Graph, LabDomain } from './graph';
import type { ErpComparison } from './mrp';
import { effectiveEdgeCost } from './solver';
import type { SystemsEvaluation, SystemsRailStatus } from './systems';
import type { TerrainField } from './terrain';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export interface RenderOptions {
  domain?: LabDomain;
  backgroundImage?: HTMLImageElement | null;
  terrain?: TerrainField | null;
  flowMode?: FlowMode;
  showMst?: boolean;
  mstEdgeIndices?: number[];
  showOptimalBaseline?: boolean;
  optimalEdgeIndices?: number[];
  showPressure?: boolean;
  pressures?: number[];
  showFlowParticles?: boolean;
  phase?: number;
  hoveredEdgeIndex?: number | null;
  showLabels?: boolean;
  showShearHeatmap?: boolean;
  edgeShearNorm?: number[];
  showCapacityBadges?: boolean;
  graphRagViewerScope?: string;
  systemsStageHeaders?: Array<{ label: string; x: number }>;
  systemsRailLabels?: Record<
    string,
    { label: string; sharePct: number; status: SystemsRailStatus }
  >;
}

function shearHeatmapColor(shear: number): string {
  if (!Number.isFinite(shear) || shear <= 0.7) {
    return '#2563eb';
  }
  if (shear <= 1.2) {
    return '#059669';
  }
  if (shear <= 1.65) {
    return '#d97706';
  }
  return '#dc2626';
}

function pressureColor(t: number): string {
  // Cool blue (low pressure) -> slate -> emerald-lime (high pressure)
  const clamped = clamp01(t);
  if (clamped < 0.5) {
    const u = clamped * 2;
    const r = Math.round(lerp(37, 148, u));
    const g = Math.round(lerp(99, 163, u));
    const b = Math.round(lerp(235, 184, u));
    return `rgb(${r}, ${g}, ${b})`;
  }
  const u = (clamped - 0.5) * 2;
  const r = Math.round(lerp(148, 22, u));
  const g = Math.round(lerp(163, 163, u));
  const b = Math.round(lerp(184, 74, u));
  return `rgb(${r}, ${g}, ${b})`;
}

export function render(ctx: CanvasRenderingContext2D, graph: Graph, options: RenderOptions = {}): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (options.backgroundImage?.complete && options.backgroundImage.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(options.backgroundImage, 0, 0, w, h);
    ctx.restore();
  }

  // 1. Light / obstacle terrain mask
  const terrain = options.terrain;
  if (terrain) {
    const cellW = w / terrain.cols;
    const cellH = h / terrain.rows;
    ctx.save();
    for (let row = 0; row < terrain.rows; row++) {
      for (let col = 0; col < terrain.cols; col++) {
        const val = terrain.data[row * terrain.cols + col];
        if (val <= 0.04) continue;
        ctx.fillStyle = `rgba(217, 146, 28, ${(0.34 * val).toFixed(3)})`;
        ctx.fillRect(col * cellW, row * cellH, cellW + 0.6, cellH + 0.6);
      }
    }
    ctx.restore();
  }

  // 2. Optional MST baseline overlay
  if (options.showMst && options.mstEdgeIndices && options.mstEdgeIndices.length > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.58)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 4]);
    for (const idx of options.mstEdgeIndices) {
      const edge = graph.edges[idx];
      if (!edge) continue;
      const a = graph.nodes[edge.i];
      const b = graph.nodes[edge.j];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 2b. Optional exact SSAP Min-Cost Flow / Shortest-Path baseline overlay
  if (
    options.showOptimalBaseline &&
    options.optimalEdgeIndices &&
    options.optimalEdgeIndices.length > 0
  ) {
    ctx.save();
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.72)';
    ctx.lineWidth = 3.2;
    ctx.setLineDash([7, 4]);
    for (const idx of options.optimalEdgeIndices) {
      const edge = graph.edges[idx];
      if (!edge) continue;
      const a = graph.nodes[edge.i];
      const b = graph.nodes[edge.j];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Physarum tubes + severed markers
  const domain = options.domain ?? 'transport';
  if (domain === 'fjsp') {
    const stages = [
      { label: 'Wax', x: 130 },
      { label: 'Casting', x: 252.5 },
      { label: 'Filing', x: 372.5 },
      { label: 'Setting', x: 492.5 },
      { label: 'Polish', x: 612.5 },
      { label: 'Plating', x: 730 },
      { label: 'QC', x: 835 },
    ];
    ctx.save();
    ctx.font = '600 11px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    for (let s = 0; s < stages.length; s++) {
      ctx.fillStyle = '#334155';
      ctx.fillText(stages[s].label.toUpperCase(), stages[s].x, 24);
      if (s > 0) {
        const divX = (stages[s - 1].x + stages[s].x) / 2;
        ctx.beginPath();
        ctx.moveTo(divX, 38);
        ctx.lineTo(divX, h - 20);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  if (domain === 'graphrag') {
    const cols = [
      { label: 'QUERY TERMINALS', x: 95 },
      { label: 'EVIDENCE & CERTS', x: 310 },
      { label: 'SUPPLIERS / HUB', x: 525 },
      { label: 'CATALOG NOISE', x: 785 },
    ];
    const dividers = [202, 405, 660];
    ctx.save();
    ctx.font = '600 11px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    for (const col of cols) {
      ctx.fillStyle = '#334155';
      ctx.fillText(col.label, col.x, 22);
    }
    for (const divX of dividers) {
      ctx.beginPath();
      ctx.moveTo(divX, 34);
      ctx.lineTo(divX, h - 16);
      ctx.stroke();
    }
    if (options.graphRagViewerScope) {
      ctx.textAlign = 'right';
      ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = options.graphRagViewerScope === 'buyer' ? '#0f766e' : '#7e22ce';
      ctx.fillText(`SCOPE: ${options.graphRagViewerScope.toUpperCase()}`, w - 16, 22);
    }
    ctx.restore();
  }

  if (domain === 'systems' && options.systemsStageHeaders && options.systemsStageHeaders.length > 0) {
    const hdrs = options.systemsStageHeaders;
    ctx.save();
    ctx.font = '600 11px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    for (let s = 0; s < hdrs.length; s++) {
      ctx.fillStyle = '#334155';
      ctx.fillText(hdrs[s].label.toUpperCase(), hdrs[s].x, 22);
      if (s > 0) {
        const divX = (hdrs[s - 1].x + hdrs[s].x) / 2;
        ctx.beginPath();
        ctx.moveTo(divX, 34);
        ctx.lineTo(divX, h - 18);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  ctx.save();
  ctx.lineCap = 'round';
  for (let idx = 0; idx < graph.edges.length; idx++) {
    const edge = graph.edges[idx];
    const a = graph.nodes[edge.i];
    const b = graph.nodes[edge.j];

    if (edge.scopeBlocked) {
      ctx.save();
      ctx.strokeStyle = 'rgba(147, 51, 234, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.setLineDash([]);
      ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(88, 28, 135, 0.9)';
      ctx.fillRect(mx - 14, my - 7, 28, 14);
      ctx.fillStyle = '#f3e8ff';
      ctx.fillText('T04', mx, my);
      ctx.restore();
      continue;
    }

    if (edge.severed) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = edge.cellId ? 2.4 : 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.setLineDash([]);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx - 4, my - 4);
      ctx.lineTo(mx + 4, my + 4);
      ctx.moveTo(mx + 4, my - 4);
      ctx.lineTo(mx - 4, my + 4);
      ctx.stroke();
      if (domain === 'fjsp' && edge.cellId) {
        ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#b91c1c';
        ctx.fillText(`${edge.cellId} (OFF)`, mx, my - 10);
      } else if (domain === 'systems' && edge.cellId) {
        const meta = options.systemsRailLabels?.[edge.cellId];
        ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#dc2626';
        ctx.fillText(`${meta?.label ?? edge.cellId} (DOWN)`, mx, my - 10);
      } else if (domain === 'graphrag') {
        ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#b91c1c';
        ctx.fillText(edge.expired ? 'EXPIRED' : 'REVOKED', mx, my - 7);
      }
      ctx.restore();
      continue;
    }

    const d = clamp01(edge.D);
    if (d <= 0.003 && idx !== options.hoveredEdgeIndex && !edge.cellId) continue;

    let strokeWidth = lerp(0.6, 8.5, d);
    let alpha = Math.max(0.04, d);
    let strokeStyle =
      idx === options.hoveredEdgeIndex
        ? '#15803d'
        : d > 0.6
          ? '#1c1917'
          : '#1e241b';

    if (domain === 'vascular') {
      strokeWidth = lerp(1.0, 12.0, Math.pow(d, 0.25));
      alpha = d >= 0.01 ? Math.max(0.45, Math.pow(d, 0.35)) : Math.max(0.04, d);
      if (idx === options.hoveredEdgeIndex) {
        strokeStyle = '#15803d';
      } else if (options.showShearHeatmap && options.edgeShearNorm) {
        strokeStyle = shearHeatmapColor(options.edgeShearNorm[idx] ?? 0);
      } else {
        strokeStyle = d > 0.45 ? '#991b1b' : '#dc2626';
      }
    } else if (domain === 'optimization') {
      strokeWidth = lerp(0.8, 9.5, clamp01(edge.D));
      alpha = d >= 0.01 ? Math.max(0.28, d) : Math.max(0.04, d);
      if (idx === options.hoveredEdgeIndex) {
        strokeStyle = '#15803d';
      } else if (edge.capacity !== undefined && Math.abs(edge.flow) >= 0.96 * edge.capacity) {
        strokeStyle = '#d97706';
      } else {
        strokeStyle = d > 0.5 ? '#0f766e' : '#0284c7';
      }
    } else if (domain === 'graphrag') {
      const lam = edge.congestion ?? 0;
      strokeWidth = lerp(0.8, 8.5, d);
      alpha = d >= 0.01 ? Math.max(0.32, Math.min(1, d)) : 0.08;
      if (idx === options.hoveredEdgeIndex) {
        strokeStyle = '#15803d';
      } else if (lam > 0.35) {
        strokeStyle = '#dc2626';
      } else if (lam > 0.05) {
        strokeStyle = '#d97706';
      } else if (d > 0.25) {
        strokeStyle = '#0f766e';
      } else {
        strokeStyle = '#64748b';
      }
    } else if (domain === 'fjsp') {
      if (edge.cellId) {
        const lam = edge.congestion ?? 0;
        strokeWidth = lerp(9, 15, d);
        alpha = Math.max(0.48, d);
        if (idx === options.hoveredEdgeIndex) {
          strokeStyle = '#15803d';
        } else if (lam > 0.35) {
          strokeStyle = '#dc2626';
        } else if (lam > 0.05) {
          strokeStyle = '#d97706';
        } else {
          strokeStyle = d > 0.3 ? '#0f766e' : '#0284c7';
        }
      } else {
        strokeWidth = lerp(0.8, 4.4, d);
        alpha = d >= 0.01 ? Math.max(0.18, d * 0.85) : 0.06;
        strokeStyle = idx === options.hoveredEdgeIndex ? '#15803d' : '#475569';
      }
    } else if (domain === 'systems') {
      const lam = edge.congestion ?? 0;
      const util =
        edge.capacity !== undefined && edge.capacity > 0
          ? Math.abs(edge.flow) / edge.capacity
          : 0;
      if (edge.cellId) {
        strokeWidth = lerp(6, 15, d);
        alpha = Math.max(0.42, Math.min(1, 0.35 + d));
        if (idx === options.hoveredEdgeIndex) {
          strokeStyle = '#15803d';
        } else if (lam > 0.35 || util > 1.05) {
          strokeStyle = '#dc2626';
        } else if (lam > 0.05 || util >= 0.9) {
          strokeStyle = '#d97706';
        } else if (Math.abs(edge.flow) > 0.02 || d > 0.25) {
          strokeStyle = '#0f766e';
        } else {
          strokeStyle = '#64748b';
        }
      } else {
        strokeWidth = lerp(0.8, 5.2, d);
        alpha = d >= 0.01 ? Math.max(0.16, Math.min(0.85, d)) : 0.06;
        strokeStyle = idx === options.hoveredEdgeIndex ? '#15803d' : '#334155';
      }
    }

    if (domain === 'systems' && edge.cellId && (edge.congestion ?? 0) > 0.05) {
      const lam = edge.congestion ?? 0;
      ctx.save();
      ctx.strokeStyle =
        lam > 0.35 ? 'rgba(220, 38, 38, 0.28)' : 'rgba(217, 119, 6, 0.26)';
      ctx.lineWidth = strokeWidth + 8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    if (idx === options.hoveredEdgeIndex) {
      ctx.save();
      ctx.strokeStyle = 'rgba(22, 163, 74, 0.35)';
      ctx.lineWidth = strokeWidth + 6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    if (domain === 'fjsp' && edge.cellId) {
      ctx.save();
      ctx.globalAlpha = 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(243, 242, 232, 0.94)';
      ctx.strokeText(edge.cellId, mx, my - 11);
      ctx.fillStyle = (edge.congestion ?? 0) > 0.05 ? '#b45309' : '#0f172a';
      ctx.fillText(edge.cellId, mx, my - 11);
      ctx.restore();
    } else if (domain === 'systems' && edge.cellId) {
      const meta = options.systemsRailLabels?.[edge.cellId];
      const lam = edge.congestion ?? 0;
      const labelText = meta
        ? `${meta.label} · ${Math.round(meta.sharePct)}%`
        : edge.cellId;
      ctx.save();
      ctx.globalAlpha = 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = 'rgba(243, 242, 232, 0.96)';
      ctx.strokeText(labelText, mx, my - 13);
      ctx.fillStyle =
        meta?.status === 'SATURATED' || lam > 0.35
          ? '#b91c1c'
          : meta?.status === 'SPILLING' || lam > 0.05
            ? '#b45309'
            : '#0f172a';
      ctx.fillText(labelText, mx, my - 13);
      ctx.restore();
    }
  }
  ctx.restore();

  // 4. Optional animated flow pulses
  if (options.showFlowParticles) {
    const phase = options.phase ?? 0;
    const minParticleD = domain === 'transport' ? 0.08 : 0.015;
    const minParticleFlow = domain === 'transport' ? 0.03 : 0.015;
    ctx.save();
    for (const edge of graph.edges) {
      if (edge.severed || edge.scopeBlocked || edge.D <= minParticleD || Math.abs(edge.flow) <= minParticleFlow) continue;
      const a = graph.nodes[edge.i];
      const b = graph.nodes[edge.j];
      const forward = edge.flow >= 0;
      const sx = forward ? a.x : b.x;
      const sy = forward ? a.y : b.y;
      const ex = forward ? b.x : a.x;
      const ey = forward ? b.y : a.y;
      const count =
        domain === 'systems'
          ? Math.min(4, Math.max(1, Math.ceil(Math.abs(edge.flow) * 5)))
          : edge.length > 90
            ? 2
            : 1;
      for (let k = 0; k < count; k++) {
        const t = (phase + k / count) % 1;
        const px = lerp(sx, ex, t);
        const py = lerp(sy, ey, t);
        ctx.fillStyle =
          domain === 'vascular'
            ? '#fecaca'
            : domain === 'systems' && (edge.congestion ?? 0) > 0.05
              ? '#fde047'
              : domain === 'optimization' ||
                  domain === 'fjsp' ||
                  domain === 'graphrag' ||
                  domain === 'systems'
                ? '#5eead4'
                : '#a3e66f';
        ctx.strokeStyle = '#141812';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, domain === 'systems' ? 3.1 : 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 4b. Optional capacity utilization badges on capacitated edges
  if (options.showCapacityBadges) {
    ctx.save();
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const edge of graph.edges) {
      if (edge.severed || edge.scopeBlocked || edge.capacity === undefined || !Number.isFinite(edge.capacity)) continue;
      const a = graph.nodes[edge.i];
      const b = graph.nodes[edge.j];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const qAbs = Math.abs(edge.flow);
      const saturated = qAbs >= 0.96 * edge.capacity;
      const text = `${qAbs.toFixed(2)}/${edge.capacity.toFixed(2)}`;
      const padX = 4;
      const boxW = ctx.measureText(text).width + padX * 2;
      const boxH = 16;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = saturated ? '#f59e0b' : '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(mx - boxW / 2, my - boxH / 2, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = saturated ? '#fde68a' : '#bae6fd';
      ctx.fillText(text, mx, my);
    }
    ctx.restore();
  }

  // 5. Nodes (+ optional pressure coloring & station labels)
  let minP = 0;
  let maxP = 0;
  let hasPressureRange = false;
  if (options.showPressure && options.pressures && options.pressures.length === graph.nodes.length) {
    minP = Infinity;
    maxP = -Infinity;
    for (const p of options.pressures) {
      if (Number.isFinite(p)) {
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
      }
    }
    hasPressureRange = Number.isFinite(minP) && Number.isFinite(maxP) && maxP - minP > 1e-12;
  }

  const isMulti = options.flowMode === 'multi-terminal';
  ctx.save();
  for (const node of graph.nodes) {
    if (hasPressureRange && options.pressures) {
      const pNorm = (options.pressures[node.id] - minP) / (maxP - minP);
      ctx.fillStyle = pressureColor(pNorm);
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    let radius = 4.5;
    if (domain === 'graphrag' && node.role) {
      if (node.role === 'query') {
        ctx.fillStyle = '#16a34a';
        radius = 7;
      } else if (node.role === 'supplier') {
        ctx.fillStyle = '#0f766e';
        radius = 7;
      } else if (node.role === 'hub') {
        ctx.fillStyle = '#d97706';
        radius = 7;
      } else if (node.role === 'evidence') {
        ctx.fillStyle = '#4f46e5';
        radius = 5;
      } else if (node.role === 'private') {
        ctx.fillStyle = '#9333ea';
        radius = 5;
      } else {
        ctx.fillStyle = '#94a3b8';
        radius = 4;
      }
    } else if (isMulti) {
      if (node.flow !== 0) {
        ctx.fillStyle = '#d97706';
        radius = 6.5;
      } else {
        ctx.fillStyle = '#9ca3af';
        radius = 4;
      }
    } else if (node.flow > 0) {
      ctx.fillStyle = '#22c55e';
      radius = 6.5;
    } else if (node.flow < 0) {
      ctx.fillStyle = '#ef4444';
      radius = 6.5;
    } else {
      ctx.fillStyle = '#6b7280';
      radius = 4.5;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (
      node.flow !== 0 ||
      (domain === 'graphrag' &&
        (node.role === 'supplier' || node.role === 'hub' || node.role === 'private'))
    ) {
      ctx.strokeStyle = '#141812';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  if (options.showLabels) {
    ctx.font = '600 11px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const node of graph.nodes) {
      if (!node.label) continue;
      const ly = Math.max(14, node.y - 9);
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = 'rgba(243, 242, 232, 0.92)';
      ctx.strokeText(node.label, node.x, ly);
      ctx.fillStyle = '#111827';
      ctx.fillText(node.label, node.x, ly);
    }
  }
  ctx.restore();
}

/**
 * Render an N x N symmetric memristor crossbar conductance heatmap G_ij
 * illustrating active ON crosspoints vs pruned OFF crosspoints.
 */
export function renderCrossbarMatrix(ctx: CanvasRenderingContext2D, graph: Graph): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b1014';
  ctx.fillRect(0, 0, w, h);

  const n = graph.nodes.length;
  if (n === 0) {
    ctx.fillStyle = '#8e9790';
    ctx.font = '12px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No crossbar nodes', w / 2, h / 2);
    return;
  }

  let maxG = 0;
  for (const edge of graph.edges) {
    if (edge.severed) continue;
    const congestionScale = 1 + Math.max(edge.congestion ?? 0, 0);
    const g = edge.D / (effectiveEdgeCost(edge) * congestionScale);
    if (g > maxG) maxG = g;
  }
  const denom = Math.max(0.35, Math.log10(1 + maxG * 200));

  const pad = 8;
  const size = Math.min(w, h) - pad * 2;
  const cell = size / n;
  const ox = (w - size) / 2;
  const oy = (h - size) / 2;

  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#161d24';
    ctx.fillRect(ox + i * cell, oy + i * cell, cell, cell);
  }

  for (const edge of graph.edges) {
    const x1 = ox + edge.i * cell;
    const y1 = oy + edge.j * cell;
    const x2 = ox + edge.j * cell;
    const y2 = oy + edge.i * cell;

    if (edge.severed) {
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(x1, y1, cell, cell);
      ctx.fillRect(x2, y2, cell, cell);
      continue;
    }

    const congestionScale = 1 + Math.max(edge.congestion ?? 0, 0);
    const g = edge.D / (effectiveEdgeCost(edge) * congestionScale);
    const norm = clamp01(Math.log10(1 + g * 200) / denom);

    if (edge.D < 0.01) {
      ctx.fillStyle = '#11161c';
    } else if (norm < 0.5) {
      const u = norm * 2;
      const r = Math.round(lerp(15, 14, u));
      const gr = Math.round(lerp(23, 165, u));
      const b = Math.round(lerp(42, 233, u));
      ctx.fillStyle = `rgb(${r}, ${gr}, ${b})`;
    } else {
      const u = (norm - 0.5) * 2;
      const r = Math.round(lerp(14, 163, u));
      const gr = Math.round(lerp(165, 230, u));
      const b = Math.round(lerp(233, 111, u));
      ctx.fillStyle = `rgb(${r}, ${gr}, ${b})`;
    }

    ctx.fillRect(x1, y1, cell, cell);
    ctx.fillRect(x2, y2, cell, cell);
  }

  if (n <= 28) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 0.6;
    for (let k = 0; k <= n; k++) {
      const pos = ox + k * cell;
      const posY = oy + k * cell;
      ctx.beginPath();
      ctx.moveTo(pos, oy);
      ctx.lineTo(pos, oy + size);
      ctx.moveTo(ox, posY);
      ctx.lineTo(ox + size, posY);
      ctx.stroke();
    }
  }
}

const ALLOY_COLORS: Record<AlloyType, string> = {
  '18K-Y': '#eab308',
  '18K-R': '#f43f5e',
  '925': '#94a3b8',
  PT950: '#38bdf8',
};

/**
 * Render the Lower-Layer Multi-Cell Jewelry FJSP Gantt chart across all physical cells,
 * highlighting setup changeovers, re-entrant polishing, offline cells, and bottleneck lambda.
 */
export function renderGanttChart(
  ctx: CanvasRenderingContext2D,
  solution: FjspSolution,
  cells: CellSpec[],
  offlineCells: string[],
  bottleneckCellId: string,
  labelTag: string,
  lowerBoundMin = 0,
  options?: { shiftMinPerDay?: number; extraSummary?: string },
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b1014';
  ctx.fillRect(0, 0, w, h);

  const shiftMinPerDay = options?.shiftMinPerDay ?? solution.shiftMinPerDay ?? 0;
  const offlineSet = new Set(offlineCells);
  const leftPad = 108;
  const rightPad = 18;
  const topPad = 28;
  const bottomPad = 24;
  const plotW = Math.max(100, w - leftPad - rightPad);
  const plotH = Math.max(60, h - topPad - bottomPad);
  const rowH = plotH / Math.max(1, cells.length);

  ctx.save();
  ctx.font = '600 11px Inter, ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d8f8bd';
  const multiPoSummary =
    solution.totalPos >= 20
      ? ` · On-Time ${solution.onTimePos}/${solution.totalPos} POs · Tard ${solution.totalTardinessMin}m`
      : '';
  const makespanStr =
    shiftMinPerDay > 0
      ? `${(solution.makespanMin / shiftMinPerDay).toFixed(1)}d (${solution.makespanMin}m)`
      : `${solution.makespanMin}m`;
  const lbStr = lowerBoundMin > 0 ? ` · LB ${lowerBoundMin}m` : '';
  const extraStr = options?.extraSummary ?? '';
  const summaryText = solution.feasible
    ? `${labelTag} · Makespan ${makespanStr} · Setup ${solution.totalSetupMin}m${lbStr}${multiPoSummary}${extraStr}`
    : `${labelTag} · Infeasible`;
  ctx.fillText(summaryText, leftPad, 14);

  const cellIndex = new Map<string, number>();
  for (let r = 0; r < cells.length; r++) {
    const cell = cells[r];
    cellIndex.set(cell.id, r);
    const y0 = topPad + r * rowH;
    ctx.fillStyle = r % 2 === 0 ? '#10161c' : '#0b1014';
    ctx.fillRect(leftPad, y0, plotW, rowH);

    const isOff = offlineSet.has(cell.id);
    const isBottleneck = cell.id === bottleneckCellId && !isOff;
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = isOff
      ? '#f87171'
      : isBottleneck
        ? '#fbbf24'
        : cell.stage === 'Warehouse'
          ? '#38bdf8'
          : cell.stage === 'Assembly'
            ? '#c084fc'
            : '#cbd5cb';
    const prefix = isOff ? 'OFF ' : isBottleneck ? 'λ ' : '';
    ctx.fillText(`${prefix}${cell.id}`, leftPad - 8, y0 + rowH / 2);
  }

  if (!solution.feasible) {
    ctx.fillStyle = 'rgba(127, 29, 29, 0.28)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    const boxW = Math.min(plotW - 40, 520);
    const boxH = 72;
    const bx = leftPad + (plotW - boxW) / 2;
    const by = topPad + (plotH - boxH) / 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fecaca';
    ctx.font = '700 12px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Lower-Layer Schedule Infeasible', bx + boxW / 2, by + 24);
    ctx.font = '11px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText(solution.infeasibleReason ?? 'Missing required machine capacity', bx + boxW / 2, by + 48);
    ctx.restore();
    return;
  }

  const maxTime = Math.max(solution.makespanMin, lowerBoundMin, 60) * 1.06;
  const xForTime = (t: number): number => leftPad + (t / maxTime) * plotW;

  if (shiftMinPerDay > 0) {
    const totalDays = Math.ceil(maxTime / shiftMinPerDay);
    for (let d = 0; d < totalDays; d++) {
      const dx0 = xForTime(d * shiftMinPerDay);
      const dx1 = xForTime(Math.min(maxTime, (d + 1) * shiftMinPerDay));
      if (d % 2 === 1) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.045)';
        ctx.fillRect(dx0, topPad, Math.max(0, dx1 - dx0), plotH);
      }
      ctx.strokeStyle = 'rgba(163, 230, 111, 0.24)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx0, topPad);
      ctx.lineTo(dx0, topPad + plotH);
      ctx.stroke();

      if (dx1 - dx0 >= 22) {
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#9aa89e';
        ctx.fillText(`D${d + 1}`, dx0 + 4, h - 10);
      }
    }
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6f7b72';
    ctx.fillText(`${shiftMinPerDay}m/d`, leftPad + plotW, h - 10);
  } else {
    const tickStep = maxTime > 500 ? 100 : 50;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8e9790';
    for (let t = 0; t <= maxTime; t += tickStep) {
      const x = xForTime(t);
      ctx.beginPath();
      ctx.moveTo(x, topPad);
      ctx.lineTo(x, topPad + plotH);
      ctx.stroke();
      ctx.fillText(`${t}m`, x, h - 10);
    }
  }

  if (lowerBoundMin > 0) {
    const xLb = xForTime(lowerBoundMin);
    ctx.save();
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.78)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(xLb, topPad);
    ctx.lineTo(xLb, topPad + plotH);
    ctx.stroke();
    ctx.restore();
  }

  const lateSet = new Set(solution.lateJobIds);
  for (const op of solution.ops) {
    const r = cellIndex.get(op.cellId);
    if (r === undefined) continue;
    const y0 = topPad + r * rowH + 2;
    const bh = Math.max(6, rowH - 4);

    if (op.setupMin > 0) {
      const sx0 = xForTime(op.startMin - op.setupMin);
      const sx1 = xForTime(op.startMin);
      ctx.fillStyle = 'rgba(217, 119, 6, 0.42)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.fillRect(sx0, y0 + 2, Math.max(2, sx1 - sx0), Math.max(4, bh - 4));
      ctx.strokeRect(sx0, y0 + 2, Math.max(2, sx1 - sx0), Math.max(4, bh - 4));
    }

    const x0 = xForTime(op.startMin);
    const x1 = xForTime(op.endMin);
    const bw = Math.max(2, x1 - x0);
    ctx.fillStyle = ALLOY_COLORS[op.alloy] ?? '#a3e66f';
    ctx.strokeStyle = '#090d10';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0, y0, bw, bh, 3);
    ctx.fill();
    ctx.stroke();

    if (lateSet.has(op.jobId)) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x0, y0, bw, 2);
    }

    if (bw >= 17) {
      ctx.fillStyle = '#090d10';
      ctx.font = '700 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${op.jobId}${op.reentrant ? '↻' : ''}`, x0 + bw / 2, y0 + bh / 2);
    }
  }

  const xMax = xForTime(solution.makespanMin);
  ctx.strokeStyle = '#a3e66f';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(xMax, topPad);
  ctx.lineTo(xMax, topPad + plotH);
  ctx.stroke();
  ctx.restore();
}

function formatUsdCompact(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

/**
 * Render the daily working-capital Cash Flow chart comparing Two-Level Master Scheduling
 * against Greedy Baseline (daily inflows/outflows + cumulative closing cash curve & trough).
 */
export function renderCashFlowChart(ctx: CanvasRenderingContext2D, erpCmp: ErpComparison): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b1014';
  ctx.fillRect(0, 0, w, h);

  const leftPad = 68;
  const rightPad = 24;
  const topPad = 30;
  const bottomPad = 24;
  const plotW = Math.max(100, w - leftPad - rightPad);
  const plotH = Math.max(60, h - topPad - bottomPad);

  const two = erpCmp.twoLevel;
  const gr = erpCmp.greedyBaseline;

  ctx.save();
  if (!two.feasible) {
    ctx.fillStyle = 'rgba(127, 29, 29, 0.28)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    const boxW = Math.min(plotW, 480);
    const boxH = 64;
    const bx = leftPad + (plotW - boxW) / 2;
    const by = topPad + (plotH - boxH) / 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fecaca';
    ctx.font = '700 12px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Daily Cash Flow Unavailable (Infeasible Schedule)', bx + boxW / 2, by + 32);
    ctx.restore();
    return;
  }

  const cfTwo = two.cashFlow;
  const cfGr = gr.cashFlow;
  const numDays = Math.max(cfTwo.daily.length, cfGr.daily.length, 1);

  const allCashValues = [
    0,
    cfTwo.startingCashUsd,
    ...cfTwo.daily.map((r) => r.closingCashUsd),
    ...(gr.feasible ? cfGr.daily.map((r) => r.closingCashUsd) : []),
  ];
  const minVal = Math.min(...allCashValues);
  const maxVal = Math.max(...allCashValues, 1000) * 1.08;
  const span = Math.max(1000, maxVal - minVal);
  const yForCash = (v: number): number => topPad + plotH - ((v - minVal) / span) * plotH;

  // Header summary
  const deltaSign = erpCmp.endingCashDeltaUsd >= 0 ? '+' : '';
  const grSummary = gr.feasible
    ? ` vs Greedy End ${formatUsdCompact(cfGr.endingCashUsd)} (${deltaSign}${formatUsdCompact(erpCmp.endingCashDeltaUsd)})`
    : '';
  ctx.font = '600 11px Inter, ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d8f8bd';
  ctx.fillText(
    `Start ${formatUsdCompact(cfTwo.startingCashUsd)} · Two-Level Min ${formatUsdCompact(cfTwo.minCashUsd)} (D${cfTwo.minCashDay}) / End ${formatUsdCompact(cfTwo.endingCashUsd)}${grSummary}`,
    leftPad,
    14,
  );

  // Horizontal cash gridlines
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';
  const gridSteps = 3;
  for (let g = 0; g <= gridSteps; g++) {
    const val = minVal + (span * g) / gridSteps;
    const y = yForCash(val);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftPad, y);
    ctx.lineTo(leftPad + plotW, y);
    ctx.stroke();
    ctx.fillStyle = '#8e9790';
    ctx.fillText(formatUsdCompact(val), leftPad - 8, y);
  }

  // Zero cash threshold line
  const yZero = yForCash(0);
  ctx.save();
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.52)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(leftPad, yZero);
  ctx.lineTo(leftPad + plotW, yZero);
  ctx.stroke();
  ctx.restore();

  const slotW = plotW / numDays;
  const maxBarFlow = Math.max(
    1000,
    ...cfTwo.daily.map((r) =>
      Math.max(
        r.inflowDepositUsd + r.inflowBalanceUsd,
        r.outflowMaterialUsd + r.outflowLaborUsd + r.outflowOverheadWipUsd,
      ),
    ),
  );
  const maxBarH = plotH * 0.48;

  // Daily inflows / outflows bars + day ticks
  for (let i = 0; i < cfTwo.daily.length; i++) {
    const row = cfTwo.daily[i];
    const xSlot = leftPad + i * slotW;
    const dayIn = row.inflowDepositUsd + row.inflowBalanceUsd;
    const dayOut = row.outflowMaterialUsd + row.outflowLaborUsd + row.outflowOverheadWipUsd;
    const barW = Math.max(4, Math.min(18, slotW * 0.28));

    if (dayIn > 0) {
      const bh = (dayIn / maxBarFlow) * maxBarH;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.36)';
      ctx.fillRect(xSlot + slotW * 0.5 - barW - 1, topPad + plotH - bh, barW, bh);
    }
    if (dayOut > 0) {
      const bh = (dayOut / maxBarFlow) * maxBarH;
      ctx.fillStyle = 'rgba(244, 63, 94, 0.36)';
      ctx.fillRect(xSlot + slotW * 0.5 + 1, topPad + plotH - bh, barW, bh);
    }

    ctx.fillStyle = '#9aa89e';
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`D${row.day}`, xSlot + slotW * 0.5, h - 10);
  }

  // Greedy cumulative cash polyline (dashed slate)
  if (gr.feasible && cfGr.daily.length > 0) {
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(leftPad, yForCash(cfGr.startingCashUsd));
    for (let i = 0; i < cfGr.daily.length; i++) {
      ctx.lineTo(leftPad + (i + 0.5) * slotW, yForCash(cfGr.daily[i].closingCashUsd));
    }
    ctx.stroke();
    ctx.restore();
  }

  // Two-Level cumulative cash polyline (solid lime)
  if (cfTwo.daily.length > 0) {
    ctx.strokeStyle = '#a3e66f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(leftPad, yForCash(cfTwo.startingCashUsd));
    for (let i = 0; i < cfTwo.daily.length; i++) {
      ctx.lineTo(leftPad + (i + 0.5) * slotW, yForCash(cfTwo.daily[i].closingCashUsd));
    }
    ctx.stroke();

    for (let i = 0; i < cfTwo.daily.length; i++) {
      const row = cfTwo.daily[i];
      const px = leftPad + (i + 0.5) * slotW;
      const py = yForCash(row.closingCashUsd);
      const isTrough = row.day === cfTwo.minCashDay;
      ctx.fillStyle = isTrough ? '#fbbf24' : '#a3e66f';
      ctx.strokeStyle = '#0b1014';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px, py, isTrough ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (isTrough) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Min ${formatUsdCompact(row.closingCashUsd)}`, px, Math.max(topPad + 10, py - 11));
      }
    }
  }

  ctx.restore();
}

export function renderSystemsComparisonChart(
  ctx: CanvasRenderingContext2D,
  evalRes: SystemsEvaluation,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#0b1014';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  const divX = 538;
  ctx.beginPath();
  ctx.moveTo(divX, 14);
  ctx.lineTo(divX, h - 14);
  ctx.stroke();

  // Left: Live Rail Load vs Capacity bars
  ctx.font = '700 11px Inter, ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d8f8bd';
  ctx.fillText(
    `LIVE RAIL UTILIZATION (LOAD vs CAPACITY u_e · Demand ${Math.round(evalRes.totalDemand)} ${evalRes.throughputUnit})`,
    16,
    20,
  );

  const rails = evalRes.rails;
  const barTop = 38;
  const rowGap = rails.length > 0 ? Math.min(40, (h - barTop - 16) / rails.length) : 36;
  const labelX = 16;
  const barX = 112;
  const barW = 246;
  const capX = barX + barW * 0.78; // 100% cap line sits at 78% of max bar width to show up to ~128% overload

  for (let idx = 0; idx < rails.length; idx++) {
    const r = rails[idx];
    const cy = barTop + idx * rowGap + rowGap * 0.45;
    const bh = Math.min(18, rowGap * 0.56);
    const by = cy - bh / 2;

    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = r.offline ? '#f87171' : '#e2e8f0';
    ctx.fillText(r.shortLabel, labelX, cy);

    // Track background
    ctx.fillStyle = '#151d24';
    ctx.fillRect(barX, by, barW, bh);

    if (!r.offline && r.capUnits > 0) {
      const ratio = Math.min(1.28, r.loadUnits / r.capUnits);
      const fillW = (ratio / 1.28) * barW;
      ctx.fillStyle =
        r.status === 'SATURATED'
          ? '#ef4444'
          : r.status === 'SPILLING'
            ? '#f59e0b'
            : '#10b981';
      ctx.fillRect(barX, by, fillW, bh);
    }

    // 100% Capacity marker
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.setLineDash([3, 2]);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(capX, by - 2);
    ctx.lineTo(capX, by + bh + 2);
    ctx.stroke();
    ctx.restore();

    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = r.offline ? '#fca5a5' : r.shadowPriceLambda > 0.05 ? '#fde68a' : '#94a3b8';
    const capText = r.offline
      ? 'OFFLINE (Cut)'
      : `${Math.round(r.loadUnits)}/${Math.round(r.capUnits)} (${Math.round(r.sharePct)}%) λ=${r.shadowPriceLambda.toFixed(2)}`;
    ctx.fillText(capText, barX + barW + 10, cy);
  }

  // Right: Physarum Control-Plane vs Static Baseline
  const rx = divX + 16;
  const rw = w - rx - 16;
  ctx.font = '700 11px Inter, ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('PHYSARUM CONTROL-PLANE vs STATIC ROUTER', rx, 20);

  const compRows: Array<{
    title: string;
    phyVal: number;
    staVal: number;
    phyLabel: string;
    staLabel: string;
    maxVal: number;
    goodLower: boolean;
  }> = [
    {
      title: 'Overload / Drop Rate',
      phyVal: evalRes.physarum.dropPct,
      staVal: evalRes.staticBaseline.dropPct,
      phyLabel: `Phy ${evalRes.physarum.dropPct.toFixed(1)}%`,
      staLabel: `Static ${evalRes.staticBaseline.dropPct.toFixed(1)}%`,
      maxVal: Math.max(10, evalRes.physarum.dropPct, evalRes.staticBaseline.dropPct),
      goodLower: true,
    },
    {
      title: evalRes.successMetricLabel,
      phyVal: evalRes.physarum.successPct,
      staVal: evalRes.staticBaseline.successPct,
      phyLabel: `Phy ${evalRes.physarum.successPct.toFixed(1)}%`,
      staLabel: `Static ${evalRes.staticBaseline.successPct.toFixed(1)}%`,
      maxVal: 100,
      goodLower: false,
    },
    {
      title: `${evalRes.costMetricLabel} (${evalRes.costUnit})`,
      phyVal: evalRes.physarum.avgCost,
      staVal: evalRes.staticBaseline.avgCost,
      phyLabel: `Phy ${evalRes.physarum.avgCost.toFixed(evalRes.costUnit === '%' ? 2 : 1)}${evalRes.costUnit}`,
      staLabel: `Static ${evalRes.staticBaseline.avgCost.toFixed(evalRes.costUnit === '%' ? 2 : 1)}${evalRes.costUnit}`,
      maxVal: Math.max(1, evalRes.physarum.avgCost, evalRes.staticBaseline.avgCost) * 1.15,
      goodLower: true,
    },
  ];

  const barWidthRight = rw - 115;
  for (let i = 0; i < compRows.length; i++) {
    const row = compRows[i];
    const y0 = 40 + i * 48;
    ctx.font = '600 10px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(row.title, rx, y0 + 4);

    const phyW = Math.min(barWidthRight, (row.phyVal / row.maxVal) * barWidthRight);
    ctx.fillStyle = '#151d24';
    ctx.fillRect(rx, y0 + 13, barWidthRight, 10);
    ctx.fillStyle = row.goodLower && row.phyVal > 5 ? '#f59e0b' : '#2dd4bf';
    ctx.fillRect(rx, y0 + 13, Math.max(2, phyW), 10);
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#a7f3d0';
    ctx.fillText(row.phyLabel, rx + barWidthRight + 8, y0 + 18);

    const staW = Math.min(barWidthRight, (row.staVal / row.maxVal) * barWidthRight);
    ctx.fillStyle = '#151d24';
    ctx.fillRect(rx, y0 + 26, barWidthRight, 10);
    ctx.fillStyle = row.goodLower && row.staVal > 5 ? '#ef4444' : '#64748b';
    ctx.fillRect(rx, y0 + 26, Math.max(2, staW), 10);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(row.staLabel, rx + barWidthRight + 8, y0 + 31);
  }

  // Bottom callout pill
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  if (evalRes.dropReductionPct > 0.2) {
    ctx.fillStyle = '#86efac';
    ctx.fillText(
      `SAVED: -${evalRes.dropReductionPct.toFixed(1)}% drops vs Static · Max λ=${evalRes.physarum.maxLambda.toFixed(2)}`,
      rx,
      h - 16,
    );
  } else {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      `Steered by λ_e (Max λ=${evalRes.physarum.maxLambda.toFixed(2)}) · 0 overload drops`,
      rx,
      h - 16,
    );
  }

  ctx.restore();
}
