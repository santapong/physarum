import { describe, expect, it } from 'vitest';
import { arrivalTrial, trialDefaults, unexpectedOrder } from './shop-arrival';
import { shopAccounts } from './shop-finance';
import { procure, type PurchaseTargets } from './shop-materials';
import { DAY, shopOrders, stockCatalog } from './shop-orders';
import { defaults, limitedGold, workDay } from './shop-plan';

const orders = shopOrders();
const staged = arrivalTrial(defaults,orders,unexpectedOrder(),trialDefaults,'po-start');
const accounts = shopAccounts(staged.updated,'delivery');
const early = shopAccounts(arrivalTrial(defaults,orders,unexpectedOrder()).updated,'delivery');

describe('purchasing from each production order’s planned start',()=>{
  it('nets opening stock, buys early-stage shortages at PO start, and buys later-stage shortages at lead-time offset',()=>{
    const cast = {...orders[150], pieces:3000, releaseDay:1};
    const targets: PurchaseTargets = {pos:new Map([[cast.id,{
      startDay:6, stageDays:{wax:6,cast:8,set:15,plate:18,tumble:12},
    }]]),molds:new Map()};
    const supply = procure([cast],targets);
    const wax = supply.receipts.find(r=>r.item==='Injection wax')!;
    expect(wax).toMatchObject({qty:1000,orderDay:6,arrivalDay:7,triggerPo:cast.id,plannedStartDay:6,needDay:6});
    expect(supply.gates.get(cast.id+'/wax')).toBe(6*DAY);
    expect(supply.receipts.find(r=>r.item==='Setting stones')).toMatchObject({qty:2500,orderDay:13,arrivalDay:15});
    expect(supply.receipts.find(r=>r.item==='Plating consumable')).toMatchObject({qty:2500,orderDay:17,arrivalDay:18});
    expect(procure([{...cast,pieces:1}],targets).receipts).toHaveLength(0);
  });

  it('preserves committed work and supplier releases when PO-301 is announced, with no retrospective orders',()=>{
    const cutoff=staged.report.at;
    expect(staged.updated.bookings.filter(b=>b.start<cutoff)).toEqual(staged.capped.bookings.filter(b=>b.start<cutoff));
    const prior=shopAccounts(staged.capped,'delivery');
    expect(accounts.daily.slice(0,2)).toEqual(prior.daily.slice(0,2));
    const paidBefore = (p: typeof accounts)=>p.purchases.filter(r=>r.orderDay<3);
    expect(paidBefore(accounts)).toEqual(paidBefore(prior));
    const rush=accounts.purchases.filter(p=>p.triggerPo==='PO-301');
    expect(rush.length).toBeGreaterThan(0);
    for (const r of rush) expect(r.orderDay).toBeGreaterThanOrEqual(workDay(cutoff));
    for (const r of accounts.purchases) {
      expect(r.orderDay).toBeGreaterThanOrEqual(r.plannedStartDay!);
      const lead=stockCatalog.find(item=>item.id===r.item)?.lead ?? 2;
      expect(r.orderDay).toBeGreaterThanOrEqual(r.needDay!-lead);
      expect(r.arrivalDay).toBeGreaterThanOrEqual(r.orderDay+lead);
    }
  });

  it('replans work against actual receipts, retains stock limits and reconciles shipments and cash across the run',()=>{
    const qtyByStage=new Map<string,number>();
    const firstDay=new Map<string,number>();
    const end=new Map<string,number>();
    const reservations=new Map<string,{start:number;end:number}[]>();
    for(const b of staged.updated.bookings){
      for(const id of b.mold ? [b.resource,b.mold] : [b.resource]){
        const rows=reservations.get(id)??[]; rows.push(b);reservations.set(id,rows);
      }
      for (const m of b.members){
        const key=m.po+'/'+b.stage;
        qtyByStage.set(key,(qtyByStage.get(key)??0)+m.qty);
        firstDay.set(key,Math.min(firstDay.get(key)??Infinity,workDay(b.start)));
        end.set(key,Math.max(end.get(key)??0,b.end));
      }
    }
    for (const rows of reservations.values()) {
      rows.sort((a,b)=>a.start-b.start);
      for(let i=1;i<rows.length;i++) expect(rows[i].start).toBeGreaterThanOrEqual(rows[i-1].end-1e-6);
    }
    for(const po of staged.updated.orders) {
      for (const stage of po.stages) expect(qtyByStage.get(po.id+'/'+stage)).toBe(po.pieces);
      expect(end.get(po.id+'/'+po.stages[po.stages.length-1])).toBe(po.ready);
    }
    for(const issue of accounts.issues){
      expect(issue.day).toBe(firstDay.get(issue.po+'/'+issue.stage));
      expect(issue.day).toBeGreaterThanOrEqual(issue.availableDay);
    }
    const gold=accounts.stock.find(s=>s.id===limitedGold)!;
    expect(gold.ledger.every(d=>d.afterReceipt<=2000&&d.closing>=0)).toBe(true);
    expect(new Set(accounts.purchases.map(r=>r.orderDay)).size).toBeGreaterThan(2);
    expect(new Set(accounts.purchases.map(r=>r.arrivalDay)).size).toBeGreaterThan(4);
    expect(accounts.sales.reduce((n,s)=>n+s.qty,0)).toBe(5020);
    expect(accounts.sales.every(s=>s.shipDay===workDay(end.get(s.po+'/qc')!-1e-6))).toBe(true);
    expect(accounts.purchases.reduce((n,p)=>n+p.cost,0)).toBeCloseTo(early.purchases.reduce((n,p)=>n+p.cost,0),2);
    expect(accounts.daily.reduce((n,d)=>n+d.materials+d.tooling,0)).toBeCloseTo(accounts.purchases.reduce((n,p)=>n+p.cost,0),2);
    expect(accounts.additionalCash).toBe(203030.07);
  });
});
