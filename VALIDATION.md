# Verification report

Updated on 7 October 2026 (Malaysia time).

## Booking and signup flow

Passengers create journey requests with pickup, destination, departure time and cash/QR payment. Drivers browse and filter those requests by route and Malaysia departure date, choose a passenger, and offer a price. Only the requesting passenger can agree and confirm the booking. Declining a price or withdrawing an offer reopens the request for another driver.

Both driver and passenger signup require a valid phone number and include an explanation of its use for pickup coordination. Existing users can edit their contact number.

## Automated verification

- ESLint and TypeScript passed.
- The optimized Next.js production build passed in the isolated .next-build folder.
- All 24 Node test results passed: 19 API integration scenarios, the parent suite, two database migration tests and two wallet calendar-boundary tests.

The API tests cover signup phone numbers and documents for both roles; current account approval; passenger-only request creation; disabling driver-published booking; route, departure and payment validation; duplicate requests; destination and Malaysia-date filters; exactly one winner when two drivers choose the same passenger; price validation; passenger-only confirmation; rejecting stale driver and price offers; decline and withdrawal; scoped cancellation; departure and completion rules; editable phone numbers; unassigned requests in history and CSV; notifications, logs and document resubmission.

Migration tests cover both the original fixed-fare schema and the existing price-offer schema. Existing accounts, passwords, routes, assigned drivers, fares, bookings and seat counts are preserved. The new schema allows requests without a published ride or assigned driver. Upgrades are repeatable and foreign keys remain valid.

Tests use temporary local databases and a real Next.js server. Test output uses .next-test, while the developer's running server uses .next. Windows cleanup stops only the test server process tree and releases SQLite file handles before deleting its temporary database.

## Mobile browser verification

The driver price-offer, passenger agreement (dashboard and history), and admin approval buttons share hover and press feedback, a loading spinner, and an animated success checkmark after a successful server response. Buttons remain disabled until the update finishes and include keyboard focus and screen-reader status announcements. Reduced-motion preferences disable the animations.

The responsive interface adds bottom navigation, an account drawer with focus management and scroll locking, stacked forms and order actions, 44px or larger button targets, 16px inputs, safe-area spacing, and card views for history, approvals and activity. Desktop layouts remain available above 900px.

Headless Microsoft Edge checks used an Android user agent, touch emulation, an isolated local production server and temporary SQLite fixtures. All 56 layout checks passed: login, signup, passenger, driver, history, approvals, activity and pending approval at widths of 320, 375, 390, 430, 768, 844 (landscape) and 1280 pixels. Checks covered horizontal overflow, control bounds, mobile control heights and bottom-navigation visibility. Additional interaction checks passed for drawer focus and Escape dismissal, closed-drawer inertness, scroll locking, notifications, the phone editor, driver signup document fields, document previews and reduced motion. No browser runtime exceptions were observed.

Current mobile previews are saved as docs/screenshots/mobile-\*.png; the other screenshots show the earlier interface. The development login page returned HTTP 200 using the computer's LAN address. Physical Android/iPhone and Safari checks were not performed.

## Booking feedback and fare entry

Saving a booking update now shows a centered GrabStudent logo with an animated ring, action-specific status text and loading dots. The portal covers the viewport on phone and desktop, locks scrolling, prevents background interaction and restores focus after the update. Successful confirmations show a checkmark; failed requests clear the loader and retain retry controls. Cancellation errors are displayed inside the confirmation dialog.

Drivers explicitly choose a suggested fare or enter a custom amount. The fare editor includes an RM prefix, decimal keyboard, validation, readiness feedback and a disabled submit button until the fare is valid. Choosing the suggestion fills the input and focuses it without sending an offer. Enter submits the same form as the button.

Headless Edge checks at widths of 320, 390, 768 and 1280 pixels passed for fare layout, suggested-price entry, custom fare entry, invalid-price blocking and submit readiness. Additional production-server checks passed for Enter submission, the exact saved fare, delayed-request loading placement, focus locking, reduced motion, passenger confirmation, passenger/driver/history cancellation, admin approval, failed-offer cleanup and retry. Cancellation failure checks on all three booking screens passed for visible dialog errors, retry controls and restored focus. Temporary fixtures were used; existing bookings were not changed. Updated previews are mobile-fare-entry.png and mobile-booking-loading.png.

