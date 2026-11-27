import './style.css';

import {
  exportFjspCpSatPython,
  getCellsForPreset,
  getJewelryJobsForPreset,
  JEWELRY_CELLS,
  SHIFT_MIN_PER_DAY,
  solveTwoLevelFjsp,
  type CellSpec,
  type JewelryJobSpec,
  type JewelryOpSpec,
  type TwoLevelComparison,
} from './fjsp';
import {
  addNode,
  applyCapacitiesToGraph,
  buildCompleteGraph,
  buildDelaunayGraph,
  buildExplicitGraph,
  emptyGraph,
  findEdgeNear,
  hasActiveTerminals,
  severEdgeNear,
  toggleEdgeCapacityNear,
  type DynamicsMode,
  type ExplicitEdgeSpec,
  type FlowMode,
  type Graph,
  type GraphMode,
  type LabDomain,
  type Node,
} from './graph';
import {
  applyViewerScope,
  evaluateGraphRag,
  exportGraphRagJson,
  type GraphRagEvaluation,
  type GraphRagViewerScope,
} from './graphrag';
import { computeNetworkMetrics, type NetworkMetrics } from './metrics';
import {
  buildErpJewelryScenario,
  evaluateErpComparison,
  type ErpComparison,
  type ErpScenario,
} from './mrp';
import {
  computeOptimizationMetrics,
  exportSpiceNetlist,
  solveExactMinCostFlow,
  type ExactFlowSolution,
  type OptimizationMetrics,
} from './optimize';
import { bindPoEditor } from './po-editor';
import { editableRoute, scheduledRoute, type PoOperationEdit } from './po-routing';
import { PRESETS, getPreset, type EdgeCapacitySpec } from './presets';
import { createRandom, normalizeSeed } from './random';
import {
  render,
  renderCashFlowChart,
  renderCrossbarMatrix,
  renderGanttChart,
  renderSystemsComparisonChart,
} from './render';
import { step, type StepMetrics } from './sim';
import { effectiveEdgeCost } from './solver';
import { encodeState, stateFromHash, type SharedState } from './state';
import {
  SYSTEMS_SCENARIOS,
  applySystemsConditions,
  createDefaultSystemsConditions,
  evaluateSystemsScenario,
  exportSystemsJson,
  getSystemsScenario,
  type SystemsConditions,
  type SystemsEvaluation,
  type SystemsScenarioSpec,
} from './systems';
import {
  applyTerrainToGraph,
  clearTerrain,
  createTerrain,
  paintTerrainDisk,
  paintTerrainPolygon,
  terrainFromImageData,
  type TerrainField,
} from './terrain';
import {
  computeVascularMetrics,
  edgeRadiusMm,
  exportVascularOpenScad,
  exportVascularSvg,
  type VascularMetrics,
} from './vascular';

type InteractionTool = 'internal' | 'source' | 'sink' | 'cut' | 'cap' | 'obstacle' | 'erase';

interface HistorySample {
  step: number;
  tlRatio: number;
  mdRatio: number;
  faultTolerance: number;
  efficiencyScore: number;
  murrayRatio: number;
  hydraulicPower: number;
  lyapunovEnergy: number;
  optimalityGapPct: number;
  fjspMakespan: number;
  fjspMaxLambda: number;
  graphRagTopShare: number;
  graphRagNoisePruned: number;
  sysDropPct: number;
  sysMaxLambda: number;
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
const crossbarCanvas = element<HTMLCanvasElement>('crossbar');
const crossbarContext = crossbarCanvas.getContext('2d');
const ganttCanvas = element<HTMLCanvasElement>('gantt');
const ganttContext = ganttCanvas.getContext('2d');
const cashflowCanvas = element<HTMLCanvasElement>('cashflow');
const cashflowContext = cashflowCanvas.getContext('2d');
const sysChartCanvas = element<HTMLCanvasElement>('syschart');
const sysChartContext = sysChartCanvas.getContext('2d');

const runBtn = element<HTMLButtonElement>('run');
const stepBtn = element<HTMLButtonElement>('step');
const restartBtn = element<HTMLButtonElement>('restart');
const clearBtn = element<HTMLButtonElement>('clear');
const shareBtn = element<HTMLButtonElement>('share');
const exportBtn = element<HTMLButtonElement>('export');
const exportCsvBtn = element<HTMLButtonElement>('export-csv');
const exportSvgBtn = element<HTMLButtonElement>('export-svg');
const exportScadBtn = element<HTMLButtonElement>('export-scad');
const exportSpiceBtn = element<HTMLButtonElement>('export-spice');
const exportCpsatBtn = element<HTMLButtonElement>('export-cpsat');
const exportScheduleBtn = element<HTMLButtonElement>('export-schedule');
const exportGraphRagBtn = element<HTMLButtonElement>('export-graphrag');
const exportSystemsBtn = element<HTMLButtonElement>('export-systems');
const randomSeedBtn = element<HTMLButtonElement>('random-seed');
const clearObstaclesBtn = element<HTMLButtonElement>('clear-obstacles');

const muInput = element<HTMLInputElement>('mu');
const dtInput = element<HTMLInputElement>('dt');
const speedInput = element<HTMLInputElement>('speed');
const autoStopInput = element<HTMLInputElement>('auto-stop');
const seedInput = element<HTMLInputElement>('seed');
const maxRadiusInput = element<HTMLInputElement>('max-radius');
const maxRadiusField = element<HTMLElement>('max-radius-field');
const maxRadiusValue = element<HTMLOutputElement>('max-radius-value');
const fjspWeightInput = element<HTMLInputElement>('fjsp-weight');
const fjspWeightField = element<HTMLElement>('fjsp-weight-field');
const fjspWeightValue = element<HTMLOutputElement>('fjsp-weight-value');
const modeSelect = element<HTMLSelectElement>('mode');
const flowModeSelect = element<HTMLSelectElement>('flow-mode');
const dynamicsModeSelect = element<HTMLSelectElement>('dynamics-mode');
const presetSelect = element<HTMLSelectElement>('preset');
const mapFile = element<HTMLInputElement>('mapfile');
const clearMapBtn = element<HTMLButtonElement>('clearmap');

const showMstInput = element<HTMLInputElement>('show-mst');
const showPressureInput = element<HTMLInputElement>('show-pressure');
const showLabelsInput = element<HTMLInputElement>('show-labels');
const showShearInput = element<HTMLInputElement>('show-shear');
const showOptInput = element<HTMLInputElement>('show-opt');
const showCapsInput = element<HTMLInputElement>('show-caps');
const mapObstacleInput = element<HTMLInputElement>('map-obstacle');

const showShearRow = element<HTMLElement>('show-shear-row');
const showOptRow = element<HTMLElement>('show-opt-row');
const showCapsRow = element<HTMLElement>('show-caps-row');
const crossbarPanel = element<HTMLElement>('crossbar-panel');
const crossbarMeta = element<HTMLElement>('crossbar-meta');
const ganttSection = element<HTMLElement>('gantt-section');
const fjspVerifyBadge = element<HTMLElement>('fjsp-verify-badge');
const fjspToggleViewBtn = element<HTMLButtonElement>('fjsp-toggle-view');
const erpPanel = element<HTMLElement>('erp-panel');
const erpMrpBadge = element<HTMLElement>('erp-mrp-badge');
const erpCashBadge = element<HTMLElement>('erp-cash-badge');
const mrpSummary = element<HTMLElement>('mrp-summary');
const soSummary = element<HTMLElement>('so-summary');
const fjspShiftRow = element<HTMLElement>('fjsp-shift-row');
const fjspShiftCapInput = element<HTMLInputElement>('fjsp-shift-cap');
const graphragPanel = element<HTMLElement>('graphrag-panel');
const graphragVerdictBadge = element<HTMLElement>('graphrag-verdict-badge');
const graphragHubBadge = element<HTMLElement>('graphrag-hub-badge');
const graphragViewerSelect = element<HTMLSelectElement>('graphrag-viewer');
const graphragCutT02Btn = element<HTMLButtonElement>('graphrag-cut-t02');
const graphragCutIsoBtn = element<HTMLButtonElement>('graphrag-cut-iso');
const graphragToggleHubCapBtn = element<HTMLButtonElement>('graphrag-toggle-hub-cap');
const graphragResetBtn = element<HTMLButtonElement>('graphrag-reset');
const graphragRankingTable = element<HTMLElement>('graphrag-ranking-table');
const graphragEvidenceTable = element<HTMLElement>('graphrag-evidence-table');
const systemsPanel = element<HTMLElement>('systems-panel');
const systemsStatusBadge = element<HTMLElement>('systems-status-badge');
const systemsBaselineBadge = element<HTMLElement>('systems-baseline-badge');
const sysLoadInput = element<HTMLInputElement>('sys-load');
const sysLoadValue = element<HTMLOutputElement>('sys-load-value');
const sysPresetNormalBtn = element<HTMLButtonElement>('sys-preset-normal');
const sysPresetSurgeBtn = element<HTMLButtonElement>('sys-preset-surge');
const sysPresetOutageBtn = element<HTMLButtonElement>('sys-preset-outage');
const sysResetCondBtn = element<HTMLButtonElement>('sys-reset-cond');
const sysRailSelect = element<HTMLSelectElement>('sys-rail-select');
const sysRailCapInput = element<HTMLInputElement>('sys-rail-cap');
const sysRailCapValue = element<HTMLOutputElement>('sys-rail-cap-value');
const sysRailCostInput = element<HTMLInputElement>('sys-rail-cost');
const sysRailCostValue = element<HTMLOutputElement>('sys-rail-cost-value');
const sysRailCutBtn = element<HTMLButtonElement>('sys-rail-cut');
const systemsTable = element<HTMLElement>('systems-table');

const metric1Label = element<HTMLElement>('metric-1-label');
const metric2Label = element<HTMLElement>('metric-2-label');
const metric3Label = element<HTMLElement>('metric-3-label');
const metric4Label = element<HTMLElement>('metric-4-label');
const sparkLegend = element<HTMLElement>('spark-legend');

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

const domainTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-domain]'));
const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tool]'));
const demoButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-demo]'));
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

let domain: LabDomain = 'transport';
let mode: GraphMode = 'complete';
let flowMode: FlowMode = 'source-sink';
let dynamicsMode: DynamicsMode = 'tero';
let mu = 1.2;
let simulationDt = 0.05;
let speed = 8;
let seed = 1207;
let maxRadiusMm = 1.5;
let fjspGuidanceWeight = 0.9;
let showGreedyGantt = false;
let running = false;
let activeTool: InteractionTool = 'internal';
let activePresetId = '';
let graph: Graph = emptyGraph();
let terrain: TerrainField = createTerrain();
let activeCapacities: EdgeCapacitySpec[] = [];
let activeExplicitSpecs: ExplicitEdgeSpec[] = [];
let activeFjspJobs: JewelryJobSpec[] = getJewelryJobsForPreset('fjsp-jewelry-atelier');
let baseFjspJobs = activeFjspJobs;
let poEdits: PoOperationEdit[] = [];
let platingTemplate: JewelryOpSpec;
let activeFjspCells: CellSpec[] = JEWELRY_CELLS;
let activeErpScenario: ErpScenario | null = null;
let lastErpComparison: ErpComparison | null = null;
let fjspShiftCapEnabled = false;
let lastRenderedErpSignature = '';
let graphRagViewerScope: GraphRagViewerScope = 'buyer';
let lastGraphRagEval: GraphRagEvaluation | null = null;
let lastRenderedGraphRagSig = '';
let autoStopOnConverge = false;
let activeSystemsSpec: SystemsScenarioSpec | null = null;
let systemsConditions: SystemsConditions | null = null;
let lastSystemsEval: SystemsEvaluation | null = null;
let lastRenderedSystemsSig = '';
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
let cachedExactSolution: ExactFlowSolution | null = null;
let lastNetworkMetrics: NetworkMetrics = computeNetworkMetrics(graph, flowMode);
let lastVascularMetrics: VascularMetrics = computeVascularMetrics(graph, [], { maxRadiusMm });
let lastOptMetrics: OptimizationMetrics = computeOptimizationMetrics(graph, []);
let lastFjspComparison: TwoLevelComparison | null = null;
let lastFjspSolveIter = -1;
let lastFjspSolveAt = 0;
let historySamples: HistorySample[] = [];
let hoveredEdgeIndex: number | null = null;
let paintingPointer = false;
let flowPhase = 0;

