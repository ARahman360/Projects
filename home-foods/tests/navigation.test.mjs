import assert from 'node:assert/strict';
import test from 'node:test';
import {discoveryNavigation, personalNavigation, roleDestinations, workspaceNavigation, isNavigationActive, adminSections, workspaceDefaultHash} from '../src/lib/navigation.ts';

test('role shortcuts and independent customer routes are centralized',()=>{
 assert.equal(roleDestinations.SELLER.href,'/workspace#seller-dashboard');
 assert.equal(roleDestinations.RIDER.href,'/workspace#rider-dashboard');
 assert.equal(roleDestinations.ADMIN.href,'/workspace/admin');
 assert.equal(roleDestinations.CUSTOMER,undefined);
 assert.deepEqual(personalNavigation('CUSTOMER').map(i=>i.href),['/orders','/meal-plans','/favorites']);
 for(const role of ['SELLER','RIDER','ADMIN'])assert.ok(!personalNavigation(role).some(i=>i.href==='/favorites'));
 assert.ok(workspaceNavigation('CUSTOMER').some(i=>i.href==='/workspace#addresses'));
 assert.equal(discoveryNavigation[1].href,'/#home-sections');
 assert.ok(adminSections.some(([key])=>key==='customers'));
});
test('active navigation distinguishes hashes, nested routes, and similarly named paths',()=>{
 assert.equal(isNavigationActive('/','/','#home-sections'),false);
 assert.equal(isNavigationActive('/#home-sections','/','#home-sections'),true);
 assert.equal(isNavigationActive('/workspace#profile','/workspace','#seller-dashboard'),false);
 assert.equal(isNavigationActive('/workspace/admin','/workspace/admin/kitchens/1',''),true);
 assert.equal(isNavigationActive('/orders','/orders-history',''),false);
 assert.equal(isNavigationActive('/favorites','/orders',''),false);
 assert.equal(isNavigationActive('/#home-sections','/kitchens/42',''),true);
 assert.equal(isNavigationActive('/workspace/admin/overview','/workspace/admin',''),true);
 assert.equal(workspaceDefaultHash('SELLER'),'#seller-dashboard');
 assert.equal(workspaceDefaultHash('RIDER'),'#rider-dashboard');
 assert.equal(workspaceDefaultHash('CUSTOMER'),'#profile');
});
