import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to see your saved dishes.", 401);
  if (session.role !== "CUSTOMER") return jsonError("Favorites are available for customer accounts.", 403);
  try {
    const favorites = await db.orm.public.Favorite.where({ customerId: session.userId }).include("menuItem").include("shop", (shop) => shop.select("id", "name", "description", "city", "coverImageUrl", "logoUrl", "deliveryFee", "estimatedMinutes", "status").include("reviews", (reviews) => reviews.select("rating"))).orderBy((favorite) => favorite.createdAt.desc()).all();
    const favoriteKitchens = await db.orm.public.KitchenFavorite.where({ customerId: session.userId }).include("shop", (shop) => shop.select("id", "name", "description", "city", "coverImageUrl", "logoUrl", "deliveryFee", "estimatedMinutes", "status").include("reviews", (reviews) => reviews.select("rating"))).orderBy((favorite) => favorite.createdAt.desc()).all();
    return Response.json({ favorites, favoriteKitchens });
  } catch (error) {
    console.error("Favorite list request failed", error);
    return jsonError("Your favorites are unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return jsonError("Request origin could not be verified.", 403);
  const session = await getSession();
  if (!session) return jsonError("Sign in to save favorites.", 401);
  if (session.role !== "CUSTOMER") return jsonError("Favorites are available for customer accounts.", 403);
  try {
    const body = await request.json() as { menuItemId?: unknown; shopId?: unknown };
    if (body.shopId != null && body.menuItemId != null) return jsonError("Save one kitchen or dish at a time.");
    if (body.shopId != null) {
      const shopId = Number(body.shopId);
      if (!Number.isInteger(shopId) || shopId < 1) return jsonError("Choose a kitchen to save.");
      const existingKitchen = await db.orm.public.KitchenFavorite.where({ customerId: session.userId, shopId }).first();
      if (existingKitchen) {
        await db.orm.public.KitchenFavorite.where({ id: existingKitchen.id, customerId: session.userId }).delete();
        return Response.json({ saved: false, kind: "kitchen", shopId });
      }
      const shop = await db.orm.public.Shop.where({ id: shopId, status: "ACTIVE" }).first();
      if (!shop) return jsonError("That kitchen is no longer available.", 404);
      await db.orm.public.KitchenFavorite.create({ customerId: session.userId, shopId });
      return Response.json({ saved: true, kind: "kitchen", shopId });
    }
    const menuItemId = Number(body.menuItemId);
    if (!Number.isInteger(menuItemId)) return jsonError("Choose a dish to save.");
    const existing = await db.orm.public.Favorite.where({ customerId: session.userId, menuItemId }).first();
    if (existing) {
      await db.orm.public.Favorite.where({ id: existing.id, customerId: session.userId }).delete();
      return Response.json({ saved: false, kind: "food", menuItemId });
    }
    const item = await db.orm.public.MenuItem.where({ id: menuItemId }).include("shop", (shop) => shop.select("id", "status")).first();
    if (!item || !item.shop || item.shop.status !== "ACTIVE") return jsonError("That dish is no longer available.", 404);
    await db.orm.public.Favorite.create({ customerId: session.userId, menuItemId, shopId: item.shopId });
    return Response.json({ saved: true, kind: "food", menuItemId });
  } catch (error) {
    console.error("Favorite update failed", error);
    return jsonError("Couldn't update your favorites.", 503);
  }
}
