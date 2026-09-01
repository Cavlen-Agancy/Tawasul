# Phase 4 — Patient Dashboard
## expected-output.md

---

## API Endpoints Delivered

| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/patient/profile` | PATIENT | Fetch patient profile. |
| PATCH | `/api/patient/profile` | PATIENT | Update patient profile (name, phone). |
| POST | `/api/patient/profile/photo` | PATIENT | Upload profile photo. |
| GET | `/api/patient/appointments` | PATIENT | Fetch patient appointments (upcoming/past). |
| GET | `/api/patient/payments` | PATIENT | Fetch patient payment history. |
| GET | `/api/patient/session/:bookingId` | PATIENT | Get Jitsi room for a booking. |

**Reused from Phase 3:**
| PATCH | `/api/booking/:id/cancel` | PATIENT or STAFF | Cancel a booking (used in appointments page). |

---

## Pages Delivered

| Route | Layout Used | Middleware Applied | Description | Note |
|---|---|---|---|---|
| `/dashboard` | None | `auth` + `patient-only` | Redirects to `/dashboard/appointments`. | File lives in pages/dashboard/, not modules/patient/pages/ |
| `/dashboard/appointments` | `PatientLayout` | `auth` + `patient-only` | Appointments page with upcoming/past tabs. | File lives in pages/dashboard/, not modules/patient/pages/ |
| `/dashboard/payments` | `PatientLayout` | `auth` + `patient-only` | Payments history page. | File lives in pages/dashboard/, not modules/patient/pages/ |
| `/dashboard/profile` | `PatientLayout` | `auth` + `patient-only` | Profile edit page. | File lives in pages/dashboard/, not modules/patient/pages/ |
| `/dashboard/session/:bookingId` | `PatientLayout` | `auth` + `patient-only` | Jitsi session room page. | File lives in pages/dashboard/, not modules/patient/pages/ |

---

## Components Delivered

None. All pages use HeroUI components directly.

---

## Composables Delivered

| File | State | Methods |
|---|---|---|
| `modules/patient/composables/usePatientDashboard.ts` | `profile`, `upcomingAppointments`, `pastAppointments`, `payments`, `isLoading`, `error` | `fetchProfile()`, `updateProfile(data)`, `uploadPhoto(file)`, `fetchAppointments()`, `cancelAppointment(bookingId)`, `fetchPayments()` |

---

## Layouts Delivered

| File | Description |
|---|---|
| `modules/patient/layouts/PatientLayout.vue` | Patient dashboard layout with sidebar (desktop) and bottom nav (mobile). |

**Extends:**
- `layouts/dashboard.vue` (from Phase 0).

---

## Server Utilities Delivered

**Reused from Phase 0:**
- `server/utils/prisma.ts` — `prisma` singleton.
- `server/utils/auth.ts` — `requireAuth`.

**Reused from Phase 3:**
- `server/utils/availability.ts` — Not directly used, but `Booking` model is shared.

**New in Phase 4:**
None.

---

## Middleware Delivered

**Reused from Phase 1:**
- `middleware/auth.ts` — Protect routes.
- `middleware/patient-only.ts` — Restrict to patients.

**New in Phase 4:**
None.

---

## Database Changes

No schema changes in this phase. Uses existing models:
- `User`
- `Booking`
- `Payment`
- `SessionRoom`

---

## Emails Sent

**Reused from Phase 3:**
- Booking cancellation email (sent when patient cancels via `PATCH /api/booking/:id/cancel`).

**New in Phase 4:**
None. All emails are triggered by webhooks (Phase 3) or cancellation (Phase 3).

---

## Static Assets Delivered

| File | Purpose |
|---|---|
| `/public/jitsi-external-api.js` | Optional local copy of Jitsi External API script (fallback if CDN fails). |

---

## Environment Variables Used

| Variable | Where Used |
|---|---|
| `UPLOAD_PATH` | `POST /api/patient/profile/photo` to save uploaded photos. |
| `UPLOAD_MAX_SIZE` | `POST /api/patient/profile/photo` to validate file size. |
| `JITSI_DOMAIN` | `GET /api/patient/session/:bookingId` to return Jitsi domain. |

---

## Third-Party Integrations

| Service | Purpose | Configuration |
|---|---|---|
| Jitsi Meet External API | Video call embed | Loaded via CDN (`https://meet.jit.si/external_api.js`) or local fallback. |

---

## What the Next Phase (Phase 5) Will Receive

- Complete patient dashboard with all pages working:
  - Appointments page with upcoming/past tabs.
  - Payments page with transaction history.
  - Profile page with photo upload.
  - Session room page with Jitsi integration.
- `PatientLayout` with sidebar and mobile nav.
- `usePatientDashboard` composable for data management.
- All patient API endpoints.
- Session room accessible only within time window.
- Join Session button state updates every 60 seconds.
- Cancel button with 24hr rule enforcement.
- Photo uploads working and displayed immediately.
- All pages responsive on mobile.