let lastFrameTs = performance.now();
let fpsAverage = 0;
let mapImage: HTMLImageElement | null = null;
let mapObjectUrl: string | null = null;

const poEditor = bindPoEditor(element<HTMLFormElement>('po-route-form'), edits => {
  applyPoEdits(edits);
  lastRenderedErpSignature = '';
  recomputeFjsp(true);
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
});

function applyPoEdits(edits: PoOperationEdit[]): void {
  poEdits = edits;
  activeFjspJobs = baseFjspJobs.map(job => {
    const changes = edits.filter(edit => edit.jobId === job.id);
    return changes.length ? { ...job, ops: scheduledRoute(editableRoute(job, platingTemplate, changes)) } : job;
  });
  if (activeErpScenario) activeErpScenario.jobs = activeFjspJobs;
}

function updatePoAssignments(): void {
  const solution = showGreedyGantt ? lastFjspComparison?.greedyBaseline : lastFjspComparison?.twoLevel;
  poEditor.showSchedule(solution, lastFjspComparison?.offlineCells ?? []);
  const moldPanel = element<HTMLDetailsElement>('wax-molds');
  const usage = solution?.waxMolds ?? lastFjspComparison?.waxMolds ?? [];
  moldPanel.hidden = usage.length === 0;
  const handoff = element<HTMLElement>('wax-mold-handoff');
  const standbyIds = new Set<string>();
  for (const job of activeFjspJobs) {
    for (const op of job.ops) {
      if (op.waxMold?.spare) standbyIds.add(op.waxMold.spare.id);
    }
  }
  const firstSpare = standbyIds.size
    ? solution?.ops.find(op => op.moldDraws?.some(draw => standbyIds.has(draw.moldId)))
    : undefined;
  handoff.hidden = !firstSpare;
  if (firstSpare) {
    const allocation = firstSpare.moldDraws!.map(draw => `${draw.moldId}: ${draw.shots} shots`).join(', ');
    handoff.textContent = `First standby use · ${firstSpare.jobId} · ${allocation}. Zero changeover time in this trial.`;
  }
  const body = moldPanel.querySelector('tbody')!;
  body.replaceChildren(...usage.map(mold => {
    const row = document.createElement('tr');
    for (const value of [mold.id, mold.cavities, mold.pieces, mold.requiredShots,
      mold.remainingShots, mold.remainingShots - mold.requiredShots]) {
      row.insertCell().textContent = String(value);
    }
    return row;
  }));
}

function invalidateExactCache(): void {
  cachedExactSolution = null;
}

function getExactSolution(): ExactFlowSolution {
  if (!cachedExactSolution) {
    cachedExactSolution = solveExactMinCostFlow(graph);
  }
  return cachedExactSolution;
}

function syncActiveCapacitiesFromGraph(): void {
  const next: EdgeCapacitySpec[] = [];
  for (const edge of graph.edges) {
    if (edge.capacity !== undefined && Number.isFinite(edge.capacity)) {
      next.push({ i: edge.i, j: edge.j, capacity: edge.capacity });
    }
  }
  activeCapacities = next;
}

function buildGraph(nodes: Node[]): Graph {
  const random = createRandom(seed);
  const built =
    mode === 'explicit'
      ? buildExplicitGraph(nodes, activeExplicitSpecs, random)
      : mode === 'delaunay'
        ? buildDelaunayGraph(nodes, random)
        : buildCompleteGraph(nodes, random);
  applyTerrainToGraph(built, terrain);
  if (mode !== 'explicit' || activeCapacities.length > 0) {
    applyCapacitiesToGraph(built, activeCapacities);
  }
  if (domain === 'systems' && activeSystemsSpec && systemsConditions) {
    applySystemsConditions(built, activeSystemsSpec, systemsConditions);
  }
  invalidateExactCache();
  return built;
}

function recomputeFjsp(force = false): void {
  if (domain !== 'fjsp') {
    lastFjspComparison = null;
    lastErpComparison = null;
    lastFjspSolveIter = -1;
    return;
  }
  const largeLiveBatch = running && activeFjspJobs.length >= 300;
  if (!force && lastFjspComparison && largeLiveBatch && performance.now() - lastFjspSolveAt < 3000) return;
  const interval = activeFjspJobs.length > 25 ? 48 : 16;
  if (!force && lastFjspComparison && iteration - lastFjspSolveIter < interval) return;
  lastFjspComparison = solveTwoLevelFjsp(graph, activeFjspJobs, {
    physarumWeight: fjspGuidanceWeight,
    refine: force || !largeLiveBatch,
    shiftMinPerDay: fjspShiftCapEnabled ? SHIFT_MIN_PER_DAY : 0,
    cells: activeFjspCells,
  });
  lastErpComparison =
    activeErpScenario && lastFjspComparison
      ? evaluateErpComparison(activeErpScenario, lastFjspComparison)
      : null;
  lastFjspSolveIter = iteration;
  lastFjspSolveAt = performance.now();
  updatePoAssignments();
}

function setRunning(next: boolean): void {
  const wasRunning = running;
  running = next && hasActiveTerminals(graph, flowMode);
  runBtn.textContent = running ? 'Pause' : 'Run';
  runBtn.setAttribute('aria-pressed', String(running));
  if (wasRunning && !running && domain === 'fjsp') {
    recomputeFjsp(true);
  }
}

function syncDomainUi(): void {
  for (const tab of domainTabs) {
    tab.setAttribute('aria-selected', String(tab.dataset.domain === domain));
  }

  const isVascular = domain === 'vascular';
  const isOptimization = domain === 'optimization';
  const isFjsp = domain === 'fjsp';
  const isGraphRag = domain === 'graphrag';
  const isSystems = domain === 'systems';
  exportSvgBtn.hidden = !isVascular;
  exportScadBtn.hidden = !isVascular;
  exportSpiceBtn.hidden = !isOptimization;
  exportCpsatBtn.hidden = !isFjsp;
  exportScheduleBtn.hidden = !isFjsp;
  exportGraphRagBtn.hidden = !isGraphRag;
  exportSystemsBtn.hidden = !isSystems;
  ganttSection.hidden = !isFjsp;
  erpPanel.hidden = !(isFjsp && activeErpScenario !== null);
  graphragPanel.hidden = !isGraphRag;
  systemsPanel.hidden = !isSystems;
  maxRadiusField.hidden = !isVascular && dynamicsMode !== 'murray';
  fjspWeightField.hidden = !isFjsp;
  fjspShiftRow.hidden = !isFjsp;
  showShearRow.hidden = !isVascular && dynamicsMode !== 'murray';
  showOptRow.hidden =
    !isOptimization && !isFjsp && !isGraphRag && !isSystems && dynamicsMode !== 'linear-lp';
  showCapsRow.hidden =
    !isOptimization && !isFjsp && !isGraphRag && !isSystems && dynamicsMode !== 'linear-lp';
  crossbarPanel.hidden = !isOptimization;

  if (isVascular) {
    metric1Label.textContent = 'Murray Law (Σr³/r_p³)';
    metric2Label.textContent = 'Hydraulic Power · ΔP';
    metric3Label.textContent = 'Shear CV · Fluid Vol';
    metric4Label.textContent = 'Channels · Radius';
    sparkLegend.innerHTML = 'History (<span class="legend-tl">Murray</span> · <span class="legend-ft">Power</span>)';
  } else if (isOptimization) {
    metric1Label.textContent = 'Primal vs OPT (Gap)';
    metric2Label.textContent = 'Lyapunov Energy E(D)';
    metric3Label.textContent = 'Cap Viol · Sparsity';
    metric4Label.textContent = 'Crossbar (R_eff · DR)';
    sparkLegend.innerHTML = 'History (<span class="legend-tl">Lyapunov</span> · <span class="legend-ft">Gap%</span>)';
  } else if (isFjsp) {
    metric1Label.textContent = 'Makespan (2-Lvl vs Greedy)';
    metric2Label.textContent = 'Setup · LB Gap';
    metric3Label.textContent = 'Upper Bottleneck (λ_e)';
    metric4Label.textContent = 'Offline Cells · Verified';
    sparkLegend.innerHTML = 'History (<span class="legend-tl">Makespan</span> · <span class="legend-ft">Max λ</span>)';
  } else if (isGraphRag) {
    metric1Label.textContent = 'Top Winner · Verdict';
    metric2Label.textContent = 'PPR Baseline vs Trap';
    metric3Label.textContent = 'Hub Shadow Price (λ_e)';
    metric4Label.textContent = 'Noise Pruned · T04 Hidden';
    sparkLegend.innerHTML = 'History (<span class="legend-tl">Top Share</span> · <span class="legend-ft">Noise Pruned</span>)';
  } else if (isSystems) {
    const costLabel = activeSystemsSpec?.costMetricLabel ?? 'Unit Cost';
    const succLabel = activeSystemsSpec?.successMetricLabel ?? 'Success';
    metric1Label.textContent = `${costLabel} (Phy vs Static)`;
    metric2Label.textContent = 'Overload / Drop (Phy vs Static)';
    metric3Label.textContent = `${succLabel} · Max λ_e`;
    metric4Label.textContent = 'Demand · Active Rails';
    sparkLegend.innerHTML = 'History (<span class="legend-tl">Drop%</span> · <span class="legend-ft">Max λ</span>)';
  } else {
    metric1Label.textContent = 'Cost (TL / MST)';
    metric2Label.textContent = 'Efficiency (MD)';
    metric3Label.textContent = 'Fault Tolerance (FT)';
    metric4Label.textContent = 'Solver (PCG)';
    sparkLegend.innerHTML = 'History (<span class="legend-tl">TL</span> · <span class="legend-ft">FT</span>)';
  }
}

function updateControls(): void {
  muInput.value = String(mu);
  dtInput.value = String(simulationDt);
  speedInput.value = String(speed);
  seedInput.value = String(seed);
  maxRadiusInput.value = String(maxRadiusMm);
  fjspWeightInput.value = String(fjspGuidanceWeight);
  modeSelect.value = mode;
  flowModeSelect.value = flowMode;
  dynamicsModeSelect.value = dynamicsMode;
  muValue.value = mu.toFixed(2);
  dtValue.value = simulationDt.toFixed(2);
  speedValue.value = `${speed}×`;
  maxRadiusValue.value = maxRadiusMm.toFixed(2);
  fjspWeightValue.value = fjspGuidanceWeight.toFixed(2);
  syncDomainUi();
}

