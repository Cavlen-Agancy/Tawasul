# Product Requirements Document (PRD) — As-Built Refresh

## Tawasul Academy — Online Mental Health Counseling Platform

| Field | Value |
|---|---|
| **Product Name** | Tawasul Academy (تواصل — "connection") |
| **Version** | 1.0 MVP — As-Built (September 2026) |
| **Type** | As-built refresh of `project overview/PRD.md` + `tawasul_mvp_v2.md` + `tawasul_sitemap_v2.md` |
| **Scope locked** | Current 7 modules: auth, booking, payment, patient, doctor, admin, session (LiveKit) |
| **Video source of truth** | LiveKit self-hosted (`livekit-client` 2.22.3 / `livekit-server-sdk` 2.19.0). Jitsi references in old docs are deprecated. |
| **Status** | Implemented, 239/239 vitest passing, production build verified |
| **Stack** | Nuxt 3 + Vue 3 + TypeScript + Tailwind + shadcn-vue + FullCalendar + Prisma 5.22 + PostgreSQL + Nitro + Resend + Paymob/Stripe + LiveKit + Docker |

---

### 1. Executive Summary

**Problem Statement:** Arabic-speaking patients face stigma, opaque pricing, and long waits to access licensed therapists, while therapists lose time to manual scheduling and admins lack a single operational view of bookings, payments, and availability.

**Proposed Solution:** A web-based portal where patients self-register, pick a slot from an admin-controlled global calendar, pay online (Paymob primary, Stripe alternative, dev-mock fallback), and join a LiveKit video session; admins triage PENDING bookings, assign doctors, and manage schedule/blocked dates/permissions; doctors manage calendar, profile, session admit, and private notes.

**Success Criteria (measurable KPIs):**
1. Session booking completion (slot select → payment success → PENDING created) > 90% in production analytics.
2. Payment webhook processed < 2s p95, payment success rate > 98% excluding user-abandoned checkouts, failure rate from gateway errors < 2%.
3. Patient can go from landing → registered/verified → booked → paid in < 5 minutes median, < 3 minutes for returning users.
4. Admin assigns doctor to PENDING booking in < 30 seconds median (pending list → assign modal → CONFIRMED + email).
5. Availability APIs (`available-dates`, `available-slots`) respond < 500ms p95 for a 31-day month; page load < 3s on 3G; uptime > 99.5%.

---

### 2. User Experience & Functionality

#### 2.1 User Personas

**Patient (end user):** Individual seeking counseling. Needs low-friction booking, transparent EGP pricing, secure payment, private video, history/invoices, profile/photo control. Pain: stigma, complexity, wait times.

**Doctor / Therapist:** Licensed professional, account created by admin only. Needs assigned-appointment calendar (Month/Week/Day), one-click session entry, patient context, private post-session notes. Pain: manual scheduling, no-shows, admin burden.

**Admin / Staff:** Platform operators. Needs overview KPIs, pending triage, master calendar, doctor/patient/payment/staff CRUD, schedule + blocked-date control, settings. Permission-scoped via 6 resources × 4 actions. Pain: coordination overhead, lack of visibility.

#### 2.2 User Stories + Acceptance Criteria

**AU — Authentication**
- `As a patient, I want to self-register with name/email/phone/password so that I can book.`
  - AC: Zod-validated input; bcrypt hash (12 rounds); verification email sent with 24h-expiry token; login blocked until `emailVerified=true`; JWT in httpOnly cookie, 7d expiry; inactive `User.isActive=false` rejected on login.
- `As any role, I want to log in once and land in the right dashboard so that I don't navigate manually.`
  - AC: Patient → `/dashboard`, Doctor → `/doctor/calendar`, Staff → `/admin`; wrong-role route access redirects; `me.get` returns role + permissions.
- `As a patient, I want forgot/reset password via email so that I can recover access.`
  - AC: Reset token 1h expiry; single-use; branded Resend template.
- `As an admin, I want to create doctor/staff accounts that skip email verification so that onboarding is immediate.`
  - AC: Admin-created users `emailVerified=true`; doctor welcome email includes temp password + login URL; must change password after first login (enforced by UI prompt).
