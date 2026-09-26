import { db } from "@/src/prisma/db";
import { getSession, jsonError } from "@/src/lib/auth";
import { isSameOriginRequest } from "@/src/lib/request-security";
import { reasonError } from "@/src/lib/workspace-policy";
import { isKitchenLocationAllowed } from "@/src/lib/feature-flags";
import { assertFinnishKitchen } from "@/src/lib/location";

export const runtime = "nodejs";
class OperationError extends Error {}
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to continue.", 401);
  if (session.role !== "ADMIN") return jsonError("Administrator access required.", 403);
  try {
    const [shops, riders, customers, orders, subscriptions, reviews, activity] = await Promise.all([
      db.orm.public.Shop.include("seller", q => q.select("id", "name", "email", "phone", "accountStatus")).include("menuItems", q => q.include("options").include("category")).include("subscriptionPlans").orderBy(q => q.createdAt.desc()).all(),
      db.orm.public.Rider.include("user", q => q.select("id", "name", "email", "phone", "avatarUrl", "accountStatus", "createdAt")).all(),
      db.orm.public.User.where({ role: "CUSTOMER" }).select("id", "name", "email", "phone", "avatarUrl", "accountStatus", "createdAt").orderBy(q => q.createdAt.desc()).all(),
      db.orm.public.Order.include("shop", q => q.select("id", "name")).include("customer", q => q.select("id", "name", "email")).include("items").include("address").include("delivery").include("payment", q => q.select("id", "amount", "currency", "method", "status", "createdAt")).include("statusEvents").orderBy(q => q.createdAt.desc()).all(),
      db.orm.public.Subscription.include("customer", q => q.select("id", "name", "email")).include("plan", q => q.include("shop", s => s.select("id", "name"))).include("scheduledMeals", q => q.include("order", o => o.select("id", "orderNumber", "status")).include("events").orderBy(m => m.scheduledAt.asc())).all(),
      db.orm.public.Review.include("customer", q => q.select("id", "name")).orderBy(q => q.createdAt.desc()).all(),
      db.orm.public.AdminAuditLog.orderBy(q => q.createdAt.desc()).limit(500).all(),
    ]);
    return Response.json({ shops, riders, customers, orders, subscriptions, reviews, activity, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { console.error("Operations read failed", error); return jsonError("Management data could not be loaded. Please retry.", 503); }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.", 403);
  const session = await getSession();
  if (!session) return jsonError("Sign in to continue.", 401);
  if (session.role !== "ADMIN") return jsonError("Administrator access required.", 403);
  try {
    const body = await request.json();
    const id = Number(body.id), action = String(body.action);
    if (!Number.isSafeInteger(id) || id < 1) return jsonError("Choose a valid record.", 422);
    const invalidReason = reasonError(body.reason);
    if (invalidReason) return jsonError(invalidReason, 422);
    const reason = body.reason.trim();
    await db.transaction(async tx => {
      if (["approve-kitchen", "reject-kitchen", "suspend-kitchen", "reactivate-kitchen", "edit-kitchen"].includes(action)) {
        const shop = await tx.orm.public.Shop.where({ id }).first();
        if (!shop) throw new OperationError("Kitchen not found.");
        const statuses: Record<string, string[]> = { "approve-kitchen": ["PENDING"], "reject-kitchen": ["PENDING"], "suspend-kitchen": ["ACTIVE"], "reactivate-kitchen": ["SUSPENDED", "CLOSED"], "edit-kitchen": ["PENDING", "ACTIVE", "SUSPENDED", "CLOSED"] };
        if (!statuses[action].includes(shop.status)) throw new OperationError("The kitchen status changed. Refresh before trying again.");
        const status = action === "reject-kitchen" ? "CLOSED" : action === "suspend-kitchen" ? "SUSPENDED" : action === "edit-kitchen" ? shop.status : "ACTIVE";
        if (status === "ACTIVE" && action !== "edit-kitchen") {
          const seller = await tx.orm.public.User.where({ id: shop.sellerId }).first();
          if (seller?.accountStatus !== "ACTIVE" || !shop.address || !shop.city || shop.latitude == null || shop.longitude == null || !isKitchenLocationAllowed(shop.address)) throw new OperationError("An active seller and a registered permitted kitchen location are required before approval.");
          await assertFinnishKitchen(shop);
        }
        const changes = action === "edit-kitchen" ? { description: String(body.description ?? "").trim().slice(0, 1000) } : { status: status as "ACTIVE" | "SUSPENDED" | "CLOSED" };
        const updated = await tx.execute(tx.sql.public.shop.update({...changes,updatedAt:new Date().toISOString()}).where((f,fn)=>fn.and(fn.eq(f.id,id),fn.eq(f.status,shop.status))).build());
        if (!updated.affectedRows) throw new OperationError("Kitchen changed. Refresh and retry.");
        await tx.orm.public.AdminAuditLog.create({ actorId: session.userId, entityType: "KITCHEN", entityId: id, action, reason, previousValue: action === "edit-kitchen" ? shop.description : shop.status, nextValue: action === "edit-kitchen" ? changes.description : status });
      } else if (["suspend-account", "reactivate-account", "verify-rider"].includes(action)) {
        const user = await tx.orm.public.User.where({ id }).first();
        if (!user || !["CUSTOMER", "RIDER"].includes(user.role)) throw new OperationError("Only customer and rider accounts can be managed here.");
        if (action === "verify-rider") {
          if (user.role !== "RIDER") throw new OperationError("This account is not a rider.");
          await tx.orm.public.Rider.where({ userId: id }).update({ isVerified: true });
        } else {
          await tx.orm.public.User.where({ id }).update({ accountStatus: action === "suspend-account" ? "SUSPENDED" : "ACTIVE" });
          if (user.role === "RIDER") await tx.orm.public.Rider.where({ userId: id }).update({ isAvailable: false });
        }
        await tx.orm.public.AdminAuditLog.create({ actorId: session.userId, entityType: user.role, entityId: id, action, reason, previousValue: user.accountStatus, nextValue: action === "verify-rider" ? "VERIFIED" : action === "suspend-account" ? "SUSPENDED" : "ACTIVE" });
      } else throw new OperationError("This administrative action is not supported.");
    });
    return Response.json({ success: true });
  } catch (error) { if (error instanceof OperationError) return jsonError(error.message,409); console.error("Administrative change failed",error); return jsonError("The action could not be saved. Please refresh and retry.",503); }
}
