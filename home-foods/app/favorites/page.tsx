"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/src/components/site-enhancements";
import Brand from "@/src/components/brand";
import MarketImage from "@/src/components/market-image";

type Row = Record<string, unknown>;
type FavoritePayload = { favorites?: Row[]; favoriteKitchens?: Row[] };
type Tab = "foods" | "kitchens";
type Profile = { id?: number; role?: string; name?: string | null; email?: string | null };
type CartDish = { id: number; shopId: number; name: string; shop: string; cuisine: string; category: string; price: number; rating: number | null; time: string; estimatedMinutes?: number | null; image: string | null; description: string; deliveryFee: number };
type CartLine = { dish: CartDish; quantity: number };
const text = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value : fallback;
const price = (value: unknown) => new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
const reviewLabel = (value: unknown) => {
  if (!Array.isArray(value)) return "";
  const ratings = value.map((review) => Number((review as Row).rating)).filter((rating) => Number.isFinite(rating) && rating > 0);
  return ratings.length ? `★ ${(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)}` : "";
};
const cuisineLabel = (description: unknown, city: unknown) => {
  const source = text(description, "");
  const match = source.match(/inspired by ([\w -]+?) home cooking/i);
  return match?.[1] ?? (city ? `Home cooking · ${String(city)}` : "Home cooking");
};
const foodFallback = "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=82";
const kitchenFallback = "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1000&q=82";

