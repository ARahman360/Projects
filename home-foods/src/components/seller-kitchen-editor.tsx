"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import SellerCategoryManager from './seller-category-manager';
import SellerMealPlanBuilder from './seller-meal-plan-builder';
import SellerDishList from './seller-dish-list';
import SpotlightCard from "@/src/components/ui/spotlight-card";
import { OriginButton } from "@/src/components/ui/origin-button";

type Row = Record<string, unknown>;
const rows = (value: unknown) => Array.isArray(value) ? value as Row[] : [];
const money = (value: unknown) => new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export default function SellerKitchenEditor({ onSaved }: { onSaved: () => void }) {
  const [shop, setShop] = useState<Row>({});
  const [items, setItems] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [subscriptions, setSubscriptions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<{ title: string; action: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/seller", { cache: "no-store" });
      const data = await response.json() as Row;
      if (!response.ok) throw new Error(String(data.error ?? "Seller kitchen could not be loaded."));
      setShop(data.shop && typeof data.shop === "object" ? data.shop as Row : {}); setItems(rows(data.items)); setCategories(rows(data.categories)); setPlans(rows(data.plans)); setSubscriptions(rows(data.subscriptions));
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Seller kitchen could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function mutate(path: string, method: "POST" | "PATCH" | "DELETE", body: Row, message: string) {
    if (busy) return false;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(path, { method, headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : JSON.stringify(body) });
      const data = await response.json() as Row;
      if (!response.ok) throw new Error(String(data.error ?? "Couldn't save that change."));
      setNotice(message);
      if (data.item && typeof data.item === 'object') {
        const item = data.item as Row;
        setItems(current => current.some(row => row.id === item.id) ? current.map(row => row.id === item.id ? item : row) : [item, ...current]);
      } else { await load(); }
      onSaved(); return true;
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Couldn't save that change."); return false; }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>, action: (form: FormData) => Promise<unknown>) {
    event.preventDefault(); void action(new FormData(event.currentTarget));
  }

  if (loading && !shop.id) return <section className="workspace-section seller-editor" aria-busy="true"><div className="workspace-empty"><span className="loading-spinner"/><h2>Opening your kitchen…</h2><p>Loading your private kitchen, dishes and plans.</p></div></section>;
  if (!shop.id && !error) return <section id="kitchen-settings" className="workspace-section seller-editor initial-kitchen-setup"><div className="workspace-section-heading"><div><span className="eyebrow">YOUR KITCHEN</span><h2>Set up your kitchen</h2><p>Your seller account is ready. Add the basics now, then finish your Finnish delivery location and menu.</p></div></div>{notice && <p className="workspace-notice" role="status">{notice}</p>}<form className="workspace-form seller-editor-form" onSubmit={(event) => submit(event, (form) => mutate("/api/seller", "POST", { action: "create-kitchen", name: field(form, "name"), description: field(form, "description"), city: field(form, "city") }, "Kitchen created. Add your verified address and dishes to continue."))}><h3>Kitchen details</h3><label>Kitchen name<input name="name" required minLength={2} maxLength={100} placeholder="e.g. Tanvir’s home kitchen"/></label><label>City or town<input name="city" maxLength={80} required placeholder="Helsinki"/></label><label className="seller-kitchen-description">A little about your food<textarea name="description" rows={3} maxLength={1200} placeholder="Tell customers what you love to cook."/></label>{error && <p className="workspace-alert" role="alert">{error}</p>}<OriginButton type="submit" loading={busy} loadingText="Creating…">Create your kitchen <span>→</span></OriginButton><small>New kitchens start as pending review and stay private until approved.</small></form></section>;
  if (error && !shop.id) return <section className="workspace-section seller-editor"><div className="workspace-section-heading"><div><span className="eyebrow">YOUR KITCHEN</span><h2>We couldn’t open this kitchen</h2></div></div><p className="workspace-alert" role="alert">{error}</p><button type="button" onClick={() => void load()}>Try loading again</button></section>;

  return <section className="workspace-section seller-editor" id="seller-menu">
    <div className="workspace-section-heading"><div><span className="eyebrow">KITCHEN OPERATIONS</span><h2>{String(shop.name ?? "Your kitchen")}</h2><p>Changes here apply only to your kitchen.</p></div><span className="status-pill">{String(shop.status ?? "PENDING")}</span></div>
    {error && <p className="workspace-alert" role="alert">{error}</p>}{notice && <p className="workspace-notice" role="status">{notice}</p>}
    <div className="seller-editor-stats"><SpotlightCard className="spotlight-kpi" size="small" glowColor="green"><span>MENU DISHES</span><b>{items.length}</b></SpotlightCard><SpotlightCard className="spotlight-kpi" size="small" glowColor="orange"><span>AVAILABLE NOW</span><b>{items.filter((item) => Boolean(item.isAvailable)).length}</b></SpotlightCard><SpotlightCard className="spotlight-kpi" size="small" glowColor="purple"><span>MEAL PLANS</span><b>{plans.length}</b></SpotlightCard></div>

    <section className="seller-meal-schedule"><div className="workspace-section-heading"><div><span className="eyebrow">PLAN FULFILMENT</span><h3>Scheduled meal deliveries</h3><p>These are paid subscription orders, scheduled in Finland time.</p></div><span>{subscriptions.reduce((total, entry) => total + rows(entry.scheduledMeals).filter((meal) => !["DELIVERED", "CANCELLED", "FAILED"].includes(String(meal.status))).length, 0)} upcoming / active</span></div>{subscriptions.flatMap((subscription) => rows(subscription.scheduledMeals).map((meal) => ({ subscription, meal }))).filter(({ meal }) => !["DELIVERED", "CANCELLED", "FAILED"].includes(String(meal.status))).length ? <div className="workspace-list">{subscriptions.flatMap((subscription) => rows(subscription.scheduledMeals).map((meal) => ({ subscription, meal }))).filter(({ meal }) => !["DELIVERED", "CANCELLED", "FAILED"].includes(String(meal.status))).sort((a, b) => new Date(String(a.meal.scheduledAt)).getTime() - new Date(String(b.meal.scheduledAt)).getTime()).map(({ subscription, meal }) => { const order = (meal.order as Row | undefined) ?? {}; const customer = (subscription.customer as Row | undefined) ?? {}; const plan = (subscription.plan as Row | undefined) ?? {}; return <article className="workspace-card seller-meal-row" key={String(meal.id)}><div><b>{String(plan.name ?? "Meal plan")} · {new Date(String(meal.scheduledAt)).toLocaleString("fi-FI", { timeZone: "Europe/Helsinki", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b><span>{String(customer.name ?? customer.email ?? "Customer")} · Order {String(order.orderNumber ?? "pending")}</span><small>{rows(order.items).map((item) => `${String(item.quantity)} × ${String(item.name)}`).join(" · ") || "Menu is being confirmed"} · {String(meal.portions ?? 1)} portion(s)</small></div><span className="status-pill">{String(meal.status ?? order.status ?? "UPCOMING").replaceAll("_", " ")}</span><button type="button" onClick={() => { window.location.hash = "orders"; document.getElementById("orders")?.scrollIntoView({ behavior: "smooth" }); }}>Manage order</button></article>; })}</div> : <p className="workspace-muted">No paid meal-plan deliveries are scheduled. Future meals will appear here after successful subscription billing.</p>}</section>

    <SellerCategoryManager categories={categories} items={items} busy={busy} save={(body,isNew)=>mutate('/api/seller',isNew?'POST':'PATCH',{...body,action:isNew?'create-category':'update-category'},'Category saved.')} remove={category=>setConfirm({title:'Remove '+String(category.name)+'?',action:async()=>{await mutate('/api/seller','PATCH',{action:'delete-category',categoryId:category.id},'Category removed.');}})}/>

    <SellerDishList items={items} categories={categories} busy={busy}
      save={(body, isNew) => mutate('/api/seller', isNew ? 'POST' : 'PATCH', body, isNew ? 'Dish added to your menu.' : 'Dish changes saved.')}
      remove={item => setConfirm({ title: 'Remove ' + String(item.name) + ' from your menu?', action: async () => { await mutate('/api/seller?itemId=' + String(item.id), 'DELETE', {}, 'Dish removed from the menu.'); } })}/>

    <SellerMealPlanBuilder items={items} categories={categories} busy={busy} save={body=>mutate('/api/subscriptions','POST',body,'Meal plan published.')}/>
    <section className="seller-published-plans">
      {plans.length ? <div className="workspace-list">{plans.map((plan) => <article className="workspace-card workspace-row" key={String(plan.id)}><div><b>{String(plan.name)}</b><span>{money(plan.price)} / {String(plan.type).toLowerCase()} · {plan.isActive ? "Published" : "Hidden"}</span><small>{rows(plan.items).length} included dishes</small></div><button type="button" disabled={busy} onClick={() => { const name = window.prompt("Plan name", String(plan.name)); if (name === null) return; const price = window.prompt("Price per period (€)", String(plan.price)); if (price === null) return; const description = window.prompt("Plan description", String(plan.description ?? "")); if (description === null) return; void mutate("/api/subscriptions", "PATCH", { planId: plan.id, name, price: Number(price), description }, "Meal plan updated."); }}>{plan.isActive ? "Edit plan" : "Edit hidden plan"}</button><button type="button" disabled={busy} onClick={() => void mutate("/api/subscriptions", "PATCH", { planId: plan.id, isActive: !plan.isActive }, plan.isActive ? "Meal plan hidden." : "Meal plan published.")}>{plan.isActive ? "Hide plan" : "Publish plan"}</button><details className="plan-dish-editor"><summary>Included dishes</summary><form className="workspace-form" onSubmit={(event) => submit(event, (form) => mutate("/api/subscriptions", "PATCH", { planId: plan.id, menuItemIds: form.getAll("menuItemIds").map(Number) }, "Meal plan dishes updated."))}>{items.filter((item) => Boolean(item.isAvailable)).map((item) => <label key={String(item.id)}><span><input type="checkbox" name="menuItemIds" value={String(item.id)} defaultChecked={rows(plan.items).some((entry) => Number(entry.menuItemId) === Number(item.id))}/> {String(item.name)}</span></label>)}<OriginButton type="submit" variant="secondary" loading={busy}>Save included dishes</OriginButton></form></details></article>)}</div> : <p className="workspace-muted">No meal plans yet.</p>}
    </section>
    {confirm && <div className="modal-backdrop" role="presentation" onClick={() => setConfirm(null)}><section className="confirm-modal" role="alertdialog" aria-modal="true"><span className="eyebrow">PLEASE CONFIRM</span><h2>{confirm.title}</h2><p>Dishes associated with order history are retained and hidden, so customer order records remain intact.</p><div className="confirm-actions"><button type="button" onClick={() => setConfirm(null)}>Keep it</button><button type="button" className="confirm-danger" onClick={() => { const action = confirm.action; setConfirm(null); void action(); }}>Confirm removal</button></div></section></div>}
  </section>;
}
