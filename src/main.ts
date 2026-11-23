import './style.css';

import {
  addNode,
  buildCompleteGraph,
  buildDelaunayGraph,
  emptyGraph,
  findEdgeNear,
  hasActiveTerminals,
  severEdgeNear,
  type FlowMode,
  type Graph,
  type GraphMode,
  type Node,
} from './graph';
import { computeNetworkMetrics, type NetworkMetrics } from './metrics';
import { PRESETS, getPreset } from './presets';
import { createRandom, normalizeSeed } from './random';
import { render } from './render';
import { step, type StepMetrics } from './sim';
import { encodeState, stateFromHash, type SharedState } from './state';
import {
  applyTerrainToGraph,
  clearTerrain,
  createTerrain,
  paintTerrainDisk,
  paintTerrainPolygon,
  terrainFromImageData,
  type TerrainField,
} from './terrain';

type InteractionTool = 'internal' | 'source' | 'sink' | 'cut' | 'obstacle' | 'erase';

interface HistorySample {
  step: number;
  tlRatio: number;
  mdRatio: number;
  faultTolerance: number;
  efficiencyScore: number;
}

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing #${id}`);
  return value as T;
};

const canvas = element<HTMLCanvasElement>('c');
const canvasContext = canvas.getContext('2d');
if (!canvasContext) throw new Error('Canvas 2D is unavailable');
const ctx: CanvasRenderingContext2D = canvasContext;

const sparkCanvas = element<HTMLCanvasElement>('sparkline');
const sparkContext = sparkCanvas.getContext('2d');

const runBtn = element<HTMLButtonElement>('run');
const stepBtn = element<HTMLButtonElement>('step');
const restartBtn = element<HTMLButtonElement>('restart');
const clearBtn = element<HTMLButtonElement>('clear');
const shareBtn = element<HTMLButtonElement>('share');
const exportBtn = element<HTMLButtonElement>('export');
const exportCsvBtn = element<HTMLButtonElement>('export-csv');
const randomSeedBtn = element<HTMLButtonElement>('random-seed');
const clearObstaclesBtn = element<HTMLButtonElement>('clear-obstacles');

const muInput = element<HTMLInputElement>('mu');
const dtInput = element<HTMLInputElement>('dt');
const speedInput = element<HTMLInputElement>('speed');
const seedInput = element<HTMLInputElement>('seed');
const modeSelect = element<HTMLSelectElement>('mode');
const flowModeSelect = element<HTMLSelectElement>('flow-mode');
const presetSelect = element<HTMLSelectElement>('preset');
const mapFile = element<HTMLInputElement>('mapfile');
const clearMapBtn = element<HTMLButtonElement>('clearmap');

const showMstInput = element<HTMLInputElement>('show-mst');
const showPressureInput = element<HTMLInputElement>('show-pressure');
const showLabelsInput = element<HTMLInputElement>('show-labels');
const mapObstacleInput = element<HTMLInputElement>('map-obstacle');

const metricTl = element<HTMLElement>('metric-tl');
const metricMd = element<HTMLElement>('metric-md');
const metricFt = element<HTMLElement>('metric-ft');
const metricPcg = element<HTMLElement>('metric-pcg');
const edgeInspector = element<HTMLParagraphElement>('edge-inspector');
const stats = element<HTMLParagraphElement>('stats');
const statusText = element<HTMLSpanElement>('status-text');
const canvasSummary = element<HTMLParagraphElement>('canvas-summary');
const muValue = element<HTMLOutputElement>('mu-value');
const dtValue = element<HTMLOutputElement>('dt-value');
const speedValue = element<HTMLOutputElement>('speed-value');

const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tool]'));
const demoButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-demo]'));
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

