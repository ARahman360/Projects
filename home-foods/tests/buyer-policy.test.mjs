import test from 'node:test';
import assert from 'node:assert/strict';
import {canBuy, ownsKitchen, canDeliverOrder} from '../src/lib/buyer-policy.ts';
test('existing customer, seller and rider accounts share buying capability',()=>{
  for(const role of ['CUSTOMER','SELLER','RIDER'])assert.equal(canBuy(role),true);
  for(const role of ['ADMIN',undefined,'guest'])assert.equal(canBuy(role),false);
});
test('own kitchen uses stable account IDs',()=>{
  assert.equal(ownsKitchen(7,7),true);assert.equal(ownsKitchen(7,8),false);
  assert.equal(ownsKitchen(undefined,undefined),false);
});
test('riders cannot deliver their personal or scheduled orders',()=>{
  assert.equal(canDeliverOrder(7,7),false);assert.equal(canDeliverOrder(8,7),true);
});
