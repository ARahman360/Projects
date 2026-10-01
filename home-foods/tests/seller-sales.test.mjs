import test from 'node:test';import assert from 'node:assert/strict';
import {sellerSales} from '../src/lib/seller-sales.ts';
const sale=(amount,extra={})=>({status:'DELIVERED',payment:{status:'PAID',amount,currency:'EUR'},...extra});
test('all-time collected totals exclude cancelled, unpaid, refunded and sandbox orders',()=>{
 const result=sellerSales([sale(10.1),sale(20.2),sale(50,{status:'CANCELLED'}),sale(3,{status:'PENDING'}),sale(5,{isSandbox:true}),sale(8,{payment:{status:'REFUNDED',amount:8}}),sale(9,{payment:null})]);
 assert.deepEqual(result,{collected:30.3,testCollected:5,paidOrders:2,unpaidOrders:2,completed:5});
});
test('empty and invalid payment amounts do not invent earnings',()=>{
 assert.equal(sellerSales([]).collected,0);
 assert.equal(sellerSales([sale('bad'),sale(-2),sale(4,{payment:{status:'PAID',amount:4,currency:'USD'}})]).collected,0);
});