export default function FavoritesPage() {
  const router = useRouter();
  const [foods, setFoods] = useState<Row[]>([]);
  const [kitchens, setKitchens] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>("foods");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [basketNotice, setBasketNotice] = useState("");

  const loadFavorites = useCallback(async (signal?: AbortSignal) => {
    try {
      const [response, profileResponse] = await Promise.all([fetch("/api/favorites", { cache: "no-store", signal }), fetch("/api/auth", { cache: "no-store", signal })]);
      const [result, profileData] = await Promise.all([response.json() as Promise<FavoritePayload & { error?: string }>, profileResponse.json() as Promise<{ user?: Profile | null }>]);
      if (response.status === 401) {
        router.replace(`/signin?returnTo=${encodeURIComponent("/favorites")}`);
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "Your saved favourites are unavailable right now.");
      setFoods(Array.isArray(result.favorites) ? result.favorites : []);
      setKitchens(Array.isArray(result.favoriteKitchens) ? result.favoriteKitchens : []);
      setProfile(profileData.user ?? null);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Your saved favourites are unavailable right now.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void loadFavorites(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadFavorites]);

  useEffect(()=>{const refresh=()=>void loadFavorites();window.addEventListener('focus',refresh);window.addEventListener('homefoods:favorites-change',refresh);const storage=(event:StorageEvent)=>{if(event.key==='homefoods:favorites-updated')refresh();};window.addEventListener('storage',storage);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('homefoods:favorites-change',refresh);window.removeEventListener('storage',storage);};},[loadFavorites]);
  const remove = async (kind: Tab, id: number) => {
    const key = `${kind}-${id}`;
    if (pending.includes(key)) return;
    const current = kind === "foods" ? foods : kitchens;
    const setCurrent = kind === "foods" ? setFoods : setKitchens;
    const itemId = kind === "foods" ? "menuItemId" : "shopId";
    const original = current;
    setPending((items) => [...items, key]);
    setCurrent(current.filter((row) => Number(kind === "foods" ? row.menuItemId : row.shopId) !== id));
    setError("");
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [itemId]: id }) });
      const result = await response.json() as { error?: string; saved?: boolean };
      if (!response.ok || result.saved !== false) throw new Error(result.error ?? "We couldn't update that favourite. Please try again.");
      localStorage.setItem("homefoods:favorites-updated",String(Date.now()));window.dispatchEvent(new Event("homefoods:favorites-change"));
    } catch (cause) {
      setCurrent(original);
      setError(cause instanceof Error ? cause.message : "We couldn't update that favourite. Please try again.");
    } finally {
      setPending((items) => items.filter((item) => item !== key));
    }
  };

  const addToBasket = (item: Row, kitchen: Row, itemId: number, shopId: number) => {
    if (!profile?.id || profile.role !== "CUSTOMER") { setError("Sign in with a customer account to add food to your basket."); return; }
    const reviews = Array.isArray(kitchen.reviews) ? (kitchen.reviews as Row[]).map((review) => Number(review.rating)).filter(Number.isFinite) : [];
    const dish: CartDish = {
      id: itemId, shopId, name: text(item.name, "Saved dish"), shop: text(kitchen.name, "Home kitchen"),
      cuisine: text(kitchen.city, "Finnish home cooking"), category: "Homemade favourite", price: Number(item.price ?? 0),
      rating: reviews.length ? reviews.reduce((sum, rating) => sum + rating, 0) / reviews.length : null,
      time: kitchen.estimatedMinutes == null ? "Estimate unavailable" : `${String(kitchen.estimatedMinutes)} min`,
      estimatedMinutes: kitchen.estimatedMinutes == null ? null : Number(kitchen.estimatedMinutes),
      image: typeof item.imageUrl === "string" ? item.imageUrl : null, description: text(item.description, "Made with care by a local home cook."),
      deliveryFee: kitchen.deliveryFee == null ? 2.5 : Number(kitchen.deliveryFee),
    };
    const key = `home-foods-cart:${profile.id}`;
    try {
      const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as CartLine[];
      const existing = current.find((line) => line.dish?.id === itemId);
      const next = existing ? current.map((line) => line.dish.id === itemId ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { dish, quantity: 1 }];
      window.localStorage.setItem(key, JSON.stringify(next));
      setBasketNotice(`${dish.name} added to your basket.`);
      window.setTimeout(() => setBasketNotice(""), 3200);
    } catch { setError("Your basket could not be updated. Please try again."); }
  };

  const hasAny = useMemo(() => foods.length + kitchens.length > 0, [foods.length, kitchens.length]);

  return <main className="favorites-page">
    <header className="favorites-topbar"><Brand href="/"/><nav aria-label="Account navigation"><ThemeToggle/><Link href="/">Discover food</Link><Link href="/orders">Orders</Link></nav></header>
    <div className="favorites-layout"><aside className="favorites-sidebar" aria-label="Customer account navigation"><div className="favorites-profile"><span>{text(profile?.name, "HF").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><b>{text(profile?.name, "HomeFoods member")}</b><small>{text(profile?.email, "Customer account")}</small></div></div><span className="favorites-sidebar-label">YOUR HOMEFOODS</span><Link href="/" className="favorites-side-link"><span aria-hidden="true">⌂</span>Discover food</Link><Link href="/orders" className="favorites-side-link"><span aria-hidden="true">▤</span>Your orders</Link><Link href="/favorites" className="favorites-side-link" aria-current="page"><span aria-hidden="true">♡</span>Favorites</Link><Link href="/workspace#profile" className="favorites-side-link"><span aria-hidden="true">◉</span>Manage account</Link></aside>
    <div className="favorites-content">
      <Link className="favorites-back" href="/">← <span>Back to HomeFoods</span></Link>
      <section className="favorites-intro">
        <div><span className="eyebrow"><span className="eyebrow-line"/> YOUR HOMEFOODS COLLECTION</span><h1>Your <em>Favourites</em></h1><p>All the flavours and kitchens you love, saved in one place.</p></div>
        <span className="favorites-heart-art" aria-hidden="true">♡<i>✳</i></span>
      </section>
      <div className="favorites-toolbar"><div className="favorite-tabs" role="tablist" aria-label="Saved favourites"><button type="button" role="tab" aria-selected={tab === "foods"} className={tab === "foods" ? "active" : ""} onClick={() => setTab("foods")}>Favourite foods <span>{foods.length}</span></button><button type="button" role="tab" aria-selected={tab === "kitchens"} className={tab === "kitchens" ? "active" : ""} onClick={() => setTab("kitchens")}>Favourite kitchens <span>{kitchens.length}</span></button></div><p>{tab === "foods" ? "A little something lovely for later." : "Meet the cooks you want to visit again."}</p></div>
      {error && <div className="favorites-error" role="alert">{error}<button type="button" onClick={() => { setError(""); setLoading(true); void loadFavorites(); }}>Try again</button></div>}
      {loading ? <div className="favorites-skeletons" role="status" aria-label="Loading favourites"><div/><div/><div/></div> : tab === "foods" ? foods.length ? <div className="favorites-grid" role="tabpanel">
        {foods.map((favorite) => {
          const item = (favorite.menuItem as Row | null) ?? {};
          const kitchen = (favorite.shop as Row | null) ?? {};
          const menuItemId = Number(favorite.menuItemId);
          const shopId = Number(favorite.shopId);
          const available = item.isAvailable !== false && kitchen.status === "ACTIVE";
          return <article className="favorite-card" key={String(favorite.id)}>
            <Link className="favorite-card-image" href={`/kitchens/${shopId}?item=${menuItemId}`}><MarketImage src={text(item.imageUrl, "")} alt={text(item.name, "Homemade favourite")} fallbackSrc={foodFallback}/><span className={`favorite-availability ${available ? "available" : "unavailable"}`}>{available ? "Available to order" : "Currently unavailable"}</span></Link>
            <button className="favorite-card-heart" type="button" aria-label={`Remove ${text(item.name, "dish")} from favourites`} aria-pressed="true" disabled={pending.includes(`foods-${menuItemId}`)} onClick={() => void remove("foods", menuItemId)}><HeartIcon/></button>
            <div className="favorite-card-copy"><span className="favorite-card-kicker">HOMEMADE FAVOURITE</span><h2><Link href={`/kitchens/${shopId}?item=${menuItemId}`}>{text(item.name, "Saved dish")}</Link></h2><p>{text(item.description, "Made with care by a local home cook.")}</p><div className="favorite-card-foot"><span><b>{text(kitchen.name, "Home kitchen")}</b><small>{[text(kitchen.city, "Finland"), reviewLabel(kitchen.reviews)].filter(Boolean).join(" · ")}</small></span><strong>{price(item.price)}</strong></div><div className="favorite-card-actions">{available && <button type="button" className="favorite-card-add" onClick={() => addToBasket(item, kitchen, menuItemId, shopId)}>Add to basket</button>}<Link className="favorite-card-action" href={`/kitchens/${shopId}?item=${menuItemId}`}>{available ? "View dish" : "Visit kitchen"}<span>→</span></Link></div></div>
          </article>;
        })}
      </div> : <EmptyFavorites hasAny={hasAny} kind="foods" onBrowse={() => router.push("/#discover")}/> : kitchens.length ? <div className="favorites-grid" role="tabpanel">
        {kitchens.map((favorite) => {
          const kitchen = (favorite.shop as Row | null) ?? {};
          const shopId = Number(favorite.shopId);
          const name = text(kitchen.name, "Home kitchen");
          return <article className="favorite-card kitchen-favorite-card" key={String(favorite.id)}>
            <Link className="favorite-card-image" href={`/kitchens/${shopId}`}><MarketImage src={text(kitchen.coverImageUrl, text(kitchen.logoUrl, ""))} alt={`${name} kitchen`} fallbackSrc={kitchenFallback}/><span className={`favorite-availability ${kitchen.status === "ACTIVE" ? "available" : "unavailable"}`}>{kitchen.status === "ACTIVE" ? "Active home kitchen" : "Kitchen currently unavailable"}</span></Link>
            <button className="favorite-card-heart" type="button" aria-label={`Remove ${name} from favourites`} aria-pressed="true" disabled={pending.includes(`kitchens-${shopId}`)} onClick={() => void remove("kitchens", shopId)}><HeartIcon/></button>
            <div className="favorite-card-copy"><span className="favorite-card-kicker">{cuisineLabel(kitchen.description, kitchen.city).toUpperCase()}</span><h2><Link href={`/kitchens/${shopId}`}>{name}</Link></h2><p>{text(kitchen.description, "Homemade favourites, prepared with care in your neighbourhood.")}</p><div className="favorite-card-foot"><span><b>{text(kitchen.city, "Finland")}</b><small>{[reviewLabel(kitchen.reviews), kitchen.deliveryFee == null ? "Delivery details on kitchen page" : Number(kitchen.deliveryFee) === 0 ? "Free delivery" : `${price(kitchen.deliveryFee)} delivery`].filter(Boolean).join(" · ")}</small></span><strong>{kitchen.estimatedMinutes == null ? "" : `${String(kitchen.estimatedMinutes)} min`}</strong></div><Link className="favorite-card-action" href={`/kitchens/${shopId}`}>View kitchen<span>→</span></Link></div>
          </article>;
        })}
      </div> : <EmptyFavorites hasAny={hasAny} kind="kitchens" onBrowse={() => router.push("/#featured")}/>}
      <div className="favorites-bottom-note"><span aria-hidden="true">✳</span> Good food is always worth coming back to.</div>
      {basketNotice && <div className="favorites-basket-notice" role="status">{basketNotice}<Link href="/?cart=open">View basket →</Link></div>}
    </div>
    </div>
  </main>;
}

function HeartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 4.4-8.8 10-8.8 10S3.2 13.2 3.2 8.8a4.3 4.3 0 0 1 8.8-1.4 4.3 4.3 0 0 1 8.8 1.4Z" fill="currentColor"/></svg>;
}

function EmptyFavorites({ hasAny, kind, onBrowse }: { hasAny: boolean; kind: Tab; onBrowse: () => void }) {
  const foods = kind === "foods";
  return <section className={`favorites-empty ${hasAny ? "favorites-empty-compact" : ""}`} role="tabpanel">
    <div className="favorites-empty-art" aria-hidden="true"><span>♡</span><i>✳</i><b>⌂</b></div>
    <span className="eyebrow"><span className="eyebrow-line"/> A PLACE FOR THE GOOD ONES</span>
    <h2>{hasAny ? `No favourite ${foods ? "foods" : "kitchens"} yet` : "No favourites yet!"}</h2>
    <p>{hasAny ? foods ? "Save a homemade dish with its heart and it will be waiting for you here." : "Tap the heart on a home kitchen to keep your favourite cooks close." : "Found something you love? Tap the heart on your favourite foods or kitchens, and we will save them right here."}</p>
    <button type="button" className="favorites-browse-button" onClick={onBrowse}>Continue Browsing <span>→</span></button>
  </section>;
}
