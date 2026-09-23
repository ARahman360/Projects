import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { getSessionSigningSecret } from "./session-secret";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "home-foods-session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 7;

export type UserRole = "CUSTOMER" | "SELLER" | "RIDER" | "ADMIN";
export type Session = { userId: number; role: UserRole; email: string; name: string | null; expiresAt: number };

function secret() {
  return getSessionSigningSecret();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export async function setSession(user: Omit<Session, "expiresAt">) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_AGE_SECONDS;
  const payload = Buffer.from(JSON.stringify({ ...user, expiresAt })).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_AGE_SECONDS,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const supplied = Buffer.from(signature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    if (!Number.isInteger(session.userId) || !["CUSTOMER", "SELLER", "RIDER", "ADMIN"].includes(session.role)) return null;
    return session;
  } catch {
    return null;
  }
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
