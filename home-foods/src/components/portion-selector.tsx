'use client';
import {useRef,useState} from 'react';
import OverlayLayer from './overlay-layer';
import {resolveModifiers,customizedPrice,type ModifierSelection,type ModifierSnapshot} from '@/src/lib/modifiers';
import {defaultPortion} from '@/src/lib/portion-options';
import type {Dish} from '@/src/lib/basket';
const money=(value:number)=>new Intl.NumberFormat('fi-FI',{style:'currency',currency:'EUR'}).format(value);

// Mount per selected dish so selection and quantity reset when it changes.
export default function PortionSelector({dish,onClose,onAdd}:{dish:Dish;onClose:()=>void;onAdd:(dish:Dish,quantity:number)=>void}){
  const dialog=useRef<HTMLDivElement>(null);
  const [selected,setSelected]=useState(defaultPortion(dish.options)?.id);
  const [quantity,setQuantity]=useState(1);
  const [selections,setSelections]=useState<ModifierSelection[]>([]);
  const groups=dish.modifierGroups??[];
  let extras:ModifierSnapshot[]=[],error='';
  try{extras=resolveModifiers(groups,selections);}catch(e){error=e instanceof Error?e.message:'Choose your customizations.';extras=selections.flatMap(s=>{const g=groups.find(g=>g.id===s.groupId),o=g?.options.find(o=>o.id===s.optionId);return g&&o?[{...s,groupName:g.name,name:o.name,price:o.price}]:[];});}
  const option=dish.options?.find(option=>option.id===selected&&option.isAvailable);
  const price=customizedPrice(option?.price??dish.price,extras);
  const valid=(!dish.options?.length||Boolean(option))&&!error;
  return <OverlayLayer open onClose={onClose} dialogRef={dialog} label={`Customize ${dish.name}`} className="auth-overlay" dialogClassName="portion-dialog" dismissOnBackdrop>
    <div className="portion-heading"><div><h2>{dish.name}</h2><p>Make it yours</p></div><button type="button" className="close-button" aria-label="Close portion selector" onClick={onClose}>×</button></div>
    {!!dish.options?.length&&<fieldset className="portion-choices"><legend className="sr-only">Portion or size</legend>{dish.options?.map(row=><label key={row.id} className="portion-choice" data-selected={selected===row.id} data-unavailable={!row.isAvailable}><input type="radio" name="portion" value={row.id} checked={selected===row.id} disabled={!row.isAvailable} onChange={()=>setSelected(row.id)}/><span>{row.name}{!row.isAvailable&&<small>Sold out</small>}</span><strong>{money(row.price)}</strong></label>)}</fieldset>}
    {groups.map(g=><details className="modifier-group" key={g.id} open><summary>{g.name} <small>{g.required?'Required':'Optional'} · {g.multiple?`Choose up to ${g.max}`:'Choose one'}</small></summary><fieldset className="portion-choices"><legend className="sr-only">{g.name}</legend>{g.options.map(o=>{const checked=selections.some(s=>s.groupId===g.id&&s.optionId===o.id);const count=selections.filter(s=>s.groupId===g.id).length;return <label className="portion-choice" key={o.id} data-selected={checked} data-unavailable={!o.isAvailable}><input type={g.multiple?'checkbox':'radio'} name={g.id} checked={checked} disabled={!o.isAvailable||g.multiple&&!checked&&count>=g.max} onChange={()=>setSelections(current=>g.multiple?checked?current.filter(s=>s.groupId!==g.id||s.optionId!==o.id):[...current,{groupId:g.id,optionId:o.id}]:[...current.filter(s=>s.groupId!==g.id),{groupId:g.id,optionId:o.id}])}/><span>{o.name}{!o.isAvailable&&<small>Sold out</small>}</span><strong>{o.price?'+ '+money(o.price):'Free'}</strong></label>;})}{!g.required&&!g.multiple&&<button type="button" onClick={()=>setSelections(current=>current.filter(s=>s.groupId!==g.id))}>Clear choice</button>}</fieldset></details>)}
    {error&&<p className="modifier-validation" role="status">{error}</p>}
    <div className="portion-quantity"><span>Quantity <small>Number of portions</small></span><div className="quantity-control"><button type="button" disabled={quantity<=1} aria-label="Decrease portion quantity" onClick={()=>setQuantity(value=>Math.max(1,value-1))}>−</button><output aria-live="polite">{quantity}</output><button type="button" disabled={quantity>=25} aria-label="Increase portion quantity" onClick={()=>setQuantity(value=>Math.min(25,value+1))}>+</button></div></div>
    <button type="button" className="dark-cta portion-add" disabled={!valid} onClick={()=>{if(valid){onAdd({...dish,price,selectedOption:option,selectedModifiers:extras,customized:true},quantity);onClose();}}}>Add to basket — {money(price*quantity)}</button>
  </OverlayLayer>;
}
