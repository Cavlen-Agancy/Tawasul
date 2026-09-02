# Phase 5 — Doctor Dashboard

## Goal
Build the doctor-facing dashboard. After this phase, a doctor can complete their profile, view all assigned appointments on a calendar, and join their online session at the correct time.

---

## Stack Used in This Phase
- Nitro API endpoints
- Prisma (User, Doctor, Booking, Availability, BlockedSlot, SessionRoom models)
- FullCalendar (doctor calendar — month, week, day views)
- shadcn-vue (dashboard layout, forms, cards)
- Jitsi (session room embed)

---

## Overview

The Doctor Dashboard is protected — DOCTOR accountType only. It is intentionally simple: profile management, a calendar of assigned bookings, and session room access. Doctors do not manage bookings — the admin does.

---

## Step 1 — Doctor Dashboard Layout

Create `modules/doctor/layouts/DoctorLayout.vue`.

Sidebar links:
- My Calendar
- My Profile
- Logout

Mobile: bottom navigation bar.

Apply `auth` + `doctor-only` middleware to all doctor pages.

If doctor's bio is empty on login, show a yellow shadcn-vue Alert banner on all pages: "Your profile is incomplete. Please complete your profile so patients can find you."

---

## Step 2 — API Endpoints

All inside `modules/doctor/server/api/doctor/`.

---

### GET /api/doctor/profile

Auth: DOCTOR.

Logic:
1. Fetch User and linked Doctor record for logged-in user.
2. Return: id, name, email, phone, photo, bio, slug, specializations, isActive.

---

### PATCH /api/doctor/profile

Auth: DOCTOR.

Body (Zod): `name` (min 2), `phone` (optional), `bio` (optional), `specializations` (string array, optional).

Logic:
1. Update User (name, phone) and Doctor (bio, specializations).
2. Return updated profile.

---

### POST /api/doctor/profile/photo

Auth: DOCTOR.

Logic:
1. Validate: image only (jpeg/png/webp), max 2MB.
2. Save to `UPLOAD_PATH/doctors/{userId}-{timestamp}.ext`.
3. Update User.photo.
4. Return `{ photoUrl }`.

---

### GET /api/doctor/bookings

Auth: DOCTOR.

Query: `start` (YYYY-MM-DD), `end` (YYYY-MM-DD) — required for calendar range fetching.

Logic:
1. Fetch all Bookings where doctorId matches logged-in doctor and date is between start and end.
2. Include: id, patient name, patient photo, date, startTime, endTime, service, status.
3. Return list.

---

### GET /api/doctor/bookings/:id

Auth: DOCTOR.

Logic:
1. Fetch Booking by id, verify doctorId matches logged-in doctor. Return 403 if not.
2. Return: patient name, patient email, date, startTime, endTime, service, status, payment status.

---

### GET /api/doctor/session/:bookingId

Auth: DOCTOR.

Logic:
1. Fetch Booking by id, verify doctorId matches logged-in doctor.
2. Verify status is CONFIRMED.
3. Check time window: 5 minutes before startTime to 15 minutes after endTime. If outside → 403.
4. Fetch or create SessionRoom (same logic as patient — same roomName, same record).
5. Return `{ roomName, jitsiDomain }`.

---

## Step 3 — Frontend Pages

All inside `modules/doctor/pages/`. All use DoctorLayout.

---

### `/doctor` — Redirect to `/doctor/calendar`

---

### `/doctor/calendar` — Calendar Page

FullCalendar with three views: Month, Week, Day. View switcher buttons top right.

**Month view:**
- Each confirmed booking = event block with patient name and time.
- Clicking event = shadcn-vue Modal with booking details.

**Week view:**
- Hourly grid.
- Confirmed bookings = colored blocks (primary magenta).
- Clicking event = same detail modal.

**Day view:**
- Full day hourly breakdown.
- Same event display as week view.

**Booking Detail Modal:**
- Patient name
- Date and time
- Service
- Status badge
- "Join Session" button — active only within time window (5 min before to 15 min after).

Behavior:
- On load and on view/date change (`datesSet` callback): call GET /api/doctor/bookings?start=DATE&end=DATE.
- Debounce `datesSet` by 100ms to avoid double-fetch on init.

---

### `/doctor/profile` — Profile Page

Left: profile photo with Upload Photo button.
Right: Name, Phone, Bio (shadcn-vue Textarea), Specializations (tag input — type and press Enter to add, click X to remove).
Email: read-only.

Save Changes button.

Behavior:
- Pre-fill all fields on load.
- Photo upload: immediate display on selection.
- On save: PATCH /api/doctor/profile, show success toast.
- If bio is empty on load: show inline warning below the bio field.

---

### `/doctor/session/:bookingId` — Session Room Page

Same structure and behavior as the patient session room page (Phase 4), but:
- Calls GET /api/doctor/session/:bookingId for the room.
- Jitsi initialized with doctor's name as display name.
- Leave Session redirects to `/doctor/calendar`.

---

## Step 4 — Doctor Dashboard Composable

Create `modules/doctor/composables/useDoctorDashboard.ts`:

State:
- `profile` — Doctor + User object
- `bookings` — Booking[]
- `isLoading` — boolean
- `error` — string

Methods:
- `fetchProfile()`
- `updateProfile(data)`
- `uploadPhoto(file)`
- `fetchBookings(start, end)`

---

## Checks — Phase 5 Complete

- [ ] Unauthenticated users and non-doctor roles redirected from /doctor routes
- [ ] Incomplete profile banner shows when bio is empty
- [ ] Profile updates correctly and shows success toast
- [ ] Photo upload works and displays immediately
- [ ] Calendar loads bookings for visible date range
- [ ] Switching between month, week, day views fetches correct range
- [ ] Clicking a booking event opens the correct detail modal
- [ ] Join Session button in modal is active only within time window
- [ ] Session room loads Jitsi when within time window
- [ ] Session room shows countdown when outside time window
- [ ] Doctor cannot access another doctor's bookings
- [ ] Doctor and patient enter the same Jitsi room for the same booking

---

## Notes for the AI

- The SessionRoom record is shared between patient and doctor — both use the same roomName. The first one to hit the session endpoint creates the record, the second one reads it. Use `upsert` to handle this safely.
- The `datesSet` FullCalendar callback fires on initial render and on navigation. Debounce by 100ms to avoid two fetches on load.
- Doctor session endpoint must verify doctorId ownership the same way patient endpoint verifies userId — never skip this check.
- Specializations tag input: use a simple custom component with a text input and a list of removable chips. No external library needed.
- Doctor profile is visible to admin only — the public expert profile comes from the public API (Phase 2) and shows only bio, specializations, and photo.
