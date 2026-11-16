# 01 — Architecture and Data Impact

> **Decision source:** [`../FINAL-DECISIONS.md`](../FINAL-DECISIONS.md) and [`../ROADMAP-DECISIONS-UPDATE.md`](../ROADMAP-DECISIONS-UPDATE.md). A1, A3, B3, and C1 are owner-approved; this document describes the approved target behavior.

**Status:** design plus Phase 1 implementation. No Prisma schema or migration has been changed; Phase 1 session code/tests were implemented but remain unverified. This document describes the target architecture and the impact of moving from the current implementation to it.

## 1. Existing Architecture Relevant to the Changes

```
Public pages (Nuxt SSR)
  └─ /, /book, /login, upcoming /blog
        │
        ▼
Nitro API (H3)
  ├─ booking availability/create/cancel/patch (booking module)
  ├─ payment initiate/webhook/dev complete (payment module)
  ├─ patient appointments/payments/profile/session (patient module)
  ├─ doctor bookings/profile/patients/notes/session (doctor + global server/api)
  ├─ admin bookings/doctors/patients/payments/staff/settings (admin module)
  ├─ meeting lobby API (session module)
  └─ middleware: JWT cookie -> requireAuth -> requirePermission (Prisma lookup)
        │
        ▼
PostgreSQL via Prisma
  Users, Permissions, Doctors, Availability, BlockedSlot, AdminSchedule,
  GlobalBlockedDate, Bookings, Payments, SessionRooms, DoctorNotes, Settings
        │
        ├── Resend (transactional email)
        ├── Paymob / Stripe (payment redirect + webhooks)
        └── LiveKit SFU (token issuance + room admission)
```

The current design is a modular monolith; this roadmap preserves that architecture. No new framework, service, or CMS is introduced.

## 2. Target Behavior

### 2.1 Booking

1. Patient sees active doctors (homepage and/or `/book`).
2. Patient selects a doctor, then a date/time that is valid for that doctor.
3. The server revalidates the exact doctor/date/time using `Doctor.Availability` (with the global clinic template/closure rules), existing bookings, `BlockedSlot`, `GlobalBlockedDate`, and holidays.
4. The booking is created with the selected `doctorId`.
5. In-clinic booking is confirmed immediately and requires no payment.
6. Online booking remains pending until the payment provider confirms success.
7. Success confirms the booking; failure or abandonment never confirms it.
8. Admin and doctor calendars show confirmed bookings automatically. There is no normal approval/assignment step.
9. Confirmed-booking doctor reassignment is not supported. The recovery path is cancel + rebook; legacy unassigned rows are the only exception for manual assignment.

### 2.2 Availability

- `AdminSchedule` becomes the **clinic default schedule/template**, not the direct patient slot source.
- `Doctor.Availability` becomes the effective patient-facing schedule for each doctor.
- Existing doctors with no custom availability are backfilled from active `AdminSchedule` rows.
- New doctors receive a copy of active `AdminSchedule` rows at creation.
- `GlobalBlockedDate` applies to every doctor.
- `Doctor.BlockedSlot` applies only to that doctor.
- Holidays continue to block all doctors.
- A slot is bookable only if: doctor/user active; date not a holiday; date not globally blocked; the doctor has an availability row for that weekday; the slot fits the row/duration; no doctor blocked slot; and no `CONFIRMED` booking or active hold overlaps.
- `GlobalBlockedDate` stops **new** bookings. It does not silently cancel existing confirmed bookings; an admin must resolve those explicitly.
- **AdminSchedule edits do not propagate to existing doctors.** The default applies only to new doctors and the one-time cutover backfill. Existing custom availability is never overwritten. A future “apply default to all” is a separate explicit action, not part of this roadmap.
- If no active `AdminSchedule` rows exist at doctor creation, create the doctor without availability, surface an admin warning, and let the admin configure availability; do not block doctor creation.

### 2.3 Doctor workspace

