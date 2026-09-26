import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptsNewOrders, kitchenState, pickupTransition, reasonError } from '../src/lib/workspace-policy.ts';

test('seller availability is independent of administrative status', () => {
  assert.equal(acceptsNewOrders({status:'ACTIVE',isOnline:true}),true);
  assert.equal(acceptsNewOrders({status:'ACTIVE',isOnline:false}),false);
  assert.equal(acceptsNewOrders({status:'SUSPENDED',isOnline:true}),false);
  assert.equal(acceptsNewOrders({status:'PENDING',isOnline:true}),false);
  assert.equal(acceptsNewOrders({status:'ACTIVE',isOnline:true},'SUSPENDED'),false);
  assert.equal(kitchenState({status:'ACTIVE',isOnline:false}),'Offline');
  assert.equal(kitchenState({status:'SUSPENDED',isOnline:false}),'Suspended');
});
test('one pickup action becomes transit; retries do not generate transitions', () => {
  assert.equal(pickupTransition('ACCEPTED','PICKED_UP'),'IN_TRANSIT');
  assert.equal(pickupTransition('PICKED_UP','IN_TRANSIT'),'IN_TRANSIT');
  assert.equal(pickupTransition('IN_TRANSIT','PICKED_UP'),'ALREADY_APPLIED');
  assert.equal(pickupTransition('DELIVERED','DELIVERED'),'ALREADY_APPLIED');
  assert.equal(pickupTransition('IN_TRANSIT','DELIVERED'),'DELIVERED');
  for (const status of ['UNASSIGNED','ASSIGNED','ACCEPTED','PICKED_UP','FAILED']) assert.equal(pickupTransition(status,'DELIVERED'),null);
});
test('administrative changes require meaningful bounded review notes', () => {
  for (const value of [null,{},'', '  a ', 'x'.repeat(501)]) assert.ok(reasonError(value));
  assert.equal(reasonError('Reviewed kitchen application'),null);
});
