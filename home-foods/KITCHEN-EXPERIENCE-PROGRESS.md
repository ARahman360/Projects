# Kitchen experience repair — 27 September 2026

## Requested changes implemented

1. The shared header's guest branch only rendered Sign in after the navigation unification. It now renders Sign in and Join. On small screens both actions are in the existing navigation drawer; authenticated users retain their account control. Existing standalone authentication pages and public role restrictions are reused.
2. Incomplete Kitchen Profile settings open near the top with a completion checklist. Saving validates the operational fields on the server and persists a completion timestamp. The form then collapses to a summary card. Reopening retains saved values; collapsing retains drafts.
3. Kitchen Address reuses the existing autocomplete, map and GPS editor. A successful verified save persists a timestamp and fingerprint bound to the actual stored address and coordinates. Editing requires verification again. Existing records without that evidence require a one-time confirmation rather than being marked verified from address text.
4. Once both sections are completed, Kitchen Settings appears below the operational sections and earnings. The two expandable cards remain independently editable. Drafts warn before link navigation, refresh and sign-out. Browser history traversal is not separately intercepted.
5. Home remains `/`; Explore Kitchens is `/kitchens`. Kitchen collection See All links use the new destination, and old kitchen collection URLs redirect there. Food collection destinations remain available.
6. Discovery uses the existing catalog and seller records, actual ratings and review counts, preparation times, fees, cities and cuisine data. Search and combined filters operate on those values. Favourites reuse the existing API and persist to the account. Kitchen pages include available meal-plan links.
7. A global dark-theme input rule painted the search input independently from its surrounding search bar, causing the mismatched inner rectangle.
8. Search inputs now share a class excluded from that conflicting rule. The existing outer search surface supplies the background, with shared text, placeholder, focus, suggestion and clear-button styling. The existing sidebar remains the sole theme toggle.

## Data integrity

- Additive migration `20260927T0018_kitchen_settings_proof` applied locally: three nullable Shop fields and nullable Order.pickupSnapshot.
- New checkout and scheduled meal orders snapshot pickup details. Before a kitchen address changes, legacy orders without snapshots receive their previous pickup details in the same transaction. Rider routing and display use the snapshot.
- No credentials or environment files changed. The 20 km development restriction remains disabled; production-readiness work remains on hold.
- Favourites now reuse the existing public-origin validator, fixing valid browser requests to the LAN-bound development server.

## Verification results

- Unit tests: 46 passed.
- TypeScript: passed.
- Lint: no errors; one existing meal-plans image warning.
- Production build: final rerun passed, including the favourites and drawer fixes.
- Browser: complete kitchen journey passed. Guest actions, discovery filters, transparent search field and overflow checked at 390/768/1024/1440 in both themes. Seller profile/address persistence, card collapse, live Geoapify address verification, historical pickup preservation, draft protection, signup/login and persisted favourites passed.
- Existing order, rider, scheduled-meal, approval and availability workflow assertions passed. The old global option selector was corrected to inspect only address suggestions. The navigation portion initially failed; after the drawer initialization/readiness fix, its separate rerun passed across all four roles, three viewports and both themes.
- Temporary browser accounts and records are cleaned in test finally blocks; screenshots and logs remain local artifacts.

## Changed file groups

- Shared UI: app-shell, navigation, home-sections, kitchen-card, home page, app-navigation.css and theme-system.css.
- Discovery: app/kitchens/page.tsx, kitchen-discovery component/library, kitchen-experience.css, catalog API and collection redirects.
- Seller settings: kitchen-settings, seller-kitchen-editor, operational-dashboard, address-editor, seller API, kitchen-profile and kitchen-location-history libraries.
- Pickup history: pickup-snapshot, orders/rider APIs, meal-plan-fulfillment, Prisma contract and additive migration/snapshot.
- Meal-plan discovery: kitchen API/page and workspace plan anchors.
- Verification: navigation and kitchen-experience unit tests, check-kitchen-experience.ts, mobile-layout-checks.ts.

## Publishing

Current branch is main. All required checks passed; the reviewed task commit is ready for github1. github2 remains blocked: its outgoing ancestors include unrelated `acd3cb4 Delete Ravintola v2 directory`. No force-push, history rewrite or unrelated publication is authorized by this task.
