export type ModifierOption = {id:string;name:string;price:number;isAvailable:boolean};
export type ModifierGroup = {id:string;name:string;required:boolean;multiple:boolean;min:number;max:number;options:ModifierOption[]};
export type ModifierSelection = {groupId:string;optionId:string};
export type ModifierSnapshot = ModifierSelection & {groupName:string;name:string;price:number};
export class ModifierError extends Error {}
const fail=(message:string):never=>{throw new ModifierError(message);};
const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:fail('Invalid customization.');
const id=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(value)?value:fail('Invalid customization identifier.');
const name=(value:unknown)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=80?value.trim():fail('Customization names must be 1–80 characters.');
export function validateModifierGroups(value:unknown):ModifierGroup[]{
  if(!Array.isArray(value)||value.length>10)fail('Use up to 10 customization groups.');
  const groups=(value as unknown[]).map(raw=>{
    const g=record(raw);
    if(typeof g.required!=='boolean'||typeof g.multiple!=='boolean')fail('Choose required/optional and single/multiple choice.');
    if(!Number.isInteger(g.min)||!Number.isInteger(g.max)||Number(g.min)<0||Number(g.max)<1||Number(g.max)>20||Number(g.min)>Number(g.max)||(!g.multiple&&g.max!==1)||(g.required&&Number(g.min)<1)||(!g.required&&g.min!==0))fail('Required groups need a minimum of 1 or more; optional groups use 0. Check selection limits.');
    if(!Array.isArray(g.options)||!g.options.length||g.options.length>20)fail('Each group needs 1–20 options.');
    const options=(g.options as unknown[]).map(raw=>{const o=record(raw);if(typeof o.price!=='number'||!Number.isFinite(o.price)||o.price<0||o.price>500||typeof o.isAvailable!=='boolean')fail('Extras must cost €0–€500 and have an availability.');return {id:id(o.id),name:name(o.name),price:Math.round(Number(o.price)*100)/100,isAvailable:o.isAvailable as boolean};});
    if(new Set(options.map(o=>o.id)).size!==options.length||new Set(options.map(o=>o.name.toLowerCase())).size!==options.length)fail('Option names and identifiers must be unique within a group.');
    if(Number(g.min)>options.length)fail('Minimum selections exceeds the number of options.');
    return {id:id(g.id),name:name(g.name),required:g.required as boolean,multiple:g.multiple as boolean,min:Number(g.min),max:Number(g.max),options};
  });
  if(new Set(groups.map(g=>g.id)).size!==groups.length)fail('Group identifiers must be unique.');
  return groups;
}
export function readModifierGroups(value:unknown):ModifierGroup[]{
  if(value==null||value==='')return [];
  return validateModifierGroups(typeof value==='string'?JSON.parse(value):value);
}
export function validateSelections(value:unknown):ModifierSelection[]{
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>200)fail('Invalid customization selections.');
  const result=(value as unknown[]).map(raw=>{const r=record(raw);return {groupId:id(r.groupId),optionId:id(r.optionId)};});
  if(new Set(result.map(r=>r.groupId+':'+r.optionId)).size!==result.length)fail('Choose each extra only once.');
  return result;
}
export function modifierKey(value:ModifierSelection[]=[]){return value.map(r=>r.groupId+':'+r.optionId).sort().join(',');}
export function resolveModifiers(groups:ModifierGroup[],value:unknown):ModifierSnapshot[]{
  const selections=validateSelections(value);
  const resolved=selections.map(s=>{const g=groups.find(g=>g.id===s.groupId),o=g?.options.find(o=>o.id===s.optionId);if(!g||!o||!o.isAvailable)fail('A selected customization is no longer available. Please customize the dish again.');return {...s,groupName:g!.name,name:o!.name,price:o!.price};});
  for(const g of groups){const count=resolved.filter(r=>r.groupId===g.id).length;if(count<g.min||count>g.max)fail(`${g.name}: choose ${g.min===g.max?g.min:`${g.min}–${g.max}`} option${g.max===1?'':'s'}.`);}
  return resolved;
}
export function customizedPrice(base:number,extras:ModifierSnapshot[]){return Math.round((base+extras.reduce((sum,o)=>sum+o.price,0))*100)/100;}
export function snapshotModifiers(value:unknown):ModifierSnapshot[]{
  try{const parsed=typeof value==='string'?JSON.parse(value):value;const values=parsed?.modifiers;if(!Array.isArray(values))return [];return values.filter((v:ModifierSnapshot)=>typeof v.groupName==='string'&&typeof v.name==='string'&&typeof v.price==='number');}catch{return [];}
}
