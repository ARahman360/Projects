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
  const user=await db.orm.public.User.create({email:`modifier-${accounts.length}-${suffix}@homefoods.test`,name:'[TEST] Modifier '+role,password:hash,role});users.push(user.id);
  const response=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({intent:'login',email:user.email,password})});assert.equal(response.status,200);checks++;
  accounts.push({user,cookie:response.headers.get('set-cookie').split(';')[0]});
 }
 const [seller,other,buyer,rider,admin]=accounts;
 for(const who of [seller,other]){who.shop=await db.orm.public.Shop.create({sellerId:who.user.id,name:'[TEST] Modifiers '+who.user.id,status:'ACTIVE',isOnline:true,address:'[SANDBOX LOCATION] Mannerheimintie 9, Helsinki',city:'Helsinki',latitude:60.1699,longitude:24.9384,deliveryFee:0});shops.push(who.shop.id);}
 await db.orm.public.Rider.create({userId:rider.user.id,isVerified:true,isAvailable:true});
 const fields={addressLine1:'Mannerheimintie 9',city:'Helsinki',postalCode:'00100',countryCode:'FI',latitude:60.1699,longitude:24.9384};
 const address=await db.orm.public.Address.create({userId:buyer.user.id,...fields,...verificationFields(fields)});

 const modifierGroups=[{id:'extras',name:'Extras',required:false,multiple:true,min:0,max:2,options:[{id:'cheese',name:'Extra cheese',price:1,isAvailable:true},{id:'meat',name:'Extra meat',price:2.5,isAvailable:true},{id:'sauce',name:'Sauce',price:0,isAvailable:false}]},{id:'spice',name:'Spice level',required:true,multiple:false,min:1,max:1,options:[{id:'mild',name:'Mild',price:0,isAvailable:true},{id:'hot',name:'Spicy',price:0,isAvailable:true}]}];
 const item=(await api(seller,'/api/seller',{name:'[TEST] Modifier burger',price:10,options:[{name:'Large',price:10,isAvailable:true,isDefault:true}],modifierGroups},'POST',201)).item;
 const reloaded=(await api(seller,'/api/seller')).items.find(row=>row.id===item.id);
 assert.deepEqual(reloaded.modifierGroups,modifierGroups);const optionId=reloaded.options[0].id;
 await api(other,'/api/seller',{itemId:item.id,modifierGroups:[]},'PATCH',404);
 await api(seller,'/api/seller',{itemId:item.id,modifierGroups:[{...modifierGroups[0],min:4}]},'PATCH',422);
 const publicItem=(await api(null,'/api/kitchens/'+seller.shop.id)).shop.menuItems.find(row=>row.id===item.id);assert.deepEqual(publicItem.modifierGroups,modifierGroups);assert.equal(publicItem.isAvailable,true);
 const mild={groupId:'spice',optionId:'mild'},cheese={groupId:'extras',optionId:'cheese'},meat={groupId:'extras',optionId:'meat'};
 const orderBody=lines=>({lines,addressId:address.id,paymentMethod:'CASH',idempotencyKey:randomUUID()});
 const line=(modifiers,quantity=1)=>({menuItemId:item.id,optionId,modifiers,quantity,price:0.01});
 for(const selections of [[],[cheese],[mild,{groupId:'extras',optionId:'sauce'}],[mild,{groupId:'spice',optionId:'hot'}],[mild,{groupId:'foreign',optionId:'cheese'}]])await api(buyer,'/api/orders',orderBody([line(selections)]),'POST',409);
 const body=orderBody([line([mild,cheese],2),line([meat,mild])]);
 const orderId=(await api(buyer,'/api/orders',body,'POST',201)).orders[0].orderId;
 assert.equal((await api(buyer,'/api/orders',body,'POST',201)).orders[0].orderId,orderId);
 const saved=await db.orm.public.Order.where({id:orderId}).include('items').first();assert.equal(saved.items.length,2);assert.equal(saved.subtotal,34.5);
 const cheeseLine=saved.items.find(row=>JSON.parse(row.options).modifiers.some(m=>m.optionId==='cheese'));assert.equal(cheeseLine.unitPrice,11);assert.equal(cheeseLine.quantity,2);assert.equal(JSON.parse(cheeseLine.options).variantLabel,'Large');
 for(const [who,url] of [[buyer,'/api/orders'],[seller,'/api/seller']]){const result=await api(who,url);assert.ok(result.orders.find(o=>o.id===orderId).items.some(i=>JSON.parse(i.options).modifiers.some(m=>m.groupName==='Extras'&&m.name==='Extra cheese'&&m.price===1)));}
 const changed=structuredClone(modifierGroups);changed[0].options[0].price=1.5;changed[0].options=changed[0].options.filter(o=>o.id!=='meat');await api(seller,'/api/seller',{itemId:item.id,modifierGroups:changed});
 assert.deepEqual(await db.orm.public.OrderItem.where({orderId}).all(),saved.items);
 await api(buyer,'/api/orders',orderBody([line([mild,meat])]),'POST',409);
 const second=(await api(buyer,'/api/orders',orderBody([line([mild,cheese])]),'POST',201)).orders[0].orderId;assert.equal((await db.orm.public.OrderItem.where({orderId:second}).first()).unitPrice,11.5);
 await api(seller,'/api/seller',{itemId:item.id,options:[],modifierGroups:[]});
 await api(buyer,'/api/orders',orderBody([{menuItemId:item.id,quantity:1}]),'POST',201);
 console.log(JSON.stringify({result:'PASS',apiChecks:checks,coverage:'save/reload, ownership, validation, public menu, required/single/unavailable/foreign selection, authoritative price, distinct combinations, quantity, idempotency, seller/customer snapshots, price edit/removal history, legacy fallback'}));

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
 await client.query('DELETE FROM public."user" WHERE id=ANY($1::int[])',[users]);await client.query('COMMIT');console.log('Disposable modifier fixtures removed.');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();await db.close();}
}
