# CHANGES-patient-calendar.md — Patient Appointments Calendar View

## Files changed

- `pages/dashboard/appointments.vue` — Tabs/cards UI replaced with a FullCalendar month view (default) starting Saturday (`firstDay: 6`), custom month nav + Today button, legend, and a panel below the calendar. `dayCellClassNames` marks past dates (`fc-past`), holidays (`fc-holiday`), booking states (`fc-dot-confirmed` green / `fc-dot-pending` yellow / `fc-dot-cancelled` gray, confirmed wins on overlap) and free-slot days (`fc-available` magenta). `dateClick` ignores past/holiday dates (holiday shows an info toast); otherwise selects the date and loads panel data. The panel shows booking cards (doctor name or "Unknown Doctor" when `doctorId` is null; status badge Confirmed/Under review/Cancelled; Join active 5 min before with fallback tooltip; Cancel when >24h with confirmation modal that refreshes the calendar dot), free-slot buttons navigating to `/book?date=&time=`, or an empty state with Book Now. 60-second interval refreshes Join state; skeletons while loading. Scoped CSS for all cell states.
- `modules/patient/composables/usePatientDashboard.ts` — Added state `allBookings`, `availableDates`, `availableSlots`, `selectedDate` and methods `fetchAllBookings()` (`?tab=all`), `fetchAvailableDates(month, year)`, `fetchAvailableSlots(date)`, `fetchBookingsForDate(date)` (local filter), `selectDate(date)` (sets date, fetches slots only when the day has no bookings); `cancelAppointment` now also flips the entry in `allBookings` to `CANCELLED`; `clear()` resets the new state. Existing methods untouched.
- `modules/patient/composables/types.ts` — `Appointment` gained `doctorId: string | null`.
- `modules/patient/server/api/patient/appointments.get.ts` — Response now includes `doctorId` per booking (`status` and `"Unknown Doctor"` fallback were already present).
- `modules/booking/pages/book.vue` — `onMounted` reads `?date=YYYY-MM-DD&time=HH:MM`; with both valid it resolves the real slot via `fetchAvailableSlots` and calls `selectSlot` (lands on the Review step); invalid/partial params or unmatched slot gracefully stay on Step 1.
- `tests/e2e/patient-dashboard.spec.ts` — Tabs tests replaced with calendar tests (Saturday header, past/holiday no-action, confirmed card + disabled Join + tooltip + Cancel, pending Unknown Doctor/Under review without buttons, in-window Join navigation, out-of-window Join disabled, slot → `/book` prefill → review, cancel → Cancelled state + grey dot, mobile no-overflow); added a PENDING `doctorId: null` fixture (+10 days) with cleanup; doctor redirect test targets `/doctor/calendar`.
- `tests/e2e/booking.spec.ts` — Stale end-to-end test updated to the current PENDING model: expects "Booking Request Received" heading and asserts `status PENDING`, `doctorId null`, payment `SUCCESS` via the `bookingId` URL param.
- `tests/api/patient/appointments.get.test.ts` — Added test: pending booking returns `doctorId: null` with name "Unknown Doctor"; extended the local `Appointment` test interface.

## Files created

- `composables/useHolidays.ts` — Client-safe wrapper re-exporting `getEgyptianHolidays` / `isHoliday` from `server/utils/holidays.ts`.

## Files deleted

- None.

## Assumptions

- All `@fullcalendar/* ^6.1.21` packages (core, vue3, daygrid, timegrid, interaction) were already installed; no install needed.
- `server/utils/holidays.ts` is pure static data with zero Node imports (verified), so the client bundle can import it directly.
- `GET /api/booking/available-dates`, `GET /api/booking/available-slots`, and `POST /api/booking/create` (`{date, startTime}` → `doctorId: null`, `PENDING`) were already correct; no server changes needed (Steps 6–7 confirmed, no edits).
- Calendar/header copy stays LTR English ("My Appointments"); sidebar label already correct (Step 12 confirmed, no edit).
- `usePatientDashboard.fetchAvailableDates/fetchAvailableSlots` have no dedicated unit tests: they are thin `$fetch` wrappers (untestable outside Nuxt context); coverage comes from the pre-existing endpoint tests (`available-dates.get`, `available-slots.get`) plus the new E2E slot flow and the new `doctorId`-null API test.

## Issues encountered and resolutions

- `timeZone: 'Africa/Cairo'` on the FullCalendar options corrupted the rendered grid (anchor September but grid rendered August month view, so date cells for the target month did not exist). Removed the option; local-time rendering matches Egypt time in this deployment's timezone (UTC+3), and all date math (slots, windows, API) is calendar-day based. Verified via DOM dump: grid now starts Sat 2026-08-29 for the September view.
- `view.currentStart` can fall in the previous month (Saturday week start), which broke the month label and the test month-navigation helper. `datesSet` now uses `view.calendar.getDate()` as the anchor.
- FullCalendar does not re-evaluate `dayCellClassNames` when async data arrives, so dots/availability never appeared after fetch (and the cancel flow never updated the dot). Fixed with a `loadedMonthKey`-guarded single remount after each load (the remount's own `datesSet` returns early — no loop), plus a remount after cancel.
- The E2E slot test initially picked an available cell that also held bookings (panel showed bookings, not slots). Selector narrowed to available cells with no booking dots.
- Pre-existing stale `booking.spec.ts` end-to-end test asserted the old Confirmed-with-doctor model; updated to the current PENDING model as described above (failure reproduced before the fix, passes after).
