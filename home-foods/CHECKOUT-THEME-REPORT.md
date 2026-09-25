# Checkout, basket, Orders and Favourites repair

## Completed work

- Fixed inconsistent development seller eligibility: discovery included existing sellers, while checkout, subscriptions and rider assignment still required fictional fixture identities. These now share the explicit existing-seller development opt-in.
- Fixed a checkout race: mounting the address selector redispatched the same saved address and invalidated an in-flight availability check. Only changes to address identity, owner or coordinates now invalidate that check.
- Verified kitchen coordinates must belong to Finland. Missing kitchen locations fail with a useful message instead of a false delivery promise.
- As explicitly requested, saved Geoapify-verified **development examples** for Tanvir (Lahdenkatu 2, 15110 Lahti) and Samia (Mannerheimintie 9, 00100 Helsinki). Stored addresses have a `[SANDBOX LOCATION]` label. These are not claimed to be their real kitchens and are blocked from production ordering.
- The isolated development configuration still has nationwide testing enabled and the delivery radius disabled. Production retains Finland validation and the 20 km road-distance check.
- Rebuilt basket and checkout: fixed headers and footers, one central scrolling area, persistent close controls, grouped kitchen summaries, payment choices, readable dark-mode controls and consistent per-kitchen service-fee rounding.
- Added sidebar swipe-left dismissal and basket swipe-right dismissal with vertical scrolling preserved. Escape, backdrop dismissal, focus containment and focus restoration remain available.
- Redesigned Orders with active/history/cancelled tabs, stored status-event progress, polling, expandable details, and reorder using current menu availability/prices.
- Redesigned Favourites with food/kitchen tabs, filled hearts, loading/empty states and cross-page refresh. Unavailable kitchens/dishes can still be removed from favourites.
- Added shared semantic light/dark tokens and refined contrast across public, customer and role workspaces. Theme preferences persist across reloads and navigation. The homepage section layout is preserved; its mobile header now fits the viewport.

## Verification

- `npm test`: **36 passed**. Includes Finland-only verification, foreign locations, Geoapify failures, proof validation, account protections, production/development separation and 5 / 19.9 / 20 / 20.1 km routing boundaries.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with one existing `no-img-element` warning in `app/meal-plans/page.tsx`.
- `npm run build`: passed, including TypeScript and all 33 static pages.
- Browser flow: **11 checks passed**, including real sandbox checkout, customer/seller/admin visibility, rider completion, live order progress, history, reorder, favourites, mobile basket/checkout and sidebar drag.
- Native touch test: left swipe dismisses; vertical swipe does not. Dark/light persistence, standalone authentication navigation, keyboard focus and Escape also passed.
- Multi-kitchen checkout passed for Tanvir and Samia, with repeated submission returning the same orders instead of duplicates:
  - Tanvir: **HF-CB69DB90**, EUR 8.28.
  - Samia: **HF-A2BC2D0E**, EUR 9.33.
- End-to-end rider-completed sandbox order: **HF-C16B546C**.
- Temporary QA kitchens were closed after testing; historical test orders remain marked sandbox.

## Changed files for this work

Frontend:
- `app/page.tsx`
- `app/orders/page.tsx`
- `app/favorites/page.tsx`
- `app/layout.tsx`
- `app/theme-system.css` (new)
- `app/customer-collections.css` (new)
- `src/components/overlay-layer.tsx`
- `src/components/order-journey.tsx` (new)
- `src/components/site-enhancements.tsx`
- `src/components/kitchen-page.tsx`

Server:
- `src/lib/feature-flags.ts`
- `src/lib/location.ts`
- `app/api/catalog/route.ts`
- `app/api/kitchens/[id]/route.ts`
- `app/api/location/delivery-check/route.ts`
- `app/api/orders/route.ts`
- `app/api/rider/route.ts`
- `app/api/admin/route.ts`
- `app/api/subscriptions/route.ts`
- `app/api/favorites/route.ts`

Checks and evidence:
- `tests/feature-flags.test.mjs`, `tests/location.test.mjs`
- `scripts/test-premium-flows.mjs`
- `scripts/test-two-kitchens.mjs`
- `scripts/test-touch-theme.mjs`
- `scripts/audit-dark-pages.mjs`
- `artifacts/premium-qa/` contains JSON results and screenshots.

## Practical limits / remaining setup

- Replace the explicitly labelled sample kitchen locations with the owners' real verified addresses before production use.
- All submitted orders were fictional sandbox cash orders. No real payment or physical delivery was initiated. Stripe billing/refunds were not exercised.
- Promo codes remain inactive and state that no discount was applied; no fake discount is shown.
- External food-photo requests were unavailable in parts of the automated browser run, so some screenshots show existing image fallbacks. This work does not replace the image source library.
- The visual audit checks rendered views and approximate text contrast; it is not a complete WCAG certification. GPS hardware permission behavior was not re-exercised in this checkout/design pass.
- No production deployment was performed. The development site remains at http://localhost:3000.

## Rendered-page review

Reviewed 63 dark and 63 light viewport/page combinations at 1440, 768 and 390 pixels, spanning discovery, kitchen details, collections, authentication, Orders, Favourites, meal plans and customer/seller/rider/admin workspaces. Both runs completed with **zero JavaScript runtime errors and zero document-width overflows**. The review also caught and corrected a mobile Orders sidebar height inherited from desktop styling. Screenshots were visually inspected for checkout, Orders, homepage, authentication and the favourites flow. The contrast scan is approximate: logos, decorative characters and the authentication panel's CSS background can produce false positives; it does not establish full accessibility conformance.
