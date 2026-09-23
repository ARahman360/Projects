import { db } from "@/src/prisma/db";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV !== "development") return Response.json({ error: "Not found." }, { status: 404 });
  const fixtureAccounts = [
    { email: "admin@homefoods.test", role: "Administrator" },
    ...Array.from({ length: 4 }, (_, index) => ({ email: `customer${index + 1}@homefoods.test`, role: "Customer" })),
    ...Array.from({ length: 3 }, (_, index) => ({ email: `rider${index + 1}@homefoods.test`, role: "Rider" })),
    ...Array.from({ length: 40 }, (_, index) => ({ email: `seller${String(index + 1).padStart(2, "0")}@homefoods.test`, role: "Seller" })),
  ];
  try {
    const users = await db.orm.public.User.select("email", "name", "role").all();
    const accounts = fixtureAccounts.filter((fixture) => users.some((user) => user.email === fixture.email && user.name?.startsWith("[TEST]") && ({ ADMIN: "Administrator", CUSTOMER: "Customer", SELLER: "Seller", RIDER: "Rider" } as Record<string, string>)[user.role] === fixture.role));
    return Response.json({ accounts, password: "password", note: "Development fixtures only. This account list is never served in production." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Development account list could not be loaded", error);
    return Response.json({ error: "Development accounts are unavailable until the fixture database is configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
