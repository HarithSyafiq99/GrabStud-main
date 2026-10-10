# GrabStudent

A complete university carpool MVP with a lilac interface, animated campus illustration, responsive navigation, document approval, passenger-created journey requests and driver selection.

## Run locally

Requires Node.js 20 or newer.

1. Extract the ZIP and open the `GrabStud-main` folder in VS Code.
2. Copy `.env.example` to `.env.local`.
3. Open a terminal in this folder and run:

```bash
npm ci
npm run db:seed
npm run dev
```

Open http://localhost:3000.

Local admin: `admin@grabstudent.com` / `Admin123!`. This password is a development default only. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before seeding a remote database. The seed does not reset an existing account password.

## Open on your phone

The interface automatically adapts to small screens with bottom navigation, a slide-out account menu, stacked forms and booking cards, larger touch targets, and card views for history, approvals and activity. Inputs use a readable 16px font, and navigation accounts for phone safe areas.

Connect your phone and computer to the same Wi-Fi. Start the development server with:

```powershell
npm.cmd run dev -- --hostname 0.0.0.0 --port 3001
```

Open `http://YOUR_COMPUTER_LAN_IP:3001` in your phone browser. Find the computer's Wi-Fi IPv4 address using `ipconfig`; `localhost` on a phone refers to the phone itself. The computer and development server must remain running. A deployed site uses its normal public URL on both phone and desktop.

## Try the local demo

Set `NEXT_PUBLIC_DEMO_MODE="true"` in `.env.local`, then run:

```bash
npm run db:demo
npm run dev
```

| Account               | Email                     | Password    |
| --------------------- | ------------------------- | ----------- |
| Passenger             | passenger@grabstudent.com | Student123! |
| Driver                | driver@grabstudent.com    | Student123! |
| Admin (local default) | admin@grabstudent.com     | Admin123!   |

Demo shortcuts fill the form; they do not bypass authentication. Six passenger requests and a pending student are seeded only into a local SQLite database. Demo documents are clearly marked synthetic. Request dates are generated when seeded. Re-running updates example emails and phone numbers while keeping existing demo passwords and bookings; use a fresh local database if demo departure times are old. Real accounts can also be registered through `/register`.

Driver demo accounts also need a profile photo and car details in My profile before they can send fare offers.

## Features

