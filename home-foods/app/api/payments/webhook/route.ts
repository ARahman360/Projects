import { db } from "@/src/prisma/db";
import { verifyStripeSignature } from "@/src/lib/stripe";
import { createMealPlanFulfillment } from "@/src/lib/meal-plan-fulfillment";

export const runtime = "nodejs";

type StripeEvent = {
  id?: string;
  type: string;
  data: { object: { metadata?: { order_ids?: string; subscription_id?: string }; subscription_details?: { metadata?: { subscription_id?: string }; subscription?: string | { id?: string } }; payment_intent?: string | null; subscription?: string | { id?: string } | null; id?: string; payment_status?: string; billing_reason?: string; period_start?: number; amount_total?: number; amount?: number; amount_refunded?: number; refunded?: boolean } };
};

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature") ?? "";
  if (!secret) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  const payload = await request.text();
  if (!verifyStripeSignature(payload, signature, secret)) return Response.json({ error: "Invalid signature." }, { status: 400 });
  try {
    const event = JSON.parse(payload) as StripeEvent;
    const object = event.data.object;
    const subscriptionFromObject = typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
    const metadataSubscriptionId = object.metadata?.subscription_id ?? object.subscription_details?.metadata?.subscription_id;
    const subscriptionId = Number(metadataSubscriptionId);
    if (Number.isInteger(subscriptionId) && subscriptionId > 0) {
      if (event.type === "checkout.session.completed" && object.subscription) {
        if (object.payment_status === "paid") {
          await createMealPlanFulfillment(subscriptionId, event.id ?? object.id ?? `checkout-${subscriptionId}`);
          await db.orm.public.Subscription.where({ id: subscriptionId }).update({ status: "ACTIVE", stripeSubscriptionId: subscriptionFromObject ?? null });
        }
      } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
        await db.orm.public.Subscription.where({ id: subscriptionId, status: "PAUSED" }).update({ status: "CANCELLED", autoRenew: false });
      }
    }
    if (event.type === "invoice.paid" && object.billing_reason === "subscription_cycle" && subscriptionFromObject) {
      const subscription = await db.orm.public.Subscription.where({ stripeSubscriptionId: subscriptionFromObject }).first();
      if (subscription && subscription.status === "ACTIVE") {
        const start = typeof object.period_start === "number" ? new Date(object.period_start * 1000).toISOString() : undefined;
        await createMealPlanFulfillment(subscription.id, event.id ?? object.id ?? `invoice-${subscription.id}`, start);
      }
    }
    if (event.type === "customer.subscription.deleted" && object.id) {
      await db.orm.public.Subscription.where({ stripeSubscriptionId: object.id }).update({ status: "CANCELLED", autoRenew: false });
    }
    if (event.type === "charge.refunded" && object.payment_intent) {
      const payments = await db.orm.public.Payment.where({ providerPaymentId: object.payment_intent, method: "CARD" }).all();
      const fullyRefunded = object.refunded === true || (typeof object.amount === "number" && object.amount_refunded === object.amount);
      await db.transaction(async (tx) => {
        for (const payment of payments) {
          await tx.orm.public.Payment.where({ id: payment.id }).update({ status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" });
          if (fullyRefunded) {
            const order = await tx.orm.public.Order.where({ id: payment.orderId }).first();
            if (order && order.status !== "REFUNDED") {
              await tx.orm.public.Order.where({ id: payment.orderId }).update({ status: "REFUNDED" });
              await tx.orm.public.OrderStatusEvent.create({ orderId: payment.orderId, status: "REFUNDED", domain: "ORDER", actorRole: "SYSTEM", message: "Stripe confirmed a full refund" });
            }
          }
        }
      });
    }
    const orderIds = (object.metadata?.order_ids ?? "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0);
    if (!orderIds.length) return Response.json({ received: true });
    if (event.type === "checkout.session.completed" && object.payment_status === "paid") {
      await db.transaction(async (tx) => {
        for (const orderId of orderIds) {
          await tx.orm.public.Payment.where({ orderId, method: "CARD" }).update({ status: "PAID", providerPaymentId: object.payment_intent ?? object.id ?? null });
          const order = await tx.orm.public.Order.where({ id: orderId, status: "PENDING" }).first();
          if (order) {
            await tx.orm.public.Order.where({ id: orderId, status: "PENDING" }).update({ status: "CONFIRMED" });
            await tx.orm.public.OrderStatusEvent.create({ orderId, status: "CONFIRMED", domain: "ORDER", actorRole: "SYSTEM", message: "Stripe confirmed the card payment" });
          }
        }
      });
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      await db.transaction(async (tx) => {
        for (const orderId of orderIds) {
          await tx.orm.public.Payment.where({ orderId, method: "CARD", status: "PENDING" }).update({ status: "FAILED" });
          const order = await tx.orm.public.Order.where({ id: orderId, status: "PENDING" }).first();
          if (order) {
            await tx.orm.public.Order.where({ id: orderId, status: "PENDING" }).update({ status: "CANCELLED" });
            await tx.orm.public.OrderStatusEvent.create({ orderId, status: "CANCELLED", domain: "ORDER", actorRole: "SYSTEM", message: "Stripe checkout expired or payment failed" });
          }
        }
      });
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
