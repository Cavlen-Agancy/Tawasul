# Phase 6 — Admin Dashboard & Permission System

## Goal
Build the complete admin dashboard with a flexible permission system. After this phase, staff accounts can be created with custom per-resource permissions, all platform data is manageable from one place, and the admin has full control over the platform.

---

## Stack Used in This Phase
- Nitro API endpoints
- Prisma (all models including Permission)
- FullCalendar (master calendar)
- HeroUI (dashboard layout, tables, modals, forms)
- Resend (doctor welcome email)

---

## Overview

The Admin Dashboard is protected — STAFF accountType only. Access to each section is controlled by the Permission system. The super admin (created by seed) has full access to everything. Staff accounts created by the admin have only the permissions explicitly assigned to them.

---

## Step 1 — Admin Dashboard Layout

Create `modules/admin/layouts/AdminLayout.vue`.

Sidebar links (show only links the logged-in staff member has READ permission for):
- Overview (always visible)
- All Appointments (requires APPOINTMENTS READ)
- Manage Doctors (requires DOCTORS READ)
- Manage Patients (requires PATIENTS READ)
- Manage Payments (requires PAYMENTS READ)
- Manage Staff (requires STAFF READ)
- Settings (requires SETTINGS READ)
- Logout

Apply `auth` + `staff-only` middleware to all admin pages.

---

## Step 2 — Permission Middleware

Create `server/utils/permissions.ts` (if not done in Phase 0).

### `requirePermission(event, resource, action)`

Logic:
1. Call `requireAuth(event, ['STAFF'])`.
2. Fetch all Permission records for the user from DB.
3. Check if any record matches the required resource and action.
4. If not found → throw 403 "You do not have permission to perform this action".

All admin API endpoints call `requirePermission` instead of just `requireAuth`.

---

## Step 3 — API Endpoints

All inside `modules/admin/server/api/admin/`.

---

### GET /api/admin/overview

Permission: none (all staff can see overview).

Logic:
1. Run the following in parallel with `Promise.all`:
   - Total bookings this month (CONFIRMED)
   - Total bookings all time (CONFIRMED)
   - Total revenue this month (sum of SUCCESS payments)
   - Total revenue all time
   - Total active patients (Users with PATIENT type and at least one CONFIRMED booking)
   - Total active doctors (Doctors with isActive true)
   - Last 5 bookings (with patient name, doctor name, date, status)
2. Return all as a single object.

---

### GET /api/admin/bookings

Permission: APPOINTMENTS READ.

Query: `start`, `end`, `doctorId`, `status` — all optional.

Logic:
1. Fetch all Bookings with optional filters.
2. Include: patient name, patient photo, doctor name, doctor photo, date, startTime, endTime, service, status, payment status.
3. Sort by date DESC.
4. Return list.

---

### GET /api/admin/bookings/:id

Permission: APPOINTMENTS READ.

Return full booking details including doctor notes (none for MVP — field reserved).

---

### PATCH /api/admin/bookings/:id/cancel

Permission: APPOINTMENTS DELETE.

Logic:
1. Fetch Booking, verify status is CONFIRMED.
2. Update Booking to CANCELLED, Payment to REFUNDED.
3. Send cancellation email to patient.
4. Return 200.
5. No 24hr rule for admin — can cancel any booking at any time.

---

### GET /api/admin/doctors

Permission: DOCTORS READ.

Logic:
1. Fetch all Users with accountType DOCTOR and their Doctor records.
2. Include: id, name, email, phone, photo, specializations, isActive, session count this month, session count all time.
3. Return list sorted by name ASC.

---

### GET /api/admin/doctors/:id

Permission: DOCTORS READ.

Return full doctor profile including contact details, availability, and booking history.

---

### POST /api/admin/doctors

Permission: DOCTORS CREATE.

Body (Zod): `name`, `email`, `phone` (optional), `bio` (optional), `specializations` (string array).

Logic:
1. Validate all fields. Check email not already in use.
2. Generate a random 12-character temporary password (alphanumeric).
3. Hash password.
4. Create User with accountType DOCTOR, emailVerified true, isActive true.
5. Generate a unique slug from the doctor's name (e.g. "dr-ahmed-hassan"). If slug exists, append a number.
6. Create linked Doctor record.
7. Send welcome email using `doctorWelcomeTemplate` with login credentials.
8. Return created doctor profile. Never return the temporary password in the response.

---

### PATCH /api/admin/doctors/:id

