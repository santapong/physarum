import type { ExplicitEdgeSpec, Graph, Node } from './graph';

export type SystemsRailStatus = 'HEALTHY' | 'SPILLING' | 'SATURATED' | 'OFFLINE';

export interface SystemsRailSpec {
  id: string;
  label: string;
  shortLabel: string;
  edgeFrom: number;
  edgeTo: number;
  baseCapacity: number;
  baseCostFactor: number;
  baseUnitCost: number;
  baseSuccessRate: number;
  staticShare: number;
  isPrimaryTier: boolean;
}

export interface SystemsScenarioSpec {
  id: string;
  name: string;
  shortTitle: string;
  description: string;
  baseThroughput: number;
  throughputUnit: string;
  costMetricLabel: string;
  costUnit: string;
  successMetricLabel: string;
  primaryFailoverRailId: string;
  stageHeaders: Array<{ label: string; x: number }>;
  nodes: Node[];
  explicitEdges: ExplicitEdgeSpec[];
  rails: SystemsRailSpec[];
}

export interface RailConditionOverride {
  capScale: number;
  extraCost: number;
  offline: boolean;
}

export interface SystemsConditions {
  trafficMultiplier: number;
  rails: Record<string, RailConditionOverride>;
}

export interface SystemsRailMetrics {
  id: string;
  label: string;
  shortLabel: string;
  sharePct: number;
  loadUnits: number;
  capUnits: number;
  utilizationPct: number;
  effectiveUnitCost: number;
  shadowPriceLambda: number;
  overloadUnits: number;
  status: SystemsRailStatus;
  isPrimaryTier: boolean;
  offline: boolean;
}

export interface SystemsEvaluation {
  scenarioId: string;
  totalDemand: number;
  throughputUnit: string;
  costMetricLabel: string;
  costUnit: string;
  successMetricLabel: string;
  rails: SystemsRailMetrics[];
  physarum: {
    avgCost: number;
    dropPct: number;
    successPct: number;
    maxLambda: number;
    totalOverloadUnits: number;
  };
  staticBaseline: {
    avgCost: number;
    dropPct: number;
    successPct: number;
    totalOverloadUnits: number;
  };
  dropReductionPct: number;
  costDelta: number;
  activeRails: number;
  offlineRails: number;
}

const n = (id: number, x: number, y: number, flow: number, label: string): Node => ({
  id,
  x,
  y,
  flow,
  label,
});

const RAIL_STAGE = 'rail';

