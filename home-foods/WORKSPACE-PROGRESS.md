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
Not yet run for this task. No task commit or push yet. Work is incomplete.
