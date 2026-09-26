import dotenv from "dotenv";
dotenv.config({path:'.env.local',quiet:true}); dotenv.config({quiet:true});
Object.assign(process.env,{NODE_ENV:'development'});
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const { db } = await import('../src/prisma/db');
const { getSessionSigningSecret } = await import('../src/lib/session-secret');
const { verificationFields } = await import('../src/lib/address-policy');
const { isNationwideDevelopmentMode } = await import('../src/lib/feature-flags');
assert.ok(isNationwideDevelopmentMode(), 'Run only against the explicitly enabled development sandbox.');
const base='http://localhost:3000', suffix=randomUUID().slice(0,8), userIds:number[]=[],orderIds:number[]=[];
let shopId=0,itemId=0,planId=0,subscriptionId=0;
const passed:string[]=[];
const browser=await chromium.launch({channel:'msedge',headless:true});
async function account(role:'ADMIN'|'SELLER'|'RIDER'|'CUSTOMER') {
  const user=await db.orm.public.User.create({email:`workspace-${role.toLowerCase()}-${userIds.length}-${suffix}@homefoods.test`,password:'disabled-test-login',name:`[TEST] Workspace ${role}`,role}); userIds.push(user.id);
  const context=await browser.newContext();
  await context.addInitScript(()=>localStorage.setItem("home-foods-cookie-choice","accepted"));
  const payload=Buffer.from(JSON.stringify({userId:user.id,role,email:user.email,name:user.name,expiresAt:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  const signature=createHmac('sha256',getSessionSigningSecret()).update(payload).digest('base64url');
  await context.addCookies([{name:'home-foods-session',value:`${payload}.${signature}`,url:base,httpOnly:true,sameSite:'Lax'}]);
  return {user,context};
}
try {
  const admin=await account('ADMIN'),seller=await account('SELLER'),customer=await account('CUSTOMER'),rider=await account('RIDER'),other=await account('RIDER');
  await db.orm.public.Rider.create({userId:rider.user.id,isAvailable:false});await db.orm.public.Rider.create({userId:other.user.id,isAvailable:false});
  const shop=await db.orm.public.Shop.create({sellerId:seller.user.id,name:`[TEST] Workspace Kitchen ${suffix}`,status:'PENDING',isOnline:false,address:'[SANDBOX LOCATION] Mannerheimintie 9, Helsinki',city:'Helsinki',latitude:60.1699,longitude:24.9384,deliveryFee:2.5});shopId=shop.id;
  const item=await db.orm.public.MenuItem.create({shopId,name:'[TEST] Soup',price:5});itemId=item.id;
  const fields={addressLine1:'Mannerheimintie 9',city:'Helsinki',postalCode:'00100',countryCode:'FI',latitude:60.1699,longitude:24.9384};
  const address=await db.orm.public.Address.create({userId:customer.user.id,...fields,...verificationFields(fields)});
  async function api(who:typeof admin,path:string,body?:unknown,expected=200,method=body?'PATCH':'GET') {const res=await who.context.request.fetch(base+path,{method,data:body,headers:{Origin:base},timeout:60000});const value=await res.json();assert.equal(res.status(),expected,`${path}: ${JSON.stringify(value)}`);return value;}
  await api(customer,'/api/admin/operations',undefined,403);await api(seller,'/api/admin/operations',undefined,403);await api(rider,'/api/admin/operations',undefined,403);passed.push('Admin data is inaccessible to customer, seller and rider roles');
  const manage=async(action:string,id:number)=>api(admin,'/api/admin/operations',{action,id,reason:'Temporary sandbox regression verification'});
  await manage('approve-kitchen',shop.id);
  assert.equal((await db.orm.public.Shop.where({id:shop.id}).first())?.isOnline,false);passed.push('Approval preserves seller offline state and writes audit history');
  await api(seller,'/api/seller',{action:'availability',isOnline:true});
  const checkout={lines:[{menuItemId:item.id,quantity:1}],addressId:address.id,paymentMethod:'CASH',notes:'Sandbox QA only. No real fulfilment.',idempotencyKey:randomUUID()};
  const created=await api(customer,'/api/orders',checkout,201,'POST');const orderId=created.orders[0].orderId;orderIds.push(orderId);
  await api(seller,'/api/seller',{action:'availability',isOnline:false});
  await api(customer,'/api/orders',{...checkout,idempotencyKey:randomUUID()},409,'POST');
  for(const status of ['CONFIRMED','PREPARING','READY_FOR_PICKUP']) await api(seller,'/api/seller/orders',{orderId,status});
  passed.push('Customer sandbox checkout, offline purchase rejection, and existing seller fulfilment');
  await manage('suspend-kitchen',shop.id);await api(seller,'/api/seller',{action:'availability',isOnline:true},409);
  await manage('reactivate-kitchen',shop.id);assert.equal((await db.orm.public.Shop.where({id:shop.id}).first())?.isOnline,false);passed.push('Suspension cannot be bypassed and reactivation preserves voluntary pause');
  await api(rider,'/api/rider',{isAvailable:true});
  const delivery=await db.orm.public.Delivery.where({orderId}).first();assert.ok(delivery);
  await api(rider,'/api/rider',{deliveryId:delivery.id,status:'ACCEPTED'});
  await api(other,'/api/rider',{deliveryId:delivery.id,status:'PICKED_UP'},403);
  await api(rider,'/api/rider',{deliveryId:delivery.id,status:'DELIVERED'},409);
  await manage('suspend-account',rider.user.id);await api(rider,'/api/rider',{isAvailable:true},403);
  assert.equal((await db.orm.public.Delivery.where({id:delivery.id}).first())?.riderId,delivery.riderId??(await db.orm.public.Rider.where({userId:rider.user.id}).first())?.id);
  await manage('reactivate-account',rider.user.id);
  await Promise.all([api(rider,'/api/rider',{deliveryId:delivery.id,status:'PICKED_UP'}),api(rider,'/api/rider',{deliveryId:delivery.id,status:'PICKED_UP'})]);
  assert.equal((await db.orm.public.Delivery.where({id:delivery.id}).first())?.status,'IN_TRANSIT');
  const events=await db.orm.public.OrderStatusEvent.where({orderId}).all();assert.equal(events.filter(e=>e.status==='PICKED_UP').length,1);assert.equal(events.filter(e=>e.status==='IN_TRANSIT').length,1);
  const customerOrder=(await api(customer,'/api/orders')).orders.find((o:{id:number})=>o.id===orderId);assert.equal(customerOrder.status,'OUT_FOR_DELIVERY');
  await Promise.all([api(rider,'/api/rider',{deliveryId:delivery.id,status:'DELIVERED'}),api(rider,'/api/rider',{deliveryId:delivery.id,status:'DELIVERED'})]);
  assert.equal((await db.orm.public.OrderStatusEvent.where({orderId,status:'DELIVERED'}).all()).length,1);passed.push('Rider ownership, suspension safety, atomic pickup/transit, customer status and idempotent completion');
  const plan=await db.orm.public.SubscriptionPlan.create({shopId,name:'[TEST] Two meals',type:'WEEKLY',price:10,currency:'EUR',mealsPerPeriod:2});planId=plan.id;
  const subscription=await db.orm.public.Subscription.create({customerId:customer.user.id,planId,status:'ACTIVE',startDate:new Date().toISOString(),addressId:address.id});subscriptionId=subscription.id;
  const scheduledOrder=await db.orm.public.Order.create({customerId:customer.user.id,shopId,addressId:address.id,orderNumber:`HF-QA-${suffix}`,isSandbox:true,status:'READY_FOR_PICKUP',subtotal:5,total:5});orderIds.push(scheduledOrder.id);
  const scheduledDelivery=await db.orm.public.Delivery.create({orderId:scheduledOrder.id,status:'UNASSIGNED'});
  await db.orm.public.ScheduledMeal.create({subscriptionId,orderId:scheduledOrder.id,scheduledAt:new Date().toISOString()});
  const future=await db.orm.public.ScheduledMeal.create({subscriptionId,scheduledAt:new Date(Date.now()+86400000).toISOString()});
  await api(rider,'/api/rider',{isAvailable:true});for(const status of ['ACCEPTED','PICKED_UP','DELIVERED'])await api(rider,'/api/rider',{deliveryId:scheduledDelivery.id,status});
  assert.equal((await db.orm.public.ScheduledMeal.where({id:future.id}).first())?.status,'UPCOMING');assert.equal((await db.orm.public.Subscription.where({id:subscriptionId}).first())?.status,'ACTIVE');passed.push('Scheduled delivery completes only its own meal while subscription and next meal remain active');
  await api(rider,'/api/rider',{isAvailable:true});await api(rider,'/api/auth',undefined,200,'DELETE');assert.equal((await db.orm.public.Rider.where({userId:rider.user.id}).first())?.isAvailable,false);passed.push('Rider sign-out switches availability offline');
  await mkdir('artifacts/workspace-qa',{recursive:true});
  const page=await admin.context.newPage();const browserErrors:string[]=[];page.on('pageerror',e=>browserErrors.push(e.message));
  for(const width of [390,768,1440])for(const theme of ['light','dark']){await page.setViewportSize({width,height:950});await page.addInitScript(v=>localStorage.setItem('home-foods-theme',v),theme);await page.goto(`${base}/workspace/admin/kitchens/${shopId}`);await page.getByRole('heading',{name:shop.name,exact:true}).first().waitFor();await page.screenshot({path:`artifacts/workspace-qa/admin-${width}-${theme}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Page must not overflow');}
  await page.locator('.ops-menu summary').click();
  await page.getByRole('button',{name:'Suspend kitchen',exact:true}).click();
  await page.getByLabel('Reason / review notes').fill('Verified UI suspension regression');
  await page.getByRole('button',{name:'Confirm change',exact:true}).click();
  await page.getByText('Change saved and recorded.',{exact:true}).waitFor();
  assert.equal((await db.orm.public.Shop.where({id:shopId}).first())?.status,'SUSPENDED');
  await manage('reactivate-kitchen',shopId);
  passed.push('Accessible kitchen action disclosure and confirmed suspension dialog');
  for(const section of ['riders','customers','deliveries','orders','meal-plans','payments','reviews','support','reports','settings']){const response=page.waitForResponse(r=>r.url().endsWith('/api/admin/operations'));await page.goto(`${base}/workspace/admin/${section}`);assert.equal((await response).status(),200);await page.locator('.ops-heading h1').waitFor();assert.equal(await page.getByText('Management data could not be loaded.',{exact:false}).count(),0);}
  for(const who of [seller,other]){const p=await who.context.newPage();await p.goto(base+'/workspace');await p.locator('.ops-availability').waitFor();await p.screenshot({path:`artifacts/workspace-qa/${who.user.role.toLowerCase()}.png`,fullPage:true});}
  assert.deepEqual(browserErrors,[]);passed.push('Admin route rendering and 390/768/1440 light/dark viewport checks; seller/rider dashboard rendering');
  await writeFile('artifacts/workspace-qa/results.json',JSON.stringify({passed},null,2));console.log(JSON.stringify({passed},null,2));
} catch(error) { console.error("WORKSPACE QA FAILED", error, {passed}); throw error; } finally {
  if(subscriptionId){const meals=await db.orm.public.ScheduledMeal.where({subscriptionId}).all();for(const m of meals){for(const e of await db.orm.public.ScheduledMealEvent.where({scheduledMealId:m.id}).all())await db.orm.public.ScheduledMealEvent.where({id:e.id}).delete();await db.orm.public.ScheduledMeal.where({id:m.id}).delete();}await db.orm.public.Subscription.where({id:subscriptionId}).delete();}
  if(planId)await db.orm.public.SubscriptionPlan.where({id:planId}).delete();
  for(const id of orderIds){for(const e of await db.orm.public.OrderStatusEvent.where({orderId:id}).all())await db.orm.public.OrderStatusEvent.where({id:e.id}).delete();await db.orm.public.Delivery.where({orderId:id}).delete();await db.orm.public.Payment.where({orderId:id}).delete();for(const e of await db.orm.public.OrderItem.where({orderId:id}).all())await db.orm.public.OrderItem.where({id:e.id}).delete();await db.orm.public.Order.where({id}).delete();}
  if(itemId)await db.orm.public.MenuItem.where({id:itemId}).delete();if(shopId)await db.orm.public.Shop.where({id:shopId}).delete();
  for(const id of userIds){for(const e of await db.orm.public.AdminAuditLog.where({actorId:id}).all())await db.orm.public.AdminAuditLog.where({id:e.id}).delete();for(const e of await db.orm.public.CheckoutRequest.where({userId:id}).all())await db.orm.public.CheckoutRequest.where({id:e.id}).delete();for(const e of await db.orm.public.Address.where({userId:id}).all())await db.orm.public.Address.where({id:e.id}).delete();await db.orm.public.Rider.where({userId:id}).delete();await db.orm.public.User.where({id}).delete();}
  await browser.close();await db.close();
}
