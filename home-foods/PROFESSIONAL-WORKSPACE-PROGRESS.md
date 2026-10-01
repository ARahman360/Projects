# Professional workspace improvements — completed locally, 2026-10-01

Previous task: seller/rider personal buying completed in commit 1f0ab8b.

## Completed

- Rider delivery completion, stale heartbeats and parallel sign-in no longer switch availability off. Manual offline, logout and administrative suspension remain enforced by the server.
- Professional workspaces contain operational work. Personal Orders remain at /orders, personal subscriptions at /meal-plans, and profile/address management at /account. Legacy profile/address links redirect appropriately.
- Sellers without a personal address receive a verified copy of their kitchen address as the delivery default. Existing personal choices take precedence. Delivery changes never modify the operational kitchen address, which is shown separately in Manage Account.
- Riders must select a saved personal address. Missing/deleted address selections return validation errors, not a service-outage response. Saved-address resolution now supports all buyer roles.
- Compact category rows and expandable Add/Edit editor reuse ImageUpload. The meal-plan builder has a responsive details/dish layout, search, thumbnails, selection count, validation and existing theme tokens.

## Verification

- 90 integration API checks passed; disposable fixtures removed. Covers seller/rider buying, kitchen default and alternate address, missing rider address, saved-address resolver, personal/work isolation, self-delivery protection, regular/scheduled delivery availability, manual offline, logout and subscriptions.
- 13 targeted buyer/navigation/workspace/address policy tests passed.
- TypeScript passed. Focused ESLint: zero errors; one pre-existing img warning in meal-plans/page.tsx. Final changed orders route and new components passed lint.
- Browser: category creation/edit, searchable dish selection across filters, published plan with two dishes, Manage Account address separation, personal plan destination, desktop light/dark and mobile layout checked. No horizontal overflow at mobile viewport. UI fixture account/kitchen/categories/dishes/plan/addresses removed afterward.
- No real Stripe transaction performed. No full build requested or run.

## Files

Routes: app/account/page.tsx; app/api/{addresses,admin,auth,orders,rider}/route.ts; app/api/location/resolve/route.ts; app/{workspace,meal-plans}/page.tsx; app/layout.tsx.
Components: location-selector, seller-kitchen-editor, seller-category-manager, seller-meal-plan-builder, personal-meal-plans.
Shared: src/lib/seller-delivery-address.ts; src/lib/navigation.ts; app/seller-management.css.
Tests: scripts/check-buyer-roles.mjs; tests/navigation.test.mjs.

## Publication blocker

Fetched both github1/main and github2/main. Both outgoing ranges include security commit 0783e84, whose Supabase Security Advisor dashboard result remains unverified (dashboard sign-in required; see DATABASE-SECURITY.md). Per AGENTS.md, do not push unverified ancestors. Both pushes withheld. Existing connections/history preserved.

Production readiness remains on hold; the 20 km restriction remains disabled. No further implementation remains for these two tasks. Do not repeat completed work on a heartbeat.
