"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Brand from "@/src/components/brand";

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : [];
const readable = (value: unknown) => String(value ?? "Upcoming").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const HELSINKI = "Europe/Helsinki";
const dateText = (value: unknown, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) => new Intl.DateTimeFormat("en-GB", { ...options, timeZone: HELSINKI }).format(new Date(String(value)));

function actualMealStatus(meal: Row) {
  const order = (meal.order as Row | undefined) ?? {};
  const delivery = (order.delivery as Row | undefined) ?? {};
  if (delivery.status === "DELIVERED" || order.status === "DELIVERED") return "DELIVERED";
  if (delivery.status === "FAILED") return "FAILED";
  const latestDeliveryEvent = rows(order.statusEvents).filter((event) => String(event.domain) === "DELIVERY").sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime())[0];
  if (latestDeliveryEvent?.status === "DELAYED") return "DELAYED";
  if (delivery.status === "IN_TRANSIT") return "ON_THE_WAY";
  if (delivery.status === "PICKED_UP") return "PICKED_UP";
  if (["ACCEPTED", "ASSIGNED"].includes(String(delivery.status))) return "RIDER_ASSIGNED";
  if (order.status === "READY_FOR_PICKUP") return "READY_FOR_DELIVERY";
  if (order.status === "PREPARING") return "PREPARING";
  if (order.status === "CONFIRMED") return "ORDER_ACCEPTED";
  if (order.status === "CANCELLED") return "CANCELLED";
  if (order.status === "PENDING") return "ORDER_RECEIVED";
  return String(meal.status ?? "UPCOMING");
}