- `As a seed admin, I want to be undeletable/undeactivatable so that the platform can't be locked out.`
  - AC: PATCH/DELETE on `SEED_ADMIN_EMAIL` rejects `isActive:false` and permission-wipe with 403; covered by regression tests.

**BK — Booking (AdminSchedule as single source of truth)**
- `As a patient, I want to see available dates/slots from a global calendar so that I can book without choosing a doctor.`
  - AC: `GET /api/booking/available-dates?month&year` and `available-slots?date` read only `AdminSchedule (isActive)` minus `GlobalBlockedDate` minus existing non-CANCELLED bookings; doctor `Availability`/`BlockedSlot` NOT consulted; response < 500ms; holidays endpoint exposes blocked dates.
- `As a patient, I want to create a booking that stays PENDING until staff assigns a doctor so that I don't wait for doctor pre-assignment.`
  - AC: `POST /api/booking/create` re-validates slot via `getAdminAvailableSlots(date)`; creates `Booking{doctorId:null, status:PENDING, sessionType}` + `Payment{PENDING}` for ONLINE; IN_CLINIC creates booking with amount 0 and no Payment record; returns `{bookingId, amount, currency:EGP}` with 201; double-book race returns 400 "no longer available".
- `As a patient, I want ONLINE vs IN_CLINIC choice so that in-person visits skip payment.`
  - AC: `sessionType` defaults ONLINE; IN_CLINIC skips `createPaymentSession`; UI shows price 0 and no gateway redirect.
- `As a patient, I want to cancel within policy so that I get a clear outcome.`
  - AC: Patient cancel rejected within 24h of start (400); otherwise `CANCELLED` + cancellation email; admin cancel has no 24h limit and refunds only `Payment.status=SUCCESS → REFUNDED` (PENDING/FAILED untouched).
- `As an admin, I want blocked dates to disappear from patient calendars immediately so that holidays/maintenance are respected.`
  - AC: `POST/DELETE /api/admin/blocked-dates` invalidates availability; `holidays.get` reflects change on next fetch; stored as `@db.Date` UTC-midnight to avoid timezone day-flip.

**PY — Payment**
- `As a patient, I want to pay via Paymob (default) or Stripe so that I can confirm my booking.`
  - AC: `POST /api/payment/initiate {bookingId}` returns `{paymentUrl}` (Paymob iframe) or `{clientSecret}` (Stripe Checkout with `success_url /booking/success?bookingId=` and `cancel_url /booking/failed`); amount = `round(sessionDuration/60 * sessionPricePerHour, 2)` in EGP; placeholder keys auto-fall back to `/api/payment/dev/complete?bookingId=` mock.
- `As the system, I want webhook-only confirmation so that client-side spoofing can't confirm bookings.`
  - AC: `POST /api/payment/webhook` verifies Paymob HMAC / Stripe signature; idempotent retries safe; on SUCCESS links `Payment.gatewayReference`, keeps `Booking.PENDING` (doctor assignment still required); on FAIL marks `FAILED` with user-facing error; processing < 2s.
- `As a developer, I want a dev mock payment so that E2E works without gateway keys.`
  - AC: `GET /api/payment/dev/complete` flips PENDING → SUCCESS only when gateway not configured; disabled when real keys present.

**PT — Patient dashboard (`/dashboard`)**
- `As a patient, I want My Appointments (upcoming/past), My Payments, Profile, Session Room so that I manage care in one place.`
  - AC: `appointments.get` returns enriched bookings with doctor name/specialization; cancel button hidden within 24h; Join button enabled only inside meeting window; `payments.get` shows amount/status/invoice per session; `profile.get/patch` edits name/phone; `photo.post` accepts ≤2MB image to `UPLOAD_PATH`; session token via `GET /api/patient/session/[bookingId]` only inside window else 403.