let mode: GraphMode = 'complete';
let flowMode: FlowMode = 'source-sink';
let mu = 1.2;
let simulationDt = 0.05;
let speed = 8;
let seed = 1207;
let running = false;
let activeTool: InteractionTool = 'internal';
let graph: Graph = emptyGraph();
let terrain: TerrainField = createTerrain();
let simRandom = createRandom(seed);
let iteration = 0;
let lastStepMetrics: StepMetrics = {
  maxChange: 0,
  meanChange: 0,
  pressures: [],
  iterations: 0,
  residual: 0,
  converged: true,
};
let lastNetworkMetrics: NetworkMetrics = computeNetworkMetrics(graph, flowMode);
let historySamples: HistorySample[] = [];
let hoveredEdgeIndex: number | null = null;
let paintingPointer = false;
let flowPhase = 0;

let lastFrameTs = performance.now();
let fpsAverage = 0;
let mapImage: HTMLImageElement | null = null;
let mapObjectUrl: string | null = null;

function buildGraph(nodes: Node[]): Graph {
  const random = createRandom(seed);
  const built =
    mode === 'delaunay'
      ? buildDelaunayGraph(nodes, random)
      : buildCompleteGraph(nodes, random);
  applyTerrainToGraph(built, terrain);
  return built;
}

function setRunning(next: boolean): void {
  running = next && hasActiveTerminals(graph, flowMode);
  runBtn.textContent = running ? 'Pause' : 'Run';
  runBtn.setAttribute('aria-pressed', String(running));
}

function updateControls(): void {
  muInput.value = String(mu);
  dtInput.value = String(simulationDt);
  speedInput.value = String(speed);
  seedInput.value = String(seed);
  modeSelect.value = mode;
  flowModeSelect.value = flowMode;
  muValue.value = mu.toFixed(2);
  dtValue.value = simulationDt.toFixed(2);
  speedValue.value = `${speed}×`;
}

function statusLabel(): string {
  if (!hasActiveTerminals(graph, flowMode)) {
    return flowMode === 'multi-terminal' ? 'Add ≥ 2 terminals' : 'Add a source and a sink';
  }
  if (running) return lastStepMetrics.maxChange < 1e-5 ? 'Converged' : 'Adapting';
  if (iteration > 0 && lastStepMetrics.maxChange < 1e-5) return 'Converged';
  return iteration > 0 ? 'Paused' : 'Ready';
}

function recordNetworkSnapshot(): void {
  lastNetworkMetrics = computeNetworkMetrics(graph, flowMode, 0.05);
  if (
    historySamples.length === 0 ||
    iteration - historySamples[historySamples.length - 1].step >= 4
  ) {
    historySamples.push({
      step: iteration,
      tlRatio: lastNetworkMetrics.tlRatio,
      mdRatio: lastNetworkMetrics.mdRatio,
      faultTolerance: lastNetworkMetrics.faultTolerance,
      efficiencyScore: lastNetworkMetrics.efficiencyScore,
    });
    if (historySamples.length > 120) historySamples.shift();
  }
}

function drawSparkline(): void {
  if (!sparkContext) return;
  const w = sparkCanvas.width;
  const h = sparkCanvas.height;
  sparkContext.clearRect(0, 0, w, h);
  if (historySamples.length < 2) return;

  const maxTl = Math.max(2.5, ...historySamples.map((s) => s.tlRatio));
  const plotLine = (color: string, getY: (s: HistorySample) => number): void => {
    sparkContext.strokeStyle = color;
    sparkContext.lineWidth = 1.8;
    sparkContext.beginPath();
    for (let idx = 0; idx < historySamples.length; idx++) {
      const x = (idx / (historySamples.length - 1)) * (w - 4) + 2;
      const y = h - 3 - Math.min(1, Math.max(0, getY(historySamples[idx]))) * (h - 6);
      if (idx === 0) sparkContext.moveTo(x, y);
      else sparkContext.lineTo(x, y);
    }
    sparkContext.stroke();
  };

  plotLine('#a3e66f', (s) => s.tlRatio / maxTl);
  plotLine('#38bdf8', (s) => s.faultTolerance);
}

