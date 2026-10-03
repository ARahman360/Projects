import dotenv from 'dotenv';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({quiet:true});
process.env.NODE_ENV='development';
import assert from 'node:assert/strict';
import {randomUUID,scryptSync} from 'node:crypto';
import pg from 'pg';
const {db}=await import('../src/prisma/db.ts');
const {verificationFields}=await import('../src/lib/address-policy.ts');
const {isNationwideDevelopmentMode}=await import('../src/lib/feature-flags.ts');
assert.ok(isNationwideDevelopmentMode(),'Requires development sandbox');
const base='http://localhost:3000',users=[],shops=[],suffix=randomUUID();
const password=randomUUID()+'aA1!',salt=randomUUID(),hash='scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex');
let checks=0;
async function api(who,url,body,method=body?'PATCH':'GET',status=200){
 const response=await fetch(base+url,{method,headers:{Origin:base,'Content-Type':'application/json',...(who?{Cookie:who.cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();assert.equal(response.status,status,`${method} ${url}: ${data.error??''}`);checks++;return data;
}
try{
 const accounts=[];
 for(const role of ['SELLER','SELLER','CUSTOMER','RIDER','ADMIN']){
  const user=await db.orm.public.User.create({email:`portion-${accounts.length}-${suffix}@homefoods.test`,name:'[TEST] Portion '+role,password:hash,role});users.push(user.id);
  const response=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({intent:'login',email:user.email,password})});assert.equal(response.status,200);checks++;
  accounts.push({user,cookie:response.headers.get('set-cookie').split(';')[0]});
 }
 const [seller,other,buyer,rider,admin]=accounts;
 for(const who of [seller,other]){who.shop=await db.orm.public.Shop.create({sellerId:who.user.id,name:'[TEST] Portions '+who.user.id,status:'ACTIVE',isOnline:true,address:'[SANDBOX LOCATION] Mannerheimintie 9, Helsinki',city:'Helsinki',latitude:60.1699,longitude:24.9384,deliveryFee:0});shops.push(who.shop.id);}
 await db.orm.public.Rider.create({userId:rider.user.id,isVerified:true,isAvailable:true});
 const fields={addressLine1:'Mannerheimintie 9',city:'Helsinki',postalCode:'00100',countryCode:'FI',latitude:60.1699,longitude:24.9384};
 const address=await db.orm.public.Address.create({userId:buyer.user.id,...fields,...verificationFields(fields)});
 const drafts=[{name:'Small',price:6.9,isAvailable:true,isDefault:false},{name:'Regular',price:8.9,isAvailable:true,isDefault:true},{name:'Large',price:10.9,isAvailable:false,isDefault:false}];
 const item=(await api(seller,'/api/seller',{name:'[TEST] Portion wings',price:8.9,options:drafts},'POST',201)).item;
 let options=(await api(seller,'/api/seller')).items.find(row=>row.id===item.id).options;
 assert.equal(options.length,3);assert.equal(options.find(row=>row.name==='Regular').isDefault,true);
 const [small,regular,large]=options;
 await api(other,'/api/seller',{itemId:item.id,options:[]},'PATCH',404);
 const foreign=(await api(other,'/api/seller',{name:'Other dish',price:5,options:[drafts[0]]},'POST',201)).item;
 const foreignOption=(await api(other,'/api/seller')).items.find(row=>row.id===foreign.id).options[0];
 await api(seller,'/api/seller',{itemId:item.id,options:[foreignOption]},'PATCH',422);
 await api(seller,'/api/seller',{itemId:item.id,options:options.map(row=>({...row,isDefault:true}))},'PATCH',422);
 await api(seller,'/api/seller',{itemId:item.id,options:[{...small,price:-1}]},'PATCH',422);
 const publicItem=(await api(null,'/api/kitchens/'+seller.shop.id)).shop.menuItems.find(row=>row.id===item.id);
 assert.equal(publicItem.options.length,3);assert.equal(publicItem.isAvailable,true);
 assert.equal(publicItem.options.some(row=>'menuItemId' in row||'createdAt' in row),false);
 const orderBody=lines=>({lines,addressId:address.id,paymentMethod:'CASH',idempotencyKey:randomUUID()});
 await api(buyer,'/api/orders',orderBody([{menuItemId:item.id,quantity:1}]),'POST',409);
 await api(buyer,'/api/orders',orderBody([{menuItemId:item.id,optionId:large.id,quantity:1}]),'POST',409);
 await api(buyer,'/api/orders',orderBody([{menuItemId:item.id,optionId:foreignOption.id,quantity:1}]),'POST',409);
 const body=orderBody([{menuItemId:item.id,optionId:small.id,quantity:2,price:0.01},{menuItemId:item.id,optionId:regular.id,quantity:1,price:0.01}]);
 const orderId=(await api(buyer,'/api/orders',body,'POST',201)).orders[0].orderId;
 assert.equal((await api(buyer,'/api/orders',body,'POST',201)).orders[0].orderId,orderId);
 const saved=await db.orm.public.Order.where({id:orderId}).include('items').first();
 assert.equal(saved.items.length,2);assert.equal(saved.subtotal,22.7);
 const smallLine=saved.items.find(row=>JSON.parse(row.options).variantId===small.id);
 assert.equal(smallLine.unitPrice,6.9);assert.equal(smallLine.quantity,2);assert.equal(smallLine.name,item.name+' — Small');
 assert.equal(JSON.parse(smallLine.options).dishName,item.name);
 for(const [who,url] of [[buyer,'/api/orders'],[seller,'/api/seller'],[admin,'/api/admin/operations']]){
  const data=await api(who,url);assert.ok(data.orders.find(row=>row.id===orderId).items.some(row=>row.name.endsWith(' — Small')));
 }
 for(const status of ['CONFIRMED','PREPARING','READY_FOR_PICKUP'])await api(seller,'/api/seller/orders',{orderId,status});
 const riderView=await api(rider,'/api/rider');assert.ok(riderView.jobs.find(row=>row.orderId===orderId).order.items.some(row=>row.name.endsWith(' — Regular')));
 await api(seller,'/api/seller',{itemId:item.id,options:options.filter(row=>row.id!==small.id).map(row=>({...row,price:11.9,name:row.id===regular.id?'Regular revised':row.name}))});
 const history=await db.orm.public.OrderItem.where({orderId}).all();assert.deepEqual(history,saved.items);
 await api(buyer,'/api/orders',orderBody([{menuItemId:item.id,optionId:small.id,quantity:1}]),'POST',409);
 options=(await api(seller,'/api/seller')).items.find(row=>row.id===item.id).options;
 await api(seller,'/api/seller',{itemId:item.id,options:options.map(row=>({...row,isAvailable:false}))});
 assert.equal((await api(null,'/api/kitchens/'+seller.shop.id)).shop.menuItems.find(row=>row.id===item.id).isAvailable,false);
 await api(seller,'/api/seller',{itemId:item.id,options:[]});
 await api(buyer,'/api/orders',orderBody([{menuItemId:item.id,quantity:1}]),'POST',201);
 console.log(JSON.stringify({result:'PASS',apiChecks:checks,coverage:'seller save/reload/default/validation/ownership; public options; unavailable/foreign/missing/removed options; tampered-price rejection; two sizes and quantity; idempotency; customer/seller/rider/admin snapshots; historical price/name retention; all sold out; base-price fallback'}));
}finally{
 const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
 try{await client.query('BEGIN');
 const ids=(await client.query('SELECT id FROM public."order" WHERE "customerId"=ANY($1::int[])',[users])).rows.map(row=>row.id);
 for(const table of ['notification','checkoutRequest'])await client.query(`DELETE FROM public."${table}" WHERE "userId"=ANY($1::int[])`,[users]);
 for(const table of ['orderStatusEvent','delivery','payment','orderItem'])await client.query(`DELETE FROM public."${table}" WHERE "orderId"=ANY($1::int[])`,[ids]);
 await client.query('DELETE FROM public."order" WHERE id=ANY($1::int[])',[ids]);
 await client.query('DELETE FROM public."menuItemOption" WHERE "menuItemId" IN (SELECT id FROM public."menuItem" WHERE "shopId"=ANY($1::int[]))',[shops]);
 await client.query('DELETE FROM public."menuItem" WHERE "shopId"=ANY($1::int[])',[shops]);await client.query('DELETE FROM public.shop WHERE id=ANY($1::int[])',[shops]);
 for(const table of ['address','rider'])await client.query(`DELETE FROM public."${table}" WHERE "userId"=ANY($1::int[])`,[users]);
 await client.query('DELETE FROM public."user" WHERE id=ANY($1::int[])',[users]);await client.query('COMMIT');console.log('Disposable portion fixtures removed.');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();await db.close();}
}
