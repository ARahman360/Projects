import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";
import { verifyAddressText, verifyCoordinates } from "@/src/lib/location";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to view saved addresses.", 401);
  if (session.role !== "CUSTOMER") return jsonError("Addresses are available for customer accounts.", 403);
  try {
    const addresses = await db.orm.public.Address.where({ userId: session.userId }).orderBy((address) => address.createdAt.desc()).all();
    return Response.json({ addresses });
  } catch (error) {
    console.error("Address request failed", error);
    return jsonError("Saved addresses are unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to save an address.", 401);
  if (session.role !== "CUSTOMER") return jsonError("Addresses are available for customer accounts.", 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const addressLine1 = typeof body.addressLine1 === "string" ? body.addressLine1.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    if (addressLine1.length < 5 || addressLine1.length > 150 || city.length < 2 || city.length > 80) return jsonError("Enter a street address and city.");
    const verified = typeof body.latitude === "number" && typeof body.longitude === "number"
      ? await verifyCoordinates(body.latitude, body.longitude)
      : await verifyAddressText(`${addressLine1}${typeof body.addressLine2 === "string" ? ` ${body.addressLine2.trim()}` : ""}, ${typeof body.postalCode === "string" ? body.postalCode : ""} ${city}, Finland`);
    await db.orm.public.Address.where({ userId: session.userId }).update({ isDefault: false });
    const address = await db.orm.public.Address.create({ userId: session.userId, addressLine1: verified.addressLine1, addressLine2: typeof body.addressLine2 === "string" ? body.addressLine2.trim().slice(0, 150) : null, city: verified.city, postalCode: verified.postalCode || null, latitude: verified.latitude, longitude: verified.longitude, label: typeof body.label === "string" ? body.label.trim().slice(0, 40) : null, isDefault: true });
    return Response.json({ address }, { status: 201 });
  } catch (error) {
    console.error("Address save failed", error);
    const message = error instanceof Error ? error.message : "Couldn't save that address.";
    return jsonError(message, message.includes("not configured") || message.includes("Geoapify rejected") ? 503 : 422);
  }
}
