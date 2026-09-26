import { db } from "@/src/prisma/db";
import { getKitchenDeliveryDistances, isWithinDeliveryRadius, MAX_DELIVERY_DISTANCE_METERS } from "@/src/lib/location";
import { isDeliveryRadiusEnforced, isNationwideDevelopmentMode, isNationwideDevelopmentSeller, isKitchenLocationAllowed } from "@/src/lib/feature-flags";
import { normalizeCatalogSearchText } from "@/src/lib/catalog-filter";

export const runtime = "nodejs";

const average = (ratings: Array<{ rating: number }>) => ratings.length ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length : null;
const cuisineOf = (description: string | null, city: string | null) => description?.match(/inspired by ([\w -]+?) home cooking/i)?.[1] ?? city ?? "Home cooking";
const dishTerms = (dish: { name: string; category: string; cuisine: string }) => `${dish.name} ${dish.category} ${dish.cuisine}`.toLowerCase();
const sweets = /dessert|sweet|cake|pie|tart|pudding|baklava|jamun|kunafa|mochi|churro|ice cream|halwa|cheesecake|tiramisu|mämmi|korvapuusti|pastry|brownie|cookie|donut/i;
const plantBased = /vegetarian|vegan|plant-based|salad|tofu|lentil|chickpea/i;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const latParam = url.searchParams.get("lat");
    const lngParam = url.searchParams.get("lng");
    const hasLocation = latParam !== null && lngParam !== null && Number.isFinite(Number(latParam)) && Number.isFinite(Number(lngParam));
    const customerLocation = hasLocation ? { latitude: Number(latParam), longitude: Number(lngParam) } : null;
    const shopRows = await db.orm.public.Shop
      .where({ status: "ACTIVE", isOnline: true })
      .include("menuItems", (items) => items.where({ isAvailable: true }).include("category", (category) => category.select("name")).orderBy((item) => item.sortOrder.asc()))
      .include("reviews", (reviews) => reviews.select("rating"))
      .include("seller", (seller) => seller.select("name", "email"))
      .orderBy((shop) => shop.name.asc())
      .all();
    const allShops = shopRows.filter((shop) => isKitchenLocationAllowed(shop.address) && (!isNationwideDevelopmentMode() || isNationwideDevelopmentSeller(shop.seller)));
    const deliveryChecks = new Map<number, { eligible: boolean; distanceKm: number | null; unavailableReason?: string }>();
    let routeCheckFailed = false;
    if (customerLocation && isDeliveryRadiusEnforced()) {
      allShops.filter((shop) => shop.latitude == null || shop.longitude == null).forEach((shop) => deliveryChecks.set(shop.id, { eligible: false, distanceKm: null, unavailableReason: "Kitchen location missing" }));
      const locatedShops = allShops.filter((shop) => shop.latitude != null && shop.longitude != null);
      try {
        const distances = await getKitchenDeliveryDistances(customerLocation, locatedShops.map((shop) => ({ latitude: shop.latitude!, longitude: shop.longitude! })));
        locatedShops.forEach((shop, index) => {
          const meters = distances[index];
          deliveryChecks.set(shop.id, meters == null
            ? { eligible: false, distanceKm: null, unavailableReason: "Delivery distance could not be checked" }
            : { eligible: isWithinDeliveryRadius(meters), distanceKm: meters / 1000, unavailableReason: isWithinDeliveryRadius(meters) ? undefined : "Too far for delivery" });
        });
        routeCheckFailed = distances.some((distance) => distance === null) && locatedShops.length > 0;
      } catch { routeCheckFailed = true; locatedShops.forEach((shop) => deliveryChecks.set(shop.id, { eligible: false, distanceKm: null, unavailableReason: "Delivery distance could not be checked" })); }
    }
    const includeUnavailable = url.searchParams.get("includeUnavailable") === "1";
    if (customerLocation && isNationwideDevelopmentMode()) {
      allShops.forEach((shop) => deliveryChecks.set(shop.id, { eligible: true, distanceKm: null }));
    }
    const eligibleShops = customerLocation && isDeliveryRadiusEnforced() ? allShops.filter((shop) => deliveryChecks.get(shop.id)?.eligible) : allShops;
    const shops = customerLocation && includeUnavailable ? allShops : eligibleShops;
    const eligibleCount = [...deliveryChecks.values()].filter((check) => check.eligible).length;
    const locationStatus = customerLocation ? { checked: !routeCheckFailed, available: eligibleCount > 0, kitchenCount: eligibleCount, routeCheckFailed, maximumDeliveryDistanceKm: MAX_DELIVERY_DISTANCE_METERS / 1000, radiusEnforced: isDeliveryRadiusEnforced(), nationwideDevelopmentMode: isNationwideDevelopmentMode() } : null;

    const allDishes = eligibleShops.flatMap((shop) => {
      const rating = average(shop.reviews ?? []);
      const cuisine = cuisineOf(shop.description, shop.city);
      return (shop.menuItems ?? []).map((item) => ({
        id: item.id, shopId: shop.id, name: item.name, shop: shop.name, cuisine,
        category: item.category?.name ?? "Other", price: item.price, rating,
        time: shop.estimatedMinutes == null ? "Estimate unavailable" : `${shop.estimatedMinutes} min`, estimatedMinutes: shop.estimatedMinutes,
        deliveryDistanceKm: deliveryChecks.get(shop.id)?.distanceKm ?? null, image: item.imageUrl,
        description: item.description ?? "Made fresh by a local home cook.",
        deliveryFee: shop.deliveryFee ?? 2.5, isFeatured: item.isFeatured,
      }));
    });

    const query = normalizeCatalogSearchText(url.searchParams.get("q")?.trim() ?? "");
    if (query.length >= 2) {
      const results = allDishes.filter((dish) => normalizeCatalogSearchText(`${dish.name} ${dish.shop} ${dish.cuisine} ${dish.category} ${dish.description}`).includes(query)).slice(0, 40);
      const kitchens = shops
        .filter((shop) => normalizeCatalogSearchText(`${shop.name} ${shop.description ?? ""} ${shop.city ?? ""} ${cuisineOf(shop.description, shop.city)}`).includes(query))
        .slice(0, 12)
        .map((shop) => ({
          id: shop.id, name: shop.name, description: shop.description, logoUrl: shop.logoUrl,
          coverImageUrl: shop.coverImageUrl, city: shop.city, status: shop.status,
          cuisine: cuisineOf(shop.description, shop.city), deliveryFee: shop.deliveryFee,
          estimatedMinutes: shop.estimatedMinutes, minimumOrder: shop.minimumOrder,
          distanceKm: deliveryChecks.get(shop.id)?.distanceKm ?? null,
          deliveryDistanceKm: deliveryChecks.get(shop.id)?.distanceKm ?? null,
          deliverable: customerLocation ? deliveryChecks.get(shop.id)?.eligible ?? false : null,
          deliveryStatus: customerLocation ? deliveryChecks.get(shop.id)?.unavailableReason ?? "Available for delivery" : null,
        }));
      return Response.json({ results, kitchens, locationStatus });
    }

    const [orderItems, favorites] = await Promise.all([
      db.orm.public.OrderItem.orderBy((item) => item.createdAt.desc()).limit(1000).include("order", (order) => order.select("status")).include("menuItem", (item) => item.select("id", "shopId")).all(),
      db.orm.public.Favorite.all(),
    ]);
    const orderCounts = new Map<number, number>();
    const kitchenOrders = new Map<number, number>();
    for (const row of orderItems) {
      if (["CANCELLED", "REFUNDED"].includes(row.order?.status ?? "")) continue;
      orderCounts.set(row.menuItemId, (orderCounts.get(row.menuItemId) ?? 0) + row.quantity);
      kitchenOrders.set(row.menuItem?.shopId ?? 0, (kitchenOrders.get(row.menuItem?.shopId ?? 0) ?? 0) + row.quantity);
    }
    const favoriteCounts = new Map<number, number>();
    const kitchenFavorites = new Map<number, number>();
    for (const favorite of favorites) {
      favoriteCounts.set(favorite.menuItemId, (favoriteCounts.get(favorite.menuItemId) ?? 0) + 1);
      kitchenFavorites.set(favorite.shopId, (kitchenFavorites.get(favorite.shopId) ?? 0) + 1);
    }
    const dishes = allDishes.map((dish) => ({ ...dish, orderCount: orderCounts.get(dish.id) ?? 0, favoriteCount: favoriteCounts.get(dish.id) ?? 0 }));
    const kitchens = shops.map((shop) => ({
      id: shop.id, name: shop.name, description: shop.description, logoUrl: shop.logoUrl,
      coverImageUrl: shop.coverImageUrl, city: shop.city, status: shop.status,
      cuisine: cuisineOf(shop.description, shop.city), deliveryFee: shop.deliveryFee,
      estimatedMinutes: shop.estimatedMinutes, minimumOrder: shop.minimumOrder,
      createdAt: shop.createdAt, rating: average(shop.reviews ?? []),
      reviewCount: shop.reviews?.length ?? 0, orderCount: kitchenOrders.get(shop.id) ?? 0,
      favoriteCount: kitchenFavorites.get(shop.id) ?? 0,
      latitude: shop.latitude, longitude: shop.longitude,
      distanceKm: deliveryChecks.get(shop.id)?.distanceKm ?? null,
      deliverable: customerLocation ? deliveryChecks.get(shop.id)?.eligible ?? false : null,
      deliveryStatus: customerLocation ? deliveryChecks.get(shop.id)?.unavailableReason ?? "Available for delivery" : null,
      deliveryDistanceKm: deliveryChecks.get(shop.id)?.distanceKm ?? null,
      pickupAvailable: false,
    }));

    // One pass per seller keeps every food carousel varied. Once a dish is featured,
    // the next sections prioritize unseen items instead of repeating it.
    const used = new Set<number>();
    const curated = (source: typeof dishes, limit = 14, uniqueAcrossSections = true) => {
      const candidates = [...source].sort((a, b) => b.orderCount - a.orderCount || b.favoriteCount - a.favoriteCount || Number(b.isFeatured) - Number(a.isFeatured) || (b.rating ?? 0) - (a.rating ?? 0));
      const chosen: typeof dishes = [];
      const chosenShops = new Set<number>();
      for (const item of candidates) {
        if (chosen.length >= limit) break;
        if ((uniqueAcrossSections && used.has(item.id)) || chosenShops.has(item.shopId)) continue;
        chosen.push(item); chosenShops.add(item.shopId);
      }
      for (const item of candidates) {
        if (chosen.length >= limit) break;
        if ((uniqueAcrossSections && used.has(item.id)) || chosen.some((row) => row.id === item.id)) continue;
        chosen.push(item);
      }
      // Keep narrow collections useful after higher-priority shelves have claimed
      // the most popular dishes. Reuse a dish across shelves only as a last resort.
      for (const item of candidates) {
        if (chosen.length >= limit) break;
        if (!chosen.some((row) => row.id === item.id)) chosen.push(item);
      }
      if (uniqueAcrossSections) chosen.forEach((item) => used.add(item.id));
      return chosen;
    };
    const kitchenDiverse = (source: typeof kitchens, limit = 12) => {
      const chosen: typeof kitchens = [];
      const cuisines = new Set<string>();
      for (const kitchen of source) {
        if (chosen.length >= limit) break;
        if (!cuisines.has(kitchen.cuisine.toLowerCase())) { chosen.push(kitchen); cuisines.add(kitchen.cuisine.toLowerCase()); }
      }
      for (const kitchen of source) if (chosen.length < limit && !chosen.some((row) => row.id === kitchen.id)) chosen.push(kitchen);
      return chosen;
    };
    const popularity = [...dishes].sort((a, b) => b.orderCount - a.orderCount || (b.rating ?? 0) - (a.rating ?? 0));
    const topRated = [...dishes].filter((dish) => (dish.rating ?? 0) >= 4.5 || dish.isFeatured).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || Number(b.isFeatured) - Number(a.isFeatured));
    const favourites = [...dishes].filter((dish) => dish.favoriteCount > 0).sort((a, b) => b.favoriteCount - a.favoriteCount);
    const quick = dishes.filter((dish) => Number.parseInt(dish.time, 10) <= 30);
    const international = dishes.filter((dish) => !/bangla|bengali|bangladeshi/i.test(dish.cuisine));
    const healthy = dishes.filter((dish) => plantBased.test(`${dish.category} ${dish.name}`));
    const desserts = dishes.filter((dish) => sweets.test(dishTerms(dish)));
    const avgRating = (kitchen: typeof kitchens[number]) => kitchen.rating ?? 0;
    const featuredKitchens = [...kitchens].sort((a, b) => avgRating(b) - avgRating(a) || b.favoriteCount - a.favoriteCount);
    const popularKitchens = [...kitchens].sort((a, b) => b.orderCount - a.orderCount || avgRating(b) - avgRating(a));
    const newKitchens = [...kitchens].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const internationalKitchens = [...kitchens].filter((kitchen) => !/bangla|bengali|bangladeshi/i.test(kitchen.cuisine));
    const sections = [
      { id: "top-picks", title: "Top Picks for You", kind: "food", href: "/collections/top-picks", description: "Featured dishes and highly rated favourites across local kitchens.", items: curated(topRated) },
      { id: "popular-right-now", title: "Popular Right Now", kind: "food", href: "/collections/popular-right-now", description: "Ranked by orders placed and favourites saved on HomeFoods.", items: curated(popularity) },
      { id: "homemade-favourites", title: "Homemade Favourites", kind: "food", href: "/collections/homemade-favourites", description: "Meals customers have added to their favourites.", items: curated(favourites.length ? favourites : dishes.filter((dish) => dish.isFeatured)) },
      { id: "delicious-deals", title: "Delicious Deals", kind: "food", href: "/collections/delicious-deals", description: "Verified discounts from participating kitchens.", items: [] as typeof dishes },
      { id: "quick-bites", title: "Quick Bites", kind: "food", href: "/collections/quick-bites", description: "Menus from kitchens with a 30-minute or quicker delivery estimate.", items: curated(quick) },
      { id: "international-flavours", title: "International Flavours", kind: "food", href: "/collections/international-flavours", description: "Explore a mix of cuisines made by cooks in your area.", items: curated(international) },
      { id: "healthy-choices", title: "Healthy Choices", kind: "food", href: "/collections/healthy-choices", description: "Vegetarian, plant-based, salad and lentil menu categories; nutrition data is not provided.", items: curated(healthy) },
      { id: "sweet-treats", title: "Sweet Treats & Desserts", kind: "food", href: "/collections/sweet-treats", description: "Desserts, bakes and sweet menu favourites.", items: curated(desserts) },
      { id: "featured-kitchens", title: "Featured Kitchens", kind: "kitchen", href: "/collections/featured-kitchens", description: "Home kitchens with standout ratings and customer saves.", items: kitchenDiverse(featuredKitchens) },
      { id: "popular-restaurants", title: "Popular Restaurants", kind: "kitchen", href: "/collections/popular-restaurants", description: "Sorted by the number of dishes ordered.", items: kitchenDiverse(popularKitchens) },
      { id: "new-on-homefoods", title: "New on HomeFoods", kind: "kitchen", href: "/collections/new-on-homefoods", description: "Recently joined kitchens with active menus.", items: kitchenDiverse(newKitchens) },
      { id: "international-kitchens", title: "Explore International Kitchens", kind: "kitchen", href: "/collections/international-kitchens", description: "Meet cooks sharing food from around the world.", items: kitchenDiverse(internationalKitchens) },
    ];
    const collectionId = new URL(request.url).searchParams.get("collection");
    if (collectionId) {
      const section = sections.find((row) => row.id === collectionId);
      if (!section) return Response.json({ error: "Collection not found." }, { status: 404 });
      const collectionItems: Record<string, typeof dishes | typeof kitchens> = {
        "top-picks": topRated, "popular-right-now": popularity,
        "homemade-favourites": favourites.length ? favourites : dishes.filter((dish) => dish.isFeatured),
        "delicious-deals": [], "quick-bites": quick, "international-flavours": international,
        "healthy-choices": healthy, "sweet-treats": desserts, "featured-kitchens": featuredKitchens,
        "popular-restaurants": popularKitchens, "new-on-homefoods": newKitchens,
        "international-kitchens": internationalKitchens,
      };
      const rows = (collectionItems[collectionId] ?? []) as Array<(typeof dishes)[number] | (typeof kitchens)[number]>;
      return Response.json({ collection: { id: section.id, title: section.title, kind: section.kind, description: section.description }, items: rows, locationStatus });
    }
    return Response.json({ sections, dishes, shops: kitchens, locationStatus });
  } catch (error) {
    console.error("Catalog request failed", error);
    return Response.json({ sections: [], dishes: [], shops: [], error: "The menu database is unavailable. Check the database connection." }, { status: 503 });
  }
}