- Doctor navigation contains only `My Calendar`.
- Doctor can see only `CONFIRMED` and `CANCELLED` bookings where `Booking.doctorId` matches their own `Doctor.id`; unpaid `PENDING` holds are not appointments.
- Doctor session access remains available from the calendar/detail flow.
- Doctor can read/write only their own notes for their own bookings; peer notes and patient-wide note timelines are removed.
- Patient directory/detail and doctor self-profile pages/APIs are removed from the doctor surface. Admin manages profile text; existing doctor photos and note data remain.
- The server remains the authorization boundary for all doctor data.
- C1 is owner-approved; this is the approved target.

### 2.4 Session

- Patient may enter, leave, and re-enter the waiting lobby any number of times before the appointment end.
- Each patient token request rotates a durable `SessionRoom.currentEntryId`; the LiveKit identity is `userId:entryId`.
- Doctor admission verifies the current entry and LiveKit participant SID; an old-token reconnect with a new SID is rejected and removed until the patient obtains a fresh lobby entry.
- At the exact appointment end, a server-side LiveKit `deleteRoom` terminates all connected participants; `terminatedAt` makes it idempotent, and a Nitro startup/fallback sweep covers restarts/missed timers.
- Admission persistence is conditional on the current entry and admitted SID, closing the mid-flight lobby-rotation race. `terminatedAt` is scoped to the current `expiresAt`, so a reschedule that moves the end forward is terminated at the new end; the existing same-day reschedule path does not reset entry/admission state until the next token request.
- The waiting lobby is the existing patient session waiting room at `/dashboard/session/[bookingId]`; the old `/meeting/:id/lobby` stub is not a second video implementation.
- Every fresh entry produces a new member token with no publish/subscribe permission until the doctor admits that participant.
- Doctor admission is required again on every re-entry.
- The session window opens 5 minutes before start and closes exactly at the appointment end.
- Server enforces ownership, confirmation status, time window, and patient identity on token issuance and doctor admit.
- Tokens must not outlive the permitted window.
- Staff may read lobby metadata but **do not receive a session token and cannot join the video room** in this roadmap.

### 2.5 Blog

- Admin creates/edits/deletes posts and changes status.
- Public sees only published posts.
- No CMS or rich-text dependency is added.
- Content is stored as plain text and rendered as escaped text/paragraphs. This avoids stored XSS and keeps the implementation minimal.

## 3. Database Model Changes

No destructive rewrite is proposed. All schema changes are additive. `Booking.doctorId` remains nullable permanently for historical rows; the application enforces it for new bookings.

### 3.1 Booking-related

Current:

```prisma
model Booking {
  id       String  @id @default(cuid())
  userId   String
  doctorId String?
  date     DateTime @db.Date
  startTime String
  endTime   String
  status    BookingStatus @default(PENDING)
  sessionType SessionType @default(ONLINE)
  ...
}
```

Target:

- `Booking.doctorId` stays nullable at the database level permanently to preserve historical unassigned bookings. No `NOT NULL` migration is part of this roadmap.
- **Application rule:** every new booking must have a valid, active `doctorId`; missing/invalid `doctorId` returns `400`.
- Add indexes for the new query patterns:
  - `@@index([doctorId, date, status])`
  - `@@index([date, status])`
- Add `holdExpiresAt DateTime?` on `Booking` in Phase 4 for online payment holds. It is nullable for legacy rows and in-clinic bookings.
- Do not add `doctorId @relation(... onDelete: SetNull)` changes unless a separate data decision is made; current `Booking.doctor` relation has no explicit delete action and historical preservation must be reviewed before schema tightening.
- Do not repurpose `IN_REVIEW`; it remains unused/reserved.

`SessionRoom` adds durable Phase 1 hardening fields:

- `currentEntryId String?` — rotates on every patient token/lobby entry.
- `admittedParticipantSid String?` — LiveKit SID admitted for the current entry; cleared on entry rotation.
- `terminatedAt DateTime?` — idempotent appointment-end termination marker.
- `@@index([expiresAt, terminatedAt])`.

