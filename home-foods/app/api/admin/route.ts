import { isSameOriginRequest } from "@/src/lib/request-security";
import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";
import { refundStripePayment } from "@/src/lib/stripe";
import { getKitchenDeliveryDistance, verifyAddressText } from "@/src/lib/location";
import { isKitchenLocationAllowed, isDeliveryRadiusEnforced, isNationwideDevelopmentMode, isNationwideDevelopmentSeller } from "@/src/lib/feature-flags";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to open the admin workspace.", 401);
  if (session.role !== "ADMIN") return jsonError("Administrator access is required.", 403);
  try {
    const [shops, orders, initialRiders, users, allDeliveries, subscriptions] = await Promise.all([
      db.orm.public.Shop.include("seller", (seller) => seller.select("id", "name", "email")).orderBy((shop) => shop.createdAt.desc()).limit(100).all(),
      db.orm.public.Order.include("shop", (shop) => shop.select("id", "name")).include("payment").include("delivery", (delivery) => delivery.include("rider", (rider) => rider.include("user", (user) => user.select("name", "email")))).include("statusEvents").orderBy((order) => order.createdAt.desc()).limit(100).all(),
      db.orm.public.Rider.include("user", (user) => user.select("id", "name", "email")).all(),
      db.orm.public.User.select("id", "name", "email", "role", "createdAt").orderBy((user) => user.createdAt.desc()).limit(100).all(),
      db.orm.public.Delivery.include("rider", (rider) => rider.select("id", "isAvailable").include("user", (user) => user.select("name", "email"))).include("order", (order) => order.include("shop", (shop) => shop.select("id", "name", "latitude", "longitude").include("seller", (seller) => seller.select("name", "email"))).include("address", (address) => address.select("addressLine1", "addressLine2", "postalCode", "city", "latitude", "longitude"))).orderBy((delivery) => delivery.createdAt.asc()).limit(200).all(),
      db.orm.public.Subscription.include("plan", (plan) => plan.include("shop", (shop) => shop.select("id", "name"))).include("scheduledMeals", (meals) => meals.include("order", (order) => order.include("delivery")).orderBy((meal) => meal.scheduledAt.asc())).orderBy((subscription) => subscription.createdAt.desc()).limit(100).all(),
    ]);
    const staleRiders = initialRiders.filter((rider) => rider.isAvailable && Date.now() - new Date(rider.updatedAt).getTime() > 2 * 60 * 1000);
    await Promise.all(staleRiders.map((rider) => db.orm.public.Rider.where({ id: rider.id }).update({ isAvailable: false })));
    const riders = staleRiders.length ? await db.orm.public.Rider.include("user", (user) => user.select("id", "name", "email")).all() : initialRiders;
    const deliveries = allDeliveries.filter((delivery) => delivery.status === "FAILED" || (delivery.status === "UNASSIGNED" && delivery.order?.status === "READY_FOR_PICKUP") || (Boolean(delivery.riderId) && delivery.rider?.isAvailable === false && ["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(delivery.status)));
    return Response.json({ shops, orders, riders, users, deliveries, subscriptions });
  } catch (error) {
    console.error("Admin workspace request failed", error);
    return jsonError("Admin data is unavailable. Check the database setup.", 503);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.",403);
  const session = await getSession();
  if (!session) return jsonError("Sign in to administer the marketplace.", 401);
  if (session.role !== "ADMIN") return jsonError("Administrator access is required.", 403);
  try {
    const body = await request.json() as { action?: string; shopId?: number; deliveryId?: number; riderId?: number; reason?: string; orderId?: number; status?: string; address?: string };
    if (body.action === "set-development-location") {
      if (!isNationwideDevelopmentMode()) return jsonError("Example locations are only available in isolated development mode.",403);
      const shopId=Number(body.shopId);
      const shop=await db.orm.public.Shop.where({id:shopId}).first();
      if(!shop || typeof body.address!=="string") return jsonError("Choose a kitchen and Finnish example address.",422);
      const location=await verifyAddressText(body.address);
      await db.orm.public.Shop.where({id:shopId}).update({address:`[SANDBOX LOCATION] ${location.formattedAddress}`,city:location.city,latitude:location.latitude,longitude:location.longitude});
      return Response.json({success:true,location,developmentPlaceholder:true});
    }
    if (body.action === "shop-status") return jsonError("Use the kitchen review workflow with a reason and audit record.",409);
    if (body.action === "assign-rider") {
      if (!body.reason || body.reason.trim().length < 5) return jsonError("Provide a reason for this assignment.",422);
      const deliveryId = Number(body.deliveryId);
      const riderId = Number(body.riderId);
      if (!Number.isInteger(deliveryId) || !Number.isInteger(riderId)) return jsonError("Choose a delivery and rider.");
      const [delivery, rider] = await Promise.all([db.orm.public.Delivery.where({ id: deliveryId }).include("rider").first(), db.orm.public.Rider.where({ id: riderId, isAvailable: true }).first()]);
      const riderAccount = rider ? await db.orm.public.User.where({id:rider.userId}).select("accountStatus").first() : null;
      if (riderAccount?.accountStatus !== "ACTIVE") return jsonError("This rider account is not active.",409);
      const canReassignOfflineRider = Boolean(delivery?.riderId && delivery.rider?.isAvailable === false && ["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(delivery.status));
      if (!delivery || !["UNASSIGNED", "FAILED"].includes(delivery.status) && !canReassignOfflineRider || !rider) return jsonError("That delivery or rider is no longer available.", 409);
      const order = await db.orm.public.Order.where({ id: delivery.orderId }).first();
      if (!order || (order.isSandbox && !isNationwideDevelopmentMode()) || ["CANCELLED", "REFUNDED", "DELIVERED"].includes(order.status)) return jsonError("This order can no longer be assigned.", 409);
      const shop = await db.orm.public.Shop.where({ id: order.shopId }).include("seller", (seller) => seller.select("name", "email")).first();
      const address = order.addressId == null ? null : await db.orm.public.Address.where({ id: order.addressId }).first();
      if (!shop || !isKitchenLocationAllowed(shop.address)) return jsonError("This kitchen needs its real Finnish location.",409);
      if (isNationwideDevelopmentMode() && !isNationwideDevelopmentSeller(shop?.seller)) return jsonError("This kitchen is unavailable in the current development catalog.", 403);
      if (isDeliveryRadiusEnforced() && !isNationwideDevelopmentMode()) {
        if (!shop || !address || shop.latitude == null || shop.longitude == null || address.latitude == null || address.longitude == null) return jsonError("This delivery has no verified route locations.", 409);
        try {
          const route = await getKitchenDeliveryDistance({ latitude: address.latitude, longitude: address.longitude }, { latitude: shop.latitude, longitude: shop.longitude });
          if (!route.eligible) return jsonError("This delivery is outside the 20 km limit.", 409);
        } catch { return jsonError("Delivery distance could not be checked. Try again.", 503); }
      }
      await db.transaction(async (tx) => {
        const activeAccount = await tx.execute(tx.sql.public.user.update({updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,rider.userId),fn.eq(f.accountStatus,"ACTIVE"))).build());
        if (!activeAccount.affectedRows) throw new Error("The rider is no longer active.");
        const assigned = await tx.execute(tx.sql.public.delivery.update({riderId:rider.id,status:"ASSIGNED",pickedUpTime:null,notes:"Assigned by HomeFoods administrator",updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,delivery.id),fn.eq(f.status,delivery.status))).build());
        if (!assigned.affectedRows) throw new Error("The delivery changed. Refresh before assigning it.");
        if (delivery.status !== "UNASSIGNED") await tx.orm.public.Order.where({ id: order.id }).update({ status: "READY_FOR_PICKUP" });
        await tx.orm.public.AdminAuditLog.create({actorId:session.userId,entityType:"DELIVERY",entityId:delivery.id,action:"assign-rider",reason:body.reason!.trim().slice(0,500),nextValue:String(rider.id)});
        await tx.orm.public.OrderStatusEvent.create({ orderId: delivery.orderId, status: "REASSIGNED", domain: "DELIVERY", actorId: session.userId, actorRole: "ADMIN", message: delivery.status === "UNASSIGNED" ? "Administrator assigned a rider" : "Administrator reassigned delivery from a failed or offline rider" });
      });
      return Response.json({ success: true });
    }
    if (body.action === "refund-order") {
      if (!body.reason || body.reason.trim().length < 5) return jsonError("Provide a refund reason.",422);
      const orderId = Number(body.orderId);
      if (!Number.isInteger(orderId)) return jsonError("Choose an order to refund.");
      const [order, payment] = await Promise.all([db.orm.public.Order.where({ id: orderId }).first(), db.orm.public.Payment.where({ orderId }).first()]);
      if (!order || !payment) return jsonError("Order payment not found.", 404);
      if (payment.method !== "CARD" || payment.status !== "PAID" || !payment.providerPaymentId) return jsonError("Only completed Stripe card payments can be refunded here.", 409);
      await refundStripePayment(payment.providerPaymentId, order.id);
      await db.transaction(async (tx) => {
        await tx.orm.public.Payment.where({ id: payment.id }).update({ status: "REFUNDED" });
        await tx.orm.public.Order.where({ id: order.id }).update({ status: "REFUNDED" });
        await tx.orm.public.AdminAuditLog.create({actorId:session.userId,entityType:"ORDER",entityId:order.id,action:"refund-order",reason:body.reason!.trim().slice(0,500)});
        await tx.orm.public.OrderStatusEvent.create({ orderId: order.id, status: "REFUNDED", domain: "ORDER", actorId: session.userId, actorRole: "ADMIN" });
      });
      return Response.json({ success: true });
    }
    return jsonError("Unknown admin action.");
  } catch (error) {
    console.error("Admin action failed", error);
    return jsonError("Couldn't complete that admin action.", 503);
  }
}