Browser testing uncovered a request-origin check that rejected valid local submissions because NextURL normalizes loopback addresses. The check now compares the browser Origin against the incoming Host and protocol; different-host, different-protocol, opaque and malformed origins remain blocked. All 18 API/migration results passed after adding browser Origin headers to the integration client and extending origin rejection checks. Lint, TypeScript and the isolated production build passed.

## Shared loading feedback

Page navigation, initial data loading, manual refreshes, filters, sign-in, signup, sign-out, approval checks, phone saves, document reading and CSV downloads now use the existing centered GrabStudent animation. Booking and approval actions keep their specific status text and success feedback. Automatic booking, notification and approval checks show a smaller version of the same logo without blocking the page.

One shared loading store tracks overlapping requests and clears in failure paths as well as successful ones. The centered overlay traps focus and blocks background interaction; its scroll lock works together with the mobile account drawer. Page fallbacks show the branded card before hydration, and navigation links display the loader while awaiting a route response. Reduced-motion preferences remain respected.

All 19 isolated headless Edge checks passed at a 390 × 844 mobile viewport: initial loading; overlapping requests; failed refresh cleanup; unobtrusive polling; filter submission; phone save with drawer scroll locking; delayed navigation; failed and successful CSV downloads; passenger, admin and activity refreshes; pending approval polling; sign-in transition; failed and successful sign-out; document reading; reduced motion; and absence of runtime exceptions. Downloads and database changes were confined to temporary fixtures. Lint, TypeScript and the optimized production build passed after the shared loader changes.

## Interface motion

Short fades and small movements now accompany page headings, booking cards, dialogs, notifications, notices and document previews. Desktop cards and navigation icons respond to hover, inputs highlight their labels, and role selection has subtle icon feedback. Status badges and dashboard totals animate only when their values change; unchanged polling responses preserve their elements. Reduced-motion preferences disable animation and hover movement. No animation dependency was added.

Entrance effects finish without retaining a transform, allowing subsequent hover feedback and preventing page containers from changing the positioning of fixed dialogs. Pointer hover effects are limited to devices with a fine pointer and hover support.

Headless Edge checks passed for 28 page layouts: login, signup, driver, passenger, history, approvals and activity at widths of 320, 390, 768 and 1280 pixels. Another 15 checks passed for finite entrances, desktop card/navigation hover, form focus, viewport-sized dialogs, notifications, unchanged polling, changed status/totals, failed-request notices and loading cleanup, driver role selection, document preview feedback, reduced motion, visible mobile dialogs, print layout and absence of runtime exceptions. Tests used isolated accounts and bookings. Lint, TypeScript and the production build passed. A mobile dialog preview is saved as docs/screenshots/mobile-phone-animation.png.

## Pickup coordination, profiles, first visit and wallet

The Complete journey button is removed. Driver cards group passenger information and pickup remarks beside the fare/status and arrival actions. Passengers can add a 300-character pickup note when requesting a journey and edit it later. Assigned drivers can send an arrival reminder only for a booked journey; the requesting passenger can reply that they are on their way. Both sides see the saved updates through the existing 20-second refresh. Repeated arrival and acknowledgment requests preserve their original timestamp and do not duplicate audit entries. Unrelated accounts and inappropriate roles cannot update these messages.

Driver signup requires a valid image profile photo and car colour, model/type and plate number. Passenger photos remain optional. The client crops photos to a 256-pixel square JPEG and the server accepts bounded PNG/JPEG/WebP data URLs. Both roles can change their photo and contact details in My profile. Drivers can edit car details. Passenger booking cards show the selected driver's photo, car and plate; admins can inspect photos and car details during approval. Existing bookings and accounts survive migration. Older drivers need to complete their profile before sending new fare offers.

New approved passengers and drivers receive a three-step guide with a short fade, focus management and saved completion/dismissal. The upgrade marks returning approved accounts as already introduced; older pending accounts and new registrations remain eligible for the guide. Shared interaction and scroll locks prevent profile dialogs and loading overlays from leaving the page blocked when they close in either order.

The driver-only Wallet uses actual booking fares in sen. Daily, Monday-start weekly and calendar-month totals follow UTC+8. Only accepted/completed bookings with a passed departure time contribute; offered, pending, cancelled and future bookings do not. The animated donut splits cash and QR amounts and has a readable legend. Empty wallets display zero with a neutral ring. These are recorded fares, not a verified payment balance; cash/QR is collected directly. Tests cover Malaysia midnight, Sunday/Monday, new year and leap February boundaries.

