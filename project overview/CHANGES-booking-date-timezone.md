# CHANGES-booking-date-timezone.md — Booking calendar off-by-one (timezone) fix

## Problem

Patient books day X (e.g. 9 Sep); the booking appears on day X−1 (8 Sep) in the
calendar dot and day panel.

## Root cause (proven)

`Booking.date`, `BlockedSlot.date`, and `GlobalBlockedDate.date` are Prisma
`@db.Date` (bare calendar day, no time). The server wrote/queried them with
**local-midnight** `Date` objects (`new Date(y, m-1, d)`). On a UTC+X server
(this box is `Africa/Cairo`, UTC+3) local midnight = previous day 21:00 UTC,
and the pg driver serialises a `Date` to its **UTC** calendar day — so every
write/query shifted one day back. Verified by round-trip probe:

- `new Date(2026,8,9)` → raw DB `2026-09-08` → displayed Sep 8 (the bug)
- `new Date(Date.UTC(2026,8,9))` → raw DB `2026-09-09` → displayed Sep 9

The frontend was already correct (local `YYYY-MM-DD` strings end-to-end:
`toISODate`, string `===` compares, local display formatting). All corruption
happened at server `@db.Date` boundaries.

## Contract introduced

`server/utils/availability.ts` now documents and exports the single rule:

- write/query `@db.Date` only with `parseDateUTC('YYYY-MM-DD')` (UTC midnight)
- render readbacks only with `formatDateUTC(date)` (UTC components)
- never use local-time `parseISODate`/`formatDateISO` at these boundaries

`parseDateUTC` also fixes weekday derivation (`getUTCDay`); a UTC-midnight
`Date` yields the wrong `getDay()` on UTC−X servers.

## Files changed (prod)

- `server/utils/availability.ts` — new `parseDateUTC`/`formatDateUTC`;
  `getAvailableSlots`/`getAvailableDates` use UTC target, UTC month-range
  bounds, UTC readback comparisons (loop calendar strings stay local).
- `server/utils/admin-availability.ts` — same substitutions
  (`target`, `getUTCDay`, month bounds, blocked set, day bookings).
- `server/utils/meeting.ts` — derive session day with `formatDateUTC`
  (wall-clock `setHours` math unchanged; comment corrected).
- `modules/booking/server/api/booking/create.post.ts` — store UTC midnight
  (**the root write bug**).
- `modules/patient/server/api/patient/appointments.get.ts` — UTC `today`
  boundary (old local-midnight `today` serialised to the previous UTC day,
  leaking yesterday's rows into `upcoming`); UTC response dates.
- `modules/booking/server/api/booking/[id].get.ts`, `[id].patch.ts`,
  `[id]/cancel.patch.ts` (also its email date), `modules/patient/.../payments.get.ts`,
  `modules/doctor/.../bookings.get.ts` (+ UTC range), `.../bookings/[id].get.ts`,
  `modules/admin/.../bookings/index.get.ts` (+ UTC range, was implicit),
  `.../bookings/[id].get.ts`, `.../bookings/[id]/cancel.patch.ts` (email),
  `.../bookings/pending.get.ts`, `.../doctors/[id].get.ts` + `index.get.ts`
  (UTC month bounds), `.../availability/block.post.ts` (UTC target),
  `.../blocked-dates/index.post.ts` (UTC write/lookup),
  `.../blocked-dates/index.get.ts` (UTC start-of-today),
  `.../patients/index.get.ts`, `.../overview.get.ts`, `.../payments/index.get.ts`
  — UTC response dates.
- `modules/admin/composables/useAdminDashboard.ts` — calendar-day display no
  longer constructs `Date` from date-only strings (flips days on UTC−X
  browsers); date-only strings pass through, ISO instants use their UTC day.

## Files changed (tests/fixtures)

- `tests/api/booking/date-handling.test.ts` (**new**, 2 tests) — create stores
  the exact requested day (asserts raw `date::text`, `[id]` readback, and
  `appointments?tab=all`); a CONFIRMED booking blocks its slot on its own day.
- `tests/api/booking/helpers.ts` — `createTestBlockedDate` writes UTC midnight.
- `tests/api/booking/[id].patch.test.ts` — Saturday fixtures write UTC midnight;
  schedule uses `dayOfWeek: 6` (was `0`/Sunday, previously passing only via the
  seed's Friday schedule after the old double-shift).
- `tests/api/booking/[id].get.test.ts` — fixture writes UTC midnight.
- `tests/utils/availability.test.ts` — mocked DB readbacks are UTC-midnight
  (as the real client returns); one loop mock uses `Date.UTC`.
- `tests/utils/meeting.test.ts` — booking date models a real readback
  (UTC midnight); wall-clock expectations unchanged.
- `tests/e2e/patient-dashboard.spec.ts` — `beforeAll` booking dates wrapped in
  `utcDay()` so fixtures land on the intended local day in any timezone
  (frontend navigates by local-day strings).

## Files created

- `tests/api/booking/date-handling.test.ts`

## Files deleted

- None.

## Assumptions

- Calendar days are clinic-local days chosen by the user; session wall-clock
  times (`HH:MM`) are interpreted in server-local time for join/cancel windows
  (unchanged semantics in Cairo; the day part no longer flips anywhere).
- "Today" boundaries use the server's local calendar day expressed at UTC
  midnight, so `@db.Date` partitions stay exact in every timezone.

## Verification

- New regression tests **fail on the old code** (`expected '2026-09-19' to be
  '2026-09-20'`, slot still listed as free) and pass on the fix.
- Full unit/API suite: **230/230 pass** (39 files).
- E2E: `patient-dashboard` **23/23**, `booking` **3/3**, `auth` 9/11 — the two
  auth failures (`doctor → /doctor`, `staff → /admin`) reproduce identically on
  pristine code (verified via `git stash`), i.e. pre-existing and unrelated.
- Manual multi-timezone check (STEP 9) is structural: all boundaries now use
  UTC-midnight writes + UTC-component reads, which are timezone-independent by
  construction; Cairo manual re-verification is available on `:3000`.
