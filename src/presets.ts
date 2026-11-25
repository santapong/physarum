import type { DynamicsMode, ExplicitEdgeSpec, FlowMode, GraphMode, LabDomain, Node } from './graph';

export interface EdgeCapacitySpec {
  i: number;
  j: number;
  capacity: number;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  domain: LabDomain;
  mode: GraphMode;
  flowMode?: FlowMode;
  dynamicsMode?: DynamicsMode;
  mu?: number;
  maxRadiusMm?: number;
  seed: number;
  nodes: Node[];
  terrainPolygons?: Array<Array<[number, number]>>;
  capacities?: EdgeCapacitySpec[];
  explicitEdges?: ExplicitEdgeSpec[];
}

const node = (id: number, x: number, y: number, flow = 0, label?: string): Node =>
  label ? { id, x, y, flow, label } : { id, x, y, flow };

function buildJewelryFactoryLayout(options: {
  cast18kCap: number;
  paveCap: number;
  polishACap: number;
}): { nodes: Node[]; explicitEdges: ExplicitEdgeSpec[] } {
  const nodes: Node[] = [
    node(0, 45, 300, 1, 'Intake'),
    // Stage 1: Wax
    node(1, 105, 195),
    node(2, 155, 195),
    node(3, 105, 405),
    node(4, 155, 405),
    // Stage 2: Casting
    node(5, 225, 145),
    node(6, 280, 145),
    node(7, 225, 300),
    node(8, 280, 300),
    node(9, 225, 455),
    node(10, 280, 455),
    // Stage 3: Filing
    node(11, 345, 195),
    node(12, 400, 195),
    node(13, 345, 405),
    node(14, 400, 405),
    // Stage 4: Setting
    node(15, 465, 195),
    node(16, 520, 195),
    node(17, 465, 405),
    node(18, 520, 405),
    // Stage 5: Polish
    node(19, 585, 195),
    node(20, 640, 195),
    node(21, 585, 405),
    node(22, 640, 405),
    // Stage 6: Plating
    node(23, 705, 195),
    node(24, 755, 195),
    node(25, 705, 405),
    node(26, 755, 405),
    // Stage 7: QC
    node(27, 810, 300),
    node(28, 860, 300, -1, 'QC Pass'),
  ];

  const explicitEdges: ExplicitEdgeSpec[] = [
    // Intake -> Wax
    { i: 0, j: 1, costFactor: 1.0 },
    { i: 0, j: 3, costFactor: 1.0 },
    // Wax cells
    { i: 1, j: 2, costFactor: 1.0, capacity: 0.55, cellId: 'wax-1', stage: 'Wax' },
    { i: 3, j: 4, costFactor: 1.05, capacity: 0.55, cellId: 'wax-2', stage: 'Wax' },
    // Wax -> Casting
    { i: 2, j: 5, costFactor: 1.0 },
    { i: 2, j: 7, costFactor: 1.15 },
    { i: 2, j: 9, costFactor: 1.3 },
    { i: 4, j: 5, costFactor: 1.3 },
    { i: 4, j: 7, costFactor: 1.15 },
    { i: 4, j: 9, costFactor: 1.0 },
    // Casting cells
    { i: 5, j: 6, costFactor: 1.0, capacity: options.cast18kCap, cellId: 'cast-18k', stage: 'Casting' },
    { i: 7, j: 8, costFactor: 1.12, capacity: 0.45, cellId: 'cast-flex', stage: 'Casting' },
    { i: 9, j: 10, costFactor: 1.0, capacity: 0.4, cellId: 'cast-925', stage: 'Casting' },
    // Casting -> Filing
    { i: 6, j: 11, costFactor: 1.0 },
    { i: 6, j: 13, costFactor: 1.25 },
    { i: 8, j: 11, costFactor: 1.1 },
    { i: 8, j: 13, costFactor: 1.1 },
    { i: 10, j: 11, costFactor: 1.25 },
    { i: 10, j: 13, costFactor: 1.0 },
    // Filing cells
    { i: 11, j: 12, costFactor: 1.0, capacity: 0.55, cellId: 'file-1', stage: 'Filing' },
    { i: 13, j: 14, costFactor: 1.05, capacity: 0.55, cellId: 'file-2', stage: 'Filing' },
    // Filing -> Setting
    { i: 12, j: 15, costFactor: 1.0 },
    { i: 12, j: 17, costFactor: 1.25 },
    { i: 14, j: 15, costFactor: 1.25 },
    { i: 14, j: 17, costFactor: 1.0 },
    // Setting cells
    { i: 15, j: 16, costFactor: 1.0, capacity: options.paveCap, cellId: 'set-pave', stage: 'Setting' },
    { i: 17, j: 18, costFactor: 1.2, capacity: 0.65, cellId: 'set-prong', stage: 'Setting' },
    // Setting -> Polish
    { i: 16, j: 19, costFactor: 1.0 },
    { i: 16, j: 21, costFactor: 1.25 },
    { i: 18, j: 19, costFactor: 1.25 },
    { i: 18, j: 21, costFactor: 1.0 },
    // Polish cells
    { i: 19, j: 20, costFactor: 1.0, capacity: options.polishACap, cellId: 'polish-a', stage: 'Polish' },
    { i: 21, j: 22, costFactor: 1.1, capacity: 0.55, cellId: 'polish-b', stage: 'Polish' },
    // Polish -> Plating
    { i: 20, j: 23, costFactor: 1.0 },
    { i: 20, j: 25, costFactor: 1.25 },
    { i: 22, j: 23, costFactor: 1.25 },
    { i: 22, j: 25, costFactor: 1.0 },
    // Plating cells
    { i: 23, j: 24, costFactor: 1.0, capacity: 0.55, cellId: 'plate-1', stage: 'Plating' },
    { i: 25, j: 26, costFactor: 1.05, capacity: 0.55, cellId: 'plate-2', stage: 'Plating' },
    // Plating -> QC
    { i: 24, j: 27, costFactor: 1.0 },
    { i: 26, j: 27, costFactor: 1.0 },
    // QC cell
    { i: 27, j: 28, costFactor: 1.0, capacity: 1.05, cellId: 'qc-1', stage: 'QC' },
  ];

  return { nodes, explicitEdges };
}

