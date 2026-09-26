# Home Foods workspace progress

## Active request
Implement the administrator, seller and rider workspace requirements in the user attachment `433609fd-016a-45e7-953b-68ba8e02abc4/Pasted text.txt`. Read that file in full when resuming. It covers role navigation, admin directories/details, audited approval/suspension, seller availability, operational dashboard ordering and atomic pickup-to-transit updates, with cross-role and scheduled-meal tests.

## Constraints
- Previous improvement #7 (production readiness) remains on hold. This does not refer to section 7 of the new request (seller availability).
- Keep the 20 km restriction disabled and existing nationwide development settings unchanged.
- Tanvir login is resolved; no account reset.
- In-app notifications first. No external messages or real payments.
- Preserve earlier uncommitted location, checkout and theme work and unrelated sibling deletions. Never stage environment files or private artifacts.
- Follow AGENTS.md verification and scoped commit/push workflow to github1/main and github2/main.

## Resume mechanism
An hourly thread heartbeat named “Resume Home Foods workspace improvements” was created, ID `resume-home-foods-workspace-improvements`. Resume only unfinished authorized work; stop after completion or a user pause. Usage limits cannot be bypassed.

## Inspection findings / next steps
- Read current contract, admin/seller/rider APIs and workspace page. Admin kitchen status mutations lack audit/reason. Seller availability has no independent field. Rider pickup currently requires a second transit action.
- Existing contract includes orders, status events, riders, subscriptions and individual scheduled meals; no payout ledger, support case or rider-document models. Do not fabricate financial or verification records.
- Implement additive schema fields and audit model; inspect generated migration before applying.
- Then implement backend safeguards, dedicated admin routes, role sidebar placement, seller and rider operational layouts.
- Finish tests (unit, API authorization/concurrency, sandbox cross-role order and scheduled meal, rendered desktop/mobile light/dark), review diff, scoped commit and both normal pushes.

## Verification and publication
Implementation is now present: dedicated `/workspace/admin/[[...path]]` pages and `admin-workspace.tsx`, `operational-dashboard.tsx`, styling, role sidebar placement, seller offline and suspended-account purchase guards, audited administration and SQL-conditional pickup/transit/completion.

Migration `20260925T2141_workspace_operations` was reviewed and applied successfully (5 additive operations). Contract artifacts and migration were already included in an external repository commit while this task was interrupted; current baseline is `9720fab`.

Verified: 39 unit tests pass; TypeScript passes; full lint passes with one pre-existing meal-plan image warning; production build passes. Expanded sandbox API/browser test passed all 9 reported groups, including concurrent pickup/completion, admin dialog, role authorization, scheduled-meal isolation, rider logout, desktop/tablet/mobile light/dark. Evidence: `artifacts/workspace-qa/results.json` and screenshots. Latest changes still need a final full check before publication.

The first integration test exposed non-atomic ORM conditional updates. Critical transitions were converted to SQL conditional writes and duplicate requests now pass. Interrupted fixture order 27 was removed after a narrowly scoped cleanup; associated fixture shop/account records may remain (not real customer data). Do not delete broad seller datasets. Auto-review previously rejected a broader cleanup; it allowed the exact sandbox-order cleanup.

Final verification completed: 39 unit tests, 9 sandbox API/browser groups, TypeScript and production build pass. Final lint has zero errors and the existing meal-plan image warning. See WORKSPACE-IMPROVEMENTS-REPORT.md for features, changed files and explicit limitations. Implementation is finished for this pass; do not restart or repeat it on a heartbeat.

Publication review: github1/main is at baseline 9720fab and can receive the scoped task commit. github2/main is at 2ca9f55; its outgoing ancestors include unrelated sibling-project deletion acd3cb4 and merge 9720fab. Do not push these to github2 without resolving that scope issue with the user. No history rewriting or force push. Artifacts and environment files must stay excluded. Stop the hourly resume automation after reporting this publication blocker; further coding is not needed to resolve it.
