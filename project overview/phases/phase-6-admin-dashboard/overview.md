# Phase 6 — Admin Dashboard & Permission System
## overview.md

---

## Goal

Phase 6 builds the complete admin dashboard with a flexible permission system for the Tawasul Academy platform. After this phase, staff accounts can be created with custom per-resource permissions, all platform data is manageable from one place, and the admin has full control over the platform. The Admin Dashboard is protected — STAFF accountType only. Access to each section is controlled by the Permission system. The super admin (created by seed in Phase 0) has full access to everything. Staff accounts created by the admin have only the permissions explicitly assigned to them.

---

## Scope

- **Admin Dashboard Layout**: `modules/admin/layouts/AdminLayout.vue` with dynamic sidebar (shows only links the user has permission for).
- **Permission Middleware**: `requirePermission()` from `server/utils/permissions.ts` (created in Phase 0) is now applied to all admin API endpoints for the first time.
- **API Endpoints**: 20+ endpoints for overview stats, bookings (including pending review and doctor assignment), schedule, blocked dates, doctors, patients, payments, staff, settings, and doctor availability management.
- **Frontend Pages**: 8 pages (`/admin/overview`, `/admin/appointments`, `/admin/doctors`, `/admin/doctors/[id]`, `/admin/patients`, `/admin/patients/[id]`, `/admin/payments`, `/admin/staff`, `/admin/settings`).
- **Admin Dashboard Composable**: `useAdminDashboard.ts` with state and methods for data fetching.
- **Permission System**: Full CRUD for permissions, with UI for assigning permissions to staff.
- **Master Calendar**: FullCalendar with all bookings across all doctors, color-coded by doctor.
- **AdminSchedule Management**: CRUD endpoints for global schedule configuration (this is the source of truth for patient booking availability).
- **GlobalBlockedDate Management**: CRUD endpoints for blocking specific dates.
- **Booking Review Workflow**: Endpoints for admin to view pending bookings, assign doctors, and confirm.
- **Booking assignment**: Admin assigns a doctor to a PENDING booking and changes status to CONFIRMED.

---

## Out of Scope

- Public marketing pages (Phase 2).
- Authentication (Phase 1).
- Patient dashboard (Phase 4).
- Doctor dashboard (Phase 5).
- Booking flow (Phase 3).
- Production deployment (Phase 7).

---

## Dependencies

**Must exist from Phase 0:**
- `server/utils/prisma.ts` — singleton Prisma client.
- `server/utils/auth.ts` — `requireAuth`.
- `server/utils/email.ts` — `sendEmail`, `doctorWelcomeTemplate`, `bookingCancellationTemplate`.
- `layouts/dashboard.vue` — base dashboard layout (extend in this phase).
- `Permission` model in `schema.prisma`.

**Must exist from Phase 1:**
- `middleware/auth.ts` — protect routes.
- `middleware/staff-only.ts` — restrict to staff.
- `useAuth` composable — check auth state and permissions.

**Must exist from Phase 2:**
- `layouts/default.vue` — public layout (not used here).

**Must exist from Phase 3:**
- `Booking`, `Payment`, `Doctor`, `User` models and API endpoints.
- `AdminSchedule`, `GlobalBlockedDate` models (the source of truth for patient booking availability).

**Must exist from Phase 4:**
- Jitsi integration patterns (reuse for admin session management if needed).

**Must exist from Phase 5:**
- Calendar integration patterns (reuse for master calendar).

**Environment Variables:**
- `SEED_ADMIN_EMAIL` — to protect seed admin from deactivation.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` — for staff welcome emails.

---

## Stack Used

```
nuxt: ^3.x
shadcn-vue: latest
@nuxtjs/tailwindcss: latest
fullcalendar: ^6.x
```

---

## Folder Structure

```
pages/
├── admin.vue                            (redirect to /admin/overview)
└── admin/
    ├── overview.vue                     (create)
    ├── appointments.vue                 (create)
    ├── doctors.vue                      (create)
    ├── doctors/
    │   └── [id].vue                     (create)
    ├── patients.vue                     (create)
    ├── patients/
    │   └── [id].vue                     (create)
    ├── payments.vue                     (create)
    ├── staff.vue                        (create)
    └── settings.vue                     (create)