function statusLabel(): string {
  if (!hasActiveTerminals(graph, flowMode)) {
    return flowMode === 'multi-terminal' ? 'Add ≥ 2 terminals' : 'Add a source and a sink';
  }
  const convergedNow = iteration >= 30 && lastStepMetrics.maxChange < 5e-5;
  if (running) return convergedNow ? 'Converged' : 'Adapting';
  if (convergedNow) return 'Converged';
  return iteration > 0 ? 'Paused' : 'Ready';
}

function recordNetworkSnapshot(): void {
  const activeThreshold = domain === 'vascular' ? 0.005 : 0.05;
  lastNetworkMetrics = computeNetworkMetrics(graph, flowMode, activeThreshold);
  lastVascularMetrics = computeVascularMetrics(graph, lastStepMetrics.pressures, {
    maxRadiusMm,
    activeThreshold: 0.005,
  });
  const needsOpt =
    domain === 'optimization' ||
    domain === 'fjsp' ||
    domain === 'systems' ||
    dynamicsMode === 'linear-lp' ||
    showOptInput.checked;
  lastOptMetrics = needsOpt
    ? computeOptimizationMetrics(graph, lastStepMetrics.pressures, getExactSolution())
    : {
        primalFlowCost: 0,
        exactOptCost: 0,
        optimalityGapPct: 0,
        feasible: false,
        conductanceCost: 0,
        electricalPower: 0,
        lyapunovEnergy: 0,
        maxCapacityViolation: 0,
        activeMemristors: 0,
        totalMemristors: 0,
        sparsityPct: 0,
        conductanceDynamicRange: 1,
        effectiveResistance: 0,
        optimalEdgeIndices: [],
      };

  recomputeFjsp(false);

  if (domain === 'graphrag') {
    applyViewerScope(graph, graphRagViewerScope);
    lastGraphRagEval = evaluateGraphRag(graph, graphRagViewerScope);
  } else {
    lastGraphRagEval = null;
  }

  if (domain === 'systems' && activeSystemsSpec && systemsConditions) {
    lastSystemsEval = evaluateSystemsScenario(graph, activeSystemsSpec, systemsConditions);
  } else {
    lastSystemsEval = null;
  }

  const fjspMaxLambda = lastFjspComparison
    ? Math.max(0, ...Object.values(lastFjspComparison.upperSignals).map((s) => s.shadowPriceLambda))
    : 0;
  const fjspMakespan = lastFjspComparison?.twoLevel.makespanMin ?? 0;
  const graphRagTopShare = lastGraphRagEval?.candidates[0]?.physarumShare ?? 0;
  const graphRagNoisePruned = (lastGraphRagEval?.noisePrunedPct ?? 0) / 100;
  const sysDropPct = lastSystemsEval?.physarum.dropPct ?? 0;
  const sysMaxLambda = lastSystemsEval?.physarum.maxLambda ?? 0;

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
      murrayRatio: lastVascularMetrics.murrayRatio,
      hydraulicPower: lastVascularMetrics.hydraulicPower,
      lyapunovEnergy: lastOptMetrics.lyapunovEnergy,
      optimalityGapPct: lastOptMetrics.optimalityGapPct,
      fjspMakespan,
      fjspMaxLambda,
      graphRagTopShare,
      graphRagNoisePruned,
      sysDropPct,
      sysMaxLambda,
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

  if (domain === 'vascular') {
    const maxPower = Math.max(1, ...historySamples.map((s) => s.hydraulicPower));
    plotLine('#f87171', (s) => s.murrayRatio / 2);
    plotLine('#38bdf8', (s) => s.hydraulicPower / maxPower);
  } else if (domain === 'optimization') {
    const maxLyap = Math.max(1, ...historySamples.map((s) => s.lyapunovEnergy));
    plotLine('#a3e66f', (s) => s.lyapunovEnergy / maxLyap);
    plotLine('#c084fc', (s) => s.optimalityGapPct / 25);
  } else if (domain === 'fjsp') {
    const maxMs = Math.max(400, ...historySamples.map((s) => s.fjspMakespan));
    const maxLam = Math.max(1, ...historySamples.map((s) => s.fjspMaxLambda));
    plotLine('#a3e66f', (s) => s.fjspMakespan / maxMs);
    plotLine('#f59e0b', (s) => s.fjspMaxLambda / maxLam);
  } else if (domain === 'graphrag') {
    plotLine('#a3e66f', (s) => s.graphRagTopShare);
    plotLine('#38bdf8', (s) => s.graphRagNoisePruned);
  } else if (domain === 'systems') {
    const maxLam = Math.max(1, ...historySamples.map((s) => s.sysMaxLambda));
    plotLine('#f87171', (s) => s.sysDropPct / 100);
    plotLine('#38bdf8', (s) => s.sysMaxLambda / maxLam);
  } else {
    const maxTl = Math.max(2.5, ...historySamples.map((s) => s.tlRatio));
    plotLine('#a3e66f', (s) => s.tlRatio / maxTl);
    plotLine('#38bdf8', (s) => s.faultTolerance);
  }
}

function formatDynamicRange(dr: number): string {
  if (!Number.isFinite(dr) || dr <= 0) return '1×';
  if (dr >= 1000) return `${dr.toExponential(1)}×`;
  return `${dr.toFixed(1)}×`;
}

