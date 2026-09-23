"use client";

import HomeCarousel from "@/src/components/home-carousel";
import MarketImage from "@/src/components/market-image";
import SpotlightCard from "@/src/components/ui/spotlight-card";
import { OriginButton } from "@/src/components/ui/origin-button";

type Dish = { id: number; shopId: number; name: string; shop: string; cuisine: string; category: string; price: number; rating: number | null; time: string; image: string | null; description: string; deliveryFee: number; orderCount?: number; favoriteCount?: number };
type Shop = { id: number; name: string; description?: string | null; logoUrl?: string | null; coverImageUrl?: string | null; city?: string | null; cuisine?: string; status?: string; deliveryFee?: number | null; estimatedMinutes?: number | null; rating?: number | null; reviewCount?: number; orderCount?: number; favoriteCount?: number; deliverable?: boolean | null; deliveryStatus?: string | null; deliveryDistanceKm?: number | null };
type Section = { id: string; title: string; description: string; kind: "food" | "kitchen"; href: string; items: Array<Dish | Shop> };
const money = (n: number) => new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(n);
const fallback = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85";

export default function HomeSections({ sections, loading, error, cart, favorites, favoriteShops, onAdd, onQuantity, onFavoriteDish, onFavoriteShop, onRetry }: {
  sections: Section[];
  loading: boolean;
  error: string;
  cart: Array<{ dish: Dish; quantity: number }>;
  favorites: number[];
  favoriteShops: number[];
  onAdd: (dish: Dish) => void;
  onQuantity: (id: number, delta: number) => void;
  onFavoriteDish: (dish: Dish) => void;
  onFavoriteShop: (shop: Shop) => void;
  onRetry: () => void;
}) {
  if (loading) return <div className="home-section-loading" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <div key={i} className="home-section-skeleton"/>)}<span>Setting the table…</span></div>;
  return <div className="home-sections" id="home-sections" aria-label="Explore HomeFoods">
    {sections.map((section) => {
      if (section.kind === "food") {
        const items = section.items as Dish[];
        const empty = section.id === "delicious-deals" ? "No active item discounts are available right now. Check back for offers from participating kitchens." : !items.length ? "No dishes are available in this collection yet." : undefined;
        return <HomeCarousel key={section.id} id={section.id} title={section.title} description={section.description} href={section.href} cardKind="food" empty={empty}>{items.map((dish) => {
          const quantity = cart.find((line) => line.dish.id === dish.id)?.quantity ?? 0;
          const saved = favorites.includes(dish.id);
          return <article className="carousel-food-card" key={dish.id}>
            <div className="carousel-food-photo"><a href={`/kitchens/${dish.shopId}?item=${dish.id}`} aria-label={`View ${dish.name} at ${dish.shop}`}><MarketImage className="food-image" src={dish.image} alt={`${dish.name}, ${dish.cuisine} cuisine`} fallbackSrc={fallback}/></a><button type="button" className={`save-button ${saved ? "is-saved" : ""}`} aria-pressed={saved} aria-label={`${saved ? "Remove" : "Save"} ${dish.name} ${saved ? "from" : "to"} favorites`} onClick={() => onFavoriteDish(dish)}>{saved ? "♥" : "♡"}</button></div>
            <div className="carousel-food-info"><div className="carousel-food-title"><a href={`/kitchens/${dish.shopId}?item=${dish.id}`}>{dish.name}</a><strong>{money(dish.price)}</strong></div><p>{dish.shop} <span>·</span> {dish.cuisine}</p><div className="carousel-food-meta"><span>{dish.rating ? `★ ${dish.rating.toFixed(1)}` : "New kitchen"}</span><span>·</span><span>{dish.time}</span><div className={`carousel-quantity ${quantity ? "has-quantity" : ""}`} key={`${dish.id}-${quantity}`}>
              {quantity > 0 && <button type="button" onClick={() => onQuantity(dish.id, -1)} aria-label={`Remove one ${dish.name}`}>−</button>}
              <OriginButton type="button" variant="promotional" className="carousel-add" onClick={() => onAdd(dish)} aria-label={quantity ? `Add another ${dish.name}; ${quantity} in basket` : `Add ${dish.name} to basket`}>{quantity > 0 ? `+${quantity}` : "+"}</OriginButton>
            </div></div></div>
          </article>;
        })}</HomeCarousel>;
      }
      const items = section.items as Shop[];
      return <HomeCarousel key={section.id} id={section.id} title={section.title} description={section.description} href={section.href} cardKind="kitchen" empty={!items.length ? "No kitchens in this collection yet." : undefined}>{items.map((shop, index) => {
        const saved = favoriteShops.includes(shop.id);
        const cover = shop.coverImageUrl || fallback;
        const card = <article className={`carousel-kitchen-card${shop.deliverable === false ? " kitchen-too-far" : ""}`} key={shop.id}><a className="carousel-kitchen-cover" href={`/kitchens/${shop.id}`}><MarketImage src={cover} alt={`${shop.name} kitchen cover`} fallbackSrc={fallback}/>{shop.logoUrl && <span className="carousel-kitchen-logo"><MarketImage src={shop.logoUrl} alt={`${shop.name} kitchen icon`} fallbackSrc={fallback}/></span>}<span className="kitchen-status"><i/> Home kitchen</span>{shop.deliverable === false && <span className="kitchen-distance-badge">{shop.deliveryStatus === "Too far for delivery" ? "Too far for delivery" : shop.deliveryStatus ?? "Delivery unavailable"}</span>}</a><button className={`save-button ${saved ? "is-saved" : ""}`} type="button" aria-pressed={saved} aria-label={`${saved ? "Remove" : "Save"} ${shop.name} ${saved ? "from" : "to"} favorites`} onClick={() => onFavoriteShop(shop)}>{saved ? "♥" : "♡"}</button><a href={`/kitchens/${shop.id}`} className="carousel-kitchen-info"><h3>{shop.name}</h3><p>{shop.cuisine || "Home kitchen"} · {shop.city || "Local"}</p><div className="carousel-kitchen-meta">{shop.rating != null && <span>★ {shop.rating.toFixed(1)}{shop.reviewCount ? ` (${shop.reviewCount})` : ""}</span>}{shop.estimatedMinutes != null && <span>◷ {shop.estimatedMinutes} min</span>}{shop.deliverable !== false && shop.deliveryDistanceKm != null && <span>◉ {shop.deliveryDistanceKm.toFixed(1)} km by road</span>}{shop.deliverable !== false && shop.deliveryFee != null && <span>{shop.deliveryFee === 0 ? "Free delivery" : `${money(shop.deliveryFee)} delivery`}</span>}</div></a></article>;
        return section.id === "featured-kitchens" && index === 0
          ? <SpotlightCard key={`spotlight-${shop.id}`} className="spotlight-featured-kitchen" glowColor="orange" size="small">{card}</SpotlightCard>
          : card;
      })}</HomeCarousel>;
    })}
    {error && <div className="carousel-error" role="alert">{error} <button type="button" onClick={onRetry}>Try again</button></div>}
  </div>;
}