These require migration `prisma/migrations/0002_session_hardening/migration.sql` and `prisma generate` before runtime verification. No migration is executed by the planning/implementation task.

### 3.2 Availability

No schema change is strictly required. The effective schedule is derived from existing `Availability` and `BlockedSlot` rows.

Data migration/backfill:

- For every active `DOCTOR` user with a `Doctor` profile and **zero** `Availability` rows, clone each active `AdminSchedule` day into `Availability` for that doctor.
- Preserve any existing custom `Availability` rows untouched.
- Preserve `AdminSchedule` rows; they remain the default template.
- New doctor creation copies active `AdminSchedule` rows inside the same transaction as user/doctor creation.
- AdminSchedule edits do not propagate to existing doctors. Existing custom availability is preserved.
- If `AdminSchedule` has no active rows at doctor creation, create the doctor with no availability rows and surface a warning in the admin UI; do not block creation. The admin configures availability explicitly.

### 3.3 Blog

Add:

```prisma
enum BlogStatus {
  DRAFT
  PUBLISHED
}

model BlogPost {
  id          String     @id @default(cuid())
  slug        String     @unique
  title       String
  excerpt     String?
  content     String
  status      BlogStatus @default(DRAFT)
  publishedAt DateTime?
  authorId    String?
  author      User?      @relation("BlogPosts", fields: [authorId], references: [id], onDelete: SetNull)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([status, publishedAt])
  @@map("blog_posts")
}
```

Add `blogPosts BlogPost[] @relation("BlogPosts")` to `User`.

Notes:

- `content` is plain text. No HTML is rendered with `v-html`.
- `publishedAt` is set on the **first** transition to `PUBLISHED`; edits and unpublish/republish preserve it. `updatedAt` tracks edits. No scheduling is supported.
- Slug generation is Unicode-aware (Arabic/Latin), unique, and immutable after first publication. Generated collisions receive `-2`, `-3`; explicit duplicate slugs return 409.
- `authorId` is optional so a deactivated author does not destroy a post; staff deletion is currently a soft deactivation.
- Public queries filter `status = PUBLISHED` server-side; drafts/deleted posts return 404; no shared caching in the first release.

### 3.4 RBAC resource

Add `BLOG` to the `Resource` enum and to all permission lists:

- `prisma/schema.prisma`
- `prisma/seed.ts` (seed admin receives all blog actions)
- `modules/admin/components/PermissionBuilder.vue` `RESOURCES`
- `modules/admin/server/api/admin/staff/index.post.ts` and `[id].patch.ts` valid resources
- `middleware/staff-only.ts` path mapping for `/admin/blog` (page meta is preferred)
- `layouts/admin.vue` navigation item with resource `BLOG`
- new admin blog page `definePageMeta({ permission: { resource: 'BLOG', action: 'READ' } })`

## 4. Migration and Historical Data Considerations

### 4.1 Migration order

1. Phase 1 (`SessionRoom` entry/admission/termination fields) — additive, nullable.
2. Phase 3 (additive indexes + Availability backfill) — safe to apply before app deployment.
3. Phase 4 (add `Booking.holdExpiresAt` + optional index) — additive.
4. Phase 5 (`BlogPost`, `BlogStatus`, `BLOG` enum value) — additive.

No migration drops or renames a table/column. No migration deletes existing rows.

### 4.2 Legacy bookings

Current database may contain:

- `PENDING` unassigned online bookings with `Payment=SUCCESS` (paid but never confirmed).
- `PENDING` unassigned online bookings with `Payment=PENDING`/`FAILED`.
- `PENDING` in-clinic bookings.
- `CONFIRMED` bookings with `doctorId`.
- `CANCELLED`/`REFUNDED` history.

Rules:

