# Verification report

Verified on 2 October 2026 (Malaysia time).

## Booking and signup flow

Passengers create journey requests with pickup, destination, departure time and cash/QR payment. Drivers browse and filter those requests by route and Malaysia departure date, choose a passenger, and offer a price. Only the requesting passenger can agree and confirm the booking. Declining a price or withdrawing an offer reopens the request for another driver.

Both driver and passenger signup require a valid phone number and include an explanation of its use for pickup coordination. Existing users can edit their contact number.

## Automated verification

- ESLint and TypeScript passed.
- The optimized Next.js production build passed in the isolated .next-build folder.
- All 18 Node test results passed: 15 API integration scenarios, the parent suite, and two database migration tests.

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

## Deployment limits

The configured remote database upgrades on the next app request. Remote migration execution and public deployment were not performed during verification. Cash/QR payment remains offline.
