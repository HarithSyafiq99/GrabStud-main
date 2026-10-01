# GrabStudent

A complete university carpool MVP with a lilac interface, animated campus illustration, responsive navigation, document approval, driver ride management and passenger booking.

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

Local admin: `admin@grabstudent.edu` / `Admin123!`. This password is a development default only. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before seeding a remote database. The seed does not reset an existing account password.

## Try the local demo

Set `NEXT_PUBLIC_DEMO_MODE="true"` in `.env.local`, then run:

```bash
npm run db:demo
npm run dev
```

| Account               | Email                     | Password    |
| --------------------- | ------------------------- | ----------- |
| Passenger             | passenger@grabstudent.edu | Student123! |
| Driver                | driver@grabstudent.edu    | Student123! |
| Admin (local default) | admin@grabstudent.edu     | Admin123!   |

Demo shortcuts fill the form; they do not bypass authentication. Six sample rides, a pending request and a pending student are seeded only into a local SQLite database. Demo documents are clearly marked synthetic. Ride dates are generated when seeded. Re-running does not overwrite existing demo records; use a fresh local database if demo departures are old. Real accounts can also be registered through `/register`.

## Features

- Login with hashed passwords and an HttpOnly signed session cookie.
- Passenger or driver registration; image/PDF document upload with validation.
- New users start pending; admins review student IDs and driving licenses.
- Declined students can upload updated documents for another review.
- Pending approval refreshes every 15 seconds; ride screens every 20 seconds.
- Route and Malaysia-date filters; driver name, departure, seats and fixed prices.
- Passenger booking by cash or QR **offline**. No payment processor is connected.
- Driver accepts or rejects booking requests; accepts deduct exactly one seat.
- Transactional acceptance protects the last seat during concurrent requests.
- Passenger cancellation releases an accepted seat before departure.
- Cancelled or rejected bookings can be requested again without duplicate rows.
- Driver cancels rides or completes them after departure; booking status follows.
- Ride history, status filter, CSV export and print view.
- Admin overview, student search, private document previews and system audit logs.
- Responsive sidebar, skeleton loading, hover effects, staggered card entry and animated SVG campus illustration. Reduced-motion preference is respected.

## Rules

- Drivers need both Student ID and license to be approved.
- Uploads accept PNG, JPEG, WebP or PDF. Max 1.5MB each.
- Drivers cannot override the server's route rate.
- Seats are whole numbers from 1 to 4.
- Origin and destination must differ; departures must be in the future.
- Requests are pending until a driver accepts; a pending request does not reserve a seat.
- Full/departed/closed rides cannot be booked.
- Only the owning passenger or driver can manage their booking or ride.
- API authorization checks current database status on every request, including existing sessions.
- Departure input, display and date filtering use Malaysia time (UTC+8).

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The integration suite starts its own server with an isolated temporary SQLite database, then removes it. It verifies document requirements, approval, role restrictions, fixed pricing, concurrent seat acceptance, cancellation, repeat booking, ride completion, resubmission and reports. Run it separately from `npm run dev`/`npm run build`, because Next.js uses `.next` for generated files.

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

Schema initialization is automatic on the first server request. Missing production secrets fail closed. A local SQLite URL is rejected on Vercel.

This is a working MVP. The platform relies on manual document review, does not independently validate enrollment/license authenticity and does not track live location or process online payments. Documents are stored in the access-controlled database as base64. For a larger public rollout, add dedicated private object storage, account recovery, distributed login throttling and university enrollment integration.

## Project map

- `src/app/(app)` — passenger, driver, history and admin screens.
- `src/app/api` — authenticated APIs and CSV reports.
- `src/components` — UI, navigation, uploads, illustration and ride cards.
- `src/lib` — sessions, SQLite/libSQL, schema, route prices and validation.
- `scripts` — schema initialization, admin seed and local demo seed.
- `tests` — meaningful end-to-end API integration checks.
- `PANDUAN_MULA.md` — quick Malay guide.
- `VALIDATION.md` — completed verification report.
