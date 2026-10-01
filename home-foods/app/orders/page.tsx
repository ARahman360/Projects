"use client";
import { canBuy } from '@/src/lib/buyer-policy';


import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OrderJourney from "@/src/components/order-journey";
import MarketImage from "@/src/components/market-image";

type Row = Record<string, unknown>;
type Role = "CUSTOMER" | "SELLER" | "RIDER" | "ADMIN";
type CurrentUser = { id: number; role: Role; name: string | null; email: string };
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : [];
const money = (value: unknown, currency = "EUR") => new Intl.NumberFormat("fi-FI", { style: "currency", currency }).format(Number(value ?? 0));
const readable = (value: unknown) => String(value ?? "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
function trackingStatus(order: Row, delivery: Row) {
  if (["CANCELLED", "REFUNDED"].includes(String(order.status))) return String(order.status);
  if (delivery.status === "FAILED") return "DELIVERY_FAILED";
  if (delivery.status === "DELIVERED") return "DELIVERED";
  const latestDeliveryEvent = rows(order.statusEvents).filter((event) => String(event.domain) === "DELIVERY").sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime())[0];
  if (latestDeliveryEvent?.status === "DELAYED") return "DELAYED";
  if (delivery.status === "IN_TRANSIT") return "ON_THE_WAY";
  if (delivery.status === "PICKED_UP") return "PICKED_UP";
  if (["ACCEPTED", "ASSIGNED"].includes(String(delivery.status))) return "RIDER_ASSIGNED";
  if (order.status === "READY_FOR_PICKUP") return "READY_FOR_DELIVERY";
  return String(order.status ?? "PENDING");
}

