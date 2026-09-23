import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";
import { createSubscriptionCheckout, updateStripeSubscription } from "@/src/lib/stripe";
import { isDevelopmentSandboxEnabled, isDevelopmentTestSeller, isNationwideDevelopmentMode, isNationwideDevelopmentSeller } from "@/src/lib/feature-flags";
import { getKitchenDeliveryDistance, verifyAddressText, verifyCoordinates } from "@/src/lib/location";
import { isDeliveryRadiusEnforced } from "@/src/lib/feature-flags";

export const runtime = "nodejs";
const intervals = { DAILY: { interval: "day", count: 1 }, THREE_DAY: { interval: "day", count: 3 }, WEEKLY: { interval: "week", count: 1 }, MONTHLY: { interval: "month", count: 1 } } as const;

export async function GET() {
  const session = await getSession();
  try {
    const plans = await db.orm.public.SubscriptionPlan.where({ isActive: true }).include("shop", (shop) => shop.select("id", "name", "city", "status").include("seller", (seller) => seller.select("name", "email"))).include("items", (items) => items.include("menuItem", (item) => item.select("id", "name", "imageUrl", "price"))).all();
    const activePlans = plans.filter((plan) => plan.items.length > 0 && plan.shop?.status === "ACTIVE" && (!isNationwideDevelopmentMode() || isNationwideDevelopmentSeller(plan.shop.seller)));
    if (!session || session.role !== "CUSTOMER") return Response.json({ plans: activePlans, subscriptions: [] });
    const subscriptions = await db.orm.public.Subscription.where({ customerId: session.userId }).include("plan", (plan) => plan.include("shop", (shop) => shop.select("id", "name")).include("items", (items) => items.include("menuItem", (item) => item.select("id", "name", "imageUrl")))).include("address").include("scheduledMeals", (meals) => meals.include("order", (order) => order.include("shop", (shop) => shop.select("id", "name", "city")).include("items", (items) => items.include("menuItem", (item) => item.select("imageUrl"))).include("delivery", (delivery) => delivery.include("rider", (rider) => rider.include("user", (user) => user.select("name", "phone")))).include("statusEvents")).orderBy((meal) => meal.scheduledAt.asc())).orderBy((subscription) => subscription.createdAt.desc()).all();
    return Response.json({ plans: activePlans, subscriptions });
  } catch (error) {
    console.error("Subscription list request failed", error);
    return jsonError("Meal plans are unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to manage meal plans.", 401);
  try {
    const body = await request.json() as Record<string, unknown>;
    if (session.role === "SELLER" && body.action === "create-plan") {
      const shop = await db.orm.public.Shop.where({ sellerId: session.userId }).first();
      if (!shop) return jsonError("Create a shop before making a meal plan.", 404);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const type = body.type === "DAILY" || body.type === "THREE_DAY" || body.type === "WEEKLY" || body.type === "MONTHLY" ? body.type : null;
      const price = Number(body.price);
      const mealsPerPeriod = Number(body.mealsPerPeriod ?? 1);
      const itemIds = Array.isArray(body.menuItemIds) ? [...new Set(body.menuItemIds.map(Number))] : [];
      if (name.length < 3 || name.length > 100 || !type || !Number.isFinite(price) || price < 1 || price > 2000 || !Number.isInteger(mealsPerPeriod) || mealsPerPeriod < 1 || mealsPerPeriod > 31 || !itemIds.length || itemIds.some((id) => !Number.isInteger(id) || id < 1)) return jsonError("Enter a plan name, period, price, meal count and at least one menu dish.");
      const ownedItems = await db.orm.public.MenuItem.where((item) => item.id.in(itemIds)).all();
      if (ownedItems.length !== itemIds.length || ownedItems.some((item) => item.shopId !== shop.id || !item.isAvailable)) return jsonError("Choose available dishes from your own kitchen.", 422);
      const plan = await db.transaction(async (tx) => {
        const created = await tx.orm.public.SubscriptionPlan.create({ shopId: shop.id, name, type, price: Math.round(price * 100) / 100, mealsPerPeriod, description: typeof body.description === "string" ? body.description.trim().slice(0, 1000) : null, currency: "EUR", isActive: true });
        for (const menuItemId of itemIds) await tx.orm.public.SubscriptionPlanItem.create({ planId: created.id, menuItemId, quantity: 1 });
        return created;
      });
      return Response.json({ plan }, { status: 201 });
    }
    if (session.role !== "CUSTOMER") return jsonError("Only customers can subscribe to a meal plan.", 403);
    const planId = Number(body.planId);
    const addressId = Number(body.addressId);
    const portions = Number(body.portions ?? 1);
    const deliveryTime = typeof body.deliveryTime === "string" ? body.deliveryTime.trim().slice(0, 40) : "12:00";
    const startDate = typeof body.startDate === "string" ? new Date(body.startDate) : new Date(Date.now() + 86_400_000);
    if (!Number.isInteger(planId) || !Number.isInteger(addressId) || !Number.isInteger(portions) || portions < 1 || portions > 20 || Number.isNaN(startDate.getTime())) return jsonError("Choose a meal plan, delivery address, start date, and portion count.");
    if (!process.env.STRIPE_SECRET_KEY) return jsonError("Recurring card billing is not configured yet. Ask the administrator to configure Stripe.", 503);
    if (process.env.NODE_ENV === "development" && (!isDevelopmentSandboxEnabled() || !process.env.STRIPE_SECRET_KEY.startsWith("sk_test_"))) return jsonError("Development subscriptions require sandbox payments and a Stripe test key.", 503);
    const [plan, address] = await Promise.all([
      db.orm.public.SubscriptionPlan.where({ id: planId, isActive: true }).include("shop", (shop) => shop.select("id", "status", "latitude", "longitude", "name").include("seller", (seller) => seller.select("name", "email"))).include("items", (items) => items.include("menuItem")).first(),
      db.orm.public.Address.where({ id: addressId, userId: session.userId }).first(),
    ]);
    if (!plan || !plan.shop || plan.shop.status !== "ACTIVE") return jsonError("That meal plan is unavailable.", 404);
    if (isNationwideDevelopmentMode() && !isDevelopmentTestSeller(plan.shop.seller)) return jsonError("Nationwide test subscriptions are limited to fictional development kitchens.", 403);
    if (!address) return jsonError("Choose one of your saved delivery addresses.", 404);
    if (!plan.items.length) return jsonError("This kitchen has not selected the dishes included in this meal plan yet.", 409);
    let verifiedAddress;
    try {
      verifiedAddress = address.latitude != null && address.longitude != null
        ? await verifyCoordinates(address.latitude, address.longitude)
        : await verifyAddressText(`${address.addressLine1}${address.addressLine2 ? ` ${address.addressLine2}` : ""}, ${address.postalCode ?? ""} ${address.city}, Finland`);
    } catch (error) { return jsonError(error instanceof Error ? error.message : "We couldn't verify this Finnish address.", 422); }
    if (isDeliveryRadiusEnforced() && !isNationwideDevelopmentMode()) {
      if (plan.shop.latitude == null || plan.shop.longitude == null) return jsonError("This kitchen has not verified its delivery location yet.", 422);
      try {
        const route = await getKitchenDeliveryDistance(verifiedAddress, { latitude: plan.shop.latitude, longitude: plan.shop.longitude });
        if (!route.eligible) return jsonError("This meal plan kitchen is more than 20 km away by road.", 422);
      } catch { return jsonError("Delivery availability could not be checked. Try again shortly.", 503); }
    }
    const subscription = await db.orm.public.Subscription.create({ customerId: session.userId, planId, status: "PAUSED", startDate: startDate.toISOString(), nextDelivery: startDate.toISOString(), autoRenew: true, addressId, deliveryTime, portions });
    try {
      const billing = intervals[plan.type];
      const checkout = await createSubscriptionCheckout({ planId, subscriptionId: subscription.id, customerId: session.userId, customerEmail: session.email, price: plan.price, currency: plan.currency === "GBP" ? "gbp" : "eur", interval: billing.interval, intervalCount: billing.count, origin: new URL(request.url).origin });
      return Response.json({ checkoutUrl: checkout.url }, { status: 201 });
    } catch (error) {
      await db.orm.public.Subscription.where({ id: subscription.id, customerId: session.userId }).update({ status: "CANCELLED", autoRenew: false });
      console.error("Meal plan checkout creation failed", error);
      return jsonError("Secure billing could not be started. No payment was taken.", 503);
    }
  } catch (error) {
    console.error("Subscription request failed", error);
    return jsonError("Couldn't complete that meal plan request.", 503);
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to manage your subscription.", 401);
  if (session.role === "SELLER") {
    try {
      const body = await request.json() as Record<string, unknown>;
      const planId = Number(body.planId);
      const shop = await db.orm.public.Shop.where({ sellerId: session.userId }).first();
      const plan = shop && Number.isInteger(planId) ? await db.orm.public.SubscriptionPlan.where({ id: planId, shopId: shop.id }).first() : null;
      if (!plan) return jsonError("Meal plan not found in your kitchen.", 404);
      const update: { name?: string; description?: string | null; type?: "DAILY" | "THREE_DAY" | "WEEKLY" | "MONTHLY"; price?: number; mealsPerPeriod?: number; isActive?: boolean } = {};
      if (typeof body.name === "string" && body.name.trim().length >= 3) update.name = body.name.trim().slice(0, 100);
      if (typeof body.description === "string") update.description = body.description.trim().slice(0, 1000);
      if (body.type === "DAILY" || body.type === "THREE_DAY" || body.type === "WEEKLY" || body.type === "MONTHLY") update.type = body.type;
      if (typeof body.price === "number" && Number.isFinite(body.price) && body.price >= 1 && body.price <= 2000) update.price = Math.round(body.price * 100) / 100;
      if (typeof body.mealsPerPeriod === "number" && Number.isInteger(body.mealsPerPeriod) && body.mealsPerPeriod >= 1 && body.mealsPerPeriod <= 31) update.mealsPerPeriod = body.mealsPerPeriod;
      if (typeof body.isActive === "boolean") update.isActive = body.isActive;
      if (Array.isArray(body.menuItemIds)) {
        const itemIds = [...new Set(body.menuItemIds.map(Number))];
        if (!itemIds.length || itemIds.some((id) => !Number.isInteger(id) || id < 1)) return jsonError("Select at least one menu dish.");
        const ownedItems = await db.orm.public.MenuItem.where((item) => item.id.in(itemIds)).all();
        if (ownedItems.length !== itemIds.length || ownedItems.some((item) => item.shopId !== shop!.id || !item.isAvailable)) return jsonError("Choose available dishes from your own kitchen.", 422);
        await db.transaction(async (tx) => {
          await tx.orm.public.SubscriptionPlanItem.where({ planId }).delete();
          for (const menuItemId of itemIds) await tx.orm.public.SubscriptionPlanItem.create({ planId, menuItemId, quantity: 1 });
        });
      }
      const saved = await db.orm.public.SubscriptionPlan.where({ id: planId, shopId: shop!.id }).update(update);
      return Response.json({ plan: saved });
    } catch (error) {
      console.error("Seller meal plan update failed", error);
      return jsonError("Couldn't update that meal plan.", 503);
    }
  }
  if (session.role !== "CUSTOMER") return jsonError("Only customers can manage subscriptions.", 403);
  try {
    const body = await request.json() as { subscriptionId?: number; action?: string };
    const id = Number(body.subscriptionId);
    if (!Number.isInteger(id) || !["pause", "resume", "cancel"].includes(body.action ?? "")) return jsonError("Choose a subscription and action.");
    const subscription = await db.orm.public.Subscription.where({ id, customerId: session.userId }).first();
    if (!subscription) return jsonError("Subscription not found.", 404);
    if (body.action === "cancel") {
      if (subscription.stripeSubscriptionId) await updateStripeSubscription(subscription.stripeSubscriptionId, "cancel");
      await db.orm.public.Subscription.where({ id, customerId: session.userId }).update({ status: "CANCELLED", autoRenew: false });
    } else {
      if (!subscription.stripeSubscriptionId) return jsonError("Billing is still being confirmed for this subscription.", 409);
      await updateStripeSubscription(subscription.stripeSubscriptionId, body.action as "pause" | "resume");
      await db.orm.public.Subscription.where({ id, customerId: session.userId }).update({ status: body.action === "pause" ? "PAUSED" : "ACTIVE", autoRenew: true });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Subscription update failed", error);
    return jsonError("Couldn't update that subscription.", 503);
  }
}
