import test from 'node:test';
import assert from 'node:assert/strict';
import {filterKitchens} from '../src/lib/kitchen-discovery.ts';
import {kitchenProfileError} from '../src/lib/kitchen-profile.ts';
import {pickupForOrder,pickupSnapshot} from '../src/lib/pickup-snapshot.ts';
const filters={query:'',cuisine:'',collection:'',sort:'',quick:false,free:false};
const shops=[{id:1,name:'Lahti Kitchen',city:'Lahti',cuisine:'Bangladeshi',rating:4.8,reviewCount:2,deliveryFee:0,estimatedMinutes:25,orderCount:3},{id:2,name:'Helsinki Home',city:'Helsinki',cuisine:'Indian',rating:null,reviewCount:0,deliveryFee:null,estimatedMinutes:null,orderCount:0}];
test('kitchen filters combine real cuisine, location, ratings, fees and preparation values',()=>{
 assert.deepEqual(filterKitchens(shops,{...filters,query:'helsinki'}).map(s=>s.id),[2]);
 assert.deepEqual(filterKitchens(shops,{...filters,cuisine:'Bangladeshi',quick:true,free:true}).map(s=>s.id),[1]);
 assert.deepEqual(filterKitchens(shops,{...filters,collection:'highly-rated'}).map(s=>s.id),[1]);
 assert.deepEqual(filterKitchens(shops,{...filters,collection:'popular-restaurants'}).map(s=>s.id),[1]);
 assert.deepEqual(filterKitchens(shops,{...filters,sort:'fee'}).map(s=>s.id),[1,2]);
 assert.equal(filterKitchens(shops,{...filters,cuisine:'Indian',free:true}).length,0);
});
test('profile completion requires valid persisted operational fields, not just a name',()=>{
 assert.ok(kitchenProfileError({name:'Kitchen'}));
 assert.equal(kitchenProfileError({name:'Kitchen',deliveryFee:0,estimatedMinutes:30}),null);
 assert.ok(kitchenProfileError({name:'K',deliveryFee:0,estimatedMinutes:30}));
 assert.ok(kitchenProfileError({name:'Kitchen',deliveryFee:-1,estimatedMinutes:30}));
 assert.ok(kitchenProfileError({name:'Kitchen',deliveryFee:0,estimatedMinutes:30,logoUrl:'javascript:alert(1)'}));
});
test('pickup snapshots retain the original kitchen location after edits',()=>{
 const old={name:'Kitchen',address:'Old street 1',city:'Lahti',latitude:60.9,longitude:25.6};
 const updated={...old,address:'New street 2',latitude:60.1};
 assert.deepEqual(pickupForOrder({pickupSnapshot:pickupSnapshot(old)},updated),old);
 assert.deepEqual(pickupForOrder({pickupSnapshot:null},updated),updated);
});
