import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateModifierGroups,resolveModifiers,customizedPrice,modifierKey,snapshotModifiers} from '../src/lib/modifiers.ts';
import {addBasketLine} from '../src/lib/basket.ts';
const groups=[{id:'extras',name:'Extras',required:false,multiple:true,min:0,max:2,options:[{id:'cheese',name:'Extra cheese',price:1,isAvailable:true},{id:'meat',name:'Extra meat',price:2.5,isAvailable:true},{id:'sauce',name:'Sauce',price:0.5,isAvailable:false}]},{id:'spice',name:'Spice level',required:true,multiple:false,min:1,max:1,options:[{id:'mild',name:'Mild',price:0,isAvailable:true},{id:'hot',name:'Spicy',price:0,isAvailable:true}]}];
const mild={groupId:'spice',optionId:'mild'},cheese={groupId:'extras',optionId:'cheese'},meat={groupId:'extras',optionId:'meat'};
test('groups round trip and allow free preferences',()=>assert.deepEqual(validateModifierGroups(JSON.parse(JSON.stringify(groups))),groups));
test('required, single, availability, foreign, duplicate and maximum rules',()=>{
 for(const choices of [[],[cheese],[mild,{groupId:'spice',optionId:'hot'}],[mild,{groupId:'extras',optionId:'sauce'}],[mild,{groupId:'other',optionId:'cheese'}],[mild,cheese,cheese]])assert.throws(()=>resolveModifiers(groups,choices));
 assert.throws(()=>resolveModifiers([{...groups[0],max:1}], [cheese,meat]));
 assert.equal(resolveModifiers(groups,[mild]).length,1);
});
test('invalid seller configuration rejected',()=>{
 for(const change of [{min:3,max:2},{required:false,min:1},{multiple:false,max:2},{options:[{id:'x',name:'Bad',price:-1,isAvailable:true}]},{options:[]}])assert.throws(()=>validateModifierGroups([{...groups[0],...change}]));
});
test('live price, quantity, canonical basket lines and immutable snapshot',()=>{
 const selected=resolveModifiers(groups,[mild,cheese,meat]);
 assert.equal(customizedPrice(10,selected),13.5);
 assert.equal(customizedPrice(10,selected)*2,27);
 const dish={id:1,price:13.5,selectedOption:{id:1},selectedModifiers:selected};
 let cart=addBasketLine([],dish,2);
 cart=addBasketLine(cart,{...dish,selectedModifiers:[...selected].reverse()});
 assert.equal(cart.length,1);assert.equal(cart[0].quantity,3);
 cart=addBasketLine(cart,{...dish,selectedModifiers:resolveModifiers(groups,[mild,cheese]),price:11});
 assert.equal(cart.length,2);
 assert.equal(modifierKey(selected),modifierKey([...selected].reverse()));
 const snapshot=JSON.stringify({modifiers:selected});const changed=structuredClone(groups);changed[0].options[0].price=9;
 assert.equal(resolveModifiers(changed,[mild,cheese])[1].price,9);
 assert.equal(snapshotModifiers(snapshot)[1].price,1);
});
