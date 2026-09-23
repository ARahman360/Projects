import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";
import { getKitchenDeliveryDistance } from "@/src/lib/location";
import { isDeliveryRadiusEnforced, isDevelopmentTestSeller, isNationwideDevelopmentMode } from "@/src/lib/feature-flags";

export const runtime = "nodejs";
const HEARTBEAT_STALE_MS = 2 * 60 * 1000;
const nextStatus = { ACCEPTED: "PICKED_UP", PICKED_UP: "IN_TRANSIT", IN_TRANSIT: "DELIVERED" } as const;

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to open the rider workspace.", 401);
  if (session.role !== "RIDER") return jsonError("This workspace is for riders only.", 403);
  try {
    let rider = await db.orm.public.Rider.where({ userId: session.userId }).first();
    if (!rider) return jsonError("Rider profile not found.", 404);
    // Rider.updatedAt doubles as a heartbeat and avoids a migration just to
    // track presence. If the workspace stops pinging, stale availability ends.
    if (rider.isAvailable && Date.now() - new Date(rider.updatedAt).getTime() > HEARTBEAT_STALE_MS) {
      rider = await db.orm.public.Rider.where({ id: rider.id }).update({ isAvailable: false });
    }
    if (!rider) return jsonError("Rider profile not found.", 404);
    const pendingJobs = rider.isAvailable ? await db.orm.public.Delivery.where({ status: "UNASSIGNED" })
      .include("order", (order) => order.include("shop", (shop) => shop.select("id", "name", "city", "latitude", "longitude").include("seller", (seller) => seller.select("name", "email"))).include("address", (address) => address.select("city", "latitude", "longitude")).include("items"))
      .orderBy((delivery) => delivery.createdAt.asc())
      .limit(30)
      .all() : [];
    const jobs = (await Promise.all(pendingJobs.filter((delivery) => delivery.order?.status === "READY_FOR_PICKUP").map(async (delivery) => {
      const shop = delivery.order?.shop;
      const address = delivery.order?.address;
      if (!isDeliveryRadiusEnforced()) return isDevelopmentTestSeller(shop?.seller) ? { ...delivery, developmentTestDelivery: isNationwideDevelopmentMode() } : null;
      if (!shop || !address || shop.latitude == null || shop.longitude == null || address.latitude == null || address.longitude == null) return null;
      try {
        const distance = await getKitchenDeliveryDistance({ latitude: address.latitude, longitude: address.longitude }, { latitude: shop.latitude, longitude: shop.longitude });
        return distance.eligible ? { ...delivery, deliveryDistanceKm: distance.distanceKm } : null;
      } catch { return null; }
    }))).filter((delivery) => delivery !== null);
    const assigned = await db.orm.public.Delivery.where({ riderId: rider.id })
      .include("order", (order) => order.include("shop").include("address").include("items"))
      .orderBy((delivery) => delivery.createdAt.desc())
      .limit(30)
      .all();
    return Response.json({ rider, jobs, assigned });
  } catch (error) {
    console.error("Rider workspace request failed", error);
    return jsonError("Rider jobs are unavailable. Check the database setup.", 503);
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to update deliveries.", 401);
  if (session.role !== "RIDER") return jsonError("Only riders can update their delivery status.", 403);
  try {
    const body = await request.json() as { deliveryId?: number; status?: string; isAvailable?: boolean; reason?: string };
    let rider = await db.orm.public.Rider.where({ userId: session.userId }).first();
    if (!rider) return jsonError("Rider profile not found.", 404);
    if (body.status === "HEARTBEAT") {
      if (!rider.isAvailable) return Response.json({ success: true, isAvailable: false });
      rider = await db.orm.public.Rider.where({ id: rider.id }).update({ isAvailable: true });
      return Response.json({ success: true, isAvailable: true });
    }
    if (typeof body.isAvailable === "boolean") {
      rider = await db.orm.public.Rider.where({ id: rider.id }).update({ isAvailable: body.isAvailable });
      return Response.json({ success: true, isAvailable: body.isAvailable });
    }
    const deliveryId = Number(body.deliveryId);
    if (!Number.isInteger(deliveryId) || typeof body.status !== "string") return jsonError("Choose a delivery and status.");
    const delivery = await db.orm.public.Delivery.where({ id: deliveryId }).first();
    if (!delivery) return jsonError("Delivery not found.", 404);
    if (delivery.riderId === rider.id && body.status === "DELAYED" && ["PICKED_UP", "IN_TRANSIT"].includes(delivery.status)) {
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "Rider reported a delay";
      await db.transaction(async (tx) => {
        await tx.orm.public.Delivery.where({ id: deliveryId, riderId: rider.id }).update({ notes: reason });
        await tx.orm.public.OrderStatusEvent.create({ orderId: delivery.orderId, status: "DELAYED", domain: "DELIVERY", actorId: session.userId, actorRole: "RIDER", message: reason || "Rider reported a delay" });
        const scheduled = await tx.orm.public.ScheduledMeal.where({ orderId: delivery.orderId }).first();
        if (scheduled) await tx.orm.public.ScheduledMealEvent.create({ scheduledMealId: scheduled.id, status: "DELAYED", actorId: session.userId, actorRole: "RIDER", message: reason || "Rider reported a delay" });
      });
      return Response.json({ success: true });
    }
    if (delivery.riderId === rider.id && body.status === "FAILED" && ["ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(delivery.status)) {
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "Rider reported a delivery issue";
      await db.transaction(async (tx) => {
        await tx.orm.public.Delivery.where({ id: deliveryId, riderId: rider.id }).update({ status: "FAILED", notes: reason });
        await tx.orm.public.OrderStatusEvent.create({ orderId: delivery.orderId, status: "FAILED", domain: "DELIVERY", actorId: session.userId, actorRole: "RIDER", message: reason || "Rider reported a delivery issue" });
        const scheduled = await tx.orm.public.ScheduledMeal.where({ orderId: delivery.orderId }).first();
        if (scheduled) {
          await tx.orm.public.ScheduledMeal.where({ id: scheduled.id }).update({ status: "FAILED" });
          await tx.orm.public.ScheduledMealEvent.create({ scheduledMealId: scheduled.id, status: "FAILED", actorId: session.userId, actorRole: "RIDER", message: reason || "Rider reported a delivery issue" });
        }
      });
      return Response.json({ success: true });
    }
    if (body.status === "ACCEPTED" && delivery.status === "ASSIGNED" && delivery.riderId === rider.id) {
      if (!rider.isAvailable) return jsonError("Go online before accepting a delivery.", 409);
      await db.transaction(async (tx) => {
        await tx.orm.public.Delivery.where({ id: deliveryId, riderId: rider.id }).update({ status: "ACCEPTED" });
        await tx.orm.public.OrderStatusEvent.create({ orderId: delivery.orderId, status: "ACCEPTED", domain: "DELIVERY", actorId: session.userId, actorRole: "RIDER", message: "Rider accepted the delivery" });
      });
      return Response.json({ success: true });
    }
    if (body.status === "ACCEPTED" && delivery.status === "UNASSIGNED") {
      if (!rider.isAvailable) return jsonError("Go online before accepting a delivery.", 409);
      const order = await db.orm.public.Order.where({ id: delivery.orderId, status: "READY_FOR_PICKUP" }).first();
      if (!order) return jsonError("The home cook has not marked this order ready yet.", 409);
      const [shop, address] = await Promise.all([
        db.orm.public.Shop.where({ id: order.shopId }).include("seller", (seller) => seller.select("name", "email")).first(),
        db.orm.public.Address.where({ id: order.addressId }).first(),
      ]);
      if (isNationwideDevelopmentMode() && !isDevelopmentTestSeller(shop?.seller)) return jsonError("Nationwide test deliveries are limited to fictional development kitchens.", 403);
      if (isDeliveryRadiusEnforced()) {
        if (!shop || !address || shop.latitude == null || shop.longitude == null || address.latitude == null || address.longitude == null) return jsonError("This delivery no longer has verified route locations and can't be assigned.", 409);
        try {
          const distance = await getKitchenDeliveryDistance({ latitude: address.latitude, longitude: address.longitude }, { latitude: shop.latitude, longitude: shop.longitude });
          if (!distance.eligible) return jsonError("This order is outside the 20 km delivery limit and can't be assigned.", 409);
        } catch { return jsonError("Delivery distance could not be checked. Try again later.", 503); }
      }
      await db.transaction(async (tx) => {
        await tx.orm.public.Delivery.where({ id: deliveryId, status: "UNASSIGNED" }).update({ riderId: rider.id, status: "ACCEPTED" });
        await tx.orm.public.OrderStatusEvent.create({ orderId: delivery.orderId, status: "ACCEPTED", domain: "DELIVERY", actorId: session.userId, actorRole: "RIDER", message: "Rider accepted the delivery" });
      });
      return Response.json({ success: true });
    }
    if (delivery.riderId !== rider.id) return jsonError("This delivery is not assigned to you.", 403);
    const expected = nextStatus[delivery.status as keyof typeof nextStatus];
    if (expected !== body.status) return jsonError("That delivery status is out of order.", 409);
    const orderStatus = body.status === "PICKED_UP" ? "PICKED_UP" : body.status === "IN_TRANSIT" ? "OUT_FOR_DELIVERY" : "DELIVERED";
    await db.transaction(async (tx) => {
      await tx.orm.public.Delivery.where({ id: deliveryId, riderId: rider.id }).update({ status: body.status as "PICKED_UP" | "IN_TRANSIT" | "DELIVERED", ...(body.status === "PICKED_UP" ? { pickedUpTime: new Date().toISOString() } : {}), ...(body.status === "DELIVERED" ? { deliveredTime: new Date().toISOString() } : {}) });
      await tx.orm.public.Order.where({ id: delivery.orderId }).update({ status: orderStatus as "PICKED_UP" | "OUT_FOR_DELIVERY" | "DELIVERED" });
      await tx.orm.public.OrderStatusEvent.create({ orderId: delivery.orderId, status: body.status!, domain: "DELIVERY", actorId: session.userId, actorRole: "RIDER" });
      const scheduled = await tx.orm.public.ScheduledMeal.where({ orderId: delivery.orderId }).first();
      if (scheduled) {
        await tx.orm.public.ScheduledMeal.where({ id: scheduled.id }).update({ status: body.status!, ...(body.status === "DELIVERED" ? { deliveredAt: new Date().toISOString() } : {}) });
        await tx.orm.public.ScheduledMealEvent.create({ scheduledMealId: scheduled.id, status: body.status!, actorId: session.userId, actorRole: "RIDER" });
      }
      if (body.status === "DELIVERED") await tx.orm.public.Payment.where({ orderId: delivery.orderId, method: "CASH" }).update({ status: "PAID" });
      if (body.status === "DELIVERED") await tx.orm.public.Rider.where({ id: rider.id }).update({ isAvailable: false });
    });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Delivery status update failed", error);
    return jsonError("Couldn't update that delivery.", 503);
  }
}
