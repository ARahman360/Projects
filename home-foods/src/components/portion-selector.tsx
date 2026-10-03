'use client';
import {useRef,useState} from 'react';
import OverlayLayer from './overlay-layer';
import {defaultPortion} from '@/src/lib/portion-options';
import type {Dish} from '@/src/lib/basket';
const money=(value:number)=>new Intl.NumberFormat('fi-FI',{style:'currency',currency:'EUR'}).format(value);

// Mount per selected dish so selection and quantity reset when it changes.
export default function PortionSelector({dish,onClose,onAdd}:{dish:Dish;onClose:()=>void;onAdd:(dish:Dish,quantity:number)=>void}){
  const dialog=useRef<HTMLDivElement>(null);
  const [selected,setSelected]=useState(defaultPortion(dish.options)?.id);
  const [quantity,setQuantity]=useState(1);
  const option=dish.options?.find(option=>option.id===selected&&option.isAvailable);
  return <OverlayLayer open onClose={onClose} dialogRef={dialog} label={`Choose a portion for ${dish.name}`} className="auth-overlay" dialogClassName="portion-dialog" dismissOnBackdrop>
    <div className="portion-heading"><div><h2>{dish.name}</h2><p>Choose your portion or size</p></div><button type="button" className="close-button" aria-label="Close portion selector" onClick={onClose}>×</button></div>
    <fieldset className="portion-choices"><legend className="sr-only">Portion or size</legend>{dish.options?.map(row=><label key={row.id} className="portion-choice" data-selected={selected===row.id} data-unavailable={!row.isAvailable}><input type="radio" name="portion" value={row.id} checked={selected===row.id} disabled={!row.isAvailable} onChange={()=>setSelected(row.id)}/><span>{row.name}{!row.isAvailable&&<small>Sold out</small>}</span><strong>{money(row.price)}</strong></label>)}</fieldset>
    <div className="portion-quantity"><span>Quantity <small>Number of portions</small></span><div className="quantity-control"><button type="button" disabled={quantity<=1} aria-label="Decrease portion quantity" onClick={()=>setQuantity(value=>Math.max(1,value-1))}>−</button><output aria-live="polite">{quantity}</output><button type="button" disabled={quantity>=25} aria-label="Increase portion quantity" onClick={()=>setQuantity(value=>Math.min(25,value+1))}>+</button></div></div>
    <button type="button" className="dark-cta portion-add" disabled={!option} onClick={()=>{if(option){onAdd({...dish,price:option.price,selectedOption:option},quantity);onClose();}}}>Add to basket{option?` — ${money(option.price*quantity)}`:''}</button>
  </OverlayLayer>;
}
