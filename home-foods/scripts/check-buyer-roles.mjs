import dotenv from 'dotenv';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({quiet:true});
process.env.NODE_ENV='development';
import assert from 'node:assert/strict';
import {randomUUID,scryptSync,createHash} from 'node:crypto';
import pg from 'pg';
const {db}=await import('../src/prisma/db.ts');
const {verificationFields}=await import('../src/lib/address-policy.ts');
const {isNationwideDevelopmentMode}=await import('../src/lib/feature-flags.ts');
assert.ok(isNationwideDevelopmentMode(),'Requires development sandbox');
const base='http://localhost:3000', users=[], shops=[], suffix=randomUUID();
const password=randomUUID()+'aA1!',salt=randomUUID(),hash='scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex');
let checks=0;
async function api(who,url,body,method=body?'PATCH':'GET',status=200){
 const r=await fetch(base+url,{method,headers:{Origin:base,'Content-Type':'application/json',...(who?{Cookie:who.cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();assert.equal(r.status,status,`${method} ${url}: ${data.error??''}`);checks++;return data;
}
try {
 const accounts=[];
 for(const role of ['SELLER','SELLER','RIDER','RIDER','ADMIN']){
  const user=await db.orm.public.User.create({email:`buyer-role-${accounts.length}-${suffix}@homefoods.test`,name:'[TEST] Buyer role '+role,password:hash,role});users.push(user.id);
  const r=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({intent:'login',email:user.email,password})});assert.equal(r.status,200);checks++;
  accounts.push({user,cookie:r.headers.get('set-cookie').split(';')[0]});
 }
 const [seller,otherSeller,rider,otherRider,admin]=accounts;
 const fields={addressLine1:'Mannerheimintie 9',city:'Helsinki',postalCode:'00100',countryCode:'FI',latitude:60.1699,longitude:24.9384};
 for(const who of [seller,otherSeller,rider,otherRider]){
  who.address=await db.orm.public.Address.create({userId:who.user.id,...fields,...verificationFields(fields)});
  assert.ok((await api(who,'/api/addresses')).addresses.some(a=>a.id===who.address.id));
  await api(who,'/api/addresses',{id:who.address.id,action:'default'});
 }
 for(const who of [seller,otherSeller]){
  who.shop=await db.orm.public.Shop.create({sellerId:who.user.id,name:'[TEST] Buyer-role kitchen '+who.user.id,status:'ACTIVE',isOnline:true,address:'[SANDBOX LOCATION] Mannerheimintie 9, Helsinki',city:'Helsinki',latitude:60.1699,longitude:24.9384,deliveryFee:0});shops.push(who.shop.id);
  who.item=await db.orm.public.MenuItem.create({shopId:who.shop.id,name:'[TEST] Buyer-role dish',price:5});
 }
 for(const who of [rider,otherRider])who.rider=await db.orm.public.Rider.create({userId:who.user.id,isAvailable:true,isVerified:true});
 // Verified kitchen address becomes a delivery copy, never an operational edit.
 await db.orm.public.Address.where({id:seller.address.id}).delete();
 const kitchenLocation={address:'Mannerheimintie 9, 00100 Helsinki, Finland',city:'Helsinki',latitude:60.1699,longitude:24.9384};
 await db.orm.public.Shop.where({id:seller.shop.id}).update({...kitchenLocation,locationVerifiedAt:new Date().toISOString(),locationVerificationHash:createHash('sha256').update(JSON.stringify(Object.values(kitchenLocation))).digest('hex')});
 seller.address=(await api(seller,'/api/addresses',{action:'use-kitchen-address'},'POST',201)).address;
 assert.equal(seller.address.addressLine1,'Mannerheimintie 9');assert.equal(seller.address.isDefault,true);
 const alternate=await db.orm.public.Address.create({userId:seller.user.id,...fields,addressLine2:'Test apartment',...verificationFields(fields)});
 await api(seller,'/api/addresses',{id:alternate.id,action:'default'});
 await api(seller,'/api/addresses',{action:'use-kitchen-address'},'POST',201);
 assert.equal((await db.orm.public.Address.where({id:alternate.id}).first()).isDefault,true);
 assert.equal((await db.orm.public.Shop.where({id:seller.shop.id}).first()).address,kitchenLocation.address);
 await db.orm.public.Rider.where({id:otherRider.rider.id}).update({updatedAt:'2020-01-01T00:00:00.000Z'});
 assert.equal((await api(otherRider,'/api/rider')).rider.isAvailable,true);
 await api(admin,'/api/admin');
 assert.equal((await db.orm.public.Rider.where({id:otherRider.rider.id}).first()).isAvailable,true);
 const body=(who,items)=>({lines:items.map(i=>({menuItemId:i.id,quantity:1})),addressId:who.address.id,paymentMethod:'CASH',idempotencyKey:randomUUID()});
 await db.orm.public.Address.where({id:rider.address.id}).delete();
 assert.equal((await api(rider,'/api/addresses')).addresses.length,0);
 await api(rider,'/api/orders',body(rider,[otherSeller.item]),'POST',422);
 rider.address=(await api(rider,'/api/addresses',{...fields,label:'Personal home',sandboxConfirmation:true},'POST',201)).address;
 assert.equal(rider.address.isDefault,true);
 for(const who of [seller,rider])await api(who,'/api/location/resolve',{addressId:who.address.id,candidateOnly:true},'POST');
 assert.equal((await api(seller,'/api/kitchens/'+seller.shop.id)).shop.isOwnKitchen,true);
 assert.equal((await api(seller,'/api/kitchens/'+otherSeller.shop.id)).shop.isOwnKitchen,false);
 await api(seller,'/api/orders',body(seller,[seller.item]),'POST',403);
 await api(seller,'/api/orders',body(seller,[otherSeller.item,seller.item]),'POST',403);
 const eligibility=await api(seller,'/api/location/delivery-check',{shopIds:[seller.shop.id,otherSeller.shop.id],addressId:seller.address.id},'POST');
 assert.equal(eligibility.checks.find(c=>c.shopId===seller.shop.id).eligible,false);
 assert.equal(eligibility.checks.find(c=>c.shopId===otherSeller.shop.id).eligible,true);
 const sellerOrder=(await api(seller,'/api/orders',body(seller,[otherSeller.item]),'POST',201)).orders[0].orderId;
 assert.ok((await api(seller,'/api/orders')).orders.some(o=>o.id===sellerOrder));
 assert.ok(!(await api(seller,'/api/seller')).orders.some(o=>o.id===sellerOrder));
 assert.ok(!(await api(otherSeller,'/api/orders')).orders.some(o=>o.id===sellerOrder));
  for(const status of ['CONFIRMED','PREPARING','READY_FOR_PICKUP'])await api(otherSeller,'/api/seller/orders',{orderId:sellerOrder,status});
  const activeDelivery=await db.orm.public.Delivery.where({orderId:sellerOrder}).first();
  await api(rider,'/api/rider',{deliveryId:activeDelivery.id,status:'ACCEPTED'});
 for(const who of [seller,rider]){
  await api(who,'/api/favorites',{menuItemId:otherSeller.item.id},'POST');
  assert.ok((await api(who,'/api/favorites')).favorites.length);
  await api(who,'/api/subscriptions');
 }
 const ownPlan=await db.orm.public.SubscriptionPlan.create({shopId:seller.shop.id,name:'[TEST] Own plan',type:'DAILY',price:5,currency:'EUR'});
 await db.orm.public.SubscriptionPlanItem.create({planId:ownPlan.id,menuItemId:seller.item.id,quantity:1});
 await api(seller,'/api/subscriptions',{planId:ownPlan.id,addressId:seller.address.id},'POST',403);
 // Create a paid-plan fixture without invoking a payment provider.
 const plan=await db.orm.public.SubscriptionPlan.create({shopId:otherSeller.shop.id,name:'[TEST] Scheduled plan',type:'DAILY',price:5,currency:'EUR'});
 await db.orm.public.SubscriptionPlanItem.create({planId:plan.id,menuItemId:otherSeller.item.id,quantity:1});
 const subscription=await db.orm.public.Subscription.create({planId:plan.id,customerId:rider.user.id,addressId:rider.address.id,startDate:new Date().toISOString()});
 const sellerSubscription=await db.orm.public.Subscription.create({planId:plan.id,customerId:seller.user.id,addressId:seller.address.id,startDate:new Date().toISOString()});
 await api(seller,'/api/subscriptions',{subscriptionId:sellerSubscription.id,action:'cancel'});
 assert.ok((await api(seller,'/api/subscriptions')).subscriptions.some(s=>s.id===sellerSubscription.id&&s.status==='CANCELLED'));
 for(const scheduled of [false,true]){
  await api(rider,'/api/rider',{isAvailable:true});await api(otherRider,'/api/rider',{isAvailable:true});
  const orderId=(await api(rider,'/api/orders',{...body(rider,[otherSeller.item]),customerId:seller.user.id},'POST',201)).orders[0].orderId;
  assert.equal((await db.orm.public.Order.where({id:orderId}).first()).customerId,rider.user.id);
  assert.equal((await db.orm.public.Rider.where({id:rider.rider.id}).first()).isAvailable,true);
  assert.equal((await db.orm.public.Delivery.where({id:activeDelivery.id}).first()).status,'ACCEPTED');
  assert.ok((await api(rider,'/api/rider')).assigned.some(d=>d.id===activeDelivery.id));
  if(scheduled)await db.orm.public.ScheduledMeal.create({subscriptionId:subscription.id,orderId,scheduledAt:new Date().toISOString()});
  for(const status of ['CONFIRMED','PREPARING','READY_FOR_PICKUP'])await api(otherSeller,'/api/seller/orders',{orderId,status});
  const delivery=await db.orm.public.Delivery.where({orderId}).first();
  assert.ok(!(await api(rider,'/api/rider')).jobs.some(d=>d.id===delivery.id));
  assert.ok((await api(otherRider,'/api/rider')).jobs.some(d=>d.id===delivery.id));
  await api(rider,'/api/rider',{deliveryId:delivery.id,status:'ACCEPTED',riderId:otherRider.rider.id},'PATCH',403);
  await api(admin,'/api/admin',{action:'assign-rider',deliveryId:delivery.id,riderId:rider.rider.id,reason:'Isolated self-delivery rejection test'},'PATCH',403);
  await api(otherRider,'/api/rider',{deliveryId:delivery.id,status:'ACCEPTED'});
  await api(rider,'/api/rider',{deliveryId:delivery.id,status:'PICKED_UP'},'PATCH',403);
  await api(otherRider,'/api/rider',{deliveryId:delivery.id,status:'PICKED_UP'});
  assert.equal((await api(rider,'/api/orders')).orders.find(o=>o.id===orderId).status,'OUT_FOR_DELIVERY');
  await api(otherRider,'/api/rider',{deliveryId:delivery.id,status:'DELIVERED'});
  assert.equal((await api(otherRider,'/api/rider')).rider.isAvailable,true);
  assert.ok(!(await api(rider,'/api/rider')).assigned.some(d=>d.orderId===orderId));
  assert.equal((await api(rider,'/api/orders')).orders.find(o=>o.id===orderId).status,'DELIVERED');
  const notices=(await api(rider,'/api/notifications')).notifications;
  assert.ok(notices.some(n=>n.href===`/orders#order-${orderId}`));
  assert.ok(!notices.some(n=>n.kind==='delivery'&&n.href.endsWith('-'+orderId)));
 }
 await api(otherRider,'/api/rider',{isAvailable:false});
 assert.equal((await api(otherRider,'/api/rider')).rider.isAvailable,false);
 await api(otherRider,'/api/rider',{isAvailable:true});
 const loginAgain=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({intent:'login',email:otherRider.user.email,password})});assert.equal(loginAgain.status,200);
 assert.equal((await api(otherRider,'/api/rider')).rider.isAvailable,true);
 await api(otherRider,'/api/auth',undefined,'DELETE');
 assert.equal((await db.orm.public.Rider.where({id:otherRider.rider.id}).first()).isAvailable,false);
 console.log(JSON.stringify({result:'PASS',apiChecks:checks,coverage:'seller/rider purchasing, owner and mixed-basket rejection, personal orders, kitchen default/personal address separation, rider address requirement and saved-address resolver, self-delivery protection, regular/scheduled completion stays online, manual offline/logout, notifications, subscription management'}));
} finally {
 const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
 try {
  await c.query('BEGIN');
  const ids=(await c.query('SELECT id FROM public."order" WHERE "customerId"=ANY($1::int[])',[users])).rows.map(o=>o.id);
  await c.query('DELETE FROM public."scheduledMealEvent" WHERE "scheduledMealId" IN (SELECT id FROM public."scheduledMeal" WHERE "orderId"=ANY($1::int[]))',[ids]);
  await c.query('DELETE FROM public."scheduledMeal" WHERE "subscriptionId" IN (SELECT id FROM public.subscription WHERE "customerId"=ANY($1::int[]))',[users]);
  await c.query('DELETE FROM public.subscription WHERE "customerId"=ANY($1::int[])',[users]);
  await c.query('DELETE FROM public."subscriptionPlanItem" WHERE "planId" IN (SELECT id FROM public."subscriptionPlan" WHERE "shopId"=ANY($1::int[]))',[shops]);
  await c.query('DELETE FROM public."subscriptionPlan" WHERE "shopId"=ANY($1::int[])',[shops]);
  for(const t of ['notification','checkoutRequest'])await c.query(`DELETE FROM public."${t}" WHERE "userId"=ANY($1::int[])`,[users]);
  for(const t of ['favorite','kitchenFavorite'])await c.query(`DELETE FROM public."${t}" WHERE "customerId"=ANY($1::int[])`,[users]);
  for(const t of ['orderStatusEvent','delivery','payment','orderItem'])await c.query(`DELETE FROM public."${t}" WHERE "orderId"=ANY($1::int[])`,[ids]);
  await c.query('DELETE FROM public."order" WHERE id=ANY($1::int[])',[ids]);
  await c.query('DELETE FROM public."menuItem" WHERE "shopId"=ANY($1::int[])',[shops]);
  await c.query('DELETE FROM public.shop WHERE id=ANY($1::int[])',[shops]);
  for(const t of ['address','rider'])await c.query(`DELETE FROM public."${t}" WHERE "userId"=ANY($1::int[])`,[users]);
  await c.query('DELETE FROM public."user" WHERE id=ANY($1::int[])',[users]);
  await c.query('COMMIT');console.log('Disposable buyer-role fixtures removed.');
 }catch(error){await c.query('ROLLBACK');throw error;}finally{await c.end();await db.close();}
}
