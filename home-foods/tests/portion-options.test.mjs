import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePortions,resolvePortion,defaultPortion,portionPrice} from '../src/lib/portion-options.ts';
import {addBasketLine,basketTotals,basketLineKey} from '../src/lib/basket.ts';
const options=[{id:1,name:'Small',price:6.9,isAvailable:true,isDefault:false},{id:2,name:'Regular',price:8.9,isAvailable:true,isDefault:true},{id:3,name:'Large',price:10.9,isAvailable:false,isDefault:false}];
test('seller validates labels, prices, availability and a unique default',()=>{
 assert.deepEqual(validatePortions(options),options);
 for(const value of [null,options.map(o=>({...o,isDefault:true})),[options[0],options[0]],[{...options[0],price:NaN}],[{...options[0],price:0}],[{...options[0],isAvailable:'yes'}]])assert.throws(()=>validatePortions(value));
});
test('available default and display price do not choose sold-out options',()=>{
 assert.equal(defaultPortion(options).id,2);
 assert.equal(defaultPortion(options.map(o=>({...o,isAvailable:o.id===1}))).id,1);
 assert.equal(defaultPortion(options.map(o=>({...o,isAvailable:false}))),undefined);
 assert.deepEqual(portionPrice(99,options),{price:6.9,from:true});
 assert.deepEqual(portionPrice(99,options.map(o=>({...o,price:7}))),{price:7,from:false});
 assert.deepEqual(portionPrice(4),{price:4,from:false});
});
test('checkout requires an available option, rejects removed references, preserves base dishes',()=>{
 assert.equal(resolvePortion({price:99,options},1).price,6.9);
 for(const id of [undefined,3,99,'1'])assert.throws(()=>resolvePortion({price:99,options},id));
 assert.equal(resolvePortion({price:4,options:[]},undefined).price,4);
 assert.throws(()=>resolvePortion({price:4,options:[]},1));
});
test('different sizes remain separate and quantity counts whole portions',()=>{
 const base={id:9,shopId:4,price:99,deliveryFee:0};
 const small={...base,price:6.9,selectedOption:options[0]},regular={...base,price:8.9,selectedOption:options[1]};
 let cart=addBasketLine([],small,2);cart=addBasketLine(cart,regular);cart=addBasketLine(cart,small);
 assert.equal(cart.length,2);assert.equal(cart[0].quantity,3);assert.equal(cart[1].quantity,1);
 assert.notEqual(basketLineKey(small),basketLineKey(regular));assert.notEqual(basketLineKey(base),basketLineKey(small));
 assert.equal(Math.round(basketTotals(cart).subtotal*100),2960);
 assert.equal(addBasketLine(cart,small,25)[0].quantity,25);
});
