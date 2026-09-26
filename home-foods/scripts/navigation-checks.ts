import assert from 'node:assert/strict';
import {expect,type BrowserContext} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

export async function checkNavigation(context:BrowserContext,base:string,role:string,shopId:number) {
 await mkdir('artifacts/navigation-qa',{recursive:true});
 const p=await context.newPage();const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));
 const routes=role==='CUSTOMER'?['/','/orders','/favorites','/meal-plans','/workspace#profile','/workspace#addresses',`/kitchens/${shopId}`,'/collections/featured-kitchens']:
 role==='ADMIN'?['/','/orders','/workspace#profile','/workspace/admin','/workspace/admin/kitchens']:
 ['/','/orders',`/workspace#${role==='SELLER'?'seller':'rider'}-dashboard`,'/workspace#profile'];
 for(const width of [390,768,1440])for(const theme of ['light','dark']) {
  await p.setViewportSize({width,height:950});
  await p.addInitScript(t=>{localStorage.setItem('home-foods-theme',t);localStorage.setItem('home-foods-cookie-choice','accepted');},theme);
  for(const route of routes){
   await p.goto(base+route);await expect(p.locator('.app-header')).toHaveCount(1);
   if(route.startsWith('/workspace#')) await expect(p.locator('.workspace-title')).toBeVisible({timeout:30000});
   if(route.startsWith('/workspace/admin')) await expect(p.locator('.ops-heading h1')).toBeVisible({timeout:30000});
   if(route==='/orders') {await expect(p.locator('.orders-skeletons')).toHaveCount(0,{timeout:30000});await expect(p.locator('.orders-error')).toHaveCount(0);}
   if(route==='/favorites') await expect(p.locator('.favorites-skeletons')).toHaveCount(0,{timeout:30000});
   if(route==='/meal-plans') await expect(p.locator('.orders-loading')).toHaveCount(0,{timeout:30000});
   if(route.startsWith('/kitchens/')) await expect(p.locator('.kitchen-hero')).toBeVisible({timeout:30000});
   if(route.startsWith('/collections/')) await expect(p.locator('.collection-loading')).toHaveCount(0,{timeout:30000});
   const menu=p.getByRole('button',{name:'Open navigation menu'});await expect(menu).toBeVisible();await menu.click();
   const drawer=p.getByRole('dialog',{name:'HomeFoods navigation'});await expect(drawer).toBeVisible();
   await expect(drawer.locator('.app-drawer-profile strong')).toHaveText(`[TEST] Workspace ${role}`);
   await expect(drawer.locator('.sidebar-theme-toggle')).toHaveCount(1);
   await expect(p.locator('html')).toHaveAttribute('data-theme',theme);
   assert.equal(await p.locator('body').evaluate(e=>e.style.overflow),'hidden');
   assert.equal(await p.locator('.app-shell').evaluate(e=>(e as HTMLElement).inert),true);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`${role} ${width} ${route} overflow`);
   await expect(p.locator('.orders-sidebar,.favorites-sidebar,.workspace-nav,.ops-nav')).toHaveCount(0);
   const shortcut=drawer.locator('.app-nav-workspace');
   if(role==='CUSTOMER'){await expect(shortcut).toHaveCount(0);await expect(drawer.getByRole('link',{name:'Favourites',exact:true})).toHaveAttribute('href','/favorites');}
   else {await expect(shortcut).toHaveText(role==='SELLER'?'Your Kitchen':role==='RIDER'?'Deliver':'Workspace');const a=await shortcut.boundingBox(),d=await drawer.getByRole('heading',{name:'Discover',exact:true}).boundingBox();assert.ok(a&&d&&a.y<d.y);}
   if(route==='/orders')await expect(drawer.getByRole('link',{name:'Orders',exact:true})).toHaveAttribute('aria-current','page');
   if(route==='/favorites')await expect(drawer.getByRole('link',{name:'Favourites',exact:true})).toHaveAttribute('aria-current','page');
   await p.keyboard.press('Shift+Tab');assert.ok(await drawer.evaluate(e=>e.contains(document.activeElement)));
   if(route==='/')await p.screenshot({path:`artifacts/navigation-qa/${role}-${width}-${theme}.png`});
   await p.keyboard.press('Escape');await expect(drawer).toHaveCount(0);await expect(menu).toBeFocused();
   if(width===1440 && ['/orders','/workspace#profile','/favorites'].includes(route)) await p.screenshot({path:`artifacts/navigation-qa/${role}-${theme}-${route.includes('workspace')?'account':route.slice(1)}.png`});
   assert.notEqual(await p.locator('body').evaluate(e=>e.style.overflow),'hidden');
  }
 }
 // Real client navigation and browser history update the active item.
 await p.goto(base+'/');await p.getByRole('button',{name:'Open navigation menu'}).click();await p.getByRole('dialog').getByRole('link',{name:'Orders',exact:true}).click();await expect(p).toHaveURL(/\/orders$/);
 await p.getByRole('button',{name:'Open navigation menu'}).click();await expect(p.getByRole('dialog').getByRole('link',{name:'Orders',exact:true})).toHaveAttribute('aria-current','page');await p.keyboard.press('Escape');await p.goBack();await expect(p).toHaveURL(base+'/');
 await p.getByRole('button',{name:'Open navigation menu'}).click();await p.locator('.app-drawer-layer').click({position:{x:1400,y:300}});await expect(p.getByRole('dialog',{name:'HomeFoods navigation'})).toHaveCount(0);
 // An API failure must keep the account signed in; success preserves the theme.
 await p.getByRole('button',{name:'Open navigation menu'}).click();
 const drawer=p.getByRole('dialog',{name:'HomeFoods navigation'});
 await p.route('**/api/auth',async route=>route.request().method()==='DELETE'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary sign-out failure'})}):route.continue());
 await drawer.getByRole('button',{name:'Sign Out',exact:true}).click();
 if(role==='RIDER')await drawer.getByRole('button',{name:'Confirm Sign Out',exact:true}).click();
 await expect(drawer.getByRole('alert')).toHaveText('Temporary sign-out failure');
 await expect(drawer.locator('.app-drawer-profile strong')).toHaveText(`[TEST] Workspace ${role}`);
 await p.unroute('**/api/auth');
 const signOutResponse=p.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth'&&response.request().method()==='DELETE',{timeout:60000});
 await drawer.getByRole('button',{name:role==='RIDER'?'Confirm Sign Out':'Sign Out',exact:true}).click();
 const response=await signOutResponse;assert.equal(response.status(),200,`${role} sign-out API must succeed`);
 await expect(drawer).toHaveCount(0);await expect(p.locator('html')).toHaveAttribute('data-theme','dark');
 await p.getByRole('button',{name:'Open navigation menu'}).click();await expect(p.locator('.app-guest')).toBeVisible();
 assert.deepEqual(errors,[]);await p.close();
}