All 24 automated results passed, including per-account tutorial persistence, photo and car validation, profile isolation, pickup permissions and repeat safety, and driver-only wallet calculations. The production build, lint and TypeScript checks passed. All 45 browser checks passed, covering the complete driver/passenger message flow, failure/retry feedback, resized photo uploads, profile saves and refreshed permissions, both guides, returning-user behavior, wallet totals, empty states and reduced motion. Layout checks covered driver, passenger, wallet, signup, history and approvals at widths of 320, 390, 844 and 1280 pixels; additional checks covered the driver photo/car signup fields. Temporary databases and synthetic fixtures were used throughout. No runtime or hydration errors were observed. Previews are mobile-driver-guide.png, mobile-passenger-arrival.png and mobile-driver-wallet.png.

## Password recovery removal

Password recovery was removed at the user's request because real email delivery was not configured. The login link, recovery screens, verification/reset endpoints, administrator reset-link action, mail code and unused email settings are removed. Fresh databases no longer create recovery tables. Existing database contents, account passwords and session versions are preserved; no live database rows or tables were deleted.

All 25 automated results passed, including normal sign-in, absence of the login recovery link, and HTTP 404 responses for the removed screens and endpoints with an authenticated session. The development login page returned HTTP 200 without a recovery link. Lint, TypeScript and the optimized production build passed. The production route manifest contains no recovery routes. Tests used a temporary local database.

## Passenger current-bookings list

The passenger journey-request area includes a current-bookings list beside the form on wide screens and beneath it on phones. Each entry shows its route, Malaysia departure time, waiting/offer/booked state, a three-step progress indicator and a link to the matching detailed booking card. Offers show the driver's name and fare; confirmed bookings show arrival and pickup acknowledgment updates. Expired requests show that the departure time has passed. Cancelled bookings leave the list through the existing active-bookings API. The list uses the same booking state as the dashboard, updating after actions and every 20 seconds, with manual refresh available.

All 16 isolated headless Edge checks passed for empty state, form submission, driver offer/fare, booking confirmation, details navigation, arrival, acknowledgment, expired requests, cancellation counts, reduced motion and absence of runtime/hydration errors. Layout and touch-target checks passed at widths of 320, 390, 844 and 1280 pixels. Tests used synthetic accounts and a temporary database; existing users and bookings were not changed. Lint, TypeScript and the production build passed. The mobile preview is docs/screenshots/mobile-current-bookings.png.

## Administrator account editing

The admin dashboard defaults to All users, including administrators, passengers and drivers. Every row offers an accessible edit dialog for name, email, phone, student/account number, role, approval status, profile photo, verification documents and driver car information. A separate checkbox enables setting and confirming a new password; existing passwords and hashes are never returned to the dashboard. Documents can be replaced, removed and previewed inside the editor. Driver approval still requires a photo, car information, Student ID and license. Account IDs and creation timestamps are read-only.

Updates require current approved administrator access. Input validation rejects unsupported fields, invalid files, invalid contacts and oversized passwords, including the bcrypt UTF-8 byte limit. Duplicate-email checks, stale-editor detection, account updates and audit entries run in a write transaction. Audit entries contain the target account ID and changed field names; they do not contain passwords, hashes or files. Email, password, role and status changes revoke previous sessions. An admin updating their own account receives a renewed session and routes to the appropriate screen after an access change. The last approved administrator cannot be demoted or deactivated. Inactive administrators cannot use admin APIs and see an inactive-access screen after sign-in. Existing account IDs and bookings remain intact.

All 30 automated results passed, including admin-only edits, all-role account editing, new-password sign-in, old-session rejection, account/booking preservation, duplicate email races, invalid file/password inputs, stale concurrent edits, driver requirements, admin self-edit and inactive admin permissions. All 19 isolated headless Edge checks passed for the editor, private document preview/replacement, resized photo upload, password confirmation, duplicate-email feedback/retry, actual saves, driver car edits, roles/status, last-admin feedback, self-password editing, focus management, reduced motion and absence of runtime/hydration errors. Layout checks covered 320, 390, 844 and 1280 pixel widths. Lint, TypeScript and the optimized production build passed. Tests used synthetic accounts and temporary local databases; no existing account credentials were changed. The mobile preview is docs/screenshots/mobile-admin-user-editor.png.

## Deployment limits

The configured remote database upgrades on an authenticated app request. Automated and browser checks use temporary databases; public deployment was not performed. Cash/QR payment remains offline.
