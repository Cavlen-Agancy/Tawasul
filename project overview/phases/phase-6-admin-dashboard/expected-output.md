# Phase 6 — Admin Dashboard & Permission System
## expected-output.md

---

## API Endpoints Delivered

| Method | Path | Auth Required | Permission Required | Description |
|---|---|---|---|---|
| GET | `/api/admin/overview` | STAFF | None | Fetch platform overview stats. |
| GET | `/api/admin/bookings` | STAFF | APPOINTMENTS READ | Fetch all bookings with filters. |
| GET | `/api/admin/bookings/:id` | STAFF | APPOINTMENTS READ | Fetch a single booking by ID. |
| PATCH | `/api/admin/bookings/:id/cancel` | STAFF | APPOINTMENTS DELETE | Cancel a booking (no 24hr restriction). |
| GET | `/api/admin/doctors` | STAFF | DOCTORS READ | Fetch all doctors. |
| GET | `/api/admin/doctors/:id` | STAFF | DOCTORS READ | Fetch a single doctor by ID. |
| POST | `/api/admin/doctors` | STAFF | DOCTORS CREATE | Create a new doctor. |
| PATCH | `/api/admin/doctors/:id` | STAFF | DOCTORS UPDATE | Update a doctor. |
| GET | `/api/admin/doctors/:id/availability` | STAFF | DOCTORS READ | Fetch doctor's availability and blocked slots. |
| POST | `/api/admin/doctors/:id/availability` | STAFF | DOCTORS UPDATE | Replace doctor's availability. |
| POST | `/api/admin/doctors/:id/availability/block` | STAFF | DOCTORS UPDATE | Add a blocked slot. |
| DELETE | `/api/admin/doctors/:id/availability/block/:blockId` | STAFF | DOCTORS UPDATE | Remove a blocked slot. |
| GET | `/api/admin/patients` | STAFF | PATIENTS READ | Fetch all patients. |
| GET | `/api/admin/patients/:id` | STAFF | PATIENTS READ | Fetch a single patient by ID. |
| GET | `/api/admin/payments` | STAFF | PAYMENTS READ | Fetch all payments with filters. |
| GET | `/api/admin/staff` | STAFF | STAFF READ | Fetch all staff members. |
| POST | `/api/admin/staff` | STAFF | STAFF CREATE | Create a new staff member. |
| PATCH | `/api/admin/staff/:id` | STAFF | STAFF UPDATE | Update a staff member. |
| DELETE | `/api/admin/staff/:id` | STAFF | STAFF DELETE | Deactivate a staff member. |
| GET | `/api/admin/settings` | STAFF | SETTINGS READ | Fetch platform settings. |
| PATCH | `/api/admin/settings` | STAFF | SETTINGS UPDATE | Update platform settings. |

---

## Pages Delivered

| Route | Layout Used | Middleware Applied | Permission Required | Description |
|---|---|---|---|---|
| `/admin` | None | `auth` + `staff-only` | None | Redirects to `/admin/overview`. |
| `/admin/overview` | `AdminLayout` | `auth` + `staff-only` | None | Overview page with stats and recent bookings. |
| `/admin/appointments` | `AdminLayout` | `auth` + `staff-only` | APPOINTMENTS READ | Master calendar with all bookings. |
| `/admin/doctors` | `AdminLayout` | `auth` + `staff-only` | DOCTORS READ | Manage doctors page with table and actions. |
| `/admin/doctors/:id` | `AdminLayout` | `auth` + `staff-only` | DOCTORS READ | Doctor detail page with profile, calendar, and availability. |
| `/admin/patients` | `AdminLayout` | `auth` + `staff-only` | PATIENTS READ | Manage patients page with table. |
| `/admin/patients/:id` | `AdminLayout` | `auth` + `staff-only` | PATIENTS READ | Patient detail page with profile and history. |
| `/admin/payments` | `AdminLayout` | `auth` + `staff-only` | PAYMENTS READ | Manage payments page with filters and table. |
| `/admin/staff` | `AdminLayout` | `auth` + `staff-only` | STAFF READ | Manage staff page with table and permission builder. |
| `/admin/settings` | `AdminLayout` | `auth` + `staff-only` | SETTINGS READ | Settings page with all platform configurations. |

