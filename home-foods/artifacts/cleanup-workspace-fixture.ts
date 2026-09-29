import dotenv from 'dotenv';dotenv.config({path:'.env.local',quiet:true});dotenv.config({quiet:true});
const {db}=await import('../src/prisma/db');
try{
 const o=await db.orm.public.Order.where({id:27}).include('customer',u=>u.select('id','email','name')).include('shop',s=>s.select('id','name')).first();
 if(!o){console.log('Fixture order absent');}else{
 if(!o.isSandbox || o.customer?.name!=='[TEST] Workspace CUSTOMER' || !/^workspace-customer-\d+-[a-f0-9]{8}@homefoods\.test$/.test(o.customer.email) || !o.shop?.name.startsWith('[TEST] Workspace Kitchen '))throw new Error('Not the expected disposable QA order');
 console.log(JSON.stringify({verifiedFixture:true,orderId:o.id,customerId:o.customerId,shopId:o.shopId}));
 await db.transaction(async tx=>{
  for(const e of await tx.orm.public.OrderStatusEvent.where({orderId:27}).all())await tx.orm.public.OrderStatusEvent.where({id:e.id}).delete();
  for(const e of await tx.orm.public.OrderItem.where({orderId:27}).all())await tx.orm.public.OrderItem.where({id:e.id}).delete();
  const d=await tx.orm.public.Delivery.where({orderId:27}).first();if(d)await tx.orm.public.Delivery.where({id:d.id}).delete();
  const p=await tx.orm.public.Payment.where({orderId:27}).first();if(p)await tx.orm.public.Payment.where({id:p.id}).delete();
  await tx.orm.public.Order.where({id:27}).delete();
 });console.log('Removed only verified sandbox order 27 and its dependent rows');
 }
}finally{await db.close()}
