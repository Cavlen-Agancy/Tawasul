# CHANGES.md — Comprehensive Fix (Doctor / Patient / Admin Dashboards, Auth, Webhook)

## Files created

- `components/ui/avatar/index.ts` — Barrel re-exporting `Avatar`, `AvatarFallback`, `AvatarImage` (required by `shadcn-nuxt`, which only registers components exported from per-folder `index.ts`).
- `components/ui/badge/index.ts` — Barrel for `Badge`.
- `components/ui/button/index.ts` — Barrel for `Button`.
- `components/ui/card/index.ts` — Barrel for `Card`, `CardContent`, `CardDescription`, `CardFooter`, `CardHeader`, `CardTitle`.
- `components/ui/dialog/index.ts` — Barrel for all 7 dialog pieces.
- `components/ui/input/index.ts` — Barrel for `Input`.
- `components/ui/skeleton/index.ts` — Barrel for `Skeleton`.
- `components/ui/table/index.ts` — Barrel for all 6 table pieces.
- `components/ui/tabs/index.ts` — Barrel for `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`.
- `components/ui/toast/index.ts` — Barrel for `Toast`, `Toaster`.
- `types/vue-shim.d.ts` — `declare module '*.vue'` so `tsc` accepts the barrel re-exports.
- `modules/doctor/layouts/DoctorLayout.vue` — 240px desktop sidebar (My Calendar, My Profile, Logout), mobile bottom nav, yellow incomplete-profile banner when `profile.bio` is empty, `<slot/>` content.
- `modules/doctor/composables/useDoctorDashboard.ts` — `useState` keys `doctor-profile`, `doctor-bookings`, `doctor-dashboard-loading`, `doctor-dashboard-error`; methods `fetchProfile`, `updateProfile`, `uploadPhoto`, `fetchBookings(start, end)`, `clear`.
- `modules/doctor/components/SpecializationsTagInput.vue` — `modelValue: string[]` + `update:modelValue`; input + Add/Enter, `Badge` chips with X remove.
- `modules/doctor/server/api/doctor/profile.get.ts` — `requireAuth DOCTOR`; returns `{id,name,email,phone,photo,bio,slug,specializations,isActive}`; 404 if user or doctor row missing.
- `modules/doctor/server/api/doctor/profile.patch.ts` — `requireAuth DOCTOR`; Zod `doctorProfilePatchSchema`; updates User + Doctor; returns full profile.
- `modules/doctor/server/api/doctor/profile/photo.post.ts` — `requireAuth DOCTOR`; multipart `jpeg/png/webp`, 2MB limit, saves to `UPLOAD_PATH/doctors/{userId}-{ts}.ext`; returns `{photoUrl: '/doctors/…'}`.
- `modules/doctor/server/api/doctor/bookings.get.ts` — `requireAuth DOCTOR`; requires `?start&end YYYY-MM-DD` (400 otherwise); bookings filtered by the caller's `Doctor.id` in range, ASC; includes patient name/photo.
- `modules/doctor/server/api/doctor/bookings/[id].get.ts` — `requireAuth DOCTOR`; 404 unknown; 403 unless `booking.doctorId` equals the caller's `Doctor.id`; returns patient name/email + payment status.
- `modules/doctor/server/api/doctor/session/[bookingId].get.ts` — `requireAuth DOCTOR`; 403 unless assigned + `CONFIRMED` + inside `start-5min…end+15min` window (`canJoinMeetingAt`); upserts `SessionRoom roomName=tawasul-{id}`; returns `{roomName,jitsiDomain}`.
- `modules/doctor/pages/doctor/calendar.vue` — Route `/doctor/calendar` (`doctor-layout`, `auth`+`doctor-only`); FullCalendar month/week/day; `datesSet` debounced 100ms → `fetchBookings`; event click → detail Dialog with Join (window-gated).
- `modules/doctor/pages/doctor/profile.vue` — Route `/doctor/profile`; avatar + immediate photo upload; name/phone/email-readonly/bio/specializations; save → toast.
- `modules/doctor/pages/doctor/session/[bookingId].vue` — Route `/doctor/session/:bookingId`; polls `GET /api/doctor/session/:id` every 30s; waiting countdown outside window; Jitsi (`prejoinPageEnabled:false`, muted start, `displayName` = doctor name); Leave → `/doctor/calendar`.
- `server/routes/doctors/[filename].get.ts` — Serves `UPLOAD_PATH/doctors/*.{jpg,jpeg,png,webp}` with long cache (mirrors the patients route; required for doctor `photoUrl` to resolve).
- `modules/admin/server/api/admin/doctors/index.post.ts` — `DOCTORS CREATE`; validates, 400 on duplicate email; `crypto.randomBytes(8).toString('base64')` temp password (hashed); unique `dr-{slug}` (+`-n` on clash); creates User (`DOCTOR`, verified, active) + Doctor; sends `doctorWelcomeTemplate`; 201 without password.
- `modules/admin/server/api/admin/doctors/[id].get.ts` — `DOCTORS READ`; full profile + availability + blockedSlots + `sessionCountThisMonth/AllTime` (CONFIRMED counts); 404 unknown.
- `modules/admin/server/api/admin/doctors/[id].patch.ts` — `DOCTORS UPDATE`; partial update of User (name/phone) + Doctor (bio/specializations/isActive); returns updated profile.
- `modules/admin/server/api/admin/doctors/[id]/availability.get.ts` — `DOCTORS READ`; returns `{availability, blockedSlots}`.
- `modules/admin/server/api/admin/doctors/[id]/availability.post.ts` — `DOCTORS UPDATE`; validates array (unique days, start<end, duration 30|45|60); transaction replace; returns `{success, availability}`.
- `modules/admin/server/api/admin/doctors/[id]/availability/block.post.ts` — `DOCTORS UPDATE`; validates date/time; rejects past, overlapping blocks, overlapping CONFIRMED bookings; 201 `{blockedSlot}`.
- `modules/admin/server/api/admin/doctors/[id]/availability/block/[blockId].delete.ts` — `DOCTORS UPDATE`; 404 unknown block; 403 cross-doctor; returns `{success}`.
- `modules/admin/server/api/admin/bookings/[id].get.ts` — `APPOINTMENTS READ`; full detail (patient contact, doctor, payment status/amount); 404 unknown. (Required by `fetchBooking`; was missing with no dedicated step.)
- `modules/admin/server/api/admin/bookings/[id]/cancel.patch.ts` — `APPOINTMENTS DELETE`; 404 unknown; 400 already-cancelled; transaction sets `CANCELLED` + `REFUNDED`; sends `bookingCancellationTemplate` to patient; no 24h rule.
- `modules/admin/server/api/admin/overview.get.ts` — STAFF-only (no permission gate, per spec); month/all CONFIRMED counts, month/all SUCCESS revenue, active patients/doctors, recent 5 bookings. (Required by `fetchOverview`; was missing with no dedicated step.)
- `modules/admin/server/api/admin/payments/index.get.ts` — `PAYMENTS READ`; filters `start/end/doctorId/status`; returns mapped payments + `{totalRevenue, totalRevenueThisMonth, totalRefunded}` via Prisma aggregates.
- `modules/admin/server/api/admin/staff/index.get.ts` — `STAFF READ`; STAFF users excluding `SEED_ADMIN_EMAIL`, with permissions.
- `modules/admin/server/api/admin/staff/index.post.ts` — `STAFF CREATE`; validates (400 duplicate/invalid permission); temp password + hash; creates User + Permission rows; reuses `doctorWelcomeTemplate`; 201 without password.
- `modules/admin/server/api/admin/staff/[id].patch.ts` — `STAFF UPDATE`; updates User; full-replaces permissions when provided; 404 non-staff.
- `modules/admin/server/api/admin/staff/[id].delete.ts` — `STAFF DELETE`; 403 for seed admin; soft-deactivates (`isActive:false`); 404 non-staff.
- `modules/admin/server/api/admin/patients/index.get.ts` — `PATIENTS READ`; optional `?search` (name/email); `totalSessions` + `lastSessionDate` via batched `groupBy`; `createdAt DESC`.
- `modules/admin/server/api/admin/patients/[id].get.ts` — `PATIENTS READ`; profile + booking history + payment history; 404 non-patient.
- `modules/admin/server/api/admin/settings.get.ts` — `SETTINGS READ`; singleton with `paymentGatewayKey/Secret` masked (`****` + last4).
- `modules/admin/server/api/admin/settings.patch.ts` — `SETTINGS UPDATE`; `settingsPatchSchema`; fields starting with `****` are skipped (keys preserved); returns masked settings.
- `modules/admin/components/PermissionBuilder.vue` — Checkbox grid 6 resources × 4 actions; `modelValue`/`update:modelValue`; per-resource summary; UPDATE-needs-READ hint.
- `pages/admin/doctors.vue` — Searchable table (Photo/Name/Email/Specializations/Status/Sessions This Month/Actions); Add modal → "Doctor created. Credentials sent to their email."; Edit modal; Activate/Deactivate; View Calendar link; actions gated by `hasPermission`.
- `pages/admin/doctors/[id].vue` — Tabs Profile (edit form) / Calendar (doctor's bookings) / Availability (replace form, blocked list + add/remove).
- `pages/admin/payments.vue` — Three stat cards; date/doctor/status filters; desktop table + mobile cards; empty state.
- `pages/admin/staff.vue` — Table (Name/Email/Permissions summary/Status/Actions); Add/Edit modals with `PermissionBuilder`; deactivate confirm; seed admin excluded server-side.
- `pages/admin/patients.vue` — Searchable table (Photo/Name/Email/Phone/Total Sessions/Last Session/Registered/View).
- `pages/admin/patients/[id].vue` — Profile + booking history + payment history (view-only).
- `tests/api/doctor/profile.test.ts` — Doctor profile/bookings/detail/session tests (401/404/403/200 paths).
- `tests/api/admin/doctors-crud.test.ts` — Doctor create (201/duplicate 400), detail + counts, patch, availability replace, block/unblock.
- `tests/api/admin/bookings-manage.test.ts` — Booking detail (200/404), admin cancel (message + CANCELLED/REFUNDED, double-cancel 400).
- `tests/api/admin/payments.test.ts` — List + summary, status filter.
- `tests/api/admin/staff.test.ts` — Create (201/dup 400), permission replace, deactivate, seed-admin 403.
- `tests/api/admin/patients.test.ts` — List + counts, search, detail (history), 404.
- `tests/api/admin/settings.test.ts` — Masked GET, `****`-preserving PATCH.

## Files changed

- `server/utils/validation.ts` — Added `doctorProfilePatchSchema`, `doctorBookingsQuerySchema`, `adminDoctorCreateSchema`, `adminDoctorPatchSchema`, `availabilityReplaceSchema`, `blockSlotSchema`, `staffCreateSchema`, `staffPatchSchema`, `settingsPatchSchema` (+ internal `permissionItemSchema`).
- `modules/doctor/index.ts` — Registers `DoctorLayout` via `addLayout` (mirrors the patient module).
- `modules/admin/server/api/admin/doctors/index.get.ts` — Added batched `sessionCountThisMonth`/`sessionCountAllTime` via two `groupBy` queries (no N+1).
- `modules/admin/composables/types.ts` — Added `AdminDoctorDetail`, `AvailabilitySlot`, `BlockedSlot`, `AdminPayment`, `PaymentsSummary`, `AdminStaffMember`, `AdminPatient`, `AdminPatientDetail`, `AdminSettings`, `AdminOverview`; extended `AdminDoctor` with optional session counts.
- `modules/admin/composables/useAdminDashboard.ts` — Added state (`doctors`, `currentDoctor`, `doctorAvailability`, `doctorBlockedSlots`, `payments`, `paymentsSummary`, `staff`, `patients`, `currentPatient`, `settings`, `overview`) and methods (`fetchOverview`, `fetchBooking`, `cancelBooking` replacing the dead `updateBookingStatus`, `fetchDoctors`, `fetchDoctor`, `createDoctor`, `updateDoctor`, `fetchAvailability`, `updateAvailability`, `blockSlot`, `unblockSlot`, `fetchPayments`, `fetchStaff`, `createStaff`, `updateStaff`, `deactivateStaff`, `fetchPatients`, `fetchPatient`, `fetchSettings`, `updateSettings`); `fetchBookings` now accepts optional filters.
- `pages/doctor.vue` — Placeholder replaced with redirect to `/doctor/calendar` (`layout:false`, `auth`+`doctor-only`).
- `pages/dashboard/appointments.vue` — FullCalendar + booking dialog replaced with Upcoming/Past `Tabs` + cards (avatar, `Monday, 4 March 2024` date, `10:00 AM – 11:00 AM` time, service); Join magenta/gated with "Available 5 minutes before your session" tooltip → `/dashboard/session/:id`; Cancel (>24h) modal moves card to Past without reload; skeletons; 60s refresh; Book Now empty states.
- `pages/admin/appointments.vue` — Calendar event click now opens a booking-detail dialog (patient/doctor/service/status) with conditional Assign section (PENDING + `APPOINTMENTS UPDATE`) and Cancel Booking button (non-cancelled + `APPOINTMENTS DELETE`); pending-tab assign flow unchanged.
- `pages/admin/settings.vue` — Added Platform Info / Pricing / Working Hours / Gateway tabs, each with an independent Save calling `PATCH /api/admin/settings` with only its fields; gateway keys masked with an "Update Keys" toggle.
- `layouts/admin.vue` — Sidebar now has Overview, All Appointments, Manage Doctors, Manage Patients, Manage Payments, Manage Staff, Settings; non-Overview links render only with `hasPermission(resource, 'READ')` (desktop, mobile menu, bottom nav).
- `modules/auth/server/api/auth/verify-email.get.ts` — Unknown token now returns 404 (was 400); missing-token 400 and expired 400 unchanged.
- `modules/auth/server/api/auth/login.post.ts` — Response is now `{id,name,email,photo?,accountType}` (removed `phone`); check order is now password → verified → active.
- `modules/payment/server/api/payment/webhook.post.ts` — HMAC over the raw body string (`readRawBody`, JSON fallback when the raw stream is unavailable); missing secrets fail closed with 400; Paymob accepts `x-hmac` (legacy `hmac` still accepted); Stripe verified via `stripe.webhooks.constructEvent`; 200 after valid signature with internal errors logged.
- `tests/api/auth/verify-email.get.test.ts` — Unknown-token expectation 400 → 404.
- `tests/api/auth/login.post.test.ts` — Added `not.toHaveProperty('phone')` assertion.
- `tests/api/payment/webhook.post.test.ts` — Stripe tests now sign `t=…,v1=…` over the raw body (compatible with `constructEvent`); added missing-secret 400 tests (Paymob + Stripe) and an `x-hmac` acceptance test.
- `tests/api/patient/session/[bookingId].get.test.ts` — In-window fixture now derives start/end from the mocked clock and uses a local-noon date (see problems below).
- `tests/e2e/patient-dashboard.spec.ts` — Doctor redirect test targets `/doctor/calendar`; calendar/dialog/holiday/lobby-click/mobile-calendar/RTL tests replaced with tabs tests (upcoming cards, disabled Join + tooltip, past chips, no empty states, in-window Join navigation, cancel-to-past, mobile no-overflow, out-of-window Join disabled).
- `package.json` / `package-lock.json` — Added `shadcn-vue@^2.8.2`, `shadcn-nuxt@^2.8.2`, `@fullcalendar/timegrid@^6.1.21` (dev: `shadcn-nuxt`).

## Files deleted

- None.

## Assumptions made

- Doctor pages live at `modules/doctor/pages/doctor/*.vue` (not `modules/doctor/pages/*.vue` as written in the prompt) because the `pages:extend` hook in `nuxt.config.ts` maps `modules/<m>/pages/<sub>/<base>.vue` → `/<sub>/<base>`; a flat file would have produced `/calendar` instead of `/doctor/calendar`.
- No `slugify` library was installed; slugs are built inline (`dr-{kebab-name}`, `-n` suffix on clash).
- `UPLOAD_PATH` subdirectories (`doctors/`, `patients/`) are created with `mkdirSync(recursive)` at upload time; no seeding of empty dirs.
- Jitsi loads from the `meet.jit.si` CDN (`external_api.js`), same as the patient session page.
- Patient Join navigates to the documented `/dashboard/session/:id` (the pre-existing calendar page used the out-of-scope `/meeting/:id/lobby`, which still exists untouched).
- `GET /api/admin/overview` (STAFF-only, no permission gate) and `GET /api/admin/bookings/:id` (`APPOINTMENTS READ`) were created although they had no dedicated steps, because STEP 40 requires `fetchOverview`/`fetchBooking`.
- Webhook keeps the legacy `hmac` Paymob header as an alias alongside the documented `x-hmac`.
- Doctor `photo.post` reads `process.env.UPLOAD_PATH/UPLOAD_MAX_SIZE` like the patient endpoint (rather than runtime config) so behavior matches under the vitest harness.
- STEP 37 (rename `CardContent`→`CardBody`, `NuxtLink`→`Link`) was intentionally not applied: `CardBody` does not exist in shadcn-vue and `NuxtLink` is the correct Nuxt component; renaming would break rendering.
- STEP 38 (client-only `plugins/auth.ts`) was intentionally not applied: the plugin must run on the server so SSR route middleware sees the session — client-only would 302 logged-in users to `/login` on every hard load/bookmark. The universal `fetchMe` (via `useRequestFetch` cookie forwarding) was verified working live.
- Stripe webhook verification uses `stripe.webhooks.constructEvent` offline (no network); only the signature check is used.

## Problems encountered and resolutions

- `shadcn-nuxt` shadowed Nuxt core auto-imports: its setup adds `./components/ui` with `ignore: ["**/*"]` (prepended), so without per-folder `index.ts` barrels every `<Button>` failed to resolve. Resolved by adding the 10 barrel files (verified: zero "Failed to resolve component" warnings, buttons render in SSR HTML). The plan's `'shadcn-vue/nuxt'` module id does not exist in shadcn-vue v2 (CLI-only package); the official Nuxt module `shadcn-nuxt` was used instead. The plan's `shadcnVue` Tailwind plugin likewise does not exist in v2; CSS variables already live in `assets/css/tailwind.css` and animations in `tailwindcss-animate`, so no Tailwind change was needed.
- Doctor identity: the prompt's steps compare `booking.doctorId` to the auth `userId`, but the schema's `Booking.doctorId` references `Doctor.id` (via `Doctor.userId → User.id`). All doctor endpoints resolve `Doctor` by `userId` first and compare against `Doctor.id`.
- New `.ts` barrel re-exports of `.vue` files failed `tsc` (no `*.vue` declaration); added `types/vue-shim.d.ts`. Final `tsc --noEmit` count is 24, identical to the pre-change baseline (all pre-existing).
- `tests/api/patient/session` in-window test failed depending on wall-clock time: it pinned `Date.now` to 13:00 but built fixtures from the real clock, and a 00:xx local datetime truncates to the previous UTC date in the DB session. Fixed by deriving the fixture from the mocked clock and using a local-noon date; the handler itself was untouched and correct.
- Pre-existing `tsc` errors in `modules/admin/server/api/admin/bookings/index.get.ts` (untyped `where` object) were left as-is; the new payments endpoint uses `Prisma.PaymentWhereInput` to avoid repeating the pattern.
