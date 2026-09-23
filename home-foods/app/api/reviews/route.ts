import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const shopId = Number(new URL(request.url).searchParams.get("shopId"));
  if (!Number.isInteger(shopId) || shopId < 1) return jsonError("Choose a shop.");
  try {
    const reviews = await db.orm.public.Review.where({ shopId }).include("customer", (customer) => customer.select("name")).orderBy((review) => review.createdAt.desc()).limit(50).all();
    return Response.json({ reviews });
  } catch (error) {
    console.error("Review list request failed", error);
    return jsonError("Reviews are unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to review an order.", 401);
  if (session.role !== "CUSTOMER") return jsonError("Only customers can review orders.", 403);
  try {
    const body = await request.json() as { orderId?: number; rating?: number; comment?: string };
    const orderId = Number(body.orderId);
    const rating = Number(body.rating);
    if (!Number.isInteger(orderId) || !Number.isInteger(rating) || rating < 1 || rating > 5) return jsonError("Choose an order and a rating from one to five.");
    const order = await db.orm.public.Order.where({ id: orderId, customerId: session.userId, status: "DELIVERED" }).first();
    if (!order) return jsonError("Only delivered orders can be reviewed.", 409);
    const prior = await db.orm.public.Review.where({ orderId }).first();
    if (prior) return jsonError("This order already has a review.", 409);
    const review = await db.orm.public.Review.create({ customerId: session.userId, shopId: order.shopId, orderId, rating, comment: typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : null });
    return Response.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Review creation failed", error);
    return jsonError("Couldn't save that review.", 503);
  }
}