- Never delete historical bookings or payments.
- New API code must not create a booking without a doctor.
- Do not set `Booking.doctorId` to `NOT NULL`; A5 keeps the column nullable permanently. New writes are enforced by the application.
- The old admin assign endpoint may remain as a legacy remediation tool but must not be part of the new normal UI. It must not allow changing an existing `doctorId`; confirmed-booking reassignment is not supported in this roadmap.
- A legacy `PENDING` booking with a successful payment must be reconcilable by an admin; do not silently confirm all such rows in a migration.
- The admin recovery for a doctor change is cancel + rebook under the refund rules, not an in-place swap.

### 4.3 Availability backfill SQL shape (design only, not authored)

A one-time Prisma migration can:

- insert one `availability` row per active doctor/day from `admin_schedules` where the doctor has no availability rows;
- use a database-generated unique string id (PostgreSQL 16 `gen_random_uuid()` is available) since Prisma `cuid()` is application-generated;
- be idempotent with `NOT EXISTS` guards;
- run inside the normal `prisma migrate deploy` flow.

Do not execute this migration until a staging database restore has verified row counts and constraints.

### 4.4 Rollback

- Availability backfill is additive. Rolling back the application leaves extra availability rows that are harmless but must be documented.
- Blog table/enum is additive. Rollback can disable routes/nav; dropping the table is a separate destructive action and not part of normal rollback.
- `holdExpiresAt` is additive and nullable; rollback leaves the column unused.
- Never roll back a payment state by deleting rows; use a database snapshot/restore if a bad deployment writes incorrect payment/booking state.

## 5. API Impact Matrix

### 5.1 Booking and public availability

| Endpoint | Current | Target | Notes |
|---|---|---|---|
| `GET /api/booking/available-dates` | `month`, `year`; global AdminSchedule | requires `doctorId`; doctor-specific availability | New validation; old clients must update |
| `GET /api/booking/available-slots` | `date`; global | requires `doctorId`; doctor-specific | New validation; rejects inactive doctor |
| `GET /api/booking/holidays` | month/year | unchanged | Still public |
| `POST /api/booking/create` | `{date,startTime}`, doctor null | `{doctorId,date,startTime,sessionType?}`; doctor linked | New Zod schema; revalidation under lock in Phase 4 |
| `GET /api/booking/:id` | owner/staff; returns doctor/payment | unchanged shape; doctor always set for new rows | Legacy may still return null |
| `PATCH /api/patient/appointments/:bookingId/reschedule` | **missing**; UI calls it and falls back to same-day patch | patient own confirmed, same doctor, cross-date allowed, >=24h before original start, atomic target lock, no payment change | New endpoint; implement in Phase 3/B3 (owner approved) |
| `PATCH /api/admin/bookings/:id/reschedule` (new) | **missing** | admin any confirmed booking before start, same doctor, target availability, no 24h limit, permission `APPOINTMENTS:UPDATE` | New endpoint/UI in Phase 3/B3 |
| `PATCH /api/booking/:id` | same-day time update using global availability | keep as compatibility/same-day alias or route to shared reschedule service; same doctor only | Do not silently fall back on failure |
| `PATCH /api/booking/:id/cancel` | patient/admin cancel; patient refunds all non-refunded payments | same; refund only `SUCCESS` | Phase 4 fix |
| `GET /api/public/doctors` | **missing** | active doctors, safe public fields | New endpoint |
| `GET /api/public/doctors/:idOrSlug` | missing | optional; only if a doctor detail page is built | Not required for minimal booking |

### 5.2 Admin bookings

| Endpoint | Current | Target | Notes |
|---|---|---|---|
| `GET /api/admin/bookings` | all with filters | unchanged; includes doctor | New bookings always have doctor |
| `GET /api/admin/bookings/pending` | all PENDING | only legacy `doctorId: null` PENDING in Phase 3; removed from UI in Phase 4 | Do not expose normal approval flow |
| `PATCH /api/admin/bookings/:id/assign` | assign any PENDING | legacy-only; reject already assigned; hidden from UI | Remove in a later cleanup if no legacy rows |
| `PATCH /api/admin/bookings/:id/cancel` | cancel/refund SUCCESS | unchanged | Keep permission + audit |
| `GET /api/admin/overview` | KPIs | unchanged; revenue semantics unchanged | Review whether “confirmed this month” means paid online + in-clinic; document |