- Login with hashed passwords and an HttpOnly signed session cookie.
- **Current Booking** sits at the top of the passenger dashboard and shows only the latest request, including completed or cancelled orders. Fare approval, cancellation, map pins and pickup remarks stay in that card. Earlier requests and offers are accessible in History; the separate Active Requests section is removed. Updates refresh after actions, every 10 seconds while visible, and when returning to the tab.
- Passenger or driver registration with a required phone number and any valid email address; image/PDF document upload with validation.
- Drivers add a mandatory passport-style profile photo and car colour, model/type and plate number. Passenger photos are optional. New photos require PNG/JPEG/WebP portraits, at least 350 × 450 pixels with a width/height ratio of 0.70–0.85, up to 5MB before processing. The picker shows face/background guidelines and a 350 × 450 preview, and requires the uploader to confirm the guidelines before applying it. The server checks actual image dimensions and format with [image-size](https://github.com/image-size/image-size#usage), capped at 300KB decoded. This is a constraints-and-confirmation flow, without automated face or background detection. Existing photos remain usable until replaced.
- Driver and passenger navigation includes **Profile** (`/profile`). The user's own avatar and display name in the sidebar/header, plus My profile, open the same overview card with their photo, name, account role/status, email and phone. Drivers also see car colour, model/type and plate number. **Edit profile** opens the editing dialog; saving refreshes the overview, while cancelling discards drafts. Users can edit their name, phone, photo and driver car details; registered email changes remain administrator-managed. Inactive registrations can still open the profile editor on their status screen.
- New passengers and drivers get a short, three-step welcome guide, saved per account. Returning approved accounts skip the guide during upgrades.
- Current users can add or edit their phone number; booking participants can view each other’s contact number.
- New users start pending; admins review student IDs and driving licenses.
- Admins must provide a rejection reason (1–1000 characters) when declining a registration or setting an account to rejected in Edit user. The decision and reason are saved together with an audit entry. The reason appears privately on that user's `/pending` registration status screen, including after sign-in, and refreshes every 15 seconds. No email service is required. Resubmission and approval clear the previous reason. Declined students can correct their profile and upload updated documents for another review.
- Pending approval refreshes every 15 seconds; passenger requests refresh every 10 seconds and driver requests every 20 seconds.
- Passengers fill blank pickup and destination address fields, without preset dropdowns. **Find on map** (or Enter) searches the address; choosing a match links it to the corresponding pin. Both pins are required when posting through the passenger dashboard. Only passengers can create booking requests.
- Each request includes **1–4 passengers**, including the person booking. The dashboard offers clear passenger-count choices and shows the selected total in current bookings. Drivers see the count before offering a fare and on selected bookings; it remains visible in history and CSV exports. Existing bookings default to one passenger.
- Passengers can tap the map, drag a pin or place it at the map centre. The matching address is looked up automatically and saved with that exact point. Editing an address clears its old pin. “Use my current location” requests permission on demand; declined permissions retain manual selection. If address lookup is unavailable or the place is unmapped, passengers can enter an address for the chosen pin and retry lookup. Saved pins remain attached to their booking.
- Drivers search passenger requests using any part of the pickup or destination name and filter by Malaysia departure date, then choose who to take. Passenger and driver booking cards offer a single **View location map** button to see saved pickup and destination pins together. Map access remains in booking history.
- Passenger booking by cash or QR **offline**. No payment processor is connected.
- Drivers choose an available passenger request and propose a price. Each request can have only one selected driver at a time.
- Drivers can tap the suggested fare for predefined campus routes or enter their own; custom routes ask drivers to enter a price after reviewing the locations. The price editor shows when a valid fare is ready to send.
- The offered fare covers the whole booking group. It is recorded once in the wallet and is not multiplied by the passenger count.
- Passengers review offers on their dashboard or booking history, then agree to book or decline.
- After fare agreement, Current Booking shows **Complete** with all three booking steps checked. Pickup reminders follow only this latest booking. Submitting a new order clears the previous pickup banner and popup without deleting the historical pickup record.
- Passenger requests, driver results (including route/date filters), selected bookings, history and history CSVs show the newest requests first by creation time. History status filters retain that order.
- Only passenger agreement confirms the booking. Transactions prevent two drivers from claiming the same passenger request.
- Confirmation checks the exact driver and fare reviewed by the passenger; stale offers cannot be accepted.
- Passenger cancellation closes their request or confirmed booking before departure.
- Declined or withdrawn offers reopen the request for another driver; the previous fare is cleared.
- Duplicate active requests for the same passenger, route and departure time are blocked.
- Passengers can add and edit pickup remarks such as an entrance or landmark; drivers see these beside each request.
- Booked drivers can send an “I’ve arrived” reminder. Passengers see their driver's photo and car details, then reply “I’m on my way.” Passenger updates refresh every 10 seconds while visible and on returning to the tab.
- Selected drivers can cancel bookings before departure. The Complete journey button has been removed and the action area focuses on pickup coordination.
- Driver arrival opens a passenger popup with the driver photo, car, plate, pickup and agreed fare. Passengers can reply “I’m on my way” or dismiss it; dismissed reminders stay in the dashboard banner and do not reopen on each refresh in the same browser tab. The first-visit guide and other dialogs take priority.
- Driver Wallet shows daily, weekly and monthly recorded fares with an animated cash/QR donut chart and recent journey fares. Tapping “I’ve arrived” records the booking’s agreed fare once, using the arrival date for Malaysia-time totals and Monday-start weeks. Unarrived, offered and cancelled bookings are excluded. Historical completed bookings without an arrival retain their departure date. The wallet refreshes every 20 seconds while visible and when returning to the tab. Direct cash/QR payment is not verified by the app.
- Ride history, status filter, CSV export and print view.
- Admin overview, student search, private document previews and system audit logs.
- The Driver hub's **Current Booking** shows only the latest assigned order, including completed or cancelled bookings. Earlier orders remain accessible in History; driver statistics still count all active offers and bookings.
- **Booking reports → Download PDF** and the **Monthly PDF archive** are available in History. Reports include route, passenger count, fare, booking status, pickup remarks/pins, vehicle details and pickup timestamps. Only an approved account's own reports are downloadable; administrators can download the complete booking report.
- Monthly cleanup starts just after the calendar month ends, at Malaysia midnight (28/29/30/31 days handled automatically). Completed monthly PDFs are stored in Turso before booking records are removed. Driver income is retained as daily cash/QR totals so daily, weekly and monthly wallet figures remain accurate. User accounts and audit logs are retained. Existing monthly PDFs remain downloadable after deletion; PDFs include the exact booking records as an attachment.
- Vercel runs the archive endpoint once daily at **16:00 UTC / 00:00 Malaysia time**. It starts a new archive only on the first day of the month; interrupted runs resume on subsequent days. Configure **CRON_SECRET** with a random value of at least 32 characters in Vercel Production and redeploy. **BOOKING_RETENTION_MODE=all** is the default and includes active bookings requested before the cutoff; use **closed** to retain active bookings, or an empty value to disable cleanup. Bookings updated after the cutoff wait until the next month. Archiving uses bounded batches, verifies saved PDFs, rejects concurrent changes, and atomically saves reports/income/deletion; a failure keeps the source bookings. See [Vercel's cron configuration](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
- Admins manage passengers, drivers and administrators through **All users → Edit user**. They can edit name, email, phone, student/account number, role, approval status, profile photo, driver car details and verification documents, and optionally set a new password. Existing passwords are never displayed. Login/access changes revoke old sessions; an admin editing their own account gets a renewed session. The last approved administrator cannot be demoted or deactivated. Stale edits and duplicate emails are rejected, and audit logs record changed field names without passwords or documents.
- **Edit user → Remove account** asks for confirmation, removes the account from all admin lists and counts, and revokes login and existing sessions. Administrators cannot remove their own account. Removal cancels pending/offered/booked journeys without an arrival update, releases legacy seat reservations, and closes the removed driver's open rides. Completed and already recorded arrival bookings remain intact so driver earnings and booking history are preserved. A retained account reference protects booking foreign keys; the original email is released for a separate new registration, which still requires approval. Removal is audited and stale or repeated removal requests are rejected.
- Responsive sidebar, branded page loading, hover effects, staggered card entry and animated SVG campus illustration. Reduced-motion preference is respected.
- Mobile bottom navigation, an accessible account drawer, single-column phone forms, touch-friendly order actions, and stacked history/admin cards.
- Subtle entrances for cards, dialogs and notifications; desktop hover feedback; focused form labels; document completion feedback; and animated status/total updates. Motion respects reduced-motion settings and hover effects are limited to mouse devices.
- The same centered GrabStudent animation covers page navigation, manual refreshes, filters, account actions, document reading, CSV downloads and booking updates. Automatic background updates use a smaller version of the logo. Concurrent requests share one loader, which clears after success or failure.
- Booking actions prevent duplicate submissions and display cancellation errors inside the confirmation dialog.

## Rules

Address lookup uses [Photon](https://github.com/komoot/photon) and OpenStreetMap data, through a passenger-authenticated server endpoint. Search runs when **Find on map** or Enter is pressed; map address lookup waits for pin movement to settle. Responses are cached and requests are throttled. Reverse lookup uses nearby streets/buildings and keeps the exact chosen coordinates. Set the optional server variable `GEOCODING_BASE_URL` to use another Photon-compatible instance. No map API key is required for the default setup; online service availability and mapped address coverage apply.

- Drivers need both Student ID and license to be approved.
- Uploads accept PNG, JPEG, WebP or PDF. Max 1.5MB each.
- Route rates are suggestions. Drivers propose the actual fare in RM (positive, up to two decimal places). The passenger must agree before the booking is booked.
- Each new request is for the passenger creating it. Driver-published rides and bookings against those rides are disabled for new orders.
- Location names must contain 2–160 characters. Coordinate pairs are validated and rounded to six decimal places. Pickup and destination must differ; places with the same name are allowed when their pins differ. Departures must be in the future.
- Requests move from pending (available to drivers) to offered (one driver selected the passenger and proposed a price), then booked (the passenger agreed).
- A selected request is hidden from other drivers. Declining the price or withdrawing the offer makes it available again.
- The internal accepted status represents a booked seat; screens display it as Booked.
- Expired or cancelled requests cannot be selected or confirmed.
- Only the requesting passenger or selected driver can manage their booking.
- API authorization checks current database status on every request, including existing sessions.
- Departure input, display and date filtering use Malaysia time (UTC+8).

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The integration suite starts its own server with an isolated temporary SQLite database, then removes it. It verifies document requirements, approval, role restrictions, fare validation, price offers, passenger agreement, competing driver selection and stale-offer protection, phone validation, legacy database migration, cancellation, repeat booking, ride completion, resubmission and reports. Integration tests use `.next-test` for generated files so a running development server keeps its own `.next` output. Set `GRABSTUDENT_DIST_DIR=.next-build` for an isolated production build.

Address formatting, caching, malformed provider responses and exact reverse-pin retention are covered by `tests/geocoding.ts`. `node --expose-gc --import tsx tests/location-browser.mjs` runs the standalone headless Edge address workflow on Windows (set `EDGE_PATH` for a different browser executable). It uses temporary synthetic fixtures and intercepts map tiles and address lookups, including failure and delayed-response scenarios.

## Deploy on Vercel

Do not deploy using local SQLite. Vercel needs a persistent remote database.

1. Put the extracted project source in your GitHub repository. Do not commit `.env.local`, `data/*.db`, `node_modules` or `.next`.
2. Create a Turso/libSQL database.
3. Set these in Vercel Project Settings → Environment Variables:

| Variable              | Value                                 |
| --------------------- | ------------------------------------- |
| TURSO_DATABASE_URL    | Your remote `libsql://…` URL          |
| TURSO_AUTH_TOKEN      | Database token                        |
| AUTH_SECRET           | Random secret, at least 32 characters |
| NEXT_PUBLIC_DEMO_MODE | false                                 |

4. To create your administrator, use those same remote database credentials in your local `.env.local`, set a unique `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run `npm run db:seed` once. Do not run `db:demo` against a remote database.
5. Import the repository in Vercel. Select **Next.js**, project root containing `package.json`, build command `npm run build`.
6. Deploy and sign in using your configured administrator account.

Schema initialization and upgrade are automatic on the first server request. Existing users and bookings are preserved; earlier bookings retain their driver, route, price and legacy seat accounting. Existing users with no phone number can add it using **Add phone number**. The original synthetic accounts and default example administrator are automatically moved from `.edu` to `.com` email addresses; existing passwords and bookings are preserved. Other user email addresses remain unchanged. Missing production secrets fail closed. A local SQLite URL is rejected on Vercel.

This is a working MVP. The platform relies on manual document review, does not independently validate enrollment/license authenticity and does not track live location or process online payments. Documents are stored in the access-controlled database as base64. For a larger public rollout, add dedicated private object storage, account recovery, distributed login throttling and university enrollment integration.

## Project map

- `src/app/(app)` — passenger, driver, history and admin screens.
- `src/app/api` — authenticated APIs and CSV reports.
- `src/components` — UI, navigation, uploads, illustration and booking offer controls.
- `src/lib` — sessions, SQLite/libSQL, schema, route prices and validation.
- `scripts` — schema initialization, admin seed and local demo seed.
- `tests` — meaningful end-to-end API integration checks.
- `PANDUAN_MULA.md` — quick Malay guide.
- `VALIDATION.md` — completed verification report.
