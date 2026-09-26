import { db } from "@/src/prisma/db";
import { isSameOriginRequest } from "@/src/lib/request-security";
import { getSession, jsonError } from "@/src/lib/auth";
import { refundStripePayment } from "@/src/lib/stripe";

export const runtime = "nodejs";
const allowed = ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "CANCELLED"] as const;

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.", 403);
  const session = await getSession();
  if (!session) return jsonError("Sign in to manage shop orders.", 401);
  if (session.role !== "SELLER") return jsonError("Only the seller can update this order.", 403);
  try {
    const body = await request.json() as { orderId?: number; status?: string; reason?: string };
    const orderId = Number(body.orderId);
    if (!Number.isInteger(orderId) || !allowed.includes(body.status as typeof allowed[number])) return jsonError("Choose a valid order status.");
    const targetStatus = body.status as typeof allowed[number];
    const shop = await db.orm.public.Shop.where({ sellerId: session.userId }).first();
    if (!shop) return jsonError("Shop not found.", 404);
    const order = await db.orm.public.Order.where({ id: orderId, shopId: shop.id }).first();
    if (!order) return jsonError("Order not found.", 404);
    if (["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status)) return jsonError("This order is already closed.", 409);
    const transitions: Record<string, string[]> = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PREPARING", "CANCELLED"], PREPARING: ["READY_FOR_PICKUP", "CANCELLED"] };
    if (!transitions[order.status]?.includes(targetStatus)) return jsonError("That order status is out of sequence.", 409);
    if (targetStatus === "CONFIRMED") {
      const payment = await db.orm.public.Payment.where({ orderId: order.id }).first();
      if (payment?.method === "CARD" && payment.status !== "PAID") return jsonError("This card payment is still pending. Don't prepare an unpaid order.", 409);
    }
    if (targetStatus === "CANCELLED") {
      const payment = await db.orm.public.Payment.where({ orderId: order.id }).first();
      if (payment?.method === "CARD" && payment.status === "PENDING") return jsonError("Card payment is pending. Wait for Stripe to confirm before cancelling.", 409);
      if (payment?.method === "CARD" && payment.status === "PAID" && payment.providerPaymentId) await refundStripePayment(payment.providerPaymentId, order.id);
      await db.transaction(async (tx) => {
        await tx.orm.public.Order.where({ id: order.id, shopId: shop.id }).update({ status: "CANCELLED", notes: body.reason?.trim().slice(0, 500) || "Cancelled by seller" });
        await tx.orm.public.Delivery.where({ orderId: order.id }).update({ status: "FAILED", notes: body.reason?.trim().slice(0, 500) || "Cancelled by seller" });
        await tx.orm.public.OrderStatusEvent.create({ orderId: order.id, status: "CANCELLED", domain: "ORDER", actorId: session.userId, actorRole: "SELLER", message: body.reason?.trim().slice(0, 500) || "Cancelled by seller" });
        const scheduled = await tx.orm.public.ScheduledMeal.where({ orderId: order.id }).first();
        if (scheduled) {
          await tx.orm.public.ScheduledMeal.where({ id: scheduled.id }).update({ status: "CANCELLED" });
          await tx.orm.public.ScheduledMealEvent.create({ scheduledMealId: scheduled.id, status: "CANCELLED", actorId: session.userId, actorRole: "SELLER", message: body.reason?.trim().slice(0, 500) || "Cancelled by seller" });
        }
        if (payment?.method === "CARD" && payment.status === "PAID") await tx.orm.public.Payment.where({ orderId: order.id }).update({ status: "REFUNDED" });
      });
    } else {
      await db.transaction(async (tx) => {
        await tx.orm.public.Order.where({ id: order.id, shopId: shop.id }).update({ status: targetStatus });
        await tx.orm.public.OrderStatusEvent.create({ orderId: order.id, status: targetStatus, domain: "ORDER", actorId: session.userId, actorRole: "SELLER" });
        const scheduled = await tx.orm.public.ScheduledMeal.where({ orderId: order.id }).first();
        if (scheduled) {
          await tx.orm.public.ScheduledMeal.where({ id: scheduled.id }).update({ status: targetStatus });
          await tx.orm.public.ScheduledMealEvent.create({ scheduledMealId: scheduled.id, status: targetStatus, actorId: session.userId, actorRole: "SELLER" });
        }
      });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Seller order update failed", error);
    return jsonError("Couldn't update this order.", 503);
  }
}
