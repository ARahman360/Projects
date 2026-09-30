import dotenv from 'dotenv';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({quiet:true});
process.env.NODE_ENV='development';
import assert from 'node:assert/strict';
import {randomUUID,scryptSync} from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import {unlink} from 'node:fs/promises';
import path from 'node:path';
const {db}=await import('../src/prisma/db.ts');
const {verificationFields}=await import('../src/lib/address-policy.ts');
const {isNationwideDevelopmentMode}=await import('../src/lib/feature-flags.ts');
assert.ok(isNationwideDevelopmentMode(),'Run isolated fixtures only in development sandbox');
const base='http://localhost:3000',suffix=randomUUID(),users=[],shops=[],orders=[],images=[];
const password=randomUUID()+'aA1!',salt=randomUUID();
const hash='scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex');
let count=0;
async function api(who,url,body,method=body?'PATCH':'GET',status=200){
 const r=await fetch(base+url,{method,headers:{Origin:base,'Content-Type':'application/json',...(who?{Cookie:who.cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal(r.status,status,method+' '+url+' status');count++;
 return r.status===204?null:r.json();
}
try{
 const accounts=[];
 for(const role of ['CUSTOMER','CUSTOMER','SELLER','SELLER','RIDER','RIDER','ADMIN']){
  const user=await db.orm.public.User.create({email:'security-'+accounts.length+'-'+suffix+'@homefoods.test',name:'[TEST] Security '+role,password:hash,role});
  users.push(user.id);
  const r=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({intent:'login',email:user.email,password})});
  assert.equal(r.status,200,'real login');count++;
  accounts.push({user,cookie:r.headers.get('set-cookie').split(';')[0]});
 }
 const [buyer,otherBuyer,seller,otherSeller,rider,otherRider,admin]=accounts;
 for(const who of [seller,otherSeller]){
  const shop=await db.orm.public.Shop.create({sellerId:who.user.id,name:'[TEST] Security kitchen '+who.user.id,status:'ACTIVE',isOnline:true,address:'[SANDBOX LOCATION] Mannerheimintie 9, Helsinki',city:'Helsinki',latitude:60.1699,longitude:24.9384,phone:'private-phone',email:'private@example.test',deliveryFee:0});
  shops.push(shop.id);who.shop=shop;
 }
 for(const who of [rider,otherRider])await db.orm.public.Rider.create({userId:who.user.id,isVerified:true,isAvailable:true});
 const item=await db.orm.public.MenuItem.create({shopId:seller.shop.id,name:'[TEST] Security dish',price:5});
 const fields={addressLine1:'Mannerheimintie 9',city:'Helsinki',postalCode:'00100',countryCode:'FI',latitude:60.1699,longitude:24.9384};
 const address=await db.orm.public.Address.create({userId:buyer.user.id,...fields,...verificationFields(fields)});
 for(const url of ['/api/account','/api/addresses','/api/favorites','/api/orders','/api/notifications','/api/seller','/api/rider','/api/admin/operations'])await api(null,url,undefined,'GET',401);
 await api(buyer,'/api/account',{action:'profile',name:'[TEST] Updated security buyer',phone:''});
 assert.equal((await api(buyer,'/api/account')).user.id,buyer.user.id);
 assert.ok(!(await api(otherBuyer,'/api/addresses')).addresses.some(a=>a.id===address.id));
 await api(otherBuyer,'/api/addresses',{id:address.id},'DELETE',404);
 await api(buyer,'/api/addresses',{id:address.id,action:'default'});
 await api(buyer,'/api/favorites',{menuItemId:item.id,customerId:otherBuyer.user.id},'POST');
 assert.ok((await api(buyer,'/api/favorites')).favorites.some(f=>f.menuItemId===item.id));
 assert.equal((await api(otherBuyer,'/api/favorites')).favorites.length,0);
 await api(otherSeller,'/api/seller',{itemId:item.id,name:'Forbidden'},'PATCH',404);
 await api(seller,'/api/seller',{itemId:item.id,name:item.name,price:6});
 for(const who of [buyer,seller,rider])await api(who,'/api/admin/operations',undefined,'GET',403);
 await api(admin,'/api/admin/operations');
 await api(buyer,'/api/account',{action:'profile',name:'[TEST] Updated security buyer',phone:'',role:'ADMIN'},'PATCH',422);
 const catalog=await api(null,'/api/catalog?q='+encodeURIComponent(item.name));
 assert.ok(catalog.results.some(d=>d.id===item.id),'public search');
 const kitchen=(await api(null,'/api/kitchens/'+seller.shop.id)).shop;
 for(const field of ['seller','sellerId','phone','email','address','latitude','longitude','locationVerificationHash'])assert.ok(!(field in kitchen),'private field '+field);
 assert.ok(kitchen.menuItems.some(i=>i.id===item.id));
 const created=await api(buyer,'/api/orders',{lines:[{menuItemId:item.id,quantity:1}],addressId:address.id,paymentMethod:'CASH',notes:'Isolated security QA; no real delivery.',idempotencyKey:randomUUID()},'POST',201);
 const orderId=created.orders[0].orderId;orders.push(orderId);
 assert.ok(!(await api(otherBuyer,'/api/orders')).orders.some(o=>o.id===orderId));
 await api(otherSeller,'/api/seller/orders',{orderId,status:'CONFIRMED'},'PATCH',404);
 for(const status of ['CONFIRMED','PREPARING','READY_FOR_PICKUP'])await api(seller,'/api/seller/orders',{orderId,status});
 const delivery=await db.orm.public.Delivery.where({orderId}).first();
 await api(rider,'/api/rider',{isAvailable:true});
 await api(rider,'/api/rider',{deliveryId:delivery.id,status:'ACCEPTED'});
 await api(otherRider,'/api/rider',{deliveryId:delivery.id,status:'PICKED_UP'},'PATCH',403);
 for(const status of ['PICKED_UP','DELIVERED'])await api(rider,'/api/rider',{deliveryId:delivery.id,status});
 assert.equal((await db.orm.public.Order.where({id:orderId}).first()).status,'DELIVERED');
 const notices=(await api(buyer,'/api/notifications')).notifications;
 assert.ok(notices.length>0);
 await api(otherBuyer,'/api/notifications',{id:notices[0].id},'PATCH',404);
 await api(buyer,'/api/notifications',{id:notices[0].id});
 const bytes=await sharp({create:{width:80,height:80,channels:3,background:'#ffffff'}}).png().toBuffer();
 const upload=await fetch(base+'/api/uploads',{method:'POST',headers:{Origin:base,Cookie:seller.cookie,'Content-Type':'image/png'},body:bytes});
 assert.equal(upload.status,201);count++;const image=(await upload.json()).imageUrl;images.push(image);
 await api(seller,'/api/seller',{itemId:item.id,imageUrl:image});
 const otherItem=await db.orm.public.MenuItem.create({shopId:otherSeller.shop.id,name:'[TEST] Other dish',price:5});
 await api(otherSeller,'/api/seller',{itemId:otherItem.id,imageUrl:image},'PATCH',403);
 assert.equal((await fetch(base+image)).status,200);
 console.log(JSON.stringify({result:'PASS',checks:count,coverage:['real login','own profile','customer address/favorite/order/notification isolation','seller ownership','admin role enforcement','public catalog/search and private field filtering','cash checkout','seller fulfillment','rider assignment and delivery ownership','own upload and foreign image rejection']}));
}catch(e){console.error(JSON.stringify({result:'FAIL',message:e instanceof assert.AssertionError?e.message:'Workflow error (details suppressed to protect session data)'}));process.exitCode=1;}
finally{
 const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
 try{
  await c.query('BEGIN');
  for(const table of ['notification','checkoutRequest'])await c.query('DELETE FROM public."'+table+'" WHERE "userId"=ANY($1::int[])',[users]);
  for(const table of ['favorite','kitchenFavorite'])await c.query('DELETE FROM public."'+table+'" WHERE "customerId"=ANY($1::int[])',[users]);
  for(const table of ['orderStatusEvent','delivery','payment','orderItem'])await c.query('DELETE FROM public."'+table+'" WHERE "orderId"=ANY($1::int[])',[orders]);
  await c.query('DELETE FROM public."order" WHERE id=ANY($1::int[])',[orders]);
  await c.query('DELETE FROM public."menuItem" WHERE "shopId"=ANY($1::int[])',[shops]);
  await c.query('DELETE FROM public.shop WHERE id=ANY($1::int[])',[shops]);
  for(const table of ['address','rider'])await c.query('DELETE FROM public."'+table+'" WHERE "userId"=ANY($1::int[])',[users]);
  await c.query('DELETE FROM public."user" WHERE id=ANY($1::int[])',[users]);
  await c.query('COMMIT');
 }catch{await c.query('ROLLBACK');console.error('Fixture cleanup failed; inspect fixture IDs '+users.join(','));process.exitCode=1;}
 finally{await c.end();await db.close();}
 for(const ref of images){const relative=ref.replace('/api/media/','');if(/^[0-9]+\/[a-f0-9-]+\.webp$/.test(relative))await unlink(path.join(process.env.HOMEFOODS_UPLOAD_DIR||'.data/uploads',relative)).catch(()=>{});}
}
