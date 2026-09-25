"use client";

function publishFavoritesChange(){localStorage.setItem("homefoods:favorites-updated",String(Date.now()));window.dispatchEvent(new Event("homefoods:favorites-change"));}

import { useEffect, useMemo, useState } from "react";
import Brand from "@/src/components/brand";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LocationSelector from "@/src/components/location-selector";
import MarketImage from "@/src/components/market-image";

type MenuItem = { id: number; name: string; description: string | null; imageUrl: string | null; price: number; isAvailable: boolean; category?: { name: string } | null };
type Kitchen = { id: number; name: string; description: string | null; logoUrl: string | null; coverImageUrl: string | null; city: string | null; deliveryFee: number | null; estimatedMinutes: number | null; minimumOrder: number | null; menuItems: MenuItem[]; reviews: Array<{ rating: number }> };
type DeliveryCheck = { status: "available" | "too_far" | "unknown" | "unconfigured"; distanceKm?: number; message?: string } | null;
type CartDish = { id: number; shopId: number; name: string; shop: string; cuisine: string; category: string; price: number; rating: number | null; time: string; image: string | null; description: string; deliveryFee: number };
type CartLine = { dish: CartDish; quantity: number };
const cartKey = (userId: number | null) => `home-foods-cart:${userId === null ? "guest" : userId}`;
const money = (value: number) => new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(value);
const fallbackCover = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1500&q=85";