export const SYSTEMS_SCENARIOS: SystemsScenarioSpec[] = [
  {
    id: 'sys-payment',
    name: 'Smart Payment Orchestration · FinTech',
    shortTitle: 'Payment Orchestrator',
    description:
      'Checkout → PromptPay / Omise / 2C2P / Stripe → Settlement: routes around bank maintenance & declines while minimizing MDR% under TPS bank limits.',
    baseThroughput: 1000,
    throughputUnit: 'TPS',
    costMetricLabel: 'Eff. MDR',
    costUnit: '%',
    successMetricLabel: 'Approval',
    primaryFailoverRailId: 'omise',
    stageHeaders: [
      { label: 'CHECKOUT', x: 95 },
      { label: 'PAYMENT RAILS / BANKS', x: 450 },
      { label: 'SETTLEMENT', x: 805 },
    ],
    nodes: [
      n(0, 95, 300, 1, 'Checkout API'),
      n(1, 330, 240, 0, 'PromptPay GW'),
      n(2, 570, 240, 0, 'PromptPay Settle'),
      n(3, 330, 360, 0, 'Omise Gateway'),
      n(4, 570, 360, 0, 'Omise Acquirer'),
      n(5, 330, 120, 0, '2C2P Bank API'),
      n(6, 570, 120, 0, '2C2P Clearing'),
      n(7, 330, 480, 0, 'Stripe Card GW'),
      n(8, 570, 480, 0, 'Stripe Global'),
      n(9, 805, 300, -1, 'Merchant Bank'),
    ],
    rails: [
      {
        id: 'promptpay',
        label: 'PromptPay Direct',
        shortLabel: 'PromptPay',
        edgeFrom: 1,
        edgeTo: 2,
        baseCapacity: 0.52,
        baseCostFactor: 1.0,
        baseUnitCost: 0.35,
        baseSuccessRate: 0.992,
        staticShare: 0.72,
        isPrimaryTier: true,
      },
      {
        id: 'omise',
        label: 'Omise Cards TH',
        shortLabel: 'Omise',
        edgeFrom: 3,
        edgeTo: 4,
        baseCapacity: 0.5,
        baseCostFactor: 1.18,
        baseUnitCost: 1.65,
        baseSuccessRate: 0.978,
        staticShare: 0.15,
        isPrimaryTier: true,
      },
      {
        id: 'bank-2c2p',
        label: '2C2P Bank Rail',
        shortLabel: '2C2P',
        edgeFrom: 5,
        edgeTo: 6,
        baseCapacity: 0.45,
        baseCostFactor: 1.32,
        baseUnitCost: 1.95,
        baseSuccessRate: 0.968,
        staticShare: 0.08,
        isPrimaryTier: true,
      },
      {
        id: 'stripe',
        label: 'Stripe Global',
        shortLabel: 'Stripe',
        edgeFrom: 7,
        edgeTo: 8,
        baseCapacity: 0.68,
        baseCostFactor: 1.48,
        baseUnitCost: 2.85,
        baseSuccessRate: 0.988,
        staticShare: 0.05,
        isPrimaryTier: true,
      },
    ],
    explicitEdges: [
      { i: 0, j: 1, costFactor: 1.0 },
      { i: 0, j: 3, costFactor: 1.03 },
      { i: 0, j: 5, costFactor: 1.06 },
      { i: 0, j: 7, costFactor: 1.08 },
      { i: 1, j: 2, costFactor: 1.0, capacity: 0.52, cellId: 'promptpay', stage: RAIL_STAGE },
      { i: 3, j: 4, costFactor: 1.18, capacity: 0.5, cellId: 'omise', stage: RAIL_STAGE },
      { i: 5, j: 6, costFactor: 1.32, capacity: 0.45, cellId: 'bank-2c2p', stage: RAIL_STAGE },
      { i: 7, j: 8, costFactor: 1.48, capacity: 0.68, cellId: 'stripe', stage: RAIL_STAGE },
      { i: 2, j: 9, costFactor: 1.0 },
      { i: 4, j: 9, costFactor: 1.03 },
      { i: 6, j: 9, costFactor: 1.06 },
      { i: 8, j: 9, costFactor: 1.08 },
    ],
  },
  {
    id: 'sys-llm-gateway',
    name: 'Multi-Region LLM / GPU Gateway',
    shortTitle: 'LLM GPU Gateway',
    description:
      'Users → Edge PoPs → Regional GPU Clusters (SG / JP / US): spills token bursts around KV-cache & TPM ceilings instead of static Geo-DNS overload.',
    baseThroughput: 1000,
    throughputUnit: 'req/s',
    costMetricLabel: 'Avg Latency',
    costUnit: 'ms',
    successMetricLabel: 'SLO Pass',
    primaryFailoverRailId: 'gpu-jp',
    stageHeaders: [
      { label: 'USERS', x: 85 },
      { label: 'EDGE PoPs', x: 265 },
      { label: 'GPU CLUSTERS (KV/TPM)', x: 545 },
      { label: 'RESPONSE', x: 825 },
    ],
    nodes: [
      n(0, 85, 200, 0.65, 'Users APAC'),
      n(1, 85, 400, 0.35, 'Users EU/US'),
      n(2, 265, 200, 0, 'Edge PoP SG'),
      n(3, 265, 400, 0, 'Edge PoP FRA'),
      n(4, 435, 145, 0, 'SG Queue'),
      n(5, 655, 145, 0, 'SG Tokens'),
      n(6, 435, 300, 0, 'JP Queue'),
      n(7, 655, 300, 0, 'JP Tokens'),
      n(8, 435, 455, 0, 'US Queue'),
      n(9, 655, 455, 0, 'US Tokens'),
      n(10, 825, 300, -1, 'LLM Stream'),
    ],
    rails: [
      {
        id: 'gpu-sg',
        label: 'GPU-SG H100',
        shortLabel: 'GPU-SG',
        edgeFrom: 4,
        edgeTo: 5,
        baseCapacity: 0.52,
        baseCostFactor: 1.0,
        baseUnitCost: 28,
        baseSuccessRate: 0.995,
        staticShare: 0.7,
        isPrimaryTier: true,
      },
      {
        id: 'gpu-jp',
        label: 'GPU-JP A100',
        shortLabel: 'GPU-JP',
        edgeFrom: 6,
        edgeTo: 7,
        baseCapacity: 0.54,
        baseCostFactor: 1.22,
        baseUnitCost: 62,
        baseSuccessRate: 0.992,
        staticShare: 0.2,
        isPrimaryTier: true,
      },
      {
        id: 'gpu-us',
        label: 'GPU-US H200',
        shortLabel: 'GPU-US',
        edgeFrom: 8,
        edgeTo: 9,
        baseCapacity: 0.98,
        baseCostFactor: 1.48,
        baseUnitCost: 145,
        baseSuccessRate: 0.99,
        staticShare: 0.1,
        isPrimaryTier: true,
      },
    ],
    explicitEdges: [
      { i: 0, j: 2, costFactor: 1.0 },
      { i: 0, j: 3, costFactor: 1.45 },
      { i: 1, j: 3, costFactor: 1.0 },
      { i: 1, j: 2, costFactor: 1.35 },
      { i: 2, j: 4, costFactor: 1.0 },
      { i: 2, j: 6, costFactor: 1.15 },
      { i: 2, j: 8, costFactor: 1.3 },
      { i: 3, j: 4, costFactor: 1.25 },
      { i: 3, j: 6, costFactor: 1.12 },
      { i: 3, j: 8, costFactor: 1.08 },
      { i: 4, j: 5, costFactor: 1.0, capacity: 0.52, cellId: 'gpu-sg', stage: RAIL_STAGE },
      { i: 6, j: 7, costFactor: 1.22, capacity: 0.54, cellId: 'gpu-jp', stage: RAIL_STAGE },
      { i: 8, j: 9, costFactor: 1.48, capacity: 0.98, cellId: 'gpu-us', stage: RAIL_STAGE },
      { i: 5, j: 10, costFactor: 1.0 },
      { i: 7, j: 10, costFactor: 1.04 },
      { i: 9, j: 10, costFactor: 1.08 },
    ],
  },
  {
    id: 'sys-etl-pool',
    name: 'Distributed ETL · OCR & Embedding Pool',
    shortTitle: 'ETL Worker Pool',
    description:
      'Producers → Kafka Ingest → CPU/GPU/Spot/On-Prem Worker Pools → Lakehouse: balances document pipelines by sink lag & prevents buffer OOM.',
    baseThroughput: 1000,
    throughputUnit: 'docs/m',
    costMetricLabel: 'Queue Lag',
    costUnit: 'ms',
    successMetricLabel: 'No-OOM',
    primaryFailoverRailId: 'spot-ocr',
    stageHeaders: [
      { label: 'PRODUCERS', x: 90 },
      { label: 'INGEST', x: 240 },
      { label: 'OCR / EMBED POOLS', x: 515 },
      { label: 'LAKEHOUSE', x: 815 },
    ],
    nodes: [
      n(0, 90, 200, 0.6, 'Tender PDFs'),
      n(1, 90, 400, 0.4, 'Event Stream'),
      n(2, 240, 300, 0, 'Kafka Ingest'),
      n(3, 395, 240, 0, 'Embed Q'),
      n(4, 635, 240, 0, 'Embed Out'),
      n(5, 395, 360, 0, 'Spot OCR Q'),
      n(6, 635, 360, 0, 'Spot Out'),
      n(7, 395, 120, 0, 'OnPrem Q'),
      n(8, 635, 120, 0, 'OnPrem Out'),
      n(9, 395, 480, 0, 'CPU OCR Q'),
      n(10, 635, 480, 0, 'CPU Out'),
      n(11, 815, 300, -1, 'Vector/SQL Sink'),
    ],
    rails: [
      {
        id: 'gpu-embed',
        label: 'GPU Embed Pool',
        shortLabel: 'GPU-Embed',
        edgeFrom: 3,
        edgeTo: 4,
        baseCapacity: 0.52,
        baseCostFactor: 1.0,
        baseUnitCost: 18,
        baseSuccessRate: 0.994,
        staticShare: 0.72,
        isPrimaryTier: true,
      },
      {
        id: 'spot-ocr',
        label: 'Spot GPU OCR',
        shortLabel: 'Spot-GPU',
        edgeFrom: 5,
        edgeTo: 6,
        baseCapacity: 0.5,
        baseCostFactor: 1.18,
        baseUnitCost: 34,
        baseSuccessRate: 0.985,
        staticShare: 0.14,
        isPrimaryTier: true,
      },
      {
        id: 'onprem-gpu',
        label: 'On-Prem Worker',
        shortLabel: 'On-Prem',
        edgeFrom: 7,
        edgeTo: 8,
        baseCapacity: 0.45,
        baseCostFactor: 1.32,
        baseUnitCost: 52,
        baseSuccessRate: 0.99,
        staticShare: 0.08,
        isPrimaryTier: true,
      },
      {
        id: 'cpu-fallback',
        label: 'CPU OCR Pool',
        shortLabel: 'CPU-Pool',
        edgeFrom: 9,
        edgeTo: 10,
        baseCapacity: 0.68,
        baseCostFactor: 1.48,
        baseUnitCost: 115,
        baseSuccessRate: 0.975,
        staticShare: 0.06,
        isPrimaryTier: true,
      },
    ],
    explicitEdges: [
      { i: 0, j: 2, costFactor: 1.0 },
      { i: 1, j: 2, costFactor: 1.03 },
      { i: 2, j: 3, costFactor: 1.0 },
      { i: 2, j: 5, costFactor: 1.03 },
      { i: 2, j: 7, costFactor: 1.06 },
      { i: 2, j: 9, costFactor: 1.08 },
      { i: 3, j: 4, costFactor: 1.0, capacity: 0.52, cellId: 'gpu-embed', stage: RAIL_STAGE },
      { i: 5, j: 6, costFactor: 1.18, capacity: 0.5, cellId: 'spot-ocr', stage: RAIL_STAGE },
      { i: 7, j: 8, costFactor: 1.32, capacity: 0.45, cellId: 'onprem-gpu', stage: RAIL_STAGE },
      { i: 9, j: 10, costFactor: 1.48, capacity: 0.68, cellId: 'cpu-fallback', stage: RAIL_STAGE },
      { i: 4, j: 11, costFactor: 1.0 },
      { i: 6, j: 11, costFactor: 1.03 },
      { i: 8, j: 11, costFactor: 1.06 },
      { i: 10, j: 11, costFactor: 1.08 },
    ],
  },
  {
    id: 'sys-edge-cloud',
    name: 'Hybrid Edge–Fog–Cloud Offloading',
    shortTitle: 'Edge-Fog-Cloud',
    description:
      'Camera / Robot / IoT → Local NPU / Raspberry Pi 5 / Cloud GPU: balances RAM, thermal & WAN caps and snaps back to Local/Pi if WAN drops.',
    baseThroughput: 800,
    throughputUnit: 'ops/s',
    costMetricLabel: 'Avg Latency',
    costUnit: 'ms',
    successMetricLabel: 'Frame SLA',
    primaryFailoverRailId: 'pi5-fog',
    stageHeaders: [
      { label: 'ROBOT / IOT', x: 90 },
      { label: 'EDGE GW', x: 240 },
      { label: 'COMPUTE TIERS', x: 515 },
      { label: 'ACTUATION', x: 815 },
    ],
    nodes: [
      n(0, 90, 300, 1, 'Camera / Robot'),
      n(1, 240, 300, 0, 'Edge Router'),
      n(2, 395, 300, 0, 'NPU In'),
      n(3, 635, 300, 0, 'NPU Out'),
      n(4, 395, 155, 0, 'Pi5 Fog In'),
      n(5, 635, 155, 0, 'Pi5 Fog Out'),
      n(6, 395, 445, 0, 'Cloud WAN In'),
      n(7, 635, 445, 0, 'Cloud GPU Out'),
      n(8, 815, 300, -1, 'Control Loop'),
    ],
    rails: [
      {
        id: 'local-npu',
        label: 'Local NPU',
        shortLabel: 'Local-NPU',
        edgeFrom: 2,
        edgeTo: 3,
        baseCapacity: 0.42,
        baseCostFactor: 1.0,
        baseUnitCost: 12,
        baseSuccessRate: 0.996,
        staticShare: 0.6,
        isPrimaryTier: true,
      },
      {
        id: 'pi5-fog',
        label: 'Raspberry Pi 5',
        shortLabel: 'Pi5-Fog',
        edgeFrom: 4,
        edgeTo: 5,
        baseCapacity: 0.48,
        baseCostFactor: 1.45,
        baseUnitCost: 28,
        baseSuccessRate: 0.99,
        staticShare: 0.2,
        isPrimaryTier: true,
      },
      {
        id: 'cloud-gpu',
        label: 'Cloud GPU (WAN)',
        shortLabel: 'Cloud-GPU',
        edgeFrom: 6,
        edgeTo: 7,
        baseCapacity: 0.98,
        baseCostFactor: 2.05,
        baseUnitCost: 75,
        baseSuccessRate: 0.985,
        staticShare: 0.2,
        isPrimaryTier: true,
      },
    ],
    explicitEdges: [
      { i: 0, j: 1, costFactor: 1.0 },
      { i: 1, j: 2, costFactor: 1.0 },
      { i: 1, j: 4, costFactor: 1.08 },
      { i: 1, j: 6, costFactor: 1.12 },
      { i: 2, j: 3, costFactor: 1.0, capacity: 0.42, cellId: 'local-npu', stage: RAIL_STAGE },
      { i: 4, j: 5, costFactor: 1.45, capacity: 0.48, cellId: 'pi5-fog', stage: RAIL_STAGE },
      { i: 6, j: 7, costFactor: 2.05, capacity: 0.98, cellId: 'cloud-gpu', stage: RAIL_STAGE },
      { i: 3, j: 8, costFactor: 1.0 },
      { i: 5, j: 8, costFactor: 1.05 },
      { i: 7, j: 8, costFactor: 1.1 },
    ],
  },
  {
    id: 'sys-service-mesh',
    name: 'Microservice Mesh Backpressure · Envoy',
    shortTitle: 'Envoy Backpressure',
    description:
      'Service A → Service B / Fallback Cache → Primary DB: propagates λ_e backpressure multi-hop upstream so callers shed into cache instead of tripping a global circuit breaker.',
    baseThroughput: 1000,
    throughputUnit: 'rps',
    costMetricLabel: 'Tail Lat.',
    costUnit: 'ms',
    successMetricLabel: '2xx Rate',
    primaryFailoverRailId: 'fallback-cache',
    stageHeaders: [
      { label: 'TENANTS', x: 85 },
      { label: 'ENVOY MESH', x: 235 },
      { label: 'SVC-B / CACHE', x: 475 },
      { label: 'DB POOL & RESP', x: 760 },
    ],
    nodes: [
      n(0, 85, 185, 0.55, 'Tenant VIP'),
      n(1, 85, 415, 0.45, 'Tenant Bulk'),
      n(2, 235, 185, 0, 'Envoy VIP'),
      n(3, 235, 415, 0, 'Envoy Bulk'),
      n(4, 385, 140, 0, 'Svc-B1 In'),
      n(5, 565, 140, 0, 'Svc-B1 Out'),
      n(6, 385, 300, 0, 'Svc-B2 In'),
      n(7, 565, 300, 0, 'Svc-B2 Out'),
      n(8, 385, 465, 0, 'Cache In'),
      n(9, 565, 465, 0, 'Cache Hit'),
      n(10, 690, 215, 0, 'DB Conn Pool'),
      n(11, 835, 305, -1, 'API Response'),
    ],
    rails: [
      {
        id: 'svc-b1',
        label: 'Svc-B Replica 1',
        shortLabel: 'Svc-B1',
        edgeFrom: 4,
        edgeTo: 5,
        baseCapacity: 0.42,
        baseCostFactor: 1.0,
        baseUnitCost: 16,
        baseSuccessRate: 0.995,
        staticShare: 0.45,
        isPrimaryTier: true,
      },
      {
        id: 'svc-b2',
        label: 'Svc-B Replica 2',
        shortLabel: 'Svc-B2',
        edgeFrom: 6,
        edgeTo: 7,
        baseCapacity: 0.42,
        baseCostFactor: 1.2,
        baseUnitCost: 22,
        baseSuccessRate: 0.99,
        staticShare: 0.45,
        isPrimaryTier: true,
      },
      {
        id: 'fallback-cache',
        label: 'Fallback Cache',
        shortLabel: 'Cache',
        edgeFrom: 8,
        edgeTo: 9,
        baseCapacity: 1.25,
        baseCostFactor: 1.55,
        baseUnitCost: 42,
        baseSuccessRate: 0.98,
        staticShare: 0.1,
        isPrimaryTier: true,
      },
      {
        id: 'db-primary',
        label: 'Primary DB Pool',
        shortLabel: 'Primary-DB',
        edgeFrom: 10,
        edgeTo: 11,
        baseCapacity: 0.62,
        baseCostFactor: 1.0,
        baseUnitCost: 10,
        baseSuccessRate: 0.995,
        staticShare: 0.9,
        isPrimaryTier: false,
      },
    ],
    explicitEdges: [
      { i: 0, j: 2, costFactor: 1.0 },
      { i: 1, j: 3, costFactor: 1.0 },
      { i: 2, j: 4, costFactor: 1.0 },
      { i: 2, j: 6, costFactor: 1.2 },
      { i: 2, j: 8, costFactor: 1.4 },
      { i: 3, j: 4, costFactor: 1.35 },
      { i: 3, j: 6, costFactor: 1.08 },
      { i: 3, j: 8, costFactor: 1.25 },
      { i: 4, j: 5, costFactor: 1.0, capacity: 0.42, cellId: 'svc-b1', stage: RAIL_STAGE },
      { i: 6, j: 7, costFactor: 1.2, capacity: 0.42, cellId: 'svc-b2', stage: RAIL_STAGE },
      { i: 8, j: 9, costFactor: 1.55, capacity: 1.25, cellId: 'fallback-cache', stage: RAIL_STAGE },
      { i: 5, j: 10, costFactor: 1.0 },
      { i: 7, j: 10, costFactor: 1.04 },
      { i: 10, j: 11, costFactor: 1.0, capacity: 0.62, cellId: 'db-primary', stage: RAIL_STAGE },
      { i: 9, j: 11, costFactor: 1.06 },
    ],
  },
  {
    id: 'sys-db-router',
    name: 'DB Read-Replica & Analytics Query Router',
    shortTitle: 'DB Query Router',
    description:
      'OLTP Reads / Heavy BI Reports → Redis Cache / Replicas 1..2 / ClickHouse: sheds heavy analytical scans off OLTP replicas before p95 latency spikes.',
    baseThroughput: 1000,
    throughputUnit: 'QPS',
    costMetricLabel: 'Repl. Lag',
    costUnit: 'ms',
    successMetricLabel: 'OLTP SLA',
    primaryFailoverRailId: 'replica-2',
    stageHeaders: [
      { label: 'QUERIES', x: 90 },
      { label: 'QUERY ROUTER', x: 240 },
      { label: 'CACHE / REPLICAS / OLAP', x: 515 },
      { label: 'RESULT', x: 815 },
    ],
    nodes: [
      n(0, 90, 200, 0.6, 'OLTP Web Reads'),
      n(1, 90, 400, 0.4, 'Heavy BI Scans'),
      n(2, 240, 300, 0, 'SQL Proxy'),
      n(3, 395, 240, 0, 'Redis In'),
      n(4, 635, 240, 0, 'Redis Out'),
      n(5, 395, 360, 0, 'Replica-1 In'),
      n(6, 635, 360, 0, 'Replica-1 Out'),
      n(7, 395, 120, 0, 'Replica-2 In'),
      n(8, 635, 120, 0, 'Replica-2 Out'),
      n(9, 395, 480, 0, 'ClickHouse In'),
      n(10, 635, 480, 0, 'ClickHouse Out'),
      n(11, 815, 300, -1, 'Query Result'),
    ],
    rails: [
      {
        id: 'redis-cache',
        label: 'Redis Hot Cache',
        shortLabel: 'Redis',
        edgeFrom: 3,
        edgeTo: 4,
        baseCapacity: 0.48,
        baseCostFactor: 1.0,
        baseUnitCost: 4,
        baseSuccessRate: 0.998,
        staticShare: 0.3,
        isPrimaryTier: true,
      },
      {
        id: 'replica-1',
        label: 'OLTP Replica 1',
        shortLabel: 'Replica-1',
        edgeFrom: 5,
        edgeTo: 6,
        baseCapacity: 0.56,
        baseCostFactor: 1.18,
        baseUnitCost: 18,
        baseSuccessRate: 0.99,
        staticShare: 0.58,
        isPrimaryTier: true,
      },
      {
        id: 'replica-2',
        label: 'OLTP Replica 2',
        shortLabel: 'Replica-2',
        edgeFrom: 7,
        edgeTo: 8,
        baseCapacity: 0.42,
        baseCostFactor: 1.32,
        baseUnitCost: 26,
        baseSuccessRate: 0.988,
        staticShare: 0.07,
        isPrimaryTier: true,
      },
      {
        id: 'clickhouse',
        label: 'DuckDB / ClickHouse',
        shortLabel: 'ClickHouse',
        edgeFrom: 9,
        edgeTo: 10,
        baseCapacity: 0.82,
        baseCostFactor: 1.48,
        baseUnitCost: 55,
        baseSuccessRate: 0.985,
        staticShare: 0.05,
        isPrimaryTier: true,
      },
    ],
    explicitEdges: [
      { i: 0, j: 2, costFactor: 1.0 },
      { i: 1, j: 2, costFactor: 1.03 },
      { i: 2, j: 3, costFactor: 1.0 },
      { i: 2, j: 5, costFactor: 1.03 },
      { i: 2, j: 7, costFactor: 1.06 },
      { i: 2, j: 9, costFactor: 1.08 },
      { i: 3, j: 4, costFactor: 1.0, capacity: 0.48, cellId: 'redis-cache', stage: RAIL_STAGE },
      { i: 5, j: 6, costFactor: 1.18, capacity: 0.56, cellId: 'replica-1', stage: RAIL_STAGE },
      { i: 7, j: 8, costFactor: 1.32, capacity: 0.42, cellId: 'replica-2', stage: RAIL_STAGE },
      { i: 9, j: 10, costFactor: 1.48, capacity: 0.82, cellId: 'clickhouse', stage: RAIL_STAGE },
      { i: 4, j: 11, costFactor: 1.0 },
      { i: 6, j: 11, costFactor: 1.03 },
      { i: 8, j: 11, costFactor: 1.06 },
      { i: 10, j: 11, costFactor: 1.08 },
    ],
  },
];