---

## Components Delivered

| File | Description |
|---|---|
| `modules/admin/components/PermissionBuilder.vue` | Reusable component for assigning permissions to staff (checkbox grid for resources x actions). |
| `modules/admin/components/DoctorColorChip.vue` | Chip component for doctor names with assigned color in master calendar. |
| `modules/admin/components/StatsCard.vue` | Reusable stat card for overview and payments pages. |

---

## Composables Delivered

| File | State | Methods |
|---|---|---|
| `modules/admin/composables/useAdminDashboard.ts` | `overview`, `bookings`, `doctors`, `patients`, `payments`, `staff`, `settings`, `isLoading`, `error`, `doctorColors` | `fetchOverview()`, `fetchBookings(filters)`, `fetchDoctors()`, `fetchPatients(search)`, `fetchPayments(filters)`, `fetchStaff()`, `fetchSettings()`, `updateSettings(data)`, `getDoctorColor(doctorId)` |

---

## Layouts Delivered

| File | Description |
|---|---|
| `modules/admin/layouts/AdminLayout.vue` | Admin dashboard layout with dynamic sidebar (filtered by permissions) and mobile bottom nav. |

**Extends:**
- `layouts/dashboard.vue` (from Phase 0).

---

## Server Utilities Delivered

| File | Functions Exported |
|---|---|
| `server/utils/permissions.ts` | Already created in Phase 0. Phase 6 begins using it on all admin endpoints. No changes to the file itself. |

**Reused from Phase 0:**
- `server/utils/prisma.ts` — `prisma` singleton.
- `server/utils/auth.ts` — `requireAuth`.
- `server/utils/email.ts` — `sendEmail`, `doctorWelcomeTemplate`, `bookingCancellationTemplate`.

---

## Middleware Delivered

**Reused from Phase 1:**
- `middleware/auth.ts` — Protect routes.
- `middleware/staff-only.ts` — Restrict to staff.

**New in Phase 6:**
None.

---

## Database Changes

No schema changes in this phase. Uses existing models:
- `User`
- `Doctor`
- `Booking`
- `Payment`
- `Permission`
- `Settings`
- `Availability`
- `BlockedSlot`

---

## Emails Sent

| Trigger Event | Recipient | Template Used | Key Variables |
|---|---|---|---|
| Doctor account created | Doctor email | `doctorWelcomeTemplate` | `doctorName`, `email`, `temporaryPassword` |
| Staff account created | Staff email | `doctorWelcomeTemplate` (reused) | `doctorName` (staff name), `email`, `temporaryPassword` |
| Booking cancelled (by admin) | Patient email | `bookingCancellationTemplate` | `patientName`, `doctorName`, `date`, `time` |

---

## Environment Variables Used

| Variable | Where Used |
|---|---|
| `SEED_ADMIN_EMAIL` | `DELETE /api/admin/staff/:id` to protect seed admin from deactivation. |
| `RESEND_API_KEY` | `sendEmail` in doctor/staff creation and booking cancellation. |
| `RESEND_FROM_EMAIL` | `sendEmail` in doctor/staff creation and booking cancellation. |
| `RESEND_FROM_NAME` | `sendEmail` in doctor/staff creation and booking cancellation. |

---

## What the Next Phase (Phase 7) Will Receive

- Complete admin dashboard with all pages working:
  - Overview page with accurate stats.
  - Master calendar with all bookings, color-coded by doctor.
  - Doctor management with add/edit/view and availability management.
  - Patient management with view details.
  - Payment management with filters and summaries.
  - Staff management with permission builder.
  - Settings page with all platform configurations.
- `AdminLayout` with dynamic sidebar (filtered by permissions).
- `useAdminDashboard` composable for data management.
- Permission system fully functional:
  - `requirePermission` middleware for all admin endpoints.
  - Sidebar links filtered by permissions.
  - Staff can only access what they have permissions for.
- Seed admin protected from deactivation.
- Payment keys always masked in UI and API responses.
- Doctor availability management from admin panel.
- All pages responsive on mobile.
