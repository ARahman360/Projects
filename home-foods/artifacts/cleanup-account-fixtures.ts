import dotenv from 'dotenv';dotenv.config({path:'.env.local',quiet:true});dotenv.config({quiet:true});const {db}=await import('../src/prisma/db');
const users=(await db.orm.public.User.all()).filter(u=>/^account-(CUSTOMER|SELLER|RIDER|ADMIN)-[a-f0-9]{8}@homefoods.test$/i.test(u.email));
for(const u of users){
 for(const o of await db.orm.public.Order.where({customerId:u.id}).all()){
  if(!o.isSandbox||!o.orderNumber.startsWith('QA-ACCOUNT-'))throw Error('Unexpected order');
  for(const e of await db.orm.public.OrderStatusEvent.where({orderId:o.id}).all())await db.orm.public.OrderStatusEvent.where({id:e.id}).delete();
  await db.orm.public.Delivery.where({orderId:o.id}).delete();await db.orm.public.Order.where({id:o.id}).delete();
 }
}
for(const u of users){for(const s of await db.orm.public.Shop.where({sellerId:u.id}).all())await db.orm.public.Shop.where({id:s.id}).delete();await db.orm.public.Rider.where({userId:u.id}).delete();await db.orm.public.User.where({id:u.id}).delete();}
console.log({removedTemporaryAccounts:users.length});await db.close();