export default function KitchenPage({ id }: { id: string }) {
  const router = useRouter();
  const [kitchen, setKitchen] = useState<Kitchen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cartCount, setCartCount] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [isCustomer, setIsCustomer] = useState(false);
  const [isKitchenFavorite, setIsKitchenFavorite] = useState(false);
  const [notice, setNotice] = useState("");
  const [cartOwnerId, setCartOwnerId] = useState<number | null>(null);
  const [deliveryCheck, setDeliveryCheck] = useState<DeliveryCheck>(null);

  useEffect(() => {
    let active = true;
    const loadKitchen = async (latitude?: number, longitude?: number) => {
      const query = latitude !== undefined && longitude !== undefined ? `?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}` : "";
      try {
        const response = await fetch(`/api/kitchens/${encodeURIComponent(id)}${query}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Kitchen unavailable.");
        if (active) { setKitchen(data.shop as Kitchen); setDeliveryCheck(data.deliveryCheck ?? null); }
      } catch (issue) { if (active) setError(issue instanceof Error ? issue.message : "Kitchen unavailable."); }
      finally { if (active) setLoading(false); }
    };
    void fetch("/api/auth", { cache: "no-store" }).then((response) => response.json()).then((auth) => {
      const ownerId = auth.user?.role === "CUSTOMER" ? Number(auth.user.id) : null;
      const key = `home-foods-location:${Number.isInteger(ownerId) ? ownerId : "guest"}`;
      const saved = window.localStorage.getItem(key) ?? (ownerId === null ? window.localStorage.getItem("home-foods-location") : null);
      if (saved) {
        const location = JSON.parse(saved) as { latitude?: number; longitude?: number };
        void loadKitchen(location.latitude, location.longitude);
      } else void loadKitchen();
    }).catch(() => void loadKitchen());
    const onLocationChange = (event: Event) => {
      const location = (event as CustomEvent<{ latitude?: number; longitude?: number }>).detail;
      void loadKitchen(location?.latitude, location?.longitude);
    };
    window.addEventListener("homefoods:location-change", onLocationChange);
    void fetch("/api/auth", { cache: "no-store" }).then((response) => response.json()).then((auth) => {
      const ownerId = auth.user?.role === "CUSTOMER" ? Number(auth.user.id) : null;
      setCartOwnerId(Number.isInteger(ownerId) ? ownerId : null);
    }).catch(() => setCartOwnerId(null));
    return () => { active = false; window.removeEventListener("homefoods:location-change", onLocationChange); };
  }, [id]);

  useEffect(() => {
    const key = cartKey(cartOwnerId);
    queueMicrotask(() => {
      try {
        let stored = window.localStorage.getItem(key);
        // Migrate the former shared cart to a guest cart exactly once. It is never assigned to a signed-in user.
        if (!stored && cartOwnerId === null) {
          stored = window.localStorage.getItem("home-foods-cart");
          if (stored) window.localStorage.setItem(key, stored);
        }
        const lines = stored ? JSON.parse(stored) as CartLine[] : [];
        setCartCount(lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0));
      } catch { window.localStorage.removeItem(key); setCartCount(0); }
    });
  }, [cartOwnerId]);

  useEffect(() => {
    let active = true;
    const refresh=()=>{void fetch("/api/auth", { cache: "no-store" }).then((response) => response.json()).then(async (auth) => {
      if (!active || auth.user?.role !== "CUSTOMER") return;
      setIsCustomer(true);
      const response = await fetch("/api/favorites", { cache: "no-store" });
      const data = await response.json();
      if (active && response.ok) { setFavoriteIds((data.favorites ?? []).map((row: { menuItemId: number }) => row.menuItemId)); setIsKitchenFavorite((data.favoriteKitchens ?? []).some((row: { shopId: number }) => row.shopId === Number(id))); }
    }).catch(() => undefined);
    };refresh();const storage=(e:StorageEvent)=>{if(e.key==="homefoods:favorites-updated")refresh();};window.addEventListener("focus",refresh);window.addEventListener("storage",storage);
    return () => { active = false;window.removeEventListener("focus",refresh);window.removeEventListener("storage",storage); };
  }, [id]);

  const categories = useMemo(() => ["All", ...new Set((kitchen?.menuItems ?? []).map((item) => item.category?.name || "Other"))], [kitchen]);
  const visibleItems = useMemo(() => (kitchen?.menuItems ?? []).filter((item) => selectedCategory === "All" || (item.category?.name || "Other") === selectedCategory), [kitchen, selectedCategory]);

  useEffect(() => {
    if (!kitchen) return;
    const selectedItem = new URLSearchParams(window.location.search).get("item");
    if (selectedItem) window.setTimeout(() => document.getElementById(`menu-item-${selectedItem}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, [kitchen]);

  function addItem(item: MenuItem) {
    if (!kitchen || !item.isAvailable) return;
    if (deliveryCheck && deliveryCheck.status !== "available") { setNotice(deliveryCheck.message || "Delivery availability must be checked before ordering from this kitchen."); window.setTimeout(() => setNotice(""), 3500); return; }
    const dish: CartDish = { id: item.id, shopId: kitchen.id, name: item.name, shop: kitchen.name, cuisine: item.category?.name ?? kitchen.city ?? "Home cooked", category: item.category?.name ?? "Other", price: item.price, rating: null, time: kitchen.estimatedMinutes == null ? "Estimate unavailable" : `${kitchen.estimatedMinutes} min`, image: item.imageUrl, description: item.description ?? "Made fresh by a local home cook.", deliveryFee: kitchen.deliveryFee ?? 2.5 };
    let lines: CartLine[] = [];
    try { lines = JSON.parse(window.localStorage.getItem(cartKey(cartOwnerId)) ?? "[]") as CartLine[]; } catch { lines = []; }
    const existing = lines.find((line) => line.dish.id === item.id);
    lines = existing ? lines.map((line) => line.dish.id === item.id ? { ...line, quantity: line.quantity + 1 } : line) : [...lines, { dish, quantity: 1 }];
    window.localStorage.setItem(cartKey(cartOwnerId), JSON.stringify(lines));
    setCartCount(lines.reduce((sum, line) => sum + line.quantity, 0));
    setNotice(`${item.name} added to your cart.`);
    window.setTimeout(() => setNotice(""), 2500);
  }

  async function toggleFavorite(item: MenuItem) {
    if (!isCustomer) { router.push(`/signin?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    const wasSaved = favoriteIds.includes(item.id);
    setFavoriteIds((current) => wasSaved ? current.filter((id) => id !== item.id) : [...current, item.id]);
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ menuItemId: item.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Couldn’t update your favorites.");
      publishFavoritesChange();
      if (payload.saved === wasSaved) setFavoriteIds((current) => payload.saved ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id));
      setNotice(payload.saved ? `${item.name} saved to favorites.` : `${item.name} removed from favorites.`);
    } catch (cause) {
      setFavoriteIds((current) => wasSaved ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id));
      setNotice(cause instanceof Error ? cause.message : "Couldn’t update your favorites.");
    }
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function toggleKitchenFavorite() {
    if (!kitchen) return;
    if (!isCustomer) { router.push(`/signin?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    const wasSaved = isKitchenFavorite;
    setIsKitchenFavorite(!wasSaved);
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId: kitchen.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Couldn’t update your kitchen favorites.");
      publishFavoritesChange();
      if (payload.saved === wasSaved) setIsKitchenFavorite(payload.saved);
      setNotice(payload.saved ? `${kitchen.name} saved to favorites.` : `${kitchen.name} removed from favorites.`);
    } catch (cause) { setIsKitchenFavorite(wasSaved); setNotice(cause instanceof Error ? cause.message : "Couldn’t update your kitchen favorites."); }
    window.setTimeout(() => setNotice(""), 3000);
  }

  const averageRating = kitchen?.reviews.length ? kitchen.reviews.reduce((sum, review) => sum + review.rating, 0) / kitchen.reviews.length : null;
  const cover = kitchen?.coverImageUrl || kitchen?.menuItems.find((item) => item.imageUrl)?.imageUrl || fallbackCover;

  return <main id="main-content" tabIndex={-1} className="kitchen-page"><header className="kitchen-header"><Link className="kitchen-menu-back" href="/" aria-label="Back to HomeFoods">←</Link><Brand/><LocationSelector/><Link className="kitchen-cart-link" href="/?cart=open" aria-label={`Open cart${cartCount ? `, ${cartCount} items` : ""}`}><svg className="cart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 3.5h2.2l2.1 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4l2-7.2H6"/><circle cx="9.3" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg>{cartCount > 0 && <span className="cart-count">{cartCount}</span>}</Link></header>
    {loading ? <div className="kitchen-loading"><span className="loading-spinner"/><p>Bringing the kitchen menu to the table…</p></div> : error || !kitchen ? <div className="kitchen-empty"><span>♨</span><h1>We can’t find this kitchen</h1><p>{error || "This home kitchen may have paused its menu."}</p><Link className="dark-cta" href="/#home-sections">Explore other kitchens <span>→</span></Link></div> : <>
      <section className="kitchen-hero"><div className="kitchen-hero-cover"><MarketImage src={cover} alt={`${kitchen.name} kitchen`} fallbackSrc={fallbackCover}/></div><div className="kitchen-heading"><div className="kitchen-identity">{kitchen.logoUrl ? <span className="kitchen-identity-logo"><MarketImage src={kitchen.logoUrl} alt={`${kitchen.name} logo`} fallbackSrc={fallbackCover}/></span> : <span className="kitchen-identity-initial">{kitchen.name.slice(0, 1).toUpperCase()}</span>}<div><span className="eyebrow"><span className="eyebrow-line"/> HOME KITCHEN</span><h1>{kitchen.name}</h1></div></div><button className={`kitchen-save-button ${isKitchenFavorite ? "is-saved" : ""}`} type="button" aria-pressed={isKitchenFavorite} aria-label={`${isKitchenFavorite ? "Remove" : "Save"} ${kitchen.name} ${isKitchenFavorite ? "from" : "to"} favorites`} onClick={() => void toggleKitchenFavorite()}>{isKitchenFavorite ? "♥" : "♡"} {isKitchenFavorite ? "Saved" : "Save kitchen"}</button><p className="kitchen-description">{kitchen.description || `Homemade favourites, made fresh in ${kitchen.city || "your neighbourhood"}.`}</p><div className="kitchen-facts">{averageRating != null && <span className="kitchen-rating">★ {averageRating.toFixed(1)} <small>({kitchen.reviews.length} {kitchen.reviews.length === 1 ? "review" : "reviews"})</small></span>}{kitchen.city && <span>⌖ {kitchen.city}</span>}{deliveryCheck?.status === "available" && <span>◉ {deliveryCheck.distanceKm?.toFixed(1)} km by road</span>}{kitchen.estimatedMinutes != null && <span>◷ {kitchen.estimatedMinutes} min delivery</span>}{kitchen.deliveryFee != null && <span>{kitchen.deliveryFee === 0 ? "Free delivery" : `${money(kitchen.deliveryFee)} delivery`}</span>}{kitchen.minimumOrder != null && <span>Minimum order {money(kitchen.minimumOrder)}</span>}</div>{deliveryCheck && deliveryCheck.status !== "available" && <p className="kitchen-data-note" role="status">{deliveryCheck.message}</p>}<p className="kitchen-data-note">Menu availability is updated by this kitchen. Opening hours aren’t available in this app yet.</p></div></section>
      <section className="kitchen-menu-section"><div className="kitchen-menu-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> MADE HERE, FOR YOU</div><h2>Today’s menu</h2><p>Choose something lovely from {kitchen.name}.</p></div><Link href="/?cart=open" className="kitchen-cart-cta">View cart <span>({cartCount})</span> →</Link></div><nav className="kitchen-category-nav" aria-label="Menu categories">{categories.map((category) => <button key={category} className={selectedCategory === category ? "active" : ""} onClick={() => setSelectedCategory(category)}>{category}</button>)}</nav><div className="kitchen-menu-grid">{visibleItems.map((item) => <article className={`kitchen-menu-card${item.isAvailable ? "" : " unavailable"}`} key={item.id} id={`menu-item-${item.id}`}><div className="kitchen-item-image"><MarketImage src={item.imageUrl} alt={`${item.name}, from ${kitchen.name}`} fallbackSrc={cover}/>{!item.isAvailable && <span className="unavailable-label">Currently unavailable</span>}</div><div className="kitchen-item-content"><div className="kitchen-item-name"><h3>{item.name}</h3><span className="kitchen-item-actions"><button type="button" className={`kitchen-favorite ${favoriteIds.includes(item.id) ? "is-saved" : ""}`} aria-pressed={favoriteIds.includes(item.id)} aria-label={`${favoriteIds.includes(item.id) ? "Remove" : "Save"} ${item.name} ${favoriteIds.includes(item.id) ? "from" : "to"} favorites`} onClick={() => void toggleFavorite(item)}>{favoriteIds.includes(item.id) ? "♥" : "♡"}</button><b>{money(item.price)}</b></span></div><p>{item.description || "Made fresh by a local home cook."}</p><button disabled={!item.isAvailable || Boolean(deliveryCheck && deliveryCheck.status !== "available")} onClick={() => addItem(item)} aria-label={`${item.isAvailable && (!deliveryCheck || deliveryCheck.status === "available") ? "Add" : "Unavailable:"} ${item.name} to cart`}>{!item.isAvailable ? "Unavailable" : deliveryCheck && deliveryCheck.status !== "available" ? "Delivery unavailable" : <><span>+</span> Add to cart</>}</button></div></article>)}</div>{!visibleItems.length && <p className="kitchen-menu-empty">No items in this category yet.</p>}<p className="kitchen-multi-order-note">Your cart can include food from different kitchens. HomeFoods creates a separate order for each kitchen at checkout.</p></section>
    </>}{notice && <div className="kitchen-toast" role="status">✓ {notice} <Link href="/?cart=open">View cart</Link></div>}<footer className="kitchen-footer"><Brand compact/><span>Homemade happiness, delivered.</span><Link href="/">Back to HomeFoods</Link></footer></main>;
}
