import "./load-next-env";
import { db } from "../src/prisma/db";
import { kitchens, planSeeds } from "../src/data/dev-marketplace";

async function main() {
  const url = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== "development" || process.env.HOMEFOODS_ENABLE_TEST_SEED !== "true" || process.env.HOMEFOODS_ENABLE_TEST_DATA !== "true") {
    throw new Error("Refusing fixture repair: explicitly enable the development test seed and test data.");
  }
  if (!url) throw new Error("DATABASE_URL is required.");
  const host = new URL(url).hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.HOMEFOODS_ALLOW_REMOTE_TEST_SEED !== "true") {
    throw new Error(`Refusing remote database '${host}' without explicit development database opt-in.`);
  }

  const verifiedKitchens: Array<{ index: number; shopId: number }> = [];
  for (const [index, kitchen] of kitchens.entries()) {
    const email = `seller${String(index + 1).padStart(2, "0")}@homefoods.test`;
    const user = await db.orm.public.User.where({ email }).first();
    if (!user || user.role !== "SELLER" || !user.name?.startsWith("[TEST]")) {
      throw new Error(`Expected an existing fictional seller account for ${email}; no account changes were made.`);
    }
    const shop = await db.orm.public.Shop.where({ sellerId: user.id }).first();
    if (!shop || shop.name !== kitchen.name || !shop.description?.includes("Fictional development seller")) {
      throw new Error(`Kitchen ownership/fixture check failed for ${email}; no records were changed for this seller.`);
    }
    verifiedKitchens.push({ index, shopId: shop.id });
  }

  let created = 0;
  let skipped = 0;
  for (const { index, shopId } of verifiedKitchens) {
    for (const seed of planSeeds) {
      const existing = await db.orm.public.SubscriptionPlan.where({ shopId, name: seed.name }).first();
      if (existing) { skipped++; continue; }
      await db.orm.public.SubscriptionPlan.create({
        shopId,
        name: seed.name,
        description: `${seed.description} Fictional test plan; no payment is taken by the seed.`,
        type: seed.type,
        price: seed.price + (index % 4) * 3,
        currency: "EUR",
        mealsPerPeriod: seed.meals,
        isActive: true,
      });
      created++;
    }
  }
  console.log(JSON.stringify({ repair: "additive fictional seller meal plans", databaseHost: host, created, alreadyPresent: skipped, sellerKitchensChecked: kitchens.length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Fixture plan repair failed.");
  process.exitCode = 1;
}).finally(async () => { await db.close(); });
