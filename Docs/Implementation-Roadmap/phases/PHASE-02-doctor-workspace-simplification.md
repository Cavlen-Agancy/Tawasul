# Phase 2 — Doctor Workspace Simplification & Access Hardening

**Requirement:** B — Doctor Dashboard Simplification.  
**Decision status:** C1 is **DECIDED — OWNER APPROVED**. This phase implements: calendar + own booking detail + own notes + session access, with patient directory/profile/peer notes removed. C2 is DECIDED.  
**Priority rationale:** Security Risk 5 (PHI/doctor isolation), Business Impact 4, UX Severity 4, Technical Risk 2.

## 1. Business Objective

Turn the doctor experience into a focused appointment calendar. The doctor must see only their own appointments and the actions needed to run them, including the existing video-session entry. Unrelated patient-directory, profile-management, and administrative surfaces must be removed from the doctor UI, and the server must remain the authorization boundary.

## 2. Scope

Included:

- Remove “My Patients” and “My Profile” from doctor navigation.
- Remove the incomplete-profile banner and profile fetch from the doctor layout.
- Replace the removed pages with redirects or explicit removal so bookmarks do not expose stale UI.
- Keep the doctor calendar, own booking detail, own notes, and session access flow.
- Remove the patient directory/detail and doctor self-profile APIs from the doctor surface.
- Remove peer-doctor notes and the patient-wide note timeline.
- Add/retain an own-booking notes surface in the booking-detail drawer.
- Filter the doctor booking list to `CONFIRMED`/`CANCELLED`; do not show unpaid `PENDING` holds as appointments.
- Verify and test that doctors cannot read/modify another doctor's bookings or sessions.
- Remove the duplicate doctor layout drift risk (two layout files currently exist).
- Preserve all historical note data; do not silently delete rows.

Out of scope:

- Changing the doctor calendar visual design or FullCalendar views.
- Changing the doctor session video UI (Phase 1 handles window/admit).
- Deleting clinical note data from the database.
- Admin doctor management (kept), except the documented profile-photo gap.
- Email verification.

## 3. Prerequisites

- Phase 1 may be merged before or after; no hard dependency.
- Read `00-current-system-analysis.md` section 5.
- No database migration.

## 4. Current Implementation Facts

- Actual layout used by doctor pages is `layouts/doctor-layout.vue` (`layout: 'doctor-layout'`).
- `modules/doctor/layouts/DoctorLayout.vue` is registered as `DoctorLayout` but current pages do not use that name. It is a duplicate and must be kept in sync or consolidated.
- Navigation currently has My Calendar, My Patients, My Profile.
- Layout fetches `/api/doctor/profile` and shows an incomplete-profile banner.
- Doctor pages exist for patients list/detail and profile.
- Server booking/session endpoints already scope by the authenticated doctor. **CONFIRMED.**
- Doctor notes endpoint intentionally exposes notes from other doctors sharing the same patient. **CONFIRMED; PHI concern.**
- Doctor profile API allows self-editing name/phone/bio/specializations/photo. **CONFIRMED.**

## 5. Implementation Tasks

### Task 1: Consolidate the doctor layout

**Files:**
- Modify: `layouts/doctor-layout.vue`
- Modify or delete: `modules/doctor/layouts/DoctorLayout.vue`
- Modify or delete the `addLayout` block in `modules/doctor/index.ts`

Recommended approach:

- Keep one source of truth for the doctor shell.
- If the module layout is not referenced, delete the duplicate file and remove `addLayout` from `modules/doctor/index.ts`, leaving `layouts/doctor-layout.vue` as the actual layout.
- If deleting the module layout is too broad for the phase, update both files identically and add a comment that they are duplicates; a later cleanup removes one. Do not leave them divergent.

Acceptance:

- All doctor pages render inside `layouts/doctor-layout.vue`.
- No unresolved imports for the removed module layout.

### Task 2: Reduce navigation to the calendar

**Files:**
- Modify: `layouts/doctor-layout.vue`
- Modify: `modules/doctor/layouts/DoctorLayout.vue` if retained

Changes:

- `navItems` contains only:
  - `{ label: 'My Calendar', to: '/doctor/calendar', icon: CalendarDays, dataTestId: 'nav-calendar' }`
- Remove `Users` and `User` imports if unused.
- Remove the `useDoctorDashboard` profile fetch from the layout.
- Remove the incomplete-profile banner and its `TriangleAlert`/`NuxtLink` markup.
- Keep:
  - logo/home link
  - user avatar/name/email
  - theme toggle
  - logout
  - mobile/desktop navigation structure
  - session layout behavior

Acceptance:

- Doctor sees one nav destination: My Calendar.
- No `/api/doctor/profile` request is made by the layout.
- `/doctor` still redirects to `/doctor/calendar`.

### Task 3: Remove the non-calendar doctor pages

**Files (current):**
- `modules/doctor/pages/doctor/patients.vue`
- `modules/doctor/pages/doctor/patients/[userId].vue`
- `modules/doctor/pages/doctor/profile.vue`

Recommended approach:

- Replace each file with a minimal redirect page to `/doctor/calendar`, or delete the files and accept a 404.
- If redirects are used, they must not fetch data, render PHI, or call APIs before redirecting.
- Keep `components/doctor/session-note.vue` and reuse/move it into the booking-detail drawer for the doctor's own notes. It is currently used only by the removed patient-detail page, so a new host surface is required.
- Do not delete the `DoctorNote` Prisma model or existing rows.

Acceptance:

- `/doctor/patients`, `/doctor/patients/:userId`, and `/doctor/profile` no longer render patient data or profile forms.
- The doctor calendar remains fully functional.
- Navigation never exposes the removed routes.

### Task 4: Clean the doctor composable

**Files:**
- Modify: `modules/doctor/composables/useDoctorDashboard.ts`

Changes:

- Keep `DoctorBooking`, `bookings`, `isLoading`, `error`, `fetchBookings`, and `clear`.
- Remove profile state/methods (`profile`, `fetchProfile`, `updateProfile`, `uploadPhoto`, `DoctorProfile`); the doctor self-profile API is removed from the doctor surface.
- Add own-booking note methods or a separate composable for the booking-detail notes surface.
- Do not remove the `DoctorBooking` fields used by the calendar.
- Do not leave dead runtime calls to removed profile/patient endpoints.

Acceptance:

- No doctor page/layout imports removed methods.
- Calendar data flow is unchanged.
- Own notes load/save only for the current doctor's booking.

### Task 5: Retire patient/profile APIs and add own-booking notes

**Files to remove/retire from the doctor surface:**
- `modules/doctor/server/api/doctor/profile.get.ts`
- `modules/doctor/server/api/doctor/profile.patch.ts`
- `modules/doctor/server/api/doctor/profile/photo.post.ts`
- `server/api/doctor/patients.get.ts`
- `server/api/doctor/patients/[userId]/index.get.ts`
- `server/api/doctor/patients/[userId]/notes.get.ts`
- `server/api/doctor/patients/[userId]/sessions/[bookingId]/notes*.ts`
- Their doctor-facing tests (`tests/api/doctor/patients.test.ts`, `tests/api/doctor/profile.test.ts`) are removed or rewritten to assert the new absence/ownership behavior.

**Files to add/modify:**
- Add own-booking note endpoints, e.g. `modules/doctor/server/api/doctor/bookings/[id]/notes.get.ts`, `index.post.ts`, `[noteId].patch.ts`, `[noteId].delete.ts` (or a single equivalent route set).
- Reuse `DoctorNote` and `components/doctor/session-note.vue`.
- Modify `modules/doctor/pages/doctor/calendar.vue` to host the note UI in the booking detail drawer.

Rules:

- **Do not delete note data.** Existing `DoctorNote` rows remain.
- A doctor may read/write only notes where `DoctorNote.doctorId` is the authenticated doctor and the note belongs to the doctor's own booking.
- No peer notes, no patient-wide notes, no admin access unless a separate policy is approved.
- The old peer-note endpoint is removed; do not leave it as a hidden API.
- The doctor profile API is removed from the doctor surface. Admin doctor management remains the canonical profile text editor. Existing photos remain; no doctor photo self-upload in this phase.

Acceptance:

- Patient directory/detail and doctor profile endpoints are no longer reachable.
- Own notes can be read/written/deleted only for own bookings.
- Doctor A cannot read Doctor B's notes.
- Existing note rows are preserved.
- No route exposes peer notes.
- Admin still manages doctor name/phone/bio/specializations.

### Task 6: Harden and test doctor isolation

**Files:**
- Modify if useful: `server/utils/permissions.ts` or add `server/utils/doctor.ts` for a shared `requireDoctorProfile`.
- Tests:
  - `tests/api/doctor/bookings.test.ts` (new or existing expansion)
  - new own-notes API tests
  - `tests/api/doctor/session/[bookingId].get.test.ts` (new if absent)
  - `tests/api/doctor/session/[bookingId]/admit.post.test.ts` (new)
  - `tests/e2e/auth.spec.ts`
  - `tests/e2e/patient-dashboard.spec.ts` (doctor nav assertions if present)

Tests to add:

- Doctor A's `GET /api/doctor/bookings` returns only bookings with `doctorId = A` and only `CONFIRMED`/`CANCELLED`.
- Doctor A's `GET /api/doctor/bookings/:id` for Doctor B's booking returns 403.
- Doctor A's `GET /api/doctor/session/:bookingId` for Doctor B's booking returns 403.
- Doctor A's admit call for Doctor B's booking returns 403 (also covered in Phase 1).
- Doctor A can read/write only own notes; Doctor B's notes are absent/403.
- Patient/staff token on doctor endpoints returns 403.
- Unauthenticated returns 401.
- Admin cannot use doctor-only endpoints unless their account type is DOCTOR.
- Removed patient/profile endpoints return 404/405 and do not leak data.
- No client-supplied `doctorId` is trusted in any doctor endpoint.

Acceptance:

- The tests prove server-side isolation; hiding nav is not the security boundary.

## 6. Expected Database Changes

**None.** No migration, no schema change, no data deletion.

`DoctorNote` rows, doctor profile rows, and existing photos remain; only the doctor-facing API/UI surface changes.

## 7. Expected API Changes

- Remove from the doctor surface:
  - `/api/doctor/profile` GET/PATCH/photo
  - `/api/doctor/patients` and descendants (including peer notes)
- Add own-booking note endpoints (e.g. `/api/doctor/bookings/:bookingId/notes`).
- Keep `GET /api/doctor/bookings` and `GET /api/doctor/bookings/:id`, filtered to own `CONFIRMED`/`CANCELLED`.
- Keep patient/doctor session endpoints unchanged except Phase 1 rules; staff receive no session token/admit path.
- All doctor endpoints remain authenticated/authorized; hiding UI is not the boundary.

## 8. UI/UX Considerations

- Preserve the calendar's existing month/week/day views, filters, detail drawer, and Join Session action.
- Removing the profile banner may leave a doctor with an incomplete public profile; admin doctor management remains responsible for profile completeness.
- The mobile bottom navigation must also show only Calendar.
- Keep logout and theme controls accessible.
- Old bookmarks should redirect to the calendar or show a clean 404, not a blank page.
- Own booking detail may show the patient name and email needed for the appointment; do not show a patient directory, phone directory, or peer notes. Note content is private to the authoring doctor.

## 9. Acceptance Criteria

1. Doctor navigation contains only My Calendar.
2. No patient directory or profile page is reachable from the doctor UI.
3. `/doctor/patients`, `/doctor/patients/:userId`, and `/doctor/profile` do not expose data (redirect or 404).
4. Doctor calendar loads only the authenticated doctor's `CONFIRMED`/`CANCELLED` bookings.
5. Doctor cannot fetch another doctor's booking detail, notes, or session.
6. Patient/staff cannot use doctor endpoints.
7. Session access from the calendar still works.
8. Doctor can read/write own notes for own bookings; peer notes are unavailable.
9. No note/profile data is deleted.
10. The duplicate layout is consolidated or explicitly kept in sync.
11. Existing profile text management remains available to admins; existing doctor photos remain.

## 10. Required Tests

- Unit/API: doctor booking isolation (confirmed/cancelled only), own vs peer notes, patient/staff denial, session ownership denial.
- API: removed patient/profile endpoints return 404/405; own-note endpoints enforce booking/doctor ownership.
- E2E:
  - Doctor login lands on `/doctor/calendar` and sees only Calendar nav.
  - Direct navigation to `/doctor/patients` and `/doctor/profile` does not render PHI.
  - Booking detail exposes own notes and Join button (window behavior from Phase 1).
  - Doctor does not see admin navigation.

## 11. Risks and Dependencies

- **Risk:** Removing the profile page removes doctor self-photo/self-edit; admin doctor editing covers name/phone/bio/specializations but not photo/slug. Document the gap; add admin photo management only as separately approved scope.
- **Risk:** Removing patient/notes APIs requires adding an own-booking notes surface; otherwise clinical note-taking regresses. C1 is owner-approved.
- **Risk:** Two layout files can silently diverge. Consolidate or add a maintenance guard.
- **Dependency:** None on booking/payment phases.
- **Dependency:** Phase 4's booking statuses; doctor list shows only confirmed/cancelled.

## 12. Definition of Done

- Doctor UI is calendar + own booking detail + own notes + session access.
- Removed routes redirect or 404 cleanly.
- Removed patient/profile/peer-note APIs are no longer reachable.
- Own-booking notes are functional and isolated.
- Server isolation tests pass in the phase validation (when approved).
- No database changes.
- C1 owner approval recorded (approved).
- No accidental removal of historical booking/note data.
