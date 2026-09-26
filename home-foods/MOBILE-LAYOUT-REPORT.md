# Desktop, address and availability repairs

## Causes and changes

1. **Missing desktop menu:** the original `.mobile-menu-toggle` rule hid it above the mobile breakpoint. The homepage header now explicitly shows its drawer trigger at every width.
2. **Empty left column:** the marketplace grid still reserved 238px (205px on laptops) for a persistent sidebar, even though navigation now renders in a body-level overlay. Both reserved columns were removed and the main content occupies the single grid column. Its existing centered maximum width is preserved; no negative-margin workaround was added.
3. **Drawer:** the existing overlay retains backdrop, close button, Escape, focus return and swipe-to-close behavior. The header, categories, hero and food sections keep their existing design.
4. **Phone access:** `npm run dev:lan` detects private IPv4 addresses, binds Next to `0.0.0.0`, and permits the detected development asset hosts. The existing dev command is unchanged. Current Wi-Fi URL: **http://192.168.10.146:3000**. See MOBILE-TESTING.md for firewall and trusted HTTPS instructions. No public tunnel or firewall disable was introduced.
5. **Addresses:** removed the separate Finnish search box from AddressEditor. Street and building number is now the combobox, with debouncing, active options, arrow/Enter selection, Escape, outside dismissal, clear button and loading/errors. Selected provider components populate street, postcode and municipality. Editing street/city/postcode clears verification and coordinates. Apartment information remains separate. GPS/map still populate this same editor. Seller kitchen location editing now also uses it, with server-checked signed provider proof.
6. **Invisible actions:** general workspace button styling overrode the primary button text with green while retaining a green background. Explicit shared primary foreground/hover/disabled colors restore readable labels; seller/rider actions show “Saving…” while pending. Existing status transitions remain authoritative.
7. **Availability:** mobile widths up to 600px use a draggable handle with an 85% completion threshold. Partial/cancelled/vertical gestures reset without mutation. Both states provide a tap and keyboard alternative. The final online/offline state changes only after backend confirmation. Desktop/laptop uses green Go Online and red Go Offline buttons. Failure feedback retains the current state.
8. **Synchronization:** both controls call the same seller/rider APIs with their expected previous state. Conditional writes reject stale updates; rider activation rechecks account status in a transaction. Rider heartbeats refresh presence without forcing an offline rider online. Workspace data refreshes every 20 seconds while visible, and on focus/visibility return. Existing assignments and purchased commitments remain intact when offline.

## Verification

- Unit suite: 39 passing tests.
- TypeScript and production build: passed.
- ESLint: zero errors; existing native-image warning in meal-plan page remains.
- Chrome regression suite: live Geoapify street selection, leading-zero postcode and saved verified address used in sandbox checkout; complete seller/rider fulfillment; wrong-rider and premature-completion protection; duplicate pickup/completion; individual scheduled-meal isolation; rider logout; admin authorization/confirmation regression.
- Responsive checks: 390, 768, 1100, 1440 and 1920px homepage, light/dark; hamburger visible, no reserved left column or horizontal page overflow, drawer close/Escape/backdrop and focus return.
- Seller/rider actions: actual labels visible in both themes, measured foreground/background contrast at least 4.5:1.
- Availability: desktop colors, partial/full drag, backend rejection, keyboard/tap alternative, persistence after refresh, responsive state consistency and reduced-motion screenshot inspection.
- LAN homepage, relative API and Next asset all returned HTTP200 through the computer's own LAN address. The user additionally confirmed “It opens” on the physical iPhone using that Wi-Fi URL.

## Files

- Layout/styles: `app/marketplace.css`, `app/page-experience.css`, `app/admin-workspace.css`.
- UI: `src/components/address-editor.tsx`, `availability-control.tsx`, `operational-dashboard.tsx`, `seller-kitchen-editor.tsx`, `app/workspace/page.tsx`.
- Backend: `app/api/seller/route.ts`, `app/api/rider/route.ts`.
- LAN setup: `package.json`, `next.config.ts`, `scripts/dev-lan.mjs`, `MOBILE-TESTING.md`.
- Regression tests: `scripts/mobile-layout-checks.ts`, `scripts/test-workspace-operations.ts`.
- Progress/report: `MOBILE-LAYOUT-PROGRESS.md`, this report. Runtime logs, screenshots, environment files and unrelated changes are excluded from the commit.

## Boundaries

The user confirmed homepage access from their iPhone. Full iOS workflows, real touch gestures and GPS permission/certificate trust have not been independently verified. Windows Wi-Fi is currently Public; the smallest optional firewall rule and its removal command are documented, not applied. HTTP LAN geolocation is expected to be unavailable; trusted HTTPS is required. Existing GPS/map logic remains, but no exact real-device location is claimed.

The 20 km restriction remains disabled in the existing nationwide development mode. Earlier production-readiness work remains on hold. Other previously unfinished administration capabilities are outside this repair request.

`github2/main` still lacks unrelated pre-existing sibling-project deletion and merge commits. AGENTS.md prohibits publishing these as part of this task. Only the safe task-scoped outgoing range to `github1/main` may be pushed without resolving that history issue.
