# Phase 5 — Doctor Dashboard
## expected-output.md

---

## API Endpoints Delivered

| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/doctor/profile` | DOCTOR | Fetch doctor profile. |
| PATCH | `/api/doctor/profile` | DOCTOR | Update doctor profile (name, phone, bio, specializations). |
| POST | `/api/doctor/profile/photo` | DOCTOR | Upload profile photo. |
| GET | `/api/doctor/bookings` | DOCTOR | Fetch doctor's bookings for a date range. |
| GET | `/api/doctor/bookings/:id` | DOCTOR | Fetch full booking details by ID. |
| GET | `/api/doctor/session/:bookingId` | DOCTOR | Get Jitsi room for a booking. |

---

## Pages Delivered

| Route | Layout Used | Middleware Applied | Description |
|---|---|---|---|
| `/doctor` | None | `auth` + `doctor-only` | Redirects to `/doctor/calendar`. |
| `/doctor/calendar` | `DoctorLayout` | `auth` + `doctor-only` | Calendar page with month/week/day views. |
| `/doctor/profile` | `DoctorLayout` | `auth` + `doctor-only` | Profile edit page with photo upload and specializations. |
| `/doctor/session/:bookingId` | `DoctorLayout` | `auth` + `doctor-only` | Jitsi session room page. |

**Note:** All pages are created inside the top-level `pages/` directory (e.g., `pages/doctor/calendar.vue`), not inside the module folder. The module folder contains only layouts, composables, components, and server API handlers.

---

## Components Delivered

| File | Description |
|---|---|
| `modules/doctor/components/SpecializationsTagInput.vue` | Custom component for adding/removing specializations as tags. |

---

## Composables Delivered

| File | State | Methods |
|---|---|---|
| `modules/doctor/composables/useDoctorDashboard.ts` | `profile`, `bookings`, `isLoading`, `error` | `fetchProfile()`, `updateProfile(data)`, `uploadPhoto(file)`, `fetchBookings(start, end)` |

---

## Layouts Delivered

| File | Description |
|---|---|
| `modules/doctor/layouts/DoctorLayout.vue` | Doctor dashboard layout with sidebar (desktop), bottom nav (mobile), and incomplete profile banner. |

**Extends:**
- `layouts/dashboard.vue` (from Phase 0).

---

## Server Utilities Delivered

**Reused from Phase 0:**
- `server/utils/prisma.ts` — `prisma` singleton.
- `server/utils/auth.ts` — `requireAuth`.

**Reused from Phase 3:**
- `server/utils/availability.ts` — Not directly used, but `Booking` model is shared.

**New in Phase 5:**
None.

---

## Middleware Delivered

**Reused from Phase 1:**
- `middleware/auth.ts` — Protect routes.
- `middleware/doctor-only.ts` — Restrict to doctors.

**New in Phase 5:**
None.

---

## Database Changes

No schema changes in this phase. Uses existing models:
- `User`
- `Doctor`
- `Booking`
- `SessionRoom`

---

## Emails Sent

None. All emails are triggered by webhooks (Phase 3) or admin actions (Phase 6).

---

## Environment Variables Used

| Variable | Where Used |
|---|---|
| `UPLOAD_PATH` | `POST /api/doctor/profile/photo` to save uploaded photos. |
| `UPLOAD_MAX_SIZE` | `POST /api/doctor/profile/photo` to validate file size. |
| `JITSI_DOMAIN` | `GET /api/doctor/session/:bookingId` to return Jitsi domain. |

---

## Third-Party Integrations

| Service | Purpose | Configuration |
|---|---|---|
| FullCalendar | Calendar UI for bookings | Installed via npm, configured in `/doctor/calendar` page. |
| Jitsi Meet External API | Video call embed | Loaded via CDN (`https://meet.jit.si/external_api.js`) or local fallback. |

---

## What the Next Phase (Phase 6) Will Receive

- Complete doctor dashboard with all pages working:
  - Calendar page with month/week/day views.
  - Profile page with photo upload and specializations tag input.
  - Session room page with Jitsi integration.
- `DoctorLayout` with sidebar, mobile nav, and incomplete profile banner.
- `useDoctorDashboard` composable for data management.
- All doctor API endpoints.
- Session room accessible only within time window.
- Bookings fetched for visible date range in calendar.
- Doctor cannot access another doctor's bookings (verified server-side).
- Doctor and patient share the same Jitsi room for a booking.
- All pages responsive on mobile.
