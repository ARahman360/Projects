# HomeFoods

HomeFoods is a neighbourhood marketplace for homemade food. It uses Next.js 16, React 19, TypeScript, and the project's Prisma 8 PostgreSQL contract.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Set `DATABASE_URL` in `.env` to the PostgreSQL connection string. Set `SESSION_SECRET` to a random value of at least 32 characters for production. Development generates a temporary session secret if one is not set, so local sessions reset when the server restarts.

Apply schema changes with:

```bash
npm run db:migrate
```

The current subscription billing migration is applied to the configured database. `npm run build` checks and builds the app.

## Local international marketplace fixtures

The development seed creates 40 fictional kitchens distributed across Lahti, Helsinki, Espoo, Vantaa, Tampere, Turku, Oulu, Jyväskylä, Kuopio, Lappeenranta, Vaasa, and Rovaniemi; 30 menu records per kitchen; 60 weekly meal plans; test customer/seller/rider/admin accounts; and example order history. Test kitchen addresses and coordinates are fictional city-area fixtures, not real seller locations. The seed preserves valid kitchen coordinates and repairs only missing or out-of-Finland fixture coordinates. Each sample dish has its own name-and-category tagged thumbnail URL, and each test kitchen has its own logo.

The seed is additive and rerunnable: it never clears tables or changes non-fixture accounts. It creates missing `[TEST]` accounts and sets their scrypt password hash to `password`; it refuses to modify any matching account that is not marked `[TEST]` or has a different role. It requires `NODE_ENV=development`, `HOMEFOODS_ENABLE_TEST_SEED=true`, and `HOMEFOODS_ENABLE_TEST_DATA=true`. Remote databases are refused unless `HOMEFOODS_ALLOW_REMOTE_TEST_SEED=true` is set after verifying the URL is a dedicated development/test project. The configured project currently uses a remote Supabase host, so do not set this opt-in until that database is confirmed to be isolated.

Fixture users are `admin@homefoods.test` (administrator), `customer1`–`customer4@homefoods.test` (customers), `seller01`–`seller40@homefoods.test` (sellers), and `rider1`–`rider3@homefoods.test` (riders), all with the shared local test password `password`. The dedicated `/signin` page lists only fixture accounts actually present in the configured development database. Run `npm run repair:test-data` to create missing test data and safely repair the `[TEST]` password hashes; `npm run set:test-passwords` only repairs hashes on fixture accounts that already exist. Both scripts preserve all unrelated user records and require the same explicit development and remote-database safeguards.

In a PowerShell development shell, set the seed environment variables, then run. For a local database, set its `DATABASE_URL` explicitly. For the confirmed development Supabase project, keep its existing URL and set the remote opt-in below:

```powershell
$env:NODE_ENV = "development"
# For a local database only, uncomment and set your local PostgreSQL URL:
# $env:DATABASE_URL = "postgresql://postgres:your-local-password@localhost:5432/homefoods_dev"
$env:HOMEFOODS_ENABLE_TEST_SEED = "true"
$env:HOMEFOODS_ENABLE_TEST_DATA = "true"
# Required only when DATABASE_URL is a confirmed development/test server:
$env:HOMEFOODS_ALLOW_REMOTE_TEST_SEED = "true"
npm run repair:test-data
```

Nationwide development orders can be enabled only on `NODE_ENV=development` with test data enabled and an isolated database. A local PostgreSQL database is accepted automatically; a remote test database also needs `HOMEFOODS_ALLOW_REMOTE_NATIONWIDE_TESTING=true`. Use `HOMEFOODS_NATIONWIDE_TESTING=true` and `ENFORCE_DELIVERY_RADIUS=false` to bypass the radius in that environment. Production always enforces the radius. The sample coordinates are not real operational kitchen points, so this mode intentionally suppresses long-distance ETAs and marks created delivery jobs as development tests. For production-like distance tests, use verified seller/customer coordinates and set `ENFORCE_DELIVERY_RADIUS=true`.

`HOMEFOODS_SANDBOX_PAYMENTS=true` enables development card checkout only when `STRIPE_SECRET_KEY` is a Stripe test key (`sk_test_…`); development never accepts a live Stripe key. `HOMEFOODS_SANDBOX_NOTIFICATIONS=true` uses a local-only password reset link for `[TEST]` fixtures instead of sending email. With sandbox notifications disabled, password recovery requires the normal Resend setup. Feature flags are server-side only and cannot be switched through a URL parameter.

