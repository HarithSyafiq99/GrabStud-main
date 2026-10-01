# Verification report

Verified on 1 October 2026 (Malaysia time).

## Automated API integration

13 scenarios passed (14 Node test results including the parent suite), using an isolated SQLite database and a real Next.js server:

1. Unauthenticated and cross-origin requests blocked.
2. Admin login, file-format and required-document validation.
3. Pending accounts blocked from posting and booking.
4. Current database approval respected by existing sessions, including page navigation before JWT refresh.
5. Departure time, route uniqueness, passenger role and 1–4 whole-seat validation.
6. Server-enforced route rate; supplied custom pricing ignored.
7. Duplicate requests and unauthorized booking decisions blocked.
8. Two simultaneous accepts for one remaining seat: exactly one succeeds; seats stay at zero, never negative.
9. Passenger cancellation restores one accepted seat; repeat cancellation blocked.
10. Cancelled and rejected requests can be submitted again without uniqueness errors.
11. Ride cancellation propagates to pending/accepted bookings; completion only after departure.
12. Revoked approval blocks writes immediately; rejected accounts can resubmit documents.
13. Admin history, notifications, audit logs, CSV exports and report access restrictions.

Run again with `npm test`. The temporary database is removed when the suite exits.

## Browser checks

19 checks passed in Chromium via Playwright, with no browser JavaScript errors.

- Desktop viewport: 1440px.
- Mobile viewports: 390px and 320px.
- No unintended horizontal page overflow on tested screens. Wide data tables scroll inside their panels.
- Login for all three roles, passenger booking and driver acceptance.
- Notification panel opens and closes.
- Mobile navigation opens and follows the bookings link.
- Booking cancellation confirmation opens and dismisses.
- Admin document preview opens and closes with Escape.
- Driver registration reveals its required license upload.
- Reduced-motion preference disables the animated car.

Seven screenshots are included in `docs/screenshots`. They use synthetic demo accounts and documents. Screenshots show the application running; entrance animations were finished before capture.

## Source checks

- ESLint: passed.
- TypeScript: passed through the production build.
- Next.js optimized production build: passed.
- Runtime dependency audit (`npm audit --omit=dev`): zero reported vulnerabilities at verification time.
- Dependencies use the patched Next.js 15.5.27 release. PostCSS is overridden to a patched compatible 8.5 release and the resolved version is pinned by `package-lock.json`.

## Deployment status

Local behavior was tested. No public deployment or live remote Turso database has been created or tested. Configure your own remote database and authentication secret using README before deploying to Vercel. Cash/QR payment is offline and no live GPS or payment gateway is connected.
