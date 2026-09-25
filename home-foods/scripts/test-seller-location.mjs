import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base='http://localhost:3000';let cookie='';
async function call(path,body,method='POST',expected=200){
  const response=await fetch(base+path,{method:body?method:'GET',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;
}
await call('/api/auth',{intent:'signup',role:'SELLER',name:'[TEST] Seller location QA',shopName:'[TEST] Location QA Kitchen',email:`seller-location-${Date.now()}@homefoods.test`,password:'Location-QA-only-2026!'},'POST',201);
let result=await call('/api/seller',{action:'set-location',address:'Mannerheimintie 9, 00100 Helsinki, Finland'},'PATCH');
assert.equal(result.location.countryCode,'FI');assert.equal(result.location.postalCode,'00100');assert.ok(Number.isFinite(result.shop.latitude));
const previous=result.shop;
await call('/api/seller',{action:'set-location',address:'Drottninggatan 1, Stockholm, Sweden'},'PATCH',422);
result=await call('/api/seller');assert.equal(result.shop.latitude,previous.latitude);assert.equal(result.shop.address,previous.address);
result=await call('/api/seller',{address:'Ruopankatu 3',city:'Lahti'},'PATCH');assert.equal(result.shop.city,'Lahti');assert.notEqual(result.shop.latitude,previous.latitude);
await call('/api/seller',{address:'Ruopankatu',city:'Lahti'},'PATCH',422);
const passed=['new seller saves verified Finnish kitchen coordinates','foreign kitchen address rejected without overwriting previous location','general profile address edit revalidates and updates coordinates','incomplete kitchen address rejected'];
console.log(passed.map(s=>'PASS '+s).join('\n'));await writeFile('artifacts/location-qa/seller-results.json',JSON.stringify({passed},null,2));
