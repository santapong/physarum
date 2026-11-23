import type { FlowMode, GraphMode, Node } from './graph';

export interface Preset {
  id: string;
  name: string;
  description: string;
  mode: GraphMode;
  flowMode?: FlowMode;
  mu?: number;
  seed: number;
  nodes: Node[];
  terrainPolygons?: Array<Array<[number, number]>>;
}

const node = (id: number, x: number, y: number, flow = 0, label?: string): Node =>
  label ? { id, x, y, flow, label } : { id, x, y, flow };

export const PRESETS: Preset[] = [
  {
    id: 'direct-route',
    name: 'Direct route',
    description: 'One origin, one destination, and competing paths.',
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
];

export function getPreset(id: string): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}
