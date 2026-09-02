# Phase 4 — Patient Dashboard
## overview.md

---

## Goal

Phase 4 builds the complete patient-facing dashboard for the Tawasul Academy platform. After this phase, a logged-in patient can view their appointments (upcoming and past), join their online session at the correct time, manage their payments, and edit their profile. The dashboard is protected (PATIENT role only) and uses a sidebar layout on desktop and a bottom navigation on mobile. All data is scoped to the logged-in patient only, enforced server-side on every endpoint.

---

## Scope

- **Dashboard Layout**: `modules/patient/layouts/PatientLayout.vue` with sidebar and mobile bottom nav.
- **API Endpoints**: 6 endpoints for profile, photo upload, appointments, payments, and session room access.
- **Frontend Pages**: 4 pages (`/dashboard/appointments`, `/dashboard/payments`, `/dashboard/profile`, `/dashboard/session/[bookingId]`).
- **Patient Dashboard Composable**: `usePatientDashboard.ts` with state and methods for data fetching.
- **Session Room**: Jitsi integration for video calls, accessible only within the time window.
- **Middleware**: Apply `auth` + `patient-only` middleware to all patient routes.

---

## Out of Scope

- Doctor dashboard (Phase 5).
- Admin dashboard (Phase 6).
- Booking flow (Phase 3).
- Public marketing pages (Phase 2).
- Authentication (Phase 1).
- Permission system (Phase 6).

---

## Dependencies

**Must exist from Phase 0:**
- `server/utils/prisma.ts` — singleton Prisma client.
- `server/utils/auth.ts` — `requireAuth`.
- `layouts/dashboard.vue` — base dashboard layout (extend in this phase).
- `UPLOAD_PATH` env var for photo uploads.

**Must exist from Phase 1:**
- `middleware/auth.ts` — protect routes.
- `middleware/patient-only.ts` — restrict to patients.
- `useAuth` composable — check auth state.

**Must exist from Phase 2:**
- `layouts/default.vue` — public layout (not used here).

**Must exist from Phase 3:**
- `Booking`, `Payment`, `SessionRoom` models and API endpoints.
- `JITSI_DOMAIN` env var.

**New Environment Variables:**
- None. Uses existing `UPLOAD_PATH` and `JITSI_DOMAIN`.

---

## Stack Used

```
nuxt: ^3.x
shadcn-vue: latest
@nuxtjs/tailwindcss: latest
jitsi-meet: ^1.x (via External API script)
```

---

## Folder Structure

```
pages/
├── dashboard.vue                        (redirect to /dashboard/appointments)
└── dashboard/
    ├── appointments.vue                 (create)
    ├── payments.vue                     (create)
    ├── profile.vue                      (create)
    └── session/
        └── [bookingId].vue              (create)

modules/patient/
├── layouts/
│   └── PatientLayout.vue               (create)
├── composables/
│   └── usePatientDashboard.ts          (create)
└── server/
    └── api/
        └── patient/
            ├── profile.get.ts          (create)
            ├── profile.patch.ts        (create)
            ├── profile/
            │   └── photo.post.ts       (create)
            ├── appointments.get.ts      (create)
            ├── payments.get.ts          (create)
            └── session/
                └── [bookingId].get.ts  (create)

public/
└── jitsi-external-api.js              (optional, if not loading from CDN)
```

Note: Pages live in the top-level `pages/` directory so Nuxt generates the
correct routes (/dashboard/*, /doctor/*, /admin/*). Module folders contain
only layouts, composables, components, and server API handlers.

---

## Key Conventions

- **Layout**: All patient pages use `PatientLayout`.
- **Middleware**: Apply `auth` + `patient-only` to all patient routes.
- **Data Fetching**: Use `useAsyncData` or `useFetch` for server-side data fetching.
- **Auth Protection**: Every API endpoint must filter by the logged-in patient's `userId`. **Never trust the frontend.**
- **Session Room**: Use Jitsi Meet External API (not iframe) for more control (mute, leave, events).
- **Time Window**: Session room is accessible from 5 minutes before `startTime` to 15 minutes after `endTime`.
- **Photo Uploads**: Save to `UPLOAD_PATH/patients/{userId}-{timestamp}.ext`. Ensure the `uploads` directory exists and is mounted in Docker.
- **Error Handling**: Show user-friendly error messages. Use shadcn-vue Toast for success/error notifications.
- **Environment variables:** Two rules apply depending on context:
  1. Server utilities (`server/utils/*.ts`): Read directly from `process.env`. These files are server-only and not part of Nuxt's module system, so `useRuntimeConfig()` is not available.
  2. Nitro route handlers (`server/api/**/*.ts` and `modules/*/server/api/**/*.ts`): Use `useRuntimeConfig()` to read variables defined in `nuxt.config.ts` under `runtimeConfig`. Never call `process.env` directly in route handlers — use the runtime config object instead.

---

## Notes for the AI

- Every API endpoint must filter by the logged-in patient's `userId`. This is **critical** for security.
- The Join Session button must recalculate its enabled state every 60 seconds using `setInterval` (a static check on page load is not enough).
- The session room countdown must poll the API every 30 seconds in case the server clock differs from the client.
- Use `upsert` for `SessionRoom` records to handle both patient and doctor accessing the same room.
- The Jitsi `roomName` must be unique per booking. Use `tawasul-{bookingId}` as the format.
- For MVP, Jitsi runs on `meet.jit.si` — no authentication token needed. Self-hosted with JWT comes later.