const JEWELRY_ATELIER_LAYOUT = buildJewelryFactoryLayout({
  cast18kCap: 0.4,
  paveCap: 0.42,
  polishACap: 0.52,
});

const JEWELRY_RUSH_LAYOUT = buildJewelryFactoryLayout({
  cast18kCap: 0.36,
  paveCap: 0.38,
  polishACap: 0.46,
});

function buildFgSgFactoryLayout(): { nodes: Node[]; explicitEdges: ExplicitEdgeSpec[] } {
  const base = buildJewelryFactoryLayout({
    cast18kCap: 0.38,
    paveCap: 0.38,
    polishACap: 0.48,
  });
  const nodes = base.nodes.map((n) => ({ ...n }));
  nodes[0].flow = 0.75;
  nodes[0].label = 'Wax Intake';
  nodes[28].flow = -0.75;
  nodes[28].label = 'FG QC';
  nodes.push(
    node(29, 432, 95, 0.25, 'SG Stock'),
    node(30, 432, 505, -0.25, 'SG Store'),
  );

  const explicitEdges: ExplicitEdgeSpec[] = [
    ...base.explicitEdges,
    // SG-STOCK replenishment output after Filing
    { i: 12, j: 30, costFactor: 1.05 },
    { i: 14, j: 30, costFactor: 1.0 },
    // On-hand SG inventory entering Setting or Polish
    { i: 29, j: 15, costFactor: 1.0 },
    { i: 29, j: 17, costFactor: 1.15 },
    { i: 29, j: 19, costFactor: 1.25 },
    // Plain-band bypass (Filing -> Polish, skipping Setting)
    { i: 12, j: 19, costFactor: 1.45 },
    { i: 14, j: 21, costFactor: 1.45 },
    // Unplated-model bypass (Polish -> QC, skipping Plating)
    { i: 20, j: 27, costFactor: 1.45 },
    { i: 22, j: 27, costFactor: 1.45 },
  ];

  return { nodes, explicitEdges };
}