export default function MealPlansPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [selectedMeal, setSelectedMeal] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let active = true;
    let authenticated = false;
    let hadSubscriptions = false;
    const refresh = async () => {
      try {
        if (!authenticated) {
          const auth = await fetch("/api/auth", { cache: "no-store" }).then((response) => response.json());
          if (!auth.user) { router.replace("/signin?returnTo=%2Fmeal-plans"); return; }
          if (auth.user.role !== "CUSTOMER") { router.replace("/workspace"); return; }
          authenticated = true;
        }
        const response = await fetch("/api/subscriptions", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Meal plans are unavailable.");
        if (!active) return;
        const next = rows(payload.subscriptions);
        setSubscriptions(next);
        hadSubscriptions = next.length > 0;
        setSelected((current) => current || String(next[0]?.id ?? ""));
        setConnected(true); setError("");
      } catch (cause) {
        if (active) { setConnected(false); if (!hadSubscriptions) setError(cause instanceof Error ? cause.message : "Meal plans are unavailable."); }
      } finally { if (active) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 10_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [router]);

  const current = subscriptions.find((item) => String(item.id) === selected) ?? subscriptions[0];
  const plan = (current?.plan as Row | undefined) ?? {};
  const kitchen = (plan.shop as Row | undefined) ?? {};
  const meals = rows(current?.scheduledMeals).slice().sort((a, b) => new Date(String(a.scheduledAt)).getTime() - new Date(String(b.scheduledAt)).getTime());
  const delivered = meals.filter((meal) => actualMealStatus(meal) === "DELIVERED").length;
  const percent = meals.length ? Math.round(delivered / meals.length * 100) : 0;
  const nextMeal = meals.find((meal) => !["DELIVERED", "CANCELLED", "FAILED"].includes(actualMealStatus(meal)));
  const monthMeals = new Map(meals.map((meal) => [dateText(meal.scheduledAt, { year: "numeric", month: "2-digit", day: "2-digit" }), meal]));
  const weekDays = useMemo(() => {
    const weekday = Number(new Intl.DateTimeFormat("en-US", { timeZone: HELSINKI, weekday: "short" }).format(cursor) === "Sun" ? 0 : new Intl.DateTimeFormat("en-US", { timeZone: HELSINKI, weekday: "short" }).format(cursor) === "Mon" ? 1 : new Intl.DateTimeFormat("en-US", { timeZone: HELSINKI, weekday: "short" }).format(cursor) === "Tue" ? 2 : new Intl.DateTimeFormat("en-US", { timeZone: HELSINKI, weekday: "short" }).format(cursor) === "Wed" ? 3 : new Intl.DateTimeFormat("en-US", { timeZone: HELSINKI, weekday: "short" }).format(cursor) === "Thu" ? 4 : new Intl.DateTimeFormat("en-US", { timeZone: HELSINKI, weekday: "short" }).format(cursor) === "Fri" ? 5 : 6);
    const base = new Date(cursor); base.setDate(base.getDate() - weekday + 1);
    return Array.from({ length: 7 }, (_, index) => { const date = new Date(base); date.setDate(base.getDate() + index); return date; });
  }, [cursor]);
  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first); start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
  }, [cursor]);
  const dayKey = (date: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: HELSINKI, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const mealFor = (date: Date) => monthMeals.get(dayKey(date));
  const shiftCursor = (direction: number) => setCursor((old) => { const next = new Date(old); if (view === "month") next.setMonth(old.getMonth() + direction); else next.setDate(old.getDate() + direction * 7); return next; });

  async function signOut() { await fetch("/api/auth", { method: "DELETE" }); router.replace("/"); }

  return <main className="orders-page meal-tracking-page">
    <header className="orders-header"><Brand href="/"/><div className="meal-header-actions"><span className={connected ? "meal-connection" : "meal-connection offline"}>● {connected ? "Live updates" : "Reconnecting"}</span><Link href="/workspace">← Account</Link></div></header>
    <aside className="orders-sidebar" aria-label="Account navigation"><Link className="orders-profile" href="/workspace"><span>HF</span><b>Your HomeFoods</b><small>Customer account</small></Link><Link href="/" className="orders-nav-link">⌂ <span>Home</span></Link><Link href="/orders" className="orders-nav-link">▤ <span>Orders</span></Link><Link href="/meal-plans" aria-current="page" className="orders-nav-link active">◷ <span>Meal plans</span></Link><button className="orders-signout" onClick={() => void signOut()}>↪ <span>Log out</span></button></aside>
    <section className="meal-tracking-content"><span className="eyebrow"><span className="eyebrow-line"/> A LITTLE ROUTINE</span><h1>Your meal plans</h1><p className="orders-intro">Every delivery, kitchen update and completed meal in one place.</p>
      {loading ? <div className="orders-loading" role="status">Loading your meal schedule…</div> : error ? <div className="orders-error" role="alert">{error}<button onClick={() => window.location.reload()}>Try again</button></div> : subscriptions.length === 0 ? <div className="orders-empty"><span>✦</span><h2>No meal plans yet</h2><p>Your purchased meal plans and delivery schedule will appear here.</p><Link href="/workspace">Explore meal plans →</Link></div> : <>
        <label className="meal-plan-picker">Choose a plan<select value={String(current?.id ?? "")} onChange={(event) => { setSelected(event.target.value); setSelectedMeal(null); }} aria-label="Choose a meal plan">{subscriptions.map((subscription) => { const choice = (subscription.plan as Row | undefined) ?? {}; const choiceShop = (choice.shop as Row | undefined) ?? {}; return <option key={String(subscription.id)} value={String(subscription.id)}>{String(choice.name ?? "Meal plan")} · {String(choiceShop.name ?? "Home kitchen")}</option>; })}</select></label>
        <article className="meal-summary-card"><div className="meal-summary-copy"><span className="eyebrow">YOUR PURCHASED PLAN</span><h2>{String(plan.name ?? "Meal plan")}</h2><p>{String(kitchen.name ?? "Home kitchen")} · {readable(plan.type)} · {readable(current?.status)}</p><div className="meal-summary-dates"><span>Started <b>{dateText(current?.startDate)}</b></span>{Boolean(current?.endDate) && <span>Ends <b>{dateText(current?.endDate)}</b></span>}<span>{Number(plan.mealsPerPeriod ?? meals.length)} meals per billing period</span></div></div><div className="meal-progress-ring" style={{ "--meal-progress": `${percent}%` } as CSSProperties}><div><b>{delivered}</b><span>of {meals.length}</span></div></div><div className="meal-progress-text"><b>{meals.length ? `${delivered} of ${meals.length} deliveries completed` : "Schedule being confirmed"}</b><div className="meal-progress-bar"><i style={{ width: `${percent}%` }}/></div><small>{nextMeal ? `Next · ${dateText(nextMeal.scheduledAt)} at ${new Date(String(nextMeal.scheduledAt)).toLocaleTimeString("fi-FI", { timeZone: HELSINKI, hour: "2-digit", minute: "2-digit" })}` : meals.length ? "Every scheduled meal is complete" : "A schedule appears after payment confirmation."}</small></div></article>
        <div className="meal-calendar-toolbar"><div><span className="eyebrow">EUROPE / HELSINKI</span><h2>{view === "month" ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: HELSINKI }).format(cursor) : `${dateText(weekDays[0], { day: "numeric", month: "short" })} – ${dateText(weekDays[6], { day: "numeric", month: "short", year: "numeric" })}`}</h2></div><div className="meal-calendar-controls"><button onClick={() => shiftCursor(-1)} aria-label="Previous period">←</button><button onClick={() => setCursor(new Date())}>Today</button><button onClick={() => shiftCursor(1)} aria-label="Next period">→</button><div role="group" aria-label="Calendar view"><button aria-pressed={view === "week"} onClick={() => setView("week")}>Week</button><button aria-pressed={view === "month"} onClick={() => setView("month")}>Month</button></div></div></div>
        {view === "week" ? <div className="meal-week-grid">{weekDays.map((date) => { const meal = mealFor(date); const status = meal ? actualMealStatus(meal) : ""; return <button className={`meal-day-card ${meal ? `meal-${status.toLowerCase()}` : "meal-no-delivery"}`} key={date.toISOString()} onClick={() => meal && setSelectedMeal(meal)} disabled={!meal}><span>{date.toLocaleDateString("en-GB", { weekday: "short", timeZone: HELSINKI })}</span><b>{date.toLocaleDateString("en-GB", { day: "2-digit", timeZone: HELSINKI })}</b>{meal ? <><i aria-hidden="true">{status === "DELIVERED" ? "✓" : status === "UPCOMING" ? "◷" : "•"}</i><small>{readable(status)}</small></> : <small>No delivery</small>}</button>; })}</div> : <div className="meal-month-calendar"><div className="meal-weekday-labels">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="meal-month-grid">{monthCells.map((date) => { const meal = mealFor(date); const status = meal ? actualMealStatus(meal) : ""; return <button key={date.toISOString()} className={`${date.getMonth() === cursor.getMonth() ? "" : "outside-month"} ${meal ? `meal-${status.toLowerCase()}` : ""}`} onClick={() => meal && setSelectedMeal(meal)} disabled={!meal}><span>{date.toLocaleDateString("en-GB", { day: "numeric", timeZone: HELSINKI })}</span>{meal && <i aria-label={readable(status)}>{status === "DELIVERED" ? "✓" : "•"}</i>}</button>; })}</div></div>}
        {selectedMeal && <MealDetails meal={selectedMeal} kitchen={kitchen} plan={plan} onClose={() => setSelectedMeal(null)}/>}
        <section className="meal-deliveries-section"><div className="workspace-section-heading"><div><span className="eyebrow">REAL ORDERS · LIVE STATUS</span><h2>Scheduled deliveries</h2></div><span>{meals.length} in this billing period</span></div>{meals.length ? <div className="meal-delivery-list">{meals.map((meal, index) => { const status = actualMealStatus(meal); const order = (meal.order as Row | undefined) ?? {}; const delivery = (order.delivery as Row | undefined) ?? {}; const rider = ((delivery.rider as Row | undefined)?.user as Row | undefined) ?? {}; const lines = rows(order.items); return <button key={String(meal.id)} className={`meal-delivery-row meal-${status.toLowerCase()}`} onClick={() => setSelectedMeal(meal)}><span className="meal-row-date"><b>{dateText(meal.scheduledAt, { day: "2-digit" })}</b><small>{dateText(meal.scheduledAt, { month: "short" })}</small></span><span className="meal-row-main"><b>{lines.length ? lines.map((line) => `${String(line.quantity)} × ${String(line.name)}`).join(" · ") : `${readable(plan.name)} delivery ${index + 1}`}</b><small>{String(order.orderNumber ?? "Scheduled meal")} · {new Date(String(meal.scheduledAt)).toLocaleTimeString("fi-FI", { timeZone: HELSINKI, hour: "2-digit", minute: "2-digit" })}</small></span><span className="meal-row-status">{readable(status)}{status === "DELIVERED" && meal.deliveredAt ? <small>{dateText(meal.deliveredAt, { hour: "2-digit", minute: "2-digit" })}</small> : status === "RIDER_ASSIGNED" && rider.name ? <small>{String(rider.name)}</small> : null}</span></button>; })}</div> : <div className="meal-no-schedule"><span>◷</span><div><b>Schedule not available yet</b><p>We’ll show individual meal deliveries after the first subscription payment is confirmed. No future order is shown as in progress.</p></div></div>}</section>
        <div className="meal-plan-footer"><span>Menu and delivery updates come from your kitchen and rider’s order records.</span><Link href="/orders">View all orders →</Link></div>
      </>}
    </section>
  </main>;
}

