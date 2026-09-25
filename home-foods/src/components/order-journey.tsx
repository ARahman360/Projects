"use client";
type Event = {status?:unknown;domain?:unknown;createdAt?:unknown};
const stages=[['PENDING','Order placed'],['CONFIRMED','Accepted'],['PREPARING','Preparing'],['READY_FOR_PICKUP','Ready'],['ACCEPTED','Rider assigned'],['PICKED_UP','Picked up'],['IN_TRANSIT','On the way'],['DELIVERED','Delivered']];
export default function OrderJourney({orderStatus,deliveryStatus,events}:{orderStatus:string;deliveryStatus:string;events:Event[]}){
 const stopped=['CANCELLED','REFUNDED'].includes(orderStatus)||deliveryStatus==='FAILED';
 const kitchenIndex=stages.slice(0,4).findIndex(([s])=>s===orderStatus);
 const deliveryIndex=deliveryStatus==='ASSIGNED'?4:stages.findIndex(([s],i)=>i>=4&&s===deliveryStatus);
 const current=orderStatus==='DELIVERED'?7:Math.max(0,kitchenIndex,deliveryIndex);
 return <ol className="order-journey" aria-label="Order progress">{stages.map(([status,label],i)=>{const event=events.find(e=>e.status===status&&(i<4?e.domain!=='DELIVERY':e.domain==='DELIVERY'));const done=!stopped&&(i<current||current===7);return <li key={label} className={stopped?'is-upcoming':done?'is-done':i===current?'is-current':'is-upcoming'} aria-current={!stopped&&i===current?'step':undefined}><span aria-hidden="true">{done?'✓':i+1}</span><b>{label}</b><small>{event?.createdAt?new Date(String(event.createdAt)).toLocaleTimeString('fi-FI',{hour:'2-digit',minute:'2-digit'}):stopped?'Not completed':done?'Complete':i===current?'Current stage':'Upcoming'}</small></li>})}</ol>;
}
