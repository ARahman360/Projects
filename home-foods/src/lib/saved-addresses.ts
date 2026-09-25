import { db } from "@/src/prisma/db";
import { isSandboxAddress, isVerifiedAddress, normalized, readLocationProof, validateAddressFields, verificationFields, type AddressFields } from "./address-policy";
import { isSandboxAddressFallbackEnabled } from "./feature-flags";
import { verifyAddressText, verifySavedFinnishAddress, type VerifiedLocation } from "./location";

export function addressStatus(address: AddressFields) {
  return isVerifiedAddress(address) ? "verified" : isSandboxAddress(address) ? "sandbox" : "unverified";
}
export async function verifiedAddressDraft(body: Record<string, unknown>) {
  const draft = {
    addressLine1: String(body.addressLine1 ?? "").trim(), addressLine2: String(body.addressLine2 ?? "").trim().slice(0, 150) || null,
    city: String(body.city ?? "").trim(), postalCode: String(body.postalCode ?? "").trim(), countryCode: String(body.countryCode ?? "FI").toUpperCase(),
    label: String(body.label ?? "").trim().slice(0, 40) || null,
  };
  validateAddressFields(draft);
  if (body.sandboxConfirmation === true) {
    if (!isSandboxAddressFallbackEnabled()) throw new Error("Sandbox address entry is unavailable here.");
    const sandbox = { ...draft, latitude: null, longitude: null };
    return { ...sandbox, ...verificationFields(sandbox, "SANDBOX") };
  }
  const proof = readLocationProof(body.verificationToken);
  let verified: VerifiedLocation;
  if (proof && proof.houseNumber && typeof proof.latitude === "number" && typeof proof.longitude === "number" && normalized(String(proof.addressLine1)) === normalized(draft.addressLine1)
      && normalized(String(proof.city)) === normalized(draft.city) && proof.postalCode === draft.postalCode) {
    verified = proof as VerifiedLocation;
  } else {
    verified = await verifyAddressText(`${draft.addressLine1}, ${draft.postalCode} ${draft.city}, Finland`);
    const street = normalized(draft.addressLine1), match = normalized(verified.addressLine1);
    if (!(street === match || street.startsWith(`${match} `)) || normalized(draft.city) !== normalized(verified.city) || draft.postalCode !== verified.postalCode) {
      throw new Error("The address differs from the provider's result. Search and select the matching address, then confirm it.");
    }
  }
  const confirmed = { ...draft, latitude: verified.latitude, longitude: verified.longitude };
  return { ...confirmed, ...verificationFields(confirmed) };
}
export type AddressTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Copy old details before edits so historical orders and subscriptions retain them. */
export async function preserveAddressHistory(tx: AddressTransaction, address: NonNullable<Awaited<ReturnType<typeof getSavedAddress>>>) {
  const orders = await tx.orm.public.Order.where({ addressId: address.id }).select("id").all();
  const subscriptions = await tx.orm.public.Subscription.where({ addressId: address.id }).select("id").all();
  if (!orders.length && !subscriptions.length) return;
  const fields = { userId: address.userId, type: address.type, label: address.label, addressLine1: address.addressLine1, addressLine2: address.addressLine2, city: address.city, postalCode: address.postalCode, latitude: address.latitude, longitude: address.longitude, countryCode: address.countryCode, verificationSource: address.verificationSource, verificationHash: address.verificationHash, verifiedAt: address.verifiedAt };
  const snapshot = await tx.orm.public.Address.create({ ...fields, isDefault: false, isArchived: true });
  for (const order of orders) await tx.orm.public.Order.where({ id: order.id }).update({ addressId: snapshot.id });
  for (const subscription of subscriptions) await tx.orm.public.Subscription.where({ id: subscription.id }).update({ addressId: snapshot.id });
}
export const getSavedAddress = (id: number, userId: number) => db.orm.public.Address.where({ id, userId, isArchived: false }).first();

export async function resolveSavedDeliveryAddress(id: number, userId: number) {
  const saved = await getSavedAddress(id, userId);
  if (!saved) throw new Error("This saved address was removed or is unavailable. Choose another address.");
  if (isSandboxAddress(saved)) {
    if (!isSandboxAddressFallbackEnabled()) throw new Error("Sandbox addresses cannot be used for real delivery. Choose a verified Finnish address.");
    return saved;
  }
  await verifySavedFinnishAddress(saved);
  const refreshed = await getSavedAddress(id, userId);
  if (!refreshed || !isVerifiedAddress(refreshed)) throw new Error("Choose a verified Finnish address before ordering.");
  return refreshed;
}
