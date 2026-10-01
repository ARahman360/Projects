# Kitchen sales and compact rider history — 2026-10-01

Implemented direct Seller Workspace links for Kitchen order history and Sales summary. Historical kitchen cards now show order total and payment status. The all-time summary uses the existing complete, seller-scoped orders response: paid EUR payments on delivered orders, with sandbox totals separated and cancelled/refunded/unpaid records excluded. Collected order totals include fees and are explicitly not seller payouts/profit; payout/commission data remains unconfigured.

Rider history uses five collapsed rows initially, newest completion first, with Show 5 more / Show fewer. Expand a row to see items, pickup/destination and timestamps. Completed rows no longer render large navigation panels or action controls. Active delivery controls are preserved. Notification deep links reveal the matching history row.

Checks: four sales/navigation tests passed; focused ESLint and TypeScript passed. Synthetic component rendering verified five collapsed rows, latest-first order, count and absence of navigation actions. Browser checked native expand/collapse and mobile width (375px content and viewport, no horizontal overflow). Temporary public preview removed. No real account/order data modified. The screenshot in artifacts/compact-rider-history.png is a synthetic layout preview.

Both github1/main and github2/main were fetched. Pushes remain withheld because outgoing history includes security commit 0783e84 with pending Supabase Security Advisor dashboard verification, per AGENTS.md. Production readiness and radius settings were not changed.
