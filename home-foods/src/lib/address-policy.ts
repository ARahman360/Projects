import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getSessionSigningSecret } from "./session-secret";

export type AddressFields = {
  addressLine1: string; addressLine2?: string | null; city: string; postalCode?: string | null;
  countryCode?: string | null; latitude?: number | null; longitude?: number | null;
  verificationSource?: string | null; verificationHash?: string | null; verifiedAt?: string | null;
};
export const normalized = (value: string | null | undefined) => (value ?? "").trim().normalize("NFKC").toLocaleLowerCase("fi").replace(/\s+/g, " ");
export function addressFingerprint(address: AddressFields) {
  return createHash("sha256").update(JSON.stringify([normalized(address.addressLine1), normalized(address.city), address.postalCode?.trim() ?? "", address.countryCode?.toUpperCase(), address.latitude ?? null, address.longitude ?? null, address.verificationSource])).digest("hex");
}
export function isVerifiedAddress(address: AddressFields) {
  return address.countryCode === "FI" && address.verificationSource === "GEOAPIFY" && !!address.verifiedAt
    && address.verificationHash === addressFingerprint(address)
    && typeof address.latitude === "number" && Number.isFinite(address.latitude) && Math.abs(address.latitude) <= 90
    && typeof address.longitude === "number" && Number.isFinite(address.longitude) && Math.abs(address.longitude) <= 180;
}
export function isSandboxAddress(address: AddressFields) {
  return address.countryCode === "FI" && address.verificationSource === "SANDBOX" && address.verificationHash === addressFingerprint(address);
}
export function verificationFields(address: AddressFields, source = "GEOAPIFY") {
  const fields = { ...address, countryCode: "FI", verificationSource: source };
  return { countryCode: "FI", verificationSource: source, verificationHash: addressFingerprint(fields), verifiedAt: source === "GEOAPIFY" ? new Date().toISOString() : null };
}
export function validateAddressFields(address: AddressFields) {
  if (address.countryCode && address.countryCode.toUpperCase() !== "FI") throw new Error("Sorry, Home Foods is not available in this country. We currently deliver only within Finland.");
  if (address.addressLine1.trim().length < 5 || address.addressLine1.length > 150 || !/\d/.test(address.addressLine1)) throw new Error("Street address: add the street name and building number.");
  if (address.city.trim().length < 2 || address.city.length > 80) throw new Error("City: enter your Finnish city or municipality.");
  if (!/^\d{5}$/.test(address.postalCode?.trim() ?? "")) throw new Error("Postal code: enter all five digits, including any leading zero.");
}
/** A short-lived proof of a provider response, never proof supplied by the browser itself. */
export function signLocation(location: Record<string, unknown>) {
  const payload = Buffer.from(JSON.stringify({ location, expires: Date.now() + 15 * 60_000 })).toString("base64url");
  const signature = createHmac("sha256", getSessionSigningSecret()).update(`location-v1:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}
export function readLocationProof(token: unknown): Record<string, unknown> | null {
  if (typeof token !== "string" || token.length > 8000) return null;
  try {
    const [payload, signature] = token.split(".");
    const expected = createHmac("sha256", getSessionSigningSecret()).update(`location-v1:${payload}`).digest();
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    return parsed.expires > Date.now() && parsed.location?.countryCode === "FI" ? parsed.location : null;
  } catch { return null; }
}
