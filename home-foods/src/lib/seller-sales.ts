type Sale = {status?:unknown;isSandbox?:unknown;payment?:unknown};
/** Collected order payments, not seller payouts or profit. Sum in cents. */
export function sellerSales(orders:Sale[]) {
 let collectedCents=0,testCents=0,paidOrders=0,unpaidOrders=0;
 for(const order of orders){
  if(order.status!=='DELIVERED')continue;
  const payment=order.payment as {status?:string;amount?:unknown;currency?:string}|null;
  const amount=Number(payment?.amount);
  if(payment?.status!=='PAID'||!Number.isFinite(amount)||amount<0||(payment.currency&&payment.currency!=='EUR')){unpaidOrders++;continue;}
  if(order.isSandbox){testCents+=Math.round(amount*100);continue;}
  collectedCents+=Math.round(amount*100);paidOrders++;
 }
 return {collected:collectedCents/100,testCollected:testCents/100,paidOrders,unpaidOrders,completed:orders.filter(o=>o.status==='DELIVERED').length};
}
