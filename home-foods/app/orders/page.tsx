"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Brand from "@/src/components/brand";

type Row = Record<string, unknown>;
type Role = "CUSTOMER" | "SELLER" | "RIDER" | "ADMIN";
type CurrentUser = { role: Role; name: string | null; email: string };
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
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [orders, setOrders] = useState<Row[]>([]);
  const [deliveries, setDeliveries] = useState<Row[]>([]);
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
        setDeliveries(rows(payload.deliveries));
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

  const title = user?.role === "RIDER" ? "Your deliveries" : user?.role === "SELLER" ? "Kitchen orders" : user?.role === "ADMIN" ? "All marketplace orders" : "Your orders";
  const isRider = user?.role === "RIDER";
  const list = isRider ? deliveries : orders;
  const dashboardHref = user?.role === "SELLER" ? "/workspace#seller-dashboard" : user?.role === "RIDER" ? "/workspace#rider-dashboard" : user?.role === "ADMIN" ? "/workspace#admin-dashboard" : "/workspace";
  async function signOut() { await fetch("/api/auth", { method: "DELETE" }); router.replace("/"); }

  return <main className="orders-page">
    <header className="orders-header"><Brand href="/"/><Link href="/" className="orders-back">← HomeFoods</Link></header>
    <aside className="orders-sidebar" aria-label="Account navigation"><Link className="orders-profile" href="/workspace#profile"><span>{user?.name?.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "HF"}</span><b>{user?.name || "HomeFoods member"}</b><small>{user?.email}</small></Link><Link href="/" className="orders-nav-link">⌂ <span>Home</span></Link><Link href="/orders" aria-current="page" className="orders-nav-link active">▤ <span>Orders</span></Link>{user?.role === "CUSTOMER" && <><Link href="/meal-plans" className="orders-nav-link">◷ <span>Meal plans</span></Link><Link href="/workspace#favorites" className="orders-nav-link">♡ <span>Favorites</span></Link></>}<Link href={dashboardHref} className="orders-nav-link">{user?.role === "SELLER" ? "▦" : user?.role === "RIDER" ? "➜" : "⚙"} <span>{user?.role === "SELLER" ? "Your Kitchen" : user?.role === "RIDER" ? "Deliver" : user?.role === "ADMIN" ? "Workspace" : "Account"}</span></Link><button className="orders-signout" onClick={() => void signOut()}>↪ <span>Log out</span></button></aside>
    <section className="orders-content">
      <span className="eyebrow"><span className="eyebrow-line"/> YOUR HOMEFOODS</span>
      <h1>{title}</h1>
      <p className="orders-intro">{user?.role === "CUSTOMER" ? "Follow each kitchen’s progress and revisit your past orders." : "Review the latest order activity for your account."}</p>
      {loading ? <div className="orders-loading" role="status">Loading your orders…</div> : error ? <div className="orders-error" role="alert">{error}<button onClick={() => window.location.reload()}>Try again</button></div> : list.length ? <div className="orders-list">
        <div className={`orders-sync ${connected ? "is-connected" : "is-offline"}`} role="status"><span aria-hidden="true">●</span>{connected ? `Live updates · ${lastUpdated ? `checked ${lastUpdated.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}` : "connected"}` : "Connection lost · reconnecting automatically"}</div>
        {list.map((record, index) => {
          const order = isRider ? (record.order as Row | undefined) ?? {} : record;
          const kitchen = (order.shop as Row | undefined) ?? {};
          const items = rows(order.items);
          const id = String(order.id ?? record.id ?? index);
          const orderNumber = String(order.orderNumber ?? id);
          const destination = (order.address as Row | undefined) ?? {};
          const delivery = (order.delivery as Row | undefined) ?? {};
          const status = isRider ? record.status : trackingStatus(order, delivery);
          const events = rows(order.statusEvents).slice().sort((a, b) => new Date(String(a.createdAt ?? 0)).getTime() - new Date(String(b.createdAt ?? 0)).getTime());
          const rider = (delivery.rider as Row | undefined) ?? {};
          const riderUser = (rider.user as Row | undefined) ?? {};
          return <article className="orders-card" key={id}>
            <div className="orders-card-head"><div><span className="orders-kitchen">{String(kitchen.name ?? "HomeFoods order")}</span><h2>Order {orderNumber}</h2><small>{String(order.createdAt ?? "") ? new Date(String(order.createdAt)).toLocaleString("fi-FI") : ""}</small></div><span className={`orders-status status-${String(status ?? "pending").toLowerCase()}`}>{readable(status || "Pending")}</span></div>
            {user?.role === "CUSTOMER" && <div className={`order-current order-current-${String(status ?? "pending").toLowerCase()}`}><span aria-hidden="true">{status === "DELIVERED" ? "✓" : status === "CANCELLED" || status === "REFUNDED" ? "!" : "◷"}</span><div><b>{readable(status || "Pending")}</b><p>{status === "DELIVERED" ? "Your meal has been marked delivered." : status === "CANCELLED" ? "This order was cancelled." : status === "PREPARING" ? "Your home cook is preparing the food." : status === "READY_FOR_PICKUP" ? "Your order is ready for a rider." : status === "PICKED_UP" || status === "OUT_FOR_DELIVERY" ? "Your order has left the kitchen." : "We’ll show each verified update here as it happens."}</p></div></div>}
            {isRider && <p className="orders-destination">Deliver to {String(destination.city ?? "customer")}</p>}
            <ul className="orders-items">{items.map((item, itemIndex) => { const dish = (item.menuItem as Row | undefined) ?? {}; return <li key={String(item.id ?? itemIndex)}>{typeof dish.imageUrl === "string" && <img src={dish.imageUrl} alt="" loading="lazy"/>}<span><b>{String(item.quantity ?? 1)} × {String(item.name ?? "Food item")}</b>{Boolean(item.options) && <small>{String(item.options)}</small>}</span><b>{money(item.totalPrice ?? Number(item.unitPrice ?? 0) * Number(item.quantity ?? 1), String((order.payment as Row | undefined)?.currency ?? "EUR"))}</b></li>; })}</ul>
            {user?.role === "CUSTOMER" && <details className="order-tracking-details"><summary>Follow the order journey <span>{events.length} recorded updates</span></summary><div className="order-tracking-columns"><section><h3>Kitchen</h3>{events.filter((event) => String(event.domain ?? "ORDER") === "ORDER").map((event, eventIndex) => <div className="order-event" key={String(event.id ?? eventIndex)}><i aria-hidden="true">✓</i><div><b>{readable(event.status)}</b><time>{new Date(String(event.createdAt)).toLocaleString("fi-FI")}</time>{Boolean(event.message) && <small>{String(event.message)}</small>}</div></div>)}{!events.some((event) => String(event.domain ?? "ORDER") === "ORDER") && <p className="workspace-muted">No kitchen status changes recorded yet.</p>}</section><section><h3>Delivery</h3>{events.filter((event) => String(event.domain) === "DELIVERY").map((event, eventIndex) => <div className="order-event" key={String(event.id ?? eventIndex)}><i aria-hidden="true">✓</i><div><b>{readable(event.status)}</b><time>{new Date(String(event.createdAt)).toLocaleString("fi-FI")}</time>{Boolean(event.message) && <small>{String(event.message)}</small>}</div></div>)}{!events.some((event) => String(event.domain) === "DELIVERY") && <p className="workspace-muted">A rider update will appear when a delivery is assigned.</p>}</section></div><div className="order-extra-info"><span>Delivery address</span><b>{String(destination.addressLine1 ?? "Address on order")}, {String(destination.postalCode ?? "")} {String(destination.city ?? "Finland")}</b>{Boolean(order.notes) && <><span>Instructions</span><b>{String(order.notes)}</b></>}{Boolean(riderUser.name) && <><span>Your rider</span><b>{String(riderUser.name)}{Boolean(riderUser.phone) ? ` · ${String(riderUser.phone)}` : ""}</b></>}</div></details>}
            <div className="orders-card-foot"><span>{Boolean(order.payment) ? readable((order.payment as Row).status) : ""}</span><b>{money(order.total, String((order.payment as Row | undefined)?.currency ?? "EUR"))}</b></div>
            {user?.role === "CUSTOMER" && Boolean(kitchen.id) && <Link className="orders-reorder" href={`/kitchens/${String(kitchen.id)}`}>Visit kitchen to order again →</Link>}
          </article>;
        })}
      </div> : <div className="orders-empty"><span>♡</span><h2>No orders here yet</h2><p>Your order history and updates will appear here.</p><Link href="/#discover">Explore homemade favourites →</Link></div>}
    </section>
  </main>;
}