modules/admin/
├── layouts/
│   └── AdminLayout.vue                 (create)
├── composables/
│   └── useAdminDashboard.ts            (create)
└── server/
    └── api/
        └── admin/
            ├── overview.get.ts              (create)
            ├── bookings.get.ts              (create)
            ├── bookings/
            │   ├── pending.get.ts           (create — list PENDING bookings)
            │   ├── [id].get.ts               (create)
            │   └── [id]/
            │       ├── assign.patch.ts       (create — assign doctor, confirm booking)
            │       └── cancel.patch.ts       (create)
            ├── schedule/
            │   ├── index.get.ts              (create — list AdminSchedule records)
            │   ├── index.post.ts             (create — create AdminSchedule record)
            │   ├── [id].patch.ts             (create — update AdminSchedule record)
            │   └── [id].delete.ts            (create — delete AdminSchedule record)
            ├── blocked-dates/
            │   ├── index.get.ts              (create — list GlobalBlockedDate records)
            │   ├── index.post.ts             (create — create GlobalBlockedDate record)
            │   └── [id].delete.ts            (create — delete GlobalBlockedDate record)
            ├── doctors.get.ts               (create)
            ├── doctors/
            │   ├── [id].get.ts               (create)
            │   ├── index.post.ts             (create)
            │   ├── [id].patch.ts             (create)
            │   └── availability/
            │       ├── index.get.ts          (create)
            │       ├── index.post.ts         (create)
            │       ├── block.post.ts         (create)
            │       └── block/
            │           └── [blockId].delete.ts (create)
            ├── patients.get.ts               (create)
            ├── patients/
            │   └── [id].get.ts               (create)
            ├── payments.get.ts               (create)
            ├── staff.get.ts                  (create)
            ├── staff/
            │   ├── index.post.ts             (create)
            │   ├── [id].patch.ts             (create)
            │   └── [id].delete.ts             (create)
            └── settings/
                ├── index.get.ts              (create)
                └── index.patch.ts            (create)
```

Note: All pages are created inside the top-level `pages/` directory
(e.g., `pages/admin/overview.vue`), not inside the module folder.
The module folder contains only layouts, composables, components, and server API handlers.

---

## Key Conventions

- **Layout**: All admin pages use `AdminLayout`.
- **Middleware**: Apply `auth` + `staff-only` to all admin routes.
- **Permission Checks**: All admin API endpoints call `requirePermission(event, resource, action)` instead of just `requireAuth`.
- **Sidebar Links**: Only show links the user has READ permission for (except Overview, which is always visible).
- **Data Fetching**: Use `useAsyncData` or `useFetch` for server-side data fetching.
- **Permission System**: Permissions are **never cached** in the JWT or cookie. Query the database on every request.
- **Color-Coding**: Assign doctors a color from a fixed array for the master calendar.
- **Seed Admin Protection**: The seed admin account (identified by `SEED_ADMIN_EMAIL`) cannot be deactivated or deleted.
- **Settings**: Payment gateway keys must always be masked in API responses and UI.
- **Environment variables:** Two rules apply depending on context:
  1. Server utilities (`server/utils/*.ts`): Read directly from `process.env`. These files are server-only and not part of Nuxt's module system, so `useRuntimeConfig()` is not available.
  2. Nitro route handlers (`server/api/**/*.ts` and `modules/*/server/api/**/*.ts`): Use `useRuntimeConfig()` to read variables defined in `nuxt.config.ts` under `runtimeConfig`. Never call `process.env` directly in route handlers — use the runtime config object instead.

---

## Notes for the AI

- The permission check must query the database on every request — **never cache permissions** in the JWT or cookie.
- Color-coding doctors on the master calendar: assign colors from a fixed array `['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2']` based on doctor index. Store mapping in the composable — not the database.
- The seed admin is identified by the `SEED_ADMIN_EMAIL` env variable — protect this account from deactivation in `DELETE /api/admin/staff/:id`.
- Overview stats must use Prisma aggregate queries — **never fetch all records and count in JavaScript**.
- The permission builder UI in the staff modal must make it visually clear which actions depend on others (e.g., UPDATE usually requires READ first). Enforce this in the UI only — the API accepts any combination.
- Payment gateway keys: on `PATCH /api/admin/settings`, check if the submitted value starts with `****` — if yes, skip updating that field.
- Doctor availability management from admin: full replace for availability (delete existing, create new).
- **Admin-controlled booking availability**: The global `AdminSchedule` (and `GlobalBlockedDate`) is the single source of truth for what dates/slots patients can book. Managing it belongs in Admin (this phase). Doctor-controlled `Availability`/`BlockedSlot` is only for the doctor's calendar display (Phase 5) — it does NOT affect patient booking availability.
- **Booking assignment**: Bookings stay `PENDING` after payment until the admin assigns a doctor. `PATCH /api/admin/bookings/:id/assign` sets `doctorId` and flips status to `CONFIRMED`, then sends confirmation emails to both patient and doctor.
