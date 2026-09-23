import "./load-next-env";
import { hashPassword } from "../src/lib/auth";
import { db } from "../src/prisma/db";

async function main() {
  const url = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== "development" || process.env.HOMEFOODS_ENABLE_TEST_SEED !== "true" || process.env.HOMEFOODS_ENABLE_TEST_DATA !== "true") throw new Error("Refusing to update accounts without development mode, HOMEFOODS_ENABLE_TEST_SEED=true and HOMEFOODS_ENABLE_TEST_DATA=true.");
  if (!url) throw new Error("DATABASE_URL is required.");
  const host = new URL(url).hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.HOMEFOODS_ALLOW_REMOTE_TEST_SEED !== "true") throw new Error(`Refusing non-local database '${host}' without explicit remote development confirmation.`);

  const fixtures = [
    { email: "admin@homefoods.test", role: "ADMIN" },
    ...Array.from({ length: 4 }, (_, index) => ({ email: `customer${index + 1}@homefoods.test`, role: "CUSTOMER" })),
    ...Array.from({ length: 3 }, (_, index) => ({ email: `rider${index + 1}@homefoods.test`, role: "RIDER" })),
    ...Array.from({ length: 40 }, (_, index) => ({ email: `seller${String(index + 1).padStart(2, "0")}@homefoods.test`, role: "SELLER" })),
  ];
  const passwordHash = await hashPassword("password");
  let updated = 0;
  for (const fixture of fixtures) {
    const user = await db.orm.public.User.where((row) => row.email.eq(fixture.email)).first();
    if (!user) continue;
    if (user.role !== fixture.role || !user.name?.startsWith("[TEST]")) throw new Error(`Refusing to alter non-fixture account ${fixture.email}.`);
    await db.orm.public.User.where({ id: user.id }).update({ password: passwordHash });
    updated++;
  }
  console.log(`Updated password hashes for ${updated} existing [TEST] fixture accounts on confirmed development database ${host}. No accounts or other user data were deleted or changed.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
