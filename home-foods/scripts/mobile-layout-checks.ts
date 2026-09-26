import assert from 'node:assert/strict';
import { expect, type BrowserContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

export async function checkAction(context:BrowserContext,base:string,label:string) {
  const p=await context.newPage();
  for(const theme of ['light','dark']) {
    await p.addInitScript(t=>localStorage.setItem('home-foods-theme',t),theme);await p.goto(base+'/workspace');
    const button=p.getByRole('button',{name:label,exact:true}).first();await expect(button).toBeVisible();
    const colors=await button.evaluate(e=>({foreground:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}));
    const lum=(v:string)=>{const rgb=v.match(/\d+/g)!.slice(0,3).map(Number).map(n=>{const x=n/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    const a=lum(colors.foreground),b=lum(colors.background),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    assert.ok(contrast>=4.5,`${label} ${theme} contrast ${contrast}`);
  }
  await p.close();
}

export async function checkLayout(context:BrowserContext,base:string) {
  await mkdir('artifacts/mobile-layout-qa',{recursive:true});
  const p=await context.newPage();
  for(const width of [390,768,1100,1440,1920]) for(const theme of ['light','dark']) {
    await p.setViewportSize({width,height:950});
    await p.addInitScript(t=>localStorage.setItem('home-foods-theme',t),theme);
    await p.goto(base);const menu=p.getByRole('button',{name:'Open navigation menu'});await expect(menu).toBeVisible();
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    const box=await p.locator('.market-main').boundingBox();assert.ok(box && box.x<Math.max(10,(width-1920)/2+2),'No hidden sidebar column');
    await menu.click();await expect(p.getByRole('dialog',{name:'HomeFoods navigation'})).toBeVisible();
    await p.keyboard.press('Escape');await expect(menu).toBeFocused();
    await menu.click();await p.getByRole('button',{name:'Close navigation',exact:true}).click();
    await menu.click();await p.locator('.sidebar-layer').click({position:{x:width-5,y:300}});await expect(p.getByRole('dialog',{name:'HomeFoods navigation'})).toHaveCount(0);
    await p.screenshot({path:`artifacts/mobile-layout-qa/home-${width}-${theme}.png`});
  }
  await p.close();
}

export async function checkAvailability(context:BrowserContext,base:string,role:'seller'|'rider') {
  const p=await context.newPage();await p.setViewportSize({width:1440,height:950});await p.goto(base+'/workspace');
  const desktop=p.locator('.availability-desktop');await expect(desktop).toBeVisible();
  if(await desktop.innerText()==='Go Online'){await desktop.click();await expect(desktop).toHaveText('Go Offline');}
  assert.equal(await desktop.evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
  await expect(desktop).toHaveCSS('background-color',/rgb\((166, 58, 50|132, 45, 39)\)/);
  await desktop.click();await expect(desktop).toHaveText('Go Online');
  await expect(desktop).toHaveCSS('background-color',/rgb\((33, 84, 63|23, 63, 47)\)/);
  await p.setViewportSize({width:390,height:844});await expect(desktop).toBeHidden();
  const handle=p.locator('.availability-handle'),track=p.locator('.availability-track');
  await expect(track).toContainText('Slide to Go Online');
  async function swipe(fraction:number){const h=await handle.boundingBox(),t=await track.boundingBox();assert.ok(h&&t);await p.mouse.move(h.x+25,h.y+25);await p.mouse.down();await p.mouse.move(h.x+25+(t.width-64)*fraction,h.y+25,{steps:10});await p.mouse.up();}
  let writes=0;p.on('request',r=>{if(r.method()==='PATCH')writes++;});
  await swipe(.3);await expect(track).toContainText('Slide to Go Online');assert.equal(writes,0);
  await swipe(1);await expect(track).toContainText('Slide to Go Offline');
  await p.reload();await expect(track).toContainText('Slide to Go Offline');
  await p.route(`**/api/${role}`,async route=>{if(route.request().method()==='PATCH')await route.fulfill({status:503,json:{error:'Simulated availability outage'}});else await route.continue();});
  await swipe(1);await expect(p.locator('.availability-feedback')).toContainText('not changed');await expect(track).toContainText('Slide to Go Offline');
  await p.unroute(`**/api/${role}`);await p.getByRole('button',{name:'Go Offline without sliding'}).click();await expect(track).toContainText('Slide to Go Online');
  await handle.focus();await p.keyboard.press('Enter');await expect(track).toContainText('Slide to Go Offline');
  await p.emulateMedia({reducedMotion:'reduce'});await p.screenshot({path:`artifacts/mobile-layout-qa/${role}-mobile.png`,fullPage:true});
  await p.setViewportSize({width:1440,height:950});await expect(desktop).toHaveText('Go Offline');
  await desktop.click();await expect(desktop).toHaveText('Go Online');await p.close();
}

export async function checkAddress(context:BrowserContext,base:string) {
  const p=await context.newPage();await p.goto(base+'/workspace#addresses');
  await p.getByRole('button',{name:'+ Add address',exact:true}).click();
  assert.equal(await p.getByLabel('Search a Finnish address',{exact:true}).count(),0);
  const street=p.getByRole('combobox',{name:'Street and building number'});
  await street.fill('Mannerheimintie 9 Helsinki');
  await expect(p.getByRole('option').first()).toBeVisible({timeout:25000});
  await street.press('Escape');await expect(p.getByRole('option')).toHaveCount(0);
  await street.focus();await street.press('ArrowDown');await expect(p.getByRole('option').first()).toBeVisible();
  await p.getByLabel('Address label',{exact:true}).click();await expect(p.getByRole('option')).toHaveCount(0);
  await street.focus();await street.press('ArrowDown');await street.press('Enter');
  await expect(p.getByLabel('Postal code',{exact:true})).toHaveValue(/^\d{5}$/);
  await expect(p.getByLabel('City or municipality')).not.toHaveValue('');
  await p.getByLabel('Apartment, floor or entrance').fill('QA entrance');
  const response=p.waitForResponse(r=>r.url().endsWith('/api/addresses')&&r.request().method()==='POST');
  await p.getByRole('button',{name:'Confirm and save address',exact:true}).click();
  const saved=await response;assert.ok(saved.ok(),await saved.text());const value=await saved.json();
  assert.match(value.address.postalCode,/^0\d{4}$/);assert.equal(value.address.status,'verified');
  await expect(p.getByText('Address saved.',{exact:true})).toBeVisible();
  await p.close();return value.address.id as number;
}
