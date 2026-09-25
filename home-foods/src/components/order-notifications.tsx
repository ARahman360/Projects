"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import OverlayLayer from "./overlay-layer";
type Notice={id:number;orderId:number;orderNumber:string;message:string;createdAt:string;href:string};
export default function OrderNotifications(){
  const path=usePathname(),dialog=useRef<HTMLElement|null>(null),trigger=useRef<HTMLButtonElement|null>(null);
  const [owner,setOwner]=useState<number|null>(null),[items,setItems]=useState<Notice[]>([]),[seen,setSeen]=useState<number[]>([]),[open,setOpen]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    let active=true;const controller=new AbortController();
    const refresh=async()=>{if(document.hidden)return;try{
      const auth=await fetch('/api/auth',{cache:'no-store',signal:controller.signal}).then(r=>r.json());
      if(!active)return;
      if(auth.user?.role!=="CUSTOMER"){setOwner(null);setItems([]);setOpen(false);return;}
      const response=await fetch('/api/notifications',{cache:'no-store',signal:controller.signal});const data=await response.json();
      if(!active)return;if(!response.ok)throw Error(data.error??"Updates could not be refreshed.");
      setOwner(data.userId);setItems(data.notifications);setError("");
      try{const stored=JSON.parse(localStorage.getItem(`homefoods:notifications-read:${data.userId}`)??'[]');setSeen(Array.isArray(stored)?stored.filter(Number.isInteger):[]);}catch{setSeen([]);}
    }catch(e){if(active&&!controller.signal.aborted)setError(e instanceof Error?e.message:"Updates could not be refreshed.");}};
    void refresh();const timer=setInterval(()=>void refresh(),20000);const changed=()=>void refresh();
    window.addEventListener('homefoods:account-change',changed);window.addEventListener('focus',changed);window.addEventListener('storage',changed);
    return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('homefoods:account-change',changed);window.removeEventListener('focus',changed);window.removeEventListener('storage',changed);};
  },[path]);
  function mark(ids:number[]){const next=[...new Set([...seen,...ids])].slice(-500);setSeen(next);localStorage.setItem(`homefoods:notifications-read:${owner}`,JSON.stringify(next));}
  const unread=items.filter(item=>!seen.includes(item.id)).length;
  if(!owner)return null;
  return <><button ref={trigger} className="order-notifications-trigger" onClick={()=>setOpen(true)} aria-label={`Order updates${unread?`, ${unread} unread`:''}`} aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4"/></svg><span>Updates</span>{unread>0&&<b>{unread}</b>}</button>
  <span className="sr-only" role="status">{unread?`${unread} unread order updates`:''}</span>
  <OverlayLayer open={open} onClose={()=>setOpen(false)} label="Order updates" className="modal-backdrop notification-overlay" dialogClassName="notification-panel" dialogRef={dialog} triggerRef={trigger} dismissOnBackdrop>
    <header><div><span className="eyebrow">FROM YOUR KITCHEN</span><h2>Order updates</h2></div><button type="button" className="close-button" aria-label="Close order updates" onClick={()=>setOpen(false)}>×</button></header>
    <p>Updates appear while HomeFoods is open. Read status is saved on this device.</p>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {items.length?<><button className="notification-read-all" onClick={()=>mark(items.map(i=>i.id))}>Mark all as read</button><ul>{items.map(item=><li key={item.id} data-unread={!seen.includes(item.id)}><Link href={item.href} onClick={()=>{mark([item.id]);setOpen(false);}}><strong>{item.message}</strong><span>{item.orderNumber} · {new Date(item.createdAt).toLocaleString('fi-FI')}</span></Link></li>)}</ul></>:<div className="notification-empty"><h3>You’re all caught up</h3><p>Your order’s next update will appear here.</p><Link href="/orders" onClick={()=>setOpen(false)}>View your orders →</Link></div>}
  </OverlayLayer></>;
}
