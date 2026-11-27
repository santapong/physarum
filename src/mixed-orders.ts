import type { AlloyType, JewelryJobSpec, JewelryOpSpec, PoKind } from './fjsp';
import { createRandom } from './random';
import { shotsForLot, type WaxMoldRun } from './wax-molds';

interface ModelRoute {
  name: string;
  alloy: AlloyType;
  poType: PoKind;
  ops: JewelryOpSpec[];
  needsStockMounting?: boolean;
  mold?: Omit<WaxMoldRun, 'pieces'>;
}

const file: JewelryOpSpec = { stage: 'file', durations: { 'file-1': 2, 'file-2': 2 } };
const polish: JewelryOpSpec = { stage: 'polish', durations: { 'polish-a': 6, 'polish-b': 8 } };
const plate: JewelryOpSpec = { stage: 'plate', durations: { 'plate-1': 11, 'plate-2': 13 } };
const qc: JewelryOpSpec = { stage: 'qc', durations: { 'qc-1': 3 } };
const wax: JewelryOpSpec = { stage: 'wax', durations: { 'wax-1': 14, 'wax-2': 16 } };
const castGold: JewelryOpSpec = { stage: 'cast', durations: { 'cast-18k': 35, 'cast-flex': 39 } };
const setProng: JewelryOpSpec = { stage: 'set', durations: { 'set-prong': 23, 'set-pave': 27 } };

const models: ModelRoute[] = [
  { name: 'Plain cast band', alloy: '925', poType: 'FG-FROM-SG', ops: [file, polish, qc] },
  { name: 'Plated cast band', alloy: '925', poType: 'FG-FROM-SG', ops: [file, polish, plate, qc] },
  { name: 'Prong ring from mounting', alloy: '18K-Y', poType: 'FG-FROM-SG',
    ops: [setProng, polish, qc], needsStockMounting: true },
  { name: 'Cast solitaire', alloy: '18K-Y', poType: 'FG-FULL',
    mold: { id: 'Solitaire', cavities: 2, remainingShots: 100 },
    ops: [wax, castGold, file, setProng, polish, plate, qc] },
  { name: 'Pavé halo', alloy: '18K-R', poType: 'FG-FULL',
    mold: { id: 'Halo', cavities: 1, remainingShots: 150 }, ops: [
    wax, castGold,
    { stage: 'pre-polish', durations: { 'polish-a': 13, 'polish-b': 15 }, reentrant: true },
    { stage: 'set', durations: { 'set-pave': 40 } },
    { ...polish, reentrant: true }, plate, qc,
  ] },
  { name: 'Stock mounting', alloy: '18K-Y', poType: 'SG-STOCK',
    mold: { id: 'Mounting', cavities: 4, remainingShots: 65 }, ops: [wax, castGold, file] },
];

const ordersPerModel = 50;
const poId = (number: number) => `PO-${String(number).padStart(3, '0')}`;

/** Synthetic traveler times in minutes. Each PO gets its own duration map for every operation. */
export function build300PoJewelryBatch(useHaloSpare = false): JewelryJobSpec[] {
  const rng = createRandom(5105);
  const stockStart = models.findIndex(model => model.poType === 'SG-STOCK') * ordersPerModel;
  return models.flatMap((model, modelIndex) => Array.from({ length: ordersPerModel }, (_, lot) => {
    const number = modelIndex * ordersPerModel + lot + 1;
    const releaseMin = lot * 42 + Math.floor(rng() * 36);
    const ops = model.ops.map(op => {
      // The first two plain rings illustrate different filing times on identical equipment.
      let extraMin = Math.floor(rng() * 6);
      if (op.stage === 'file' && number <= 2) extraMin = number === 1 ? 3 : 0;
      const waxMold = op.stage === 'wax' && model.mold ? { ...model.mold, pieces: 1 + lot % 5 } : undefined;
      if (useHaloSpare && waxMold?.id === 'Halo') {
        waxMold.remainingShots = 90;
        waxMold.spare = { id: 'Halo spare', remainingShots: 60 };
      }
      const shots = waxMold ? shotsForLot(waxMold.pieces, waxMold.cavities) : 1;
      const durations = Object.fromEntries(
        Object.entries(op.durations).map(([cell, minutes]) => [cell, (minutes + extraMin) * shots]),
      );
      return waxMold ? { ...op, durations, waxMold } : { ...op, durations };
    });
    return {
      id: poId(number),
      name: model.name,
      modelType: model.name,
      poType: model.poType,
      alloy: model.alloy,
      releaseMin,
      dueMin: releaseMin + 440 + Math.floor(rng() * 500),
      priority: 1 + Math.floor(rng() * 3),
      ...(model.needsStockMounting ? { dependsOnJobId: poId(stockStart + lot + 1) } : {}),
      ops,
    };
  }));
}
