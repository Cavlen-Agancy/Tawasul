# Phase 4 — Patient Dashboard

## Goal
Build the complete patient-facing dashboard. After this phase, a logged-in patient can view their appointments, join their online session, manage payments, and edit their profile.

---

## Stack Used in This Phase
- Nitro API endpoints
- Prisma (User, Booking, Payment, SessionRoom models)
- HeroUI (dashboard layout, cards, tables)
- Jitsi (session room embed)
- Resend (cancellation email)

---

## Overview

The Patient Dashboard is protected — PATIENT role only. It uses a sidebar layout on desktop and a bottom navigation on mobile. All data is scoped to the logged-in patient only — enforced server-side on every endpoint.

---

## Step 1 — Patient Dashboard Layout

Create `modules/patient/layouts/PatientLayout.vue`.

Sidebar links:
- My Appointments
- My Payments
- Profile
- Logout

Mobile: bottom navigation bar with icons for the same links.

Apply `auth` + `patient-only` middleware to all patient pages.

---

## Step 2 — API Endpoints

All inside `modules/patient/server/api/patient/`.

---

### GET /api/patient/profile

Auth: PATIENT.

Return: `{ id, name, email, phone, photo }`. Never return password.

---

### PATCH /api/patient/profile

Auth: PATIENT.

Body (Zod): `name` (min 2), `phone` (optional).

Logic:
1. Update User record (name, phone only — email cannot change).
2. Return updated profile.

---

### POST /api/patient/profile/photo

Auth: PATIENT.

Logic:
1. Read uploaded image (multipart).
2. Validate: image only (jpeg/png/webp), max 2MB.
3. Save to `UPLOAD_PATH/patients/{userId}-{timestamp}.ext`.
4. Update User.photo field.
5. Return `{ photoUrl }`.

---

### GET /api/patient/appointments

Auth: PATIENT.

Query: `tab` — "upcoming" or "past". Default "upcoming".

Logic:
1. Fetch Bookings where userId matches logged-in patient.
2. Upcoming: status CONFIRMED, date >= today, sorted by date ASC.
3. Past: status CONFIRMED and date < today, plus all CANCELLED, sorted by date DESC.
4. Include for each: id, doctor name, doctor photo, date, startTime, endTime, service, status, sessionRoom (roomName if exists).
5. Return list.

---

### GET /api/patient/payments

Auth: PATIENT.

Logic:
1. Fetch Payments linked to bookings where userId matches logged-in patient.
2. Include: id, amount, currency, status, createdAt, booking (doctor name, date, service).
3. Sort by createdAt DESC.
4. Return list.

---

### GET /api/patient/session/:bookingId

Auth: PATIENT.

Logic:
1. Fetch Booking by id, verify userId matches logged-in patient.
2. Verify status is CONFIRMED.
3. Check time window: now must be within 5 minutes before startTime and 15 minutes after endTime. If outside → 403 "Session is not available at this time".
4. Fetch or create SessionRoom:
   - If exists: return roomName.
   - If not: generate a unique roomName (e.g. `tawasul-{bookingId}`), set expiresAt to endTime + 15 min, create SessionRoom record.
5. Return `{ roomName, jitsiDomain }`.

---

## Step 3 — Frontend Pages

All inside `modules/patient/pages/`. All use PatientLayout.

---

### `/dashboard` — Redirect to `/dashboard/appointments`

---

### `/dashboard/appointments` — Appointments Page

Two tabs: Upcoming and Past (HeroUI Tabs).

**Upcoming tab:**

Appointment cards (HeroUI Card) showing:
- Doctor photo + name
- Date formatted as "Monday, 4 March 2024"
- Time formatted as "10:00 AM – 11:00 AM"
- Service name
- "Join Session" button — active (magenta) only within time window (5 min before to 15 min after). Outside window: grayed out with tooltip "Available 5 minutes before your session".
- "Cancel" button — visible only if more than 24 hours before session. On click: HeroUI Modal confirmation dialog before calling cancel API.

Empty state: "No upcoming appointments. Book your first session." with Book Now button.

**Past tab:**

Appointment cards showing:
- Doctor photo + name
- Date and time
- Service
- Status badge: Completed (green) or Cancelled (gray) — HeroUI Chip

Empty state: "No past appointments."