Permission: DOCTORS UPDATE.

Body: `name`, `phone`, `bio`, `specializations`, `isActive` — all optional.

Logic:
1. Update User and Doctor records.
2. Return updated profile.

---

### GET /api/admin/patients

Permission: PATIENTS READ.

Logic:
1. Fetch all Users with accountType PATIENT.
2. Include: id, name, email, phone, photo, total session count, last session date, createdAt.
3. Sort by createdAt DESC.
4. Return list.

---

### GET /api/admin/patients/:id

Permission: PATIENTS READ.

Return full patient profile with booking history and payment history.

---

### GET /api/admin/payments

Permission: PAYMENTS READ.

Query: `start`, `end`, `doctorId`, `status` — all optional.

Logic:
1. Fetch all Payments with optional filters.
2. Include: patient name, doctor name, service, amount, currency, status, createdAt, gatewayReference.
3. Calculate summary: total SUCCESS amount, total REFUNDED amount, total count.
4. Sort by createdAt DESC.
5. Return `{ payments, summary }`.

---

### GET /api/admin/staff

Permission: STAFF READ.

Logic:
1. Fetch all Users with accountType STAFF (excluding the seed admin).
2. Include their permissions.
3. Return list.

---

### POST /api/admin/staff

Permission: STAFF CREATE.

Body (Zod): `name`, `email`, `phone` (optional), `permissions` (array of `{ resource, action }` objects).

Logic:
1. Validate fields, check email not in use.
2. Generate temporary password, hash it.
3. Create User with accountType STAFF, emailVerified true.
4. Create Permission records for each permission in the array.
5. Send welcome email with credentials.
6. Return created staff profile.

---

### PATCH /api/admin/staff/:id

Permission: STAFF UPDATE.

Body: `name`, `phone`, `permissions` (full replace), `isActive` — all optional.

Logic:
1. Update User record.
2. If permissions provided: delete all existing Permission records for this user, create new ones from the submitted array.
3. Return updated staff profile with new permissions.

---

### DELETE /api/admin/staff/:id

Permission: STAFF DELETE.

Logic:
1. Verify the target is not the seed admin account (protect by email).
2. Update User isActive to false (soft delete — do not hard delete).
3. Return 200.

---

### GET /api/admin/settings

Permission: SETTINGS READ.

Logic:
1. Fetch Settings singleton record.
2. Mask paymentGatewayKey and paymentGatewaySecret — return only last 4 characters preceded by asterisks (e.g. `****abcd`).
3. Return all other fields as-is.

---

### PATCH /api/admin/settings

Permission: SETTINGS UPDATE.

Logic:
1. Read fields from body.
2. If paymentGatewayKey or paymentGatewaySecret are submitted and are NOT masked placeholders (do not start with `****`): update them.
3. Update all other fields normally.
4. Return updated settings with keys masked.

---

## Step 4 — Doctor Availability Management (Admin)

### GET /api/admin/doctors/:id/availability

Permission: DOCTORS READ.

Return doctor's Availability and BlockedSlot records.

### POST /api/admin/doctors/:id/availability

Permission: DOCTORS UPDATE.

Body: array of `{ dayOfWeek, startTime, endTime, sessionDuration }`.

Logic: full replace — delete existing, create new.

### POST /api/admin/doctors/:id/availability/block

Permission: DOCTORS UPDATE.

Body: `{ date, startTime, endTime }`.

Create BlockedSlot record.

### DELETE /api/admin/doctors/:id/availability/block/:blockId

Permission: DOCTORS UPDATE.

Delete BlockedSlot record.

---

## Step 5 — Frontend Pages

All inside `modules/admin/pages/`. All use AdminLayout.

---

### `/admin` — Redirect to `/admin/overview`

---

### `/admin/overview` — Overview Page

Four HeroUI stat cards (2×2 grid):
- Total Bookings This Month (with % change vs last month)
- Total Revenue This Month (formatted as EGP)
- Active Patients count
- Active Doctors count

Below: "Recent Bookings" HeroUI Table — last 5 bookings with Patient, Doctor, Date, Service, Status columns.

---

### `/admin/appointments` — Master Calendar Page

Filter bar above calendar: Doctor dropdown (all doctors + "All Doctors"), Status dropdown (All / Confirmed / Cancelled).

