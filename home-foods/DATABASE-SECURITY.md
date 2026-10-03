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

RLS and the restrictive policies are now represented in Prisma's contract and the
forward migration `20261003T0946_adopt_server_only_rls`. The security SQL also manages
grants and default privileges, which Prisma does not model. It is idempotent and
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

## Completed verification — 3 October 2026

The signed-in Supabase Security Advisor was opened for the configured project and
its linter rerun. The completed result showed **0 errors, 0 warnings and 0 suggestions**.
The `rls_disabled_in_public` issue is absent. Local screenshot evidence is saved as
`artifacts/security-advisor-clean.png`.

Prisma's former 54 schema differences were the 27 enabled RLS settings and 27
restrictive policies missing from its contract. Their exact live names and predicate
text were inspected using `contract infer` and adopted without changing application
models or authorization. Platform roles are external references, not managed roles.
Strict schema verification passed before the supported `db sign --advance-ref db`
command aligned the marker and checked-in reference with the already-applied schema,
including the portion default column. No old migration package was rewritten.

`db migrate --advance-ref db` now succeeds with “Already up to date.” Full strict
verification checks the schema and marker. The security check again passed 648
assertions and 27 backend reads. The prior dashboard and migration blockers are resolved.

For an existing environment with these SQL changes already applied and an old
marker, first verify the security state and run `prisma db verify --schema-only --strict`.
Only after that passes, use `prisma db sign --advance-ref db` to adopt the matching
schema, then `prisma db migrate --advance-ref db` and `prisma db verify --strict`.
For an environment without the manual SQL changes, apply the normal migration graph
and then the grant-hardening SQL/checks above. Never disable RLS to resolve drift.