**DR — Doctor dashboard (`/doctor`)**
- `As a doctor, I want My Calendar + My Profile + Session Room so that I focus on care.`
  - AC: `GET /api/doctor/bookings` returns only assigned CONFIRMED bookings; FullCalendar Month/Week/Day; entry from calendar; `profile.get/patch` edits bio/specializations/slug/photo; `POST /api/doctor/session/[bookingId]/admit` controls lobby admit; `DoctorNote{bookingId, doctorId @unique}` private notes CRUD, `Booking.notes` untouched.

**AD — Admin dashboard (`/admin` flat routes, no `admin.vue` parent)**
- `As staff, I want Overview KPIs so that I see platform health at a glance.`
  - AC: `GET /api/admin/overview` aggregates total bookings, total/monthly revenue EGP, active patients/doctors, 5 recent bookings; `pages/admin/index.vue` renders 4 KPI cards + table with loading/empty/error states.
- `As staff, I want Appointments master calendar + pending triage so that I assign doctors fast.`
  - AC: FullCalendar month view with doctor + status filters, 6-color doctor palette, `[Cancelled]/[Pending]` title prefixes; detail modal with assign/cancel gated by `APPOINTMENTS:UPDATE`; `pending.get` lists unassigned; `assign.patch {doctorId}` validates doctor availability + blocked slots, sets CONFIRMED, sends confirmation emails to patient + doctor; median assign < 30s.
- `As staff, I want Doctors CRUD + availability + block slots so that I onboard/schedule therapists.`
  - AC: `POST /api/admin/doctors` creates User+Doctor atomically with temp password + welcome email; PATCH syncs `Doctor.isActive` + `User.isActive` in `$transaction`; availability per `dayOfWeek 0-6 {startTime,endTime,sessionDuration 30/45/60}` unique per doctor/day; block slots per date+time.
- `As staff, I want Patients directory + detail, Payments ledger, Staff + PermissionBuilder, Settings so that I operate the platform.`
  - AC: Patients search + session metrics + detail bookings/payments tables; Payments 3 stat cards + date/doctor/status filters + desktop table/mobile cards; Staff create/edit/replace 6×4 matrix (`APPOINTMENTS R/U/D, PATIENTS R, DOCTORS C/R/U, PAYMENTS R, SETTINGS R/U, STAFF C/R/U/D`); Settings singleton (`platformName, contactEmail/Phone, whatsappNumber, paymentGateway, sessionPricePerHour, defaultSessionDuration, defaultWorkingStart/End`) with masked keys `****last4`, `****` ignored on PATCH, schedule + blocked dates editors.
- `As staff with limited permissions, I want to be redirected from unauthorized pages so that I don't see empty 403 screens.`
  - AC: Every admin page declares `permission:{resource, READ}` meta; `staff-only` middleware maps path→resource and redirects to `/admin`; API `requirePermission` remains final boundary (DB-checked per request, never cached in JWT).

**VS — Video sessions (LiveKit)**
- `As a patient/doctor, I want a lobby + time-windowed session room so that I join securely on time.`
  - AC: `meetingWindow`: joinable from `start-5min` to `end+15min` (`server/utils/meeting.ts`, UTC-date + local-time reconstruction to avoid day-flip); lobby `GET /api/meeting/lobby/[meetingId]` + `pages/meeting/[meetingId]/lobby.vue` shows booking details; token via `generateLiveKitToken{userId,userName,roomName,role}` (`AccessToken`, ttl 3600, moderator `canPublish/canSubscribe=true`); patient entry `/dashboard/session/[bookingId]`, doctor entry `/doctor` calendar + admit; `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE=true` bypasses window in dev; `SessionRoom{bookingId @unique, roomName @unique, expiresAt}`.

**EM — Email (Resend)**
- `As the system, I want branded transactional emails so that users trust communications.`
  - AC: Templates in `server/utils/email.ts` (brand `#E91E8C`): verification (24h), reset (1h), `bookingReceived` (PENDING ack), `bookingConfirmation{patient,doctor,date,time,service}`, cancellation, `doctorWelcome{email,tempPassword}`, `sessionReminder` (24h before); missing `RESEND_API_KEY` logs warn and skips (no crash).

#### 2.3 Non-Goals (explicitly NOT in MVP v1.0)

