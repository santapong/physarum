import type { GraphMode, Node } from './graph';

export interface Preset {
  id: string;
  name: string;
  description: string;
  mode: GraphMode;
  seed: number;
  nodes: Node[];
}

const node = (id: number, x: number, y: number, flow = 0): Node => ({ id, x, y, flow });

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
];

export function getPreset(id: string): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}

