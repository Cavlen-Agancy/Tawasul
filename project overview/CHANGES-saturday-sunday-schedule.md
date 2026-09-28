# CHANGES-saturday-sunday-schedule.md — Weekend schedule (Sat/Sun bookable)

## Files changed

- `prisma/seed.ts` — `AdminSchedule` seed widened from `[1,2,3,4,5]` to
  `[0,1,2,3,4,5,6]` (Sunday + Saturday added at 09:00–17:00, 60 min, active;
  Mon–Fri untouched). Seed log/comment updated. Applied via
  `npx prisma db seed` (upsert-based, no duplicates).
- `tests/api/booking/helpers.ts` — new `restoreSeedWeekendSchedules()`
  (upserts seed values for days 0/6). Several suites upsert day-0/6 rows and
  delete them in `afterAll`, which would otherwise destroy the seeded weekend
  rows the E2E suite relies on.
- `tests/api/booking/available-dates.get.test.ts` — restore wired into
  `afterAll`; new test asserting a future non-holiday Saturday is included in
  its month's available dates.
- `tests/api/booking/available-slots.get.test.ts` — restore wired in; new
  test asserting a future non-holiday Saturday returns slots; the
  "no availability" test now uses holiday `2027-01-07` (a Saturday can no
  longer serve as the slot-free example); stale Mon–Fri-seed comments updated.
- `tests/api/booking/create.post.test.ts` — restore wired in; the
  "slot no longer available" test now uses holiday `2027-01-07` instead of
  Saturday `2099-01-03` (which now legitimately has slots).
- `tests/api/booking/date-handling.test.ts` — restore wired into `afterAll`.
- `tests/api/booking/[id].patch.test.ts` — restore wired into `afterAll`;
  stale "outside the seeded Mon-Fri" comment corrected.
- `tests/e2e/patient-dashboard.spec.ts` — Saturday test now expects normal
  weekday behavior with free slots (`Other available times`, slot buttons, no
  `day-closed`, no `day-empty`).

## Files created

- None.

## Files deleted

- None.

## Assumptions

- The seed uses `upsert` so re-running never duplicates rows; session
  duration/times match the existing weekdays (09:00–17:00, 60 min).
- Friday remains in the schedule data; the Friday closure stays a UI-only
  override (`isClosedDay`, unchanged — Saturday/Sunday return `false`).
- The admin UI reflects the new rows automatically (reads `AdminSchedule`).

## Issues encountered

- Two API tests assumed Saturdays are slot-free (`2099-01-03`); repointed to
  the holiday `2027-01-07` (holidays short-circuit slot generation).
- Suite cleanups deleting day-0/6 schedule rows would have eaten the new seed
  rows; fixed with `restoreSeedWeekendSchedules()` in all five affected files
  (verified: all 7 seed rows intact after the full suite run).

## Verification

- Live API: September 2026 returns all 30 days; `available-slots` for Sat
  2026-09-12 and Sun 2026-09-13 return full slot lists.
- Full unit/API suite: **233/233 pass**; patient-dashboard E2E: **29/29 pass**.
