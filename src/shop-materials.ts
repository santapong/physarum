import { billOfMaterials, DAY, stockCatalog, type ShopOrder, type Stage } from './shop-orders';

export interface Receipt {
  item: string; qty: number; orderDay: number; arrivalDay: number; cost: number;
  triggerPo?: string; plannedStartDay?: number; needDay?: number;
}
export type PurchasingPolicy = 'early' | 'po-start';
export interface PurchaseTargets {
  pos: Map<string, { startDay: number; stageDays: Partial<Record<Stage, number>> }>;
  molds: Map<string, { po: string; needDay: number }>;
}
export interface Issue { po: string; item: string; stage: Stage; qty: number; availableDay: number }
export const cents = (value: number) => Math.round(value * 100) / 100;

export function procure(orders: ShopOrder[], targets?: PurchaseTargets) {
  const receipts: Receipt[] = [];
  const issues: Issue[] = [];
  const gates = new Map<string, number>();
  const requirements = orders.flatMap(po => billOfMaterials(po).map(need => {
    const target = targets?.pos.get(po.id);
    return { po, need, startDay: target?.startDay, needDay: target?.stageDays[need.stage] ?? po.releaseDay };
  }));
  // Earlier commitments retain their allocation when an unexpected order arrives.
  requirements.sort((a,b) => (a.po.announcedAt ?? 0) - (b.po.announcedAt ?? 0) ||
    a.needDay - b.needDay || a.po.releaseDay - b.po.releaseDay || a.po.id.localeCompare(b.po.id));
  for (const item of stockCatalog) {
    const lots = [{ day: 1, left: item.starting }];
    for (const {po, need, startDay, needDay} of requirements.filter(r => r.need.item === item.id)) {
      const knownDay = 1 + Math.floor((po.announcedAt ?? 0) / DAY);
      const orderDay = Math.max(knownDay, startDay ?? 1, needDay - item.lead);
      const arrivalDay = orderDay + item.lead;
      let remaining = need.qty;
      let availableDay = 1;
      for (const lot of lots) {
        if (startDay !== undefined && lot.day > arrivalDay) continue;
        const take = Math.min(remaining, lot.left);
        if (take > 0) availableDay = Math.max(availableDay, lot.day);
        remaining -= take;
        lot.left -= take;
        if (!remaining) break;
      }
      if (remaining) {
        const qty = Math.ceil(remaining / item.buyLot) * item.buyLot;
        receipts.push({item:item.id, qty, orderDay, arrivalDay, cost:cents(qty*item.price),
          triggerPo:po.id, plannedStartDay:startDay, needDay});
        lots.push({day:arrivalDay, left:qty-remaining});
        availableDay = Math.max(availableDay, arrivalDay);
      }
      const key = po.id + '/' + need.stage;
      gates.set(key, Math.max(gates.get(key) ?? 0, (availableDay - 1) * DAY));
      issues.push({po:po.id, item:item.id, stage:need.stage, qty:need.qty, availableDay});
    }
  }
  return { receipts, issues, gates };
}

// Order commitments keep their original release date. Only lots that fit
// at opening may enter the store; stock issued later frees room for the next day.
export class LimitedStore {
  readonly delivered: Receipt[] = [];
  private day = 0;
  private balance: number;
  private next = 0;
  private readonly supply: Receipt[];
  private readonly lot: number;
  private readonly onShelf: {day: number; qty: number}[];
  private oldest = 0;

  constructor(readonly item: typeof stockCatalog[number], readonly capacity: number, purchased: Receipt[]) {
    if (!Number.isSafeInteger(capacity) || capacity < item.starting || capacity < item.buyLot) {
      throw new Error(item.id + ' capacity must fit opening stock and a supplier lot.');
    }
    this.balance = item.starting;
    this.onShelf = [{day:1, qty:item.starting}];
    this.lot = item.buyLot;
    this.supply = purchased.filter(r => r.item === item.id).map(r => ({...r})).sort((a,b)=>a.arrivalDay-b.arrivalDay);
  }

  openThrough(day: number) {
    while (this.day < day) {
      this.day++;
      while (this.next < this.supply.length) {
        const shipment = this.supply[this.next];
        if (shipment.arrivalDay > this.day) break;
        const space = Math.floor((this.capacity - this.balance) / this.lot) * this.lot;
        const qty = Math.min(space, shipment.qty);
        if (!qty) break;
        this.delivered.push({...shipment, qty, arrivalDay:this.day, cost:cents(qty*this.item.price)});
        this.balance += qty;
        this.onShelf.push({day:this.day, qty});
        shipment.qty -= qty;
        if (!shipment.qty) this.next++;
      }
    }
  }

  issue(earliestDay: number, qty: number): { day: number; availableDay: number } {
    if (qty > this.capacity) throw new Error('PO requirement exceeds storage capacity for '+this.item.id);
    this.openThrough(earliestDay);
    while (this.balance < qty) {
      const next = this.supply[this.next];
      if (!next || this.capacity - this.balance < this.lot) throw new Error('No receivable lot for '+this.item.id);
      this.openThrough(Math.max(this.day+1,next.arrivalDay));
    }
    this.balance -= qty;
    let left = qty;
    let availableDay = 1;
    while (left > 0) {
      const lot = this.onShelf[this.oldest];
      const take = Math.min(lot.qty, left);
      if (take > 0) availableDay = lot.day;
      lot.qty -= take;
      left -= take;
      if (!lot.qty) this.oldest++;
    }
    return { day:this.day, availableDay };
  }

  finish() {
    while (this.next < this.supply.length) {
      if (this.capacity-this.balance < this.lot) throw new Error('No space for the final prepaid lot of '+this.item.id);
      this.openThrough(Math.max(this.day+1,this.supply[this.next].arrivalDay));
    }
  }
}
