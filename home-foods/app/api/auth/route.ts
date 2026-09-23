import { db } from "@/src/prisma/db";
import { clearSession, getSession, hashPassword, jsonError, setSession, verifyPassword } from "@/src/lib/auth";
import { isSameOriginRequest } from "@/src/lib/request-security";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ user: null });
  const { userId, role, email, name } = session;
  try {
    const profile = await db.orm.public.User.select("id", "name", "email", "role", "avatarUrl").where({ id: userId }).first();
    if (profile) return Response.json({ user: profile });
  } catch (error) { console.error("Profile lookup failed", error); }
  return Response.json({ user: { id: userId, role, email, name, avatarUrl: null } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.", 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const intent = body.intent === "signup" ? "signup" : "login";
    const role = body.role === "SELLER" || body.role === "RIDER" ? body.role : "CUSTOMER";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return jsonError("Enter a valid email address.");
    const isDevelopmentFixtureLogin = process.env.NODE_ENV === "development" && intent === "login" && email.endsWith("@homefoods.test") && password === "password";
    if ((password.length < 10 && !isDevelopmentFixtureLogin) || password.length > 200) return jsonError("Use a password between 10 and 200 characters.");

    if (intent === "login") {
      if (process.env.NODE_ENV !== "development" && email.endsWith("@homefoods.test")) return jsonError("Email or password is incorrect.", 401);
      const user = await db.orm.public.User.where((row) => row.email.eq(email)).first();
      if (isDevelopmentFixtureLogin && !user?.name?.startsWith("[TEST]")) return jsonError("Email or password is incorrect.", 401);
      if (!user || !(await verifyPassword(password, user.password))) return jsonError("Email or password is incorrect.", 401);
      // Rider availability belongs to the account, not a browser session. Every
      // new login starts offline so an old or parallel session can't receive jobs.
      if (user.role === "RIDER") {
        const rider = await db.orm.public.Rider.where({ userId: user.id }).first();
        if (rider?.isAvailable) await db.orm.public.Rider.where({ id: rider.id }).update({ isAvailable: false });
      }
      await setSession({ userId: user.id, role: user.role, email: user.email, name: user.name });
      return Response.json({ user: { id: user.id, role: user.role, email: user.email, name: user.name } });
    }

    if (name.length < 2 || name.length > 90) return jsonError("Add your name to create an account.");
    if (role === "SELLER" && (typeof body.shopName !== "string" || body.shopName.trim().length < 2)) return jsonError("Add a name for your home kitchen.");
    const passwordHash = await hashPassword(password);
    const user = await db.transaction(async (tx) => {
      const created = await tx.orm.public.User.select("id", "role", "email", "name").create({ email, password: passwordHash, name, role });
      if (role === "SELLER") {
        await tx.orm.public.Shop.create({ sellerId: created.id, name: (body.shopName as string).trim(), description: "", city: typeof body.city === "string" ? body.city.trim() : null, status: "PENDING" });
      }
      if (role === "RIDER") await tx.orm.public.Rider.create({ userId: created.id, isAvailable: false });
      return created;
    });
    await setSession({ userId: user.id, role: user.role, email: user.email, name: user.name });
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete sign in.";
    if (message.includes("SESSION_SECRET")) return jsonError("Set SESSION_SECRET in your environment before signing in.", 503);
    if (message.toLowerCase().includes("unique") || message.toLowerCase().includes("duplicate")) return jsonError("An account with that email already exists.", 409);
    console.error("Authentication request failed", error);
    return jsonError("The account service is unavailable. Check the database connection and migrations.", 503);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.", 403);
  const session = await getSession();
  if (session?.role === "RIDER") {
    try {
      const rider = await db.orm.public.Rider.where({ userId: session.userId }).first();
      if (rider?.isAvailable) await db.orm.public.Rider.where({ id: rider.id }).update({ isAvailable: false });
      // Assigned deliveries intentionally remain attached and keep their status
      // so an administrator can recover them without losing operational history.
    } catch (error) {
      console.error("Rider sign-out availability update failed", error);
      return jsonError("We couldn't safely sign you out. Please retry.", 503);
    }
  }
  await clearSession();
  return Response.json({ success: true });
}
