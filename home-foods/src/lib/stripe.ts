import { createHmac, timingSafeEqual } from "node:crypto";

export async function createCheckoutSession(input: { amount: number; orderIds: number[]; customerId: number; origin: string; idempotencyKey?: string }) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED");
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${input.origin}/?checkout=success`);
  form.set("cancel_url", `${input.origin}/?checkout=cancelled`);
  form.set("line_items[0][price_data][currency]", "eur");
  form.set("line_items[0][price_data][unit_amount]", String(Math.round(input.amount * 100)));
  form.set("line_items[0][price_data][product_data][name]", `HomeFoods order ${input.orderIds.map((id) => `#${id}`).join(", ")}`);
  form.set("line_items[0][quantity]", "1");
  form.set("metadata[order_ids]", input.orderIds.join(","));
  form.set("metadata[customer_id]", String(input.customerId));
  form.set("payment_intent_data[metadata][order_ids]", input.orderIds.join(","));
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded", ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}) },
    body: form,
    cache: "no-store",
  });
  const result = await response.json() as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !result.url) throw new Error(result.error?.message ?? "Stripe checkout could not be created.");
  return { id: result.id, url: result.url };
}

export async function createSubscriptionCheckout(input: { planId: number; subscriptionId: number; customerId: number; customerEmail: string; price: number; currency: "eur" | "gbp"; interval: "day" | "week" | "month"; intervalCount?: number; origin: string }) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED");
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("success_url", `${input.origin}/workspace?subscription=success`);
  form.set("cancel_url", `${input.origin}/workspace?subscription=cancelled`);
  form.set("customer_email", input.customerEmail);
  form.set("line_items[0][price_data][currency]", input.currency);
  form.set("line_items[0][price_data][unit_amount]", String(Math.round(input.price * 100)));
  form.set("line_items[0][price_data][recurring][interval]", input.interval);
  if (input.intervalCount && input.intervalCount > 1) form.set("line_items[0][price_data][recurring][interval_count]", String(input.intervalCount));
  form.set("line_items[0][price_data][product_data][name]", `HomeFoods meal plan #${input.planId}`);
  form.set("line_items[0][quantity]", "1");
  form.set("metadata[subscription_id]", String(input.subscriptionId));
  form.set("metadata[customer_id]", String(input.customerId));
  form.set("subscription_data[metadata][subscription_id]", String(input.subscriptionId));
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    cache: "no-store",
  });
  const result = await response.json() as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !result.url) throw new Error(result.error?.message ?? "Stripe subscription checkout could not be created.");
  return { id: result.id, url: result.url };
}

export async function updateStripeSubscription(id: string, action: "pause" | "resume" | "cancel") {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED");
  const form = new URLSearchParams();
  const endpoint = `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(id)}`;
  if (action === "pause") form.set("pause_collection[behavior]", "void");
  if (action === "resume") form.set("pause_collection", "");
  if (action === "cancel") { form.set("invoice_now", "false"); form.set("prorate", "false"); }
  const response = await fetch(endpoint, { method: action === "cancel" ? "DELETE" : "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form, cache: "no-store" });
  if (!response.ok) {
    const result = await response.json() as { error?: { message?: string } };
    throw new Error(result.error?.message ?? "Stripe subscription could not be updated.");
  }
}

export async function refundStripePayment(paymentIntentId: string, orderId: number) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED");
  const form = new URLSearchParams({ payment_intent: paymentIntentId, "metadata[order_id]": String(orderId) });
  const response = await fetch("https://api.stripe.com/v1/refunds", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form, cache: "no-store" });
  if (!response.ok) {
    const result = await response.json() as { error?: { message?: string } };
    throw new Error(result.error?.message ?? "Stripe refund could not be created.");
  }
}

export function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = header.split(",").map((part) => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((signature) => {
    const provided = Buffer.from(signature, "hex");
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  });
}
