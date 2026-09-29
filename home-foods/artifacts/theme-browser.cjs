/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium, expect } = require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
 const context=await browser.newContext(); const p=await context.newPage();
 for(const width of [390,1440]) {
 await p.setViewportSize({width,height:900});await p.goto('http://localhost:3000/');
 await p.getByRole('button',{name:'Open navigation menu'}).click();
 const toggle=p.locator('.sidebar-bottom .sidebar-theme-toggle');await expect(toggle).toHaveCount(1);
 await toggle.click(); const theme=await p.evaluate(()=>document.documentElement.dataset.theme);
 for(const route of ['/signin','/join','/forgot-password','/orders','/favorites','/workspace','/?cart=open']) {
 await p.goto('http://localhost:3000'+route);
 await expect(p.locator('html')).toHaveAttribute('data-theme',theme);
 await p.reload();await expect(p.locator('html')).toHaveAttribute('data-theme',theme);
 if(!new URL(p.url()).pathname.match(/^\/$/)) await expect(p.locator('.sidebar-theme-toggle')).toHaveCount(0);
 }
 console.log(`PASS ${width}px: sidebar toggles; preference survives navigation/reload across guest/auth/protected-route redirects and basket route`);
 }
 await context.close();
 } finally {await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
