"use client";

import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import BasketDrawer from './basket-drawer';
import type {CartLine} from '@/src/lib/basket';

export default function KitchenBasket({customerId,signedIn}:{customerId:number|null;signedIn:boolean}) {
  const router=useRouter();
  const [open,setOpen]=useState(false),[cart,setCart]=useState<CartLine[]>([]),[notes,setNotes]=useState('');
  const trigger=useRef<HTMLElement|null>(null);
  const key=`home-foods-cart:${customerId??'guest'}`;
  useEffect(()=>{
    const read=()=>{try{const value=JSON.parse(localStorage.getItem(key)??'[]');setCart(Array.isArray(value)?value:[]);}catch{setCart([]);}};
    const show=()=>{trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;read();setNotes(sessionStorage.getItem(`${key}:notes`)??'');setOpen(true);};
    window.addEventListener('homefoods:open-basket',show);
    window.addEventListener('homefoods:cart-change',read);
    window.addEventListener('storage',read);
    return()=>{window.removeEventListener('homefoods:open-basket',show);window.removeEventListener('homefoods:cart-change',read);window.removeEventListener('storage',read);};
  },[key]);
  function save(next:CartLine[]){localStorage.setItem(key,JSON.stringify(next));setCart(next);window.dispatchEvent(new Event('homefoods:cart-change'));}
  function saveNotes(value:string){setNotes(value);sessionStorage.setItem(`${key}:notes`,value);}
  return <BasketDrawer cart={cart} open={open} onClose={()=>setOpen(false)} triggerRef={trigger}
    changeQuantity={(id,delta)=>save(cart.map(line=>line.dish.id===id?{...line,quantity:line.quantity+delta}:line).filter(line=>line.quantity>0))}
    onRemove={id=>save(cart.filter(line=>line.dish.id!==id))} cartNotes={notes} setCartNotes={saveNotes}
    user={signedIn} openCheckout={()=>{setOpen(false);router.push('/?cart=open');}}/>;
}
