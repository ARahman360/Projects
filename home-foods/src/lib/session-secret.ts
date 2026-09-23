import { createHash } from "node:crypto";

/** Resolves a stable server-side signing key; never expose this to browser code. */
export function getSessionSigningSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "development" && process.env.DATABASE_URL) {
    return createHash("sha256")
      .update("homefoods-development-session-v1\0")
      .update(process.env.DATABASE_URL)
      .digest("base64url");
  }
  throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters.");
}