### 5.3 Payment

| Endpoint | Current | Target | Notes |
|---|---|---|---|
| `POST /api/payment/initiate` | patient-owned booking, no confirm check | reject cancelled/expired/confirmed; allow pending retry before hold expiry | Payment amount immutable |
| `POST /api/payment/webhook` | verifies signature; marks payment only | verifies signature; transactionally marks payment and auto-confirms booking | Idempotent; must not send duplicate confirmation |
| `GET /api/payment/dev/complete` | dev only | dev only | Must remain disabled in production and when keys exist |
| Stripe Checkout response | `{clientSecret}` | `{paymentUrl}` (Checkout Session URL) | Needed for actual Stripe redirect; optional if Paymob remains the only live gateway |

### 5.4 Doctor

| Endpoint | Current | Target | Notes |
|---|---|---|---|
| `GET /api/doctor/bookings` | own bookings, all statuses | own `CONFIRMED`/`CANCELLED` only; no unpaid `PENDING`; no other doctors | Calendar only |
| `GET /api/doctor/bookings/:id` | own only | own only; patient name + email for appointment workflow | No directory/phone |
| `GET /api/doctor/session/:bookingId` | own only; window | own only + new window/token TTL | |
| `POST /api/doctor/session/:bookingId/admit` | own only; no window/identity | own + window + current entry identity + LiveKit SID | Security fix |
| `/api/doctor/profile*` | doctor self-service | **removed** from doctor surface; admin manages profile text; existing photos retained | C1 owner approved |
| `/api/doctor/patients*` | directory/detail/notes | **removed** from doctor surface; data retained in DB | C1 owner approved |
| `/api/doctor/bookings/:bookingId/notes` (new) | n/a | doctor's own notes for own booking | Reuses `DoctorNote`; no peer notes |

### 5.5 Session

| Endpoint | Current | Target | Notes |
|---|---|---|---|
| `GET /api/meeting/lobby/:meetingId` | role + canJoin, +15 close | role check; close exactly at end; staff metadata only, no video token | Shared `meeting.ts` rule |
| `GET /api/patient/session/:bookingId` | owner, confirmed, window | owner, confirmed, window; TTL bounded; rotates `currentEntryId`; clears admitted SID; identity `userId:entryId` | Old token cannot be admitted |
| `GET /api/doctor/session/:bookingId` | own, window | own, window; TTL bounded; no entry rotation | |
| `POST /api/doctor/session/:bookingId/admit` | own, window | own, confirmed online, active accounts, current entry, LiveKit SID; persists admission; removes stale reconnects | Re-entry gate |
| Internal appointment-end termination | none | `deleteRoom` at exact end; idempotent `terminatedAt`; startup/fallback sweep | Server-side forced disconnect |
| `/meeting/:id/lobby` page | stub | redirect/delegate to canonical session route; staff no video | No duplicate video logic |

### 5.6 Blog

| Endpoint | Target |
|---|---|
| `GET /api/public/blog` | `status=PUBLISHED` only; pagination; no draft leak; no-store |
| `GET /api/public/blog/:slug` | `status=PUBLISHED` only; 404 for draft/unpublished/deleted; no-store |
| `GET /api/admin/blog` | `BLOG:READ`; all statuses |
| `POST /api/admin/blog` | `BLOG:CREATE`; Unicode slug generation/validation; first publish sets `publishedAt` |
| `GET /api/admin/blog/:id` | `BLOG:READ` |
| `PATCH /api/admin/blog/:id` | `BLOG:UPDATE`; preserve `publishedAt`; immutable published slug |
| `DELETE /api/admin/blog/:id` | `BLOG:DELETE`; hard delete with confirmation in UI |

## 6. Authorization Impact

