# Portion and size options — 3 October 2026

## Implemented

- Seller dish editors support compact portion rows with a label, price, availability and one optional default. Dishes without portions retain their normal price and quick add.
- Catalog, kitchen and favourites show the available price range. Multiple available choices open the shared selector; a single available choice adds directly. Sold-out choices cannot be selected.
- Basket lines are keyed by dish and portion. Labels, quantities and prices remain separate through checkout and repeat orders.
- Checkout reloads and locks the dish, validates the chosen live option and calculates prices on the server. OrderItem stores the purchased label and price in its existing options JSON and name/price snapshot fields. Historical orders remain unchanged after edits or option removal; existing customer, seller, rider and admin item views display the purchased label.
- MenuItemOption stores the options. The only new column is isDefault, with false as its default.
- Previous branding and basket badge changes were committed as 4979592. Earlier task progress records report the requested application changes complete locally; the database publication blockers below remain open.

## Verification

- TypeScript and focused ESLint passed.
- Four portion unit tests and 33 isolated API assertions passed, including ownership, invalid/sold-out choices, server prices, separate quantities, idempotency, historical snapshots, rider/admin visibility and no-option fallback.
- Browser: saved Small/Regular/Large choices survived navigation, Regular was preselected, Large was disabled, and Small x2 plus Regular x1 produced separate basket rows and a EUR 22.70 food subtotal. Opening the basket retained the kitchen page. Screenshot: artifacts/portion-basket.png (local evidence, not committed).
- Disposable API and browser fixtures were removed, and the guest test basket was emptied.
- Database security verification passed 648 assertions and 27 backend reads after the additive column change; all 27 application tables retained RLS.

## Database migration recovery — resolved 3 October 2026

The generated Prisma migration adds only MenuItemOption.isDefault. The standard Prisma migration runner failed and rolled back because its stored contract does not describe the RLS/policies added by the preceding security task (54 reported differences). No security controls or migration markers were changed to bypass that failure.

The reviewed additive SQL in supabase/migrations/202610020001_menu_portion_default.sql was applied using scripts/migrate-portions.mjs --apply. The script verifies the column and unchanged RLS, grants and policies. The follow-up security contract adoption now reconciles Prisma: strict schema verification passed, the supported verification-gated db sign command adopted the matching live schema, and db migrate reports Already up to date. See DATABASE-SECURITY.md for the recovery procedure.

The signed-in Supabase Security Advisor linter was rerun and reports zero errors, warnings and suggestions. The previous dashboard and Prisma migration blockers are resolved; remote publication is handled by the follow-up completion commit.

Production readiness remains on hold, and the 20 km restriction remains disabled. Email-change functionality remains excluded at the user's request.
