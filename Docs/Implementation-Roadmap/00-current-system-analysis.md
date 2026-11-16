# 00 — Verified Current System Analysis

> **Decision status:** this document records current implementation facts, not target policy. Target decisions are in [`../FINAL-DECISIONS.md`](../FINAL-DECISIONS.md) and mapped in [`../ROADMAP-DECISIONS-UPDATE.md`](../ROADMAP-DECISIONS-UPDATE.md).

**Scope:** only the current implementation relevant to the approved roadmap: booking, availability, payments, doctor/admin/patient calendars, LiveKit sessions, blog/content, authorization, and tests.  
**Method:** static code/config/document inspection only. No build, test, migration, container, browser, database, or Git command was executed.  
**Labels:** CONFIRMED = directly verified in code/config; PARTIALLY VERIFIED = evidence exists but the full runtime path was not exercised; UNVERIFIED = cannot be confirmed statically; MISSING = required implementation does not exist.

## 1. Application Baseline

| Item | Finding | Evidence | Label |
|---|---|---|---|
| Framework | Nuxt 3 + Vue 3 + TypeScript, SSR | `package.json`, `nuxt.config.ts` | CONFIRMED |
| API | Nitro/H3 route handlers | `server/api/**`, `modules/*/server/api/**` | CONFIRMED |
| Database | PostgreSQL + Prisma 5.22 | `prisma/schema.prisma`, compose | CONFIRMED |
| Auth | JWT in HttpOnly `auth_token`, bcrypt passwords, per-request STAFF permissions | `server/utils/auth.ts`, `server/utils/permissions.ts` | CONFIRMED |
| UI | Tailwind + shadcn-vue, FullCalendar, RTL Arabic public pages, English admin/doctor panels | `layouts`, `components`, `tailwind.config.ts` | CONFIRMED |
| Video | LiveKit server + client SDK | `server/utils/livekit-token.ts`, `composables/useLiveKitSession.ts`, `livekit.yaml` | CONFIRMED |
| Payments | Paymob default, Stripe alternative, dev mock fallback | `server/utils/payment.ts`, `modules/payment/server/api/**` | CONFIRMED |
| Blog | No model, API, admin page, or public page | schema + repository search | MISSING |

## 2. Current Booking Flow (End to End)

### 2.1 Patient selects availability

1. `pages/dashboard/appointments.vue` and `modules/booking/pages/book.vue` call:
   - `GET /api/booking/available-dates?month&year`
   - `GET /api/booking/available-slots?date`
2. Both handlers use `getAdminAvailableDates` / `getAdminAvailableSlots` from `server/utils/admin-availability.ts`. **CONFIRMED.**
3. Availability considers:
   - active `AdminSchedule` rows for the day of week
   - `GlobalBlockedDate`
   - fixed/generated Egyptian holidays via `server/utils/holidays.ts`
   - `CONFIRMED` bookings only
4. Availability does **not** consider:
   - `Doctor.Availability`
   - `Doctor.BlockedSlot`
   - `PENDING` bookings
   - a specific doctor (slots carry no `doctorId`)
5. `server/utils/availability.ts` contains a separate, already-written doctor-aware implementation (`getAvailableSlots`, `getAvailableDates`) but it is not called by booking handlers. It checks `Availability`, `BlockedSlot`, active doctors, and holidays, but not `GlobalBlockedDate`. **CONFIRMED by grep and source.**
6. `AdminSchedule` is unique per day (`dayOfWeek @unique`) and seeded with all seven days, 09:00–17:00, 60 minutes. **CONFIRMED** in `prisma/schema.prisma` and `prisma/seed.ts`.

### 2.2 Booking creation

`POST /api/booking/create`:

- Requires `PATIENT`.
- Validates only `{ date, startTime }` using `createBookingSchema`; `sessionType` is read directly from the body as a fallback (`IN_CLINIC` or `ONLINE`). **CONFIRMED.**
- Revalidates the slot against `getAdminAvailableSlots(date)`.
- Computes duration/price from the selected `AdminSchedule` row and `Settings.sessionPricePerHour`.
- Creates `Booking{ userId, doctorId: null, date, startTime, endTime, service, status: PENDING, sessionType }`.
- For `ONLINE`, creates `Payment{PENDING}`.
- For `IN_CLINIC`, creates no payment and returns amount `0`, but **still leaves the booking `PENDING`**. **CONFIRMED.**
- It does not use a database transaction and does not lock the slot. Concurrent creates can both observe the same availability and both insert a booking. **CONFIRMED by source; runtime race not executed.**

