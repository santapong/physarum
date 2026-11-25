import type { FlowMode, Graph, LabDomain } from './graph';
import { effectiveEdgeCost } from './solver';
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
  ctx.save();
  ctx.lineCap = 'round';
  for (let idx = 0; idx < graph.edges.length; idx++) {
    const edge = graph.edges[idx];
    const a = graph.nodes[edge.i];
    const b = graph.nodes[edge.j];

    if (edge.severed) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = 1.6;
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
      ctx.restore();
      continue;
    }

    const d = clamp01(edge.D);
    if (d <= 0.003 && idx !== options.hoveredEdgeIndex) continue;

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
  }
  ctx.restore();

  // 4. Optional animated flow pulses
  if (options.showFlowParticles) {
    const phase = options.phase ?? 0;
    const minParticleD = domain === 'transport' ? 0.08 : 0.015;
    const minParticleFlow = domain === 'transport' ? 0.03 : 0.015;
    ctx.save();
    for (const edge of graph.edges) {
      if (edge.severed || edge.D <= minParticleD || Math.abs(edge.flow) <= minParticleFlow) continue;
      const a = graph.nodes[edge.i];
      const b = graph.nodes[edge.j];
      const forward = edge.flow >= 0;
      const sx = forward ? a.x : b.x;
      const sy = forward ? a.y : b.y;
      const ex = forward ? b.x : a.x;
      const ey = forward ? b.y : a.y;
      const count = edge.length > 90 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const t = (phase + k / count) % 1;
        const px = lerp(sx, ex, t);
        const py = lerp(sy, ey, t);
        ctx.fillStyle = domain === 'vascular' ? '#fecaca' : domain === 'optimization' ? '#5eead4' : '#a3e66f';
        ctx.strokeStyle = '#141812';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, 2.7, 0, Math.PI * 2);
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
      if (edge.severed || edge.capacity === undefined || !Number.isFinite(edge.capacity)) continue;
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
    if (isMulti) {
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

    if (node.flow !== 0) {
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
