"use client";

function publishFavoritesChange(){localStorage.setItem("homefoods:favorites-updated",String(Date.now()));window.dispatchEvent(new Event("homefoods:favorites-change"));}

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import OverlayLayer from "@/src/components/overlay-layer";
import Brand from "@/src/components/brand";
import LocationSelector, { type DeliveryLocation } from "@/src/components/location-selector";
import { ThemeToggle } from "@/src/components/site-enhancements";
import HomeSections from "@/src/components/home-sections";
import { OriginButton } from "@/src/components/ui/origin-button";
import MarketImage from "@/src/components/market-image";
import { filterAndSortDishes, normalizeCatalogSearchText } from "@/src/lib/catalog-filter";

type Dish = { id: number; shopId: number; name: string; shop: string; cuisine: string; category: string; price: number; rating: number | null; time: string; estimatedMinutes?: number | null; deliveryDistanceKm?: number | null; image: string | null; description: string; deliveryFee: number; orderCount?: number; favoriteCount?: number; isFeatured?: boolean };
type CartLine = { dish: Dish; quantity: number };
type User = { id: number; email: string; name: string | null; role: "CUSTOMER" | "SELLER" | "RIDER" | "ADMIN" };
type Shop = { id: number; name: string; description?: string | null; logoUrl?: string | null; coverImageUrl?: string | null; city?: string | null; cuisine?: string; status?: string; deliveryFee?: number | null; estimatedMinutes?: number | null; distanceKm?: number | null; deliveryDistanceKm?: number | null; deliverable?: boolean | null; deliveryStatus?: string | null; latitude?: number | null; longitude?: number | null; rating?: number | null; reviewCount?: number; orderCount?: number; favoriteCount?: number; createdAt?: string };
type CarouselSection = { id: string; title: string; description: string; kind: "food" | "kitchen"; href: string; items: Array<Dish | Shop> };
const categories = ["All", "Bangladeshi", "Indian", "Biryani", "Beef", "Chicken", "Vegetarian", "Desserts"];
function CategoryIcon({ index }: { index: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.65, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons = [
    <><path d="m3.5 10 8.5-7 8.5 7"/><path d="M5.5 9v11h13V9M9 20v-6h6v6"/></>,
    <><path d="M12 21c-4.2-3.2-6.5-6.4-6.5-9.8A6.5 6.5 0 0 1 12 4.7a6.5 6.5 0 0 1 6.5 6.5C18.5 14.6 16.2 17.8 12 21Z"/><path d="M12 15.8c-1.6-1.5-2.4-2.7-2.4-4.2A2.4 2.4 0 0 1 12 9.2a2.4 2.4 0 0 1 2.4 2.4c0 1.5-.8 2.7-2.4 4.2Z"/></>,
    <><path d="M4 12h16c-.4 5-3.1 8-8 8s-7.6-3-8-8Z"/><path d="M6 9c1-1.1 1-2.1 0-3.2M12 9c1-1.1 1-2.1 0-3.2M18 9c1-1.1 1-2.1 0-3.2"/></>,
    <><path d="M4 13.5h16c-.4 4.2-3.1 6.5-8 6.5s-7.6-2.3-8-6.5Z"/><path d="M7 10.5v1M10 8.5v2M14 9v2M17 10v1M4 13.5c1.5-1.1 3-1.1 4.5 0s3 1.1 4.5 0 3-1.1 4.5 0 3 1.1 4.5 0"/></>,
    <><path d="M4 12.5c0-4 3.1-7 8-7s8 3 8 7-3.1 7-8 7-8-3-8-7Z"/><path d="M8 9.5c1.1 1 2.2 1 3.3 0s2.2-1 3.3 0M8 15.5c1.1-1 2.2-1 3.3 0s2.2 1 3.3 0"/><circle cx="17.5" cy="7" r="2.2"/></>,
    <><path d="M5 14c0-4.4 3.4-8 7.5-8 3.8 0 6.5 2.8 6.5 6.5 0 2.5-1.7 4.5-4 4.5h-2l-1.3 2H10a5 5 0 0 1-5-5Z"/><path d="M9 9.5h.01M13 8h.01M16 10h.01"/></>,
    <><path d="M20.5 3.5c-8.2.1-14.7 2.4-16.4 8.1-1.2 4.1 1.2 7.3 4.8 7.3 6.3 0 10.2-7.2 11.6-15.4Z"/><path d="M4.5 19.5c3.5-4.8 7.4-8 12-10.7"/></>,
    <><path d="M5 7h14l-1.5 14h-11L5 7Z"/><path d="M4 7h16M9 7c0-2 1.1-3.2 3-3.2S15 5 15 7M9 12h6M9 15h6"/></>,
  ];
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>{icons[index]}</svg>;
}
const money = (n: number) => new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(n);
const siteSearchItems = [
  { title: "How HomeFoods works", description: "Browse, order, pay, and follow a delivery.", href: "#how" },
  { title: "Meet the home cooks", description: "Join as a cook or delivery rider.", href: "#chefs" },
  { title: "Frequently asked questions", description: "Payment, delivery, and getting started.", href: "#faq" },
  { title: "Newsletter", description: "Get updates from kitchens in your neighbourhood.", href: "#newsletter" },
];

function FoodImage({ dish, className = "" }: { dish: Dish; className?: string }) {
  const name = `${dish.name} ${dish.category}`.toLowerCase();
  const fallback = name.includes("biryani") ? "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=900&q=85" : name.includes("beef") || name.includes("bhuna") || name.includes("curry") ? "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85" : name.includes("chicken") ? "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=85" : name.includes("dessert") || name.includes("sweet") ? "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85" : name.includes("vegetarian") ? "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85" : "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=85";
  return <MarketImage className={`food-image ${className}`} src={dish.image} fallbackSrc={fallback} alt={`${dish.name}, ${dish.cuisine} cuisine`} />;
}
function HighlightedMatch({ text, query }: { text: string; query: string }) {
  const matchAt = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (matchAt < 0 || !query.trim()) return text;
  return <>{text.slice(0, matchAt)}<mark>{text.slice(matchAt, matchAt + query.trim().length)}</mark>{text.slice(matchAt + query.trim().length)}</>;
}

export default function Home() {
  const router = useRouter();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [sections, setSections] = useState<CarouselSection[]>([]);
  const [searchDishes, setSearchDishes] = useState<Dish[]>([]);
  const [searchKitchens, setSearchKitchens] = useState<Shop[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const catalogRequestId = useRef(0);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const cartTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const checkoutDialogRef = useRef<HTMLElement>(null);
  const checkoutTriggerRef = useRef<HTMLElement | null>(null);
  const [category, setCategory] = useState("All");
  const [quickOnly, setQuickOnly] = useState(false);
  const [freeDeliveryOnly, setFreeDeliveryOnly] = useState(false);
  const [topRatedOnly, setTopRatedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("recommended");
  const [sortTouched, setSortTouched] = useState(false);
  function chooseCategory(next: string) {
    setCategory(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "All") params.delete("category"); else params.set("category", next);
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
  }
  const [selectedLocation, setSelectedLocation] = useState<DeliveryLocation>({ label: "Choose a location" });
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{ checked: boolean; available: boolean; kitchenCount: number; radiusEnforced?: boolean; nationwideDevelopmentMode?: boolean } | null>(null);
  const [showUnavailableKitchens, setShowUnavailableKitchens] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loadedCartKey, setLoadedCartKey] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartNotes, setCartNotes] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [complete, setComplete] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [favoriteShops, setFavoriteShops] = useState<number[]>([]);
  const [favoriteError, setFavoriteError] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const orderSubmitLock = useRef(false);
  const checkoutAttempt = useRef<{signature:string;key:string}|null>(null);
  const deliveryRequest = useRef(0);
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [orderNumbers, setOrderNumbers] = useState<string[]>([]);
  const [orderError, setOrderError] = useState("");
  const [deliveryCheckStatus, setDeliveryCheckStatus] = useState<"idle" | "checking" | "ready" | "blocked">("idle");

  const loadCatalog = useCallback(async () => {
    const requestId = ++catalogRequestId.current;
    setCatalogLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedLocation.latitude != null && selectedLocation.longitude != null) { params.set("lat", String(selectedLocation.latitude)); params.set("lng", String(selectedLocation.longitude)); }
      if (showUnavailableKitchens) params.set("includeUnavailable", "1");
      const response = await fetch(`/api/catalog${params.size ? `?${params}` : ""}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Menu unavailable.");
      if (requestId !== catalogRequestId.current) return;
      setShops((payload.shops ?? []) as Shop[]);
      setDishes((payload.dishes ?? []) as Dish[]);
      setSections((payload.sections ?? []) as CarouselSection[]);
      setLocationStatus(payload.locationStatus ?? null);
      setCatalogError("");
    } catch (error) { if (requestId === catalogRequestId.current) setCatalogError(error instanceof Error ? error.message : "Menu is unavailable."); }
    finally { if (requestId === catalogRequestId.current) setCatalogLoading(false); }
  }, [selectedLocation.latitude, selectedLocation.longitude, showUnavailableKitchens]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("cart") === "open") setCartOpen(true);
      const reorderNotice=sessionStorage.getItem("homefoods:reorder-notice");if(reorderNotice){setPromoMessage(reorderNotice);sessionStorage.removeItem("homefoods:reorder-notice");}
      if (params.get("signin") === "1") { router.replace("/signin"); }
      const allowedSorts = ["recommended", "price-low", "price-high", "rating", "fastest", "nearest"];
      if (allowedSorts.includes(params.get("sort") ?? "")) { setSortBy(params.get("sort")!); setSortTouched(params.has("sort")); }
      if (categories.includes(params.get("category") ?? "")) setCategory(params.get("category")!);
      setQuickOnly(params.get("quick") === "1"); setTopRatedOnly(params.get("rated") === "1"); setFreeDeliveryOnly(params.get("free") === "1");
      const savedLocation = window.localStorage.getItem("home-foods-location:guest");
      if (savedLocation) { try { setSelectedLocation(JSON.parse(savedLocation) as typeof selectedLocation); } catch { /* Ignore stale or malformed location data. */ } }
      setFiltersHydrated(true);
    });
  }, [router]);
  useEffect(() => {
    function onLocationChange(event: Event) {
      const detail = (event as CustomEvent<typeof selectedLocation>).detail;
      if (!detail) return;
      const changed = detail.addressId !== selectedLocation.addressId || detail.latitude !== selectedLocation.latitude || detail.longitude !== selectedLocation.longitude || detail.ownerId !== selectedLocation.ownerId;
      if (changed) { deliveryRequest.current++; setDeliveryCheckStatus("idle"); setOrderError(placingOrder ? "Your delivery address changed. Please review it and place the order again." : ""); }
      setSelectedLocation(detail); setSelectedAddressId(detail.addressId ?? null);
      setAddressLine1(detail.address?.addressLine1 ?? ""); setCity(detail.address?.city ?? ""); setPostalCode(detail.address?.postalCode ?? "");
    }
    window.addEventListener("homefoods:location-change", onLocationChange);
    return () => window.removeEventListener("homefoods:location-change", onLocationChange);
  }, [selectedLocation, placingOrder]);
  useEffect(() => { void Promise.resolve().then(loadCatalog); }, [loadCatalog]);
  const unavailableCartShops = useMemo(() => {
    if (!locationStatus?.checked || !cart.length) return [];
    const availableShopIds = new Set(shops.map((shop) => shop.id));
    return [...new Set(cart.filter((line) => !availableShopIds.has(line.dish.shopId)).map((line) => line.dish.shop))];
  }, [locationStatus, shops, cart]);
  useEffect(() => {
    if (!filtersHydrated) return;
    const params = new URLSearchParams(window.location.search);
    const values: Array<[string, string, string]> = [["sort", sortTouched ? sortBy : "", ""], ["category", category, "All"], ["quick", quickOnly ? "1" : "", ""], ["rated", topRatedOnly ? "1" : "", ""], ["free", freeDeliveryOnly ? "1" : "", ""]];
    for (const [key, value, defaultValue] of values) { if (value && value !== defaultValue) params.set(key, value); else params.delete(key); }
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
  }, [filtersHydrated, sortBy, sortTouched, category, quickOnly, topRatedOnly, freeDeliveryOnly]);
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: normalized });
      if (selectedLocation.latitude != null && selectedLocation.longitude != null) { params.set("lat", String(selectedLocation.latitude)); params.set("lng", String(selectedLocation.longitude)); }
      void fetch(`/api/catalog?${params}`, { cache: "no-store" }).then((response) => response.json()).then((payload) => { if (active) { setSearchDishes((payload.results ?? []) as Dish[]); setSearchKitchens((payload.kitchens ?? []) as Shop[]); } }).catch(() => { if (active) { setSearchDishes([]); setSearchKitchens([]); } });
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, selectedLocation.latitude, selectedLocation.longitude]);
  const cartStorageKey = `home-foods-cart:${user?.role === "CUSTOMER" ? user.id : "guest"}`;
  useEffect(() => {
    let active = true, generation = 0;
    const refreshAccount = () => {
      const currentRequest = ++generation;
      setSelectedAddressId(null); setAddressLine1(""); setCity(""); setPostalCode(""); setOrderError(""); setDeliveryCheckStatus("idle");
      checkoutAttempt.current = null;
      void fetch("/api/auth", { cache: "no-store" }).then(response => response.json()).then(async data => {
        if (!active || currentRequest !== generation) return;
        const current = data.user as User | null;
        setUser(current); setFavorites([]); setFavoriteShops([]);
        if (current?.role === "CUSTOMER") {
          const response = await fetch("/api/favorites", { cache: "no-store" });
          const favorites = await response.json();
          if (!active || currentRequest !== generation) return;
          setFavorites((favorites.favorites ?? []).map((f: { menuItemId: number }) => f.menuItemId));
          setFavoriteShops((favorites.favoriteKitchens ?? []).map((f: { shopId: number }) => f.shopId));
        }
      }).catch(() => { if (active && currentRequest === generation) setUser(null); });
    };
    refreshAccount(); window.addEventListener("homefoods:account-change", refreshAccount);
    return () => { active = false; window.removeEventListener("homefoods:account-change", refreshAccount); };
  }, []);
  useEffect(()=>{let active=true;const refresh=()=>{if(user?.role!=="CUSTOMER")return;void fetch("/api/favorites",{cache:"no-store"}).then(r=>r.json()).then(data=>{if(active){setFavorites((data.favorites??[]).map((f:{menuItemId:number})=>f.menuItemId));setFavoriteShops((data.favoriteKitchens??[]).map((f:{shopId:number})=>f.shopId));}}).catch(()=>{});};const storage=(e:StorageEvent)=>{if(e.key==="homefoods:favorites-updated")refresh();};window.addEventListener("focus",refresh);window.addEventListener("storage",storage);return()=>{active=false;window.removeEventListener("focus",refresh);window.removeEventListener("storage",storage);};},[user]);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        let stored = window.localStorage.getItem(cartStorageKey);
        if (!stored && cartStorageKey.endsWith(":guest")) {
          stored = window.localStorage.getItem("home-foods-cart");
          if (stored) window.localStorage.setItem(cartStorageKey, stored);
        }
        setCart(stored ? JSON.parse(stored) as CartLine[] : []);
      } catch { window.localStorage.removeItem(cartStorageKey); setCart([]); }
      setLoadedCartKey(cartStorageKey);
    });
  }, [cartStorageKey]);
  useEffect(() => { if (loadedCartKey === cartStorageKey) window.localStorage.setItem(cartStorageKey, JSON.stringify(cart)); }, [cart, cartStorageKey, loadedCartKey]);
  useEffect(() => {
    function closeSearch(event: MouseEvent) { if (!searchWrapRef.current?.contains(event.target as Node)) { setSearchOpen(false); setActiveSuggestion(-1); } }
    function escapeSearch(event: globalThis.KeyboardEvent) { if (event.key === "Escape") { setSearchOpen(false); setActiveSuggestion(-1); } }
    document.addEventListener("mousedown", closeSearch); document.addEventListener("keydown", escapeSearch);
    return () => { document.removeEventListener("mousedown", closeSearch); document.removeEventListener("keydown", escapeSearch); };
  }, []);
  useEffect(() => {
    function closeMobileNavigation() { if (window.innerWidth > 900) setMobileMenuOpen(false); }
    window.addEventListener("resize", closeMobileNavigation);
    return () => window.removeEventListener("resize", closeMobileNavigation);
  }, []);

  const visibleDishes = useMemo(() => filterAndSortDishes(query.trim().length >= 2 ? searchDishes : dishes, { query, category, under30: quickOnly, freeDelivery: freeDeliveryOnly, topRated: topRatedOnly, sort: sortBy as "recommended" | "price-low" | "price-high" | "rating" | "fastest" | "nearest" }), [dishes, searchDishes, category, query, quickOnly, freeDeliveryOnly, topRatedOnly, sortBy]);
  const siteSearchMatches = useMemo(() => { const normalized = normalizeCatalogSearchText(query); return normalized.length < 2 ? [] : siteSearchItems.filter((item) => normalizeCatalogSearchText(`${item.title} ${item.description}`).includes(normalized)); }, [query]);
  const kitchenMatches = useMemo(() => {
    const normalized = normalizeCatalogSearchText(query);
    if (normalized.length < 2) return [];
    const byId = new Map<number, Shop>();
    for (const shop of [...searchKitchens, ...shops]) if (normalizeCatalogSearchText(`${shop.name} ${shop.description ?? ""} ${shop.city ?? ""} ${shop.cuisine ?? ""}`).includes(normalized)) byId.set(shop.id, shop);
    return [...byId.values()].slice(0, 6);
  }, [query, shops, searchKitchens]);
  const searchSuggestions = useMemo(() => query.trim().length < 2 ? [] : visibleDishes.slice(0, 5), [query, visibleDishes]);
  const hasActiveDiscovery = category !== "All" || quickOnly || freeDeliveryOnly || topRatedOnly || sortTouched || Boolean(query.trim());
  const discoverySections = useMemo(() => {
    if (!hasActiveDiscovery) return sections;
    const title = query.trim() ? `Results for “${query.trim()}”` : `${category === "All" ? "Matching" : category} dishes`;
    const matches: CarouselSection[] = [];
    if (query.trim().length >= 2 && kitchenMatches.length) matches.push({ id: "matching-kitchens", title: "Matching kitchens", description: "Published kitchens and their current delivery details.", kind: "kitchen", href: "/collections/featured-kitchens", items: kitchenMatches });
    if (visibleDishes.length || !kitchenMatches.length) matches.push({ id: "filtered-dishes", title, description: "Sorted by current menu prices, stored kitchen ratings and available delivery data.", kind: "food", href: "/collections/top-picks", items: visibleDishes });
    if (!matches.length) matches.push({ id: "filtered-dishes", title, description: "Sorted by current menu prices, stored kitchen ratings and available delivery data.", kind: "food", href: "/collections/top-picks", items: [] });
    return matches;
  }, [hasActiveDiscovery, category, query, visibleDishes, kitchenMatches, sections]);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.dish.price, 0);
  const deliveryTotal = [...new Map(cart.map(({ dish }) => [dish.shopId, dish.deliveryFee])).values()].reduce((sum, fee) => sum + fee, 0);
  const serviceFee = Math.round([...new Set(cart.map(line => line.dish.shopId))].reduce((total, shopId) => total + Math.round(cart.filter(line => line.dish.shopId === shopId).reduce((sum, line) => sum + line.dish.price * line.quantity, 0) * 5) / 100, 0) * 100) / 100;
  const cartTotal = subtotal + deliveryTotal + serviceFee;

  function add(dish: Dish) {
    if (selectedLocation.latitude != null && selectedLocation.longitude != null && dish.deliveryDistanceKm == null && locationStatus?.radiusEnforced !== false) {
      setCatalogError("Delivery distance isn't confirmed for this kitchen yet. Choose another kitchen or check your address.");
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.dish.id === dish.id);
      return existing ? current.map((line) => line.dish.id === dish.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { dish, quantity: 1 }];
    });
  }
  function changeQuantity(id: number, delta: number) { setCart((current) => current.map((line) => line.dish.id === id ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0)); }

  async function validateCartDelivery(addressId = selectedAddressId) {
    if (!cart.length) return false;
    if (!addressId) { setDeliveryCheckStatus("blocked"); setOrderError("Choose and confirm a Finnish delivery address before continuing."); return false; }
    const version = ++deliveryRequest.current;
    setDeliveryCheckStatus("checking"); setOrderError("");
    try {
      const response = await fetch("/api/location/delivery-check", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({addressId,shopIds:[...new Set(cart.map(({dish})=>dish.shopId))]}),signal:AbortSignal.timeout(30000) });
      const result = await response.json();
      if (version !== deliveryRequest.current) return false;
      if (!response.ok) throw new Error(result.error ?? "Delivery availability could not be checked.");
      const unavailable = result.checks?.find((check:{eligible:boolean;message?:string})=>!check.eligible);
      if (unavailable) throw new Error(unavailable.message);
      setLocationStatus({checked:true,available:true,kitchenCount:result.checks.length,radiusEnforced:result.radiusEnforced,nationwideDevelopmentMode:result.nationwideDevelopmentMode});
      setDeliveryCheckStatus("ready");return true;
    } catch(error) { if(version===deliveryRequest.current){setDeliveryCheckStatus("blocked");setOrderError(error instanceof Error?error.message:"Delivery availability could not be checked.");}return false; }
  }

  function openCheckout() {
    if (!user) { setCartOpen(false); router.push("/signin?returnTo=%2F%3Fcart%3Dopen"); return; }
    if (user.role !== "CUSTOMER") { setOrderError("Checkout is available for customer accounts."); return; }
    checkoutTriggerRef.current = cartTriggerRef.current;
    setCartOpen(false); setCheckout(true); setDeliveryCheckStatus("idle"); setOrderError("");
    if (selectedAddressId) void validateCartDelivery();
    else setOrderError("Choose or enter a confirmed Finnish delivery address before continuing.");
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && searchOpen) { event.preventDefault(); setActiveSuggestion((active) => Math.min(active + 1, searchSuggestions.length + kitchenMatches.length + siteSearchMatches.length - 1)); }
    if (event.key === "ArrowUp" && searchOpen) { event.preventDefault(); setActiveSuggestion((active) => Math.max(-1, active - 1)); }
    if (event.key === "Enter") {
      const index = activeSuggestion;
      if (index >= 0 && index < searchSuggestions.length) { event.preventDefault(); router.push(`/kitchens/${searchSuggestions[index].shopId}?item=${searchSuggestions[index].id}`); }
      else if (index >= searchSuggestions.length && kitchenMatches[index - searchSuggestions.length]) { event.preventDefault(); router.push(`/kitchens/${kitchenMatches[index - searchSuggestions.length].id}`); }
      else if (index >= searchSuggestions.length + kitchenMatches.length && siteSearchMatches[index - searchSuggestions.length - kitchenMatches.length]) { event.preventDefault(); router.push(siteSearchMatches[index - searchSuggestions.length - kitchenMatches.length].href); }
      else { setSearchOpen(false); document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" }); }
    }
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(orderSubmitLock.current) return; orderSubmitLock.current=true; setOrderError(""); setPlacingOrder(true);
    if (!user) { orderSubmitLock.current=false;setPlacingOrder(false);setCheckout(false); router.push("/signin?returnTo=%2F%3Fcart%3Dopen"); return; }
    try {
      const deliverable = await validateCartDelivery();
      if (!deliverable) { setPlacingOrder(false); return; }
      const orderBody = {lines:cart.map(({dish,quantity})=>({menuItemId:dish.id,quantity})),addressId:selectedAddressId,paymentMethod,notes:cartNotes};
      const signature=JSON.stringify(orderBody);
      const attemptStorageKey = `homefoods:checkout-attempt:${user.id}`;
      if(!checkoutAttempt.current) { try { checkoutAttempt.current=JSON.parse(sessionStorage.getItem(attemptStorageKey) ?? "null"); } catch {} }
      if(checkoutAttempt.current?.signature!==signature) checkoutAttempt.current={signature,key:crypto.randomUUID()};
      sessionStorage.setItem(attemptStorageKey,JSON.stringify(checkoutAttempt.current));
      const response = await fetch("/api/orders", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...orderBody,idempotencyKey:checkoutAttempt.current.key})});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "We couldn't place your order.");
      if (payload.checkoutUrl) { window.location.assign(payload.checkoutUrl); return; }
      setOrderNumbers((payload.orders ?? []).map((order: { orderNumber: string }) => order.orderNumber));
      setCart([]); setCheckout(false); setComplete(true); checkoutAttempt.current=null; sessionStorage.removeItem(`homefoods:checkout-attempt:${user.id}`);
    } catch (error) { setOrderError(error instanceof Error ? error.message : "Order service unavailable."); }
    finally { setPlacingOrder(false); orderSubmitLock.current=false; }
  }

  async function signOut() { await fetch("/api/auth", { method: "DELETE" }); window.dispatchEvent(new Event("homefoods:account-change")); router.replace("/"); }
  async function toggleFavorite(dish: Dish) {
    if (!user) { router.push(`/signin?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    if (user.role !== "CUSTOMER") { setCatalogError("Favorites are available for customer accounts."); return; }
    const wasSaved = favorites.includes(dish.id);
    setFavorites((current) => wasSaved ? current.filter((id) => id !== dish.id) : [...current, dish.id]);
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ menuItemId: dish.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Couldn't save that favorite.");
      publishFavoritesChange();
      if (payload.saved === wasSaved) setFavorites((current) => payload.saved ? [...new Set([...current, dish.id])] : current.filter((id) => id !== dish.id));
      setFavoriteError("");
    } catch (error) { setFavorites((current) => wasSaved ? [...new Set([...current, dish.id])] : current.filter((id) => id !== dish.id)); setFavoriteError(error instanceof Error ? error.message : "Couldn't save that favorite."); }
  }
  async function toggleKitchenFavorite(shop: Shop) {
    if (!user) { router.push(`/signin?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    if (user.role !== "CUSTOMER") { setCatalogError("Favorites are available for customer accounts."); return; }
    const wasSaved = favoriteShops.includes(shop.id);
    setFavoriteShops((current) => wasSaved ? current.filter((id) => id !== shop.id) : [...current, shop.id]);
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId: shop.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Couldn't update your kitchen favorites.");
      publishFavoritesChange();
      if (payload.saved === wasSaved) setFavoriteShops((current) => payload.saved ? [...new Set([...current, shop.id])] : current.filter((id) => id !== shop.id));
      setFavoriteError("");
    } catch (error) { setFavoriteShops((current) => wasSaved ? [...new Set([...current, shop.id])] : current.filter((id) => id !== shop.id)); setFavoriteError(error instanceof Error ? error.message : "Couldn't update your kitchen favorites."); }
  }

  async function subscribeNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewsletterStatus("Saving your subscription…");
    try {
      const response = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: newsletterEmail, consent: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We couldn't save your signup.");
      setNewsletterStatus("You’re signed up. Your email is saved for HomeFoods updates.");
      setNewsletterEmail("");
    } catch (issue) { setNewsletterStatus(issue instanceof Error ? issue.message : "Newsletter signup is unavailable right now."); }
  }

  return (
    <main id="main-content" tabIndex={-1}>
      <div className="market-shell">
        <header className="site-header market-topbar">
          <button ref={menuTriggerRef} className="mobile-menu-toggle" type="button" aria-expanded={mobileMenuOpen} aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} onClick={() => setMobileMenuOpen((open) => !open)}>{mobileMenuOpen ? "×" : "☰"}</button>
          <Brand href="#top" />
          <LocationSelector onSelect={(location, address) => { setSelectedLocation(location); if (address) { setAddressLine1(address.addressLine1); setCity(address.city); setPostalCode(address.postalCode ?? ""); if (address.id) setSelectedAddressId(address.id); } else setSelectedAddressId(null); }} />
          <div className="top-search-wrap" ref={searchWrapRef}>
            <div className="top-search"><span aria-hidden="true">⌕</span><input value={query} onFocus={() => setSearchOpen(true)} onKeyDown={handleSearchKeyDown} onChange={(event) => { setQuery(event.target.value); setActiveSuggestion(-1); setSearchOpen(true); }} placeholder="Search dishes, kitchens, and more" aria-label="Search all of HomeFoods" aria-expanded={searchOpen} aria-controls="homefoods-search-suggestions" role="combobox" aria-autocomplete="list"/>{query && <button className="search-clear" type="button" aria-label="Clear search" onClick={() => { setQuery(""); setActiveSuggestion(-1); setSearchOpen(true); }}>×</button>}</div>
            {searchOpen && <div className="search-results top-search-results" id="homefoods-search-suggestions" role="listbox" aria-label="Search suggestions">{query.trim().length < 2 ? <><strong>Popular searches</strong><div className="popular-searches">{["Beef Bhuna", "Chicken Curry", "Biryani", "Khichuri"].map((term) => <button type="button" key={term} onClick={() => { setQuery(term); setSearchOpen(true); document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" }); }}>{term}</button>)}</div><strong>Popular categories</strong><div className="popular-searches">{categories.slice(1).map((item) => <button type="button" key={item} onClick={() => { chooseCategory(item); setSearchOpen(false); document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" }); }}>{item}</button>)}</div></> : <>{searchSuggestions.map((dish, index) => <button type="button" role="option" aria-selected={activeSuggestion === index} key={`dish-${dish.id}`} onMouseEnter={() => setActiveSuggestion(index)} onClick={() => router.push(`/kitchens/${dish.shopId}?item=${dish.id}`)}><span><HighlightedMatch text={dish.name} query={query}/></span><small>{dish.shop} · {money(dish.price)}</small></button>)}{kitchenMatches.map((shop, index) => <button type="button" className="search-kitchen-option" role="option" aria-selected={activeSuggestion === searchSuggestions.length + index} key={`shop-${shop.id}`} onMouseEnter={() => setActiveSuggestion(searchSuggestions.length + index)} onClick={() => router.push(`/kitchens/${shop.id}`)}><span className="search-kitchen-thumb"><MarketImage src={shop.coverImageUrl ?? shop.logoUrl} alt="" fallbackSrc="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=120&q=75"/></span><span className="search-kitchen-copy"><span><HighlightedMatch text={shop.name} query={query}/></span><small>{shop.cuisine || "Home kitchen"} · {shop.city || "Finland"}{shop.deliveryFee == null ? "" : ` · ${shop.deliveryFee === 0 ? "Free delivery" : money(shop.deliveryFee) + " delivery"}`}</small></span></button>)}{siteSearchMatches.map((item) => <a key={item.href} href={item.href} onClick={() => { setQuery(""); setSearchOpen(false); }}><span><HighlightedMatch text={item.title} query={query}/></span><small>{item.description}</small></a>)}{!searchSuggestions.length && !kitchenMatches.length && !siteSearchMatches.length && <p>{catalogLoading ? "Finding something lovely…" : "No matching dishes or kitchens. Try “biryani”, “chicken”, or a cook’s name."}</p>}</>}</div>}
          </div>
          <div className="header-actions">{!user ? <><button className="text-button account-link" onClick={() => router.push("/signin")}>Sign in</button><button className="join-button" onClick={() => router.push("/join")}>Join</button></> : <button className="header-profile-button" onClick={() => router.push("/workspace#profile")} aria-label={`Open ${user.name || "your"} profile`} title="Your account">{user.name?.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "HF"}</button>}<button ref={cartTriggerRef} className="cart-button" onClick={() => setCartOpen(open=>!open)} aria-label={`Open cart${itemCount ? `, ${itemCount} items` : ""}`}><svg className="cart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 3.5h2.2l2.1 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4l2-7.2H6"/><circle cx="9.3" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg>{itemCount > 0 && <span className="cart-count">{itemCount}</span>}</button></div>
        </header>
        <OverlayLayer open={mobileMenuOpen} className="sidebar-layer" dialogClassName="market-sidebar menu-open" dialogRef={sidebarRef} triggerRef={menuTriggerRef} onClose={() => setMobileMenuOpen(false)} swipeToClose="left" label="HomeFoods navigation" initialFocusSelector=".sidebar-close-button" dismissOnBackdrop>
          <div className="sidebar-close-row"><button type="button" className="sidebar-close-button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation">Close <span aria-hidden="true">×</span></button></div>
          {user ? <><a className="sidebar-profile" href="/workspace#profile" onClick={() => setMobileMenuOpen(false)} aria-label="Open profile and settings"><span className="profile-avatar">{user.name?.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "HF"}</span><span className="profile-copy"><b>{user.name || "HomeFoods member"}</b><small>{user.email}</small><small className="profile-role">{{ CUSTOMER: "Customer", SELLER: "Seller / Kitchen Owner", RIDER: "Delivery Rider", ADMIN: "Administrator" }[user.role]}</small><span className="profile-manage">Manage account →</span></span></a><div className="sidebar-rule"/></> : null}
          <div className="sidebar-label">DISCOVER</div><a className="sidebar-link active" href="#top" onClick={() => setMobileMenuOpen(false)}><span>⌂</span>Home</a><a className="sidebar-link" href="#home-sections" onClick={() => setMobileMenuOpen(false)}><span>⌕</span>Explore kitchens</a>
          {user && <><div className="sidebar-label sidebar-section-label">YOUR HOMEFOODS</div><a className="sidebar-link" href="/orders" onClick={() => setMobileMenuOpen(false)}><span>▤</span>Orders</a>{user.role === "CUSTOMER" && <a className="sidebar-link" href="/favorites" onClick={() => setMobileMenuOpen(false)}><span>♡</span>Favorites</a>}</>}
          {user?.role === "SELLER" && <a className="sidebar-link dashboard-link" href="/workspace#seller-dashboard" onClick={() => setMobileMenuOpen(false)}><span>▦</span>Your Kitchen</a>}
          {user?.role === "RIDER" && <a className="sidebar-link dashboard-link" href="/workspace#rider-dashboard" onClick={() => setMobileMenuOpen(false)}><span>➜</span>Deliver</a>}
          {user?.role === "ADMIN" && <a className="sidebar-link dashboard-link" href="/workspace#admin-dashboard" onClick={() => setMobileMenuOpen(false)}><span>⚙</span>Workspace</a>}
          {!user && <><div className="sidebar-rule"/><div className="sidebar-label">JOIN HOMEFOODS</div><button className="sidebar-link" onClick={() => { setMobileMenuOpen(false); router.push("/join?role=SELLER"); }}><span>＋</span>Become a cook</button><button className="sidebar-link" onClick={() => { setMobileMenuOpen(false); router.push("/join?role=RIDER"); }}><span>➜</span>Deliver with us</button></>}
          {user && <button className="sidebar-link sidebar-logout" onClick={() => { setMobileMenuOpen(false); void signOut(); }}><span>↪</span>Sign out</button>}
          <div className="sidebar-bottom"><span className="sidebar-promise">✳ Made with care,<br/>right around the corner.</span><ThemeToggle/><a href="#faq">Help & FAQs</a></div>
        </OverlayLayer>
        <div className="market-main">
        <div className="category-strip" aria-label="Browse by cuisine or dish"><div className="category-strip-inner" role="group" aria-label="Food categories">{categories.map((item, index) => <button key={item} type="button" className={`category-chip ${category === item ? "selected" : ""}`} aria-pressed={category === item} tabIndex={category === item ? 0 : -1} onClick={() => chooseCategory(item)} onKeyDown={(event) => {
          const buttons = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(".category-chip") ?? []);
          const current = buttons.indexOf(event.currentTarget);
          const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowRight" ? (current + 1) % buttons.length : event.key === "ArrowLeft" ? (current - 1 + buttons.length) % buttons.length : -1;
          if (nextIndex >= 0) { event.preventDefault(); chooseCategory(categories[nextIndex]); buttons[nextIndex]?.focus(); }
        }}><span className={`category-icon-wrap category-icon-${index}`}><CategoryIcon index={index}/></span><span className="category-label"><strong>{item === "All" ? "For you" : item}</strong></span></button>)}</div></div>
        <div className="market-content">
        <div className="market-filter-row" aria-label="Menu filters"><button type="button" className={`market-filter ${quickOnly ? "active" : ""}`} aria-pressed={quickOnly} onClick={() => setQuickOnly((active) => !active)}>◷ <span>Under 30 min</span></button><button type="button" className={`market-filter ${topRatedOnly ? "active" : ""}`} aria-pressed={topRatedOnly} onClick={() => setTopRatedOnly((active) => !active)}>★ <span>Top rated</span></button><button type="button" className={`market-filter ${freeDeliveryOnly ? "active" : ""}`} aria-pressed={freeDeliveryOnly} onClick={() => setFreeDeliveryOnly((active) => !active)}>♧ <span>Free delivery</span></button>{selectedLocation.latitude != null && locationStatus?.radiusEnforced !== false && <button type="button" className={`market-filter ${showUnavailableKitchens ? "active" : ""}`} aria-pressed={showUnavailableKitchens} onClick={() => setShowUnavailableKitchens((shown) => !shown)}>{showUnavailableKitchens ? "Hide unavailable kitchens" : "Show kitchens outside 20 km"}</button>}{(quickOnly || topRatedOnly || freeDeliveryOnly || category !== "All" || sortTouched) && <button type="button" className="market-filter-clear" onClick={() => { setQuickOnly(false); setTopRatedOnly(false); setFreeDeliveryOnly(false); chooseCategory("All"); setSortBy("recommended"); setSortTouched(false); }}>Clear filters & sort</button>}<label className="market-sort">Sort by<select value={sortBy} aria-label="Sort results" onChange={(event) => { setSortBy(event.target.value); setSortTouched(true); }}><option value="recommended">Recommended</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="rating">Highest Rated</option><option value="fastest">Fastest Delivery</option><option value="nearest" disabled={selectedLocation.latitude == null || selectedLocation.longitude == null}>Nearest{selectedLocation.latitude == null ? " (set address)" : ""}</option></select></label></div>
        {locationStatus && !locationStatus.available && <p className="location-coverage-status" role="status">HomeFoods can’t confirm kitchen coverage for this location yet. Menu estimates are hidden until a kitchen serves it.</p>}
        {unavailableCartShops.length > 0 && <p className="location-coverage-status" role="status">Your basket is saved, but {unavailableCartShops.join(", ")} may not deliver to this address. Change location or remove those dishes before checkout.</p>}
        <section className="market-intro" id="top"><div className="market-intro-copy"><span className="eyebrow"><span className="eyebrow-line"/> LOCAL COOKS, LOVELY FOOD</span><h1>Homemade Happiness,<br/><em>Delivered to Your Door.</em></h1><p>Discover delicious meals, lovingly made by home cooks in your neighbourhood.</p><a className="intro-link" href="#home-sections">Explore today’s menu <span>↓</span></a></div><div className="promo-banner"><div className="promo-copy"><span className="promo-kicker">A LITTLE TASTE OF HOME</span><h2>Craving Homemade Food?</h2><p>There’s something good simmering nearby.</p><OriginButton type="button" variant="promotional" onClick={() => document.getElementById("home-sections")?.scrollIntoView({ behavior: "smooth" })}>Order Now <span>→</span></OriginButton></div><div className="promo-food-photo" aria-hidden="true"><span>FRESH<br/>TODAY</span></div></div></section>

        <HomeSections sections={discoverySections} loading={catalogLoading} error={catalogError} cart={cart} favorites={favorites} favoriteShops={favoriteShops} onAdd={add} onQuantity={changeQuantity} onFavoriteDish={(dish) => void toggleFavorite(dish)} onFavoriteShop={(shop) => void toggleKitchenFavorite(shop)} onRetry={() => void loadCatalog()}/>

      <section className="chef-banner" id="chefs"><div className="chef-photo" /><div className="chef-content"><div className="eyebrow"><span className="eyebrow-line" /> THE PEOPLE BEHIND THE PLATES</div><h2>Real kitchens.<br /><em>Really good</em> food.</h2><p>Every dish has a person, a story, and a kitchen that smells wonderful. Join the cooks and riders bringing good food closer to home.</p><div className="chef-links"><button className="dark-cta" onClick={() => router.push("/join?role=SELLER")}>Become a home chef <span>↗</span></button><button className="dark-cta secondary-cta" onClick={() => router.push("/join?role=RIDER")}>Deliver with us <span>↗</span></button></div><span className="chef-scribble">♡</span></div></section>

      <section className="how-section" id="how"><div className="eyebrow"><span className="eyebrow-line" /> EASY AS PIE</div><h2>Good things, <em>made simple.</em></h2><div className="how-grid"><div><span className="how-number">01</span><h3>Find your kind of lovely</h3><p>Browse home cooks and the dishes they’re making fresh today.</p></div><div><span className="how-number">02</span><h3>Choose what feels good</h3><p>Add a little something to your cart. Every cook is just around the corner.</p></div><div><span className="how-number">03</span><h3>Set the table</h3><p>Pay online or choose cash on delivery, then follow your order to the door.</p></div></div></section>

      <section className="faq-section" id="faq"><div className="eyebrow"><span className="eyebrow-line" /> THE LITTLE DETAILS</div><h2>A few good <em>questions.</em></h2><div className="faq-list"><details><summary>Where does the food come from?</summary><p>Every dish is listed by an independent home cook. Menus appear after a kitchen has been reviewed and approved.</p></details><details><summary>How do I pay?</summary><p>Choose cash on delivery or card at checkout. Online card payments use Stripe when the marketplace owner has configured it.</p></details><details><summary>Can I follow my order?</summary><p>Sign in and open My account to see order status updates from the kitchen and delivery rider.</p></details><details><summary>How do I become a home cook or rider?</summary><p>Create an account and choose Home cook / seller or Delivery rider. A marketplace admin reviews kitchen applications.</p></details></div></section>

      <section className="newsletter-section" id="newsletter"><div><div className="eyebrow"><span className="eyebrow-line" /> A NOTE FROM THE NEIGHBOURHOOD</div><h2>A little goodness,<br /><em>now and then.</em></h2><p>Get new kitchens, seasonal favourites, and small stories from local cooks.</p></div><form className="newsletter-form" onSubmit={(event) => void subscribeNewsletter(event)}><label htmlFor="newsletter-email">Your email address</label><div><input id="newsletter-email" type="email" required value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} placeholder="you@example.com"/><button type="submit">Join the list <span>→</span></button></div><label className="newsletter-consent"><input type="checkbox" required/> I agree to let HomeFoods store my email for newsletter updates.</label><p className="newsletter-status" role="status">{newsletterStatus || "Signup is open. Newsletter emails will begin once updates are ready."}</p></form></section>

      <footer className="site-footer" id="contact"><Brand href="#top" compact/><p>Homemade happiness, delivered. <span>✳</span></p><div className="footer-links"><a href="#faq">Help & FAQs</a><a href="#newsletter">Newsletter</a><a href="/workspace">Your account</a></div><span className="footer-small">© 2026 HomeFoods · Made for good eating</span></footer>
        </div>
      </div>
      </div>


      {favoriteError && <div className="favorite-toast" role="alert">{favoriteError}<button type="button" onClick={() => setFavoriteError("")} aria-label="Dismiss message">×</button></div>}
      <OverlayLayer open={cartOpen} className="drawer-backdrop" dialogClassName="cart-drawer" dialogRef={drawerRef} triggerRef={cartTriggerRef} onClose={() => setCartOpen(false)} label="Your basket" swipeToClose="right" dismissOnBackdrop><div className="drawer-head"><div><span className="eyebrow">YOUR LITTLE HAUL</span><h2>Your basket <span>({itemCount})</span></h2></div><button className="close-button" onClick={() => setCartOpen(false)} aria-label="Close basket">×</button></div>{cart.length ? <><div className="basket-body"><div className="cart-note">From {new Set(cart.map((line) => line.dish.shopId)).size} home {new Set(cart.map((line) => line.dish.shopId)).size === 1 ? "cook" : "cooks"} · each kitchen gets its own order</div><div className="cart-lines">{cart.map(({ dish, quantity }) => <div className="cart-line" key={dish.id}><FoodImage dish={dish} className="cart-thumb"/><div className="cart-line-main"><strong>{dish.name}</strong><span>{dish.shop}</span><div className="quantity-control"><button onClick={() => changeQuantity(dish.id, -1)} aria-label={`Remove one ${dish.name}`}>−</button><span>{quantity}</span><button onClick={() => changeQuantity(dish.id, 1)} aria-label={`Add ${dish.name}`}>+</button></div></div><div className="cart-line-price"><b>{money(dish.price * quantity)}</b><button type="button" onClick={() => setCart((current) => current.filter((line) => line.dish.id !== dish.id))} aria-label={`Remove ${dish.name} from basket`}>Remove</button></div></div>)}</div><label className="cart-instructions">Kitchen instructions<textarea maxLength={500} value={cartNotes} onChange={(event) => setCartNotes(event.target.value)} placeholder="Allergies or delivery notes for the kitchen (optional)"/></label><form className="cart-promo" onSubmit={(event) => { event.preventDefault(); setPromoMessage("Promo codes are not active yet. No discount was applied."); }}><label htmlFor="basket-promo">Promo code</label><div><input id="basket-promo" value={promoCode} onChange={(event) => setPromoCode(event.target.value)} placeholder="Enter a code"/><button type="submit">Apply</button></div>{promoMessage && <small role="status">{promoMessage}</small>}</form><div className="cart-totals"><div><span>Food subtotal</span><b>{money(subtotal)}</b></div><div><span>Delivery</span><b>{money(deliveryTotal)}</b></div><div><span>Service fee</span><b>{money(serviceFee)}</b></div><div className="total-line"><span>Total</span><b>{money(cartTotal)}</b></div></div></div><footer className="basket-footer"><div><span>Total</span><strong>{money(cartTotal)}</strong></div><button className="checkout-button" onClick={openCheckout}>{user ? "Continue to checkout" : "Sign in to checkout"} <span>→</span></button></footer></> : <div className="empty-cart"><span>♡</span><h3>A little room for something lovely</h3><p>Your basket is empty. Let’s find something delicious.</p><button onClick={() => setCartOpen(false)}>Explore the menu</button></div>}</OverlayLayer>      <OverlayLayer open={checkout} className="modal-backdrop checkout-overlay" dialogClassName="checkout-modal" dialogRef={checkoutDialogRef} triggerRef={checkoutTriggerRef} onClose={() => setCheckout(false)} label="Checkout" initialFocusSelector=".modal-close">
        <header className="checkout-head"><div><span className="eyebrow">A GOOD MEAL, ALMOST HOME</span><h2>Checkout</h2><p>{itemCount} items · {new Set(cart.map(line=>line.dish.shopId)).size} home kitchens</p></div><button className="close-button modal-close" onClick={() => setCheckout(false)} aria-label="Close checkout">×</button></header>
        <form onSubmit={placeOrder} className="checkout-form" id="homefoods-checkout">
          <div className="checkout-body"><div className="checkout-details">
            <section className="checkout-section"><h3><span>01</span> Delivery address</h3>
              {selectedAddressId ? <div className="checkout-address-card"><span className="address-symbol" aria-hidden="true">⌖</span><div><strong>{addressLine1}</strong>{selectedLocation.address?.addressLine2 && <p>{selectedLocation.address.addressLine2}</p>}<p>{postalCode} {city} · Finland</p><small>{selectedLocation.address?.status === "sandbox" ? "Sandbox address · fictional delivery" : selectedLocation.address?.status === "verified" ? "Verified Finnish address" : "We'll verify this saved address before ordering."}</small></div></div> : <p>Choose where you would like your food delivered.</p>}
              <LocationSelector triggerLabel={selectedAddressId ? "Change delivery address" : "Choose a Finnish delivery address"} onSelect={(location,address)=>{setSelectedLocation(location);if(address){setAddressLine1(address.addressLine1);setCity(address.city);setPostalCode(address.postalCode??"");setSelectedAddressId(address.id??null);setDeliveryCheckStatus("idle");setOrderError("");}}}/>
            </section>
            <section className="checkout-section"><h3><span>02</span> Payment</h3><fieldset className="payment-choices"><legend className="sr-only">Payment method</legend>{[{value:"CASH",title:"Cash on delivery",note:"Pay when your food arrives",icon:"€"},{value:"CARD",title:"Card via Stripe",note:"Continue to secure payment",icon:"▤"}].map(method=><label key={method.value} className={paymentMethod===method.value?"selected":""}><input type="radio" name="paymentMethod" value={method.value} checked={paymentMethod===method.value} onChange={()=>setPaymentMethod(method.value)}/><span className="payment-icon" aria-hidden="true">{method.icon}</span><span><b>{method.title}</b><small>{method.note}</small></span><span className="payment-check" aria-hidden="true">{paymentMethod===method.value?"✓":""}</span></label>)}</fieldset></section>
            {cartNotes && <section className="checkout-section"><h3>Kitchen instructions</h3><p>{cartNotes}</p></section>}
          </div><section className="checkout-order-summary"><h3>Your order <span>{itemCount} items</span></h3>{[...new Set(cart.map(line=>line.dish.shopId))].map(shopId=><div className="checkout-kitchen-group" key={shopId}><h4>{cart.find(line=>line.dish.shopId===shopId)?.dish.shop}</h4>{cart.filter(line=>line.dish.shopId===shopId).map(({dish,quantity})=><div className="checkout-food" key={dish.id}><FoodImage dish={dish} className="checkout-food-photo"/><div><b>{dish.name}</b><small>Quantity {quantity}</small></div><strong>{money(dish.price*quantity)}</strong></div>)}</div>)}<div className="checkout-summary-breakdown"><div><span>Food subtotal</span><b>{money(subtotal)}</b></div><div><span>Delivery fees</span><b>{money(deliveryTotal)}</b></div><div><span>Service fee</span><b>{money(serviceFee)}</b></div><div className="checkout-summary-total"><span>Total</span><b>{money(cartTotal)}</b></div></div></section></div>
          <footer className="checkout-footer">{orderError&&<p className="form-error" role="alert">{orderError}</p>}{deliveryCheckStatus==="checking"&&<p role="status">Checking your address and kitchen availability…</p>}<div className="checkout-footer-row"><div><span>Final total</span><strong>{money(cartTotal)}</strong><small>{locationStatus?.nationwideDevelopmentMode?"Sandbox order · no real delivery":"Your basket stays saved until your order is confirmed."}</small></div><OriginButton className="checkout-button" type="submit" loading={placingOrder||deliveryCheckStatus==="checking"} loadingText={deliveryCheckStatus==="checking"?"Checking delivery…":"Placing your order…"} disabled={!selectedAddressId||placingOrder||deliveryCheckStatus==="checking"}>{paymentMethod==="CARD"?"Continue to secure payment":"Place order"}<span>→</span></OriginButton></div></footer>
        </form>
      </OverlayLayer>

      {complete && <div className="modal-backdrop" onClick={() => setComplete(false)}><section className="success-modal" onClick={(event) => event.stopPropagation()}><button className="close-button modal-close" onClick={() => setComplete(false)} aria-label="Close confirmation">×</button><span className="success-mark">✓</span><div className="eyebrow">ORDER RECEIVED</div><h2>That’s the <em>spirit.</em></h2><p>Your order{orderNumbers.length > 1 ? "s are" : " is"} with {orderNumbers.map((number) => <strong key={number}> {number}</strong>)}. {orderNumbers.length > 1 ? "Each home kitchen will confirm its own part." : "Your home cook will confirm it shortly."}</p><a className="checkout-button success-link" href="/orders">Track your order <span>→</span></a><button className="success-dismiss" onClick={() => setComplete(false)}>Keep browsing</button></section></div>}


    </main>
  );
}
