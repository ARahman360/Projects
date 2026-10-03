import {readModifierGroups,validateModifierGroups,ModifierError} from '@/src/lib/modifiers';
import {validatePortions,PortionError} from '@/src/lib/portion-options';
import {savePortions} from '@/src/lib/save-portions';
import {validateImageReference,queueImageCleanup,UploadError} from '@/src/lib/image-storage';
import {kitchenProfileError} from "@/src/lib/kitchen-profile";
import {saveKitchenLocation,verifiedKitchenLocation} from "@/src/lib/kitchen-location-history";
import { readLocationProof } from "@/src/lib/address-policy";
import { db } from "@/src/prisma/db";
import { isSameOriginRequest } from "@/src/lib/request-security";
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
    const items = await db.orm.public.MenuItem.where({ shopId: shop.id }).include("options", options=>options.orderBy(option=>option.id.asc())).orderBy((item) => item.createdAt.desc()).all();
    const categories = await db.orm.public.MenuCategory.where({ shopId: shop.id }).orderBy((category) => category.sortOrder.asc()).all();
    const orders = await db.orm.public.Order.where({ shopId: shop.id }).include("items").include("payment").include("delivery").orderBy((order) => order.createdAt.desc()).all();
    const plans = await db.orm.public.SubscriptionPlan.where({ shopId: shop.id }).include("items").all();
    const planIds = plans.map((plan) => plan.id);
    const subscriptions = planIds.length ? await db.orm.public.Subscription.where((subscription) => subscription.planId.in(planIds)).include("customer", (customer) => customer.select("name", "email")).include("plan", (plan) => plan.select("id", "name")).include("scheduledMeals", (meal) => meal.include("order", (order) => order.include("items").include("delivery")).orderBy((meal) => meal.scheduledAt.asc())).all() : [];
    return Response.json({ shop: {...shop, profileCompletedAt:kitchenProfileError(shop)?null:shop.profileCompletedAt, locationIsVerified: verifiedKitchenLocation(shop)}, items:items.map(item=>({...item,modifierGroups:readModifierGroups(item.modifierGroups)})), categories, orders, plans, subscriptions });
  } catch (error) {
    if(error instanceof ModifierError||error instanceof PortionError)return jsonError(error.message,422);
    if(error instanceof UploadError)return jsonError(error.message,error.status);
    console.error("Seller workspace request failed", error);
    return jsonError("Seller workspace is unavailable. Check the database setup.", 503);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.", 403);
  const session = await getSession();
  if (!session) return jsonError("Sign in to edit your shop.", 401);
  if (session.role !== "SELLER") return jsonError("This action is for sellers only.", 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const shop = await ownedShop(session.userId);
    if (!shop) return jsonError("Shop application not found.", 404);
    if (body.action === "availability") {
      if (typeof body.isOnline !== "boolean") return jsonError("Choose online or offline.", 422);
      if (typeof body.expectedAvailability === "boolean" && body.expectedAvailability !== shop.isOnline) return jsonError("Availability changed on another device. Refresh and try again.",409);
      if (body.isOnline && shop.status !== "ACTIVE") return jsonError("Only approved, unsuspended kitchens can accept new orders.", 409);
      const { affectedRows } = await db.runtime().execute(db.sql.public.shop.update({isOnline:body.isOnline,updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,shop.id),fn.eq(f.sellerId,session.userId),fn.eq(f.status,shop.status),fn.eq(f.isOnline,shop.isOnline))).build());
      if (!affectedRows) return jsonError("Kitchen status changed. Refresh and retry.", 409);
      return Response.json({ shop: await ownedShop(session.userId) });
    }
    if (body.action === "set-location") {
      const address = typeof body.address === "string" ? body.address.trim() : "";
      const proof=readLocationProof(body.verificationToken);
      const verified = proof && typeof proof.houseNumber === "string" && proof.houseNumber && typeof proof.postalCode === "string" && /^\d{5}$/.test(proof.postalCode) && typeof proof.formattedAddress === "string" && typeof proof.city === "string" && typeof proof.latitude === "number" && typeof proof.longitude === "number" ? {formattedAddress:proof.formattedAddress,city:proof.city,latitude:proof.latitude,longitude:proof.longitude} : await verifyAddressText(address);
      const updated = await saveKitchenLocation(shop.id,session.userId,{address:verified.formattedAddress,city:verified.city,latitude:verified.latitude,longitude:verified.longitude});
      return Response.json({ shop: updated, location: verified });
    }
    if (body.action === "update-category") {
      const categoryId = Number(body.categoryId);
      const category = await db.orm.public.MenuCategory.where({ id: categoryId, shopId: shop.id }).first();
      if (!category) return jsonError("Menu category not found.", 404);
      if(body.imageUrl!==undefined)await validateImageReference(body.imageUrl,shop.id,category.imageUrl);
      const update: { name?: string; description?: string | null; imageUrl?: string | null; isActive?: boolean; sortOrder?: number } = {};
      if (typeof body.name === "string" && body.name.trim().length >= 2) update.name = body.name.trim().slice(0, 80);
      if (typeof body.description === "string") update.description = body.description.trim().slice(0, 300);
      if (typeof body.imageUrl === "string") update.imageUrl = body.imageUrl.trim().slice(0, 500) || null;
      if (typeof body.isActive === "boolean") update.isActive = body.isActive;
      if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder)) update.sortOrder = body.sortOrder;
      const updated = await db.orm.public.MenuCategory.where({ id: categoryId, shopId: shop.id }).update(update);
      if(update.imageUrl!==undefined)await queueImageCleanup(category.imageUrl,update.imageUrl);
      return Response.json({ category: updated });
    }
    if (body.action === "delete-category") {
      const categoryId = Number(body.categoryId);
      const category = await db.orm.public.MenuCategory.where({ id: categoryId, shopId: shop.id }).first();
      if (!category) return jsonError("Menu category not found.", 404);
      const assignedItems = await db.orm.public.MenuItem.where({ shopId: shop.id, categoryId }).all();
      if (assignedItems.length) return jsonError("Move or unassign this category's dishes before removing it.", 409);
      await db.orm.public.MenuCategory.where({ id: categoryId, shopId: shop.id }).delete();
      await queueImageCleanup(category.imageUrl,null);
      return Response.json({ success: true });
    }
    if (body.itemId !== undefined) {
      const itemId = Number(body.itemId);
      const item = await db.orm.public.MenuItem.where({ id: itemId, shopId: shop.id }).first();
      if (!item) return jsonError("Menu item not found.", 404);
      if(body.imageUrl!==undefined)await validateImageReference(body.imageUrl,shop.id,item.imageUrl);
      const update: { modifierGroups?:string; name?: string; description?: string | null; price?: number; imageUrl?: string | null; isAvailable?: boolean; isFeatured?: boolean; categoryId?: number | null } = {};
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
      if(body.modifierGroups!==undefined)update.modifierGroups=JSON.stringify(validateModifierGroups(body.modifierGroups));
      const portions=body.options===undefined?undefined:validatePortions(body.options);
      const updated = await db.transaction(async tx=>{
        const result=await tx.orm.public.MenuItem.where({id:itemId,shopId:shop.id}).update(update);
        if(portions)await savePortions(tx,itemId,portions);
        return result;
      });
      if(update.imageUrl!==undefined)await queueImageCleanup(item.imageUrl,update.imageUrl);
      return Response.json({ item: updated });
    }
    for(const key of ["logoUrl","coverImageUrl"] as const)if(body[key]!==undefined)await validateImageReference(body[key],shop.id,shop[key]);
    if(body.action === "save-profile"){const error=kitchenProfileError(body);if(error)return jsonError(error,422);}
    const update: { profileCompletedAt?:string; name?: string; description?: string | null; phone?: string | null; address?: string | null; city?: string | null; latitude?:number; longitude?:number; deliveryFee?: number; estimatedMinutes?: number; logoUrl?: string | null; coverImageUrl?: string | null } = {};
    if (typeof body.name === "string" && body.name.trim().length > 1) update.name = body.name.trim().slice(0, 100);
    if (typeof body.description === "string") update.description = body.description.trim().slice(0, 1200);
    if (typeof body.phone === "string") update.phone = body.phone.trim().slice(0, 40);
    if (typeof body.logoUrl === "string") update.logoUrl = body.logoUrl.trim().slice(0, 500) || null;
    if (typeof body.coverImageUrl === "string") update.coverImageUrl = body.coverImageUrl.trim().slice(0, 500) || null;
    if ((typeof body.address === "string" && body.address.trim() !== shop.address) || (typeof body.city === "string" && body.city.trim() !== shop.city)) {
      const verified = await verifyAddressText(`${body.address ?? shop.address ?? ""}, ${body.city ?? shop.city ?? ""}`);
      await saveKitchenLocation(shop.id,session.userId,{address:verified.formattedAddress,city:verified.city,latitude:verified.latitude,longitude:verified.longitude});
    }
    if (typeof body.deliveryFee === "number" && Number.isFinite(body.deliveryFee) && body.deliveryFee >= 0 && body.deliveryFee <= 50) update.deliveryFee = Math.round(body.deliveryFee * 100) / 100;
    if (typeof body.estimatedMinutes === "number" && Number.isInteger(body.estimatedMinutes) && body.estimatedMinutes >= 10 && body.estimatedMinutes <= 240) update.estimatedMinutes = body.estimatedMinutes;
    if(body.action === "save-profile") update.profileCompletedAt=new Date().toISOString();
    const updated = await db.orm.public.Shop.where({ id: shop.id, sellerId: session.userId }).update(update);
    for(const key of ["logoUrl","coverImageUrl"] as const)if(update[key]!==undefined)await queueImageCleanup(shop[key],update[key]);
    return Response.json({ shop: updated });
  } catch (error) {
    if(error instanceof ModifierError||error instanceof PortionError)return jsonError(error.message,422);
    if(error instanceof UploadError)return jsonError(error.message,error.status);
    console.error("Seller update failed", error);
    if (error instanceof Error && isLocationServiceUnavailableMessage(error.message)) return jsonError(error.message, 503);
    if (error instanceof Error && (error.message === OUTSIDE_FINLAND_MESSAGE || error.message.startsWith("Enter a complete delivery") || error.message.startsWith("Add a building number") || error.message.startsWith("Geoapify did not return"))) return jsonError(error.message, 422);
    return jsonError("Couldn't save those shop changes.", 503);
  }
}