function updateEdgeInspector(): void {
  if (hoveredEdgeIndex === null || !graph.edges[hoveredEdgeIndex]) {
    edgeInspector.textContent =
      activeTool === 'cut'
        ? 'Cut Edge active: click any tube on the canvas to sever it and observe rerouting.'
        : 'Hover any path on the canvas to inspect its live Tero equation.';
    return;
  }
  const edge = graph.edges[hoveredEdgeIndex];
  const a = graph.nodes[edge.i];
  const b = graph.nodes[edge.j];
  const nameA = a.label ?? `#${a.id}`;
  const nameB = b.label ?? `#${b.id}`;
  const qAbs = Math.abs(edge.flow);
  const qm = Math.pow(qAbs, mu);
  const fVal = qm / (1 + qm);
  const trend = edge.severed
    ? 'Severed'
    : fVal > edge.D + 1e-4
      ? 'Growing'
      : fVal < edge.D - 1e-4
        ? 'Pruning'
        : 'Steady';
  const lEff = edge.length * edge.costFactor;
  edgeInspector.textContent = `Edge ${nameA}↔${nameB} · L_eff=${lEff.toFixed(1)}px (×${edge.costFactor.toFixed(2)}) · D=${edge.D.toFixed(3)} · |Q|=${qAbs.toFixed(3)} · f(|Q|)=${fVal.toFixed(3)} · ${trend}`;
}

function updateStats(fps: number): void {
  const activeEdges = graph.edges.filter((edge) => !edge.severed && edge.D >= 0.05).length;
  const sources = graph.nodes.filter((node) => node.flow > 0).length;
  const sinks = graph.nodes.filter((node) => node.flow < 0).length;
  const status = statusLabel();
  statusText.textContent = status;
  statusText.dataset.state = status.toLowerCase().replace(/ /g, '-');

  metricTl.textContent =
    lastNetworkMetrics.mstLength > 0 ? `${lastNetworkMetrics.tlRatio.toFixed(2)}×` : '—';
  metricMd.textContent = Number.isFinite(lastNetworkMetrics.mdRatio) && lastNetworkMetrics.mdRatio > 0
    ? `${lastNetworkMetrics.mdRatio.toFixed(2)}×`
    : lastNetworkMetrics.connected
      ? '1.00×'
      : 'Disconn.';
  metricFt.textContent = `${Math.round(lastNetworkMetrics.faultTolerance * 100)}%`;
  metricPcg.textContent = `${lastStepMetrics.iterations} it · ${lastStepMetrics.residual.toExponential(1)}`;

  drawSparkline();
  updateEdgeInspector();

  stats.textContent = `${graph.nodes.length} nodes · ${activeEdges}/${graph.edges.length} visible paths · ${iteration.toLocaleString()} steps · ${fps.toFixed(0)} fps`;
  canvasSummary.textContent = `Network canvas: ${graph.nodes.length} nodes, ${sources} sources, ${sinks} sinks, and ${activeEdges} visible paths. Simulation status: ${status}.`;
}

function draw(): void {
  render(ctx, graph, {
    backgroundImage: mapImage,
    terrain,
    flowMode,
    showMst: showMstInput.checked,
    mstEdgeIndices: lastNetworkMetrics.mstEdgeIndices,
    showPressure: showPressureInput.checked,
    pressures: lastStepMetrics.pressures,
    showFlowParticles: showPressureInput.checked && !reducedMotion,
    phase: flowPhase,
    hoveredEdgeIndex,
    showLabels: showLabelsInput.checked,
  });
}

function runSteps(count: number): void {
  if (!hasActiveTerminals(graph, flowMode)) return;
  for (let index = 0; index < count; index++) {
    lastStepMetrics = step(graph, mu, simulationDt, {
      flowMode,
      random: simRandom,
      prevPressures: lastStepMetrics.pressures,
    });
  }
  iteration += count;
  recordNetworkSnapshot();
}

function resetMetricsAndSolve(): void {
  iteration = 0;
  simRandom = createRandom(seed);
  lastStepMetrics = {
    maxChange: 0,
    meanChange: 0,
    pressures: [],
    iterations: 0,
    residual: 0,
    converged: true,
  };
  historySamples = [];
  hoveredEdgeIndex = null;
  recordNetworkSnapshot();
}

function restartGraph(): void {
  setRunning(false);
  graph = buildGraph(graph.nodes);
  resetMetricsAndSolve();
  draw();
  updateStats(fpsAverage);
}

