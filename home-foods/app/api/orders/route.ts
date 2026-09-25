import { assertFinnishKitchen } from "@/src/lib/location";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";
import { createCheckoutSession } from "@/src/lib/stripe";
import { getKitchenDeliveryDistance, ROUTING_UNAVAILABLE_MESSAGE } from "@/src/lib/location";
import { isDeliveryRadiusEnforced, isDevelopmentSandboxEnabled, isDevelopmentTestSeller, isNationwideDevelopmentSeller, isNationwideDevelopmentMode } from "@/src/lib/feature-flags";

import { resolveSavedDeliveryAddress, verifiedAddressDraft } from "@/src/lib/saved-addresses";
import { isSandboxAddress } from "@/src/lib/address-policy";
import { isSameOriginRequest } from "@/src/lib/request-security";
export const runtime = "nodejs";
type CheckoutResult = { orders: Array<{ orderId:number; orderNumber:string; shopName:string; total:number }>; payment:string; checkoutUrl?:string };
async function finishCheckout(result: CheckoutResult, key: string, userId: number, origin: string) {
  try {
  if (result.payment === "STRIPE_CHECKOUT" && !result.checkoutUrl) {
    const checkout = await createCheckoutSession({ amount: result.orders.reduce((sum,o)=>sum+o.total,0), orderIds:result.orders.map(o=>o.orderId), customerId:userId, origin, idempotencyKey:key });
    await db.transaction(async tx => {
      for (const order of result.orders) await tx.orm.public.Payment.where({orderId:order.orderId}).update({providerPaymentId:checkout.id??null});
      result = {...result,checkoutUrl:checkout.url};
      await tx.orm.public.CheckoutRequest.where({id:key,userId}).update({result:JSON.stringify(result)});
    });
  }
  return Response.json(result,{status:201});
  } catch {
    return jsonError("We couldn't open payment right now. Your order is saved and unpaid. Retry with the same basket to resume payment without creating another order.", 503);
  }
}

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
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.", 403);
  let requestKey = "", requestHash = "";
  const session = await getSession();
  if (!session) return jsonError("Sign in to place an order.", 401);
  if (session.role !== "CUSTOMER") return jsonError("Only customer accounts can place orders.", 403);
  try {
    const body = await request.json() as { lines?: Array<{ menuItemId?: number; quantity?: number }>; addressId?: number | null; addressLine1?: string; addressLine2?: string; city?: string; postalCode?: string; notes?: string; paymentMethod?: string; idempotencyKey?: string; verificationToken?: string; countryCode?: string };
    if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 30) return jsonError("Your cart is empty or has too many different items.");
    if (typeof body.idempotencyKey !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(body.idempotencyKey)) return jsonError("Please refresh checkout before submitting this order.");
    requestKey = session.userId + ":" + body.idempotencyKey;
    requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const previous = await db.orm.public.CheckoutRequest.where({id:requestKey,userId:session.userId}).first();
    if (previous) {
      if (previous.requestHash !== requestHash) return jsonError("This checkout attempt has changed. Start a new checkout.",409);
      if (previous.result) return finishCheckout(JSON.parse(previous.result),requestKey,session.userId,new URL(request.url).origin);
    }
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
      .include("shop", (shop) => shop.select("id", "name", "address", "description", "status", "deliveryFee", "estimatedMinutes", "latitude", "longitude").include("seller", (seller) => seller.select("name", "email")))
      .all();
    if (menuItems.length !== quantities.size || menuItems.some((item) => !item.isAvailable || !item.shop || item.shop.status !== "ACTIVE")) return jsonError("A cart item is no longer available. Refresh the menu and try again.", 409);
    if (menuItems.some((item) => !item.shop)) return jsonError("A cart shop is unavailable. Refresh the menu and try again.", 409);
    if (isNationwideDevelopmentMode() && menuItems.some((item) => !isNationwideDevelopmentSeller(item.shop?.seller))) return jsonError("This kitchen is unavailable in the current development catalog.", 403);
    const byShop = new Map<number, typeof menuItems>();
    for (const item of menuItems) byShop.set(item.shopId, [...(byShop.get(item.shopId) ?? []), item]);
    const addressLine1 = typeof body.addressLine1 === "string" ? body.addressLine1.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const postalCode = typeof body.postalCode === "string" ? body.postalCode.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";
    const confirmed = hasSavedAddress ? await resolveSavedDeliveryAddress(selectedAddressId,session.userId) : await verifiedAddressDraft({...body,addressLine1,city,postalCode});
    const sandboxAddress = isSandboxAddress(confirmed);
    if (sandboxAddress && (paymentMethod !== "CASH" || menuItems.some(item=>!isDevelopmentTestSeller(item.shop?.seller)))) return jsonError("Sandbox addresses are limited to cash simulation at fictional test kitchens.",422);
    const verifiedAddress = {latitude:confirmed.latitude!,longitude:confirmed.longitude!};
    for (const items of byShop.values()) await assertFinnishKitchen(items[0].shop!);
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

    const result = await db.transaction(async (tx) => {
      await tx.orm.public.CheckoutRequest.create({id:requestKey,userId:session.userId,requestHash});
      await tx.orm.public.User.where({id:session.userId}).update({updatedAt:new Date().toISOString()});
      let saved = hasSavedAddress ? await tx.orm.public.Address.where({id:selectedAddressId,userId:session.userId,isArchived:false}).first() : null;
      if (hasSavedAddress && (!saved || saved.verificationHash !== confirmed.verificationHash)) throw new Error("The delivery address changed or was removed. Choose it again before ordering.");
      if (!saved) {
        const first = !(await tx.orm.public.Address.where({userId:session.userId,isArchived:false}).first());
        const {addressLine1,addressLine2,city,postalCode,latitude,longitude,countryCode,verificationSource,verificationHash,verifiedAt,label} = confirmed;
        saved = await tx.orm.public.Address.create({userId:session.userId,addressLine1,addressLine2,city,postalCode,latitude,longitude,countryCode,verificationSource,verificationHash,verifiedAt,label,isDefault:first});
      }
      const {addressLine1,addressLine2,city,postalCode,latitude,longitude,countryCode,verificationSource,verificationHash,verifiedAt,label} = saved;
      const address = await tx.orm.public.Address.create({userId:session.userId,addressLine1,addressLine2,city,postalCode,latitude,longitude,countryCode,verificationSource,verificationHash,verifiedAt,label,isArchived:true,isDefault:false});
      const orders = [] as Array<{ orderId: number; orderNumber: string; shopName: string; total: number }>;
      for (const [shopId, items] of byShop) {
        const subtotal = items.reduce((sum, item) => sum + item.price * (quantities.get(item.id) ?? 0), 0);
        const firstShop = items[0]?.shop;
        const deliveryFee = firstShop?.deliveryFee ?? 2.5;
        const serviceFee = Math.round(subtotal * 0.05 * 100) / 100;
        const total = Math.round((subtotal + deliveryFee + serviceFee) * 100) / 100;
        const orderNumber = `HF-${randomBytes(4).toString("hex").toUpperCase()}`;
        const order = await tx.orm.public.Order.create({ orderNumber, customerId: session.userId, shopId, addressId: address.id, isSandbox: isNationwideDevelopmentMode(), status: "PENDING", subtotal, deliveryFee, serviceFee, discount: 0, total, notes: notes || null });
        await tx.orm.public.OrderStatusEvent.create({ orderId: order.id, status: "PENDING", domain: "ORDER", actorId: session.userId, actorRole: "CUSTOMER", message: "Order placed" });
        for (const item of items) {
          const quantity = quantities.get(item.id) ?? 0;
          await tx.orm.public.OrderItem.create({ orderId: order.id, menuItemId: item.id, name: item.name, quantity, unitPrice: item.price, totalPrice: Math.round(item.price * quantity * 100) / 100 });
        }
        await tx.orm.public.Payment.create({ orderId: order.id, amount: total, currency: "EUR", method: paymentMethod, status: "PENDING", provider: paymentMethod === "CARD" ? "stripe" : "cash-on-delivery" });
        await tx.orm.public.Delivery.create({ orderId: order.id, status: "UNASSIGNED", estimatedTime: isNationwideDevelopmentMode() ? null : firstShop?.estimatedMinutes ?? null, notes: isNationwideDevelopmentMode() ? "Fictional nationwide development test delivery. No real delivery-time commitment." : null });
        orders.push({ orderId: order.id, orderNumber, shopName: firstShop?.name ?? "HomeFoods kitchen", total });
      }
      const result: CheckoutResult = { orders, payment: paymentMethod === "CARD" ? "STRIPE_CHECKOUT" : "CASH_ON_DELIVERY" };
      await tx.orm.public.CheckoutRequest.where({id:requestKey}).update({result:JSON.stringify(result)});
      return result;
    });
    return finishCheckout(result,requestKey,session.userId,new URL(request.url).origin);
  } catch (error) {
    if (requestKey) {
      const committed = await db.orm.public.CheckoutRequest.where({id:requestKey,userId:session.userId}).first();
      if (committed?.result && committed.requestHash === requestHash) return finishCheckout(JSON.parse(committed.result),requestKey,session.userId,new URL(request.url).origin);
    }
    console.error("Order creation failed", error instanceof Error ? error.name : "unknown");
    const message = error instanceof Error ? error.message : "We couldn't place that order. Please check the address and try again.";
    const status = message.includes("not configured") ? 503 : message.includes("not available in this country") ? 422 : 503;
    return jsonError(message, status);
  }
}
