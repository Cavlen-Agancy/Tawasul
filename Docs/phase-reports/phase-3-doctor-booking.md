# Phase 3 — Doctor-Based Booking Foundation

## Objective
Require patients to choose an active doctor and calculate availability from that doctor's actual schedule, blocks, service, duration, and bookings.

## Implemented
- `getAvailableSlots(date, doctorId?)` and `getAvailableDates(month, year, doctorId?)` now filter by doctor, active doctor/user, blocked slots, holidays, global blocked dates, and active bookings/holds.
- Availability endpoints require `doctorId`, validate an active doctor, and return 404 for inactive/unknown doctors.
- New public `GET /api/public/doctors` returns active doctors with only safe fields.
- Booking creation requires `doctorId`, validates the doctor server-side, uses the doctor's slot duration/service, and persists the doctor.
- `/book` adds doctor cards, requires doctor selection before showing dates, adds session type, and clears prior selections when switching doctors.
- Homepage renders active doctor cards linking to `/book?doctorId=...`.
- Patient dashboard booking entry points now navigate to `/book`.
- Same-day rescheduling uses the booked doctor's availability and rejects doctor-less legacy rows for admin remediation.
- Added migration backfill for doctor availability.

## Files
- `server/utils/availability.ts`
- `server/utils/validation.ts`
- `server/api/public/doctors.get.ts` (new)
- `modules/booking/server/api/booking/available-dates.get.ts`
- `modules/booking/server/api/booking/available-slots.get.ts`
- `modules/booking/server/api/booking/create.post.ts`
- `modules/booking/server/api/booking/[id].patch.ts`
- `modules/booking/composables/types.ts`
- `modules/booking/composables/useBooking.ts`
- `modules/booking/pages/book.vue`
- `modules/patient/composables/usePatientDashboard.ts`
- `pages/dashboard/appointments.vue`
- `pages/index.vue`
- `modules/admin/server/api/admin/doctors/index.post.ts`
- `tests/api/booking/available-dates.get.test.ts`
- `tests/api/booking/available-slots.get.test.ts`
- `tests/api/booking/create.post.test.ts`
- `tests/api/booking/date-handling.test.ts`
- `tests/api/booking/[id].patch.test.ts`
- `tests/api/public/doctors.get.test.ts` (new)

## Tests
- Commands prepared:
  - `npm run test -- tests/api/public/doctors.get.test.ts tests/api/booking/available-slots.get.test.ts tests/api/booking/available-dates.get.test.ts tests/api/booking/create.post.test.ts tests/api/booking/[id].patch.test.ts`
- Execution: **NOT RUN** (task restrictions prohibit builds/full tests without approval).

## Status
- Implementation: **COMPLETE at code level**
- Automated verification: **NOT RUN**
- Manual verification: required (see checklist)

## Remaining Risks
- Doctor-switch UI behavior and doctor-specific date isolation are not browser-verified.
- Legacy doctorless bookings now require admin remediation for rescheduling.
- No-loaded test suite confirmation after API shape changes.

---

## Verification Results — 2026-11-09
- Focused API tests: **36/36 passed** across doctor listing, doctor availability, create, reschedule, webhook.
- Full Vitest: **46 files / 312 tests passed**.
- Playwright: doctor grid/pagination responsive checks, doctor selection, doctor switching, online flow, in-clinic flow — **all passed**.
- Defect fixed during verification: rescheduling to the current slot now excludes the booking being rescheduled from slot occupancy.
- Remaining: real payment provider, hold-expiry/late payment, and full legacy E2E suite are not verified.
