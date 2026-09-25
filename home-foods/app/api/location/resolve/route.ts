import { getSession } from "@/src/lib/auth";
import { getLocationConfiguration, isLocationServiceUnavailableMessage, resolveLocation, verifyAddressText, reverseAddressCandidate, verifySavedFinnishAddress, type VerifiedLocation } from "@/src/lib/location";
import { readLocationProof, signLocation, isSandboxAddress } from "@/src/lib/address-policy";
import { isDeliveryRadiusEnforced, isNationwideDevelopmentMode, isDevelopmentSandboxEnabled, isDevelopmentNotificationSandbox, isSandboxAddressFallbackEnabled } from "@/src/lib/feature-flags";
import { getSavedAddress } from "@/src/lib/saved-addresses";

export const runtime = "nodejs";
export async function GET() {
  return Response.json({ ...getLocationConfiguration(), radiusEnforced: isDeliveryRadiusEnforced(), nationwideDevelopmentMode: isNationwideDevelopmentMode(), sandboxPaymentsEnabled: isDevelopmentSandboxEnabled(), sandboxNotificationsEnabled: isDevelopmentNotificationSandbox(), sandboxAddressFallback: isSandboxAddressFallbackEnabled() });
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    let verified: VerifiedLocation;
    const proof = readLocationProof(body.verificationToken);
    if (proof) verified = proof as VerifiedLocation;
    else if (body.addressId !== undefined) {
      const session = await getSession();
      if (!session || session.role !== "CUSTOMER") return Response.json({ error: "Sign in to verify a saved address." }, { status: 401 });
      const address = await getSavedAddress(Number(body.addressId), session.userId);
      if (!address) return Response.json({ error: "Saved address not found. Choose another address." }, { status: 404 });
      if (isSandboxAddress(address) && isSandboxAddressFallbackEnabled()) return Response.json({ ...address, formattedAddress: `${address.addressLine1}, ${address.postalCode} ${address.city}, Finland`, sandbox: true, deliverable: true, nationwideDevelopmentMode: true });
      verified = await verifySavedFinnishAddress(address);
    } else if (typeof body.addressText === "string") verified = await verifyAddressText(body.addressText);
    else if (typeof body.latitude === "number" && typeof body.longitude === "number") verified = await reverseAddressCandidate(body.latitude, body.longitude);
    else return Response.json({ error: "Choose an address or use your current location." }, { status: 400 });
    // Lookup remains useful during a routing outage; checkout checks coverage separately.
    let coverage = { deliverable: false, nearbyKitchens: 0, nearestKitchenKm: null as number | null, coverageError: "" };
    if (!body.candidateOnly) {
      try { coverage = { ...coverage, ...await resolveLocation(verified) }; }
      catch { coverage.coverageError = "Delivery availability will be checked at checkout."; }
    }
    return Response.json({ ...verified, ...coverage, verificationToken: signLocation(verified), radiusEnforced: isDeliveryRadiusEnforced(), nationwideDevelopmentMode: isNationwideDevelopmentMode() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't verify this address. Please try again.";
    return Response.json({ error: message }, { status: isLocationServiceUnavailableMessage(message) ? 503 : 422 });
  }
}
