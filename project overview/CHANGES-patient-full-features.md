# CHANGES-patient-full-features.md — Patient Appointments Full Features

## Files changed

- `pages/dashboard/appointments.vue`
  - Calendar day cells now render booking state with confirmed → pending → available priority:
    - `fc-dot-confirmed` (green dot) when the patient has a CONFIRMED booking that day.
    - Else `fc-dot-pending` (yellow dot) when PENDING.
    - Else `fc-available` (magenta day number) when the day has free slots.
    - Past dates → `fc-past` (dimmed), holidays → `fc-holiday` (grey, line-through).
    - Removed the `fc-dot-cancelled` state and its legend entry so cancelled days no longer show a dot (they surface as available if slots remain, or plain otherwise).
  - All future, non-holiday dates are clickable regardless of bookings; the day panel shows all bookings (any status) for the selected date, plus free-slot buttons or the "No appointments…" empty state.
  - Booking cards:
    - Pending (Under review): "Edit" + "Cancel" buttons (Edit only if session is still in the future).
    - Confirmed: "Join Session" (window-gated) + "Cancel" (>24h, unchanged).
    - Cancelled: greyed-out badge, no buttons.
  - New "Reschedule appointment" shadcn Dialog:
    - Shows current date/time, fetches available slots for the same date via `GET /api/booking/available-slots`, marks the patient's current slot "(current)", filters past times on today, renders slot buttons, skeleton while loading, and an empty state when no other slots exist.
    - Confirm is disabled until a different slot is selected; on confirm it calls `PATCH /api/booking/:id` with `{ startTime }`, shows a success toast, re-fetches bookings + available dates for the month, refreshes the panel, and remounts the calendar so dots update. Errors surface inline (`edit-error`) without closing the dialog.
  - Legend now: Confirmed (green), Under review (yellow), Available day (magenta), Holiday / Past (grey).
- `modules/patient/composables/usePatientDashboard.ts`
  - New `updateBookingTime(bookingId, startTime)`: `PATCH /api/booking/:id` with `{ startTime }`, updates `allBookings` in-place, throws on error via `getApiMessage`.
  - `AvailableSlot` gains an optional `current?: boolean` flag.
- `tests/e2e/patient-dashboard.spec.ts`
  - Pending-booking test asserts the `fc-dot-pending` class plus Edit/Cancel buttons.
  - Legend-order test updated (Cancelled removed from the legend).
  - Cancel test now asserts no Cancel/Join/Edit buttons remain on a cancelled card (dot assertion replaced).
  - New `formatTime` helper and new test: *"edit opens modal, reschedules pending booking, and refreshes"*.
  - `free slot pre-fills` test selector simplified (dropped the `:not(.fc-dot-cancelled)` term).
- `tests/api/booking/[id].patch.test.ts` (new) — 6 API tests; see below.

## Files created

- `modules/booking/server/api/booking/[id].patch.ts` — PATCH endpoint (see below).
- `tests/api/booking/[id].patch.test.ts` – 6 passing tests:
  - updates own booking to a new available slot,
  - rejects a slot overlapping another non-cancelled booking (400),
  - allows keeping the patient's own current slot,
  - rejects editing another user's booking (403),
  - rejects editing a cancelled booking (400),
  - rejects an invalid time format (400).

## Files deleted

- None.

## New endpoint behaviour — `PATCH /api/booking/:id`

- `requireAuth(event, ['PATIENT'])` (admin/staff reassignment is handled in the admin UI, out of scope).
- Verifies the booking belongs to the caller (403) and is not cancelled (400).
- Rejects rescheduling onto a holiday (400).
- Body validated with Zod `{ startTime: HH:MM }` (400 on invalid).
- Re-validates the slot against the global AdminSchedule + holiday/blocked-date logic via `getAdminAvailableSlots` (400 "This slot is no longer available" if absent).
- Checks for overlap with any OTHER non-cancelled booking on the same date (the patient's own booking is excluded so they may keep their current slot) (400 on conflict).
- Session duration comes from the matched admin schedule slot; `endTime` is recomputed server-side.
- Returns the updated booking in the same shape as `GET /api/patient/appointments` (so the frontend can replace it in `allBookings`).

## Assumptions

- Slots are global (no doctor assigned at booking time), so availability checks use `AdminSchedule`, `GlobalBlockedDate`, holidays, and existing non-cancelled bookings — matching the booking/create flow.
- Edit changes time only; the date is fixed and cannot be moved.
- Edit is offered on **pending** bookings only. Confirmed bookings have a doctor assigned by the admin; letting patients move them could silently break the doctor's schedule, so they expose Cancel + Join only (matches the spec's "we'll restrict Edit to pending bookings" note).
- The slot-offering API (`getAdminAvailableSlots`) only hides CONFIRMED bookings to avoid over-blocking the public booking page; the PATCH endpoint is stricter (hides all non-cancelled) so the server is the authoritative check. A slot shown in the modal can theoretically be rejected on confirm if another patient has a PENDING booking there — surfaced gracefully as an inline error.
- Cancel keeps the existing 24h rule and now also appears on PENDING bookings (was confirmed-only before), per the spec.
- Test fixtures create/delete their own AdminSchedule rows for SATURDAYS (day 0) only, mirroring the existing available-slots tests, so the seeded Mon-Fri global schedule is never clobbered by the test suite.

## Issues encountered

- Timezone: Prisma `@db.Date` columns store the UTC calendar day; building a query date with local-midnight `parseISODate` produced `T21:00:00Z` (UTC+3 box), so the overlap query matched nothing. Fixed by querying with the booking's exact stored `date` value.
- A debug script accidentally ran `adminSchedule.deleteMany({})`, wiping the seeded Mon-Fri schedule and making the E2E "free slot" and "edit" tests fail (empty `availableDates`). Restored the seed rows (`prisma/seed.ts` Mon-Fri 09:00-17:00). The patch test was rewritten to use Saturdays only so future runs cannot damage the seed.
- Earlier drafts of the edit-modal confirm disabled even when no change was possible; final behaviour disables only when the selection equals the current slot.