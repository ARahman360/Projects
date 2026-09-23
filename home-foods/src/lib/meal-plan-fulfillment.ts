import { randomBytes } from "node:crypto";
import { db } from "@/src/prisma/db";

const TZ = "Europe/Helsinki";
type DateParts = { year: number; month: number; day: number };

function partsInHelsinki(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return { year: Number(parts.find((part) => part.type === "year")?.value), month: Number(parts.find((part) => part.type === "month")?.value), day: Number(parts.find((part) => part.type === "day")?.value) };
}

function localDateToUtc(parts: DateParts, time: string) {
  const [rawHour, rawMinute] = time.split(":").map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 12;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  const wantedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute);
  let guess = wantedUtc;
  // Solve local wall time to UTC with Intl so Helsinki daylight saving is applied.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = new Date(guess);
    const formatted = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(actual);
    const p = Object.fromEntries(formatted.map((item) => [item.type, item.value]));
    const representedUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    guess += wantedUtc - representedUtc;
  }
  return new Date(guess).toISOString();
}

function startDateParts(startDate: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null;
  if (dateOnly) {
    const [year, month, day] = dateOnly.split("-").map(Number);
    return { year, month, day };
  }
  return partsInHelsinki(new Date(startDate));
}

function daysInPeriod(type: string, start: DateParts) {
  if (type === "DAILY") return 1;
  if (type === "THREE_DAY") return 3;
  if (type === "WEEKLY") return 7;
  return new Date(Date.UTC(start.year, start.month, 0)).getUTCDate();
}

/** Create real scheduled meal records and linked seller/rider orders once per paid Stripe cycle. */
export async function createMealPlanFulfillment(subscriptionId: number, billingEventKey: string, periodStart?: string) {
  const subscription = await db.orm.public.Subscription.where({ id: subscriptionId })
    .include("plan", (plan) => plan.include("shop").include("items", (items) => items.include("menuItem")))
    .include("address")
    .first();
  if (!subscription?.plan?.shop || !subscription.address) throw new Error("The meal plan needs a kitchen and saved delivery address.");
  const plan = subscription.plan;
  const selectedItems = plan.items.filter((entry) => entry.menuItem?.isAvailable && entry.menuItem.shopId === plan.shopId);
  if (!selectedItems.length) throw new Error("This meal plan has no available dishes configured by its kitchen.");

  const start = startDateParts(periodStart ?? subscription.nextDelivery ?? subscription.startDate);
  const duration = daysInPeriod(plan.type, start);
  const count = Math.max(1, Math.min(plan.mealsPerPeriod, 31));
  const meals = [] as Array<{ scheduledAt: string; orderNumber: string }>;
  const cycleKey = billingEventKey.slice(0, 180);
  const amountPerMeal = Math.round((plan.price / count) * 100) / 100;

  await db.transaction(async (tx) => {
    for (let index = 0; index < count; index += 1) {
      const dateOffset = Math.min(duration - 1, Math.floor(index * duration / count));
      const day = new Date(Date.UTC(start.year, start.month - 1, start.day + dateOffset));
      const dateParts = { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() };
      const [hour, minute] = (subscription.deliveryTime ?? "12:00").split(":").map(Number);
      const previousOffset = index > 0 ? Math.min(duration - 1, Math.floor((index - 1) * duration / count)) : -1;
      const scheduledHour = Number.isFinite(hour) ? (hour + (dateOffset === previousOffset ? 4 : 0)) % 24 : 12;
      const scheduledAt = localDateToUtc(dateParts, `${String(scheduledHour).padStart(2, "0")}:${String(Number.isFinite(minute) ? minute : 0).padStart(2, "0")}`);
      const duplicate = await tx.orm.public.ScheduledMeal.where({ subscriptionId, billingEventKey: cycleKey, sequence: index + 1 }).first();
      if (duplicate) { meals.push({ scheduledAt: String(duplicate.scheduledAt), orderNumber: "" }); continue; }

      const orderNumber = `HF-${randomBytes(4).toString("hex").toUpperCase()}`;
      const order = await tx.orm.public.Order.create({ orderNumber, customerId: subscription.customerId, shopId: plan.shopId, addressId: subscription.addressId, status: "PENDING", subtotal: amountPerMeal, deliveryFee: 0, serviceFee: 0, discount: 0, total: amountPerMeal, notes: `Included in ${plan.name} subscription. Scheduled for ${scheduledAt} (${TZ}).` });
      for (const entry of selectedItems) {
        await tx.orm.public.OrderItem.create({ orderId: order.id, menuItemId: entry.menuItemId, name: entry.menuItem.name, quantity: entry.quantity * subscription.portions, unitPrice: 0, totalPrice: 0 });
      }
      await tx.orm.public.Payment.create({ orderId: order.id, amount: amountPerMeal, currency: plan.currency, method: "ONLINE", status: "PAID", provider: "stripe-subscription", providerPaymentId: cycleKey });
      await tx.orm.public.Delivery.create({ orderId: order.id, status: "UNASSIGNED", estimatedTime: plan.shop.estimatedMinutes ?? null, notes: `Meal-plan delivery · ${TZ}` });
      const scheduled = await tx.orm.public.ScheduledMeal.create({ subscriptionId, orderId: order.id, scheduledAt, timeZone: TZ, status: "UPCOMING", portions: subscription.portions, billingEventKey: cycleKey, sequence: index + 1 });
      await tx.orm.public.OrderStatusEvent.create({ orderId: order.id, status: "PENDING", domain: "ORDER", actorRole: "SYSTEM", message: `Meal-plan delivery scheduled for ${scheduledAt}` });
      await tx.orm.public.ScheduledMealEvent.create({ scheduledMealId: scheduled.id, status: "UPCOMING", actorRole: "SYSTEM", message: "Scheduled for delivery" });
      meals.push({ scheduledAt, orderNumber });
    }
  });
  const scheduledRows = await db.orm.public.ScheduledMeal.where({ subscriptionId }).orderBy((meal) => meal.scheduledAt.asc()).limit(100).all();
  const next = scheduledRows.find((meal) => new Date(meal.scheduledAt).getTime() >= Date.now());
  if (next) await db.orm.public.Subscription.where({ id: subscriptionId }).update({ nextDelivery: next.scheduledAt });
  return meals;
}