### 2.3 Admin confirmation

- `PATCH /api/admin/bookings/:id/assign` requires `APPOINTMENTS:UPDATE`.
- It only accepts a booking with status `PENDING`.
- It checks `CONFIRMED` bookings for the chosen doctor, then sets `doctorId` and status `CONFIRMED`.
- It sends confirmation emails to patient and doctor. **CONFIRMED.**
- The admin appointments page loads `GET /api/admin/bookings/pending`, renders a pending queue, and opens an assign modal. **CONFIRMED.**

### 2.4 Current patient-facing consequences

- A patient cannot choose a doctor. **CONFIRMED.**
- `IN_CLINIC` and `ONLINE` bookings both wait for admin assignment. **CONFIRMED.**
- A successful payment still leaves the booking `PENDING`. **CONFIRMED** in `server/utils/booking-status.ts`.
- A patient can create more than one active booking at the same time because slot checks count only `CONFIRMED` bookings and booking creation is not serialized. **CONFIRMED at source level.**
- The patient dashboard booking panel and `/book` both duplicate booking logic, with the dashboard flow supporting `IN_CLINIC` and `/book` effectively defaulting to `ONLINE`. **CONFIRMED.**

## 3. Availability and Scheduling Model

### 3.1 Data model as built

| Model | Purpose | Current use | Label |
|---|---|---|---|
| `AdminSchedule` | Global weekly clinic schedule, unique day | Authoritative patient slot source | CONFIRMED |
| `GlobalBlockedDate` | Clinic-wide closed dates | Applied by `admin-availability` | CONFIRMED |
| `Availability` | Doctor weekly schedule, unique per doctor/day | Admin CRUD exists; not used for patient slots | CONFIRMED |
| `BlockedSlot` | Doctor-specific date/time block | Admin CRUD exists; not used for patient slots | CONFIRMED |
| `Settings.defaultWorking*` | Display/default values | Not the live slot source | CONFIRMED |
| `holidays.ts` | Egyptian public holidays | Applied by both availability utils | CONFIRMED |

### 3.2 Admin UI

- Doctor detail page `pages/admin/doctors/[id].vue` and APIs `modules/admin/server/api/admin/doctors/[id]/availability*` implement per-doctor weekly availability and blocked slots. **CONFIRMED.**
- Admin settings/schedule page edits `AdminSchedule` and global blocked dates. **CONFIRMED.**
- New doctor creation (`modules/admin/server/api/admin/doctors/index.post.ts`) does **not** copy `AdminSchedule` into `Availability`. A new doctor therefore has no doctor-specific availability rows. **CONFIRMED.**
- Admin doctor update syncs `Doctor.isActive` and `User.isActive` transactionally. **CONFIRMED.**

### 3.3 Availability inconsistencies that matter to this roadmap

1. Two sources of truth coexist: `AdminSchedule` (used) and `Availability` (not used). **CONFIRMED.**
2. `server/utils/availability.ts` does not subtract `GlobalBlockedDate`; if reused blindly it would reopen clinic-wide closures. **CONFIRMED.**
3. The admin schedule is seeded for all seven days even though the patient UI also treats Friday as a closed day in some code paths (`isClosedDay` in `usePatientDashboard.ts`). The server-side admin schedule remains the live authority. **PARTIALLY VERIFIED** because the exact Friday business rule is not applied consistently by the API.
4. Doctor-specific schedules have no explicit “use default” or “closed” flag; a doctor with zero rows is indistinguishable from “not configured”. **CONFIRMED.**

## 4. Payment Lifecycle

### 4.1 Creation and redirection

- `POST /api/payment/initiate` is PATIENT-only and enforces booking ownership.
- `createPaymentSession` returns:
  - Paymob iframe `paymentUrl` when configured.
  - Stripe `clientSecret` when configured.
  - Local dev mock URL `/api/payment/dev/complete?...` when keys are placeholders.