export function getSystemsScenario(id: string): SystemsScenarioSpec | null {
  return SYSTEMS_SCENARIOS.find((s) => s.id === id) ?? null;
}

export function createDefaultSystemsConditions(spec: SystemsScenarioSpec): SystemsConditions {
  const rails: Record<string, RailConditionOverride> = {};
  for (const r of spec.rails) {
    rails[r.id] = { capScale: 1, extraCost: 0, offline: false };
  }
  return { trafficMultiplier: 1.0, rails };
}

function findRailEdge(graph: Graph, rail: SystemsRailSpec) {
  return (
    graph.edges.find((e) => e.cellId === rail.id) ??
    graph.edges.find(
      (e) =>
        (e.i === rail.edgeFrom && e.j === rail.edgeTo) ||
        (e.i === rail.edgeTo && e.j === rail.edgeFrom),
    )
  );
}

/**
 * Apply interactive Systems conditions onto the solver graph.
 * Because `solver.ts` normalizes total supply to 1.0, global load spike `L`
 * scales normalized edge capacities `u_e' = u_e / L`, which enforces
 * `L * |Q_e| <= u_e` cleanly without touching existing solver behavior.
 */
export function applySystemsConditions(
  graph: Graph,
  spec: SystemsScenarioSpec,
  conditions: SystemsConditions,
): void {
  const loadMult = Math.max(0.25, Math.min(4, conditions.trafficMultiplier || 1));

  // Restore base explicit cost factors (in case clearTerrain reset edge.costFactor = 1).
  for (const specEdge of spec.explicitEdges) {
    const a = Math.min(specEdge.i, specEdge.j);
    const b = Math.max(specEdge.i, specEdge.j);
    const edge = graph.edges.find((e) => e.i === a && e.j === b);
    if (edge && !edge.cellId) {
      edge.costFactor = Math.max(specEdge.costFactor ?? 1, 1);
    }
  }

  for (const rail of spec.rails) {
    const edge = findRailEdge(graph, rail);
    if (!edge) continue;
    const cond = conditions.rails[rail.id] ?? { capScale: 1, extraCost: 0, offline: false };
    const capScale = Math.max(0.05, Math.min(3, cond.capScale));
    const extraCost = Math.max(0, Math.min(5, cond.extraCost));

    edge.costFactor = Math.max(1, rail.baseCostFactor + extraCost);
    edge.capacity = Math.max(0.02, (rail.baseCapacity * capScale) / loadMult);

    if (cond.offline) {
      edge.severed = true;
      edge.D = 0;
      edge.flow = 0;
      edge.congestion = 0;
    } else if (edge.severed) {
      edge.severed = false;
      edge.D = Math.max(edge.D, 0.25);
      edge.congestion = 0;
    }
  }
}

