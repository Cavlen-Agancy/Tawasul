# CHANGES-patient-calendar-friday-only.md — Patient calendar Friday-only closure

## Files changed

- `pages/dashboard/appointments.vue`
  - CSS updated to dot; panel logic refactored with error, Friday, bookings+slots, and empty states; added `data-testid`. (Dot CSS, legend magenta circle, error card + Retry, skeletons, bookings+slots section, empty state, and `available-dates-count-N` diagnostic testid carried over unchanged from the weekend variant.)
  - Closed-day branch now uses `isClosedDay(selectedDate)` with
    `data-testid="day-closed"` and message via `getClosedDayMessage()`
    ("The clinic is closed on Fridays." + "Please choose another day…", no
    button). `dateClick` comment updated (Fridays stay clickable on purpose).
- `modules/patient/composables/usePatientDashboard.ts`
  - Added `fetchError` state, `clearFetchError`, `isClosedDay` (Friday only,
    `getDay() === 5`, part-parsed so timezone-independent) and
    `getClosedDayMessage`; modified `selectDate` to always fetch slots.
    (The earlier `isWeekend` helper was replaced — it had no other callers.)
- `tests/e2e/patient-dashboard.spec.ts`
  - Weekend test replaced with `friday shows the clinic-closed message`
    (next-Friday finder with holiday skip; asserts `day-closed` text and no
    `book-now-empty`/`day-empty`).
  - New `saturday behaves like a normal weekday` (asserts no `day-closed`,
    standard empty message + visible Book Now — seed has no Saturday slots).

## Files created

- None.

## Files deleted

- None.

## Assumptions

- Friday is the only closure day; Saturdays are bookable if slots exist;
  `AdminSchedule` may or may not include Friday, but the UI will override with
  a message; the closed message is in English ("The clinic is closed on
  Fridays.").
- Note: the seed schedule still covers Mon–Fri, so Fridays can show magenta
  availability dots while the panel reports closed — per spec, the panel
  message is authoritative and no schedule/dot change was requested.

## Issues encountered

- None.
