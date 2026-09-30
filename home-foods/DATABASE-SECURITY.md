# Home Foods database security — 30 September 2026

## Applied

The configured Supabase project matches the project in the supplied warning.
All 27 public application tables had RLS disabled and no policies:

- `address`
- `adminAuditLog`
- `cart`
- `cartItem`
- `checkoutRequest`
- `delivery`
- `favorite`
- `kitchenFavorite`
- `menuCategory`
- `menuItem`
- `menuItemOption`
- `newsletterSubscriber`
- `notification`
- `order`
- `orderItem`
- `orderStatusEvent`
- `passwordResetToken`
- `payment`
- `review`
- `rider`
- `scheduledMeal`
- `scheduledMealEvent`
- `shop`
- `subscription`
- `subscriptionPlan`
- `subscriptionPlanItem`
- `user`

Migration: `supabase/migrations/202609300001_homefoods_server_only_rls.sql`.

For every listed table:
- Enabled RLS.
- Added restrictive `homefoods_server_only` policy for `anon` and `authenticated`, with both predicates false.
- Revoked table and column grants from PUBLIC, anon and authenticated.
- Revoked public sequence privileges and this migration owner's default table/sequence grants.

There are no public views/materialized views/foreign tables or exposed public security-definer functions in the audited database.

## Why there are no browser ownership policies

Home Foods uses signed server sessions, integer application user IDs and server-side Prisma.
It does not use Supabase Auth JWTs or browser database clients. PostgreSQL `auth.uid()`
cannot represent these sessions. Public discovery also goes through the Home Foods API.

The current backend connection is `postgres` with BYPASSRLS. Its access is preserved;
customer, seller, rider and administrator restrictions remain enforced by backend routes.
The backend reloads account role/authVersion from the database; a client role is not authoritative.
This migration closes direct Data API access; it does not claim to provide per-user RLS
inside the privileged backend connection. Do not expose this connection to the browser.

The public kitchen API previously serialized the complete shop row and seller email.
It now explicitly selects the response fields the public kitchen UI uses, excluding
private contact, precise location, ownership and verification data.

Uploads use the existing filesystem storage, not Supabase Storage. Existing
session-derived shop ownership and image-reference checks are preserved.

## Reproduce on another environment

Apply normal Prisma schema migrations first, then run:

```sh
node scripts/database-security.mjs
node scripts/database-security.mjs --apply
node scripts/database-security.mjs --verify
```

The security SQL is maintained separately from Prisma's generated contract migrations:
no generated migration hashes or contract markers were changed. It is idempotent and
runs in a transaction with permission assertions before commit. The migration refuses
unknown public tables and requires the reviewed server role's BYPASSRLS capability.
Use the deployment's configured DATABASE_URL; never pass credentials on the command line.

For every new table, update the reviewed table list and add an appropriate security
migration. Default-grant revocation affects the applying owner only. Other migration
owners need their own default-privilege review. Always rerun the security check after
schema changes; do not fix drift by disabling RLS.

## Verification

- Live application: 49 checks passed using disposable fixtures and real login.
  Covered customer profile/address/favorite/order/notification isolation; seller menu
  ownership; non-admin rejection; public search and kitchen data filtering; cash
  checkout; seller fulfillment; rider assignment/ownership/completion; image ownership.
  Fixtures and test images were removed.
- Database: 648 direct-role/grant assertions and 27 backend read checks passed before commit.
- Project: 53 unit tests passed; TypeScript and focused ESLint passed.
- No current configured secret value or service-role JWT found in reachable Home Foods Git history.
  This is a scoped scan, not proof about deleted remote history or unknown credentials.
- No UI redesign, authentication migration, radius change, or production-readiness work.

## Outstanding verification

Database catalog confirms zero public application tables with RLS disabled.
The Supabase dashboard redirects to sign-in, so its refreshed Security Advisor result
has not yet been observed. Sign in and rerun Security Advisor to confirm the displayed
`rls_disabled_in_public` result. No password or secret needs to be pasted into chat.