export function evaluateSystemsScenario(
  graph: Graph,
  spec: SystemsScenarioSpec,
  conditions: SystemsConditions,
): SystemsEvaluation {
  const loadMult = Math.max(0.25, Math.min(4, conditions.trafficMultiplier || 1));
  const totalDemand = spec.baseThroughput * loadMult;

  const railMetrics: SystemsRailMetrics[] = [];
  let primaryOverload = 0;
  let downstreamOverload = 0;
  let weightedCost = 0;
  let weightedSuccess = 0;
  let servedPrimaryUnits = 0;
  let maxLambda = 0;
  let activeRails = 0;
  let offlineRails = 0;

  for (const rail of spec.rails) {
    const edge = findRailEdge(graph, rail);
    const cond = conditions.rails[rail.id] ?? { capScale: 1, extraCost: 0, offline: false };
    const offline = cond.offline || Boolean(edge?.severed);
    const capScale = Math.max(0.05, Math.min(3, cond.capScale));
    const capUnits = offline ? 0 : rail.baseCapacity * spec.baseThroughput * capScale;
    const normFlow = edge && !edge.severed ? Math.abs(edge.flow) : 0;
    const loadUnits = normFlow * totalDemand;
    const lam = edge && !edge.severed ? Math.max(0, edge.congestion ?? 0) : 0;
    const utilizationPct = capUnits > 1e-6 ? (loadUnits / capUnits) * 100 : loadUnits > 0 ? 999 : 0;
    const overloadUnits = offline ? loadUnits : Math.max(0, loadUnits - capUnits * 1.015);
    const effUnitCost = rail.baseUnitCost * (1 + Math.max(0, cond.extraCost) * 0.65);
    const sharePct = Math.min(100, normFlow * 100);

    let status: SystemsRailStatus = 'HEALTHY';
    if (offline) {
      status = 'OFFLINE';
      offlineRails++;
    } else {
      activeRails++;
      if (overloadUnits > 1 || lam > 0.35 || utilizationPct > 105) status = 'SATURATED';
      else if (lam > 0.05 || utilizationPct >= 90) status = 'SPILLING';
    }

    if (lam > maxLambda) maxLambda = lam;

    if (rail.isPrimaryTier) {
      primaryOverload += overloadUnits;
      const accepted = Math.min(loadUnits, capUnits);
      servedPrimaryUnits += accepted;
      weightedCost += accepted * effUnitCost;
      weightedSuccess += accepted * rail.baseSuccessRate;
    } else {
      downstreamOverload += overloadUnits;
    }

    railMetrics.push({
      id: rail.id,
      label: rail.label,
      shortLabel: rail.shortLabel,
      sharePct,
      loadUnits,
      capUnits,
      utilizationPct,
      effectiveUnitCost: effUnitCost,
      shadowPriceLambda: lam,
      overloadUnits,
      status,
      isPrimaryTier: rail.isPrimaryTier,
      offline,
    });
  }

  // If no primary tier carries flow (e.g., total disconnection), entire demand drops.
  const totalPrimaryFlow = railMetrics
    .filter((r) => r.isPrimaryTier && !r.offline)
    .reduce((acc, r) => acc + r.loadUnits, 0);
  const disconnectedDemand =
    totalPrimaryFlow < totalDemand * 0.5 ? Math.max(0, totalDemand - totalPrimaryFlow) : 0;
  const phyOverload = Math.min(
    totalDemand,
    Math.max(primaryOverload + disconnectedDemand, downstreamOverload),
  );
  const phyDropPct = Math.min(100, (phyOverload / Math.max(totalDemand, 1)) * 100);
  const phyAvgCost = servedPrimaryUnits > 1e-6 ? weightedCost / servedPrimaryUnits : 0;
  const phyBaseSuccess =
    servedPrimaryUnits > 1e-6 ? weightedSuccess / servedPrimaryUnits : 0;
  const phySuccessPct = Math.max(0, (1 - phyDropPct / 100) * phyBaseSuccess * 100);

  // Fair Static / Nearest-Priority Baseline under the same conditions:
  // Static policies send fixed weights and only failover to primaryFailoverRailId on outage.
  const staticLoadMap = new Map<string, number>();
  let failoverCarry = 0;
  for (const rail of spec.rails) {
    if (!rail.isPrimaryTier) continue;
    const cond = conditions.rails[rail.id] ?? { capScale: 1, extraCost: 0, offline: false };
    const want = rail.staticShare * totalDemand;
    if (cond.offline) {
      failoverCarry += want;
      staticLoadMap.set(rail.id, 0);
    } else {
      staticLoadMap.set(rail.id, want);
    }
  }
  if (failoverCarry > 0) {
    const failoverCond = conditions.rails[spec.primaryFailoverRailId];
    const onlineFallback =
      failoverCond && !failoverCond.offline
        ? spec.primaryFailoverRailId
        : spec.rails.find((r) => r.isPrimaryTier && !(conditions.rails[r.id]?.offline))?.id;
    if (onlineFallback) {
      staticLoadMap.set(onlineFallback, (staticLoadMap.get(onlineFallback) ?? 0) + failoverCarry);
    }
  }

  let staticPrimaryOverload = 0;
  let staticDownstreamOverload = 0;
  let staticServed = 0;
  let staticWeightedCost = 0;
  let staticWeightedSuccess = 0;
  let staticTotalAssigned = 0;

  for (const rail of spec.rails) {
    const cond = conditions.rails[rail.id] ?? { capScale: 1, extraCost: 0, offline: false };
    const capUnits = cond.offline
      ? 0
      : rail.baseCapacity * spec.baseThroughput * Math.max(0.05, cond.capScale);
    if (rail.isPrimaryTier) {
      const assigned = staticLoadMap.get(rail.id) ?? 0;
      staticTotalAssigned += assigned;
      const over = Math.max(0, assigned - capUnits * 1.015);
      staticPrimaryOverload += over;
      const accepted = Math.min(assigned, capUnits);
      const effCost = rail.baseUnitCost * (1 + Math.max(0, cond.extraCost) * 0.65);
      staticServed += accepted;
      staticWeightedCost += accepted * effCost;
      staticWeightedSuccess += accepted * rail.baseSuccessRate;
    } else {
      // Shared DB pool in service-mesh receives traffic from svc-b1 + svc-b2
      const svcLoad =
        (staticLoadMap.get('svc-b1') ?? 0) + (staticLoadMap.get('svc-b2') ?? 0);
      const over = cond.offline ? svcLoad : Math.max(0, svcLoad - capUnits * 1.015);
      staticDownstreamOverload += over;
    }
  }
  const staticUnplaced = Math.max(0, totalDemand - staticTotalAssigned);
  const staticTotalOverload = Math.min(
    totalDemand,
    Math.max(staticPrimaryOverload + staticUnplaced, staticDownstreamOverload),
  );
  const staticDropPct = Math.min(100, (staticTotalOverload / Math.max(totalDemand, 1)) * 100);
  const staticAvgCost = staticServed > 1e-6 ? staticWeightedCost / staticServed : 0;
  const staticBaseSuccess =
    staticServed > 1e-6 ? staticWeightedSuccess / staticServed : 0;
  const staticSuccessPct = Math.max(0, (1 - staticDropPct / 100) * staticBaseSuccess * 100);

  return {
    scenarioId: spec.id,
    totalDemand,
    throughputUnit: spec.throughputUnit,
    costMetricLabel: spec.costMetricLabel,
    costUnit: spec.costUnit,
    successMetricLabel: spec.successMetricLabel,
    rails: railMetrics,
    physarum: {
      avgCost: phyAvgCost,
      dropPct: phyDropPct,
      successPct: phySuccessPct,
      maxLambda,
      totalOverloadUnits: phyOverload,
    },
    staticBaseline: {
      avgCost: staticAvgCost,
      dropPct: staticDropPct,
      successPct: staticSuccessPct,
      totalOverloadUnits: staticTotalOverload,
    },
    dropReductionPct: Math.max(0, staticDropPct - phyDropPct),
    costDelta: phyAvgCost - staticAvgCost,
    activeRails,
    offlineRails,
  };
}

export function exportSystemsJson(
  graph: Graph,
  spec: SystemsScenarioSpec,
  conditions: SystemsConditions,
  evalRes: SystemsEvaluation,
  meta: { seed: number; iteration: number },
): string {
  return JSON.stringify(
    {
      scenarioId: spec.id,
      scenarioName: spec.name,
      seed: meta.seed,
      iteration: meta.iteration,
      conditions,
      evaluation: evalRes,
      edges: graph.edges.map((e) => ({
        i: e.i,
        j: e.j,
        cellId: e.cellId ?? null,
        D: Number(e.D.toFixed(4)),
        flow: Number(Math.abs(e.flow).toFixed(4)),
        capacity: e.capacity !== undefined ? Number(e.capacity.toFixed(4)) : null,
        shadowPriceLambda: Number((e.congestion ?? 0).toFixed(4)),
        costFactor: Number(e.costFactor.toFixed(3)),
        severed: Boolean(e.severed),
      })),
    },
    null,
    2,
  );
}
