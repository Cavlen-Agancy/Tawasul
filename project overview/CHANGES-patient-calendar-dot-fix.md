# CHANGES-patient-calendar-dot-fix.md — Patient calendar detailed UX fix

## Files changed

- `pages/dashboard/appointments.vue`
  - CSS: `.fc-available` no longer paints the day number magenta/bold. It now
    renders an 8px magenta dot (`#e91e8c`) via `::after`, sharing the exact
    dot geometry with `fc-dot-confirmed`/`fc-dot-pending`; the number reverts
    to the default dark color.
  - Legend "Available day" swatch changed from bordered square to solid
    magenta circle (`rounded-full bg-[#e91e8c]`, `data-testid="legend-available-dot"`).
  - Panel refactored into the specified hierarchy: `fetchError` → error card
    (`day-error`) with Retry (`day-retry` → `retryLoad()`); else no
    `selectedDate` → skeletons while `isLoading` or month dates not yet loaded,
    else the prompt; else date heading → `panelLoading` skeletons → weekend
    message (`day-weekend`, no button) → booking cards (unchanged) →
    `availableSlots` section headed "Other available times on this day:"
    (spaced with `mt-4` when bookings precede it) → empty state (`day-empty`,
    unchanged copy/buttons).
  - `dateClick` unchanged for weekends (still clickable; panel explains why);
    added clarifying comment. Past/holiday/other-month guards unchanged.
  - Root container carries `:data-testid="'available-dates-count-' +
    availableDates.length"` for diagnostics.
  - New `retryLoad()`: clears the error, reloads the current month,
    re-selects the selected date (bookings + slots), and remounts the calendar.
- `modules/patient/composables/usePatientDashboard.ts`
  - New `fetchError` state (`patient-fetch-error`) + `clearFetchError()`;
    both `fetchAvailableDates` and `fetchAvailableSlots` populate it with a
    user-friendly message on failure (existing `error` handling untouched).
  - New `isWeekend(dateString)` (Saturday = 6, Sunday = 0; part-parsed, so
    timezone-independent); exported with `fetchError`/`clearFetchError`.
  - `selectDate` always calls `fetchAvailableSlots(date)` (removed the
    `bookings.length === 0` guard) so booked days also list remaining free
    times; stale slots still cleared up front.
- `tests/e2e/patient-dashboard.spec.ts`
  - Saturday test rewritten: expects `day-weekend` closed message and asserts
    no `book-now-empty`/`day-empty`.
  - New: magenta `::after` dot color + non-magenta number + legend swatch.
  - New: booked (pending) day shows card + "Other available times" + slots.
  - New: aborted slots fetch → error card; Retry after unroute recovers to
    slots and clears the card.

## Files created

- None.

## Files deleted

- None.

## Assumptions

- Weekends are Saturday (6) and Sunday (0); the clinic is closed on weekends
  by policy (seed schedule is Mon–Fri).
- `fetchError` resets on every new availability fetch attempt.
- Slot buttons keep deep-linking to `/book?date=&time=`; empty-state
  "Book Now" keeps going to bare `/book`.
- One extra slots request per day click (even on booked days) is acceptable.

## Issues encountered

- None functional. The `fc-available` dot reuses the shared `::after` group
  (0.5rem = 8px, `1px auto 0` margin), so all three dots stay pixel-identical
  rather than following the prompt's `2px` margin literally.