function updateEdgeInspector(): void {
  if (hoveredEdgeIndex === null || !graph.edges[hoveredEdgeIndex]) {
    if (activeTool === 'cut') {
      edgeInspector.textContent =
        'Cut Edge active: click any tube on the canvas to sever it and observe rerouting.';
    } else if (activeTool === 'cap') {
      edgeInspector.textContent =
        'Cap Edge active: click any tube to toggle a 0.55 flow bottleneck capacity.';
    } else if (domain === 'graphrag') {
      edgeInspector.textContent =
        'Hover any evidence link or use Cut Edge / Cap Edge to test GraphRAG rerouting.';
    } else if (domain === 'systems') {
      edgeInspector.textContent =
        'Hover any rail or adjust the Condition Builder below (Surge / Cap / Extra Cost / Kill Rail) to watch live spillover.';
    } else {
      edgeInspector.textContent = 'Hover any path on the canvas to inspect its live equation.';
    }
    return;
  }

  const edge = graph.edges[hoveredEdgeIndex];
  const a = graph.nodes[edge.i];
  const b = graph.nodes[edge.j];
  const nameA = a.label ?? `#${a.id}`;
  const nameB = b.label ?? `#${b.id}`;
  const qAbs = Math.abs(edge.flow);
  const lEff = effectiveEdgeCost(edge);

  if (domain === 'vascular' || dynamicsMode === 'murray') {
    const target = Math.min(1, Math.pow(qAbs, mu));
    const rMm = edgeRadiusMm(edge.D, maxRadiusMm);
    const shear = edge.D > 1e-6 ? qAbs / Math.pow(edge.D, 0.75) : 0;
    const trend = edge.severed
      ? 'Severed'
      : target > edge.D + 1e-4
        ? 'Dilating'
        : target < edge.D - 1e-4
          ? 'Pruning'
          : 'Steady';
    edgeInspector.textContent = `Vessel ${nameA}↔${nameB} · r=${rMm.toFixed(2)}mm · τ_w=${shear.toFixed(2)} · D=${edge.D.toFixed(3)} · |Q|=${qAbs.toFixed(3)} · ${trend}`;
    return;
  }

  if (domain === 'fjsp' && edge.cellId) {
    const cap = (edge.capacity ?? 1).toFixed(2);
    const lam = (edge.congestion ?? 0).toFixed(2);
    const stateTag = edge.severed ? 'OFFLINE' : 'Online';
    edgeInspector.textContent = `Cell ${edge.cellId} (${edge.stage ?? 'Stage'}) · cap=${cap} · |Q|=${qAbs.toFixed(3)} · λ=${lam} · D=${edge.D.toFixed(3)} · ${stateTag}`;
    return;
  }

  if (domain === 'graphrag') {
    const capInfo =
      edge.capacity !== undefined
        ? ` · cap=${edge.capacity.toFixed(2)} · λ=${(edge.congestion ?? 0).toFixed(2)}`
        : '';
    const stateTag = edge.scopeBlocked
      ? 'T04 BLOCKED'
      : edge.severed
        ? edge.expired
          ? 'EXPIRED'
          : 'REVOKED'
        : 'ACTIVE';
    edgeInspector.textContent = `Edge ${nameA}↔${nameB} · ${edge.relation ?? 'Evidence'} · ${edge.evidenceRef ?? ''} · D=${edge.D.toFixed(3)} · |Q|=${qAbs.toFixed(3)}${capInfo} · ${stateTag}`;
    return;
  }

  if (domain === 'systems' && edge.cellId && lastSystemsEval) {
    const rail = lastSystemsEval.rails.find((r) => r.id === edge.cellId);
    if (rail) {
      const unit = lastSystemsEval.throughputUnit;
      edgeInspector.textContent = `Rail ${rail.label} · ${Math.round(rail.loadUnits)}/${Math.round(rail.capUnits)} ${unit} (${Math.round(rail.sharePct)}%) · Cost ${rail.effectiveUnitCost.toFixed(lastSystemsEval.costUnit === '%' ? 2 : 0)}${lastSystemsEval.costUnit} · λ=${rail.shadowPriceLambda.toFixed(2)} · ${rail.status}`;
      return;
    }
  }

  if (domain === 'optimization' || domain === 'fjsp' || dynamicsMode === 'linear-lp') {
    const gEff = edge.D / (lEff * (1 + Math.max(edge.congestion ?? 0, 0)));
    const capInfo =
      edge.capacity !== undefined
        ? ` · cap=${edge.capacity.toFixed(2)} · λ=${(edge.congestion ?? 0).toFixed(2)}`
        : '';
    const trend = edge.severed
      ? 'Severed'
      : qAbs > edge.D + 1e-4
        ? 'Growing'
        : qAbs < edge.D - 1e-4
          ? 'Pruning'
          : 'Optimal';
    edgeInspector.textContent = `Crosspoint ${nameA}↔${nameB} · c_e=${lEff.toFixed(1)} · G=${gEff.toExponential(2)} · D=${edge.D.toFixed(3)} · |Q|=${qAbs.toFixed(3)}${capInfo} · ${trend}`;
    return;
  }

  const qm = Math.pow(qAbs, mu);
  const fVal = qm / (1 + qm);
  const trend = edge.severed
    ? 'Severed'
    : fVal > edge.D + 1e-4
      ? 'Growing'
      : fVal < edge.D - 1e-4
        ? 'Pruning'
        : 'Steady';
  edgeInspector.textContent = `Edge ${nameA}↔${nameB} · L_eff=${lEff.toFixed(1)}px (×${edge.costFactor.toFixed(2)}) · D=${edge.D.toFixed(3)} · |Q|=${qAbs.toFixed(3)} · f(|Q|)=${fVal.toFixed(3)} · ${trend}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderErpTables(): void {
  if (!lastErpComparison) {
    lastRenderedErpSignature = '';
    return;
  }
  const sig = `${activePresetId}:${lastFjspSolveIter}:${showGreedyGantt ? 'greedy' : 'two'}`;
  if (sig === lastRenderedErpSignature) return;
  lastRenderedErpSignature = sig;

  const plan = showGreedyGantt ? lastErpComparison.greedyBaseline : lastErpComparison.twoLevel;
  const totalStockouts = plan.materialStockouts + plan.sgStockouts;
  erpMrpBadge.textContent = plan.feasible
    ? totalStockouts === 0
      ? '0 stockouts'
      : `${totalStockouts} stockouts`
    : 'Infeasible';
  erpMrpBadge.className = `fjsp-badge ${plan.feasible && totalStockouts === 0 ? 'is-valid' : 'is-invalid'}`;

  const cf = plan.cashFlow;
  const endK = Math.round(cf.endingCashUsd / 1000);
  const minK = Math.round(cf.minCashUsd / 1000);
  erpCashBadge.textContent = plan.feasible
    ? `End $${endK}k · Min $${minK}k (D${cf.minCashDay})`
    : 'Cash Unavailable';
  erpCashBadge.className = `fjsp-badge ${plan.feasible && !cf.cashShortfall ? 'is-valid' : 'is-invalid'}`;

  if (!plan.feasible) {
    mrpSummary.innerHTML = '<p class="explanation">Schedule infeasible — restore offline cell capacity.</p>';
    soSummary.innerHTML = '<p class="explanation">Sales Order rollup unavailable.</p>';
    return;
  }

  const matRows = plan.materials
    .map(
      (m) => `<tr>
        <td>${escapeHtml(m.label)} (${escapeHtml(m.unit)})</td>
        <td class="num">${m.initialQty}</td>
        <td class="num">+${m.plannedReceiptsQty}</td>
        <td class="num">-${m.consumedQty.toFixed(1)}</td>
        <td class="num">${m.endingQty.toFixed(1)}</td>
        <td class="num ${m.minBalanceQty < 0 ? 'erp-tag-late' : 'erp-tag-ok'}">${m.minBalanceQty.toFixed(1)}</td>
      </tr>`,
    )
    .join('');

  const sgRows = plan.sgWarehouse
    .map(
      (sg) => `<tr>
        <td class="erp-tag-sku">${escapeHtml(sg.label)}</td>
        <td class="num">${sg.initialQty}</td>
        <td class="num">+${sg.receivedFromShopQty}</td>
        <td class="num">-${sg.issuedToAssemblyQty}</td>
        <td class="num">${sg.endingQty}</td>
        <td class="num ${sg.minBalanceQty < 0 ? 'erp-tag-late' : 'erp-tag-ok'}">${sg.minBalanceQty}</td>
      </tr>`,
    )
    .join('');

  mrpSummary.innerHTML = `<table class="erp-table">
    <thead><tr><th>Item / SKU</th><th class="num">Init</th><th class="num">Recv</th><th class="num">Used</th><th class="num">End</th><th class="num">Min</th></tr></thead>
    <tbody>${matRows}${sgRows}</tbody>
  </table>`;

  const soRows = plan.salesOrders
    .map((so) => {
      const modelsLabel = so.models.slice(0, 3).join(', ') + (so.models.length > 3 ? '…' : '');
      const statusCls = so.onTime ? 'erp-tag-ok' : 'erp-tag-late';
      const statusText = so.onTime ? 'On Time' : `+${so.tardyDays}d Late`;
      return `<tr>
        <td><strong>${escapeHtml(so.soId)}</strong> · ${escapeHtml(so.customer)}</td>
        <td class="num">${so.poCount} (${so.sgCount}S/${so.fgCount}F)</td>
        <td>${escapeHtml(modelsLabel)}</td>
        <td class="num">D${so.shipDay} / D${so.dueDay}</td>
        <td class="${statusCls}">${statusText}</td>
        <td class="num">$${Math.round(so.revenueUsd / 1000)}k (D${so.balanceDay})</td>
      </tr>`;
    })
    .join('');

  soSummary.innerHTML = `<table class="erp-table">
    <thead><tr><th>Sales Order</th><th class="num">POs</th><th>Models</th><th class="num">Ship/Due</th><th>Status</th><th class="num">Rev / Pay</th></tr></thead>
    <tbody>${soRows}</tbody>
  </table>`;
}

function renderGraphRagTables(): void {
  if (!lastGraphRagEval || domain !== 'graphrag') {
    lastRenderedGraphRagSig = '';
    return;
  }
  const evalRes = lastGraphRagEval;
  const sig = `${activePresetId}:${graphRagViewerScope}:${iteration}:${evalRes.severedEdgesCount}:${evalRes.hiddenPrivateEdges}:${evalRes.candidates.map((c) => `${c.nodeId}:${c.physarumFlux.toFixed(3)}:${c.maxShadowPrice.toFixed(2)}:${c.status}`).join(',')}`;
  if (sig === lastRenderedGraphRagSig) return;
  lastRenderedGraphRagSig = sig;

  if (evalRes.verdict === 'ready') {
    graphragVerdictBadge.textContent = `Ready · ${evalRes.topCandidateLabel ?? 'Eligible'}`;
    graphragVerdictBadge.className = 'fjsp-badge is-valid';
  } else {
    const gaps = evalRes.missingRequirementLabels.join(', ') || 'Requirement gap';
    graphragVerdictBadge.textContent = `Needs review · Missing ${gaps}`;
    graphragVerdictBadge.className = 'fjsp-badge is-invalid';
  }

  if (evalRes.pprHubTrapDetected) {
    const topPpr = evalRes.candidates.find((c) => c.pprRank === 1);
    graphragHubBadge.textContent = `PPR Hub Trap: ${topPpr?.label ?? 'Hub'} #1 (Physarum bypassed)`;
    graphragHubBadge.className = 'fjsp-badge is-warn';
  } else {
    graphragHubBadge.textContent = `Noise ${Math.round(evalRes.noisePrunedPct)}% pruned · ${evalRes.hiddenPrivateEdges} T04 hidden`;
    graphragHubBadge.className = 'fjsp-badge is-valid';
  }

  const hasT02OrInstall = graph.edges.some(
    (e) => !e.severed && (e.relation === 'T02 Pack-of-10' || e.relation === 'On-Site Install'),
  );
  graphragCutT02Btn.disabled = !hasT02OrInstall;
  graphragCutIsoBtn.disabled = !graph.edges.some(
    (e) => !e.severed && Boolean(e.evidenceRef?.startsWith('cert-siam-v2')),
  );

  const rankRows = evalRes.candidates
    .map((c) => {
      const statusCls = c.status === 'eligible' ? 'erp-tag-ok' : 'erp-tag-late';
      const statusLabel =
        c.status === 'eligible'
          ? 'Eligible'
          : `Needs review (${c.missingLabels.map((m) => m.split(' ')[0]).join(', ')})`;
      return `<tr>
        <td><strong>${escapeHtml(c.label)}</strong> <small>(${c.role})</small></td>
        <td class="num">#${c.physarumRank} / #${c.pprRank}</td>
        <td class="num">${c.physarumFlux.toFixed(3)} (${(c.physarumShare * 100).toFixed(0)}%)</td>
        <td class="num">${c.maxShadowPrice.toFixed(2)}</td>
        <td class="num">${c.pprScore.toFixed(3)} (${(c.pprShare * 100).toFixed(0)}%)</td>
        <td class="${statusCls}">${escapeHtml(statusLabel)}</td>
      </tr>`;
    })
    .join('');

  graphragRankingTable.innerHTML = `<table class="erp-table">
    <thead><tr><th>Candidate</th><th class="num">Phy / PPR</th><th class="num">Phy Flux</th><th class="num">λ_e</th><th class="num">PPR</th><th>Status</th></tr></thead>
    <tbody>${rankRows}</tbody>
  </table>`;

  const activeCitRows = evalRes.citations
    .slice(0, 14)
    .map(
      (cit) => `<tr>
        <td>${escapeHtml(cit.fromLabel)} ↔ ${escapeHtml(cit.toLabel)}</td>
        <td>${escapeHtml(cit.relation)}</td>
        <td class="erp-tag-sku">${escapeHtml(cit.evidenceRef)}</td>
        <td class="num">${cit.flow.toFixed(3)}</td>
        <td class="erp-tag-ok">ACTIVE</td>
      </tr>`,
    )
    .join('');

  const auditRows = evalRes.auditEdges
    .map((a) => {
      const cls = a.reason === 'scope-blocked' ? 'erp-tag-sku' : 'erp-tag-late';
      const label =
        a.reason === 'scope-blocked'
          ? 'T04 BLOCKED'
          : a.reason === 'expired'
            ? 'EXPIRED'
            : 'REVOKED';
      return `<tr>
        <td>${escapeHtml(a.fromLabel)} ↔ ${escapeHtml(a.toLabel)}</td>
        <td>${escapeHtml(a.relation)}</td>
        <td class="erp-tag-sku">${escapeHtml(a.evidenceRef)}</td>
        <td class="num">0.000</td>
        <td class="${cls}">${label}</td>
      </tr>`;
    })
    .join('');

  graphragEvidenceTable.innerHTML = `<table class="erp-table">
    <thead><tr><th>Link</th><th>Relation</th><th>Anchor</th><th class="num">|Q|</th><th>State</th></tr></thead>
    <tbody>${auditRows}${activeCitRows}</tbody>
  </table>`;
}

function populateSystemsRailSelect(): void {
  if (!activeSystemsSpec) {
    sysRailSelect.replaceChildren();
    return;
  }
  const prev = sysRailSelect.value;
  sysRailSelect.replaceChildren(
    ...activeSystemsSpec.rails.map((r) => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.label;
      return opt;
    }),
  );
  if (prev && activeSystemsSpec.rails.some((r) => r.id === prev)) {
    sysRailSelect.value = prev;
  } else if (activeSystemsSpec.rails[0]) {
    sysRailSelect.value = activeSystemsSpec.rails[0].id;
  }
}

function syncSystemsConditionControls(): void {
  if (!activeSystemsSpec || !systemsConditions) return;
  sysLoadInput.value = systemsConditions.trafficMultiplier.toFixed(2);
  sysLoadValue.value = `${systemsConditions.trafficMultiplier.toFixed(2)}×`;

  const selectedRailId = sysRailSelect.value || activeSystemsSpec.rails[0]?.id;
  if (!selectedRailId) return;
  const cond = systemsConditions.rails[selectedRailId] ?? {
    capScale: 1,
    extraCost: 0,
    offline: false,
  };
  sysRailCapInput.value = cond.capScale.toFixed(2);
  sysRailCapValue.value = `${Math.round(cond.capScale * 100)}%`;
  sysRailCostInput.value = cond.extraCost.toFixed(1);
  sysRailCostValue.value = `+${cond.extraCost.toFixed(1)}×`;
  sysRailCutBtn.textContent = cond.offline ? 'Restore Rail' : 'Kill Rail (Cut)';
  sysRailCutBtn.setAttribute('aria-pressed', String(cond.offline));
}

