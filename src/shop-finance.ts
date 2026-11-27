import { cents } from './shop-materials';
import { gramsPerPiece, metalPrice, stockCatalog } from './shop-orders';
import { limitedGold, workDay, type ShopPlan } from './shop-plan';

export const overheadPerDay = 150;
export type GoldPaymentTerms = 'upfront' | 'delivery';

export function shopAccounts(plan: ShopPlan, goldPaymentTerms: GoldPaymentTerms = 'upfront') {
  const { orders, bookings, materials, settings } = plan;
  const firstDay = new Map<string, number>();
  for (const b of bookings) {
    for (const member of b.members) {
      const key = member.po + '/' + b.stage;
      firstDay.set(key, Math.min(firstDay.get(key) ?? Infinity, workDay(b.start)));
    }
  }
  const materialPurchases = materials.receipts.map(receipt => ({
    ...receipt,
    paymentDay: receipt.item === limitedGold && goldPaymentTerms === 'delivery' ? receipt.arrivalDay : receipt.orderDay,
  }));
  const toolPurchases = plan.moldBuys.map(receipt => ({ ...receipt, paymentDay: receipt.orderDay }));
  const purchases = [...materialPurchases, ...toolPurchases];
  const issues = materials.issues.map(issue => {
    const day = firstDay.get(issue.po + '/' + issue.stage);
    if (!day || day < issue.availableDay) throw new Error('Material unavailable for ' + issue.po + ' ' + issue.item);
    return { ...issue, day };
  });
  const sales = orders.filter(po => !po.stock).map(po => {
    // Illustrative wholesale pricing. Stock mountings are internal intermediates.
    const unitPrice = cents(1.35 * metalPrice(po.metal) * gramsPerPiece + (po.stages.includes('set') ? 55 : 32));
    const value = cents(unitPrice * po.pieces);
    const deposit = cents(value * settings.depositPct / 100);
    return { po: po.id, orderDay: po.releaseDay, qty: po.pieces, unitPrice, value, deposit,
      balance: cents(value - deposit), shipDay: workDay(po.ready - 0.000001),
      collectDay: workDay(po.ready - 0.000001) + settings.collectionDays };
  });
  const shopDays = Math.max(...orders.map(po => workDay(po.ready - 0.000001)));
  const horizon = Math.max(shopDays, ...sales.map(s => s.collectDay), ...purchases.map(p => p.arrivalDay));
  const daily = Array.from({ length: horizon }, (_, i) => ({
    day: i+1, deposits: 0, balances: 0, materials: 0, goldPaid: 0, tooling: 0, labor: 0,
    overhead: i < shopDays ? overheadPerDay : 0, net: 0, closing: 0,
  }));
  for (const sale of sales) {
    daily[sale.orderDay-1].deposits += sale.deposit;
    daily[sale.collectDay-1].balances += sale.balance;
  }
  for (const purchase of materialPurchases) {
    const day = daily[purchase.paymentDay-1];
    day.materials += purchase.cost;
    if (purchase.item === limitedGold) day.goldPaid += purchase.cost;
  }
  for (const purchase of toolPurchases) daily[purchase.paymentDay-1].tooling += purchase.cost;
  for (const b of bookings) {
    daily[workDay(b.start)-1].labor += (b.end-b.start) * settings.wagePerHour / 60;
  }
  let closing = settings.startingCash;
  let minCash = closing;
  let minDay = 0;
  for (const row of daily) {
    row.deposits = cents(row.deposits); row.balances = cents(row.balances);
    row.labor = cents(row.labor); row.materials = cents(row.materials); row.tooling = cents(row.tooling);
    row.goldPaid = cents(row.goldPaid);
    row.net = cents(row.deposits + row.balances - row.materials - row.tooling - row.labor - row.overhead);
    closing = cents(closing + row.net);
    row.closing = closing;
    if (closing < minCash) { minCash = closing; minDay = row.day; }
  }
  const stock = stockCatalog.map(item => {
    const received = materials.receipts.filter(r => r.item === item.id);
    const withdrawals = issues.filter(r => r.item === item.id);
    let balance = item.starting;
    const ledger = daily.map(({ day }) => {
      const qtyIn = received.filter(r => r.arrivalDay === day).reduce((a,b) => a + b.qty, 0);
      const qtyOut = withdrawals.filter(r => r.day === day).reduce((a,b) => a + b.qty, 0);
      const opening = balance;
      const afterReceipt = opening + qtyIn;
      if (item.id === limitedGold && plan.goldCapacity !== undefined && afterReceipt > plan.goldCapacity) {
        throw new Error('Gold storage capacity exceeded at opening on day ' + day);
      }
      balance = afterReceipt - qtyOut;
      if (balance < 0) throw new Error('Stockout on day ' + day + ': ' + item.id);
      return { day, opening, received: qtyIn, afterReceipt, issued: qtyOut, closing: balance };
    });
    return { ...item, demand: withdrawals.reduce((a,b) => a+b.qty, 0),
      purchased: received.reduce((a,b) => a+b.qty, 0), closing: balance, ledger };
  }).filter(item => item.demand > 0);
  const byId = new Map(orders.map(po => [po.id, po]));
  const mountingMoves = orders.flatMap(po => {
    if (po.stock) return [{ metal: po.metal, day: workDay(po.ready-0.000001), received: po.pieces, issued: 0 }];
    if (!po.feedsFrom) return [];
    const feeder = byId.get(po.feedsFrom)!;
    return [{ metal: feeder.metal, day: firstDay.get(po.id+'/'+po.stages[0])!, received: 0, issued: po.pieces }];
  });
  const mountings = Array.from(new Set(mountingMoves.map(m => m.metal))).flatMap(metal => {
    let balance = 0;
    return daily.map(({day}) => {
      const moves = mountingMoves.filter(m => m.metal === metal && m.day === day);
      const received = moves.reduce((n,m) => n+m.received,0);
      const issued = moves.reduce((n,m) => n+m.issued,0);
      balance += received-issued;
      if (balance < 0) throw new Error('Mounting stockout on day '+day+' for '+metal);
      return { metal, day, received, issued, closing: balance };
    }).filter(row => row.received || row.issued);
  });
  const minimumOpeningCash = cents(settings.startingCash - minCash);
  const additionalCash = Math.max(0, -minCash);
  return { daily, stock, mountings, sales, issues, purchases, shopDays, minDay, minCash, closing,
    goldPaymentTerms, minimumOpeningCash, additionalCash };
}
export type ShopAccounts = ReturnType<typeof shopAccounts>;