- Mobile apps (iOS/Android), social login, subscriptions, session recording, refund API integration (manual via gateway dashboard), multi-language/i18n (Arabic+English deferred), in-app realtime notifications, WhatsApp reminders, blog/courses/events (structure-ready, content-pending), reschedule/recurring bookings, doctor self-scheduling, patient reviews/ratings, doctor earnings page, analytics/report export, insurance integration, self-hosted Jitsi (replaced by LiveKit).

---

### 3. AI System Requirements

**Not applicable.** No AI/ML features in as-built MVP. No LLM tools, prompts, RAG, or model evals. If AI (e.g., triage chatbot, note summarization) is added in v2, it will require a separate AI addendum with tool contracts, PHI redaction, eval benchmarks (≥90% citation accuracy on 50 goldens), and human-in-the-loop approval.

---

### 4. Technical Specifications

#### 4.1 Architecture Overview

```
Browser (Patient/Doctor/Staff)
  │ SSR + SPA (Nuxt 3, Vue 3, TS, Tailwind, shadcn-vue, FullCalendar, Nuxt Image)
  ▼
Nuxt Nitro Server (REST, `modules/*/server/api/**`, `server/utils/**`)
  ├─ middleware: auth (JWT httpOnly cookie) → requireAuth → requirePermission (Prisma per-request)
  ├─ validation: Zod (`server/utils/validation.ts`) on all inputs
  ├─ domain utils: admin-availability, availability, meeting, livekit-token, payment, email, holidays, booking-status
  ▼
PostgreSQL (Prisma ORM, pooled) ── Users, Permissions, Doctors, Availability, BlockedSlot,
  AdminSchedule, GlobalBlockedDate, Booking (nullable doctorId), Payment, SessionRoom, DoctorNote, Settings
  │
  ├─ External: Resend (email) · Paymob iframe / Stripe Checkout + webhooks · LiveKit SFU (ws://localhost:7880, rtc 50000-50100, tcp 7881)
  └─ Infra: Docker + Compose (postgres, app, pgadmin dev), Nginx + Certbot prod, local uploads (2MB cap)
```

Module routing: `nuxt.config.ts` registers `modules/*/pages` + `components` + `composables`; server scan dirs per `modules/*/index.ts`. Pages: `/` marketing placeholder, `/dashboard/**` patient, `/doctor.vue` + `/doctor/**` doctor, `/admin/**` flat (index/appointments/doctors/doctors/[id]/patients/patients/[id]/payments/staff/settings), `/meeting/[meetingId]/lobby`, `/dashboard/session/[bookingId]`.

Data flow (booking): Patient `available-dates/slots` → `create.post` (re-validate + price) → `payment/initiate` (Paymob/Stripe/mock) → `webhook` (SUCCESS) → `bookingReceived` email → Admin `pending.get` → `assign.patch` (CONFIRMED + confirmation emails) → window opens → LiveKit token → session → DoctorNote.

#### 4.2 Integration Points

| Integration | Direction | Contract | Failure handling |
|---|---|---|---|
| PostgreSQL 15+ via Prisma 5.22 | sync | `DATABASE_URL`; migrations versioned; `@db.Date` UTC-midnight for dates | Connection pool; `$transaction` for doctor/user sync; idempotent webhooks |
| Resend | outbound | `RESEND_API_KEY, RESEND_FROM_EMAIL/NAME`; `sendEmail{to,subject,html}` | Missing key → warn+skip; send error logged, booking still commits |
| Paymob Accept | outbound + webhook inbound | `PAYMOB_API_KEY/INTEGRATION_ID/HMAC_SECRET`; auth→order→payment_key→iframe URL; HMAC verify | Placeholder keys → dev mock; gateway 5xx → `createPaymentError`, user retry |
| Stripe Checkout | outbound + webhook inbound | `STRIPE_SECRET/PUBLISHABLE/WEBHOOK_SECRET`; Checkout Session with metadata `{bookingId}` | Same mock fallback; signature mismatch → 400, no state change |
| LiveKit self-hosted | outbound token + realtime SFU | `LIVEKIT_URL/API_KEY/API_SECRET` (match `livekit.yaml`); `AccessToken{identity,name,ttl:3600, roomJoin, room, canPublish/Subscribe}` | Missing keys → explicit error; test mode bypasses window only in dev |
| Local uploads | write | `UPLOAD_PATH (./uploads dev, /var/www/tawasul/uploads prod)`, `UPLOAD_MAX_SIZE 2097152` | >2MB rejected 413; non-image MIME rejected |
| Seed | boot | `SEED_ADMIN_EMAIL/PASSWORD/NAME`; 14 core permissions | PATCH/DELETE guarded; duplicate seed idempotent |

Key endpoints (55+ total): `auth/{register,login,logout,me,verify-email,forgot-password,reset-password}`, `booking/{available-dates,available-slots,holidays,create,[id], [id]/cancel,[id].patch}`, `payment/{initiate,webhook,dev/complete}`, `patient/{appointments,payments,profile,profile/photo,session/[bookingId]}`, `doctor/{bookings,bookings/[id],profile,profile/photo,session/[bookingId],session/[bookingId]/admit}`, `admin/{overview,bookings/*,doctors/*,patients/*,payments,schedule/*,blocked-dates/*,staff/*,settings}`, `meeting/lobby/[meetingId]`.

#### 4.3 Security & Privacy

- Passwords bcryptjs 12 rounds; JWT (`jose`/`jsonwebtoken`) 7d in httpOnly + Secure (prod) + SameSite cookies, never localStorage; CSRF protection on mutations; Zod on all inputs; server-side `requireAuth` + `requirePermission` on every route (permissions re-queried from DB, not trusted from JWT).
- `User.isActive` + `Doctor.isActive` synced transactionally; login rejects inactive; seed admin immutable.
- Payments: webhook signature required, no client-side trust; masked settings keys; refunds only SUCCESS→REFUNDED.
- Sessions: LiveKit tokens short-lived (1h), room-scoped, role-scoped; join enforced server-side by `canJoinMeetingAt`; no recordings stored in MVP.
- PHI: minimal collection (name/email/phone/booking/notes); HTTPS everywhere prod; uploads not publicly listable; DoctorNotes access-scoped to assigned doctor + staff with permission; deletion cascades via Prisma `onDelete:Cascade` (except Booking.doctor `SetNull` to preserve history).
- Compliance target: WCAG 2.1 AA, semantic HTML + ARIA, keyboard nav, mobile-first responsive; audit logging deferred to v1.1.

---

### 5. Risks & Roadmap

#### 5.1 Phased Rollout

**MVP v1.0 (as-built, current):** Auth + verification/reset, global-schedule booking with ONLINE/IN_CLINIC, Paymob/Stripe/mock payments + webhooks, patient dashboard, doctor calendar/profile/notes/admit, admin overview/triage/master-calendar/doctors/patients/payments/staff/settings, LiveKit lobby + windowed rooms, Resend emails, Docker dev/prod, 239 vitest + Playwright admin/auth coverage, `nuxt build` green.

**v1.1 (hardening, next):** Fix remaining admin composable↔route mismatches, marketing pages (Home/About/Services/Experts/Profile/Contact) from placeholders to real content, session reminder cron (24h), audit logs, rate-limiting + CAPTCHA on auth, Sentry/monitoring, backup/restore runbook, `tsc --noEmit` zero errors (24 pre-existing now), E2E for booking→pay→assign→join happy path.

**v2.0 (growth):** Reschedule/recurring, doctor earnings, patient reviews, analytics/export, i18n (Arabic RTL + English), in-app + WhatsApp notifications, blog/courses/events activation, subscriptions, mobile apps, session recording (with consent), automated refund API, doctor self-scheduling rules to reduce assignment bottleneck.

#### 5.2 Technical Risks

| Risk | Impact | Likelihood | Mitigation (as-built + planned) |
|---|---|---|---|
| Payment gateway downtime (Paymob/Stripe) | High — bookings stuck PENDING | Med | Dual-gateway switch via Settings; mock only in dev; idempotent webhooks + retry; clear failed-state UX; v1.1 status page |
| LiveKit SFU instability / TURN/NAT issues | High — session can't join | Med | Pinned `livekit.yaml` ports + healthcheck; token TTL 1h; lobby pre-flight; test mode for drills; v1.1 TURN + metrics |
| Timezone day-flip (UTC `@db.Date` vs local display) | High — wrong slot day | Low now | UTC-midnight storage + `formatDateUTC/parseISODate` + regression tests; v1.1 explicit timezone selector |
| Admin assignment bottleneck (manual doctor assign) | Med — CONFIRMED latency | High | Pending queue sorted by date; availability check on assign; v2 auto-assign rules |
| PHI exposure / auth bypass | Critical | Low | httpOnly JWT, per-request permissions, seed guard, Zod, masked secrets; v1.1 pentest + audit logs |
| Email deliverability (Resend) | Med — missed verification/confirmation | Med | Branded templates, warn-on-missing-key, retry; v1.1 queue + SPF/DKIM runbook |
| Low adoption / trust in market | Med | Med | Warm calming UI, transparent EGP pricing, 24h policy clarity, testimonials/experts pages in v1.1 |

#### 5.3 Open Questions (carried from old PRD)

1. Refund policy for <24h cancellations — manual only in MVP, auto in v2?
2. Should doctors set own availability in v2, or keep admin-global model?
3. Multi-currency beyond EGP for international patients?
4. Group therapy sessions in v2?
5. Session recordings with consent — retention + storage?

---

### Appendix A. Database Summary (as-built `prisma/schema.prisma`)

`User{email@unique, password, name, phone?, photo?, accountType:PATIENT|DOCTOR|STAFF, emailVerified, verificationToken/Expiry, resetToken/Expiry, isActive}` · `Permission{userId, resource:APPOINTMENTS|PATIENTS|DOCTORS|PAYMENTS|SETTINGS|STAFF, action:CREATE|READ|UPDATE|DELETE, @@unique[user,resource,action]}` · `Doctor{userId@unique, bio?, slug@unique, specializations[], isActive}` · `Availability{doctorId, dayOfWeek 0-6, startTime, endTime, sessionDuration, @@unique[doctor,day]}` · `BlockedSlot{doctorId, date@db.Date, startTime, endTime}` · `AdminSchedule{dayOfWeek@unique, startTime, endTime, sessionDuration, isActive}` · `GlobalBlockedDate{date@unique@db.Date, reason?}` · `Booking{userId, doctorId?, date@db.Date, startTime, endTime, service, status:PENDING|CONFIRMED|CANCELLED|IN_REVIEW(reserved), sessionType:ONLINE|IN_CLINIC, notes?}` · `Payment{bookingId@unique, amount Decimal(10,2), currency=EGP, status:PENDING|SUCCESS|FAILED|REFUNDED, gatewayReference?}` · `SessionRoom{bookingId@unique, roomName@unique, expiresAt}` · `DoctorNote{content, bookingId, doctorId, @@unique[booking,doctor]}` · `Settings{id=singleton, platformName, contactEmail/Phone, whatsappNumber, paymentGateway, paymentGatewayKey/Secret, sessionPricePerHour, defaultSessionDuration, defaultWorkingStart/End}`.

### Appendix B. Verification (as-built evidence)

- `vitest run` 239/239 (39 files); `vitest run tests/api/admin` 50/50; Playwright `admin-panel.spec` 12/12; `auth.spec` fixed for new titles/routes.
- `nuxt build` success, no duplicate availability warnings (after `~/server/utils/availability` dedup).
- `tsc --noEmit` 24 pre-existing errors, identical on pristine tree (no new type debt this cycle).

### Appendix C. Sources reconciled

- `project overview/PRD.md` (Sep 2026, Jitsi-based) → superseded for video by LiveKit; business scope retained.
- `tawasul_mvp_v2.md` booking correction (AdminSchedule/GlobalBlockedDate, nullable doctorId, PENDING→CONFIRMED) → confirmed as-built.
- `tawasul_sitemap_v2.md` flows → confirmed, except marketing pages still placeholders and Phase-2 items still deferred.
