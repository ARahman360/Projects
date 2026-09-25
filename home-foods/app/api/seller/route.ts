import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";
import { verifyAddressText, isLocationServiceUnavailableMessage, OUTSIDE_FINLAND_MESSAGE } from "@/src/lib/location";

export const runtime = "nodejs";

async function ownedShop(userId: number) {
  return db.orm.public.Shop.where({ sellerId: userId }).first();
}

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to open your seller workspace.", 401);
  if (session.role !== "SELLER") return jsonError("This workspace is for seller accounts.", 403);
  try {
    const shop = await ownedShop(session.userId);
    if (!shop) return Response.json({ shop: null, items: [], categories: [], orders: [], plans: [], subscriptions: [] });
    const items = await db.orm.public.MenuItem.where({ shopId: shop.id }).orderBy((item) => item.createdAt.desc()).all();
    const categories = await db.orm.public.MenuCategory.where({ shopId: shop.id }).orderBy((category) => category.sortOrder.asc()).all();
    const orders = await db.orm.public.Order.where({ shopId: shop.id }).include("items").include("payment").include("delivery").orderBy((order) => order.createdAt.desc()).limit(50).all();
    const plans = await db.orm.public.SubscriptionPlan.where({ shopId: shop.id }).include("items").all();
    const planIds = plans.map((plan) => plan.id);
    const subscriptions = planIds.length ? await db.orm.public.Subscription.where((subscription) => subscription.planId.in(planIds)).include("customer", (customer) => customer.select("name", "email")).include("plan", (plan) => plan.select("id", "name")).include("scheduledMeals", (meal) => meal.include("order", (order) => order.include("items").include("delivery")).orderBy((meal) => meal.scheduledAt.asc())).all() : [];
    return Response.json({ shop, items, categories, orders, plans, subscriptions });
  } catch (error) {
    console.error("Seller workspace request failed", error);
    return jsonError("Seller workspace is unavailable. Check the database setup.", 503);
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to edit your shop.", 401);
  if (session.role !== "SELLER") return jsonError("This action is for sellers only.", 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const shop = await ownedShop(session.userId);
    if (!shop) return jsonError("Shop application not found.", 404);
    if (body.action === "set-location") {
      const address = typeof body.address === "string" ? body.address.trim() : "";
      const verified = await verifyAddressText(address);
      const updated = await db.orm.public.Shop.where({ id: shop.id, sellerId: session.userId }).update({ address: verified.formattedAddress, city: verified.city, latitude: verified.latitude, longitude: verified.longitude });
      return Response.json({ shop: updated, location: verified });
    }
    if (body.action === "update-category") {
      const categoryId = Number(body.categoryId);
      const category = await db.orm.public.MenuCategory.where({ id: categoryId, shopId: shop.id }).first();
      if (!category) return jsonError("Menu category not found.", 404);
      const update: { name?: string; description?: string | null; imageUrl?: string | null; isActive?: boolean; sortOrder?: number } = {};
      if (typeof body.name === "string" && body.name.trim().length >= 2) update.name = body.name.trim().slice(0, 80);
      if (typeof body.description === "string") update.description = body.description.trim().slice(0, 300);
      if (typeof body.imageUrl === "string") update.imageUrl = body.imageUrl.trim().slice(0, 500) || null;
      if (typeof body.isActive === "boolean") update.isActive = body.isActive;
      if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder)) update.sortOrder = body.sortOrder;
      const updated = await db.orm.public.MenuCategory.where({ id: categoryId, shopId: shop.id }).update(update);
      return Response.json({ category: updated });
    }
    if (body.action === "delete-category") {
      const categoryId = Number(body.categoryId);
      const category = await db.orm.public.MenuCategory.where({ id: categoryId, shopId: shop.id }).first();
      if (!category) return jsonError("Menu category not found.", 404);
      const assignedItems = await db.orm.public.MenuItem.where({ shopId: shop.id, categoryId }).all();
      if (assignedItems.length) return jsonError("Move or unassign this category's dishes before removing it.", 409);
      await db.orm.public.MenuCategory.where({ id: categoryId, shopId: shop.id }).delete();
      return Response.json({ success: true });
    }
    if (body.itemId !== undefined) {
      const itemId = Number(body.itemId);
      const item = await db.orm.public.MenuItem.where({ id: itemId, shopId: shop.id }).first();
      if (!item) return jsonError("Menu item not found.", 404);
      const update: { name?: string; description?: string | null; price?: number; imageUrl?: string | null; isAvailable?: boolean; isFeatured?: boolean; categoryId?: number | null } = {};
      if (typeof body.name === "string") update.name = body.name.trim().slice(0, 100);
      if (typeof body.description === "string") update.description = body.description.trim().slice(0, 1000);
      if (typeof body.price === "number" && Number.isFinite(body.price) && body.price >= 0.5 && body.price <= 500) update.price = Math.round(body.price * 100) / 100;
      if (typeof body.imageUrl === "string") update.imageUrl = body.imageUrl.trim().slice(0, 500);
      if (typeof body.isAvailable === "boolean") update.isAvailable = body.isAvailable;
      if (typeof body.isFeatured === "boolean") update.isFeatured = body.isFeatured;
      if (body.categoryId === null || body.categoryId === "") update.categoryId = null;
      else if (body.categoryId !== undefined) {
        const categoryId = Number(body.categoryId);
        if (!Number.isInteger(categoryId) || !await db.orm.public.MenuCategory.where({ id: categoryId, shopId: shop.id }).first()) return jsonError("Choose one of your kitchen's categories.");
        update.categoryId = categoryId;
      }
      const updated = await db.orm.public.MenuItem.where({ id: itemId }).update(update);
      return Response.json({ item: updated });
    }
    const update: { name?: string; description?: string | null; phone?: string | null; address?: string | null; city?: string | null; latitude?:number; longitude?:number; deliveryFee?: number; estimatedMinutes?: number; logoUrl?: string | null; coverImageUrl?: string | null } = {};
    if (typeof body.name === "string" && body.name.trim().length > 1) update.name = body.name.trim().slice(0, 100);
    if (typeof body.description === "string") update.description = body.description.trim().slice(0, 1200);
    if (typeof body.phone === "string") update.phone = body.phone.trim().slice(0, 40);
    if (typeof body.logoUrl === "string") update.logoUrl = body.logoUrl.trim().slice(0, 500) || null;
    if (typeof body.coverImageUrl === "string") update.coverImageUrl = body.coverImageUrl.trim().slice(0, 500) || null;
    if ((typeof body.address === "string" && body.address.trim() !== shop.address) || (typeof body.city === "string" && body.city.trim() !== shop.city)) {
      const verified = await verifyAddressText(`${body.address ?? shop.address ?? ""}, ${body.city ?? shop.city ?? ""}`);
      update.address = verified.formattedAddress; update.city = verified.city; update.latitude = verified.latitude; update.longitude = verified.longitude;
    }
    if (typeof body.deliveryFee === "number" && Number.isFinite(body.deliveryFee) && body.deliveryFee >= 0 && body.deliveryFee <= 50) update.deliveryFee = Math.round(body.deliveryFee * 100) / 100;
    if (typeof body.estimatedMinutes === "number" && Number.isInteger(body.estimatedMinutes) && body.estimatedMinutes >= 10 && body.estimatedMinutes <= 240) update.estimatedMinutes = body.estimatedMinutes;
    const updated = await db.orm.public.Shop.where({ id: shop.id, sellerId: session.userId }).update(update);
    return Response.json({ shop: updated });
  } catch (error) {
    console.error("Seller update failed", error);
    if (error instanceof Error && isLocationServiceUnavailableMessage(error.message)) return jsonError(error.message, 503);
    if (error instanceof Error && (error.message === OUTSIDE_FINLAND_MESSAGE || error.message.startsWith("Enter a complete delivery") || error.message.startsWith("Add a building number") || error.message.startsWith("Geoapify did not return"))) return jsonError(error.message, 422);
    return jsonError("Couldn't save those shop changes.", 503);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to add menu items.", 401);
  if (session.role !== "SELLER") return jsonError("This action is for sellers only.", 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "create-kitchen") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 100) return jsonError("Choose a kitchen name between 2 and 100 characters.");
      const existing = await ownedShop(session.userId);
      if (existing) return jsonError("Your kitchen is already set up. Reload the page to open it.", 409);
      const shop = await db.orm.public.Shop.create({
        sellerId: session.userId,
        name,
        description: typeof body.description === "string" ? body.description.trim().slice(0, 1200) : "",
        city: typeof body.city === "string" ? body.city.trim().slice(0, 80) : null,
        status: "PENDING",
      });
      return Response.json({ shop }, { status: 201 });
    }
    const shop = await ownedShop(session.userId);
    if (!shop) return jsonError("Shop application not found.", 404);
    if (body.action === "create-category") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 80) return jsonError("Add a category name between 2 and 80 characters.");
      const category = await db.orm.public.MenuCategory.create({ shopId: shop.id, name, description: typeof body.description === "string" ? body.description.trim().slice(0, 300) : null, imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 500) : null, isActive: true });
      return Response.json({ category }, { status: 201 });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const price = Number(body.price);
    if (name.length < 2 || name.length > 100 || !Number.isFinite(price) || price < 0.5 || price > 500) return jsonError("Add a menu item name and a price between €0.50 and €500.");
    const categoryId = body.categoryId ? Number(body.categoryId) : null;
    if (categoryId !== null && (!Number.isInteger(categoryId) || !await db.orm.public.MenuCategory.where({ id: categoryId, shopId: shop.id }).first())) return jsonError("Choose one of your kitchen's categories.");
    const item = await db.orm.public.MenuItem.create({ shopId: shop.id, categoryId, name, price: Math.round(price * 100) / 100, description: typeof body.description === "string" ? body.description.trim().slice(0, 1000) : null, imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 500) : null, isAvailable: true, isFeatured: false });
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Menu item creation failed", error);
    return jsonError("Couldn't add that menu item.", 503);
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to manage your menu.", 401);
  if (session.role !== "SELLER") return jsonError("This action is for sellers only.", 403);
  try {
    const shop = await ownedShop(session.userId);
    if (!shop) return jsonError("Shop application not found.", 404);
    const itemId = Number(new URL(request.url).searchParams.get("itemId"));
    const item = await db.orm.public.MenuItem.where({ id: itemId, shopId: shop.id }).first();
    if (!item) return jsonError("Menu item not found.", 404);
    const existingOrder = await db.orm.public.OrderItem.where({ menuItemId: itemId }).first();
    if (existingOrder) {
      await db.orm.public.MenuItem.where({ id: itemId, shopId: shop.id }).update({ isAvailable: false });
      return Response.json({ archived: true, message: "This dish is part of order history, so it was hidden from the menu." });
    }
    await db.orm.public.MenuItem.where({ id: itemId, shopId: shop.id }).delete();
    return Response.json({ success: true });
  } catch (error) {
    console.error("Menu item removal failed", error);
    return jsonError("Couldn't remove that menu item.", 503);
  }
}