- `/book` and the dashboard flow redirect only when `paymentUrl` exists. For Stripe, the current page displays “Stripe Checkout is not configured … booking will remain pending.” **CONFIRMED**; Stripe Checkout is therefore not usable from the UI today even with keys.
- `Payment` is created before payment initiation. **CONFIRMED.**

### 4.2 Webhooks and success

- `POST /api/payment/webhook` verifies Paymob HMAC over the raw body (or canonical parsed JSON fallback) or Stripe signature. Missing secrets fail closed. **CONFIRMED.**
- On SUCCESS, `handleSuccessfulPayment` updates `Payment.status = SUCCESS` and sends a “booking received” email if the booking is still `PENDING`. It does **not** change the booking status, create a room, or confirm. **CONFIRMED.**
- On failure, `handleFailedPayment` only sets `Payment.status = FAILED`; booking stays `PENDING`. **CONFIRMED.**
- `GET /api/payment/dev/complete` is disabled in production and when keys are configured; it calls the same success handler. **CONFIRMED.**

### 4.3 Idempotency, races, and duplicate callbacks

- There is no transaction or row-level lock around payment + booking updates. **CONFIRMED.**
- `handleSuccessfulPayment` checks `payment.status !== 'SUCCESS'` before updating the payment, but the booking confirmation (in the target design) will need a conditional transition to avoid duplicate emails and duplicate side effects. **CONFIRMED for current code.**
- The webhook returns `200` once the signature is valid even if internal processing fails; failures are only logged. A transient DB failure can therefore leave a paid booking unconfirmed and the gateway will not retry. **CONFIRMED.**
- There is no booking hold/expiry field. **MISSING.**
- There is no `EXPIRED` booking status. **MISSING.**

### 4.4 Cancellation/refund behavior

- Admin cancel updates only `Payment.status = SUCCESS` rows to `REFUNDED`. **CONFIRMED.**
- Patient cancel updates every non-`REFUNDED` payment to `REFUNDED`, including `PENDING` and `FAILED`. This is inconsistent with the admin rule. **CONFIRMED.**
- No gateway refund API call exists; refunds are status-only/tracked manually. **CONFIRMED.**

## 5. Doctor Dashboard and Authorization

### 5.1 Current doctor experience

- `layouts/doctor-layout.vue` (the layout actually used by doctor pages) has nav: My Calendar, My Patients, My Profile. **CONFIRMED.**
- `modules/doctor/layouts/DoctorLayout.vue` is a near-duplicate registered as `DoctorLayout`; current pages use `doctor-layout` instead. **CONFIRMED; duplicate layout risk.**
- Doctor pages:
  - `/doctor/calendar` — FullCalendar, own bookings.
  - `/doctor/patients` — patient directory.
  - `/doctor/patients/:userId` — patient detail, session timeline, notes; shows notes by other doctors to assigned doctors.
  - `/doctor/profile` — self-edit name/phone/bio/specializations/photo.
  - `/doctor/session/:bookingId` — LiveKit session.
- A profile-incomplete banner fetches `/api/doctor/profile` in the layout. **CONFIRMED.**

### 5.2 Server authorization

- `GET /api/doctor/bookings` resolves the authenticated doctor and filters `doctorId: doctor.id`; it returns bookings of all statuses. **CONFIRMED.**
- `GET /api/doctor/bookings/:id` checks `booking.doctorId === doctor.id`; other doctors receive 403. **CONFIRMED.**
- Patient/doctor session endpoints check ownership/assignment. **CONFIRMED.**
- Doctor patient detail/notes require at least one `CONFIRMED` booking with that patient. **CONFIRMED.**
- `GET /api/doctor/patients/:userId/notes` intentionally includes notes by other doctors who share the patient. This is a PHI exposure that conflicts with the simplified doctor workspace unless removed or explicitly re-approved. **CONFIRMED.**
- `middleware/doctor-only.ts` only checks account type; API checks remain authoritative. **CONFIRMED.**

## 6. Patient Appointments and Calendars

