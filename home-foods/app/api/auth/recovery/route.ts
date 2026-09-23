import { randomBytes, createHash } from "node:crypto";
import { db } from "@/src/prisma/db";
import { jsonError } from "@/src/lib/auth";
import { isSameOriginRequest } from "@/src/lib/request-security";
import { isDevelopmentNotificationSandbox } from "@/src/lib/feature-flags";

export const runtime = "nodejs";

const genericMessage = "If an account matches that email, password-reset instructions will be sent shortly.";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.", 403);
  try {
    const body = await request.json() as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return Response.json({ success: true, message: genericMessage });
    const user = await db.orm.public.User.where({ email }).select("id", "email").first();
    if (!user) return Response.json({ success: true, message: genericMessage });

    const recentTokens = await db.orm.public.PasswordResetToken.where({ userId: user.id }).orderBy((token) => token.createdAt.desc()).limit(6).all();
    const nowMs = Date.now();
    if (recentTokens.some((token) => nowMs - new Date(token.createdAt).getTime() < 60_000) || recentTokens.filter((token) => nowMs - new Date(token.createdAt).getTime() < 60 * 60_000).length >= 5) {
      return Response.json({ success: true, message: genericMessage });
    }

    const token = randomBytes(32).toString("base64url");
    if (isDevelopmentNotificationSandbox()) {
      const fixture = email.endsWith("@homefoods.test")
        ? await db.orm.public.User.where({ id: user.id }).select("id", "email", "name").first()
        : null;
      if (!fixture?.name?.startsWith("[TEST]")) return Response.json({ success: true, message: genericMessage });
      await db.orm.public.PasswordResetToken.create({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(nowMs + 30 * 60_000).toISOString() });
      const resetUrl = new URL("/reset-password", process.env.APP_URL || new URL(request.url).origin);
      resetUrl.searchParams.set("token", token);
      return Response.json({ success: true, message: "Development notification sandbox: use this local reset link to continue.", developmentResetUrl: resetUrl.toString() });
    }
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) return jsonError("Password recovery is temporarily unavailable. Please try again later.", 503);
    const record = await db.orm.public.PasswordResetToken.create({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(nowMs + 30 * 60_000).toISOString() });
    const baseUrl = process.env.APP_URL || new URL(request.url).origin;
    const resetUrl = new URL("/reset-password", baseUrl);
    resetUrl.searchParams.set("token", token);
    const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [user.email], subject: "Reset your HomeFoods password", text: `Use this link to reset your HomeFoods password. It expires in 30 minutes and works once: ${resetUrl.toString()}\n\nIf you did not ask to reset your password, you can ignore this email.` }) });
    if (!sent.ok) {
      await db.orm.public.PasswordResetToken.where({ id: record.id }).delete();
      console.error("Password recovery email was rejected", sent.status);
      return jsonError("Password recovery is temporarily unavailable. Please try again later.", 503);
    }
    return Response.json({ success: true, message: genericMessage });
  } catch (error) {
    console.error("Password recovery request failed", error);
    return jsonError("Password recovery is temporarily unavailable. Please try again later.", 503);
  }
}
