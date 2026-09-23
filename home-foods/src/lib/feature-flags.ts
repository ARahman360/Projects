/**
 * Explicit, development-only switches for the fictional nationwide test market.
 * Production always enforces the configured delivery rules regardless of env values.
 */
export function isNationwideDevelopmentMode() {
  return process.env.NODE_ENV === "development"
    && process.env.HOMEFOODS_ENABLE_TEST_DATA === "true"
    && process.env.HOMEFOODS_NATIONWIDE_TESTING === "true"
    && process.env.ENFORCE_DELIVERY_RADIUS === "false"
    && explicitlyIsolatedDevelopmentDatabase();
}
export function isDeliveryRadiusEnforced() {
  return !isNationwideDevelopmentMode();
}

export function isDevelopmentSandboxEnabled() {
  return process.env.NODE_ENV === "development" && process.env.HOMEFOODS_ENABLE_TEST_DATA === "true" && process.env.HOMEFOODS_SANDBOX_PAYMENTS === "true";
}

export function isDevelopmentNotificationSandbox() {
  return process.env.NODE_ENV === "development" && process.env.HOMEFOODS_ENABLE_TEST_DATA === "true" && process.env.HOMEFOODS_SANDBOX_NOTIFICATIONS === "true";
}

export function isDevelopmentTestSeller(seller: { email?: string | null; name?: string | null } | null | undefined) {
  return Boolean(seller?.email?.toLowerCase().endsWith("@homefoods.test") && seller.name?.startsWith("[TEST]"));
}

/**
 * Existing seller accounts can be exposed to the private nationwide development
 * storefront only after an explicit local environment opt-in. Production and
 * normal radius-enforced mode always keep the fixture-only boundary.
 */
export function isNationwideDevelopmentSeller(seller: { email?: string | null; name?: string | null } | null | undefined) {
  return isDevelopmentTestSeller(seller)
    || (isNationwideDevelopmentMode() && process.env.HOMEFOODS_INCLUDE_EXISTING_SELLERS_IN_DEVELOPMENT === "true");
}
function explicitlyIsolatedDevelopmentDatabase() {
  try {
    const host = new URL(process.env.DATABASE_URL ?? "").hostname.toLowerCase();
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
    return isLocal || process.env.HOMEFOODS_ALLOW_REMOTE_NATIONWIDE_TESTING === "true";
  } catch {
    return false;
  }
}