export default function OrdersPage() {
  const router = useRouter();
  const revealedOrder = useRef('');
  const [tab,setTab] = useState<"active"|"history"|"cancelled">("active");
  const [reordering,setReordering] = useState<number|null>(null);
  const [notice,setNotice] = useState("");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [orders, setOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    let authenticated = false;
    let initialLoad = true;
    const refresh = async () => {
      try {
        if (!authenticated) {
          const authResponse = await fetch("/api/auth", { cache: "no-store" });
          const auth = await authResponse.json();
          if (!auth.user) { router.replace("/"); return; }
          if (!active) return;
          setUser(auth.user as CurrentUser);
          authenticated = true;
        }
        const orderResponse = await fetch("/api/orders", { cache: "no-store" });
        const payload = await orderResponse.json();
        if (!orderResponse.ok) throw new Error(payload.error ?? "Orders are unavailable.");
        if (!active) return;
        setOrders(rows(payload.orders));
        setConnected(true); setLastUpdated(new Date()); setError("");
      } catch (cause) {
        if (active) { setConnected(false); if (initialLoad) setError(cause instanceof Error ? cause.message : "Orders are unavailable."); }
      } finally { if (active) { initialLoad = false; setLoading(false); } }
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 10_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [router]);

  useEffect(() => {
    const reveal = (force = false) => {
      if (!force && revealedOrder.current === location.hash) return;
      const match = location.hash.match(/^#order-(\d+)$/);
      if (!match) return;
      const order = orders.find(o => Number(o.id) === Number(match[1]));
      if (!order) return;
      revealedOrder.current = location.hash;
      const status = trackingStatus(order, (order.delivery as Row) ?? {});
      setTab(["CANCELLED", "REFUNDED", "DELIVERY_FAILED"].includes(status) ? "cancelled" : status === "DELIVERED" ? "history" : "active");
      requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({block:"start"}));
    };
    const onHash = () => reveal(true);
    reveal();window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [orders]);

  const title = user?.role === "ADMIN" ? "All marketplace orders" : "Your orders";
  const allRecords = orders;
  const bucket = (record:Row) => { const order=record; const status=trackingStatus(order,(order.delivery as Row??{}));return ["CANCELLED","REFUNDED","DELIVERY_FAILED"].includes(status)?"cancelled":status==="DELIVERED"?"history":"active"; };
  const list=allRecords.filter(record=>bucket(record)===tab);
  async function orderAgain(order:Row){
    if(!user || reordering!==null)return;setReordering(Number(order.id));setNotice("");
    try{
      const response=await fetch('/api/kitchens/'+String(order.shopId));const data=await response.json();if(!response.ok)throw new Error(data.error);
      const shop=data.shop;if(shop.isOwnKitchen)throw new Error("You cannot order from your own kitchen. Your other basket items are unchanged.");const wanted=rows(order.items);const available=shop.menuItems.filter((item:Row)=>item.isAvailable&&wanted.some(line=>line.menuItemId===item.id));
      if(!available.length)throw new Error("These dishes are currently unavailable. Visit the kitchen to discover today's menu.");
      const key='home-foods-cart:'+user.id;const cart=JSON.parse(localStorage.getItem(key)??'[]') as {dish:Row;quantity:number}[];
      for(const item of available){const quantity=Math.min(25,Number(wanted.find(line=>line.menuItemId===item.id)?.quantity??1));const existing=cart.find(line=>line.dish.id===item.id);if(existing)existing.quantity=Math.min(25,existing.quantity+quantity);else cart.push({dish:{id:item.id,shopId:shop.id,name:item.name,shop:shop.name,price:item.price,image:item.imageUrl,description:item.description,category:item.category?.name??"Homemade",cuisine:shop.city,deliveryFee:shop.deliveryFee??2.5,rating:null,time:"Estimate at checkout"},quantity});}
      localStorage.setItem(key,JSON.stringify(cart));if(available.length<wanted.length)sessionStorage.setItem('homefoods:reorder-notice','Some dishes were unavailable. Only available items were added.');router.push('/?cart=open');
    }catch(e){setNotice(e instanceof Error?e.message:"Couldn't repeat this order.");}finally{setReordering(null);}
  }

  return <main id="main-content" tabIndex={-1} className="orders-page">


    <section className="orders-content">
      <span className="eyebrow"><span className="eyebrow-line"/> YOUR HOMEFOODS</span>
      <h1>{title}</h1>
      <p className="orders-intro">{canBuy(user?.role) ? "Follow each kitchen’s progress and revisit your past orders." : "Review the latest order activity for your account."}</p>
      <div className="order-tabs" role="tablist" aria-label="Order categories">{([['active','Active orders'],['history','Order history'],['cancelled','Cancelled & issues']] as const).map(([value,label])=><button type="button" role="tab" aria-selected={tab===value} key={value} onClick={()=>setTab(value)}>{label}<span>{allRecords.filter(record=>bucket(record)===value).length}</span></button>)}</div>{notice&&<p role="alert" className="form-error">{notice}</p>}
      {loading ? <div className="orders-skeletons" role="status" aria-label="Loading orders"><div/><div/><div/></div> : error ? <div className="orders-error" role="alert">{error}<button onClick={() => window.location.reload()}>Try again</button></div> : list.length ? <div className="orders-list" role="tabpanel" aria-label={tab}>
        <div className={`orders-sync ${connected ? "is-connected" : "is-offline"}`} role="status"><span aria-hidden="true">●</span>{connected ? `Live updates · ${lastUpdated ? `checked ${lastUpdated.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}` : "connected"}` : "Connection lost · reconnecting automatically"}</div>
        {list.map((record, index) => {
          const order = record;
          const kitchen = (order.shop as Row | undefined) ?? {};
          const items = rows(order.items);
          const id = String(order.id ?? record.id ?? index);
          const orderNumber = String(order.orderNumber ?? id);
          const destination = (order.address as Row | undefined) ?? {};
          const delivery = (order.delivery as Row | undefined) ?? {};
          const status = trackingStatus(order, delivery);
          const events = rows(order.statusEvents).slice().sort((a, b) => new Date(String(a.createdAt ?? 0)).getTime() - new Date(String(b.createdAt ?? 0)).getTime());
          const rider = (delivery.rider as Row | undefined) ?? {};
          const riderUser = (rider.user as Row | undefined) ?? {};
          return <article id={`order-${id}`} className={`orders-card ${tab === "history" ? "order-history-card" : ""}`} key={id}>
            <div className="orders-card-head"><div><span className="orders-kitchen">{String(kitchen.name ?? "HomeFoods order")}</span><h2>Order {orderNumber}</h2><small>{String(order.createdAt ?? "") ? new Date(String(order.createdAt)).toLocaleString("fi-FI") : ""}</small></div><span className={`orders-status status-${String(status ?? "pending").toLowerCase()}`}>{readable(status || "Pending")}</span></div>
            {canBuy(user?.role) && <div role="status" aria-live="polite" key={String(status)} className={`order-current order-current-${String(status ?? "pending").toLowerCase()}`}><span aria-hidden="true">{status === "DELIVERED" ? "✓" : status === "CANCELLED" || status === "REFUNDED" ? "!" : "◷"}</span><div><b>{readable(status || "Pending")}</b><p>{status === "DELIVERED" ? "Your meal has been marked delivered." : status === "CANCELLED" ? "This order was cancelled." : status === "PREPARING" ? "Your home cook is preparing the food." : status === "READY_FOR_PICKUP" ? "Your order is ready for a rider." : status === "PICKED_UP" || status === "OUT_FOR_DELIVERY" ? "Your order has left the kitchen." : "We’ll show each verified update here as it happens."}</p></div></div>}
            {canBuy(user?.role) && tab === "active" && <OrderJourney orderStatus={String(order.status)} deliveryStatus={String(delivery.status)} events={events}/>}
            <ul className="orders-items">{items.map((item, itemIndex) => { const dish = (item.menuItem as Row | undefined) ?? {}; return <li key={String(item.id ?? itemIndex)}>{typeof dish.imageUrl === "string" && <MarketImage src={dish.imageUrl} alt={String(item.name??"Food")}/>}<span><b>{String(item.quantity ?? 1)} × {String(item.name ?? "Food item")}</b>{Boolean(item.options) && <small>{String(item.options)}</small>}</span><b>{money(item.totalPrice ?? Number(item.unitPrice ?? 0) * Number(item.quantity ?? 1), String((order.payment as Row | undefined)?.currency ?? "EUR"))}</b></li>; })}</ul>
            {canBuy(user?.role) && <details className="order-tracking-details"><summary>View details <span>{events.length} recorded updates</span></summary><div className="order-tracking-columns"><section><h3>Kitchen</h3>{events.filter((event) => String(event.domain ?? "ORDER") === "ORDER").map((event, eventIndex) => <div className="order-event" key={String(event.id ?? eventIndex)}><i aria-hidden="true">✓</i><div><b>{readable(event.status)}</b><time>{new Date(String(event.createdAt)).toLocaleString("fi-FI")}</time>{Boolean(event.message) && <small>{String(event.message)}</small>}</div></div>)}{!events.some((event) => String(event.domain ?? "ORDER") === "ORDER") && <p className="workspace-muted">No kitchen status changes recorded yet.</p>}</section><section><h3>Delivery</h3>{events.filter((event) => String(event.domain) === "DELIVERY").map((event, eventIndex) => <div className="order-event" key={String(event.id ?? eventIndex)}><i aria-hidden="true">✓</i><div><b>{readable(event.status)}</b><time>{new Date(String(event.createdAt)).toLocaleString("fi-FI")}</time>{Boolean(event.message) && <small>{String(event.message)}</small>}</div></div>)}{!events.some((event) => String(event.domain) === "DELIVERY") && <p className="workspace-muted">A rider update will appear when a delivery is assigned.</p>}</section></div><div className="order-extra-info"><span>Delivery address</span><b>{String(destination.addressLine1 ?? "Address on order")}, {String(destination.postalCode ?? "")} {String(destination.city ?? "Finland")}</b>{Boolean(order.notes) && <><span>Instructions</span><b>{String(order.notes)}</b></>}{Boolean(riderUser.name) && <><span>Your rider</span><b>{String(riderUser.name)}{Boolean(riderUser.phone) ? ` · ${String(riderUser.phone)}` : ""}</b></>}</div></details>}
            <div className="orders-card-foot"><span>{Boolean(order.payment) ? readable((order.payment as Row).status) : ""}</span><b>{money(order.total, String((order.payment as Row | undefined)?.currency ?? "EUR"))}</b></div>
            {canBuy(user?.role) && Boolean(kitchen.id) && <button type="button" className="orders-reorder" disabled={reordering!==null} onClick={()=>void orderAgain(order)}>{reordering===Number(order.id)?"Checking today’s menu…":"Order again →"}</button>}
          </article>;
        })}
      </div> : <div className="orders-empty"><svg viewBox="0 0 120 100" aria-hidden="true"><path d="M22 42h76l-9 40H31Z"/><path d="M39 42c0-24 42-24 42 0M43 57h34M38 15l-4-8M82 15l5-8"/></svg><h2>{allRecords.length ? tab==="active"?"Nothing on the way just yet":tab==="history"?"Your first story is still cooking":"No cancelled orders":"No orders yet"}</h2><p>A good meal is the beginning of a lovely day. Find something homemade to enjoy.</p><Link href="/#discover">Explore Food →</Link></div>}
    </section>
  </main>;
}
