import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";
import { isSameOriginRequest } from "@/src/lib/request-security";
import { isLocationServiceUnavailableMessage } from "@/src/lib/location";
import { addressStatus, getSavedAddress, preserveAddressHistory, verifiedAddressDraft } from "@/src/lib/saved-addresses";
import { isSandboxAddressFallbackEnabled } from "@/src/lib/feature-flags";
import { normalized } from "@/src/lib/address-policy";

export const runtime = "nodejs";
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to view saved addresses.", 401);
  if (session.role !== "CUSTOMER") return jsonError("Addresses are available for customer accounts.", 403);
  try {
    const addresses = await db.orm.public.Address.where({ userId: session.userId, isArchived: false }).orderBy(a => a.createdAt.desc()).all();
    return Response.json({ addresses: addresses.map(a => ({ ...a, status: addressStatus(a) })), sandboxAddressFallback: isSandboxAddressFallbackEnabled() });
  } catch { return jsonError("Saved addresses are unavailable.", 503); }
}
async function mutate(request: Request, method: "POST" | "PATCH" | "DELETE") {
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.", 403);
  const session = await getSession();
  if (!session) return jsonError("Sign in to manage addresses.", 401);
  if (session.role !== "CUSTOMER") return jsonError("Addresses are available for customer accounts.", 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const existing = method !== "POST" ? await getSavedAddress(Number(body.id), session.userId) : null;
    if (method !== "POST" && !existing) return jsonError("Saved address not found.", 404);
    const unchanged = existing && addressStatus(existing) === "verified" && normalized(String(body.addressLine1 ?? "")) === normalized(existing.addressLine1) && normalized(String(body.city ?? "")) === normalized(existing.city) && body.postalCode === existing.postalCode && (!body.countryCode || body.countryCode === "FI");
    const draft = method === "DELETE" || body.action === "default" ? null : unchanged
      ? { addressLine1: existing.addressLine1, city: existing.city, postalCode: existing.postalCode, latitude: existing.latitude, longitude: existing.longitude, countryCode: existing.countryCode, verificationSource: existing.verificationSource, verificationHash: existing.verificationHash, verifiedAt: existing.verifiedAt, label: String(body.label ?? "").trim().slice(0,40) || null, addressLine2: String(body.addressLine2 ?? "").trim().slice(0,150) || null }
      : await verifiedAddressDraft(body);
    const address = await db.transaction(async tx => {
      await tx.orm.public.User.where({ id: session.userId }).update({ updatedAt: new Date().toISOString() });
      if (existing) {
        const current = await tx.orm.public.Address.where({ id: existing.id, userId: session.userId, isArchived: false }).first();
        if (!current) throw new Error("This saved address was removed. Choose another address.");
        if (method === "DELETE") {
          await tx.orm.public.Address.where({ id: current.id, userId: session.userId }).update({ isArchived: true, isDefault: false });
          if (current.isDefault) {
            const replacement = await tx.orm.public.Address.where({ userId: session.userId, isArchived: false }).orderBy(a => a.createdAt.desc()).first();
            if (replacement) await tx.orm.public.Address.where({ id: replacement.id }).update({ isDefault: true });
          }
          return null;
        }
        if (body.action === "default") {
          await tx.orm.public.Address.where({ userId: session.userId }).update({ isDefault: false });
          return tx.orm.public.Address.where({ id: current.id }).update({ isDefault: true });
        }
        await preserveAddressHistory(tx, current);
        return tx.orm.public.Address.where({ id: current.id, userId: session.userId }).update(draft!);
      }
      const first = !(await tx.orm.public.Address.where({ userId: session.userId, isArchived: false }).first());
      const isDefault = first || body.isDefault === true;
      if (isDefault) await tx.orm.public.Address.where({ userId: session.userId }).update({ isDefault: false });
      return tx.orm.public.Address.create({ ...draft!, userId: session.userId, isDefault });
    });
    return Response.json({ address: address ? { ...address, status: addressStatus(address) } : null, removedId: method === "DELETE" ? existing?.id : undefined }, { status: method === "POST" ? 201 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't save this address.";
    return jsonError(message, isLocationServiceUnavailableMessage(message) ? 503 : 422);
  }
}
export const POST = (request: Request) => mutate(request, "POST");
export const PATCH = (request: Request) => mutate(request, "PATCH");
export const DELETE = (request: Request) => mutate(request, "DELETE");
