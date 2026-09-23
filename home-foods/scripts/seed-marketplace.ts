import "./load-next-env";
import { hashPassword } from "../src/lib/auth";
import { db } from "../src/prisma/db";
import { cuisineMenus, fictionalKitchenCoordinates, kitchens, planSeeds } from "../src/data/dev-marketplace";

const sellerPalette = ["#355b43", "#b95f3d", "#80643c", "#536b83", "#875c71", "#477b72", "#936d38", "#65588b"];
function kitchenBadge(name: string, index: number) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const color = sellerPalette[index % sellerPalette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="42" fill="${color}"/><circle cx="80" cy="73" r="51" fill="none" stroke="#fff6e9" stroke-width="2" opacity=".72"/><path d="M44 108c18-16 54-16 72 0" fill="none" stroke="#f1bf86" stroke-width="4" stroke-linecap="round"/><text x="80" y="89" text-anchor="middle" font-family="Georgia,serif" font-size="43" font-weight="bold" fill="#fffaf0">${initials}</text><circle cx="123" cy="35" r="8" fill="#e89b69"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function dishPhoto(dishName: string, cuisine: string, category: string, lock: number) {
  const tags = [dishName, cuisine, category, "food", "meal"].map((tag) => tag.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, "").trim()).filter(Boolean).join(",");
  return `https://loremflickr.com/900/700/${encodeURIComponent(tags)}?lock=${lock}`;
}

const guard = () => {
  const url = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== "development" || process.env.HOMEFOODS_ENABLE_TEST_SEED !== "true") {
    throw new Error("Refusing to seed: set NODE_ENV=development and HOMEFOODS_ENABLE_TEST_SEED=true explicitly.");
  }
  if (!url) throw new Error("DATABASE_URL is required.");
  const host = new URL(url).hostname.toLowerCase();
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
  const remoteTestConfirmed = process.env.HOMEFOODS_ALLOW_REMOTE_TEST_SEED === "true";
  if (!isLocal && !remoteTestConfirmed) {
    throw new Error(`Refusing to seed non-local database host '${host}'. For a confirmed development database only, set HOMEFOODS_ALLOW_REMOTE_TEST_SEED=true.`);
  }
  if (process.env.HOMEFOODS_ENABLE_TEST_DATA !== "true") throw new Error("Refusing to seed without HOMEFOODS_ENABLE_TEST_DATA=true.");
  const password = "password";
  return { password, host };
};

async function getOrCreateUser(email: string, name: string, role: "CUSTOMER" | "SELLER" | "RIDER" | "ADMIN", passwordHash: string, phone: string) {
  const found = await db.orm.public.User.where((row) => row.email.eq(email)).first();
  if (found) {
    if (found.role !== role) throw new Error(`Seed account ${email} exists with a different role; refusing to change it.`);
    if (!found.name?.startsWith("[TEST]")) throw new Error(`Seed account ${email} is not marked [TEST]; refusing to alter it.`);
    await db.orm.public.User.where({ id: found.id }).update({ password: passwordHash });
    return found;
  }
  return db.orm.public.User.create({ email, name: `[TEST] ${name}`, role, password: passwordHash, phone });
}