1. **Patient booking ownership** remains `booking.userId === auth.userId`; the new doctor requirement must not weaken it.
2. **Doctor isolation** is enforced in every doctor booking/session query by `doctorId` lookup from `Doctor.userId`; never trust a doctor ID from the client.
3. **Admin RBAC** remains per-resource/per-action. Adding `BLOG` must not reuse `SETTINGS` implicitly or bypass `requirePermission`.
4. **Session authorization**:
   - patient token only for their booking
   - doctor token only for their assigned booking
   - doctor admit only for their booking, only inside the time window, only for the booking patient's identity
   - staff do not join video sessions in this roadmap; staff may read lobby metadata only
   - doctor notes are own-booking/own-author only; no peer notes
5. **Blog public access** must filter `status = PUBLISHED` server-side, not in the client.
6. **Legacy admin assignment** remains permission-gated (`APPOINTMENTS:UPDATE`) and is not reachable from normal UI.

## 7. Calendar and Availability Calculation Impact

**Current:** one global calendar, slots with no doctor.
**Target:** patient selects doctor first; dates and slots are computed for that doctor.

Required calculation inputs:

- doctor is active (`Doctor.isActive`, `User.isActive`)
- `Availability` for the date's day of week (backfilled from default if no custom rows)
- `BlockedSlot` for that doctor/date
- `GlobalBlockedDate`
- Egyptian holidays
- existing `CONFIRMED` bookings for that doctor
- Phase 4: active `PENDING` online holds for that doctor/date (`holdExpiresAt > now`); legacy null-hold PENDING rows remain blocking until admin resolution
- `GlobalBlockedDate` prevents new bookings; it does not silently cancel existing confirmed bookings; admin must handle those explicitly
- AdminSchedule changes never rewrite existing doctor availability

The admin calendar remains a full read model (all doctors). The doctor calendar remains a personal read model containing only `CONFIRMED` and `CANCELLED` bookings (no unpaid holds).

## 8. Payment Lifecycle Impact

Recommended target state machine:

```
ONLINE:
  create -> PENDING + Payment{PENDING} + holdExpiresAt (20 min default, owner approved)
  initiate -> gateway redirect/mock
  webhook SUCCESS while hold active -> Payment{SUCCESS} + Booking{CONFIRMED} (transactional, idempotent)
  webhook FAIL -> Payment{FAILED}; Booking stays PENDING; retry until hold expiry or cancel
  hold expiry -> slot is free; Booking remains PENDING (no auto-cancel, no automatic cleanup job)
  late SUCCESS after expiry, slot free -> recheck under lock, then confirm
  late SUCCESS after expiry, slot occupied -> do not double-book; Payment stays SUCCESS; Booking CANCELLED; manual refund/reconciliation
  late SUCCESS after booking already CANCELLED -> do not confirm; Payment stays SUCCESS; manual refund/reconciliation
  user cancel -> Booking{CANCELLED}; Payment SUCCESS -> REFUNDED only if eligible
  admin cancel -> Booking{CANCELLED}; Payment SUCCESS -> REFUNDED only

IN_CLINIC:
  create -> Booking{CONFIRMED}; no Payment
```

No automatic refund is introduced. A late successful payment is never silently discarded: it either confirms a free slot or enters the explicit manual reconciliation/refund state. Known reconciliation query: `Payment.status = SUCCESS AND Booking.status != CONFIRMED`.

### Race prevention design

Two independent problems:

1. **Two patients selecting the same slot.** Fix with a database-serialized create path:
   - interactive transaction;
   - PostgreSQL advisory transaction lock keyed by `(doctorId, date, startTime)` (or doctor/date);
   - re-read the doctor's availability and active bookings inside the lock;
   - insert only if free.
2. **Duplicate webhook / retry.** Fix with a conditional update:
   - update `Payment` only from `PENDING`/`FAILED` to `SUCCESS`;
   - update `Booking` only from `PENDING` to `CONFIRMED`;
   - send confirmation emails only when that conditional transition affected exactly one row;
   - repeated callbacks return success idempotently.