- Patient appointments API supports `upcoming`, `past`, `all`; `upcoming` includes only `CONFIRMED` and today/future. **CONFIRMED.**
- Patient dashboard calendar displays all bookings, including `PENDING`, and supports reschedule/cancel UI.
- `canJoin` in `pages/dashboard/appointments.vue` opens 5 minutes before start and closes 15 minutes after end. **CONFIRMED.**
- The reschedule UI calls `/api/patient/appointments/:bookingId/reschedule`. **No such handler exists in the current tree.** On failure it falls back to `PATCH /api/booking/:id` only for the same date. Cross-date rescheduling is therefore broken. **MISSING endpoint; PARTIALLY VERIFIED fallback.**
- `PATCH /api/booking/:id` (same-day time change) validates against `getAdminAvailableSlots` and checks competing non-cancelled bookings globally, not per doctor. **CONFIRMED.**
- Doctor calendar `canJoinBooking` also uses end + 15 minutes. **CONFIRMED.**

## 7. LiveKit Session Lifecycle

### 7.1 Actual join path

1. Patient calendar “Join Session” navigates to `/dashboard/session/:bookingId` (not `/meeting/:id/lobby`). **CONFIRMED.**
2. The page calls `GET /api/patient/session/:bookingId`.
3. The API:
   - requires `PATIENT`
   - verifies booking ownership
   - in non-test mode requires `status === CONFIRMED`
   - rejects `IN_CLINIC`
   - enforces `canJoinMeetingAt`
   - creates/upserts `SessionRoom{ bookingId, roomName, expiresAt: closeAt }`
   - returns a LiveKit member token with `canPublish: false`, `canSubscribe: false`, `ttl: 3600`.
4. The patient connects to LiveKit and enters the in-page Virtual Waiting Room.
5. The doctor opens `/doctor/session/:bookingId`, receives a moderator token (`canPublish/canSubscribe: true`), and sees waiting participants.
6. The doctor presses “Admit”; `POST /api/doctor/session/:bookingId/admit` calls `RoomServiceClient.updateParticipant` to grant publish/subscribe permissions. The patient page detects the permission change and joins the active session.

### 7.2 Current limitations

- **Window closes at end + 15 minutes.** `MEETING_CLOSE_LATE_MIN = 15`, patient/doctor calendars use +15. The requirement says no join action at or after the exact end. **CONFIRMED.**
- `canJoinMeetingAt` uses `now <= closeAt`; the exact close timestamp is still joinable. **CONFIRMED.**
- The doctor admit endpoint has **no time-window check** and does not verify that the admitted identity equals the booking's patient user ID. It only verifies the doctor owns the booking and a room exists. **CONFIRMED.**
- Token TTL is fixed at 3600 seconds. A token issued near the end remains valid beyond the appointment. **CONFIRMED.**
- `SessionRoom.expiresAt` is stored but not used to invalidate access. **CONFIRMED.**
- `/meeting/:id/lobby` is a separate page with a Join button that only sets a timeout and never connects to LiveKit. It is not linked from the actual patient join button. **CONFIRMED dead/stub flow.**
- Repeated entry is not explicitly blocked. A fresh page mount fetches a new token and reconnects; a new participant with the same identity will again have `canPublish/canSubscribe = false` and must be admitted again. **PARTIALLY VERIFIED at source level; no runtime LiveKit test was executed.**
- `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE=true` bypasses status/time checks in `NODE_ENV=development` only. Current `.env` has the flag true and `NODE_ENV=development`. **CONFIRMED configuration.**
- LiveKit room lifecycle/empty timeout is not explicitly configured; room auto-creation and recreation after disconnect depend on LiveKit defaults. **UNVERIFIED runtime behavior.**

## 8. Blog / Content Architecture

- No `Post`, `Article`, or blog model exists in `prisma/schema.prisma`. **MISSING.**
- No public blog pages, admin blog pages, APIs, nav links, or content editor exist. **MISSING.**
- There is no markdown/renderer/CMS dependency in `package.json`. **CONFIRMED.**
- Homepage content is static data in `lib/home-content.ts` and hard-coded sections in `pages/index.vue`; there is no general content store. **CONFIRMED.**
- Old documentation says blog is “structure-ready, content-pending” and deferred to v2; the current code does not contain that structure. The documentation statement is not reproducible in code. **MISSING vs docs.**
- Public doctors API that would be useful for doctor selection and homepage expert cards is also **MISSING**; old phase docs describe it but no handler exists. **CONFIRMED.**

## 9. Existing Tests Relevant to the Roadmap

### 9.1 Unit/API tests