Authentication uses a dedicated App Router layout at `/signin`, `/join`, `/forgot-password`, `/account-recovery`, and `/reset-password`, with a distinct full-screen design and no marketplace navigation rendered on those routes. Cross-origin browser mutation checks account for the public host forwarded by a local reverse proxy while still rejecting a foreign `Origin`.

There is no destructive reset command. The current schema does not yet model checkout-validated promotions, structured opening hours, nutrition/allergen facts, required menu-option groups, seller payout/earnings, or plan schedules; those remain follow-up work and are not fabricated in these fixtures. Test orders use a local sandbox marker and do not call Stripe, send notifications, or dispatch deliveries.

## Marketplace workflows

- Customers discover live shops and available menu items, search/filter the catalog, keep a browser-persisted basket, save addresses, place multi-shop orders, see order history, and manage subscriptions.
- Sellers apply with a shop, manage dishes and availability, receive orders, update preparation status, and publish daily/weekly/monthly meal plans.
- Riders can go online, accept ready deliveries, and update pickup, transit, and delivery status.
- Admins can approve/suspend shops, assign available riders, review orders, and refund completed Stripe card payments.
- Cash-on-delivery orders work without Stripe. Card checkout and recurring meal plans use Stripe Checkout and webhook-confirmed state changes.

## Initial admin setup

Create a normal account through the site, then promote it using the same email from a trusted local terminal:

```bash
npm run admin:promote -- admin@example.com
```

Sign out and back in to receive the admin role. Admin accounts cannot be created from the public signup form.

## Stripe setup

Set `STRIPE_SECRET_KEY` and configure a Stripe webhook to `https://your-domain/api/payments/webhook` with `STRIPE_WEBHOOK_SECRET`. Subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_failed`, `customer.subscription.deleted`, and `charge.refunded`. Keep provider keys server-side only.

## Password recovery setup

Password reset links are single-use, expire after 30 minutes, and are stored as SHA-256 token hashes. To send them, configure `RESEND_API_KEY`, a verified `RESEND_FROM_EMAIL`, and the public `APP_URL`. Apply the additive `password_reset_tokens` Prisma migration before enabling this feature. Existing user records and passwords are not changed by that migration.

## Current operational limits

- Email verification, social login, SMS/push notifications, image upload storage, live map tracking, automated route optimization, and Stripe Connect seller payouts need external services and provider accounts. Password reset email delivery needs the Resend configuration above.
- Rider assignment is manual from the admin workspace; automatic distance-based assignment is not configured.
- The catalog starts empty until sellers are approved and add menu items. No sample shops are inserted into the live database.
- Stripe webhooks must be configured for payment and subscription state to update; never treat the browser redirect as proof of payment.
- Newsletter addresses are stored only after explicit consent. Sending campaigns and processing unsubscribe requests still require a configured email provider. Set `NEXT_PUBLIC_SUPPORT_EMAIL` to connect the floating contact link to a public support inbox.
# Geoapify location and delivery distance setup

The address selector uses [Geoapify Address Autocomplete](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/), forward/reverse geocoding, the [Geoapify Routing API](https://apidocs.geoapify.com/docs/routing/), and the [Route Matrix API](https://apidocs.geoapify.com/docs/route-matrix/) through server routes. The Geoapify API key is server-only: set `GEOAPIFY_API_KEY` in `.env.local` for development and in the server environment for deployment, then restart Next.js. Do not prefix this variable with `NEXT_PUBLIC_`. Enable Geocoding, Routing, and Route Matrix for the key. Restrict the key to the server IP/origins supported by your Geoapify account. Never commit the real key.

Leaflet is loaded only when a customer opens the optional map. Map tiles use OpenStreetMap and show its required attribution. Follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/); use a hosted tile provider or self-hosted tiles for higher production traffic.

Delivery eligibility is enforced at a maximum of 20,000 metres of Geoapify `mode=drive` route distance from the kitchen to the verified Finnish customer address. Exactly 20,000 metres is allowed. A route result is cached in server memory for six hours; route failures are temporary unknowns and are never treated as eligible. Each seller must enter their real Finnish kitchen street address in the seller workspace so Geoapify can save accurate kitchen coordinates. No city-centre coordinates are fabricated. Kitchens without coordinates cannot offer delivery until their seller sets the location; pickup may be supported separately if the marketplace later enables it.

The application uses `GEOAPIFY_API_KEY` only in server routes for autocomplete, address verification, reverse geocoding, and road routing. A local environment without this key will show a setup message rather than using an unverified address. No pickup flow or seller pickup capability is present in the current data model, so this delivery distance check does not create or disable pickup orders.
