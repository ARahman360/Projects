# Home Foods location repair

## Root causes

1. **Geoapify authentication:** `.env.local` accidentally joined `HOMEFOODS_ENABLE_TEST_DATA=true` onto the end of `GEOAPIFY_API_KEY`. The server sent that combined value as the key, resulting in HTTP 401. The settings are now on separate lines. The replacement key works; no Geoapify dashboard change was needed for the successful geocoding checks. The key remains server-only and is not included in this report.
2. **Checkout:** address search, saved addresses, and checkout had different address state and verification rules. Coordinates and selected IDs could be discarded, and previously saved addresses were geocoded again. A static “saved address is ready” message appeared even when validation failed. Separate account loading could overwrite the selected address with the default. These paths now use the same saved records and backend verification policy.
3. **Current location:** the malformed key also prevented reverse geocoding after the browser returned coordinates. Device timeouts are a separate problem: the browser cannot always obtain a fix. The interface now distinguishes permission denial, timeout, unavailable device location, provider errors, and foreign locations, and lets customers correct the best available address. GPS is never described as an exact door location.
4. **Picker loading:** opening checkout's address picker before its saved-address request finished could enter the new-address form. An explicit loading state now prevents that race. Checkout's trigger also has dedicated styling so global header styles do not hide its text.

## Implemented behavior

- Shared address editor for homepage location selection, checkout selection, and Manage Account.
- Finland-only Geoapify suggestions, debounced by 350 ms, with loading, clear, keyboard selection, Escape, outside-click dismissal, and readable errors. Both GeoJSON and JSON response formats are supported. Suggestions retain their complete address data and a short-lived server-signed proof.
- Browser geolocation only on explicit request, bounded device/provider timeouts, reverse lookup, accuracy guidance, and optional existing Leaflet map. Missing building details remain editable. Five-digit postcodes remain strings, preserving leading zeros.
- Stored verification source, country, timestamp, and address/coordinate fingerprint. Client-supplied coordinates alone cannot make an address verified. Unchanged verified saved addresses are reused without another geocoding call. Legacy addresses are checked when selected; mismatching provider results require customer confirmation.
- Add/edit/default/delete actions in **Manage Account → Addresses**, including empty states and delete confirmation. Deleting the default promotes the newest remaining address. Deleting the last address returns to the empty state.
- All saved-address operations enforce the signed-in customer's ownership. Account-specific browser storage and guarded asynchronous account loading prevent another account's state from being reused.
- Address edits preserve historical details, and new orders receive archived address snapshots. Deleting a saved address removes it from the active collection without erasing order history. Cross-tab deletion invalidates unfinished checkout without deleting basket items.
- Backend delivery eligibility remains authoritative. The existing explicit nationwide development mode remains enabled for this development site; production retains the Finland and 20 km driving-distance rules and fails closed when routing is unavailable.
- A separately labelled fictional-address fallback is enabled only under the explicit development, isolated-database, fixture, nationwide, and sandbox flags. It stores no invented coordinates, is limited to cash sandbox orders at fictional test kitchens, and cannot activate in production.
- Checkout uses a saved-address ID, prevents repeated button submissions, and uses a database-backed idempotency record. Concurrent requests with the same key return the same order. A retry key survives a page reload within the tab. Payment initialization errors return an actionable retry message without creating another order.
- Seller kitchen address edits revalidate the location and update coordinates together. Rider/admin delivery views retain the correct address details; sandbox rider jobs remain excluded outside development mode.
- Applied the additive `20260923T1955_reliable_saved_addresses` migration and regenerated the Prisma contract. No existing address or order collection was reset.

## Verification results

| Check | Result |
| --- | --- |
| TypeScript (`npx tsc --noEmit`) | Passed |
| ESLint (`npm run lint`) | No errors; two existing `next/image` warnings in meal plans and orders |
| Production build (`npm run build`) | Passed; all 33 pages generated |
| Automated unit tests (`npm test`) | 33 passed, 0 failed |
| Live API/database integration | 10 groups passed |
| Address UI browser suite | 8 groups passed |
| Checkout UI browser suite | 5 groups passed |
| Seller location integration | 4 groups passed |