async function main() {
  const { password, host } = guard();
  const passwordHash = await hashPassword(password);
  const customerAccounts = await Promise.all(["Aino Korhonen", "Mika Virtanen", "Sara Niemi", "Omar Hassan"].map((name, i) => getOrCreateUser(`customer${i + 1}@homefoods.test`, name, "CUSTOMER", passwordHash, `+3584500001${String(i).padStart(2, "0")}`)));
  const admin = await getOrCreateUser("admin@homefoods.test", "Development Administrator", "ADMIN", passwordHash, "+358450000100");
  void admin;
  const riderUsers = await Promise.all(["Leena Salmi", "Emil Laine", "Noora Aaltonen"].map((name, i) => getOrCreateUser(`rider${i + 1}@homefoods.test`, name, "RIDER", passwordHash, `+3584500002${String(i).padStart(2, "0")}`)));
  const riders = [];
  for (const [i, user] of riderUsers.entries()) {
    const prior = await db.orm.public.Rider.where({ userId: user.id }).first();
    riders.push(prior ?? await db.orm.public.Rider.create({ userId: user.id, isAvailable: i === 0, vehicleType: i === 2 ? "Bicycle" : "Electric bicycle", vehicleNumber: `TEST-${String(i + 1).padStart(3, "0")}` }));
  }

  const shops: Array<{ id: number; ownerId: number; key: keyof typeof cuisineMenus }> = [];
  for (const [shopIndex, kitchen] of kitchens.entries()) {
    const email = `seller${String(shopIndex + 1).padStart(2, "0")}@homefoods.test`;
    const owner = await getOrCreateUser(email, `${kitchen.name} owner`, "SELLER", passwordHash, `+3584500003${String(shopIndex).padStart(2, "0")}`);
    let shop = await db.orm.public.Shop.where({ sellerId: owner.id }).first();
    const cuisine = cuisineMenus[kitchen.key];
    const fixtureCoordinates = fictionalKitchenCoordinates(kitchen.city, shopIndex);
    if (shop && shop.name !== kitchen.name) throw new Error(`Test seller ${email} already owns a differently named kitchen; refusing to modify it.`);
    const shopDescription = `${cuisine.description} Fictional development seller in ${kitchen.city}, ${kitchen.region}. Test delivery-area fixture only. Open ${kitchen.days}; these sample hours do not represent live availability.`;
    if (!shop) {
      shop = await db.orm.public.Shop.create({
        sellerId: owner.id,
        name: kitchen.name,
        description: shopDescription,
        logoUrl: kitchenBadge(kitchen.name, shopIndex),
        coverImageUrl: cuisine.photos[1 % cuisine.photos.length],
        phone: `+3584500003${String(shopIndex).padStart(2, "0")}`,
        email,
        address: `Fictional home-kitchen delivery area · ${kitchen.city}`,
        city: kitchen.city,
        latitude: fixtureCoordinates?.latitude ?? null,
        longitude: fixtureCoordinates?.longitude ?? null,
        status: "ACTIVE",
        minimumOrder: kitchen.minOrder,
        deliveryFee: kitchen.fee,
        estimatedMinutes: kitchen.minutes,
      });
    } else if (shop.description?.includes("Fictional development seller")) {
      const patch: { description?: string; logoUrl?: string; latitude?: number | null; longitude?: number | null; city?: string | null; address?: string | null } = {};
      if (shop.description.includes("This fictional kitchen serves Lahti")) patch.description = shopDescription;
      if (shop.logoUrl?.startsWith("https://images.unsplash.com/")) patch.logoUrl = kitchenBadge(kitchen.name, shopIndex);
      const coordinatesAreFinnish = typeof shop.latitude === "number" && typeof shop.longitude === "number" && shop.latitude >= 59 && shop.latitude <= 71 && shop.longitude >= 19 && shop.longitude <= 32;
      if (!coordinatesAreFinnish && fixtureCoordinates) {
        patch.latitude = fixtureCoordinates.latitude;
        patch.longitude = fixtureCoordinates.longitude;
        patch.city = kitchen.city;
        patch.address = `Fictional home-kitchen delivery area · ${kitchen.city}`;
      }
      if (Object.keys(patch).length) shop = await db.orm.public.Shop.where({ id: shop.id }).update(patch);
    }
    if (!shop) throw new Error(`Could not load or create fixture kitchen ${kitchen.name}.`);
    shops.push({ id: shop.id, ownerId: owner.id, key: kitchen.key });

    const categories = [...new Set(cuisine.dishes.map((dish) => dish.category))];
    const categoryRows = new Map<string, number>();
    for (const [sortOrder, name] of categories.entries()) {
      let category = await db.orm.public.MenuCategory.where({ shopId: shop.id, name }).first();
      if (!category) category = await db.orm.public.MenuCategory.create({ shopId: shop.id, name, description: `${cuisine.cuisine} kitchen selection · fictional development data`, sortOrder, isActive: true });
      categoryRows.set(name, category.id);
    }

    for (const [i, dish] of cuisine.dishes.entries()) {
      let item = await db.orm.public.MenuItem.where({ shopId: shop.id, name: dish.name }).first();
      const generatedDescription = `${dish.name}, prepared in a ${cuisine.cuisine.toLowerCase()} home-cooking style. Fictional sample menu listing; ask the kitchen to verify ingredients, dietary suitability and allergens before ordering.`;
      if (!item) {
        item = await db.orm.public.MenuItem.create({
          shopId: shop.id,
          categoryId: categoryRows.get(dish.category) ?? null,
          name: dish.name,
          description: generatedDescription,
          imageUrl: dishPhoto(dish.name, cuisine.cuisine, dish.category, 10000 + shopIndex * 30 + i),
          price: Math.round((dish.price + (shopIndex % 3) * 0.65) * 100) / 100,
          isAvailable: true,
          isFeatured: i < 3,
          sortOrder: i,
        });
      } else if (item.description === generatedDescription) {
        const changes: { categoryId?: number | null; price?: number; imageUrl?: string } = {};
        const fixtureImage = dishPhoto(dish.name, cuisine.cuisine, dish.category, 10000 + shopIndex * 30 + i);
        if (item.imageUrl !== fixtureImage) changes.imageUrl = fixtureImage;
        const existingCategory = item.categoryId ? await db.orm.public.MenuCategory.where({ id: item.categoryId }).first() : null;
        if (existingCategory?.description?.includes("fictional development data") && item.categoryId !== categoryRows.get(dish.category)) changes.categoryId = categoryRows.get(dish.category) ?? null;
        const oldBroadDrinkMatch = /tea|coffee|juice|drink|soda|smoothie|lassi|lemonade|mocktail|milkshake/.test(dish.name.toLowerCase());
        const shouldBeDrink = /\b(tea|coffee|juice|drink|soda|smoothie|lassi|lemonade|mocktail|milkshake)\b/i.test(dish.name);
        const legacyDrinkPrice = Math.round((2.5 + (i % 5) * 0.6 + (shopIndex % 3) * 0.65) * 100) / 100;
        const currentMenuPrice = Math.round((dish.price + (shopIndex % 3) * 0.65) * 100) / 100;
        if (oldBroadDrinkMatch && !shouldBeDrink && item.price === legacyDrinkPrice) changes.price = currentMenuPrice;
        if (Object.keys(changes).length) await db.orm.public.MenuItem.where({ id: item.id, shopId: shop.id }).update(changes);
      }
    }

    // Stabilize imagery by actual fixture record ID so even older generated sample dishes
    // retained during menu revisions receive their own dish-specific thumbnail.
    const fixtureItems = await db.orm.public.MenuItem.where({ shopId: shop.id }).include("category").all();
    for (const item of fixtureItems) {
      if (!item.description?.includes("Fictional sample menu listing")) continue;
      const imageUrl = dishPhoto(item.name, cuisine.cuisine, item.category?.name ?? "home cooking", 20000 + shopIndex * 1000 + item.id);
      if (item.imageUrl !== imageUrl) await db.orm.public.MenuItem.where({ id: item.id, shopId: shop.id }).update({ imageUrl });
    }

    for (const planSeed of planSeeds) {
      let plan = await db.orm.public.SubscriptionPlan.where({ shopId: shop.id, name: planSeed.name }).first();
      if (!plan) plan = await db.orm.public.SubscriptionPlan.create({ shopId: shop.id, name: planSeed.name, description: `${planSeed.description} Fictional test plan; no payment is taken by the seed.`, type: planSeed.type, price: planSeed.price + (shopIndex % 4) * 3, currency: "EUR", mealsPerPeriod: planSeed.meals, isActive: true });
    }
  }

  // Keep a small, fully linked sandbox history so customer, seller, rider,
  // payment and review screens have records to exercise. No provider is called.
  const orderStates = ["PENDING", "READY_FOR_PICKUP", "PICKED_UP", "DELIVERED", "DELIVERED", "CONFIRMED"] as const;
  const deliveryStates = ["UNASSIGNED", "ASSIGNED", "PICKED_UP", "DELIVERED", "DELIVERED", "UNASSIGNED"] as const;
  const existingNumbers = await db.orm.public.Order.all();
  const existingOrderNumbers = new Set(existingNumbers.map((order) => order.orderNumber));
  const firstItemByShop = new Map<number, { id: number; name: string; price: number }>();
  for (const shop of shops) {
    const item = await db.orm.public.MenuItem.where({ shopId: shop.id }).orderBy((row) => row.sortOrder.asc()).first();
    if (item) firstItemByShop.set(shop.id, { id: item.id, name: item.name, price: item.price });
  }
  for (let i = 0; i < orderStates.length; i++) {
    const orderNumber = `HF-TEST-${String(i + 1).padStart(4, "0")}`;
    if (existingOrderNumbers.has(orderNumber)) continue;
    const shop = shops[i];
    const item = firstItemByShop.get(shop.id);
    if (!item) continue;
    const customer = customerAccounts[i % customerAccounts.length];
    const riderId = i === 1 ? riders[0].id : i === 2 ? riders[1].id : i === 3 ? riders[0].id : i === 4 ? riders[2].id : null;
    await db.transaction(async (tx) => {
      const created = await tx.orm.public.Order.create({ orderNumber, customerId: customer.id, shopId: shop.id, status: orderStates[i], subtotal: item.price, deliveryFee: 0, serviceFee: 0, discount: 0, total: item.price, notes: "Fictional local test order. No real payment or delivery." });
      await tx.orm.public.OrderItem.create({ orderId: created.id, menuItemId: item.id, name: item.name, quantity: 1, unitPrice: item.price, totalPrice: item.price });
      await tx.orm.public.Payment.create({ orderId: created.id, amount: item.price, currency: "EUR", method: "ONLINE", status: i === 3 || i === 4 ? "PAID" : "PENDING", provider: "LOCAL_TEST_SANDBOX", transactionId: `TEST-TX-${String(i + 1).padStart(4, "0")}` });
      await tx.orm.public.Delivery.create({ orderId: created.id, riderId, status: deliveryStates[i], estimatedTime: 35, pickupTime: new Date().toISOString(), pickedUpTime: i >= 2 ? new Date().toISOString() : null, deliveredTime: i === 3 || i === 4 ? new Date().toISOString() : null, notes: "Local development delivery fixture." });
      if (i === 3 || i === 4) await tx.orm.public.Review.create({ customerId: customer.id, shopId: shop.id, orderId: created.id, rating: i === 3 ? 5 : 4, comment: i === 3 ? "Fictional development review: a comforting meal and careful packing." : "Fictional development review: tasty, generous and delivered warm." });
    });
  }

  const favoriteCustomer = customerAccounts[0];
  for (const shop of shops.slice(0, 8)) {
    if (!await db.orm.public.KitchenFavorite.where({ customerId: favoriteCustomer.id, shopId: shop.id }).first()) await db.orm.public.KitchenFavorite.create({ customerId: favoriteCustomer.id, shopId: shop.id });
    const item = firstItemByShop.get(shop.id);
    if (item && !await db.orm.public.Favorite.where({ customerId: favoriteCustomer.id, menuItemId: item.id }).first()) await db.orm.public.Favorite.create({ customerId: favoriteCustomer.id, shopId: shop.id, menuItemId: item.id });
  }

  const [allShops, allItems, allCategories, allPlans, allOrders, allDeliveries, allReviews] = await Promise.all([
    db.orm.public.Shop.where((row) => row.name.in(kitchens.map((kitchen) => kitchen.name))).all(),
    db.orm.public.MenuItem.all(), db.orm.public.MenuCategory.all(), db.orm.public.SubscriptionPlan.all(),
    db.orm.public.Order.where((row) => row.orderNumber.like("HF-TEST-%")).all(), db.orm.public.Delivery.all(), db.orm.public.Review.all(),
  ]);
  console.log(JSON.stringify({ seed: "HomeFoods development fixtures", database: host, kitchens: allShops.length, menuItemsForSeededKitchens: allItems.filter((item) => allShops.some((shop) => shop.id === item.shopId)).length, categoriesForSeededKitchens: allCategories.filter((category) => allShops.some((shop) => shop.id === category.shopId)).length, mealPlansForSeededKitchens: allPlans.filter((plan) => allShops.some((shop) => shop.id === plan.shopId)).length, testOrders: allOrders.length, deliveriesForTestOrders: allDeliveries.filter((delivery) => allOrders.some((order) => order.id === delivery.orderId)).length, reviewsForTestOrders: allReviews.filter((review) => allOrders.some((order) => order.id === review.orderId)).length, testAccounts: 48 }, null, 2));
}

main().catch((error: unknown) => {
  console.error("Development marketplace seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await db.close();
});
