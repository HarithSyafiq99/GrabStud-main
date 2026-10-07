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
- The passenger request form includes a current-bookings list with request, driver-offer and booked progress, fare/arrival updates and links to booking details. It refreshes after actions and every 20 seconds.
- Passenger or driver registration with a required phone number and any valid email address; image/PDF document upload with validation.
- Drivers add a mandatory profile photo and car colour, model/type and plate number. Passenger photos are optional. Photos are resized for quick loading; both roles can update their details in My profile.
- New passengers and drivers get a short, three-step welcome guide, saved per account. Returning approved accounts skip the guide during upgrades.
- Current users can add or edit their phone number; booking participants can view each other’s contact number.
- New users start pending; admins review student IDs and driving licenses.
- Declined students can upload updated documents for another review.
- Pending approval refreshes every 15 seconds; request screens every 20 seconds.
- Passengers create requests with pickup, destination, departure time and cash/QR payment. Only passengers can create booking requests.
- Drivers filter passenger requests by pickup, destination and Malaysia departure date, then choose who to take.
- Passenger booking by cash or QR **offline**. No payment processor is connected.
- Drivers choose an available passenger request and propose a price. Each request can have only one selected driver at a time.
- Drivers can tap the suggested fare or enter their own; the price editor shows when a valid fare is ready to send.
- Passengers review offers on their dashboard or booking history, then agree to book or decline.
- Only passenger agreement confirms the booking. Transactions prevent two drivers from claiming the same passenger request.
- Confirmation checks the exact driver and fare reviewed by the passenger; stale offers cannot be accepted.
- Passenger cancellation closes their request or confirmed booking before departure.
- Declined or withdrawn offers reopen the request for another driver; the previous fare is cleared.
- Duplicate active requests for the same passenger, route and departure time are blocked.
- Passengers can add and edit pickup remarks such as an entrance or landmark; drivers see these beside each request.
- Booked drivers can send an “I’ve arrived” reminder. Passengers see their driver's photo and car details, then reply “I’m on my way.” Updates refresh automatically every 20 seconds.
- Selected drivers can cancel bookings before departure. The Complete journey button has been removed and the action area focuses on pickup coordination.
- Driver Wallet shows daily, weekly and monthly recorded fares with an animated cash/QR donut chart and recent journey fares. Totals include booked journeys after departure and completed journeys, exclude future/offered/cancelled requests, and follow Malaysia time with Monday-start weeks. Direct cash/QR payment is not verified by the app.
- Ride history, status filter, CSV export and print view.
- Admin overview, student search, private document previews and system audit logs.
- Admins manage passengers, drivers and administrators through **All users → Edit user**. They can edit name, email, phone, student/account number, role, approval status, profile photo, driver car details and verification documents, and optionally set a new password. Existing passwords are never displayed. Login/access changes revoke old sessions; an admin editing their own account gets a renewed session. The last approved administrator cannot be demoted or deactivated. Stale edits and duplicate emails are rejected, and audit logs record changed field names without passwords or documents.
- Responsive sidebar, branded page loading, hover effects, staggered card entry and animated SVG campus illustration. Reduced-motion preference is respected.
- Mobile bottom navigation, an accessible account drawer, single-column phone forms, touch-friendly order actions, and stacked history/admin cards.
- Subtle entrances for cards, dialogs and notifications; desktop hover feedback; focused form labels; document completion feedback; and animated status/total updates. Motion respects reduced-motion settings and hover effects are limited to mouse devices.
- The same centered GrabStudent animation covers page navigation, manual refreshes, filters, account actions, document reading, CSV downloads and booking updates. Automatic background updates use a smaller version of the logo. Concurrent requests share one loader, which clears after success or failure.
- Booking actions prevent duplicate submissions and display cancellation errors inside the confirmation dialog.

## Rules

- Drivers need both Student ID and license to be approved.
- Uploads accept PNG, JPEG, WebP or PDF. Max 1.5MB each.
- Route rates are suggestions. Drivers propose the actual fare in RM (positive, up to two decimal places). The passenger must agree before the booking is booked.
- Each new request is for the passenger creating it. Driver-published rides and bookings against those rides are disabled for new orders.
- Origin and destination must differ; departures must be in the future.
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