function MealDetails({ meal, kitchen, plan, onClose }: { meal: Row; kitchen: Row; plan: Row; onClose: () => void }) {
  const order = (meal.order as Row | undefined) ?? {};
  const delivery = (order.delivery as Row | undefined) ?? {};
  const destination = (order.address as Row | undefined) ?? {};
  const lines = rows(order.items);
  return <div className="meal-detail-backdrop" role="presentation" onClick={onClose}><section className="meal-detail-panel" role="dialog" aria-modal="true" aria-labelledby="meal-detail-title" onClick={(event) => event.stopPropagation()}><button className="meal-detail-close" onClick={onClose} aria-label="Close meal details">×</button><span className="eyebrow">{dateText(meal.scheduledAt)}</span><h2 id="meal-detail-title">{lines.length ? lines.map((line) => String(line.name)).join(" · ") : String(plan.name ?? "Scheduled meal")}</h2><p>{String(kitchen.name ?? "Home kitchen")} · {readable(actualMealStatus(meal))}</p>{lines.map((line, index) => { const item = (line.menuItem as Row | undefined) ?? {}; return <div className="meal-detail-food" key={String(line.id ?? index)}>{typeof item.imageUrl === "string" && <img src={item.imageUrl} alt=""/>}<b>{String(line.quantity ?? 1)} × {String(line.name)}</b></div>; })}<dl><dt>Delivery window</dt><dd>{new Date(String(meal.scheduledAt)).toLocaleTimeString("fi-FI", { timeZone: HELSINKI, hour: "2-digit", minute: "2-digit" })} · Finland time</dd><dt>Delivery address</dt><dd>{String(destination.addressLine1 ?? "Saved delivery address")}, {String(destination.postalCode ?? "")} {String(destination.city ?? "")}</dd>{Boolean((delivery.rider as Row | undefined)?.user) && <><dt>Rider</dt><dd>{String(((delivery.rider as Row).user as Row).name ?? "Assigned rider")}</dd></>}{Boolean(order.notes) && <><dt>Notes</dt><dd>{String(order.notes)}</dd></>}</dl><p className="meal-detail-footnote">Meal status follows the kitchen order and delivery record. Tracking reflects confirmed updates only.</p></section></div>;
}
