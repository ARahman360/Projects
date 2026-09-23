import { getSession } from "@/src/lib/auth";
import { getLocationConfiguration, resolveLocation, verifyAddressText, verifyCoordinates, ROUTING_UNAVAILABLE_MESSAGE } from "@/src/lib/location";
import { isDeliveryRadiusEnforced, isNationwideDevelopmentMode, isDevelopmentSandboxEnabled, isDevelopmentNotificationSandbox } from "@/src/lib/feature-flags";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ ...getLocationConfiguration(), radiusEnforced: isDeliveryRadiusEnforced(), nationwideDevelopmentMode: isNationwideDevelopmentMode(), sandboxPaymentsEnabled: isDevelopmentSandboxEnabled(), sandboxNotificationsEnabled: isDevelopmentNotificationSandbox() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    let verified;
    if (typeof body.placeId === "string" && body.placeId.length <= 300) verified = await verifyAddressText(body.placeId);
    else if (typeof body.addressText === "string") verified = await verifyAddressText(body.addressText);
    else if (body.addressId !== undefined) {
      const session = await getSession();
      if (!session || session.role !== "CUSTOMER") return Response.json({ error: "Sign in to verify a saved address." }, { status: 401 });
      const { db } = await import("@/src/prisma/db");
      const address = await db.orm.public.Address.where({ id: Number(body.addressId), userId: session.userId }).first();
      if (!address) return Response.json({ error: "Saved address not found." }, { status: 404 });
      verified = address.latitude != null && address.longitude != null
        ? await verifyCoordinates(address.latitude, address.longitude)
        : await verifyAddressText(`${address.addressLine1}${address.addressLine2 ? ` ${address.addressLine2}` : ""}, ${address.postalCode ?? ""} ${address.city}, Finland`);
    } else if (typeof body.latitude === "number" && typeof body.longitude === "number") verified = await verifyCoordinates(body.latitude, body.longitude);
    else return Response.json({ error: "Choose a verified address or use your current location." }, { status: 400 });
    const result = await resolveLocation(verified);
    // Address confirmation is separate from delivery eligibility. Customers
    // can save a valid Finnish address before a nearby kitchen is ready;
    // catalog and checkout still fail closed for missing route data.
    return Response.json({ ...result, radiusEnforced: isDeliveryRadiusEnforced(), nationwideDevelopmentMode: isNationwideDevelopmentMode() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't verify this address. Please try again.";
    const status = message.includes("not available in this country") || message.includes("not available at this address") ? 422 : message.includes("not configured") || message.includes("Geoapify rejected") || message === ROUTING_UNAVAILABLE_MESSAGE ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