const JEWELRY_100PO_LAYOUT = buildFgSgFactoryLayout();

function buildErpFactoryLayout(): { nodes: Node[]; explicitEdges: ExplicitEdgeSpec[] } {
  const nodes: Node[] = [
    node(0, 36, 300, 0.8, 'Raw Intake'),
    // Stage 1: Wax (1..4)
    node(1, 88, 195),
    node(2, 128, 195),
    node(3, 88, 405),
    node(4, 128, 405),
    // Stage 2: Casting (5..10)
    node(5, 178, 145),
    node(6, 220, 145),
    node(7, 178, 300),
    node(8, 220, 300),
    node(9, 178, 455),
    node(10, 220, 455),
    // Stage 3: Filing (11..14)
    node(11, 268, 195),
    node(12, 308, 195),
    node(13, 268, 405),
    node(14, 308, 405),
    // Stage 4: Warehouse SG Hub (15..16)
    node(15, 358, 300, 0, 'WH In'),
    node(16, 404, 300, 0, 'WH Out'),
    // Stage 5: Assembly (17..20)
    node(17, 452, 195),
    node(18, 492, 195),
    node(19, 452, 405),
    node(20, 492, 405),
    // Stage 6: Setting (21..24)
    node(21, 540, 195),
    node(22, 582, 195),
    node(23, 540, 405),
    node(24, 582, 405),
    // Stage 7: Polish (25..28)
    node(25, 630, 195),
    node(26, 672, 195),
    node(27, 630, 405),
    node(28, 672, 405),
    // Stage 8: Plating (29..32)
    node(29, 720, 195),
    node(30, 758, 195),
    node(31, 720, 405),
    node(32, 758, 405),
    // Warehouse Stock/Buffer Terminals (33..34)
    node(33, 358, 98, 0.2, 'SG Stock'),
    node(34, 404, 502, -0.2, 'SG Buffer'),
    // Stage 9: QC & Ship (35..36)
    node(35, 808, 300),
    node(36, 862, 300, -0.8, 'FG Ship'),
  ];

  const explicitEdges: ExplicitEdgeSpec[] = [
    // Intake -> Wax
    { i: 0, j: 1, costFactor: 1.0 },
    { i: 0, j: 3, costFactor: 1.0 },
    // Wax cells
    { i: 1, j: 2, costFactor: 1.0, capacity: 0.5, cellId: 'wax-1', stage: 'Wax' },
    { i: 3, j: 4, costFactor: 1.05, capacity: 0.5, cellId: 'wax-2', stage: 'Wax' },
    // Wax -> Casting
    { i: 2, j: 5, costFactor: 1.0 },
    { i: 2, j: 7, costFactor: 1.15 },
    { i: 2, j: 9, costFactor: 1.3 },
    { i: 4, j: 5, costFactor: 1.3 },
    { i: 4, j: 7, costFactor: 1.15 },
    { i: 4, j: 9, costFactor: 1.0 },
    // Casting cells
    { i: 5, j: 6, costFactor: 1.0, capacity: 0.34, cellId: 'cast-18k', stage: 'Casting' },
    { i: 7, j: 8, costFactor: 1.12, capacity: 0.42, cellId: 'cast-flex', stage: 'Casting' },
    { i: 9, j: 10, costFactor: 1.0, capacity: 0.38, cellId: 'cast-925', stage: 'Casting' },
    // Casting -> Filing
    { i: 6, j: 11, costFactor: 1.0 },
    { i: 6, j: 13, costFactor: 1.25 },
    { i: 8, j: 11, costFactor: 1.1 },
    { i: 8, j: 13, costFactor: 1.1 },
    { i: 10, j: 11, costFactor: 1.25 },
    { i: 10, j: 13, costFactor: 1.0 },
    // Filing cells
    { i: 11, j: 12, costFactor: 1.0, capacity: 0.5, cellId: 'file-1', stage: 'Filing' },
    { i: 13, j: 14, costFactor: 1.05, capacity: 0.5, cellId: 'file-2', stage: 'Filing' },
    // Filing -> Warehouse SG Hub (and SG Stock/Buffer terminals)
    { i: 12, j: 15, costFactor: 1.0 },
    { i: 14, j: 15, costFactor: 1.0 },
    { i: 33, j: 15, costFactor: 1.05 },
    { i: 15, j: 16, costFactor: 1.0, capacity: 0.62, cellId: 'wh-io', stage: 'Warehouse' },
    { i: 16, j: 34, costFactor: 1.05 },
    // Warehouse -> Assembly (+ FG-FULL Filing -> Assembly bypass)
    { i: 16, j: 17, costFactor: 1.0 },
    { i: 16, j: 19, costFactor: 1.05 },
    { i: 12, j: 17, costFactor: 1.35 },
    { i: 14, j: 19, costFactor: 1.35 },
    // Assembly cells
    { i: 17, j: 18, costFactor: 1.0, capacity: 0.44, cellId: 'asm-1', stage: 'Assembly' },
    { i: 19, j: 20, costFactor: 1.05, capacity: 0.48, cellId: 'asm-2', stage: 'Assembly' },
    // Assembly -> Setting
    { i: 18, j: 21, costFactor: 1.0 },
    { i: 18, j: 23, costFactor: 1.25 },
    { i: 20, j: 21, costFactor: 1.25 },
    { i: 20, j: 23, costFactor: 1.0 },
    // Setting cells
    { i: 21, j: 22, costFactor: 1.0, capacity: 0.36, cellId: 'set-pave', stage: 'Setting' },
    { i: 23, j: 24, costFactor: 1.2, capacity: 0.56, cellId: 'set-prong', stage: 'Setting' },
    // Setting -> Polish (+ Plain-Band Assembly -> Polish bypass)
    { i: 22, j: 25, costFactor: 1.0 },
    { i: 22, j: 27, costFactor: 1.25 },
    { i: 24, j: 25, costFactor: 1.25 },
    { i: 24, j: 27, costFactor: 1.0 },
    { i: 18, j: 25, costFactor: 1.45 },
    { i: 20, j: 27, costFactor: 1.45 },
    // Polish cells
    { i: 25, j: 26, costFactor: 1.0, capacity: 0.45, cellId: 'polish-a', stage: 'Polish' },
    { i: 27, j: 28, costFactor: 1.1, capacity: 0.52, cellId: 'polish-b', stage: 'Polish' },
    // Polish -> Plating
    { i: 26, j: 29, costFactor: 1.0 },
    { i: 26, j: 31, costFactor: 1.25 },
    { i: 28, j: 29, costFactor: 1.25 },
    { i: 28, j: 31, costFactor: 1.0 },
    // Plating cells
    { i: 29, j: 30, costFactor: 1.0, capacity: 0.5, cellId: 'plate-1', stage: 'Plating' },
    { i: 31, j: 32, costFactor: 1.05, capacity: 0.5, cellId: 'plate-2', stage: 'Plating' },
    // Plating -> QC (+ Unplated Polish -> QC bypass)
    { i: 30, j: 35, costFactor: 1.0 },
    { i: 32, j: 35, costFactor: 1.0 },
    { i: 26, j: 35, costFactor: 1.45 },
    { i: 28, j: 35, costFactor: 1.45 },
    // QC cell
    { i: 35, j: 36, costFactor: 1.0, capacity: 0.9, cellId: 'qc-1', stage: 'QC' },
  ];

  return { nodes, explicitEdges };
}

