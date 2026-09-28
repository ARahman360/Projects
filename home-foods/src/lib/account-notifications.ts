import {db} from '@/src/prisma/db';
import type {Session} from './auth';
import {orderNotification} from './notification-content';
type Event={key:string;title:string;message:string;href:string;kind:string;createdAt:string};
const label=(s:string)=>s.replaceAll('_',' ').replaceAll('-',' ').toLowerCase();
export async function syncAccountNotifications(session:Session){
 const events:Event[]=[];
 const shops=session.role==='SELLER'?await db.orm.public.Shop.where({sellerId:session.userId}).all():[];
 const rider=session.role==='RIDER'?await db.orm.public.Rider.where({userId:session.userId}).first():null;
 const deliveries=rider?await db.orm.public.Delivery.where({riderId:rider.id}).orderBy(d=>d.createdAt.desc()).limit(100).all():[];
 const orders=session.role==='CUSTOMER'?await db.orm.public.Order.where({customerId:session.userId}).orderBy(o=>o.createdAt.desc()).limit(100).all():session.role==='SELLER'&&shops.length?await db.orm.public.Order.where(o=>o.shopId.in(shops.map(s=>s.id))).orderBy(o=>o.createdAt.desc()).limit(100).all():deliveries.length?await db.orm.public.Order.where(o=>o.id.in(deliveries.map(d=>d.orderId))).all():[];
 if(orders.length){
  const history=await db.orm.public.OrderStatusEvent.where(e=>e.orderId.in(orders.map(o=>o.id))).orderBy(e=>e.createdAt.desc()).limit(300).all();
  for(const event of history){
   const order=orders.find(o=>o.id===event.orderId)!;
   if(session.role==='RIDER'&&!['ASSIGNED','ACCEPTED','CANCELLED','FAILED','DELAYED','DELIVERED'].includes(event.status))continue;
   const message=session.role==='CUSTOMER'?(orderNotification(event.status,'Your kitchen')??(event.status==='ASSIGNED'?'A rider has been assigned to your order.':null)):event.status==='PENDING'?'A new customer order is waiting.':`Order ${order.orderNumber}: ${label(event.status)}.`;
   if(message)events.push({key:`order:${event.id}`,title:`${order.orderNumber} · ${label(event.status)}`,message,href:session.role==='CUSTOMER'?`/orders#order-${order.id}`:`/workspace#${session.role==='SELLER'?'seller-order':'rider-order'}-${order.id}`,kind:'order',createdAt:event.createdAt});
  }
 }
 if(session.role==='SELLER'||session.role==='RIDER'){
  const audits=await db.orm.public.AdminAuditLog.orderBy(a=>a.createdAt.desc()).limit(300).all();
  for(const a of audits)if((a.entityType==='KITCHEN'&&shops.some(s=>s.id===a.entityId))||(a.entityType===session.role&&a.entityId===session.userId))events.push({key:`audit:${a.id}`,title:label(a.action),message:a.reason,href:session.role==='SELLER'?'/workspace#kitchen-settings':'/workspace#profile',kind:'account',createdAt:a.createdAt});
 }
 for(const d of deliveries)events.push({key:`assignment:${d.id}`,title:'Delivery assignment',message:'Review your assigned delivery and pickup details.',href:`/workspace#rider-order-${d.orderId}`,kind:'delivery',createdAt:d.createdAt});
 if(session.role==='ADMIN'){
  const [pending,people,issues]=await Promise.all([db.orm.public.Shop.where({status:'PENDING'}).all(),db.orm.public.Rider.where({isVerified:false}).include('user',u=>u.select('name')).all(),db.orm.public.OrderStatusEvent.where(e=>e.status.in(['FAILED','DELAYED'])).orderBy(e=>e.createdAt.desc()).limit(100).all()]);
  for(const s of pending)events.push({key:`kitchen-request:${s.id}`,title:'Kitchen approval request',message:s.name,href:`/workspace/admin/kitchens/${s.id}`,kind:'review',createdAt:s.createdAt});
  for(const r of people)events.push({key:`rider-request:${r.id}`,title:'Rider verification request',message:r.user?.name??'Delivery partner',href:`/workspace/admin/riders/${r.id}`,kind:'review',createdAt:r.createdAt});
  for(const e of issues)events.push({key:`issue:${e.id}`,title:'Delivery issue reported',message:e.message??label(e.status),href:`/workspace/admin/orders/${e.orderId}`,kind:'alert',createdAt:e.createdAt});
 }
 const existing=new Set((await db.orm.public.Notification.where({userId:session.userId}).select("eventKey").all()).map(n=>n.eventKey));
 for(const event of events){
  const eventKey=`${session.userId}:${event.key}`;if(existing.has(eventKey))continue;
  const {key,...data}=event;void key;
  try{await db.orm.public.Notification.create({userId:session.userId,eventKey,...data});}catch(error){if(!await db.orm.public.Notification.where({eventKey}).select('id').first())throw error;}
 }
}
