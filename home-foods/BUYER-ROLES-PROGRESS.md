# Seller and rider buying — 2026-10-01

Implemented shared buyer access using the existing authenticated account ID, personal Orders/tracking, addresses, favourites, meal plans and buyer notifications. Own-kitchen dishes/plans are blocked in UI and final server validation. Rider job queries, accept/status changes and admin assignment reject self-delivery, including scheduled meals.

Verification: 3 policy tests passed; 70 integration API checks passed twice with disposable fixture cleanup; TypeScript passed; focused ESLint has no errors (existing meal-plan image warning). Browser confirmed seller own-kitchen dish controls disabled; professional dashboard remains first. Orders page now uses personal order records for both roles. No live Stripe charge or recurring checkout was performed; provider configuration is still required.

Changed areas: buyer policy; addresses/favorites/reviews/catalog/kitchen/order/subscription/rider/admin assignment APIs; personal Orders and Meal Plans; shared basket, navigation and notifications. Upload/editor/radius/payment architecture preserved.

Publishing: preceding security commit 0783e84 still awaits Supabase Security Advisor dashboard confirmation. Do not push unverified ancestors. github1/main and github2/main must both be checked before any later push.

Next authorized task: attachment 2c27cdfc-7804-42e5-b632-b783f6e07f10 — persistent rider availability, professional workspace separation, account addresses, seller kitchen delivery default, compact categories and meal-plan builder. UI fixture artifacts/buyer-ui-fixture.json retained temporarily for that verification; remove only those disposable records afterward.