const JEWELRY_ERP_LAYOUT = buildErpFactoryLayout();

export const PRESETS: Preset[] = [
  {
    id: 'direct-route',
    name: 'Direct route',
    description: 'One origin, one destination, and competing paths.',
    domain: 'transport',
    mode: 'complete',
    seed: 1207,
    nodes: [
      node(0, 105, 300, 1), node(1, 795, 300, -1), node(2, 245, 155),
      node(3, 245, 445), node(4, 440, 105), node(5, 450, 300),
      node(6, 440, 495), node(7, 650, 175), node(8, 650, 425),
    ],
  },
  {
    id: 'river-crossing',
    name: 'River crossing',
    description: 'Two dense shores compete for a narrow crossing.',
    domain: 'transport',
    mode: 'delaunay',
    seed: 8042,
    nodes: [
      node(0, 90, 160, 1), node(1, 90, 440, 1), node(2, 810, 300, -1),
      node(3, 210, 110), node(4, 205, 245), node(5, 220, 390), node(6, 330, 505),
      node(7, 410, 235), node(8, 430, 365), node(9, 555, 95), node(10, 570, 260),
      node(11, 565, 455), node(12, 700, 165), node(13, 700, 380),
    ],
  },
  {
    id: 'city-ring',
    name: 'City ring',
    description: 'A circular city reveals mesh-to-tree behavior.',
    domain: 'transport',
    mode: 'complete',
    mu: 0.85,
    seed: 991,
    nodes: [
      node(0, 450, 75, 1), node(1, 450, 525, -1), node(2, 610, 120),
      node(3, 740, 225), node(4, 740, 375), node(5, 610, 480),
      node(6, 290, 480), node(7, 160, 375), node(8, 160, 225), node(9, 290, 120),
      node(10, 450, 205), node(11, 450, 395), node(12, 330, 300), node(13, 570, 300),
    ],
  },
  {
    id: 'supply-web',
    name: 'Supply web',
    description: 'Three suppliers adapt toward two demand centers.',
    domain: 'transport',
    mode: 'delaunay',
    seed: 42424,
    nodes: [
      node(0, 100, 120, 1), node(1, 95, 300, 1), node(2, 100, 480, 1),
      node(3, 805, 205, -1), node(4, 805, 395, -1), node(5, 235, 205),
      node(6, 235, 390), node(7, 370, 105), node(8, 375, 300), node(9, 365, 500),
      node(10, 525, 190), node(11, 525, 410), node(12, 675, 105), node(13, 670, 300),
      node(14, 680, 500),
    ],
  },
  {
    id: 'tokyo-rail',
    name: 'Tokyo Rail · Tero 2010',
    description: 'Multi-terminal rail emergence across Greater Tokyo and Tokyo Bay.',
    domain: 'transport',
    mode: 'delaunay',
    flowMode: 'multi-terminal',
    mu: 1.35,
    seed: 2010,
    nodes: [
      node(0, 452, 292, -1, 'Tokyo'),
      node(1, 408, 286, 1, 'Shinjuku'),
      node(2, 412, 314, 1, 'Shibuya'),
      node(3, 414, 254, 1, 'Ikebukuro'),
      node(4, 464, 260, 1, 'Ueno'),
      node(5, 442, 330, 1, 'Shinagawa'),
      node(6, 418, 376, 1, 'Kawasaki'),
      node(7, 388, 418, 1, 'Yokohama'),
      node(8, 336, 382, 1, 'Machida'),
      node(9, 342, 466, 1, 'Fujisawa'),
      node(10, 374, 484, 1, 'Kamakura'),
      node(11, 414, 514, 1, 'Yokosuka'),
      node(12, 248, 496, 1, 'Odawara'),
      node(13, 288, 294, 1, 'Tachikawa'),
      node(14, 234, 314, 1, 'Hachioji'),
      node(15, 326, 224, 1, 'Tokorozawa'),
      node(16, 410, 174, 1, 'Omiya'),
      node(17, 346, 170, 1, 'Kawagoe'),
      node(18, 332, 86, 1, 'Kumagaya'),
      node(19, 486, 166, 1, 'Kasukabe'),
      node(20, 518, 236, 1, 'Matsudo'),
      node(21, 544, 198, 1, 'Kashiwa'),
      node(22, 600, 128, 1, 'Tsukuba'),
      node(23, 550, 290, 1, 'Funabashi'),
      node(24, 602, 326, 1, 'Chiba'),
      node(25, 694, 270, 1, 'Narita'),
      node(26, 554, 446, 1, 'Kisarazu'),
      node(27, 524, 540, 1, 'Tateyama'),
    ],
    terrainPolygons: [
      [
        [458, 336],
        [534, 314],
        [566, 344],
        [524, 444],
        [496, 518],
        [434, 504],
        [426, 416],
      ],
    ],
  },
  {
    id: 'bangkok-rail',
    name: 'Bangkok Metro · Multi-Terminal',
    description: 'Multi-terminal transit web from Nakhon Pathom through Greater Bangkok.',
    domain: 'transport',
    mode: 'delaunay',
    flowMode: 'multi-terminal',
    mu: 1.25,
    seed: 2026,
    nodes: [
      node(0, 452, 310, -1, 'Siam'),
      node(1, 442, 274, 1, 'Victory Mon.'),
      node(2, 496, 316, 1, 'Asok'),
      node(3, 456, 346, 1, 'Silom'),
      node(4, 416, 234, 1, 'Bang Sue'),
      node(5, 366, 194, 1, 'Nonthaburi'),
      node(6, 436, 164, 1, 'Chaeng Wat.'),
      node(7, 472, 120, 1, 'Don Mueang'),
      node(8, 492, 66, 1, 'Rangsit'),
      node(9, 446, 210, 1, 'Mo Chit'),
      node(10, 526, 236, 1, 'Lat Phrao'),
      node(11, 636, 216, 1, 'Min Buri'),
      node(12, 566, 276, 1, 'Bang Kapi'),
      node(13, 666, 316, 1, 'Lat Krabang'),
      node(14, 646, 366, 1, 'Suvarnabhumi'),
      node(15, 546, 386, 1, 'Bang Na'),
      node(16, 536, 466, 1, 'Samut Prakan'),
      node(17, 446, 396, 1, 'Rama III'),
      node(18, 376, 326, 1, 'Thonburi'),
      node(19, 306, 346, 1, 'Bang Khae'),
      node(20, 240, 276, 1, 'Salaya'),
      node(21, 126, 276, 1, 'Nakhon Pathom'),
      node(22, 272, 476, 1, 'Mahachai'),
      node(23, 396, 290),
      node(24, 506, 354),
      node(25, 334, 256),
    ],
  },
  {
    id: 'vascular-scaffold',
    name: 'Tissue Scaffold · Murray Tree',
    description: 'Bioprinted perfusion tree obeying Murray Law around an avascular core.',
    domain: 'vascular',
    mode: 'delaunay',
    flowMode: 'source-sink',
    dynamicsMode: 'murray',
    mu: 1.33,
    maxRadiusMm: 0.6,
    seed: 3101,
    nodes: [
      node(0, 90, 300, 1, 'Inlet'),
      node(1, 200, 300),
      node(2, 260, 185),
      node(3, 260, 415),
      node(4, 340, 130),
      node(5, 345, 240),
      node(6, 345, 360),
      node(7, 340, 470),
      node(8, 445, 110),
      node(9, 445, 185),
      node(10, 445, 415),
      node(11, 445, 490),
      node(12, 560, 135),
      node(13, 565, 235),
      node(14, 565, 365),
      node(15, 560, 465),
      node(16, 650, 95, -1, 'Cap 1'),
      node(17, 745, 145, -1, 'Cap 2'),
      node(18, 790, 225, -1, 'Cap 3'),
      node(19, 800, 295, -1, 'Cap 4'),
      node(20, 795, 365, -1, 'Cap 5'),
      node(21, 750, 445, -1, 'Cap 6'),
      node(22, 655, 505, -1, 'Cap 7'),
      node(23, 535, 540, -1, 'Cap 8'),
    ],
    terrainPolygons: [
      [
        [375, 245],
        [525, 245],
        [525, 355],
        [375, 355],
      ],
    ],
  },
  {
    id: 'microfluidic-heatsink',
    name: 'Cold Plate · Heat-Sink Cooling',
    description: 'Low-pressure-drop branching coolant channels avoiding mounting bolts.',
    domain: 'vascular',
    mode: 'delaunay',
    flowMode: 'source-sink',
    dynamicsMode: 'murray',
    mu: 1.33,
    maxRadiusMm: 1.5,
    seed: 3102,
    nodes: [
      node(0, 88, 300, 1, 'Coolant In'),
      node(1, 185, 300),
      node(2, 235, 180),
      node(3, 235, 420),
      node(4, 305, 105),
      node(5, 305, 250),
      node(6, 305, 350),
      node(7, 305, 495),
      node(8, 435, 90),
      node(9, 435, 235),
      node(10, 435, 300),
      node(11, 435, 365),
      node(12, 435, 510),
      node(13, 560, 130),
      node(14, 565, 240),
      node(15, 565, 360),
      node(16, 560, 470),
      node(17, 675, 195),
      node(18, 675, 300),
      node(19, 675, 405),
      node(20, 795, 110, -1, 'Out 1'),
      node(21, 805, 210, -1, 'Out 2'),
      node(22, 810, 300, -1, 'Out 3'),
      node(23, 805, 390, -1, 'Out 4'),
      node(24, 795, 490, -1, 'Out 5'),
      node(25, 520, 300, -1, 'Die Core'),
    ],
    terrainPolygons: [
      [
        [345, 130],
        [415, 130],
        [415, 195],
        [345, 195],
      ],
      [
        [345, 405],
        [415, 405],
        [415, 470],
        [345, 470],
      ],
    ],
  },
  {
    id: 'soft-actuator',
    name: 'Soft Actuator · 4-Finger Pneumatic',
    description: 'Compliant hydraulic/pneumatic manifold feeding four soft robotic fingers.',
    domain: 'vascular',
    mode: 'delaunay',
    flowMode: 'source-sink',
    dynamicsMode: 'murray',
    mu: 1.15,
    maxRadiusMm: 2.2,
    seed: 3103,
    nodes: [
      node(0, 100, 300, 1, 'Wrist Pump'),
      node(1, 215, 300),
      node(2, 290, 215),
      node(3, 290, 385),
      node(4, 375, 145),
      node(5, 390, 255),
      node(6, 390, 345),
      node(7, 375, 455),
      node(8, 495, 115),
      node(9, 505, 230),
      node(10, 505, 370),
      node(11, 495, 485),
      node(12, 625, 105),
      node(13, 635, 225),
      node(14, 635, 375),
      node(15, 625, 495),
      node(16, 480, 300),
      node(17, 610, 300),
      node(18, 770, 95, -1, 'Thumb'),
      node(19, 795, 230, -1, 'Index'),
      node(20, 795, 370, -1, 'Middle'),
      node(21, 770, 505, -1, 'Ring'),
    ],
    terrainPolygons: [
      [
        [545, 150],
        [720, 150],
        [720, 190],
        [545, 190],
      ],
      [
        [545, 410],
        [720, 410],
        [720, 450],
        [545, 450],
      ],
    ],
  },
  {
    id: 'opt-shortest-path',
    name: 'Shortest Path · Bonifaci 2012',
    description: 'Linear Physarum discovers the exact shortest bypass around an obstacle.',
    domain: 'optimization',
    mode: 'delaunay',
    flowMode: 'source-sink',
    dynamicsMode: 'linear-lp',
    mu: 1.0,
    seed: 4101,
    nodes: [
      node(0, 95, 300, 1, 'Source S'),
      node(1, 210, 210),
      node(2, 215, 300),
      node(3, 210, 395),
      node(4, 330, 135),
      node(5, 340, 295),
      node(6, 330, 465),
      node(7, 450, 115),
      node(8, 450, 300),
      node(9, 450, 495),
      node(10, 570, 140),
      node(11, 560, 305),
      node(12, 570, 465),
      node(13, 690, 210),
      node(14, 690, 395),
      node(15, 805, 300, -1, 'Target T'),
    ],
    terrainPolygons: [
      [
        [375, 200],
        [525, 200],
        [525, 405],
        [375, 405],
      ],
    ],
  },
  {
    id: 'opt-mincost-flow',
    name: 'Capacitated Min-Cost Flow · LP',
    description: 'Primal-dual Physarum reroutes overflow around capped shortest-corridor edges.',
    domain: 'optimization',
    mode: 'delaunay',
    flowMode: 'source-sink',
    dynamicsMode: 'linear-lp',
    mu: 1.0,
    seed: 4102,
    nodes: [
      node(0, 110, 215, 0.6, 'Supply A'),
      node(1, 110, 385, 0.4, 'Supply B'),
      node(2, 275, 165),
      node(3, 285, 300),
      node(4, 275, 435),
      node(5, 450, 125),
      node(6, 450, 300),
      node(7, 450, 475),
      node(8, 625, 165),
      node(9, 615, 300),
      node(10, 625, 435),
      node(11, 795, 215, -0.5, 'Demand X'),
      node(12, 795, 385, -0.5, 'Demand Y'),
    ],
    capacities: [
      { i: 3, j: 6, capacity: 0.55 },
      { i: 6, j: 9, capacity: 0.55 },
    ],
  },
  {
    id: 'opt-crossbar',
    name: 'Resistor Crossbar · Analog Solver',
    description: '4x4 resistive crossbar routes currents around a defective high-R cell.',
    domain: 'optimization',
    mode: 'delaunay',
    flowMode: 'source-sink',
    dynamicsMode: 'linear-lp',
    mu: 1.0,
    seed: 4103,
    nodes: [
      node(0, 150, 130, 1, 'In 1'),
      node(1, 350, 124),
      node(2, 550, 136),
      node(3, 750, 130, -1, 'Out 1'),
      node(4, 146, 245),
      node(5, 355, 240),
      node(6, 545, 250),
      node(7, 754, 245),
      node(8, 154, 360),
      node(9, 346, 356),
      node(10, 555, 364),
      node(11, 746, 360),
      node(12, 150, 475, 1, 'In 2'),
      node(13, 352, 480),
      node(14, 548, 470),
      node(15, 750, 475, -1, 'Out 2'),
    ],
    terrainPolygons: [
      [
        [375, 105],
        [525, 105],
        [525, 270],
        [375, 270],
      ],
    ],
  },
  {
    id: 'fjsp-jewelry-atelier',
    name: 'Jewelry Atelier · 7-Stage Multi-Cell',
    description: 'Two-level multi-cell jewelry workflow: Upper Physarum flow + Lower non-overlapping FJSP Gantt.',
    domain: 'fjsp',
    mode: 'explicit',
    flowMode: 'source-sink',
    dynamicsMode: 'linear-lp',
    mu: 1.0,
    seed: 5101,
    nodes: JEWELRY_ATELIER_LAYOUT.nodes,
    explicitEdges: JEWELRY_ATELIER_LAYOUT.explicitEdges,
  },
  {
    id: 'fjsp-jewelry-rush',
    name: 'Bridal Pavé Rush · High-Bottleneck',
    description: '12-order bridal pavé batch stressing tight Micro-Pavé and 18K kiln capacities.',
    domain: 'fjsp',
    mode: 'explicit',
    flowMode: 'source-sink',
    dynamicsMode: 'linear-lp',
    mu: 1.0,
    seed: 5102,
    nodes: JEWELRY_RUSH_LAYOUT.nodes,
    explicitEdges: JEWELRY_RUSH_LAYOUT.explicitEdges,
  },
  {
    id: 'fjsp-jewelry-100po',
    name: '100-PO Factory · FG + SG Multi-Model',
    description: '100 heterogeneous POs (40 FG-Full, 35 FG-from-SG, 25 SG-Stock) with BOM links & due dates.',
    domain: 'fjsp',
    mode: 'explicit',
    flowMode: 'source-sink',
    dynamicsMode: 'linear-lp',
    mu: 1.0,
    seed: 5103,
    nodes: JEWELRY_100PO_LAYOUT.nodes,
    explicitEdges: JEWELRY_100PO_LAYOUT.explicitEdges,
  },
  {
    id: 'fjsp-jewelry-erp',
    name: 'ERP Master Scheduler · SO→PO + MRP + Cash Flow',
    description: '20 SOs / 80 POs with 560m/day shifts, SG→Warehouse→Assembly→FG round-trip, MRP gating, and daily Cash Flow.',
    domain: 'fjsp',
    mode: 'explicit',
    flowMode: 'source-sink',
    dynamicsMode: 'linear-lp',
    mu: 1.0,
    seed: 5104,
    nodes: JEWELRY_ERP_LAYOUT.nodes,
    explicitEdges: JEWELRY_ERP_LAYOUT.explicitEdges,
  },
];

export function getPreset(id: string): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}
