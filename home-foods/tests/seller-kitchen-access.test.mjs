import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import SellerKitchenAccess from '../src/components/seller-kitchen-access.tsx';

globalThis.React = React;
const complete = { id: 17, status: 'ACTIVE', profileCompletedAt: '2026-09-30', locationIsVerified: true };

for (const isOnline of [true, false]) {
  test(`seller kitchen link works when ${isOnline ? 'online' : 'offline'}`, () => {
    assert.equal(SellerKitchenAccess({ shop: { ...complete, isOnline } }).props.href, '/kitchens/17');
  });
}
for (const status of ['PENDING', 'SUSPENDED', 'CLOSED']) {
  test(`${status} kitchen does not expose a public preview link`, () => {
    assert.equal(SellerKitchenAccess({ shop: { ...complete, status } }).props.href, undefined);
  });
}
for (const shop of [{}, { ...complete, profileCompletedAt: null }, { ...complete, locationIsVerified: false }]) {
  test('incomplete kitchen directs seller to setup', () => {
    assert.equal(SellerKitchenAccess({ shop }).props.href, '/workspace#kitchen-settings');
  });
}
