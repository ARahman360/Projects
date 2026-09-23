import "dotenv/config";
import { db } from "../src/prisma/db";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: npm run admin:promote -- admin@example.com");
  process.exitCode = 1;
} else {
  try {
    const user = await db.orm.public.User.where((row) => row.email.eq(email)).first();
    if (!user) {
      console.error("No account exists for that email. Create the account in Home Foods first.");
      process.exitCode = 1;
    } else {
      await db.orm.public.User.where({ id: user.id }).update({ role: "ADMIN" });
      console.log(`Administrator access enabled for ${email}. Sign out and back in to refresh the session.`);
    }
  } catch (error) {
    console.error("Could not promote account:", error instanceof Error ? error.message : "Database unavailable.");
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
