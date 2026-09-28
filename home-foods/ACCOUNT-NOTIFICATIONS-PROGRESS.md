# Account profile and header notifications

## Scope and decisions

The previous profile sections were read-only summaries with no profile mutation API. They now share one AccountProfile component for customer, seller, rider and administrator accounts. Manage Account > Edit Profile saves name and phone. Cancel discards the draft; failed saves retain entered values. Existing avatars remain displayed. No avatar upload provider is configured.

Email is read-only, following the user's explicit cancellation of email changes. There is no email-change UI or endpoint. The already-applied provisional schema migration is preserved, followed by a migration removing its empty email-change table.

Account Security allows changing a password after verifying the current password. Password changes and recovery increment User.authVersion, invalidate older sessions and revoke outstanding reset tokens. The existing recovery page remains linked. Real recovery email delivery still requires the existing email provider configuration; isolated token verification does not send email.

## Notifications

A single bell in the shared header sits immediately left of the cart. The previous floating Updates mount is removed. A desktop panel and mobile bottom sheet show timestamps, destinations, read status, individual read and mark-all actions. The unread count is calculated from owner-scoped rows with readAt = null, independent of the 100-row recent list; the badge hides at zero and shows 99+ above 99.

Notification records are persisted from existing backend events with unique per-user event keys. Visible pages poll every 20 seconds and refresh on focus. Read state persists across browser refreshes and sessions/devices. API queries and mutations are restricted to the authenticated owner.

Supported event sources:
- Customers: accepted, preparing, ready, rider assigned, picked up, in transit, delivered, cancelled, delayed, failed and refund order events.
- Sellers: new orders, order/delivery changes, kitchen administrative audit updates.
- Riders: assignments, accepted/cancelled/failed/delayed/delivered events and account verification/status audit updates.
- Administrators: pending kitchen approvals, unverified riders and failed/delayed delivery events.

Notifications link to specific order cards or administrative records. Completed/cancelled customer orders and seller history targets reveal the matching tab. New unassigned-job broadcasts, proactive meal-plan reminders and unsupported payment/support event sources were not fabricated. Synchronization reads bounded recent order/event history; this is not a full historical event archive.

## Database and API

- User.authVersion and Notification model with user relation, unique eventKey and user/createdAt index.
- Applied migrations: 20260927T2020_account_notifications and 20260927T2036_remove_cancelled_email_change.
- Final contract hash: 16e95f66860db533af7e42ceba52221c73927c8c4667586b2931f661cb6e7671.
- GET/PATCH /api/account; expanded safe fields in /api/auth.
- GET/PATCH /api/notifications replaces browser-local seen IDs with persistent owner-scoped read state.
- Password reset now revokes sessions and all reset tokens.

## Verification completed — 28 September 2026

- TypeScript, 48 unit tests, lint and production build passed in the final verification cycle. Lint has one pre-existing next/no-img-element warning in app/meal-plans/page.tsx.
- All-role Chrome checks passed at 390 and 1440 pixels in both themes: profile persistence, sidebar update, role/owner/email tampering rejection, wrong password, notification count/read state/ownership, cross-session persistence, new-event deduplication, live polling and delivered-order navigation.
- Final browser repeat including isolated password recovery passed (exit 0). The recovery token is single-use and old sessions are rejected. Final build exited 0.
- prisma db verify passed: database schema and marker match the final contract.
- Temporary browser fixtures were removed by the verification script.
- Local preview restarted on http://localhost:3000. No private IPv4 address was available to the LAN launcher; phone access requires reconnecting the host to trusted Wi-Fi.

## Git scope

Current main tracks github2/main. github1/main is the eligible destination after final verification. github2/main remains blocked by unrelated outgoing history including acd3cb4 (Delete Ravintola v2 directory); do not push that range or rewrite history. Exclude artifacts, next-env.d.ts, environment files and unrelated changes from the commit.

Implementation files: app/account-experience.css; app/api/account/route.ts; app/api/auth/route.ts; app/api/auth/reset-password/route.ts; app/api/notifications/route.ts; app/layout.tsx; app/orders/page.tsx; app/workspace/page.tsx; src/components/account-profile.tsx; src/components/app-shell.tsx; src/components/operational-dashboard.tsx; src/components/order-notifications.tsx; src/components/site-enhancements.tsx; src/lib/auth.ts; src/lib/account-notifications.ts; src/lib/profile-policy.ts; src/prisma/contract.*; the two migration packages and their snapshots; tests/profile-policy.test.mjs; scripts/check-account-experience.ts.

The sole sidebar theme toggle, disabled development distance restriction and held production-readiness work are unchanged.
