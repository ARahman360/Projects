import { db } from "@/src/prisma/db";
import { getKitchenDeliveryDistance, ROUTING_UNAVAILABLE_MESSAGE } from "@/src/lib/location";
import { isDeliveryRadiusEnforced, isNationwideDevelopmentMode, isNationwideDevelopmentSeller, isKitchenLocationAllowed } from "@/src/lib/feature-flags";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: value } = await params;
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Kitchen not found." }, { status: 404 });
  try {
    const shop = await db.orm.public.Shop
      .where({ id, status: "ACTIVE" })
      .include("menuItems", (items) => items.include("category", (category) => category.select("id", "name")).orderBy((item) => item.name.asc()))
      .include("reviews", (reviews) => reviews.select("rating").orderBy((review) => review.createdAt.desc()).limit(100))
      .include("seller", (seller) => seller.select("name", "email"))
      .first();
    if (!shop || !isKitchenLocationAllowed(shop.address)) return Response.json({ error: "This kitchen is not available." }, { status: 404 });
    if (isNationwideDevelopmentMode() && !isNationwideDevelopmentSeller(shop.seller)) return Response.json({ error: "This kitchen is not part of the nationwide development test catalog." }, { status: 404 });
    const url = new URL(request.url);
    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lng"));
    let deliveryCheck: { status: "available" | "too_far" | "unknown" | "unconfigured"; distanceKm?: number; message?: string } | null = null;
    if (url.searchParams.has("lat") && url.searchParams.has("lng") && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      if (shop.latitude == null || shop.longitude == null) deliveryCheck = {status:"unknown",message:"This kitchen needs to save its Finnish location before accepting orders."};
      else if (isNationwideDevelopmentMode()) deliveryCheck = { status: "available", message: "Available for Finland-wide development testing. Long-distance delivery is not a real service commitment." };
      else if (!isDeliveryRadiusEnforced()) deliveryCheck = { status: "available" };
      else if (!process.env.GEOAPIFY_API_KEY) deliveryCheck = { status: "unconfigured", message: "Delivery availability can't be checked until Geoapify is configured." };
      else if (shop.latitude == null || shop.longitude == null) deliveryCheck = { status: "unknown", message: "This kitchen hasn't saved its delivery location yet. Delivery availability can't be checked." };
      else {
        try {
          const route = await getKitchenDeliveryDistance({ latitude, longitude }, { latitude: shop.latitude, longitude: shop.longitude });
          deliveryCheck = route.eligible ? { status: "available", distanceKm: route.distanceKm } : { status: "too_far", distanceKm: route.distanceKm, message: "This kitchen is more than 20 km from your delivery address. Delivery is unavailable. Please choose another address or kitchen." };
        } catch { deliveryCheck = { status: "unknown", message: ROUTING_UNAVAILABLE_MESSAGE }; }
      }
    }
    return Response.json({ shop, deliveryCheck });
  } catch (error) {
    console.error("Kitchen details request failed", error);
    return Response.json({ error: "Kitchen details are unavailable right now." }, { status: 503 });
  }
}
