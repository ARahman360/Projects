import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const base='http://localhost:3000';
const catalog=await (await fetch(base+'/api/catalog')).json();
const dish=catalog.dishes.find(d=>d.id&&d.shopId);assert.ok(dish);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 await mkdir('artifacts/kitchen-basket',{recursive:true});
 for(const customer of [false,true]){
  const context=await browser.newContext();
  // A browser-only identity fixture exercises owner-specific local carts without creating an account.
  if(customer){await context.route('**/api/auth',r=>r.fulfill({json:{user:{id:987654321,name:'Basket fixture',email:'basket@example.test',role:'CUSTOMER'}}}));await context.route('**/api/notifications',r=>r.fulfill({json:{notifications:[],unreadCount:0}}));await context.route('**/api/favorites',r=>r.fulfill({json:{favorites:[],favoriteKitchens:[]}}));}
  const key=`home-foods-cart:${customer?987654321:'guest'}`;
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/kitchens/'+dish.shopId,{waitUntil:'domcontentloaded'});await expect(page.locator('.kitchen-cart-cta')).toBeVisible();
  for(const width of [390,1440])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:950});await page.evaluate(({key,dish,theme})=>{localStorage.setItem(key,JSON.stringify([{dish,quantity:1}]));document.documentElement.dataset.theme=theme;window.dispatchEvent(new Event('homefoods:cart-change'));},{key,dish,theme});
   const url=page.url();await page.getByRole('button',{name:/^Open cart/}).click();const basket=page.getByRole('dialog',{name:'Your basket'});await expect(basket).toBeVisible();assert.equal(page.url(),url);
   await basket.getByRole('button',{name:'Add '+dish.name,exact:true}).click();await expect(basket.locator('.quantity-control>span')).toHaveText('2');await basket.getByPlaceholder('Allergies or delivery notes for the kitchen (optional)').fill('Keep this kitchen note');
   await page.screenshot({path:`artifacts/kitchen-basket/${customer?'customer':'guest'}-${width}-${theme}.png`,animations:'disabled'});
   await basket.getByRole('button',{name:'Close basket'}).click();assert.equal(page.url(),url);await expect(page.getByRole('button',{name:/^Open cart/})).toBeFocused();await expect(page.locator('.kitchen-cart-cta')).toContainText('(2)');
   await page.locator('.kitchen-cart-cta').click();await expect(basket).toBeVisible();await expect(basket.getByPlaceholder('Allergies or delivery notes for the kitchen (optional)')).toHaveValue('Keep this kitchen note');await page.keyboard.press('Escape');assert.equal(page.url(),url);
  }
  await page.reload();await expect(page.locator('.kitchen-cart-cta')).toContainText('(2)');await page.locator('.kitchen-cart-cta').click();const basket=page.getByRole('dialog',{name:'Your basket'});await basket.getByRole('button',{name:'Remove '+dish.name+' from basket',exact:true}).click();await expect(basket.getByText('Your basket is empty.')).toBeVisible();await basket.getByRole('button',{name:'Explore the menu'}).click();await expect(page.locator('.kitchen-cart-cta')).toContainText('(0)');
  await page.evaluate(({key,dish})=>localStorage.setItem(key,JSON.stringify([{dish,quantity:2}])),{key,dish});await page.goto(base+'/?cart=open');await expect(page.getByRole('dialog',{name:'Your basket'})).toBeVisible();await expect(page.locator('.quantity-control>span')).toHaveText('2');assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: kitchen header/menu basket stays on kitchen; quantity/remove/empty state, notes, counts, reload, focus/Escape and home basket regression; guest and browser-only customer fixtures; desktop/mobile, light/dark.');
}finally{await browser.close();}