function clearGraph(): void {
  setRunning(false);
  graph = emptyGraph();
  clearTerrain(terrain);
  presetSelect.value = '';
  resetMetricsAndSolve();
  draw();
  updateStats(fpsAverage);
}

function applyState(state: SharedState, presetId = ''): void {
  setRunning(false);
  mode = state.mode;
  flowMode = state.version === 2 ? state.flowMode : 'source-sink';
  mu = state.mu;
  simulationDt = state.dt;
  speed = state.speed;
  seed = normalizeSeed(state.seed);
  clearTerrain(terrain);
  graph = buildGraph(state.nodes);
  showLabelsInput.checked = state.nodes.some((n) => Boolean(n.label));
  presetSelect.value = presetId;
  resetMetricsAndSolve();
  updateControls();
  draw();
  updateStats(fpsAverage);
}

function loadPreset(id: string): void {
  const preset = getPreset(id);
  const presetFlowMode: FlowMode = preset.flowMode ?? 'source-sink';
  const presetMu = preset.mu ?? (preset.id === 'city-ring' ? 0.85 : 1.2);
  applyState(
    presetFlowMode === 'multi-terminal'
      ? {
          version: 2,
          nodes: preset.nodes,
          mode: preset.mode,
          flowMode: presetFlowMode,
          mu: presetMu,
          dt: 0.05,
          speed: 8,
          seed: preset.seed,
        }
      : {
          version: 1,
          nodes: preset.nodes,
          mode: preset.mode,
          mu: presetMu,
          dt: 0.05,
          speed: 8,
          seed: preset.seed,
        },
    preset.id,
  );
  if (preset.terrainPolygons) {
    for (const poly of preset.terrainPolygons) {
      paintTerrainPolygon(terrain, poly, 0.9);
    }
    applyTerrainToGraph(graph, terrain);
    recordNetworkSnapshot();
    draw();
    updateStats(fpsAverage);
  }
  history.replaceState(null, '', location.pathname + location.search);
}

function currentState(): SharedState {
  const baseNodes = graph.nodes.map((node) =>
    node.label ? { id: node.id, x: node.x, y: node.y, flow: node.flow, label: node.label } : { id: node.id, x: node.x, y: node.y, flow: node.flow },
  );
  if (flowMode === 'multi-terminal' || baseNodes.some((n) => Boolean(n.label))) {
    return {
      version: 2,
      nodes: baseNodes,
      mode,
      flowMode,
      mu,
      dt: simulationDt,
      speed,
      seed,
    };
  }
  return {
    version: 1,
    nodes: baseNodes,
    mode,
    mu,
    dt: simulationDt,
    speed,
    seed,
  };
}

async function copyShareLink(): Promise<void> {
  const hash = `state=${encodeState(currentState())}`;
  history.replaceState(null, '', `${location.pathname}${location.search}#${hash}`);
  try {
    await navigator.clipboard.writeText(location.href);
    shareBtn.textContent = 'Link copied';
  } catch {
    shareBtn.textContent = 'Link ready';
  }
  window.setTimeout(() => {
    shareBtn.textContent = 'Copy link';
  }, 1800);
}

function exportPng(): void {
  draw();
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `physarum-${seed}-${iteration}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function exportCsv(): void {
  const lines = [
    'type,step_or_edge,tl_ratio,md_ratio,fault_tolerance,efficiency_score,conductivity_D,flow_Q,length_px,cost_factor',
  ];
  for (const h of historySamples) {
    lines.push(
      `history,${h.step},${h.tlRatio.toFixed(4)},${Number.isFinite(h.mdRatio) ? h.mdRatio.toFixed(4) : 'Inf'},${h.faultTolerance.toFixed(4)},${h.efficiencyScore.toFixed(4)},,,,`,
    );
  }
  for (const e of graph.edges) {
    if (e.severed || e.D < 0.05) continue;
    lines.push(
      `edge,${e.i}-${e.j},,,,,${e.D.toFixed(4)},${Math.abs(e.flow).toFixed(4)},${e.length.toFixed(2)},${e.costFactor.toFixed(2)}`,
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `physarum-metrics-${seed}-${iteration}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function setActiveTool(tool: InteractionTool): void {
  activeTool = tool;
  for (const button of toolButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
  }
  updateEdgeInspector();
}

function canvasCoords(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * canvas.height) / rect.height,
  };
}