FullCalendar with Month, Week, Day views:
- Each booking = event with patient name + doctor name.
- Color-code by doctor — assign a color from a 6-color palette based on doctor index in the list.
- Cancelled bookings shown with reduced opacity.
- Filter changes trigger re-fetch.
- Click event → HeroUI Modal with full booking details + Cancel Booking button (APPOINTMENTS DELETE permission required to show button).

---

### `/admin/doctors` — Manage Doctors Page

Search input (filter by name/email).

HeroUI Table: Photo, Name, Email, Specializations, Status badge, Sessions This Month, Actions.

Actions per row:
- Edit button → opens HeroUI Modal with edit form
- View Calendar button → opens `/admin/doctors/:id` with calendar tab active
- Toggle Active/Inactive

"Add Doctor" button top right → HeroUI Modal with add form. On success: "Doctor created. Credentials sent to their email."

---

### `/admin/doctors/:id` — Doctor Detail Page

Full doctor profile (all fields including contact details).
FullCalendar showing this doctor's bookings.
Availability settings form (same as doctor's own availability page).
Session count stats.

---

### `/admin/patients` — Manage Patients Page

Search input.

HeroUI Table: Photo, Name, Email, Phone, Total Sessions, Last Session, Registered, View button.

---

### `/admin/patients/:id` — Patient Detail Page

Patient profile + booking history table + payment history table.

---

### `/admin/payments` — Manage Payments Page

Three HeroUI stat cards: Total Revenue, Revenue This Month, Total Refunded.

Filter bar: date range, doctor, status.

HeroUI Table: Date, Patient, Doctor, Service, Amount, Status badge, Gateway Reference.

---

### `/admin/staff` — Manage Staff Page

HeroUI Table: Name, Email, Permissions summary, Status, Actions (Edit, Deactivate).

"Add Staff" button → HeroUI Modal with:
- Name, Email, Phone fields
- Permission builder: for each resource (APPOINTMENTS, PATIENTS, DOCTORS, PAYMENTS, SETTINGS, STAFF), show checkboxes for each action (CREATE, READ, UPDATE, DELETE)

On edit: same modal pre-filled with current permissions.

---

### `/admin/settings` — Settings Page

Sections with individual Save buttons:

**Platform Info:** Platform name, Contact email, Contact phone, WhatsApp number.

**Session Pricing:** Price per session (number + EGP label), Default session duration selector.

**Default Working Hours:** Start time, End time. Note: "These are defaults only. Each doctor sets their own availability."

**Payment Gateway:** Gateway selector (Paymob / Stripe). Masked key fields with "Update Keys" toggle to reveal inputs.

---

## Step 6 — Admin Dashboard Composable

Create `modules/admin/composables/useAdminDashboard.ts`:

State: `overview`, `bookings`, `doctors`, `patients`, `payments`, `staff`, `settings`, `isLoading`, `error`

Methods: one per API endpoint following the same pattern as previous phases.

---

## Checks — Phase 6 Complete

- [ ] Non-staff roles redirected from /admin routes
- [ ] Staff with no APPOINTMENTS READ permission cannot see All Appointments in sidebar
- [ ] Overview stats are accurate
- [ ] Master calendar shows all bookings, color-coded by doctor
- [ ] Doctor filter works correctly on master calendar
- [ ] Admin can cancel any booking without 24hr restriction
- [ ] Add Doctor creates account and sends welcome email
- [ ] New doctor can log in with emailed credentials
- [ ] Add Staff creates account with correct permissions
- [ ] Staff member with only PATIENTS READ cannot access /admin/doctors
- [ ] Editing staff permissions replaces old permissions completely
- [ ] Deactivating staff prevents their login
- [ ] Payment keys are always masked in API responses
- [ ] Updating settings without changing keys does not overwrite existing keys
- [ ] Doctor availability management works from admin panel
- [ ] Seed admin account cannot be deactivated

---

## Notes for the AI

- The permission check must query the database on every request — never cache permissions in the JWT or cookie.
- Color-coding doctors on the master calendar: assign colors from a fixed array `['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2']` based on doctor index. Store mapping in the composable — not the database.
- The seed admin is identified by the SEED_ADMIN_EMAIL env variable — protect this account from deactivation in DELETE /api/admin/staff/:id.
- Overview stats must use Prisma aggregate queries — never fetch all records and count in JavaScript.
- The permission builder UI in the staff modal must make it visually clear which actions depend on others (e.g. UPDATE usually requires READ first). Enforce this in the UI only — the API accepts any combination.
- Payment gateway keys: on PATCH /api/admin/settings, check if the submitted value starts with `****` — if yes, skip updating that field.
