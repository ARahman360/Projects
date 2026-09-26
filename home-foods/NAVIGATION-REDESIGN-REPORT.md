# Home Foods — unified application navigation

## Scope and cause

Home, Orders, Favourites, Meal Plans, Workspace and Admin each rendered their own header or navigation markup. Separate grid columns and page-specific CSS produced the inconsistent widths and permanent sidebars shown in the request.

The root layout now supplies a shared application shell. The homepage reuses the same header component with its existing live search and basket callbacks; other pages use the shared location picker, search-to-home form, account avatar and cart link. Sign-in, registration and recovery keep their dedicated layouts.

## Shared components and configuration

- `src/components/app-shell.tsx`: AppShell, AppHeader, shared drawer/profile/footer, SecondaryNavigation, same-page anchor handling, session refresh and sign-out feedback.
- `src/components/navigation-icon.tsx`: one consistent SVG stroke icon set.
- `src/lib/navigation.ts`: typed discovery, account, role shortcuts and workspace/admin section destinations, plus route/hash matching.
- `app/app-navigation.css`: shared surfaces, spacing, dimensions, responsive header, drawer motion, active/focus states and content layout.
- Existing Brand, LocationSelector, OverlayLayer and ThemeToggle are reused. The theme button implementation is unchanged and has one mount near the drawer bottom.

## Role structure

Every role has Home, Explore Kitchens, actual account identity, Manage Account, Settings and Sign Out. Customer navigation also includes Orders, Meal Plans and Favourites. Sellers, riders and administrators retain Orders and receive a prominent Your Kitchen, Deliver or Workspace shortcut directly beneath their profile. Management options are not shown to other roles. Admin section definitions preserve the actual existing routes; unsupported customer promotions or security settings were not invented.

Customer workspace sections are Profile and Saved Addresses. Seller and rider operational sections and admin management sections appear as compact secondary links within the content area, not permanent sidebars.

## Migrated pages and removed duplication

Home, discovery/collection pages, kitchen menus, Orders and order tracking, Favourites, Meal Plans and meal tracking, Manage Account/Profile/Addresses, seller and rider workspaces, and all admin subroutes use the shared header/drawer.

Removed page-level header/sidebar markup from `app/page.tsx`, `app/orders/page.tsx`, `app/favorites/page.tsx`, `app/meal-plans/page.tsx`, `app/workspace/page.tsx`, `src/components/admin-workspace.tsx`, `src/components/collection-page.tsx` and `src/components/kitchen-page.tsx`. The root integration is in `app/layout.tsx`. Kitchen cart mutations notify the shared cart indicator. Meal-plan live-update status remains inside the page.

## Interaction and accessibility

The body-level overlay covers the header, makes the background inert and locks its scroll. The drawer scrolls independently, traps keyboard focus, closes with its close control, backdrop, Escape or a left swipe, and restores trigger focus. Enter/exit and hover transitions respect reduced motion. Navigation uses visible focus rings, readable light/dark tokens and spacious navigation rows. Same-page links use native anchors so hash changes and browser history update the active state correctly.

The shared sign-out action reports server errors without clearing the account UI. Riders receive confirmation explaining that logout takes them offline while keeping assigned deliveries available for recovery. The existing backend sign-out/offline behavior is unchanged.

## Verification

- Unit suite: 43 passing tests, including independent Orders/Favourites destinations, role shortcuts, hash/nested-route matching and the single theme mount.
- TypeScript: passed.
- ESLint: zero errors; one existing `no-img-element` warning in Meal Plans.
- Full sandbox integration: 12 groups passed across temporary customer, seller, rider and administrator accounts. Includes address lookup/save, checkout, seller fulfilment, permissions, rider delivery transitions, scheduled meals, availability controls, administrative actions and shared navigation.
- Shared navigation rendering: 390px, 768px and 1440px, light/dark, all four roles and migrated page types. Checks real identity, role shortcut placement, active links, no obsolete sidebar markup, no horizontal overflow, focus trapping/return, scroll lock, backdrop and browser history.
- Focused guest browser checks passed in Chrome and Edge: same-page Explore Kitchens highlight, standalone authentication pages, dark preference persistence, cross-page search, swipe dismissal and reduced motion.
- Production build passed, generating 36 routes.
- Final navigation-only rerun passed all four roles, including simulated sign-out failure and successful retry. The regression explicitly waits for the DELETE response and asserts HTTP 200 before checking dismissal, separating API latency from the drawer animation.

Scripts: `scripts/navigation-checks.ts`, updated `scripts/mobile-layout-checks.ts` and `scripts/test-workspace-operations.ts`; regression tests in `tests/navigation.test.mjs` and `tests/theme-controls.test.mjs`.

## Preserved boundaries and limitations

No changes to order authorization, geographic policy, Geoapify configuration, payment behavior, database schema or the disabled 20 km restriction. Production readiness remains on hold. Role verification uses installed desktop Chrome with responsive viewports, plus focused guest checks in Edge; it is not a new physical iPhone/Safari test. Test sessions and sandbox records are isolated and cleaned up; existing users are not signed out.

`github2/main` remains blocked by an earlier outgoing commit deleting the unrelated sibling Ravintola v2 project. No force-push or history rewrite is used. Artifacts, logs and environment files are excluded from the task commit.