Do not rely on a client-side slot list or on a non-unique application check.

## 9. LiveKit Impact

- Keep the existing token-per-entry model; each entry now has a durable server-side `currentEntryId`.
- Change the window close from end + 15 to exact end; use a shared helper everywhere.
- Bind token TTL to the remaining window: `ttl = floor((closeAt - now) / 1000)`; reject below 1 second.
- Patient identity is `userId:entryId`. Doctor admission validates the current entry and the LiveKit participant SID; old-token reconnects with a new SID are rejected/removed.
- Doctor admit must validate:
  - authenticated doctor owns the booking;
  - booking is `CONFIRMED` and `ONLINE`;
  - doctor/user and patient are active;
  - current time is inside the window;
  - supplied identity matches the booking patient and current entry;
  - the LiveKit participant exists and its SID matches the admitted SID for that entry.
- Patient tokens must continue to have `canPublish: false`, `canSubscribe: false` until doctor admission.
- At exact end, `RoomServiceClient.deleteRoom` forcibly disconnects all participants. `SessionRoom.terminatedAt` makes this idempotent, and the termination write is scoped by the observed `expiresAt`. A Nitro startup plugin and 30s fallback sweep recover after restarts/missed timers. `ensureSessionRoom` clears the termination/admission state and re-arms when it detects a changed appointment end; the future Phase 3 reschedule endpoints must do the same explicitly.
- LiveKit room persistence/recreation is still validated in staging; the termination scheduler, not room emptiness, enforces the end.

## 10. Integration Point Impact

| Integration | Impact | Handling |
|---|---|---|
| PostgreSQL/Prisma | new indexes, hold column, blog tables/enums, backfill | additive migrations; transaction/locking |
| Paymob | webhook now must confirm booking transactionally | idempotency; signature remains mandatory |
| Stripe | checkout URL fix if Stripe is enabled | return `session.url`; keep webhook signature |
| Resend | confirmation email moves from admin assignment to payment success/in-clinic creation | no email verification work |
| LiveKit | shorter tokens; current-entry/SID admission checks; exact-end `deleteRoom`; startup/fallback termination recovery | same SDK, no new vendor or job system |
| Docker/deploy | `prisma migrate deploy` applies migrations before app start | release gate in Phase 6 |
| Uploads | blog plain text has no upload requirement | no new upload surface |

## 11. Backward Compatibility

- Old API clients that omit `doctorId` will receive `400` after Phase 3. The only known clients are the repository's pages/composables and tests; update them in the same phase.
- Existing bookings with `doctorId: null` remain readable; normal new writes require a doctor. No `NOT NULL` migration is planned.
- The admin pending/assign UI is transitional. Keep the API for legacy rows only; hide the normal queue after Phase 4. Confirmed-booking reassignment is not supported; admin recovery is cancel + rebook.
- Public URL changes are additive (`/blog`, `/blog/:slug`); no existing public route is removed except the dead `/meeting` lobby may be redirected.
- Doctor page removals (`/doctor/patients`, `/doctor/profile`) must leave redirects or explicit 404s; old bookmarks should not expose stale pages. Own notes move to the booking detail; peer notes are removed.
- Rescheduling supports cross-date same-doctor moves through the new patient/admin endpoints; the old same-day patch may remain as a compatibility alias but must not silently fall back on failure.

## 12. Decision Status

All design decisions are resolved in [`../FINAL-DECISIONS.md`](../FINAL-DECISIONS.md).

**DECIDED:** A2, A4, A5, B1, B2, C2, D1, D2, D3.

**DECIDED — OWNER APPROVED:**

1. **A1** — 20-minute hold, configurable 5–60 minutes.
2. **A3** — late successful payment policy and manual refund/reconciliation.
3. **B3** — cross-date same-doctor rescheduling with 24-hour patient limit.
4. **C1** — own notes retained; patient directory/profile/peer notes removed.

Those four decisions are owner-approved. There are no other open architecture questions in this document; implementation verification remains per phase.