Unit coverage includes malformed environment settings, signed-proof tampering, saved-address reuse, leading-zero postcodes, foreign addresses, provider failures, route caching, multiple kitchens, and 5 km / 19.9 km / exactly 20 km / 20.1 km boundaries. Route boundary and outage cases use mocked provider responses.

Live Geoapify tests successfully looked up Ruopankatu in Lahti and Mannerheimintie in Helsinki, returned `00100` correctly, reverse-geocoded Helsinki coordinates, and rejected Stockholm coordinates. The live geolocation browser test uses emulated coordinates with granted permission and the real reverse-geocoding API. Denial, timeout, and provider-outage browser cases are simulated; these do not establish the accuracy of a physical device's GPS.

The API integration created **sandbox order HF-8F3CA9D4**, checked customer and seller visibility, exercised seller preparation, and verified the assigned rider and administrator could see the appropriate delivery. Concurrent duplicate submissions created one order. Two existing fictional customer accounts also completed address add/edit/order/delete flows. Separate fresh fictional customers completed real browser checkout and saw genuine order confirmation and Orders-page entries; their latest order numbers are recorded in `artifacts/location-qa/checkout-browser-results.json`.

Browser checks cover desktop, 768 px tablet, and 390 px mobile; light and dark address controls; nested dialogs; keyboard autocomplete; default changes; delete cancellation; cross-tab invalidation; and account isolation. No page runtime errors were recorded in the passing suites. Initial browser test failures were resolved: one exposed the picker loading race; another was a test selector matching the homepage's hidden sort option instead of the address dropdown. The final suites pass.

## Changed files for this repair

- Configuration: `.env.local` (ignored/private), `.env.example`, `package.json`.
- Backend services: `src/lib/address-policy.ts`, `src/lib/saved-addresses.ts`, `src/lib/location.ts`, `src/lib/feature-flags.ts`, `src/lib/stripe.ts`.
- API routes: `app/api/addresses/route.ts`, `app/api/location/suggest/route.ts`, `app/api/location/resolve/route.ts`, `app/api/location/delivery-check/route.ts`, `app/api/orders/route.ts`, `app/api/subscriptions/route.ts`, `app/api/seller/route.ts`, `app/api/rider/route.ts`, `app/api/admin/route.ts`.
- Interface: `src/components/address-editor.tsx`, `src/components/saved-addresses.tsx`, `src/components/location-selector.tsx`, `src/components/overlay-layer.tsx`, `app/addresses.css`, `app/layout.tsx`, `app/page.tsx`, `app/workspace/page.tsx`.
- Database: `src/prisma/contract.prisma`, generated `contract.json` and `contract.d.ts`, `migrations/app/20260923T1955_reliable_saved_addresses/`, `migrations/app/refs/db.json`, and its generated contract snapshot under `migrations/snapshots/37b167813551276fe914048c2deb52e2fa481a874010ec010cc4dacbcbe20af2/`.
- Tests: `tests/address-policy.test.mjs`, `tests/location.test.mjs`, `scripts/test-location-integration.mjs`, `scripts/test-location-browser.mjs`, `scripts/test-checkout-browser.mjs`, `scripts/test-seller-location.mjs`.
- Evidence: `tests/location-integration-results.json`, `artifacts/location-qa/*`, and this report.

Existing unrelated changes already present in the workspace were preserved. Fictional QA accounts and sandbox orders remain distinguishable by their test names and sandbox metadata.

## Remaining setup and limits

- **No additional Geoapify key configuration is needed for the live geocoding operations tested.** After future environment changes, restart the server if it does not reload them. Keep each variable on its own line. Do not add a `NEXT_PUBLIC_` prefix to the key.
- Stripe credentials were not configured, so successful orders were cash sandbox orders. No live card charge, real delivery, or physical-device GPS accuracy was tested.
- The application still requires browser/device location permission and HTTPS or localhost for automatic location. Manual Finnish address search remains available when the device cannot obtain a fix.
- The development radius exception remains intentional. Production routing behavior is covered by mocked regression tests; this run did not place a real production delivery order.
- Automatic approval review rejected a proposed bulk legacy-address repair because it would send all unverified saved addresses to Geoapify and update the database. That script was removed without running. Customer-selected addresses are verified individually instead; no bulk customer-address export was performed.
- Build emitted a non-blocking warning about an unrelated parent-directory lockfile. Lint has the two image optimization warnings listed above.