function applyMapImageAsObstacle(): void {
  if (!mapImage || !mapObstacleInput.checked) return;
  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const offCtx = off.getContext('2d');
  if (!offCtx) return;
  offCtx.drawImage(mapImage, 0, 0, off.width, off.height);
  const imgData = offCtx.getImageData(0, 0, off.width, off.height);
  terrain = terrainFromImageData(imgData, false);
  applyTerrainToGraph(graph, terrain);
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
}

for (const preset of PRESETS) {
  const option = document.createElement('option');
  option.value = preset.id;
  option.textContent = preset.name;
  presetSelect.append(option);
}

presetSelect.addEventListener('change', () => {
  if (presetSelect.value) loadPreset(presetSelect.value);
});

flowModeSelect.addEventListener('change', () => {
  flowMode = flowModeSelect.value as FlowMode;
  setRunning(false);
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
});

for (const button of toolButtons) {
  button.addEventListener('click', () => setActiveTool(button.dataset.tool as InteractionTool));
}

for (const button of demoButtons) {
  button.addEventListener('click', () => {
    const demo = button.dataset.demo;
    if (demo === 'pressure') {
      showPressureInput.checked = true;
      setRunning(true);
    } else if (demo === 'mesh') {
      mu = 0.75;
      updateControls();
      setRunning(true);
    } else if (demo === 'tree') {
      mu = 1.6;
      updateControls();
      setRunning(true);
    } else if (demo === 'tokyo') {
      loadPreset('tokyo-rail');
      showMstInput.checked = true;
      showLabelsInput.checked = true;
      setRunning(true);
    } else if (demo === 'heal') {
      setActiveTool('cut');
      if (iteration < 20) runSteps(40);
      setRunning(true);
    }
    draw();
    updateStats(fpsAverage);
  });
}

canvas.addEventListener('pointerdown', (event) => {
  const { x, y } = canvasCoords(event);

  if (activeTool === 'obstacle' || activeTool === 'erase') {
    paintingPointer = true;
    paintTerrainDisk(terrain, x, y, 22, activeTool === 'obstacle' ? 1 : 0);
    applyTerrainToGraph(graph, terrain);
    recordNetworkSnapshot();
    draw();
    updateStats(fpsAverage);
    return;
  }

  if (activeTool === 'cut') {
    const severed = severEdgeNear(graph, x, y, 14);
    if (severed !== null) {
      hoveredEdgeIndex = null;
      recordNetworkSnapshot();
      draw();
      updateStats(fpsAverage);
    }
    return;
  }

  if (graph.nodes.some((node) => Math.hypot(node.x - x, node.y - y) < 14)) return;
  const tool = event.shiftKey ? 'source' : event.altKey ? 'sink' : activeTool;
  const flow = tool === 'source' ? 1 : tool === 'sink' ? -1 : 0;
  setRunning(false);
  graph = addNode(graph, x, y, flow, mode, createRandom(seed)).graph;
  applyTerrainToGraph(graph, terrain);
  presetSelect.value = '';
  resetMetricsAndSolve();
  draw();
  updateStats(fpsAverage);
});

canvas.addEventListener('pointermove', (event) => {
  const { x, y } = canvasCoords(event);
  if (paintingPointer && (activeTool === 'obstacle' || activeTool === 'erase')) {
    paintTerrainDisk(terrain, x, y, 22, activeTool === 'obstacle' ? 1 : 0);
    applyTerrainToGraph(graph, terrain);
    draw();
    return;
  }
  const nextHover = findEdgeNear(graph, x, y, 10);
  if (nextHover !== hoveredEdgeIndex) {
    hoveredEdgeIndex = nextHover;
    updateEdgeInspector();
    if (!running) draw();
  }
});

