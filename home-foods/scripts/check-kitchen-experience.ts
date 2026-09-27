import dotenv from 'dotenv';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({quiet:true});
Object.assign(process.env,{NODE_ENV:'development'});
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const {db}=await import('../src/prisma/db');
const {isNationwideDevelopmentMode}=await import('../src/lib/feature-flags');
const {signLocation}=await import('../src/lib/address-policy');
assert.ok(isNationwideDevelopmentMode(),'Only the explicitly enabled development sandbox is allowed.');
const base='http://localhost:3000',suffix=randomUUID().slice(0,8),users:number[]=[],shops:number[]=[],orders:number[]=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
const passed:string[]=[];
await mkdir('artifacts/kitchen-experience',{recursive:true});
try{
 const guest=await browser.newContext();await guest.addInitScript(()=>localStorage.setItem('home-foods-cookie-choice','accepted'));
 const p=await guest.newPage();const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));
 for(const width of [390,768,1024,1440])for(const theme of ['light','dark']){
  await p.setViewportSize({width,height:950});await p.addInitScript(theme=>localStorage.setItem('home-foods-theme',theme),theme);await p.goto(base);
  if(width>760){await expect(p.locator('.app-header .app-join')).toBeVisible();await expect(p.locator('.app-header .app-signin')).toBeVisible();}
  await p.getByRole('button',{name:'Open navigation menu'}).click();await expect(p.locator('.app-guest').getByRole('link',{name:'Join',exact:true})).toBeVisible();await expect(p.locator('.app-guest').getByRole('link',{name:'Sign in',exact:true})).toBeVisible();await p.keyboard.press('Escape');await expect(p.getByRole('dialog',{name:'HomeFoods navigation'})).toHaveCount(0);
  const search=p.getByRole('combobox',{name:'Search all of HomeFoods'});await search.fill('chicken');await expect(p.getByRole('button',{name:'Clear search',exact:true})).toBeVisible();
  assert.equal(await search.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');await p.screenshot({path:`artifacts/kitchen-experience/search-${width}-${theme}.png`});await p.getByRole('button',{name:'Clear search',exact:true}).click();await expect(search).toHaveValue('');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await p.goto(base+'/kitchens');await expect(p.getByRole('heading',{name:'Explore Kitchens',exact:true})).toBeVisible();await expect(p.locator('.discovery-loading')).toHaveCount(0,{timeout:30000});
  await p.getByLabel('Search kitchens',{exact:true}).fill('no-such-kitchen-zzzz');await expect(p.getByRole('heading',{name:'No kitchens match these filters'})).toBeVisible();await p.getByRole('button',{name:'Clear filters'}).click();await p.screenshot({path:`artifacts/kitchen-experience/discovery-${width}-${theme}.png`});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 }
 await p.goto(base);await expect(p.locator('.carousel-kitchen-card').first()).toBeVisible({timeout:30000});await p.locator('.app-header .app-join').click();await expect(p).toHaveURL(base+'/join');await expect(p.locator('.app-header')).toHaveCount(0);await expect(p.getByLabel('I’m joining as')).toBeVisible();assert.deepEqual(await p.getByLabel('I’m joining as').locator('option').evaluateAll(e=>e.map(x=>(x as HTMLOptionElement).value)),['CUSTOMER','SELLER','RIDER']);
 await p.getByRole('link',{name:'Sign in',exact:true}).click();await expect(p).toHaveURL(base+'/signin');await expect(p.locator('.app-header')).toHaveCount(0);
 await p.goto(base+'/collections/featured-kitchens');await expect(p).toHaveURL(/\/kitchens\?collection=featured-kitchens$/);await expect(p.locator('.discovery-loading')).toHaveCount(0);await p.getByRole('button',{name:'Open navigation menu'}).click();await expect(p.getByRole('link',{name:'Explore Kitchens',exact:true})).toHaveAttribute('aria-current','page');await p.keyboard.press('Escape');await expect(p.getByRole('dialog',{name:'HomeFoods navigation'})).toHaveCount(0);
 passed.push('Guest Join/Sign In, standalone auth, dedicated discovery, dark search and four responsive widths in both themes');
 async function account(role:string){const c=await browser.newContext();await c.addInitScript(()=>localStorage.setItem('home-foods-cookie-choice','accepted'));const email=`kitchen-experience-${role}-${suffix}@homefoods.test`,password=`QA-${randomUUID()}`;const res=await c.request.post(base+'/api/auth',{headers:{Origin:base},data:{intent:'signup',role,email,password,name:`[TEST] Experience ${role}`,shopName:`[TEST] Experience Kitchen ${suffix}`}});assert.equal(res.status(),201);const d=await res.json();users.push(d.user.id);return {context:c,user:d.user,email,password};}
 const seller=await account('SELLER'),customer=await account('CUSTOMER'),rider=await account('RIDER'),attemptedAdmin=await account('ADMIN');assert.equal(attemptedAdmin.user.role,'CUSTOMER');assert.equal(rider.user.role,'RIDER');
 const kitchen=await db.orm.public.Shop.where({sellerId:seller.user.id}).first();assert.ok(kitchen);shops.push(kitchen.id);
 const sp=await seller.context.newPage();await sp.goto(base+'/workspace');await expect(sp.getByRole('heading',{name:'Complete your kitchen setup'})).toBeVisible();await expect(sp.locator('.app-header .app-join')).toHaveCount(0);
 const settings=sp.locator('#kitchen-settings'),profile=sp.locator('#kitchen-profile-fields');await expect(profile).toBeVisible();await profile.getByLabel('About your food').fill('Inspired by Indian home cooking');
 await settings.getByRole('button',{name:/Kitchen Profile/}).click();await expect(profile).toBeHidden();await settings.getByRole('button',{name:/Kitchen Profile/}).click();await expect(profile.getByLabel('About your food')).toHaveValue('Inspired by Indian home cooking');
 await profile.getByRole('button',{name:'Save kitchen profile',exact:true}).click();await expect(profile).toBeHidden({timeout:30000});await expect(settings.getByText('Kitchen profile saved.',{exact:true})).toBeVisible();assert.ok((await db.orm.public.Shop.where({id:kitchen.id}).first())?.profileCompletedAt);
 const legacy=await db.orm.public.Order.create({orderNumber:`QA-PICKUP-${suffix}`,customerId:customer.user.id,shopId:kitchen.id,status:'PENDING',subtotal:1,total:1,isSandbox:true});orders.push(legacy.id);
 const address=sp.locator('#kitchen-address-fields'),street=address.getByRole('combobox',{name:'Street and building number'});await street.fill('Mannerheimintie 9 Helsinki');await expect(address.getByRole('option').first()).toBeVisible({timeout:30000});await address.getByRole('option').first().click();await address.getByRole('button',{name:'Confirm and save address',exact:true}).click();await expect(address).toBeHidden({timeout:40000});await expect(settings.getByRole('heading',{name:'Kitchen Settings',exact:true})).toBeVisible();
 assert.ok((await db.orm.public.Order.where({id:legacy.id}).first())?.pickupSnapshot);const saved=await db.orm.public.Shop.where({id:kitchen.id}).first();assert.ok(saved?.locationVerifiedAt);
 const pickupOrder=await db.orm.public.Order.create({orderNumber:`QA-MOVE-${suffix}`,customerId:customer.user.id,shopId:kitchen.id,status:'PENDING',subtotal:1,total:1,isSandbox:true});orders.push(pickupOrder.id);
 const proof=signLocation({countryCode:'FI',houseNumber:'2',postalCode:'15110',formattedAddress:'Test street 2, 15110 Lahti, Finland',addressLine1:'Test street 2',city:'Lahti',latitude:60.98,longitude:25.65});
 const moved=await seller.context.request.patch(base+'/api/seller',{headers:{Origin:base},data:{action:'set-location',verificationToken:proof}});assert.equal(moved.status(),200);assert.equal(JSON.parse((await db.orm.public.Order.where({id:pickupOrder.id}).first())!.pickupSnapshot!).address,saved.address);
 await sp.reload();await expect(sp.getByRole('heading',{name:'Kitchen Settings',exact:true})).toBeVisible();await expect(profile).toBeHidden();await expect(address).toBeHidden();
 assert.ok(await settings.evaluate(e=>{const a=e.getBoundingClientRect(),b=document.getElementById('earnings')!.getBoundingClientRect();return a.top>b.bottom;}));
 for(const width of [390,768,1440])for(const theme of ['light','dark']){await sp.setViewportSize({width,height:950});await sp.evaluate(theme=>{localStorage.setItem('home-foods-theme',theme);document.documentElement.dataset.theme=theme;},theme);await settings.scrollIntoViewIfNeeded();await sp.screenshot({path:`artifacts/kitchen-experience/settings-${width}-${theme}.png`});assert.ok(await sp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}
 await settings.getByRole('button',{name:/Kitchen Profile/}).click();await expect(profile.getByLabel('About your food')).toHaveValue('Inspired by Indian home cooking');await profile.getByLabel('About your food').fill('Unsaved draft');sp.once('dialog',d=>d.dismiss());await sp.locator('.app-header .homefoods-brand').click();await expect(sp).toHaveURL(/\/workspace/);await expect(profile.getByLabel('About your food')).toHaveValue('Unsaved draft');
 passed.push('Seller setup persists, settings collapse after save, verified address retains data, unsaved navigation is guarded, historical pickups survive moves');
 await db.orm.public.Shop.where({id:kitchen.id}).update({status:'ACTIVE',isOnline:true});
 const cp=await customer.context.newPage();await cp.goto(base+'/kitchens');await cp.getByLabel('Search kitchens',{exact:true}).fill(suffix);const card=cp.locator('.carousel-kitchen-card');await expect(card).toHaveCount(1);await card.getByRole('button').click();await expect(card.getByRole('button')).toHaveAttribute('aria-pressed','true');await cp.reload();await cp.getByLabel('Search kitchens',{exact:true}).fill(suffix);await expect(card.getByRole('button')).toHaveAttribute('aria-pressed','true');await card.locator('.carousel-kitchen-info').click();await expect(cp).toHaveURL(base+`/kitchens/${kitchen.id}`);
 const denied=await customer.context.request.patch(base+'/api/seller',{headers:{Origin:base},data:{action:'save-profile',name:'unauthorized',deliveryFee:0,estimatedMinutes:30}});assert.equal(denied.status(),403);
 await customer.context.request.delete(base+'/api/auth',{headers:{Origin:base}});await cp.goto(base+'/signin');await cp.getByLabel('Email address',{exact:true}).fill(customer.email);await cp.locator('input[type=password]').fill(customer.password);await cp.getByRole('button',{name:'Sign in',exact:true}).click();await expect(cp).toHaveURL(base+'/',{timeout:30000});
 passed.push('Real role registration and login, no public admin signup, seller authorization, discovery favourites persist and kitchen cards open their actual menu');
 assert.deepEqual(errors,[]);await writeFile('artifacts/kitchen-experience/results.json',JSON.stringify({passed},null,2));console.log(JSON.stringify({passed},null,2));
}finally{
 for(const id of orders)await db.orm.public.Order.where({id}).delete();
 for(const id of users){for(const f of await db.orm.public.KitchenFavorite.where({customerId:id}).all())await db.orm.public.KitchenFavorite.where({id:f.id}).delete();await db.orm.public.Rider.where({userId:id}).delete();}
 for(const id of shops)await db.orm.public.Shop.where({id}).delete();for(const id of users)await db.orm.public.User.where({id}).delete();await browser.close();await db.close();
}
