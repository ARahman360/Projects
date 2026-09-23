import { db } from "@/src/prisma/db";
import { jsonError } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return jsonError("Enter a valid email address.");
    if (body.consent !== true) return jsonError("Please confirm you want to receive newsletter emails.");
    const existing = await db.orm.public.NewsletterSubscriber.where({ email }).first();
    if (existing) return Response.json({ success: true, alreadySubscribed: true });
    await db.orm.public.NewsletterSubscriber.create({ email, consentAt: new Date().toISOString() });
    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Newsletter signup failed", error);
    return jsonError("We couldn't save your signup. Please try again later.", 503);
  }
}