export async function POST(request: Request) {
  if(!isSameOriginRequest(request))return jsonError("Request origin could not be verified.",403);
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
    if(body.imageUrl!==undefined)await validateImageReference(body.imageUrl,shop.id);
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
    const modifierGroups=JSON.stringify(validateModifierGroups(body.modifierGroups??[]));
    const portions=validatePortions(body.options??[]);
    const item = await db.transaction(async tx=>{
    const created = await tx.orm.public.MenuItem.create({ modifierGroups, shopId: shop.id, categoryId, name, price: Math.round(price * 100) / 100, description: typeof body.description === "string" ? body.description.trim().slice(0, 1000) : null, imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 500) : null, isAvailable: typeof body.isAvailable === "boolean" ? body.isAvailable : true, isFeatured: false });
    await savePortions(tx,created.id,portions);
    return created;
    });
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    if(error instanceof ModifierError||error instanceof PortionError)return jsonError(error.message,422);
    if(error instanceof UploadError)return jsonError(error.message,error.status);
    console.error("Menu item creation failed", error);
    return jsonError("Couldn't add that menu item.", 503);
  }
}

export async function DELETE(request: Request) {
  if(!isSameOriginRequest(request))return jsonError("Request origin could not be verified.",403);
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
    await db.transaction(async tx=>{
      await tx.orm.public.MenuItemOption.where({menuItemId:itemId}).delete();
      await tx.orm.public.MenuItem.where({ id: itemId, shopId: shop.id }).delete();
    });
    await queueImageCleanup(item.imageUrl,null);
    return Response.json({ success: true });
  } catch (error) {
    if(error instanceof ModifierError||error instanceof PortionError)return jsonError(error.message,422);
    if(error instanceof UploadError)return jsonError(error.message,error.status);
    console.error("Menu item removal failed", error);
    return jsonError("Couldn't remove that menu item.", 503);
  }
}
