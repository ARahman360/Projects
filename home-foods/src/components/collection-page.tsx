"use client";

import { useEffect, useState } from "react";
import Brand from "@/src/components/brand";
import Link from "next/link";
import MarketImage from "@/src/components/market-image";

type Dish = { id: number; shopId: number; name: string; shop: string; cuisine: string; category: string; price: number; rating: number | null; time: string; image: string | null; deliveryFee: number };
type Shop = { id: number; name: string; cuisine: string; city: string | null; coverImageUrl: string | null; rating: number | null; reviewCount: number; estimatedMinutes: number | null; deliveryFee: number | null };
type Collection = { id: string; title: string; kind: "food" | "kitchen"; description: string };
const fallback = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85";
const money = (n: number) => new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(n);

export default function CollectionPage({ slug }: { slug: string }) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<Array<Dish | Shop>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/catalog?collection=${encodeURIComponent(slug)}`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "This collection is unavailable.");
      if (active) { setCollection(payload.collection); setItems(payload.items ?? []); }
    }).catch((issue) => { if (active) setError(issue instanceof Error ? issue.message : "Collection unavailable."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  return <main className="collection-page"><header className="collection-header"><Brand/><Link href="/">← HomeFoods</Link></header><div className="collection-body"><div className="eyebrow"><span className="eyebrow-line"/> HOMEFOODS COLLECTION</div><h1>{collection?.title ?? (loading ? "Loading collection…" : "Collection")}</h1><p>{collection?.description ?? error}</p>{loading ? <div className="collection-loading" aria-busy="true">Finding the good things…</div> : error ? <p role="alert">{error}</p> : !items.length ? <div className="carousel-empty">No active discounts are available right now.</div> : <div className="collection-grid">{items.map((raw) => collection?.kind === "food" ? (() => { const dish = raw as Dish; return <a className="collection-food-card" key={dish.id} href={`/kitchens/${dish.shopId}?item=${dish.id}`}><MarketImage src={dish.image} alt={`${dish.name}, ${dish.cuisine} cuisine`} fallbackSrc={fallback}/><div><h2>{dish.name}</h2><p>{dish.shop} · {dish.cuisine}</p><span>{dish.rating != null ? `★ ${dish.rating.toFixed(1)} · ` : ""}{dish.time}</span><strong>{money(dish.price)}</strong></div></a>; })() : (() => { const shop = raw as Shop; return <a className="collection-kitchen-card" key={shop.id} href={`/kitchens/${shop.id}`}><MarketImage src={shop.coverImageUrl} alt={`${shop.name} kitchen cover`} fallbackSrc={fallback}/><div><h2>{shop.name}</h2><p>{shop.cuisine} · {shop.city || "Local"}</p><span>{shop.rating != null ? `★ ${shop.rating.toFixed(1)} · ` : ""}{shop.estimatedMinutes ? `${shop.estimatedMinutes} min · ` : ""}{shop.deliveryFee === 0 ? "Free delivery" : shop.deliveryFee != null ? `${money(shop.deliveryFee)} delivery` : "See delivery details"}</span></div></a>; })())}</div>}</div></main>;
}