window.addEventListener('pointerup', () => {
  if (paintingPointer) {
    paintingPointer = false;
    recordNetworkSnapshot();
    updateStats(fpsAverage);
  }
});

canvas.addEventListener('pointerleave', () => {
  if (hoveredEdgeIndex !== null) {
    hoveredEdgeIndex = null;
    updateEdgeInspector();
    if (!running) draw();
  }
});

clearObstaclesBtn.addEventListener('click', () => {
  clearTerrain(terrain);
  mapObstacleInput.checked = false;
  applyTerrainToGraph(graph, terrain);
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
});

runBtn.addEventListener('click', () => setRunning(!running));
stepBtn.addEventListener('click', () => {
  setRunning(false);
  runSteps(speed);
  draw();
  updateStats(fpsAverage);
});
restartBtn.addEventListener('click', restartGraph);
clearBtn.addEventListener('click', clearGraph);
shareBtn.addEventListener('click', () => void copyShareLink());
exportBtn.addEventListener('click', exportPng);
exportCsvBtn.addEventListener('click', exportCsv);

muInput.addEventListener('input', () => {
  mu = Number(muInput.value);
  muValue.value = mu.toFixed(2);
  updateEdgeInspector();
});
dtInput.addEventListener('input', () => {
  simulationDt = Number(dtInput.value);
  dtValue.value = simulationDt.toFixed(2);
});
speedInput.addEventListener('input', () => {
  speed = Number(speedInput.value);
  speedValue.value = `${speed}×`;
});
seedInput.addEventListener('change', () => {
  seed = normalizeSeed(Number(seedInput.value));
  seedInput.value = String(seed);
  restartGraph();
});
randomSeedBtn.addEventListener('click', () => {
  seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  seedInput.value = String(seed);
  restartGraph();
});
modeSelect.addEventListener('change', () => {
  mode = modeSelect.value as GraphMode;
  restartGraph();
});

showMstInput.addEventListener('change', () => {
  draw();
});
showPressureInput.addEventListener('change', () => {
  if (showPressureInput.checked && lastStepMetrics.pressures.length === 0 && hasActiveTerminals(graph, flowMode)) {
    runSteps(1);
    updateStats(fpsAverage);
  }
  draw();
});
showLabelsInput.addEventListener('change', () => {
  draw();
});
mapObstacleInput.addEventListener('change', () => {
  if (mapObstacleInput.checked) {
    applyMapImageAsObstacle();
  } else {
    clearTerrain(terrain);
    applyTerrainToGraph(graph, terrain);
    recordNetworkSnapshot();
    draw();
    updateStats(fpsAverage);
  }
});

mapFile.addEventListener('change', () => {
  const file = mapFile.files?.[0];
  if (!file) return;
  if (mapObjectUrl) URL.revokeObjectURL(mapObjectUrl);
  mapObjectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.addEventListener('load', () => {
    mapImage = image;
    if (mapObstacleInput.checked) applyMapImageAsObstacle();
    draw();
  });
  image.src = mapObjectUrl;
});

clearMapBtn.addEventListener('click', () => {
  mapImage = null;
  if (mapObjectUrl) URL.revokeObjectURL(mapObjectUrl);
  mapObjectUrl = null;
  mapFile.value = '';
  draw();
});

function frame(): void {
  const now = performance.now();
  const elapsed = now - lastFrameTs;
  lastFrameTs = now;
  const instantFps = elapsed > 0 ? 1000 / elapsed : 0;
  fpsAverage = fpsAverage === 0 ? instantFps : fpsAverage * 0.9 + instantFps * 0.1;
  if (running) {
    runSteps(speed);
    if (!reducedMotion) flowPhase = (flowPhase + elapsed * 0.00055) % 1;
  } else if (showPressureInput.checked && !reducedMotion) {
    flowPhase = (flowPhase + elapsed * 0.00035) % 1;
  }
  draw();
  updateStats(fpsAverage);
  requestAnimationFrame(frame);
}

const sharedState = stateFromHash(location.hash);
if (sharedState) applyState(sharedState);
else loadPreset('direct-route');
setActiveTool('internal');
requestAnimationFrame(frame);
