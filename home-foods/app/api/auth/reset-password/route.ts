import { createHash } from "node:crypto";
import { db } from "@/src/prisma/db";
import { hashPassword, jsonError } from "@/src/lib/auth";
import { isSameOriginRequest } from "@/src/lib/request-security";

export const runtime = "nodejs";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin could not be verified.", 403);
  try {
    const body = await request.json() as { token?: unknown; password?: unknown };
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (token.length < 32 || token.length > 128) return jsonError("This reset link is invalid or has expired.", 400);
    if (password.length < 10 || password.length > 200) return jsonError("Use a password between 10 and 200 characters.", 400);
    const tokenHash = hashToken(token);
    const passwordHash = await hashPassword(password);
    const applied = await db.transaction(async (tx) => {
      const plan = tx.sql.public.passwordResetToken.delete()
        .where((fields, fns) => fns.and(fns.eq(fields.tokenHash, tokenHash), fns.gt(fields.expiresAt, new Date().toISOString())))
        .returning("userId")
        .build();
      const consumed = await tx.query(plan) as Array<{ userId: number }>;
      const reset = consumed[0];
      if (!reset) return false;
      await tx.orm.public.User.where({ id: reset.userId }).update({ password: passwordHash });
      await tx.orm.public.PasswordResetToken.where({ userId: reset.userId }).delete();
      return true;
    });
    if (!applied) return jsonError("This reset link is invalid or has expired. Request a new one.", 400);
    return Response.json({ success: true, message: "Your password has been updated. You can sign in now." });
  } catch (error) {
    console.error("Password reset failed", error);
    return jsonError("Password reset is temporarily unavailable. Please try again later.", 503);
  }
}
