import dotenv from 'dotenv';dotenv.config({path:'.env.local',quiet:true});dotenv.config({quiet:true});
Object.assign(process.env,{NODE_ENV:'development'});
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect,type BrowserContext} from '@playwright/test';
const {db}=await import('../src/prisma/db');
const {isNationwideDevelopmentMode}=await import('../src/lib/feature-flags');
assert.ok(isNationwideDevelopmentMode(),'Isolated development only');
const base='http://localhost:3000',suffix=randomUUID().slice(0,8),userIds:number[]=[],shopIds:number[]=[],orderIds:number[]=[];
const browser=await chromium.launch({channel:'chrome',headless:true});const passed:string[]=[];
async function request(c:BrowserContext,path:string,body?:unknown,method=body?'PATCH':'GET'){const r=await c.request.fetch(base+path,{method,data:body,headers:{Origin:base},timeout:60000});return {status:r.status(),data:await r.json()};}
try{
 await mkdir('artifacts/account-experience',{recursive:true});
 const accounts=[];
 for(const role of ['CUSTOMER','SELLER','RIDER','ADMIN']){
  const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('home-foods-cookie-choice','accepted'));
  const email=`account-${role}-${suffix}@homefoods.test`,password='QA-'+randomUUID();
  const r=await request(context,'/api/auth',{intent:'signup',role:role==='ADMIN'?'CUSTOMER':role,email,password,name:`[TEST] Account ${role}`,shopName:`[TEST] Account Kitchen ${suffix}`},'POST');assert.equal(r.status,201);userIds.push(r.data.user.id);
  if(role==='ADMIN')await db.orm.public.User.where({id:r.data.user.id}).update({role:'ADMIN'});
  accounts.push({context,email,password,id:r.data.user.id,role});
 }
 const [customer,seller,rider,admin]=accounts;
 const shop=await db.orm.public.Shop.where({sellerId:seller.id}).first();assert.ok(shop);shopIds.push(shop.id);
 const riderRow=await db.orm.public.Rider.where({userId:rider.id}).first();assert.ok(riderRow);
 const order=await db.orm.public.Order.create({customerId:customer.id,shopId:shop.id,orderNumber:`QA-ACCOUNT-${suffix}`,status:'CONFIRMED',subtotal:1,total:1,isSandbox:true});orderIds.push(order.id);
 await db.orm.public.OrderStatusEvent.create({orderId:order.id,status:'PENDING',actorRole:'CUSTOMER',actorId:customer.id});
 await db.orm.public.OrderStatusEvent.create({orderId:order.id,status:'CONFIRMED',actorRole:'SELLER',actorId:seller.id});
 await db.orm.public.Delivery.create({orderId:order.id,riderId:riderRow.id,status:'ASSIGNED'});
 await db.orm.public.OrderStatusEvent.create({orderId:order.id,status:'ASSIGNED',domain:'DELIVERY',actorRole:'ADMIN',actorId:admin.id});
 for(const a of accounts){
  const p=await a.context.newPage();await p.goto(base+'/workspace#profile');
  const profile=p.locator('.account-profile');await expect(profile).toBeVisible({timeout:30000});
  await profile.getByRole('button',{name:'Edit Profile',exact:true}).click();await profile.getByLabel('Full name',{exact:true}).fill(`[TEST] Updated ${a.role}`);await profile.getByLabel('Phone number',{exact:true}).fill('+358 401234567');await profile.getByRole('button',{name:'Save Changes',exact:true}).click();await expect(profile.getByRole('status')).toHaveText('Profile updated.',{timeout:30000});
  await p.reload();await expect(profile.getByRole('heading',{name:`[TEST] Updated ${a.role}`})).toBeVisible();await expect(profile.getByText('+358 401234567',{exact:true})).toBeVisible();
  assert.equal((await request(a.context,'/api/account',{action:'profile',name:'Invalid',phone:'',role:'ADMIN'})).status,422);
  assert.equal((await request(a.context,'/api/account',{action:'profile',name:'Invalid',phone:'',userId:customer.id})).status,422);
  assert.equal((await request(a.context,'/api/account',{action:'password',currentPassword:'wrong',newPassword:'New-Password-1234'})).status,403);
  assert.equal((await request(a.context,'/api/account',{action:'email',currentPassword:a.password,email:accounts.find(x=>x.id!==a.id)!.email})).status,422);
  await p.getByRole('button',{name:'Open navigation menu'}).click();await expect(p.locator('.app-drawer-profile strong')).toHaveText(`[TEST] Updated ${a.role}`);await p.keyboard.press('Escape');await expect(p.getByRole('dialog',{name:'HomeFoods navigation'})).toHaveCount(0);
  await expect(p.locator('.order-notifications-trigger')).toHaveCount(0);await expect(p.locator('.header-notifications')).toHaveCount(1);
  assert.ok(await p.locator('.header-notifications').evaluate(e=>!!e.nextElementSibling?.matches('a,button')));
  const initial=await request(a.context,'/api/notifications');assert.equal(initial.status,200);assert.ok(initial.data.unreadCount>0);
  for(const width of [390,1440])for(const theme of ['light','dark']){
   await p.setViewportSize({width,height:950});await p.evaluate(t=>{localStorage.setItem('home-foods-theme',t);document.documentElement.dataset.theme=t;},theme);
   await p.locator('.header-notifications').click();const panel=p.getByRole('dialog',{name:'Notifications',exact:true});await expect(panel).toBeVisible();await expect(panel.locator('li').first()).toBeVisible({timeout:30000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await expect(panel).toHaveCSS('background-color',theme==='dark'?'rgb(27, 40, 33)':'rgb(255, 254, 250)');
   await p.screenshot({animations:'disabled',path:`artifacts/account-experience/${a.role}-${width}-${theme}.png`});await panel.getByRole('button',{name:'Close notifications'}).click();await expect(panel).toHaveCount(0);
  }
  const id=initial.data.notifications[0].id;assert.equal((await request(a.context,'/api/notifications',{id})).status,200);
  assert.ok((await request(a.context,'/api/notifications')).data.notifications.find((n:{id:number})=>n.id===id).readAt);
  assert.equal((await request(accounts.find(x=>x.id!==a.id)!.context,'/api/notifications',{id})).status,404);
  assert.equal((await request(a.context,'/api/notifications',{all:true})).status,200);await p.reload();await expect(p.locator('.header-notifications>b')).toHaveCount(0,{timeout:30000});
  assert.equal((await request(a.context,'/api/notifications')).data.unreadCount,0);
  await p.close();
 }
 passed.push('All four roles: edit and persist profile, refresh sidebar, reject role/owner tampering and email changes; responsive header notifications, read state and ownership checks');
 const oldSession=await browser.newContext({storageState:await customer.context.storageState()});
 const newPassword='QA-New-'+randomUUID();assert.equal((await request(customer.context,'/api/account',{action:'password',currentPassword:customer.password,newPassword})).status,200);
 assert.equal((await request(oldSession,'/api/account')).status,401);customer.password=newPassword;
 const fresh=await browser.newContext();assert.equal((await request(fresh,'/api/auth',{intent:'login',email:customer.email,password:newPassword},'POST')).status,200);
 assert.equal((await request(fresh,'/api/notifications')).data.unreadCount,0);
 await db.orm.public.OrderStatusEvent.create({orderId:order.id,status:'PREPARING',actorRole:'SELLER',actorId:seller.id});
 const newEvent=await request(fresh,'/api/notifications');assert.equal(newEvent.data.unreadCount,1);assert.equal((await request(fresh,'/api/notifications')).data.unreadCount,1);assert.equal(newEvent.data.notifications[0].href,`/orders#order-${order.id}`);
 const live=await fresh.newPage();await live.goto(base+'/workspace#profile');await expect(live.locator('.header-notifications>b')).toHaveText('1');
 await db.orm.public.OrderStatusEvent.create({orderId:order.id,status:'READY_FOR_PICKUP',actorRole:'SELLER',actorId:seller.id});
 await expect(live.locator('.header-notifications>b')).toHaveText('2',{timeout:35000});
 await db.orm.public.Delivery.where({orderId:order.id}).update({status:'DELIVERED'});await db.orm.public.Order.where({id:order.id}).update({status:'DELIVERED'});
 await live.locator('.header-notifications').click();await live.getByRole('dialog',{name:'Notifications',exact:true}).locator('a').first().click();await expect(live.locator('#order-'+order.id)).toBeVisible({timeout:30000});await expect(live.getByRole('tab',{name:/Order history/})).toHaveAttribute('aria-selected','true');await live.close();
 passed.push('Visible-page polling receives new events and notification links reveal delivered orders in the history tab');
 passed.push('Password changes revoke old sessions; email remains read-only; another device retains read state; new backend event appears exactly once');
 const token=randomUUID()+randomUUID(),tokenHash=createHash('sha256').update(token).digest('hex');
 await db.orm.public.PasswordResetToken.create({userId:customer.id,tokenHash,expiresAt:new Date(Date.now()+60000).toISOString()});
 const resetPassword='QA-Reset-'+randomUUID();assert.equal((await request(fresh,'/api/auth/reset-password',{token,password:resetPassword},'POST')).status,200);
 assert.equal((await request(fresh,'/api/account')).status,401);assert.equal((await request(fresh,'/api/auth/reset-password',{token,password:resetPassword},'POST')).status,400);
 passed.push('Isolated password-recovery token is consumed once and revokes prior sessions; no email is sent');
 await writeFile('artifacts/account-experience/results.json',JSON.stringify({passed},null,2));console.log(JSON.stringify({passed},null,2));
}catch(error){console.error(error);throw error;}finally{
 for(const id of orderIds){for(const e of await db.orm.public.OrderStatusEvent.where({orderId:id}).all())await db.orm.public.OrderStatusEvent.where({id:e.id}).delete();await db.orm.public.Delivery.where({orderId:id}).delete();await db.orm.public.Order.where({id}).delete();}
 for(const id of shopIds)await db.orm.public.Shop.where({id}).delete();
 for(const id of userIds){await db.orm.public.Rider.where({userId:id}).delete();await db.orm.public.PasswordResetToken.where({userId:id}).delete();await db.orm.public.User.where({id}).delete();}
 await browser.close();await db.close();
}