Behavior:
- On load: call GET /api/patient/appointments for both tabs.
- After cancel: move card from upcoming to past without page reload.
- Loading skeleton (HeroUI Skeleton) while fetching.
- Recalculate Join Session button state every 60 seconds using `setInterval`.

---

### `/dashboard/payments` — Payments Page

HeroUI Table with columns: Date, Doctor, Service, Amount, Status.

Status column uses HeroUI Chip:
- SUCCESS → green
- PENDING → yellow
- FAILED → red
- REFUNDED → gray

Empty state: "No payment history."

Mobile: table collapses to card list — one card per row.

---

### `/dashboard/profile` — Profile Page

Left: profile photo with "Upload Photo" button below.
Right: Name input, Phone input, Email (read-only text, not input).

Save Changes button (HeroUI Button, primary).

Behavior:
- On load: fetch GET /api/patient/profile and pre-fill fields.
- Photo upload: file picker on click, immediately call POST /api/patient/profile/photo on selection, update displayed photo.
- On save: PATCH /api/patient/profile, show HeroUI Toast success notification.
- Inline validation: name required.

---

### `/dashboard/session/:bookingId` — Session Room Page

On load:
1. Call GET /api/patient/session/:bookingId.
2. If 403 (outside time window): show waiting state with countdown timer and booking details. Poll API every 30 seconds. Auto-enter room when window opens.
3. If success: render Jitsi session.

**Jitsi Embed:**
- Use the Jitsi Meet External API via a script tag loaded dynamically.
- Initialize with `roomName` and `domain` from the API response.
- Configure: display name = patient name, disable prejoin page, start with audio and video off.
- Full-height video area (left 70%) + text chat panel (right 30%, use Jitsi's built-in chat).
- "Leave Session" button — HeroUI Button, top right. On click: HeroUI Modal confirmation, then disconnect and redirect to `/dashboard/appointments`.

---

## Step 4 — Patient Dashboard Composable

Create `modules/patient/composables/usePatientDashboard.ts`:

State:
- `profile` — User object
- `upcomingAppointments` — Booking[]
- `pastAppointments` — Booking[]
- `payments` — Payment[]
- `isLoading` — boolean
- `error` — string

Methods:
- `fetchProfile()`
- `updateProfile(data)`
- `uploadPhoto(file)`
- `fetchAppointments()`
- `cancelAppointment(bookingId)` — calls cancel API, moves card in local state
- `fetchPayments()`

---

## Checks — Phase 4 Complete

- [ ] Unauthenticated users redirected to /login from all /dashboard routes
- [ ] Doctor and staff roles redirected away from /dashboard
- [ ] Profile loads with correct data pre-filled
- [ ] Name and phone update correctly with success toast
- [ ] Photo upload works and displays immediately
- [ ] Upcoming appointments show only CONFIRMED future bookings sorted by date
- [ ] Past appointments show past and cancelled bookings
- [ ] Join Session button is grayed out outside the 5-minute window
- [ ] Join Session button becomes active within the window
- [ ] Cancel button hidden when less than 24 hours before session
- [ ] Cancel confirmation dialog appears before cancelling
- [ ] Cancelled appointment moves to past tab without page reload
- [ ] Cancellation email received by patient
- [ ] Payments table shows all transactions with correct status badges
- [ ] Session room shows countdown when outside time window
- [ ] Session room loads Jitsi when within time window
- [ ] Patient cannot access another patient's session room
- [ ] Loading skeletons show while data fetches
- [ ] All pages are mobile-responsive

---

## Notes for the AI

- Every API endpoint must filter by the logged-in patient's userId. Never trust the frontend.
- The Join Session button recalculation must use `setInterval` every 60 seconds — a static check on page load is not enough.
- The session room countdown must also poll the API every 30 seconds in case the server clock differs from the client.
- Photo uploads go to `UPLOAD_PATH/patients/` — make sure this directory exists and is included in the Docker uploads volume.
- Use Jitsi Meet External API (`api.jit.si` script) for the embed — not an iframe directly. The External API gives more control (mute, leave, events).
- The Jitsi roomName must be unique per booking. Use `tawasul-{bookingId}` as the room name format.
- For MVP, Jitsi runs on `meet.jit.si` — no authentication token needed. Self-hosted with JWT comes in Phase 2.