- `tests/api/booking/create.post.test.ts` asserts old behavior: creates a booking without a doctor from an `AdminSchedule` slot.
- `tests/api/booking/available-dates.get.test.ts`, `available-slots.get.test.ts` exercise global availability.
- `tests/api/payment/webhook.post.test.ts` asserts successful payment leaves booking `PENDING`.
- `tests/utils/meeting.test.ts` asserts the +15-minute close rule.
- `tests/utils/availability.test.ts` tests the currently unused doctor-aware availability functions.
- `tests/api/session/lobby/[meetingId].get.test.ts` tests lobby roles and window.
- `tests/api/doctor/patients.test.ts` and `tests/api/doctor/profile.test.ts` test functionality that decision C1 (owner-approved) removes from the doctor surface (own notes are retained separately). The tests/APIs must be retired or rewritten in Phase 2; note data is preserved.
- Admin tests cover doctor CRUD, assignments, cancellation/refunds, schedule, settings, and staff permissions.

### 9.2 E2E tests

- `tests/e2e/booking.spec.ts` creates a doctor with availability, but books through the global schedule and asserts `booking.doctorId === null` and `status === 'PENDING'`.
- `tests/e2e/patient-dashboard.spec.ts` covers the inline dashboard booking flow, calendar, reschedule/cancel, join button, and the `/meeting/:id/lobby` waiting state.
- `tests/e2e/auth.spec.ts` and `admin-panel.spec.ts` cover role redirects and admin rendering.
- These tests are evidence of intended behavior, not evidence that the current tree passes. No test was run in this planning task.

## 10. Confirmed Facts vs Assumptions

### Confirmed

- Global `AdminSchedule` is the live source for patient slots.
- Doctor `Availability` and `BlockedSlot` exist but are not used by the booking API.
- Bookings are created without a doctor and become confirmed only through admin assignment.
- Payment success does not confirm a booking.
- Doctor dashboard exposes patients/profile and peer notes.
- The doctor booking/session APIs already scope data to the authenticated doctor.
- Session access closes at end + 15, token TTL is 1 hour, and doctor admit has no window/identity check.
- The `/meeting` lobby page is not the actual join path.
- No blog implementation exists.

### Assumptions / not yet verified

- LiveKit recreates a room automatically after all participants disconnect within the appointment window (depends on server defaults).
- Real Paymob/Stripe webhook payloads exactly match the current parsing/signature logic in production (not exercised here).
- The deployed database contains the same migration state as the repository; no DB inspection was performed.
- Current test suite state matches the last documented run; not rerun here.
- Browser behavior of multiple live sessions in the same patient identity (re-entry while an old connection is still open) is not verified.

## 11. Files Most Affected (short list)

**Booking/availability:** `prisma/schema.prisma`, `prisma/seed.ts`, `server/utils/availability.ts`, `server/utils/admin-availability.ts`, `modules/booking/server/api/booking/*`, `modules/booking/pages/book.vue`, `modules/booking/composables/*`, `modules/patient/composables/usePatientDashboard.ts`, `pages/dashboard/appointments.vue`, `pages/admin/appointments.vue`, admin booking APIs, `server/api/public/doctors.get.ts` (new).

**Payment:** `server/utils/booking-status.ts`, `server/utils/payment.ts`, `modules/payment/server/api/payment/*`, `modules/booking/pages/booking/success.vue`, `failed.vue`, `server/utils/email.ts`.

**Doctor:** `layouts/doctor-layout.vue`, `modules/doctor/layouts/DoctorLayout.vue`, `modules/doctor/pages/doctor/*`, `modules/doctor/composables/useDoctorDashboard.ts`, `modules/doctor/server/api/doctor/*`.

**Session:** `server/utils/meeting.ts`, `server/utils/livekit-token.ts`, patient/doctor session APIs, `pages/dashboard/session/[bookingId].vue`, `modules/doctor/pages/doctor/session/[bookingId].vue`, `pages/meeting/[meetingId]/lobby.vue`, `composables/useLiveKitSession.ts`.

**Blog:** new `modules/blog` (pages/API), `pages/admin/blog.vue` or module admin page, `prisma/schema.prisma`, new migration, `prisma/seed.ts`, `layouts/admin.vue`, `modules/admin/components/PermissionBuilder.vue`, `server/utils/validation.ts`, `layouts/default.vue`, `lib/home-content.ts`.

**Tests:** the existing suites listed in section 9 plus new phase-specific files.