function renderSystemsTable(): void {
  if (!lastSystemsEval || domain !== 'systems') {
    lastRenderedSystemsSig = '';
    return;
  }
  const ev = lastSystemsEval;
  const sig = `${activePresetId}:${iteration}:${ev.totalDemand.toFixed(1)}:${ev.rails.map((r) => `${r.id}:${r.sharePct.toFixed(1)}:${r.shadowPriceLambda.toFixed(2)}:${r.status}:${r.capUnits.toFixed(0)}:${r.effectiveUnitCost.toFixed(2)}`).join(',')}`;
  if (sig === lastRenderedSystemsSig) return;
  lastRenderedSystemsSig = sig;

  systemsStatusBadge.textContent =
    ev.physarum.dropPct <= 0.1
      ? `0% Drops · Max λ=${ev.physarum.maxLambda.toFixed(2)}`
      : `${ev.physarum.dropPct.toFixed(1)}% Overload`;
  systemsStatusBadge.className = `fjsp-badge ${ev.physarum.dropPct <= 1 ? 'is-valid' : 'is-invalid'}`;

  if (ev.dropReductionPct > 0.2) {
    systemsBaselineBadge.textContent = `-${ev.dropReductionPct.toFixed(1)}% drops vs Static`;
    systemsBaselineBadge.className = 'fjsp-badge is-valid';
  } else {
    const unit = ev.costUnit;
    const dec = unit === '%' ? 2 : 1;
    systemsBaselineBadge.textContent = `Static ${ev.staticBaseline.avgCost.toFixed(dec)}${unit} · ${ev.staticBaseline.dropPct.toFixed(1)}% drop`;
    systemsBaselineBadge.className = 'fjsp-badge is-valid';
  }

  const unit = ev.throughputUnit;
  const costDec = ev.costUnit === '%' ? 2 : 1;
  const rows = ev.rails
    .map((r) => {
      const cls =
        r.status === 'OFFLINE' || r.status === 'SATURATED'
          ? 'erp-tag-late'
          : r.status === 'SPILLING'
            ? 'erp-tag-sku'
            : 'erp-tag-ok';
      return `<tr>
        <td><strong>${escapeHtml(r.label)}</strong>${r.isPrimaryTier ? '' : ' <small>(bottleneck)</small>'}</td>
        <td class="num">${Math.round(r.loadUnits)} / ${Math.round(r.capUnits)} ${escapeHtml(unit)}</td>
        <td class="num">${r.sharePct.toFixed(0)}%</td>
        <td class="num">${r.effectiveUnitCost.toFixed(costDec)}${escapeHtml(ev.costUnit)}</td>
        <td class="num">${r.shadowPriceLambda.toFixed(2)}</td>
        <td class="${cls}">${r.status}</td>
      </tr>`;
    })
    .join('');

  systemsTable.innerHTML = `<table class="erp-table">
    <thead><tr><th>Rail / Backend</th><th class="num">Load / Cap</th><th class="num">Share</th><th class="num">${escapeHtml(ev.costMetricLabel)}</th><th class="num">λ<sub>e</sub></th><th>State</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function applyAndRefreshSystems(stepsToSettle = 24): void {
  if (domain !== 'systems' || !activeSystemsSpec || !systemsConditions) return;
  applySystemsConditions(graph, activeSystemsSpec, systemsConditions);
  syncActiveCapacitiesFromGraph();
  syncSystemsConditionControls();
  invalidateExactCache();
  lastRenderedSystemsSig = '';
  if (stepsToSettle > 0) {
    runSteps(stepsToSettle);
  } else {
    recordNetworkSnapshot();
  }
  draw();
  updateStats(fpsAverage);
}

function updateStats(fps: number): void {
  const activeThreshold = domain === 'vascular' ? 0.005 : 0.05;
  const activeEdges = graph.edges.filter((edge) => !edge.severed && edge.D >= activeThreshold).length;
  const sources = graph.nodes.filter((node) => node.flow > 0).length;
  const sinks = graph.nodes.filter((node) => node.flow < 0).length;
  const status = statusLabel();
  statusText.textContent = status;
  statusText.dataset.state = status.toLowerCase().replace(/ /g, '-');

  if (domain === 'vascular') {
    metricTl.textContent =
      lastVascularMetrics.bifurcationCount > 0
        ? `${lastVascularMetrics.murrayRatio.toFixed(2)} (${Math.round(lastVascularMetrics.murrayCompliancePct)}%)`
        : '—';
    metricMd.textContent = `${lastVascularMetrics.hydraulicPower.toFixed(1)} · ΔP ${lastVascularMetrics.pressureDrop.toFixed(1)}`;
    metricFt.textContent = `${lastVascularMetrics.shearUniformityCv.toFixed(2)} · ${lastVascularMetrics.fluidVolumeMm3.toFixed(1)} mm³`;
    metricPcg.textContent = `${lastVascularMetrics.activeChannels} ch · ${lastVascularMetrics.minActiveRadiusMm.toFixed(2)}–${maxRadiusMm.toFixed(2)} mm`;
  } else if (domain === 'optimization') {
    metricTl.textContent = lastOptMetrics.feasible
      ? `${lastOptMetrics.primalFlowCost.toFixed(1)} / ${lastOptMetrics.exactOptCost.toFixed(1)} (${lastOptMetrics.optimalityGapPct.toFixed(1)}%)`
      : 'Infeasible';
    metricMd.textContent = `${lastOptMetrics.lyapunovEnergy.toFixed(2)}`;
    metricFt.textContent = `${lastOptMetrics.maxCapacityViolation.toFixed(3)} · ${Math.round(lastOptMetrics.sparsityPct)}%`;
    metricPcg.textContent = `${lastOptMetrics.effectiveResistance.toFixed(1)} Ω · ${formatDynamicRange(lastOptMetrics.conductanceDynamicRange)}`;
    crossbarMeta.textContent = `Active memristors: ${lastOptMetrics.activeMemristors}/${lastOptMetrics.totalMemristors} · Sparsity ${Math.round(lastOptMetrics.sparsityPct)}% · DR ${formatDynamicRange(lastOptMetrics.conductanceDynamicRange)}`;
  } else if (domain === 'fjsp' && lastFjspComparison) {
    const cmp = lastFjspComparison;
    const two = cmp.twoLevel;
    const gr = cmp.greedyBaseline;
    const isMultiPo = two.totalPos >= 20;

    if (lastErpComparison) {
      const erpTwo = lastErpComparison.twoLevel;
      metric1Label.textContent = 'Makespan (560m/d)';
      metric2Label.textContent = 'SO On-Time · CCC';
      metric3Label.textContent = 'Min Cash · End Cash';
      metric4Label.textContent = 'MRP · Shift · Verify';
      metricTl.textContent =
        two.feasible && gr.feasible
          ? `${(two.makespanMin / SHIFT_MIN_PER_DAY).toFixed(1)}d vs ${(gr.makespanMin / SHIFT_MIN_PER_DAY).toFixed(1)}d (${cmp.makespanDeltaMin >= 0 ? '-' : '+'}${Math.abs(cmp.makespanDeltaMin)}m)`
          : two.feasible
            ? `${(two.makespanMin / SHIFT_MIN_PER_DAY).toFixed(1)}d (${two.makespanMin}m)`
            : 'Infeasible';
      metricMd.textContent = erpTwo.feasible
        ? `${erpTwo.onTimeSos}/${erpTwo.totalSos} SOs · ${erpTwo.cashFlow.avgCashConversionDays.toFixed(1)}d CCC`
        : '—';
      metricFt.textContent = erpTwo.feasible
        ? `$${Math.round(erpTwo.cashFlow.minCashUsd / 1000)}k · $${Math.round(erpTwo.cashFlow.endingCashUsd / 1000)}k`
        : '—';
      metricPcg.textContent = erpTwo.feasible
        ? `${erpTwo.materialStockouts + erpTwo.sgStockouts} stockout · ${two.verification.shiftViolations} shift viol.`
        : `${cmp.offlineCells.length} off · Infeasible`;
      renderErpTables();
    } else {
      metric1Label.textContent = 'Makespan (2-Lvl vs Greedy)';
      metric3Label.textContent = 'Upper Bottleneck (λ_e)';
      metricTl.textContent =
        two.feasible && gr.feasible
          ? `${two.makespanMin}m vs ${gr.makespanMin}m (${cmp.makespanDeltaMin >= 0 ? '-' : '+'}${Math.abs(cmp.makespanDeltaMin)}m)`
          : two.feasible
            ? `${two.makespanMin}m`
            : 'Infeasible';
      if (isMultiPo) {
        metric2Label.textContent = 'On-Time · Tardiness';
        metric4Label.textContent = 'Offline · BOM/Hard Check';
        metricMd.textContent = two.feasible
          ? `${two.onTimePos}/${two.totalPos} POs · ${two.totalTardinessMin}m (${cmp.tardinessSavedMin >= 0 ? '-' : '+'}${Math.abs(cmp.tardinessSavedMin)}m)`
          : '—';
        metricPcg.textContent = `${cmp.offlineCells.length} off · ${two.verification.valid ? '0 conflicts' : 'Infeasible'}`;
      } else {
        metric2Label.textContent = 'Setup · LB Gap';
        metric4Label.textContent = 'Offline Cells · Verified';
        const lbGap =
          cmp.lowerBoundMin > 0 && two.feasible
            ? ((two.makespanMin - cmp.lowerBoundMin) / cmp.lowerBoundMin) * 100
            : 0;
        metricMd.textContent = two.feasible ? `${two.totalSetupMin}m · +${lbGap.toFixed(1)}% vs LB` : '—';
        metricPcg.textContent = `${cmp.offlineCells.length} offline · ${two.verification.valid ? '0 conflicts' : 'Infeasible'}`;
      }
      const bnSig = cmp.upperSignals[cmp.bottleneckCellId];
      metricFt.textContent = bnSig
        ? `${cmp.bottleneckCellId} (λ=${bnSig.shadowPriceLambda.toFixed(2)})`
        : '—';
    }

    fjspVerifyBadge.textContent = two.verification.valid
      ? fjspShiftCapEnabled
        ? `Verified (${two.ops.length} ops · 0 shift viol.)`
        : `Verified (${two.ops.length} ops · 0 overlaps)`
      : 'Infeasible';
    fjspVerifyBadge.className = two.verification.valid
      ? 'fjsp-badge is-valid'
      : 'fjsp-badge is-invalid';
  } else if (domain === 'graphrag' && lastGraphRagEval) {
    const evalRes = lastGraphRagEval;
    const topSharePct = ((evalRes.candidates[0]?.physarumShare ?? 0) * 100).toFixed(0);
    metricTl.textContent =
      evalRes.verdict === 'ready'
        ? `${evalRes.topCandidateLabel ?? 'Ready'} (${topSharePct}%)`
        : `Needs review (${evalRes.missingRequirementLabels.length} gap)`;
    const topPpr = evalRes.candidates.find((c) => c.pprRank === 1);
    metricMd.textContent = topPpr
      ? `${topPpr.label} (${evalRes.pprHubTrapDetected ? 'Hub Trap!' : `${(topPpr.pprShare * 100).toFixed(0)}%`})`
      : '—';
    const hubCand = evalRes.candidates.find((c) => c.role === 'hub');
    const maxLam = hubCand
      ? hubCand.maxShadowPrice
      : Math.max(0, ...evalRes.candidates.map((c) => c.maxShadowPrice));
    metricFt.textContent = `λ=${maxLam.toFixed(2)} · ${evalRes.severedEdgesCount} cut`;
    metricPcg.textContent = `${Math.round(evalRes.noisePrunedPct)}% pruned · ${evalRes.hiddenPrivateEdges} T04`;
    renderGraphRagTables();
  } else if (domain === 'systems' && lastSystemsEval) {
    const ev = lastSystemsEval;
    const dec = ev.costUnit === '%' ? 2 : 1;
    metricTl.textContent = `${ev.physarum.avgCost.toFixed(dec)}${ev.costUnit} vs ${ev.staticBaseline.avgCost.toFixed(dec)}${ev.costUnit}`;
    metricMd.textContent = `${ev.physarum.dropPct.toFixed(1)}% vs ${ev.staticBaseline.dropPct.toFixed(1)}%`;
    metricFt.textContent = `${ev.physarum.successPct.toFixed(1)}% · λ=${ev.physarum.maxLambda.toFixed(2)}`;
    metricPcg.textContent = `${Math.round(ev.totalDemand)} ${ev.throughputUnit} · ${ev.activeRails}/${ev.rails.length} up`;
    renderSystemsTable();
  } else {
    metricTl.textContent =
      lastNetworkMetrics.mstLength > 0 ? `${lastNetworkMetrics.tlRatio.toFixed(2)}×` : '—';
    metricMd.textContent =
      Number.isFinite(lastNetworkMetrics.mdRatio) && lastNetworkMetrics.mdRatio > 0
        ? `${lastNetworkMetrics.mdRatio.toFixed(2)}×`
        : lastNetworkMetrics.connected
          ? '1.00×'
          : 'Disconn.';
    metricFt.textContent = `${Math.round(lastNetworkMetrics.faultTolerance * 100)}%`;
    metricPcg.textContent = `${lastStepMetrics.iterations} it · ${lastStepMetrics.residual.toExponential(1)}`;
  }

  drawSparkline();
  updateEdgeInspector();

  const deltaInfo = iteration > 0 ? ` · ΔD ${lastStepMetrics.maxChange.toExponential(1)}` : '';
  stats.textContent = `${graph.nodes.length} nodes · ${activeEdges}/${graph.edges.length} visible paths · ${iteration.toLocaleString()} steps · ${fps.toFixed(0)} fps${deltaInfo}`;
  canvasSummary.textContent = `Network canvas (${domain}): ${graph.nodes.length} nodes, ${sources} sources, ${sinks} sinks, and ${activeEdges} visible paths. Simulation status: ${status}.`;
}

function draw(): void {
  let systemsRailLabels:
    | Record<
        string,
        { label: string; sharePct: number; status: 'HEALTHY' | 'SPILLING' | 'SATURATED' | 'OFFLINE' }
      >
    | undefined;
  if (domain === 'systems' && lastSystemsEval) {
    systemsRailLabels = {};
    for (const r of lastSystemsEval.rails) {
      systemsRailLabels[r.id] = {
        label: r.shortLabel,
        sharePct: r.sharePct,
        status: r.status,
      };
    }
  }

  render(ctx, graph, {
    domain,
    backgroundImage: mapImage,
    terrain,
    flowMode,
    showMst: showMstInput.checked,
    mstEdgeIndices: lastNetworkMetrics.mstEdgeIndices,
    showOptimalBaseline: showOptInput.checked,
    optimalEdgeIndices: lastOptMetrics.optimalEdgeIndices,
    showPressure: showPressureInput.checked,
    pressures: lastStepMetrics.pressures,
    showFlowParticles: showPressureInput.checked && !reducedMotion,
    phase: flowPhase,
    hoveredEdgeIndex,
    showLabels: showLabelsInput.checked,
    showShearHeatmap: showShearInput.checked,
    edgeShearNorm: lastVascularMetrics.edgeShearNorm,
    showCapacityBadges: showCapsInput.checked,
    graphRagViewerScope: domain === 'graphrag' ? graphRagViewerScope : undefined,
    systemsStageHeaders: domain === 'systems' ? activeSystemsSpec?.stageHeaders : undefined,
    systemsRailLabels,
  });
  if (domain === 'optimization' && crossbarContext) {
    renderCrossbarMatrix(crossbarContext, graph);
  }
  if (domain === 'systems' && sysChartContext && lastSystemsEval) {
    renderSystemsComparisonChart(sysChartContext, lastSystemsEval);
  }
  if (domain === 'fjsp' && ganttContext && lastFjspComparison) {
    const sol = showGreedyGantt ? lastFjspComparison.greedyBaseline : lastFjspComparison.twoLevel;
    const tag = showGreedyGantt ? 'Greedy ECT Baseline' : 'Two-Level Physarum + Active Decoder';
    const erpPlan = lastErpComparison
      ? showGreedyGantt
        ? lastErpComparison.greedyBaseline
        : lastErpComparison.twoLevel
      : null;
    const extraSummary =
      erpPlan && erpPlan.feasible
        ? ` · ${erpPlan.onTimeSos}/${erpPlan.totalSos} SOs`
        : '';
    renderGanttChart(
      ganttContext,
      sol,
      activeFjspCells,
      lastFjspComparison.offlineCells,
      lastFjspComparison.bottleneckCellId,
      tag,
      lastFjspComparison.lowerBoundMin,
      {
        shiftMinPerDay: fjspShiftCapEnabled ? SHIFT_MIN_PER_DAY : 0,
        extraSummary,
      },
    );
    if (cashflowContext && lastErpComparison) {
      renderCashFlowChart(cashflowContext, lastErpComparison);
    }
  }
}

function runSteps(count: number): void {
  if (!hasActiveTerminals(graph, flowMode)) return;
  for (let index = 0; index < count; index++) {
    lastStepMetrics = step(graph, mu, simulationDt, {
      flowMode,
      dynamicsMode,
      random: simRandom,
      prevPressures: lastStepMetrics.pressures,
      deterministicAllPairs: domain === 'graphrag',
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
  lastFjspSolveIter = -1;
  recomputeFjsp(true);
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
  activeCapacities = [];
  activeExplicitSpecs = [];
  activePresetId = '';
  activeErpScenario = null;
  lastFjspComparison = null;
  lastErpComparison = null;
  lastRenderedErpSignature = '';
  lastGraphRagEval = null;
  lastRenderedGraphRagSig = '';
  activeSystemsSpec = null;
  systemsConditions = null;
  lastSystemsEval = null;
  lastRenderedSystemsSig = '';
  graph = emptyGraph();
  clearTerrain(terrain);
  invalidateExactCache();
  presetSelect.value = '';
  resetMetricsAndSolve();
  draw();
  updateStats(fpsAverage);
}

function applyState(
  state: SharedState,
  options: {
    presetId?: string;
    terrainPolygons?: Array<Array<[number, number]>>;
  } = {},
): void {
  setRunning(false);
  mode = state.mode;
  mu = state.mu;
  simulationDt = state.dt;
  speed = state.speed;
  seed = normalizeSeed(state.seed);

  const resolvedPresetId =
    options.presetId ?? (state.version === 3 ? state.presetId : undefined) ?? '';
  activePresetId = resolvedPresetId;
  const matchedPreset = resolvedPresetId
    ? PRESETS.find((p) => p.id === resolvedPresetId)
    : undefined;
  let terrainPolygons = options.terrainPolygons;

  if (state.version === 3) {
    domain = state.domain;
    dynamicsMode = state.dynamicsMode;
    flowMode = state.flowMode;
    maxRadiusMm = state.maxRadiusMm ?? 1.5;
    activeExplicitSpecs = matchedPreset?.explicitEdges
      ? matchedPreset.explicitEdges.map((e) => ({ ...e }))
      : [];
    activeCapacities = state.capacities ? state.capacities.map((c) => ({ ...c })) : [];
    if (!terrainPolygons && matchedPreset?.terrainPolygons) {
      terrainPolygons = matchedPreset.terrainPolygons;
    }
    if (domain === 'fjsp') {
      if (resolvedPresetId === 'fjsp-jewelry-erp') {
        activeErpScenario = buildErpJewelryScenario();
        activeFjspJobs = activeErpScenario.jobs;
        activeFjspCells = getCellsForPreset(resolvedPresetId);
        fjspShiftCapEnabled = true;
      } else {
        activeErpScenario = null;
        activeFjspJobs = getJewelryJobsForPreset(resolvedPresetId || 'fjsp-jewelry-atelier');
        activeFjspCells = getCellsForPreset(resolvedPresetId);
        fjspShiftCapEnabled = false;
      }
      fjspShiftCapEnabled = state.fjspShiftCap ?? fjspShiftCapEnabled;
      baseFjspJobs = activeFjspJobs;
      // Use an existing finish from this preset when an unplated order opts in.
      platingTemplate = baseFjspJobs.flatMap(job => job.ops).find(op => op.stage === 'plate')!;
      applyPoEdits(state.poEdits ?? []);
      poEditor.setOrders(baseFjspJobs, activeFjspCells, platingTemplate, poEdits);
      ganttCanvas.height = activeFjspCells.length > 14 ? 380 : 320;
      fjspShiftCapInput.checked = fjspShiftCapEnabled;
    } else {
      activeErpScenario = null;
      lastErpComparison = null;
    }
    if (domain === 'systems') {
      activeSystemsSpec = getSystemsScenario(resolvedPresetId) ?? SYSTEMS_SCENARIOS[0];
      systemsConditions = createDefaultSystemsConditions(activeSystemsSpec);
      lastRenderedSystemsSig = '';
    } else {
      activeSystemsSpec = null;
      systemsConditions = null;
      lastSystemsEval = null;
      lastRenderedSystemsSig = '';
    }
    lastRenderedErpSignature = '';
  } else {
    domain = 'transport';
    dynamicsMode = 'tero';
    flowMode = state.version === 2 ? state.flowMode : 'source-sink';
    activeCapacities = [];
    activeExplicitSpecs = [];
    activeErpScenario = null;
    lastErpComparison = null;
    lastRenderedErpSignature = '';
    activeSystemsSpec = null;
    systemsConditions = null;
    lastSystemsEval = null;
    lastRenderedSystemsSig = '';
  }

  clearTerrain(terrain);
  if (terrainPolygons) {
    for (const poly of terrainPolygons) {
      paintTerrainPolygon(terrain, poly, 0.9);
    }
  }

  graph = buildGraph(state.nodes);
  if (domain === 'fjsp' && activeCapacities.length === 0) {
    syncActiveCapacitiesFromGraph();
  }
  if (domain === 'graphrag') {
    applyViewerScope(graph, graphRagViewerScope);
    graphragViewerSelect.value = graphRagViewerScope;
    lastRenderedGraphRagSig = '';
  }
  if (domain === 'systems') {
    populateSystemsRailSelect();
    syncSystemsConditionControls();
  }
  showLabelsInput.checked = state.nodes.some((n) => Boolean(n.label));
  showShearInput.checked = false;
  showOptInput.checked = domain === 'optimization';
  showCapsInput.checked =
    activeCapacities.length > 0 || domain === 'fjsp' || domain === 'graphrag' || domain === 'systems';
  if (domain === 'graphrag' || domain === 'systems') {
    showPressureInput.checked = true;
  }
  showGreedyGantt = false;
  fjspToggleViewBtn.textContent = 'Show Greedy Baseline';
  presetSelect.value = resolvedPresetId;
  resetMetricsAndSolve();
  updateControls();
  draw();
  updateStats(fpsAverage);
}

function loadPreset(id: string): void {
  const preset = getPreset(id);
  const presetDomain = preset.domain;
  const presetDynamics = preset.dynamicsMode ?? 'tero';
  const presetFlowMode: FlowMode = preset.flowMode ?? 'source-sink';
  const presetMu = preset.mu ?? (preset.id === 'city-ring' ? 0.85 : 1.2);
  const explicitCaps = preset.explicitEdges
    ?.filter((e) => e.capacity !== undefined)
    .map((e) => ({ i: e.i, j: e.j, capacity: e.capacity! }));
  const presetCapacities = preset.capacities ?? (explicitCaps?.length ? explicitCaps : undefined);

  const state: SharedState =
    presetDomain !== 'transport' ||
    presetDynamics !== 'tero' ||
    preset.mode === 'explicit' ||
    presetCapacities?.length
      ? {
          version: 3,
          domain: presetDomain,
          dynamicsMode: presetDynamics,
          nodes: preset.nodes,
          mode: preset.mode,
          flowMode: presetFlowMode,
          mu: presetMu,
          dt: 0.05,
          speed: 8,
          seed: preset.seed,
          presetId: preset.id,
          maxRadiusMm: preset.maxRadiusMm,
          capacities: presetCapacities,
        }
      : presetFlowMode === 'multi-terminal'
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
          };

  applyState(state, {
    presetId: preset.id,
    terrainPolygons: preset.terrainPolygons,
  });
  history.replaceState(null, '', location.pathname + location.search);
}

function setDomain(nextDomain: LabDomain): void {
  if (nextDomain === domain) return;
  const firstInDomain = PRESETS.find((p) => p.domain === nextDomain);
  if (firstInDomain) {
    loadPreset(firstInDomain.id);
    return;
  }
  domain = nextDomain;
  syncDomainUi();
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
}

function currentState(): SharedState {
  const baseNodes = graph.nodes.map((node) => {
    const out: Node = node.label
      ? { id: node.id, x: node.x, y: node.y, flow: node.flow, label: node.label }
      : { id: node.id, x: node.x, y: node.y, flow: node.flow };
    if (node.role) out.role = node.role;
    if (node.room) out.room = node.room;
    return out;
  });
  syncActiveCapacitiesFromGraph();
  if (
    domain !== 'transport' ||
    dynamicsMode !== 'tero' ||
    activeCapacities.length > 0
  ) {
    return {
      version: 3,
      domain,
      dynamicsMode,
      nodes: baseNodes,
      mode,
      flowMode,
      mu,
      dt: simulationDt,
      speed,
      seed,
      presetId: activePresetId || undefined,
      fjspShiftCap: domain === 'fjsp' ? fjspShiftCapEnabled : undefined,
      poEdits: domain === 'fjsp' && poEdits.length ? poEdits : undefined,
      maxRadiusMm,
      capacities: activeCapacities.length > 0 ? activeCapacities : undefined,
    };
  }
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

function downloadTextFile(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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
    'type,step_or_edge,tl_ratio,md_ratio,fault_tolerance,efficiency_score,murray_ratio,hydraulic_power,lyapunov_energy,opt_gap_pct,conductivity_D,flow_Q,length_px,cost_factor,capacity',
  ];
  for (const h of historySamples) {
    lines.push(
      `history,${h.step},${h.tlRatio.toFixed(4)},${Number.isFinite(h.mdRatio) ? h.mdRatio.toFixed(4) : 'Inf'},${h.faultTolerance.toFixed(4)},${h.efficiencyScore.toFixed(4)},${h.murrayRatio.toFixed(4)},${h.hydraulicPower.toFixed(4)},${h.lyapunovEnergy.toFixed(4)},${h.optimalityGapPct.toFixed(4)},,,,,`,
    );
  }
  const activeThreshold = domain === 'vascular' ? 0.005 : 0.05;
  for (const e of graph.edges) {
    if (e.severed || e.D < activeThreshold) continue;
    const capStr = e.capacity !== undefined ? e.capacity.toFixed(4) : '';
    lines.push(
      `edge,${e.i}-${e.j},,,,,,,,,${e.D.toFixed(4)},${Math.abs(e.flow).toFixed(4)},${e.length.toFixed(2)},${e.costFactor.toFixed(2)},${capStr}`,
    );
  }
  downloadTextFile(
    lines.join('\n'),
    'text/csv;charset=utf-8',
    `physarum-metrics-${seed}-${iteration}.csv`,
  );
}

function exportSvg(): void {
  const svg = exportVascularSvg(graph, terrain, { maxRadiusMm, seed, iteration });
  downloadTextFile(svg, 'image/svg+xml;charset=utf-8', `physarum-vascular-${seed}-${iteration}.svg`);
}

function exportScad(): void {
  const scad = exportVascularOpenScad(graph, { maxRadiusMm, seed, iteration });
  downloadTextFile(scad, 'text/plain;charset=utf-8', `physarum-vascular-${seed}-${iteration}.scad`);
}

function exportSpice(): void {
  const spice = exportSpiceNetlist(graph, lastStepMetrics.pressures, { seed, iteration });
  downloadTextFile(spice, 'text/plain;charset=utf-8', `physarum-crossbar-${seed}-${iteration}.cir`);
}

function exportCpsat(): void {
  recomputeFjsp(true);
  if (!lastFjspComparison) return;
  const py = exportFjspCpSatPython(graph, activeFjspJobs, lastFjspComparison, {
    seed,
    iteration,
    cells: activeFjspCells,
    shiftMinPerDay: fjspShiftCapEnabled ? SHIFT_MIN_PER_DAY : 0,
    salesOrders: activeErpScenario?.salesOrders.map((so) => ({
      id: so.id,
      dueMin: so.dueMin,
      priority: so.priority,
      fgPoIds: so.fgPoIds,
    })),
  });
  downloadTextFile(py, 'text/x-python;charset=utf-8', `physarum-jewelry-fjsp-${seed}-${iteration}.py`);
}

function exportSchedule(): void {
  recomputeFjsp(true);
  if (!lastFjspComparison) return;
  const payload = JSON.stringify(
    {
      presetId: activePresetId || 'custom-fjsp',
      domain,
      seed,
      iteration,
      shiftMinPerDay: fjspShiftCapEnabled ? SHIFT_MIN_PER_DAY : 0,
      jobs: activeFjspJobs,
      comparison: lastFjspComparison,
      erp: lastErpComparison,
    },
    null,
    2,
  );
  downloadTextFile(
    payload,
    'application/json;charset=utf-8',
    `physarum-jewelry-schedule-${seed}-${iteration}.json`,
  );
}

function exportGraphRag(): void {
  if (domain !== 'graphrag') return;
  applyViewerScope(graph, graphRagViewerScope);
  const evalRes = evaluateGraphRag(graph, graphRagViewerScope);
  const payload = exportGraphRagJson(graph, evalRes, {
    presetId: activePresetId || 'custom-graphrag',
    seed,
    iteration,
  });
  downloadTextFile(
    payload,
    'application/json;charset=utf-8',
    `physarum-graphrag-evidence-${seed}-${iteration}.json`,
  );
}

function exportSystems(): void {
  if (domain !== 'systems' || !activeSystemsSpec || !systemsConditions || !lastSystemsEval) return;
  const payload = exportSystemsJson(graph, activeSystemsSpec, systemsConditions, lastSystemsEval, {
    seed,
    iteration,
  });
  downloadTextFile(
    payload,
    'application/json;charset=utf-8',
    `physarum-${activeSystemsSpec.id}-${seed}-${iteration}.json`,
  );
}

function setActiveTool(tool: InteractionTool): void {
  activeTool = tool;
  for (const button of toolButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
  }
  if (tool === 'cap') {
    showCapsInput.checked = true;
    draw();
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
  invalidateExactCache();
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
}

const domainGroups: Array<{ domain: LabDomain; label: string }> = [
  { domain: 'transport', label: 'Transport Networks (Tero 2010)' },
  { domain: 'vascular', label: 'Vascular & Microfluidics' },
  { domain: 'optimization', label: 'Optimization & Analog LP' },
  { domain: 'fjsp', label: 'Factory FJSP · Two-Level' },
  { domain: 'graphrag', label: 'GraphRAG · Multi-Hop Evidence' },
  { domain: 'systems', label: 'Systems · Control-Plane' },
];
for (const groupSpec of domainGroups) {
  const optgroup = document.createElement('optgroup');
  optgroup.label = groupSpec.label;
  for (const preset of PRESETS.filter((p) => p.domain === groupSpec.domain)) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    optgroup.append(option);
  }
  presetSelect.append(optgroup);
}

for (const tab of domainTabs) {
  tab.addEventListener('click', () => {
    const next = tab.dataset.domain as LabDomain | undefined;
    if (next) setDomain(next);
  });
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

dynamicsModeSelect.addEventListener('change', () => {
  dynamicsMode = dynamicsModeSelect.value as DynamicsMode;
  if (domain !== 'graphrag' && domain !== 'systems') {
    if (dynamicsMode === 'murray') domain = 'vascular';
    else if (dynamicsMode === 'linear-lp' && domain !== 'fjsp') domain = 'optimization';
    else if (dynamicsMode === 'tero') domain = 'transport';
  }
  syncDomainUi();
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
      if (domain !== 'transport') loadPreset('direct-route');
      showPressureInput.checked = true;
      setRunning(true);
    } else if (demo === 'tokyo') {
      loadPreset('tokyo-rail');
      showMstInput.checked = true;
      showLabelsInput.checked = true;
      setRunning(true);
    } else if (demo === 'vascular-murray') {
      loadPreset('vascular-scaffold');
      showShearInput.checked = true;
      showLabelsInput.checked = true;
      setRunning(true);
    } else if (demo === 'soft-actuator-heal') {
      loadPreset('soft-actuator');
      runSteps(40);
      setActiveTool('cut');
      showLabelsInput.checked = true;
      setRunning(true);
    } else if (demo === 'opt-shortest') {
      loadPreset('opt-shortest-path');
      showOptInput.checked = true;
      showLabelsInput.checked = true;
      setRunning(true);
    } else if (demo === 'opt-mcf') {
      loadPreset('opt-mincost-flow');
      showOptInput.checked = true;
      showCapsInput.checked = true;
      showLabelsInput.checked = true;
      setRunning(true);
    } else if (demo === 'fjsp-atelier') {
      loadPreset('fjsp-jewelry-atelier');
      showCapsInput.checked = true;
      showPressureInput.checked = true;
      showLabelsInput.checked = true;
      setRunning(true);
    } else if (demo === 'fjsp-100po') {
      loadPreset('fjsp-jewelry-100po');
      runSteps(120);
      recomputeFjsp(true);
      showCapsInput.checked = true;
      showPressureInput.checked = true;
      showLabelsInput.checked = true;
      setRunning(true);
    } else if (demo === 'fjsp-300po' || demo === 'fjsp-300po-halo-spare') {
      loadPreset(demo === 'fjsp-300po-halo-spare' ? 'fjsp-jewelry-300po-halo-spare' : 'fjsp-jewelry-300po');
      runSteps(240);
      showLabelsInput.checked = true;
      element<HTMLFormElement>('po-route-form').closest('details')!.open = true;
    } else if (demo === 'fjsp-erp') {
      loadPreset('fjsp-jewelry-erp');
      runSteps(140);
      recomputeFjsp(true);
      showCapsInput.checked = true;
      showPressureInput.checked = true;
      showLabelsInput.checked = true;
      setRunning(true);
    } else if (demo === 'fjsp-disrupt') {
      loadPreset('fjsp-jewelry-atelier');
      runSteps(120);
      severEdgeNear(graph, 252.5, 145, 14);
      recomputeFjsp(true);
      setActiveTool('cut');
      showCapsInput.checked = true;
      showPressureInput.checked = true;
      showLabelsInput.checked = true;
      setRunning(true);
    } else if (demo === 'graphrag-sensors') {
      graphRagViewerScope = 'buyer';
      loadPreset('graphrag-tender-sensors');
      runSteps(140);
      setRunning(true);
    } else if (demo === 'graphrag-t02-cut') {
      graphRagViewerScope = 'buyer';
      loadPreset('graphrag-tender-sensors');
      const targetEdge = graph.edges.find((e) => e.relation === 'T02 Pack-of-10');
      if (targetEdge) {
        targetEdge.severed = true;
        targetEdge.D = 0;
        targetEdge.flow = 0;
        targetEdge.congestion = 0;
      }
      runSteps(160);
      setActiveTool('cut');
      setRunning(true);
    } else if (demo === 'sys-payment') {
      loadPreset('sys-payment');
      runSteps(140);
      setRunning(true);
    } else if (demo === 'sys-llm-surge') {
      loadPreset('sys-llm-gateway');
      if (systemsConditions) {
        systemsConditions.trafficMultiplier = 1.8;
        applySystemsConditions(graph, activeSystemsSpec!, systemsConditions);
        syncActiveCapacitiesFromGraph();
        syncSystemsConditionControls();
      }
      runSteps(160);
      setRunning(true);
    } else if (demo === 'sys-mesh-bp') {
      loadPreset('sys-service-mesh');
      if (systemsConditions) {
        systemsConditions.trafficMultiplier = 1.35;
        applySystemsConditions(graph, activeSystemsSpec!, systemsConditions);
        syncActiveCapacitiesFromGraph();
        syncSystemsConditionControls();
      }
      runSteps(160);
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
    invalidateExactCache();
    recordNetworkSnapshot();
    draw();
    updateStats(fpsAverage);
    return;
  }

  if (activeTool === 'cut') {
    const severed = severEdgeNear(graph, x, y, 14);
    if (severed !== null) {
      hoveredEdgeIndex = null;
      const cutEdge = graph.edges[severed];
      if (domain === 'systems' && cutEdge?.cellId && systemsConditions) {
        const cur = systemsConditions.rails[cutEdge.cellId];
        if (cur) {
          cur.offline = true;
          syncSystemsConditionControls();
        }
        lastRenderedSystemsSig = '';
      }
      invalidateExactCache();
      recomputeFjsp(true);
      recordNetworkSnapshot();
      draw();
      updateStats(fpsAverage);
    }
    return;
  }

  if (activeTool === 'cap') {
    const toggled = toggleEdgeCapacityNear(graph, x, y, 0.55, 14);
    if (toggled !== null) {
      const toggledEdge = graph.edges[toggled];
      if (mode === 'explicit') {
        const spec = activeExplicitSpecs.find(
          (s) =>
            (s.i === toggledEdge.i && s.j === toggledEdge.j) ||
            (s.i === toggledEdge.j && s.j === toggledEdge.i),
        );
        if (spec) spec.capacity = toggledEdge.capacity;
      }
      syncActiveCapacitiesFromGraph();
      invalidateExactCache();
      hoveredEdgeIndex = toggled;
      showCapsInput.checked = true;
      recomputeFjsp(true);
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
  applyCapacitiesToGraph(graph, activeCapacities);
  invalidateExactCache();
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
    invalidateExactCache();
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
    invalidateExactCache();
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
  if (domain === 'systems' && activeSystemsSpec && systemsConditions) {
    applySystemsConditions(graph, activeSystemsSpec, systemsConditions);
  }
  invalidateExactCache();
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
});

runBtn.addEventListener('click', () => setRunning(!running));
stepBtn.addEventListener('click', () => {
  setRunning(false);
  runSteps(speed);
  recomputeFjsp(true);
  draw();
  updateStats(fpsAverage);
});
restartBtn.addEventListener('click', restartGraph);
clearBtn.addEventListener('click', clearGraph);
shareBtn.addEventListener('click', () => void copyShareLink());
exportBtn.addEventListener('click', exportPng);
exportCsvBtn.addEventListener('click', exportCsv);
exportSvgBtn.addEventListener('click', exportSvg);
exportScadBtn.addEventListener('click', exportScad);
exportSpiceBtn.addEventListener('click', exportSpice);
exportCpsatBtn.addEventListener('click', exportCpsat);
exportScheduleBtn.addEventListener('click', exportSchedule);
exportGraphRagBtn.addEventListener('click', exportGraphRag);
exportSystemsBtn.addEventListener('click', exportSystems);

autoStopInput.addEventListener('change', () => {
  autoStopOnConverge = autoStopInput.checked;
});

sysLoadInput.addEventListener('input', () => {
  if (!systemsConditions) return;
  systemsConditions.trafficMultiplier = Number(sysLoadInput.value);
  applyAndRefreshSystems(28);
});

sysRailSelect.addEventListener('change', () => {
  syncSystemsConditionControls();
});

sysRailCapInput.addEventListener('input', () => {
  if (!systemsConditions) return;
  const railId = sysRailSelect.value;
  if (!railId || !systemsConditions.rails[railId]) return;
  systemsConditions.rails[railId].capScale = Number(sysRailCapInput.value);
  applyAndRefreshSystems(28);
});

sysRailCostInput.addEventListener('input', () => {
  if (!systemsConditions) return;
  const railId = sysRailSelect.value;
  if (!railId || !systemsConditions.rails[railId]) return;
  systemsConditions.rails[railId].extraCost = Number(sysRailCostInput.value);
  applyAndRefreshSystems(28);
});

sysRailCutBtn.addEventListener('click', () => {
  if (!systemsConditions) return;
  const railId = sysRailSelect.value;
  if (!railId || !systemsConditions.rails[railId]) return;
  systemsConditions.rails[railId].offline = !systemsConditions.rails[railId].offline;
  applyAndRefreshSystems(96);
});

sysPresetNormalBtn.addEventListener('click', () => {
  if (!activeSystemsSpec) return;
  systemsConditions = createDefaultSystemsConditions(activeSystemsSpec);
  applyAndRefreshSystems(96);
});

sysPresetSurgeBtn.addEventListener('click', () => {
  if (!systemsConditions) return;
  systemsConditions.trafficMultiplier = 1.8;
  applyAndRefreshSystems(140);
});

sysPresetOutageBtn.addEventListener('click', () => {
  if (!activeSystemsSpec || !systemsConditions) return;
  const primary = activeSystemsSpec.rails[0]?.id;
  if (!primary || !systemsConditions.rails[primary]) return;
  systemsConditions.rails[primary].offline = true;
  sysRailSelect.value = primary;
  applyAndRefreshSystems(140);
});

sysResetCondBtn.addEventListener('click', () => {
  if (!activeSystemsSpec) return;
  systemsConditions = createDefaultSystemsConditions(activeSystemsSpec);
  applyAndRefreshSystems(96);
});

graphragViewerSelect.addEventListener('change', () => {
  graphRagViewerScope = graphragViewerSelect.value as GraphRagViewerScope;
  applyViewerScope(graph, graphRagViewerScope);
  lastRenderedGraphRagSig = '';
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
});

graphragCutT02Btn.addEventListener('click', () => {
  const edge = graph.edges.find(
    (e) => !e.severed && (e.relation === 'T02 Pack-of-10' || e.relation === 'On-Site Install'),
  );
  if (!edge) return;
  edge.severed = true;
  edge.D = 0;
  edge.flow = 0;
  edge.congestion = 0;
  lastRenderedGraphRagSig = '';
  runSteps(120);
  draw();
  updateStats(fpsAverage);
});

graphragCutIsoBtn.addEventListener('click', () => {
  const edge = graph.edges.find(
    (e) => !e.severed && Boolean(e.evidenceRef?.startsWith('cert-siam-v2')),
  );
  if (!edge) return;
  edge.severed = true;
  edge.D = 0;
  edge.flow = 0;
  edge.congestion = 0;
  lastRenderedGraphRagSig = '';
  runSteps(120);
  draw();
  updateStats(fpsAverage);
});

graphragToggleHubCapBtn.addEventListener('click', () => {
  const hubEdges = graph.edges.filter(
    (e) =>
      graph.nodes[e.i]?.role === 'hub' ||
      graph.nodes[e.j]?.role === 'hub' ||
      e.relation === 'Reseller Catalog',
  );
  const bridgeEdges = hubEdges.filter(
    (e) => graph.nodes[e.i]?.role === 'query' || graph.nodes[e.j]?.role === 'query',
  );
  const targets = bridgeEdges.length > 0 ? bridgeEdges : hubEdges;
  const anyCapped = targets.some((e) => e.capacity !== undefined);
  for (const edge of targets) {
    if (anyCapped) {
      delete edge.capacity;
    } else {
      edge.capacity = 0.1;
    }
    edge.congestion = 0;
  }
  syncActiveCapacitiesFromGraph();
  lastRenderedGraphRagSig = '';
  runSteps(140);
  draw();
  updateStats(fpsAverage);
});

graphragResetBtn.addEventListener('click', () => {
  graphRagViewerScope = 'buyer';
  loadPreset(activePresetId || 'graphrag-tender-sensors');
});

fjspWeightInput.addEventListener('input', () => {
  fjspGuidanceWeight = Number(fjspWeightInput.value);
  fjspWeightValue.value = fjspGuidanceWeight.toFixed(2);
  recomputeFjsp(true);
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
});

fjspShiftCapInput.addEventListener('change', () => {
  fjspShiftCapEnabled = fjspShiftCapInput.checked;
  recomputeFjsp(true);
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
});

fjspToggleViewBtn.addEventListener('click', () => {
  showGreedyGantt = !showGreedyGantt;
  updatePoAssignments();
  fjspToggleViewBtn.textContent = showGreedyGantt
    ? 'Show Two-Level Physarum'
    : 'Show Greedy Baseline';
  renderErpTables();
  draw();
});

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
maxRadiusInput.addEventListener('input', () => {
  maxRadiusMm = Number(maxRadiusInput.value);
  maxRadiusValue.value = maxRadiusMm.toFixed(2);
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
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
showShearInput.addEventListener('change', () => {
  draw();
});
showOptInput.addEventListener('change', () => {
  recordNetworkSnapshot();
  draw();
  updateStats(fpsAverage);
});
showCapsInput.addEventListener('change', () => {
  draw();
});
mapObstacleInput.addEventListener('change', () => {
  if (mapObstacleInput.checked) {
    applyMapImageAsObstacle();
  } else {
    clearTerrain(terrain);
    applyTerrainToGraph(graph, terrain);
    invalidateExactCache();
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
    if (autoStopOnConverge && iteration >= 40 && lastStepMetrics.maxChange < 5e-5) {
      setRunning(false);
    }
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
