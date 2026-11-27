import { build300PoJewelryBatch } from './mixed-orders';
import { MATERIAL_CATALOG } from './mrp';

export const PO_PIECES = 20;
export const DAY = 1440;
export const metals = ['18K-Y', '18K-R', '925', 'Bronze', 'Brass'] as const;
export type Metal = typeof metals[number];
export type Stage = 'wax' | 'cast' | 'file' | 'tumble' | 'pre-polish' | 'set' | 'polish' | 'plate' | 'qc';
export type LaborStage = 'file' | 'pre-polish' | 'set' | 'polish' | 'qc';
export const isGold = (metal: Metal) => metal === '18K-Y' || metal === '18K-R';
export const stageLabel: Record<Stage, string> = {
  wax: 'Wax injection', cast: 'Casting', file: 'Filing', tumble: 'Tumbling', 'pre-polish': 'Pre-polishing',
  set: 'Stone setting', polish: 'Polishing', plate: 'Plating', qc: 'QC',
};

export interface ShopOrder {
  id: string; model: string; metal: Metal; pieces: number; releaseDay: number;
  stages: Stage[]; rates: Partial<Record<LaborStage, number>>;
  feedsFrom?: string; stock: boolean; mold?: string; announcedAt?: number;
}

export function shopOrders(): ShopOrder[] {
  const base = build300PoJewelryBatch(true);
  return base.map((job, index) => {
    const family = Math.floor(index / 50);
    const lot = index % 50;
    let metal: Metal = job.alloy as Metal;
    if (family < 2) metal = (['925', 'Bronze', 'Brass'] as const)[Math.floor(lot / 2) % 3];
    if (family === 2 || family === 5) metal = lot % 3 === 0 ? '925' : '18K-Y';
    const stages: Stage[] = [];
    const rates: ShopOrder['rates'] = {};
    for (const op of job.ops) {
      const stage = op.stage as Stage;
      stages.push(stage);
      if (['file', 'polish', 'pre-polish', 'set', 'qc'].includes(stage)) {
        rates[stage as LaborStage] = Object.values(op.durations)[0];
      }
      if (stage === 'file' && (family === 1 || family === 3)) stages.push('tumble');
    }
    return {
      id: job.id, model: job.name, metal, pieces: PO_PIECES, releaseDay: 1 + Math.floor(lot / 25),
      stages, rates, feedsFrom: job.dependsOnJobId, stock: job.poType === 'SG-STOCK',
      mold: job.ops.find(op => op.waxMold)?.waxMold?.id,
    };
  });
}

export interface StockItem {
  id: string; unit: string; price: number; starting: number; buyLot: number; lead: number;
}

const prices: Record<Metal, number> = {
  '18K-Y': MATERIAL_CATALOG['AU-18KY'].unitCostUsd, '18K-R': MATERIAL_CATALOG['AU-18KR'].unitCostUsd,
  '925': MATERIAL_CATALOG['AG-925'].unitCostUsd, Bronze: 0.08, Brass: 0.07,
};
export const metalPrice = (metal: Metal) => prices[metal];
export const gramsPerPiece = 4;
export const stockCatalog: StockItem[] = [
  ...metals.map(metal => ({ id: metal + ' grain', unit: 'g', price: prices[metal], starting: 800, buyLot: 400, lead: 2 })),
  ...metals.map(metal => ({
    id: metal + ' blank', unit: 'pc', price: prices[metal] * gramsPerPiece + 2, starting: 120, buyLot: 100, lead: 1,
  })),
  { id: 'Injection wax', unit: 'g', price: 0.05, starting: 2000, buyLot: 1000, lead: 1 },
  { id: 'Setting stones', unit: 'pc', price: 1.5, starting: 500, buyLot: 250, lead: 2 },
  { id: 'Plating consumable', unit: 'dose', price: 0.25, starting: 500, buyLot: 250, lead: 1 },
  { id: 'Tumbling compound', unit: 'dose', price: 0.04, starting: 400, buyLot: 200, lead: 1 },
];

export interface Requirement { item: string; stage: Stage; qty: number }
export function billOfMaterials(po: ShopOrder): Requirement[] {
  const out: Requirement[] = [];
  if (po.stages.includes('wax')) {
    out.push({ item: 'Injection wax', stage: 'wax', qty: po.pieces },
      { item: po.metal + ' grain', stage: 'cast', qty: gramsPerPiece * po.pieces });
  } else if (!po.feedsFrom) {
    out.push({ item: po.metal + ' blank', stage: po.stages[0], qty: po.pieces });
  }
  if (po.stages.includes('set')) out.push({ item: 'Setting stones', stage: 'set', qty: po.pieces });
  if (po.stages.includes('plate')) out.push({ item: 'Plating consumable', stage: 'plate', qty: po.pieces });
  if (po.stages.includes('tumble')) out.push({ item: 'Tumbling compound', stage: 'tumble', qty: po.pieces });
  return out;
}
