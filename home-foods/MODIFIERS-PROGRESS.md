# Extras / modifiers — completed 2026-10-03

Separate extras/preferences reuse the existing portion editor, customer selector and basket.

- Validated groups/options are JSON in nullable MenuItem.modifierGroups. Stable IDs identify selections. Up to 10 groups / 20 options per group; required minimum and single/multiple maximum enforced.
- Checkout reloads the locked dish and calculates (portion/base + selected extras) × quantity. Client prices are ignored.
- Basket identity includes canonical selected modifier IDs; order-item options JSON snapshots names, groups, prices and portion. Quantity/unit/total remain order-item columns.
- Seller preparation and customer history display snapshots; repeat orders skip unavailable choices.
- Migration 20261003T1457_dish_modifiers applied successfully; database marker/schema verification passed.
- Targeted TypeScript and ESLint passed. Eight modifier/portion unit tests passed. 24 API fixture checks passed (save/reload, ownership, constraints, tampering, combinations, idempotency, historical retention).
- Browser verified required choice gating, €27 live total, distinct basket lines, mobile collapse, seller save/reload, and dark theme. Disposable API and browser fixtures removed.
- Existing generated next-env.d.ts and unrelated artifacts preserved.

Files: src/lib/modifiers.ts, basket.ts; modifier-editor.tsx, modifier-summary.tsx, portion-selector.tsx, seller-dish-list.tsx, basket-drawer.tsx, kitchen-page.tsx, operational-dashboard.tsx; home/favorites/orders pages; seller/orders/catalog/kitchen APIs; portions.css; Prisma contract/migration; tests/modifiers.test.mjs; scripts/check-modifiers.mjs.
