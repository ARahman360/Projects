"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Brand from "@/src/components/brand";
import SavedAddresses from "@/src/components/saved-addresses";
import OperationalDashboard from "@/src/components/operational-dashboard";
import SpotlightCard from "@/src/components/ui/spotlight-card";

type User = { id: number; email: string; name: string | null; avatarUrl?: string | null; role: "CUSTOMER" | "SELLER" | "RIDER" | "ADMIN" };
type Row = Record<string, unknown>;
const money = (value: unknown, currency = "EUR") => new Intl.NumberFormat("fi-FI", { style: "currency", currency }).format(Number(value ?? 0));
const title = (value: unknown) => String(value ?? "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function WorkspacePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<Row>({});
  const [addresses, setAddresses] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [favoriteRows, setFavoriteRows] = useState<Row[]>([]);
  const [favoriteKitchenRows, setFavoriteKitchenRows] = useState<Row[]>([]);
  const [favoriteTab, setFavoriteTab] = useState<"foods" | "kitchens">("foods");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; label: string; action: () => void } | null>(null);

  const call = useCallback(async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Something went wrong.");
    return payload as Row;
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const auth = await call("/api/auth");
      const current = auth.user as User | null;
      setUser(current);
      if (current?.role === "ADMIN" && window.location.hash !== "#profile") { router.replace("/workspace/admin"); return; }
      if (!current) { setData({}); return; }
      const endpoint = current.role === "SELLER" ? "/api/seller" : current.role === "RIDER" ? "/api/rider" : current.role === "ADMIN" ? "/api/admin" : "/api/orders";
      let dashboard = await call(endpoint);
      if (current.role === "CUSTOMER") {
        const [addressData, planData, favoriteData] = await Promise.all([call("/api/addresses"), call("/api/subscriptions"), call("/api/favorites")]);
        setAddresses((addressData.addresses ?? []) as Row[]); setPlans((planData.subscriptions ?? []) as Row[]);
        setFavoriteRows((favoriteData.favorites ?? []) as Row[]); setFavoriteKitchenRows((favoriteData.favoriteKitchens ?? []) as Row[]);
        dashboard = { ...dashboard, plans: planData.plans ?? [] };
      }
      setData(dashboard);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Workspace unavailable."); }
    finally { setLoading(false); }
  }, [call, router]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    const isOnlineRider = user?.role === "RIDER" && Boolean((data.rider as Row | undefined)?.isAvailable);
    if (!isOnlineRider) return;
    let stopped = false;
    const heartbeat = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/rider", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "HEARTBEAT" }), cache: "no-store" });
        if (!response.ok) void load();
      } catch { /* API stale timeout will switch this rider offline safely. */ }
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void heartbeat(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [data.rider, load, user?.role]);

  useEffect(() => { if (!user || user.role === "CUSTOMER") return; const timer = setInterval(() => { if (!document.hidden) void load(); }, 20000); return () => clearInterval(timer); }, [load, user]);

  async function perform(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(message); await load(); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Couldn't save that change."); }
    finally { setBusy(false); }
  }

  function askConfirmation(action: () => void, titleText: string, description: string, label: string) {
    setConfirmation({ action, title: titleText, description, label });
  }

  async function subscribe(event: FormEvent<HTMLFormElement>, planId: number) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const result = await call("/api/subscriptions", "POST", { planId, addressId: Number(form.get("addressId")), portions: Number(form.get("portions")), startDate: form.get("startDate"), deliveryTime: form.get("deliveryTime") });
      if (typeof result.checkoutUrl === "string") window.location.assign(result.checkoutUrl);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Couldn't start billing."); setBusy(false); }
  }
  async function reviewOrder(event: FormEvent<HTMLFormElement>, orderId: number) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await perform(() => call("/api/reviews", "POST", { orderId, rating: Number(form.get("rating")), comment: form.get("comment") }), "Thanks for sharing your experience.");
  }
  async function signOut() { await fetch("/api/auth", { method: "DELETE" }); router.push("/"); }
  async function removeFavorite(menuItemId: number) {
    await perform(() => call("/api/favorites", "POST", { menuItemId }), "Removed from your favorites.");
  }
  async function removeKitchenFavorite(shopId: number) {
    await perform(() => call("/api/favorites", "POST", { shopId }), "Kitchen removed from your favorites.");
  }

  if (loading) return <main id="main-content" tabIndex={-1} className="workspace-shell"><div className="workspace-empty"><span className="loading-spinner" aria-hidden="true"/><h1>Setting the table…</h1><p>Just a moment while we bring your workspace together.</p></div></main>;
  if (!user) return <main id="main-content" tabIndex={-1} className="workspace-shell"><Link className="workspace-back" href="/">← HomeFoods</Link><div className="workspace-empty"><span>♡</span><h1>Sign in to your workspace</h1><p>Use the sign-in button on HomeFoods to access orders and account tools.</p><Link className="dark-cta" href="/">Back to the menu <span>→</span></Link></div></main>;

  const rows = (value: unknown) => Array.isArray(value) ? value as Row[] : [];
  const orders = rows(data.orders);
  const workspaceLinks = user.role === "CUSTOMER" ? [{ label: "Your orders", href: "#orders", icon: "▤" }, { label: "Meal-plan tracking", href: "/meal-plans", icon: "◷" }, { label: "Favourites", href: "#favorites", icon: "♡" }, { label: "Addresses", href: "#addresses", icon: "⌖" }, { label: "Profile", href: "#profile", icon: "◉" }] : user.role === "SELLER" ? [{ label: "Overview", href: "#seller-dashboard", icon: "◫" }, { label: "Orders to prepare", href: "#orders", icon: "▤" }, { label: "Meal-plan obligations", href: "#obligations", icon: "◷" }, { label: "Delivery requests", href: "#delivery-requests", icon: "➜" }, { label: "Menu & kitchen", href: "#seller-menu", icon: "♨" }, { label: "Profile", href: "#profile", icon: "◉" }] : user.role === "RIDER" ? [{ label: "Availability", href: "#rider-dashboard", icon: "⌖" }, { label: "Active delivery", href: "#orders", icon: "➜" }, { label: "Available jobs", href: "#available-jobs", icon: "⌖" }, { label: "Delivery history", href: "#delivery-history", icon: "▤" }, { label: "Earnings", href: "#earnings", icon: "◫" }, { label: "Profile", href: "#profile", icon: "◉" }] : [{ label: "Overview", href: "#admin-dashboard", icon: "◫" }, { label: "Kitchens", href: "#kitchens", icon: "♨" }, { label: "Deliveries", href: "#deliveries", icon: "➜" }, { label: "Orders", href: "#orders", icon: "▤" }, { label: "Profile", href: "#profile", icon: "◉" }];
  return <main id="main-content" tabIndex={-1} className={`workspace-shell workspace-${user.role.toLowerCase()}`}><header className="workspace-header"><Brand/><Link className="workspace-back" href="/">← Back to the menu</Link></header><div className="workspace-app-layout"><nav className="workspace-nav" aria-label="Workspace navigation"><div className="workspace-nav-heading"><span className="workspace-nav-mark">HF</span><div><b>{title(user.role)}</b><small>HomeFoods workspace</small></div></div><Link href="/" className="workspace-nav-home"><span aria-hidden="true">⌂</span> Discover HomeFoods</Link><div className="workspace-nav-links">{workspaceLinks.map((link) => <a href={link.href} key={link.href}><span aria-hidden="true">{link.icon}</span>{link.label}</a>)}</div><button type="button" className="workspace-nav-signout" onClick={() => void signOut()}>↪ <span>Sign out</span></button></nav><div className="workspace-main-column"><section className="workspace-title" id="workspace-top"><div><div className="eyebrow"><span className="eyebrow-line"/> {title(user.role)} WORKSPACE</div><h1>Hello, <em>{user.name?.split(" ")[0] || "there"}.</em></h1><p>Everything you need to keep the good food moving.</p></div><span className="workspace-role">{title(user.role)}</span></section>{user.role === "CUSTOMER" && <section className="workspace-profile-card" id="profile"><span className="workspace-profile-avatar" role={user.avatarUrl ? "img" : undefined} aria-label={user.avatarUrl ? `${user.name || "User"} profile photo` : undefined} style={user.avatarUrl ? { backgroundImage: `url("${user.avatarUrl}")` } : undefined}>{!user.avatarUrl && (user.name?.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "HF")}</span><div><span className="eyebrow">YOUR PROFILE</span><h2>{user.name || "HomeFoods member"}</h2><p>{user.email} · {title(user.role)}</p><small>Account settings and saved customer addresses are managed in this workspace.</small></div><button type="button" onClick={() => void signOut()}>Sign out</button></section>}{error && <p className="workspace-alert" role="alert">{error}</p>}{notice && <p className="workspace-notice">{notice}</p>}

    {user.role === "CUSTOMER" && <><section className="workspace-section" id="orders"><div className="workspace-section-heading"><div><span className="eyebrow">YOUR TABLE</span><h2>Recent orders</h2></div><span>{orders.length} recent</span></div>{orders.length ? <div className="workspace-list">{orders.map((order) => <article className="workspace-card" key={String(order.id)}><div className="workspace-card-top"><div><b>{String((order.shop as Row | undefined)?.name ?? "Home kitchen")}</b><span>{String(order.orderNumber ?? "")}</span></div><span className="status-pill">{title(order.status)}</span></div><p>{rows(order.items).map((item) => `${String(item.quantity)} × ${String(item.name)}`).join(" · ")}</p><div className="workspace-card-bottom"><span>{String((order.delivery as Row | undefined)?.status ? title((order.delivery as Row).status) : "Waiting for cook")}</span><b>{money(order.total, String((order.payment as Row | undefined)?.currency ?? "EUR"))}</b></div>{order.status === "DELIVERED" && !order.review && <form className="review-form" onSubmit={(event) => void reviewOrder(event, Number(order.id))}><label>Rate this order<select name="rating" defaultValue="5"><option value="5">★★★★★ Lovely</option><option value="4">★★★★ Good</option><option value="3">★★★ Okay</option><option value="2">★★ Could improve</option><option value="1">★ Not good</option></select></label><label>Your note<input name="comment" placeholder="How was it?"/></label><button disabled={busy}>Leave review</button></form>}</article>)}</div> : <p className="workspace-muted">Your next homemade meal is waiting. <Link href="/#discover">Explore the menu →</Link></p>}</section>
      <section className="workspace-section" id="favorites"><div className="workspace-section-heading"><div><span className="eyebrow">KEEP THESE CLOSE</span><h2>Your favorites</h2></div></div><div className="favorite-tabs" role="tablist" aria-label="Saved favorites"><button type="button" role="tab" aria-selected={favoriteTab === "foods"} className={favoriteTab === "foods" ? "active" : ""} onClick={() => setFavoriteTab("foods")}>Foods <span>{favoriteRows.length}</span></button><button type="button" role="tab" aria-selected={favoriteTab === "kitchens"} className={favoriteTab === "kitchens" ? "active" : ""} onClick={() => setFavoriteTab("kitchens")}>Kitchens <span>{favoriteKitchenRows.length}</span></button></div>{favoriteTab === "foods" ? favoriteRows.length ? <div className="workspace-list">{favoriteRows.map((favorite) => { const item = favorite.menuItem as Row; const favoriteShop = favorite.shop as Row; return <article className="workspace-card workspace-row favorite-row" key={String(favorite.id)}><Link href={`/kitchens/${String(favorite.shopId)}?item=${String(favorite.menuItemId)}`}><div><b>{String(item?.name ?? "Saved dish")}</b><span>{String(favoriteShop?.name ?? "Home kitchen")} · {money(item?.price)}</span></div><span>View kitchen →</span></Link><button type="button" className="favorite-remove" onClick={() => void removeFavorite(Number(favorite.menuItemId))} aria-label={`Remove ${String(item?.name ?? "dish")} from favorites`} aria-pressed="true">♥</button></article>; })}</div> : <p className="workspace-muted">Your saved dishes will appear here. <Link href="/#discover">Explore homemade favourites →</Link></p> : favoriteKitchenRows.length ? <div className="workspace-list">{favoriteKitchenRows.map((favorite) => { const favoriteShop = favorite.shop as Row; return <article className="workspace-card workspace-row favorite-row" key={String(favorite.id)}><Link href={`/kitchens/${String(favorite.shopId)}`}><div><b>{String(favoriteShop?.name ?? "Home kitchen")}</b><span>{String(favoriteShop?.city ?? "Homemade food nearby")}</span></div><span>View kitchen →</span></Link><button type="button" className="favorite-remove" onClick={() => void removeKitchenFavorite(Number(favorite.shopId))} aria-label={`Remove ${String(favoriteShop?.name ?? "kitchen")} from favorites`} aria-pressed="true">♥</button></article>; })}</div> : <p className="workspace-muted">Your saved kitchens will appear here. <Link href="/#featured">Meet local cooks →</Link></p>}</section>
      <SavedAddresses onChange={() => { void call("/api/addresses").then(r => setAddresses((r.addresses ?? []) as Row[])); }}/>
      <section className="workspace-section"><div className="workspace-section-heading"><div><span className="eyebrow">A LITTLE ROUTINE</span><h2>Your meal plans</h2></div><Link href="/meal-plans" className="meal-tracker-link">Open live tracker →</Link></div>{plans.length ? <div className="workspace-list">{plans.map((subscription) => <article className="workspace-card" key={String(subscription.id)}><div className="workspace-card-top"><div><b>{String((subscription.plan as Row | undefined)?.name ?? "Meal plan")}</b><span>{title((subscription.plan as Row | undefined)?.type)} · {String((subscription.plan as Row | undefined)?.shop && ((subscription.plan as Row).shop as Row).name)}</span></div><span className="status-pill">{title(subscription.status)}</span></div><p>Next meal: {String(subscription.nextDelivery ?? "To be scheduled")}</p><div className="workspace-actions"><button onClick={() => void perform(() => call("/api/subscriptions", "PATCH", { subscriptionId: subscription.id, action: subscription.status === "PAUSED" ? "resume" : "pause" }), subscription.status === "PAUSED" ? "Plan resumed." : "Plan paused.")} disabled={busy}>{subscription.status === "PAUSED" ? "Resume" : "Pause"}</button><button onClick={() => askConfirmation(() => void perform(() => call("/api/subscriptions", "PATCH", { subscriptionId: subscription.id, action: "cancel" }), "Plan cancelled."), "Cancel this meal plan?", "This will stop future subscription renewals.", "Cancel plan")} disabled={busy}>Cancel</button></div></article>)}</div> : <p className="workspace-muted">No meal plans yet. Browse the plans below to make weekday meals easier.</p>}</section><section className="workspace-section"><div className="workspace-section-heading"><div><span className="eyebrow">COOKED FOR YOUR WEEK</span><h2>Meal plans from home cooks</h2></div></div><div className="plan-grid">{rows(data.plans).length ? rows(data.plans).map((plan) => <SpotlightCard className="spotlight-plan" glowColor="purple" size="medium" key={`plan-glow-${String(plan.id)}`}><article className="workspace-card plan-card" key={String(plan.id)}><span className="status-pill">{title(plan.type)}</span><h3>{String(plan.name)}</h3><p>{String(plan.description ?? "Fresh homemade meals from a local kitchen.")}</p><b>{money(plan.price, String(plan.currency ?? "EUR"))} <small>/ {String(plan.type).toLowerCase()}</small></b><form className="workspace-form" onSubmit={(event) => void subscribe(event, Number(plan.id))}><label>Delivery address<select name="addressId" required defaultValue=""><option value="" disabled>Choose a saved address</option>{addresses.map((address) => <option key={String(address.id)} value={String(address.id)}>{String(address.label ?? address.addressLine1)} — {String(address.city)}</option>)}</select></label><label>Start date<input type="date" name="startDate" required/></label><label>Portions<input type="number" min="1" max="20" name="portions" defaultValue="1"/></label><label>Delivery time<input type="time" name="deliveryTime" defaultValue="12:00"/></label><button className="dark-cta" disabled={busy}>Subscribe with Stripe <span>→</span></button></form></article></SpotlightCard>) : <p className="workspace-muted">No active meal plans are published yet.</p>}</div></section></>}

    {(user.role === "SELLER" || user.role === "RIDER") && <OperationalDashboard role={user.role} data={data} onSaved={load}/>}
    {user.role !== "CUSTOMER" && <section className="workspace-profile-card" id="profile"><span className="workspace-profile-avatar" role={user.avatarUrl ? "img" : undefined} aria-label={user.avatarUrl ? `${user.name || "User"} profile photo` : undefined} style={user.avatarUrl ? { backgroundImage: `url("${user.avatarUrl}")` } : undefined}>{!user.avatarUrl && (user.name?.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "HF")}</span><div><span className="eyebrow">YOUR PROFILE</span><h2>{user.name || "HomeFoods member"}</h2><p>{user.email} · {title(user.role)}</p><small>Account settings and saved customer addresses are managed in this workspace.</small></div><button type="button" onClick={() => void signOut()}>Sign out</button></section>}


      </div></div>
    {confirmation && <div className="modal-backdrop" role="presentation" onClick={() => setConfirmation(null)}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onClick={(event) => event.stopPropagation()}><span className="eyebrow">PLEASE CONFIRM</span><h2 id="confirm-title">{confirmation.title}</h2><p id="confirm-description">{confirmation.description}</p><div className="confirm-actions"><button type="button" onClick={() => setConfirmation(null)}>Keep it</button><button type="button" className="confirm-danger" onClick={() => { const action = confirmation.action; setConfirmation(null); action(); }}>{confirmation.label}</button></div></section></div>}
    <footer className="workspace-footer"><Brand compact/><span>{user.email}</span></footer></main>;
}
