# Project Status Check

**Date:** Sep 03 2026

---

## 1. Last Change

### What was done
Phase 6 (Admin Dashboard) frontend + backend scaffolding, plus the Patient Calendar rewired onto **Admin availability** (Phase 4). The last committed work is the admin dashboard UI and supporting composable; the working tree adds the admin/session server routes, meeting lobby, and admin pages.

### Files changed
**New (untracked):**
- `layouts/admin.vue` — admin shell (sidebar = Overview / Appointments / Settings, mobile nav, `<Toaster />`)
- `pages/admin/appointments.vue` — master calendar tab + Pending Bookings tab + Assign Doctor modal
- `pages/admin/settings.vue` — Schedule section + Blocked Dates section
- `pages/admin.vue` (replaced placeholder) — `/admin` overview with stat cards
- `modules/admin/composables/useAdminDashboard.ts`, `modules/admin/composables/types.ts`
- `modules/admin/server/api/admin/schedule/*`, `modules/admin/server/api/admin/blocked-dates/*`, `modules/admin/server/api/admin/bookings/pending.get.ts`, `modules/admin/server/api/admin/bookings/[id]/assign.patch.ts`
- `modules/session/*` (lobby composable, `MeetingLayout`, `/api/meeting/lobby/:id`)
- `tests/api/admin/*`, `tests/api/session/*`, `tests/utils/meeting.test.ts`

**Modified:**
- `server/utils/admin-availability.ts`, `server/utils/booking-status.ts`, `server/utils/meeting.ts`, `server/utils/email.ts`, `server/utils/validation.ts`
- `modules/booking/*` (available-dates, available-slots, create switched to admin availability)
- `prisma/schema.prisma` (added `AdminSchedule`, `GlobalBlockedDate`, `AssignDoctor`/status fields), `prisma/seed.ts`
- `pages/dashboard/appointments.vue`, `modules/patient/layouts/PatientLayout.vue`, `project overview/*` docs

---

## 2. Current Status

### Patient Calendar — Working (Phase 4-5)
FullCalendar month view driven by `/api/booking/available-dates` & `/api/booking/available-slots`. Reads from **Admin availability** (see §3). Joinable confirmed sessions route to the Lobby.

### Availability — Working (Admin is source of truth)
`getAdminAvailableSlots`/`getAdminAvailableDates` in `server/utils/admin-availability.ts` read `AdminSchedule` + `GlobalBlockedDate` + holidays + CONFIRMED bookings to build bookable slots. Slots carry **no doctorId**.

### Booking — Working
`POST /api/booking/create` re-validates the slot against admin availability, creates a booking with `doctorId: null` and `status: 'PENDING'`, and a PENDING payment. Cancel endpoint exists.

### Meeting Lobby — Partially implemented
`/api/meeting/lobby/:meetingId` resolves role (patient/doctor/staff) and `canJoin` gated by status `CONFIRMED` + window (`canJoinMeetingAt`). `MeetingLayout` + `useMeetingLobby` exist. **Not implemented:** joining the actual Jitsi call, session room creation on confirm, and doctor/staff join entry-points.

### Admin Dashboard — Frontend only (not fully wired)
`pages/admin/*` + `layouts/admin.vue` render, but the composable calls endpoints that **don't match the real server routes** (see below). The admin account has **no permissions**, so all admin APIs 403.

### Admin Availability — Working (API + tests)
`/api/admin/schedule` (list/create/patch/delete), `/api/admin/blocked-dates` (list/create/delete) implemented and unit-tested.

### Doctor Assignment — Partially implemented / Frontend gap
`PATCH /api/admin/bookings/:id/assign` exists, validates doctor conflict, flips booking to `CONFIRMED`, sends confirmation emails (tested). **Missing:** doctor listing endpoint + the UI dropdown can't load doctors; frontend call path doesn't match the backend contract.

#### Known integration mismatches (composable ⇄ server)
| Composable call (frontend) | Actual server endpoint | Result |
|---|---|---|
| `GET /api/admin/schedules` (plural) | `GET /api/admin/schedule` | 404 |
| `POST/PATCH/DELETE /api/admin/schedules/:id` | `/api/admin/schedule/:id` | 404 |
| `GET /api/admin/pending-bookings` | `GET /api/admin/bookings/pending` (returns `{bookings:[...]}`) | 404 / wrong shape |
| `POST /api/admin/bookings/:id/assign` (expects `{ok:true}`) | returns `{booking:{...}}` | treated as failure |
| `GET /api/admin/bookings` (master calendar) | none | 404 |
| `PATCH /api/admin/bookings/:id/status` | none | 404 |
| `GET /api/admin/doctors?active=true` | none | 404 |

---

## 3. Important Issue — Patient Calendar data source

**The Patient Calendar is currently using ADMIN availability — which is correct.**

Verified path:
1. `modules/booking/server/api/booking/available-dates.get.ts` → `getAdminAvailableDates()` (AdminSchedule)
2. `modules/booking/server/api/booking/available-slots.get.ts` → `getAdminAvailableSlots()` (AdminSchedule + GlobalBlockedDate)
3. `modules/booking/server/api/booking/create.post.ts` → re-validates against `getAdminAvailableSlots`; stores `doctorId: null`, `status: 'PENDING'`
4. Admin reviews `PENDING` bookings, assigns a doctor → `CONFIRMED`

**Doctor availability is NOT the source of truth for patient-facing booking.** `Doctor.Availability` is in the schema for the doctor's own schedule later but is not consulted by the booking/calendar endpoints. The stated business logic is honored.

> Note: `server/utils/admin-availability.ts` re-exports names (`timeToMinutes`, `formatDateISO`, `parseISODate`) that also exist in `server/utils/availability.ts`, producing build warnings ("Duplicated imports"). Harmless but worth consolidating.

---

## 4. Next Step (ONE thing)

**Wire the Admin Dashboard frontend to the real backend endpoints and seed admin permissions.**

That is the next step because the backend contract (Phase 4/5) is done and tested, but the Phase 6 UI currently calls wrong/ missing endpoints (plural `schedule`, `pending-bookings`, non-existent `bookings` list, `/status`, `/doctors`). Until this is fixed, the admin cannot view pending bookings, load the master calendar, or assign a doctor — the central Phase 6 workflow — despite the backend supporting it. This also requires seeding `Permission` rows (`SETTINGS:UPDATE`, `APPOINTMENTS:READ/UPDATE`) for a STAFF user, otherwise every admin endpoint returns 403.

---

## 5. Validation

- **TypeScript:** ❌ NOT verifiable — no type checker installed (`vue-tsc`/Golar missing; `nuxi typecheck` cannot run). Build compiles with Vue's own checks only.
- **Build:** ✅ PASS — `nuxt build` completes (client + server + nitro). Only non-fatal "Duplicated imports" warnings from `admin-availability.ts`.
- **Tests:** ✅ PASS — `vitest run` → **30 files / 187 tests passed** (auth, booking, patient, payment, admin schedule/blocked-dates/bookings, session lobby, utils/meeting, permissions). E2E present under `tests/e2e` but not run in this check.

---
*Report generated from code inspection + build + test run. No code was modified.*