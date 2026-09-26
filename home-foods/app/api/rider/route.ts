import { db } from "@/src/prisma/db";
import { isSameOriginRequest } from "@/src/lib/request-security";
import { pickupTransition } from "@/src/lib/workspace-policy";
import { getSession, jsonError } from "@/src/lib/auth";
import { getKitchenDeliveryDistance } from "@/src/lib/location";
import { isKitchenLocationAllowed, isDeliveryRadiusEnforced, isNationwideDevelopmentSeller, isNationwideDevelopmentMode } from "@/src/lib/feature-flags";

export const runtime = "nodejs";
const HEARTBEAT_STALE_MS = 2 * 60 * 1000;

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
    const riderAccount = await db.orm.public.User.where({id:session.userId}).select("accountStatus").first();
    const pendingJobs = rider.isAvailable && riderAccount?.accountStatus === "ACTIVE" ? await db.orm.public.Delivery.where({ status: "UNASSIGNED" })
      .include("order", (order) => order.include("shop", (shop) => shop.select("id", "name", "city", "latitude", "longitude", "address").include("seller", (seller) => seller.select("name", "email"))).include("address", (address) => address.select("city", "latitude", "longitude")).include("items"))
      .orderBy((delivery) => delivery.createdAt.asc())
      .limit(30)
      .all() : [];
    const jobs = (await Promise.all(pendingJobs.filter((delivery) => delivery.order?.status === "READY_FOR_PICKUP").map(async (delivery) => {
      if (delivery.order?.isSandbox && !isNationwideDevelopmentMode()) return null;
      const shop = delivery.order?.shop;
      const address = delivery.order?.address;
      if (!shop || !isKitchenLocationAllowed(shop.address)) return null;
      if (!isDeliveryRadiusEnforced()) return isNationwideDevelopmentSeller(shop?.seller) ? { ...delivery, developmentTestDelivery: isNationwideDevelopmentMode() } : null;
      if (!shop || !address || shop.latitude == null || shop.longitude == null || address.latitude == null || address.longitude == null) return null;
      try {
        const distance = await getKitchenDeliveryDistance({ latitude: address.latitude, longitude: address.longitude }, { latitude: shop.latitude, longitude: shop.longitude });
        return distance.eligible ? { ...delivery, deliveryDistanceKm: distance.distanceKm } : null;
      } catch { return null; }
    }))).filter((delivery) => delivery !== null);
    const assigned = await db.orm.public.Delivery.where({ riderId: rider.id })
      .include("order", (order) => order.include("shop").include("address").include("items"))
      .orderBy((delivery) => delivery.createdAt.desc())
      .all();
    return Response.json({ rider, jobs, assigned: assigned.filter(d => !d.order?.isSandbox || isNationwideDevelopmentMode()) });
  } catch (error) {
    console.error("Rider workspace request failed", error);
    return jsonError("Rider jobs are unavailable. Check the database setup.", 503);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.", 403);
  const session = await getSession();
  if (!session) return jsonError("Sign in to update deliveries.", 401);
  if (session.role !== "RIDER") return jsonError("Only riders can update their delivery status.", 403);
  try {
    const body = await request.json() as { deliveryId?: number; status?: string; isAvailable?: boolean; expectedAvailability?: boolean; reason?: string };
    const account = await db.orm.public.User.where({ id: session.userId }).select("accountStatus").first();
    if (account?.accountStatus !== "ACTIVE" && (body.isAvailable === true || body.status === "ACCEPTED" || body.status === "HEARTBEAT")) return jsonError("Your rider account is suspended. Existing deliveries remain available for resolution.", 403);
    const rider = await db.orm.public.Rider.where({ userId: session.userId }).first();
    if (!rider) return jsonError("Rider profile not found.", 404);
    if (body.status === "HEARTBEAT") {
      if (!rider.isAvailable) return Response.json({ success: true, isAvailable: false });
      await db.runtime().execute(db.sql.public.rider.update({updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,rider!.id),fn.eq(f.isAvailable,true))).build());
      return Response.json({ success: true, isAvailable: true });
    }
    if (typeof body.isAvailable === "boolean") {
      if (typeof body.expectedAvailability === "boolean" && body.expectedAvailability !== rider.isAvailable) return jsonError("Availability changed on another device. Refresh and try again.",409);
      const riderId=rider.id, expected=rider.isAvailable, desired=body.isAvailable;
      const changed=await db.transaction(async tx=>{
        if(desired){const active=await tx.execute(tx.sql.public.user.update({updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,session.userId),fn.eq(f.accountStatus,"ACTIVE"))).build());if(!active.affectedRows)return false;}
        const result=await tx.execute(tx.sql.public.rider.update({isAvailable:desired,updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,riderId),fn.eq(f.isAvailable,expected))).build());return Boolean(result.affectedRows);
      });
      if(!changed)return jsonError("Availability changed. Refresh and try again.",409);
      return Response.json({ success: true, isAvailable: desired });
    }
    const deliveryId = Number(body.deliveryId);
    if (!Number.isInteger(deliveryId) || typeof body.status !== "string") return jsonError("Choose a delivery and status.");
    const delivery = await db.orm.public.Delivery.where({ id: deliveryId }).first();
    if (!delivery) return jsonError("Delivery not found.", 404);
    const deliveryOrder = await db.orm.public.Order.where({id:delivery.orderId}).select("isSandbox").first();
    if (deliveryOrder?.isSandbox && !isNationwideDevelopmentMode()) return jsonError("Sandbox deliveries are unavailable outside development.",403);
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
        const activeAccount = await tx.execute(tx.sql.public.user.update({updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,session.userId),fn.eq(f.accountStatus,"ACTIVE"))).build());
        if (!activeAccount.affectedRows) throw new Error("Rider account is suspended.");
        const changed = await tx.execute(tx.sql.public.delivery.update({status:"ACCEPTED",updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,deliveryId),fn.eq(f.riderId,rider.id),fn.eq(f.status,"ASSIGNED"))).build());
        if (!changed.affectedRows) return;
        await tx.orm.public.OrderStatusEvent.create({ orderId: delivery.orderId, status: "ACCEPTED", domain: "DELIVERY", actorId: session.userId, actorRole: "RIDER", message: "Rider accepted the delivery" });
      });
      return Response.json({ success: true });
    }
    if (body.status === "ACCEPTED" && delivery.status === "UNASSIGNED") {
      if (!rider.isAvailable) return jsonError("Go online before accepting a delivery.", 409);
      const order = await db.orm.public.Order.where({ id: delivery.orderId, status: "READY_FOR_PICKUP" }).first();
      if (!order || (order.isSandbox && !isNationwideDevelopmentMode())) return jsonError("This order is not available for delivery in the current environment.", 409);
      const [shop, address] = await Promise.all([
        db.orm.public.Shop.where({ id: order.shopId }).include("seller", (seller) => seller.select("name", "email")).first(),
        db.orm.public.Address.where({ id: order.addressId }).first(),
      ]);
      if (isNationwideDevelopmentMode() && !isNationwideDevelopmentSeller(shop?.seller)) return jsonError("This kitchen is unavailable in the current development catalog.", 403);
      if (isDeliveryRadiusEnforced()) {
        if (!shop || !address || shop.latitude == null || shop.longitude == null || address.latitude == null || address.longitude == null) return jsonError("This delivery no longer has verified route locations and can't be assigned.", 409);
        try {
          const distance = await getKitchenDeliveryDistance({ latitude: address.latitude, longitude: address.longitude }, { latitude: shop.latitude, longitude: shop.longitude });
          if (!distance.eligible) return jsonError("This order is outside the 20 km delivery limit and can't be assigned.", 409);
        } catch { return jsonError("Delivery distance could not be checked. Try again later.", 503); }
      }
      await db.transaction(async (tx) => {
        const account = await tx.execute(tx.sql.public.user.update({updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,session.userId),fn.eq(f.accountStatus,"ACTIVE"))).build());
        if (!account.affectedRows) throw new Error("Rider account is suspended.");
        const claimed = await tx.execute(tx.sql.public.delivery.update({riderId:rider.id,status:"ACCEPTED",updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,deliveryId),fn.eq(f.status,"UNASSIGNED"))).build());
        if (!claimed.affectedRows) throw new Error("Another rider accepted this delivery.");
        await tx.orm.public.OrderStatusEvent.create({ orderId: delivery.orderId, status: "ACCEPTED", domain: "DELIVERY", actorId: session.userId, actorRole: "RIDER", message: "Rider accepted the delivery" });
      });
      return Response.json({ success: true });
    }
    if (delivery.riderId !== rider.id) return jsonError("This delivery is not assigned to you.", 403);
    const target = pickupTransition(delivery.status, body.status);
    if (target === "ALREADY_APPLIED") return Response.json({ success: true, alreadyApplied: true });
    if (!target) return jsonError("That delivery status is out of order.", 409);
    const orderStatus = target === "IN_TRANSIT" ? "OUT_FOR_DELIVERY" : "DELIVERED";
    await db.transaction(async (tx) => {
      const { affectedRows } = await tx.execute(tx.sql.public.delivery.update({ status: target, updatedAt: new Date().toISOString(), ...(target === "IN_TRANSIT" ? { pickedUpTime: delivery.pickedUpTime ?? new Date().toISOString() } : { deliveredTime: new Date().toISOString() }) }).where((f, fn) => fn.and(fn.eq(f.id, deliveryId), fn.eq(f.riderId, rider.id), fn.eq(f.status, delivery.status))).build());
      if (!affectedRows) return;
      await tx.orm.public.Order.where({ id: delivery.orderId }).update({ status: orderStatus as "PICKED_UP" | "OUT_FOR_DELIVERY" | "DELIVERED" });
      if (target === "IN_TRANSIT" && !delivery.pickedUpTime) await tx.orm.public.OrderStatusEvent.create({ orderId: delivery.orderId, status: "PICKED_UP", domain: "DELIVERY", actorId: session.userId, actorRole: "RIDER", message: "Rider confirmed pickup" });
      await tx.orm.public.OrderStatusEvent.create({ orderId: delivery.orderId, status: target, domain: "DELIVERY", actorId: session.userId, actorRole: "RIDER" });
      const scheduled = await tx.orm.public.ScheduledMeal.where({ orderId: delivery.orderId }).first();
      if (scheduled) {
        await tx.orm.public.ScheduledMeal.where({ id: scheduled.id }).update({ status: target, ...(target === "DELIVERED" ? { deliveredAt: new Date().toISOString() } : {}) });
        await tx.orm.public.ScheduledMealEvent.create({ scheduledMealId: scheduled.id, status: target, actorId: session.userId, actorRole: "RIDER" });
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
