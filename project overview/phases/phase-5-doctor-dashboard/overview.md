# Phase 5 — Doctor Dashboard
## overview.md

---

## Goal

Phase 5 builds the doctor-facing dashboard for the Tawasul Academy platform. After this phase, a doctor can complete their profile, view all assigned appointments on a calendar, and join their online session at the correct time. The doctor dashboard is intentionally simple: profile management, a calendar of assigned bookings, and session room access. Doctors do **not** manage bookings — the admin does that in Phase 6.

---

## Scope

- **Doctor Dashboard Layout**: `modules/doctor/layouts/DoctorLayout.vue` with sidebar and mobile bottom nav.
- **API Endpoints**: 6 endpoints for profile, photo upload, bookings, booking details, and session room access.
- **Frontend Pages**: 3 pages (`/doctor/calendar`, `/doctor/profile`, `/doctor/session/[bookingId]`).
- **Doctor Dashboard Composable**: `useDoctorDashboard.ts` with state and methods for data fetching.
- **Calendar Integration**: FullCalendar with month, week, and day views for doctor's bookings.
- **Session Room**: Jitsi integration (same as patient dashboard in Phase 4).
- **Middleware**: Apply `auth` + `doctor-only` middleware to all doctor routes.
- **Incomplete Profile Banner**: Show a warning if the doctor's bio is empty.

---

## Out of Scope

- Admin dashboard (Phase 6).
- Patient dashboard (Phase 4).
- Booking management (Phase 6).
- Availability management (Phase 6 for admin, but doctors can view their own availability).
- Public marketing pages (Phase 2).
- Authentication (Phase 1).

---

## Dependencies

**Must exist from Phase 0:**
- `server/utils/prisma.ts` — singleton Prisma client.
- `server/utils/auth.ts` — `requireAuth`.
- `layouts/dashboard.vue` — base dashboard layout (extend in this phase).
- `UPLOAD_PATH` env var for photo uploads.

**Must exist from Phase 1:**
- `middleware/auth.ts` — protect routes.
- `middleware/doctor-only.ts` — restrict to doctors.
- `useAuth` composable — check auth state.

**Must exist from Phase 2:**
- `layouts/default.vue` — public layout (not used here).

**Must exist from Phase 3:**
- `Booking`, `Payment`, `SessionRoom` models and API endpoints.
- `JITSI_DOMAIN` env var.

**Must exist from Phase 4:**
- Jitsi integration patterns (reuse for doctor session room).

**New Environment Variables:**
- None. Uses existing `UPLOAD_PATH` and `JITSI_DOMAIN`.

---

## Stack Used

```
nuxt: ^3.x
shadcn-vue: latest
@nuxtjs/tailwindcss: latest
fullcalendar: ^6.x
jitsi-meet: ^1.x (via External API script)
```

---

## Folder Structure

```
pages/
├── doctor.vue                           (redirect to /doctor/calendar)
└── doctor/
    ├── calendar.vue                     (create)
    ├── profile.vue                      (create)
    └── session/
        └── [bookingId].vue              (create)

modules/doctor/
├── layouts/
│   └── DoctorLayout.vue                (create)
├── composables/
│   └── useDoctorDashboard.ts           (create)
└── server/
    └── api/
        └── doctor/
            ├── profile.get.ts          (create)
            ├── profile.patch.ts        (create)
            ├── profile/
            │   └── photo.post.ts       (create)
            ├── bookings.get.ts          (create)
            ├── bookings/
            │   └── [id].get.ts           (create)
            └── session/
                └── [bookingId].get.ts  (create)
```

Note: All pages are created inside the top-level `pages/` directory
(e.g., `pages/doctor/calendar.vue`), not inside the module folder.
The module folder contains only layouts, composables, components, and server API handlers.

---

## Key Conventions

- **Layout**: All doctor pages use `DoctorLayout`.
- **Middleware**: Apply `auth` + `doctor-only` to all doctor routes.
- **Data Fetching**: Use `useAsyncData` or `useFetch` for server-side data fetching.
- **Auth Protection**: Every API endpoint must filter by the logged-in doctor's `userId` (via linked `Doctor` record). **Never trust the frontend.**
- **Calendar**: Use FullCalendar with month, week, and day views. Fetch bookings for the visible date range.
- **Session Room**: Reuse the same Jitsi integration as Phase 4 (patient dashboard).
- **Time Window**: Session room is accessible from 5 minutes before `startTime` to 15 minutes after `endTime` (same as patient).
- **Photo Uploads**: Save to `UPLOAD_PATH/doctors/{userId}-{timestamp}.ext`.
- **Incomplete Profile Banner**: Show a yellow shadcn-vue Alert banner on all pages if `doctor.bio` is empty.
- **Environment variables:** Two rules apply depending on context:
  1. Server utilities (`server/utils/*.ts`): Read directly from `process.env`. These files are server-only and not part of Nuxt's module system, so `useRuntimeConfig()` is not available.
  2. Nitro route handlers (`server/api/**/*.ts` and `modules/*/server/api/**/*.ts`): Use `useRuntimeConfig()` to read variables defined in `nuxt.config.ts` under `runtimeConfig`. Never call `process.env` directly in route handlers — use the runtime config object instead.

---

## Notes for the AI

- The doctor's profile is **visible to admin only** (public expert profile comes from the public API in Phase 2).
- The doctor does **not** manage their own availability — the admin does this in Phase 6.
- The `SessionRoom` record is **shared** between patient and doctor — both use the same `roomName`. The first one to hit the session endpoint creates the record, the second one reads it. Use `upsert` to handle this safely.
- The `datesSet` FullCalendar callback fires on initial render and on navigation. Debounce by 100ms to avoid two fetches on load.
- Doctor session endpoint must verify `doctorId` ownership the same way patient endpoint verifies `userId` — **never skip this check**.
- Specializations tag input: Use a simple custom component with a text input and a list of removable chips. No external library needed.
