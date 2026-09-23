import { randomBytes } from "node:crypto";
import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";
import { createCheckoutSession } from "@/src/lib/stripe";
import { getKitchenDeliveryDistance, ROUTING_UNAVAILABLE_MESSAGE, verifyAddressText, verifyCoordinates } from "@/src/lib/location";
import { isDeliveryRadiusEnforced, isDevelopmentSandboxEnabled, isDevelopmentTestSeller, isNationwideDevelopmentMode } from "@/src/lib/feature-flags";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to view orders.", 401);
  try {
    if (session.role === "CUSTOMER") {
      const orders = await db.orm.public.Order.where({ customerId: session.userId })
        .include("shop", (shop) => shop.select("id", "name", "city"))
        .include("address")
        .include("items", (items) => items.include("menuItem", (item) => item.select("imageUrl")))
        .include("payment")
        .include("delivery", (delivery) => delivery.include("rider", (rider) => rider.include("user", (user) => user.select("name", "phone"))))
        .include("statusEvents")
        .include("review")
        .orderBy((order) => order.createdAt.desc())
        .limit(50)
        .all();
      return Response.json({ orders });
    }
    if (session.role === "SELLER") {
      const shop = await db.orm.public.Shop.where({ sellerId: session.userId }).first();
      if (!shop) return jsonError("Set up your shop before viewing orders.", 404);
      const orders = await db.orm.public.Order.where({ shopId: shop.id })
        .include("items")
        .include("payment")
        .include("delivery")
        .orderBy((order) => order.createdAt.desc())
        .limit(50)
        .all();
      return Response.json({ orders, shop });
    }
    if (session.role === "RIDER") {
      const rider = await db.orm.public.Rider.where({ userId: session.userId }).first();
      if (!rider) return jsonError("Rider profile not found.", 404);
      const deliveries = await db.orm.public.Delivery.where({ riderId: rider.id })
        .include("order", (order) => order.include("shop").include("address").include("items"))
        .orderBy((delivery) => delivery.createdAt.desc())
        .limit(50)
        .all();
      return Response.json({ deliveries, rider });
    }
    const orders = await db.orm.public.Order.include("shop").include("items").include("payment").include("delivery").orderBy((order) => order.createdAt.desc()).limit(100).all();
    const deliveries = await db.orm.public.Delivery.include("order", (order) => order.include("shop").include("address")).where({ status: "UNASSIGNED" }).all();
    const shops = await db.orm.public.Shop.orderBy((shop) => shop.createdAt.desc()).limit(100).all();
    return Response.json({ orders, deliveries, shops });
  } catch (error) {
    console.error("Order list request failed", error);
    return jsonError("Orders are unavailable. Check the database connection and migrations.", 503);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to place an order.", 401);
  if (session.role !== "CUSTOMER") return jsonError("Only customer accounts can place orders.", 403);
  try {
    const body = await request.json() as { lines?: Array<{ menuItemId?: number; quantity?: number }>; addressId?: number | null; addressLine1?: string; addressLine2?: string; city?: string; postalCode?: string; notes?: string; paymentMethod?: string };
    if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 30) return jsonError("Your cart is empty or has too many different items.");
    const selectedAddressId = Number(body.addressId);
    const hasSavedAddress = Number.isInteger(selectedAddressId) && selectedAddressId > 0;
    if (!hasSavedAddress && (typeof body.addressLine1 !== "string" || body.addressLine1.trim().length < 5 || typeof body.city !== "string" || body.city.trim().length < 2)) return jsonError("Enter a delivery address and city.");
    const paymentMethod = body.paymentMethod === "CARD" ? "CARD" : "CASH";
    if (paymentMethod === "CARD" && !process.env.STRIPE_SECRET_KEY) return jsonError("Online card payments are not configured yet. Choose cash on delivery or ask the administrator to configure Stripe.", 503);
    if (paymentMethod === "CARD" && process.env.NODE_ENV === "development" && (!isDevelopmentSandboxEnabled() || !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"))) return jsonError("Card checkout is available in development only when sandbox payments are enabled with a Stripe test key. Choose cash on delivery for local testing.", 503);
    const quantities = new Map<number, number>();
    for (const line of body.lines) {
      const id = Number(line.menuItemId);
      const quantity = Number(line.quantity);
      if (!Number.isInteger(id) || id < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 25) return jsonError("One or more cart quantities are invalid.");
      quantities.set(id, (quantities.get(id) ?? 0) + quantity);
    }
    const menuItems = await db.orm.public.MenuItem.where((item) => item.id.in([...quantities.keys()]))
      .include("shop", (shop) => shop.select("id", "name", "description", "status", "deliveryFee", "estimatedMinutes", "latitude", "longitude").include("seller", (seller) => seller.select("name", "email")))
      .all();
    if (menuItems.length !== quantities.size || menuItems.some((item) => !item.isAvailable || !item.shop || item.shop.status !== "ACTIVE")) return jsonError("A cart item is no longer available. Refresh the menu and try again.", 409);
    if (menuItems.some((item) => !item.shop)) return jsonError("A cart shop is unavailable. Refresh the menu and try again.", 409);
    if (isNationwideDevelopmentMode() && menuItems.some((item) => !isDevelopmentTestSeller(item.shop?.seller))) return jsonError("Nationwide development orders are available only from fictional HomeFoods test kitchens.", 403);
    const byShop = new Map<number, typeof menuItems>();
    for (const item of menuItems) byShop.set(item.shopId, [...(byShop.get(item.shopId) ?? []), item]);
    const addressLine1 = typeof body.addressLine1 === "string" ? body.addressLine1.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const postalCode = typeof body.postalCode === "string" ? body.postalCode.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";
    const savedAddress = hasSavedAddress ? await db.orm.public.Address.where({ id: selectedAddressId, userId: session.userId }).first() : null;
    if (hasSavedAddress && !savedAddress) return jsonError("That saved delivery address is not available on your account.", 404);
    const verifiedAddress = savedAddress?.latitude != null && savedAddress.longitude != null
      ? await verifyCoordinates(savedAddress.latitude, savedAddress.longitude)
      : await verifyAddressText(`${savedAddress?.addressLine1 ?? addressLine1}${savedAddress?.addressLine2 ? ` ${savedAddress.addressLine2}` : typeof body.addressLine2 === "string" ? ` ${body.addressLine2}` : ""}, ${savedAddress?.postalCode ?? postalCode} ${savedAddress?.city ?? city}, Finland`);
    if (isDeliveryRadiusEnforced() && !process.env.GEOAPIFY_API_KEY) return jsonError("Delivery distance checks are not configured. Please contact HomeFoods support.", 503);
    if (isDeliveryRadiusEnforced()) for (const items of byShop.values()) {
      const kitchen = items[0]?.shop;
      if (!kitchen || kitchen.latitude == null || kitchen.longitude == null) return jsonError(`${kitchen?.name ?? "This kitchen"} has not set a verified delivery location. Contact the kitchen before ordering.`, 422);
      try {
        const route = await getKitchenDeliveryDistance(verifiedAddress, { latitude: kitchen.latitude, longitude: kitchen.longitude });
        if (!route.eligible) return jsonError(`${kitchen.name} is ${route.distanceKm.toFixed(1)} km away by road. Delivery is limited to 20 km. Your cart items have been kept.`, 422);
      } catch (error) {
        console.error("Checkout route check failed", error);
        return jsonError(error instanceof Error ? error.message : ROUTING_UNAVAILABLE_MESSAGE, 503);
      }
    }

    const created = await db.transaction(async (tx) => {
      let address = hasSavedAddress ? await tx.orm.public.Address.where({ id: selectedAddressId, userId: session.userId }).first() : null;
      if (hasSavedAddress && !address) throw new Error("That saved delivery address is not available on your account.");
      if (address) {
        await tx.orm.public.Address.where({ userId: session.userId }).update({ isDefault: false });
        address = await tx.orm.public.Address.where({ id: address.id, userId: session.userId }).update({ addressLine1: verifiedAddress.addressLine1, city: verifiedAddress.city, postalCode: verifiedAddress.postalCode || null, latitude: verifiedAddress.latitude, longitude: verifiedAddress.longitude, isDefault: true });
      } else {
        await tx.orm.public.Address.where({ userId: session.userId }).update({ isDefault: false });
        address = await tx.orm.public.Address.create({ userId: session.userId, addressLine1: verifiedAddress.addressLine1, addressLine2: typeof body.addressLine2 === "string" ? body.addressLine2.trim() : null, city: verifiedAddress.city, postalCode: verifiedAddress.postalCode || null, latitude: verifiedAddress.latitude, longitude: verifiedAddress.longitude, isDefault: true });
      }
      if (!address) throw new Error("The delivery address could not be saved.");
      const orders = [] as Array<{ orderId: number; orderNumber: string; shopName: string; total: number }>;
      for (const [shopId, items] of byShop) {
        const subtotal = items.reduce((sum, item) => sum + item.price * (quantities.get(item.id) ?? 0), 0);
        const firstShop = items[0]?.shop;
        const deliveryFee = firstShop?.deliveryFee ?? 2.5;
        const serviceFee = Math.round(subtotal * 0.05 * 100) / 100;
        const total = Math.round((subtotal + deliveryFee + serviceFee) * 100) / 100;
        const orderNumber = `HF-${randomBytes(4).toString("hex").toUpperCase()}`;
        const order = await tx.orm.public.Order.create({ orderNumber, customerId: session.userId, shopId, addressId: address.id, status: "PENDING", subtotal, deliveryFee, serviceFee, discount: 0, total, notes: notes || null });
        await tx.orm.public.OrderStatusEvent.create({ orderId: order.id, status: "PENDING", domain: "ORDER", actorId: session.userId, actorRole: "CUSTOMER", message: "Order placed" });
        for (const item of items) {
          const quantity = quantities.get(item.id) ?? 0;
          await tx.orm.public.OrderItem.create({ orderId: order.id, menuItemId: item.id, name: item.name, quantity, unitPrice: item.price, totalPrice: Math.round(item.price * quantity * 100) / 100 });
        }
        await tx.orm.public.Payment.create({ orderId: order.id, amount: total, currency: "EUR", method: paymentMethod, status: "PENDING", provider: paymentMethod === "CARD" ? "stripe" : "cash-on-delivery" });
        await tx.orm.public.Delivery.create({ orderId: order.id, status: "UNASSIGNED", estimatedTime: isNationwideDevelopmentMode() ? null : firstShop?.estimatedMinutes ?? null, notes: isNationwideDevelopmentMode() ? "Fictional nationwide development test delivery. No real delivery-time commitment." : null });
        orders.push({ orderId: order.id, orderNumber, shopName: firstShop?.name ?? "HomeFoods kitchen", total });
      }
      return orders;
    });
    if (paymentMethod === "CARD") {
      const checkout = await createCheckoutSession({ amount: created.reduce((sum, order) => sum + order.total, 0), orderIds: created.map((order) => order.orderId), customerId: session.userId, origin: new URL(request.url).origin });
      await db.transaction(async (tx) => {
        for (const order of created) await tx.orm.public.Payment.where({ orderId: order.orderId }).update({ providerPaymentId: checkout.id ?? null });
      });
      return Response.json({ orders: created, checkoutUrl: checkout.url, payment: "STRIPE_CHECKOUT" }, { status: 201 });
    }
    return Response.json({ orders: created, payment: "CASH_ON_DELIVERY" }, { status: 201 });
  } catch (error) {
    console.error("Order creation failed", error);
    const message = error instanceof Error ? error.message : "We couldn't place that order. Please check the address and try again.";
    const status = message.includes("not configured") ? 503 : message.includes("not available in this country") ? 422 : 503;
    return jsonError(message, status);
  }
}
