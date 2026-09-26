import { assertFinnishKitchen } from "@/src/lib/location";
import { db } from "@/src/prisma/db";
import { getSession } from "@/src/lib/auth";
import { getKitchenDeliveryDistances, isLocationServiceUnavailableMessage, isWithinDeliveryRadius, ROUTING_UNAVAILABLE_MESSAGE, verifyAddressText, verifyCoordinates } from "@/src/lib/location";
import { isDeliveryRadiusEnforced, isNationwideDevelopmentSeller, isNationwideDevelopmentMode } from "@/src/lib/feature-flags";

import { resolveSavedDeliveryAddress } from "@/src/lib/saved-addresses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!Array.isArray(body.shopIds) || body.shopIds.length < 1 || body.shopIds.length > 20) return Response.json({ error: "Choose items from one or more kitchens first." }, { status: 400 });
    let address: {latitude:number|null;longitude:number|null;formattedAddress:string;countryCode:string};
    if (Number.isInteger(body.addressId) && Number(body.addressId) > 0) {
      const session = await getSession();
      if (!session || session.role !== "CUSTOMER") return Response.json({ error: "Sign in to use your saved address." }, { status: 401 });
      const saved = await resolveSavedDeliveryAddress(Number(body.addressId),session.userId);
      address = {...saved,formattedAddress:[saved.addressLine1,saved.postalCode,saved.city,"Finland"].join(", "),countryCode:saved.countryCode!};
    } else if (typeof body.latitude === "number" && typeof body.longitude === "number") address = await verifyCoordinates(body.latitude, body.longitude);
    else if (typeof body.addressText === "string") address = await verifyAddressText(body.addressText);
    else return Response.json({ error: "Choose a confirmed Finnish delivery address first." }, { status: 400 });

    const ids = [...new Set(body.shopIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    const shops = await db.orm.public.Shop.where((shop) => shop.id.in(ids)).select("id", "name", "address", "status", "isOnline", "latitude", "longitude").include("seller", (seller) => seller.select("name", "email")).all();
    const checks: Array<{ shopId: number; eligible: boolean; status: string; distanceKm?: number; message?: string }> = [];
    const locatedShops = shops.filter((shop) => ids.includes(shop.id) && shop.status === "ACTIVE" && shop.latitude != null && shop.longitude != null);
    const distances = isDeliveryRadiusEnforced() ? await getKitchenDeliveryDistances({latitude:address.latitude!,longitude:address.longitude!}, locatedShops.map((shop) => ({ latitude: shop.latitude!, longitude: shop.longitude! }))) : [];
    if (distances.some((distance) => distance === null)) throw new Error(ROUTING_UNAVAILABLE_MESSAGE);
    for (const shopId of ids) {
      const shop = shops.find((row) => row.id === shopId);
      if (!shop || shop.status !== "ACTIVE" || !shop.isOnline) { checks.push({ shopId, eligible: false, status: "unavailable", message: "This kitchen is unavailable." }); continue; }
      if (isNationwideDevelopmentMode() && !isNationwideDevelopmentSeller(shop.seller)) { checks.push({ shopId, eligible: false, status: "unavailable", message: "This kitchen is outside the configured development storefront." }); continue; }
      await assertFinnishKitchen(shop);
      if (isNationwideDevelopmentMode()) { checks.push({ shopId, eligible: true, status: "available", message: "Available in Finland development testing; long-distance delivery is not a real service commitment." }); continue; }
      const index = locatedShops.findIndex((row) => row.id === shopId);
      if (index < 0) { checks.push({ shopId, eligible: false, status: "unknown", message: "This kitchen hasn't saved verified coordinates yet." }); continue; }
      const distanceMeters = distances[index]!;
      const eligible = isWithinDeliveryRadius(distanceMeters);
      checks.push({ shopId, eligible, status: eligible ? "available" : "too_far", distanceKm: distanceMeters / 1000, message: eligible ? undefined : `${shop.name} is more than 20 km away by road. Delivery is unavailable.` });
    }
    return Response.json({ checks, address: { formattedAddress: address.formattedAddress, countryCode: address.countryCode }, radiusEnforced: isDeliveryRadiusEnforced(), nationwideDevelopmentMode: isNationwideDevelopmentMode() });
  } catch (error) {
    const message = error instanceof Error ? error.message : ROUTING_UNAVAILABLE_MESSAGE;
    const status = message.includes("not available in this country") ? 422 : isLocationServiceUnavailableMessage(message) ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
