'use client';
import {useEffect,useMemo,useState} from 'react';
import {pickupForOrder} from '@/src/lib/pickup-snapshot';
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'?v as Row:{};
const date=(v:unknown)=>v?new Date(String(v)).toLocaleString('fi-FI',{timeZone:'Europe/Helsinki'}):'Not recorded';
export default function RiderDeliveryHistory({deliveries}:{deliveries:Row[]}){
 const [visible,setVisible]=useState(5);
 const sorted=useMemo(()=>[...deliveries].sort((a,b)=>new Date(String(b.deliveredTime??b.updatedAt??b.createdAt)).getTime()-new Date(String(a.deliveredTime??a.updatedAt??a.createdAt)).getTime()),[deliveries]);
 // Keep notification deep links usable even when the matching row is beyond page one.
 useEffect(()=>{const reveal=()=>{const id=window.location.hash.slice(1);const index=sorted.findIndex(d=>`rider-order-${row(d.order).id}`===id);if(index>=0){setVisible(n=>Math.max(n,index+1));requestAnimationFrame(()=>{const element=document.getElementById(id);if(element instanceof HTMLDetailsElement){element.open=true;element.scrollIntoView({block:'start'});}});}};const timer=setTimeout(reveal,0);window.addEventListener('hashchange',reveal);return()=>{clearTimeout(timer);window.removeEventListener('hashchange',reveal);};},[sorted]);
 return <section className="workspace-section" id="delivery-history"><div className="workspace-section-heading"><div><h2>Delivery history</h2><p className="workspace-muted">{sorted.length} past deliveries · Open a row for details.</p></div></div>
 <div className="compact-delivery-history">{sorted.slice(0,visible).map(d=>{const order=row(d.order),kitchen=pickupForOrder(order,row(order.shop)),address=row(order.address);return <details key={String(d.id)} id={`rider-order-${order.id}`} className="delivery-history-row"><summary><span className="history-order"><strong>{String(order.orderNumber??'Order')}</strong><small>{String(kitchen.name??'Kitchen')}</small></span><time>{date(d.deliveredTime??d.updatedAt??d.createdAt)}</time><span className="ops-badge" data-state={String(d.status).toLowerCase()}>{d.status==='DELIVERED'?'Delivered':'Issue reported'}</span><span className="history-expand" aria-hidden="true">⌄</span></summary><div className="history-details"><p>{(Array.isArray(order.items)?order.items:[]).map((i:Row)=>`${i.quantity} × ${i.name}`).join(' · ')}</p><dl><div><dt>Pickup</dt><dd>{String(kitchen.name??'')} · {String(kitchen.address??'Not recorded')}</dd></div><div><dt>Delivered to</dt><dd>{[address.addressLine1,address.addressLine2,address.postalCode,address.city].filter(Boolean).join(', ')||'Not recorded'}</dd></div><div><dt>Collected</dt><dd>{date(d.pickedUpTime)}</dd></div><div><dt>{d.status==='DELIVERED'?'Delivered':'Last update'}</dt><dd>{date(d.deliveredTime??d.updatedAt)}</dd></div></dl></div></details>;})}</div>
 {!sorted.length&&<p className="workspace-muted">Completed deliveries will appear here.</p>}
 {sorted.length>5&&<div className="workspace-actions history-pagination"><span>Showing {Math.min(visible,sorted.length)} of {sorted.length}</span>{visible<sorted.length&&<button onClick={()=>setVisible(n=>n+5)}>Show 5 more</button>}{visible>5&&<button onClick={()=>setVisible(5)}>Show fewer</button>}</div>}
 </section>;
}
