# Phase 7 — QA & Production Deploy
## testing.md

---

## Testing Strategy

Phase 7 is the final phase and focuses on **end-to-end testing** and **production deployment verification**. Testing includes:

- **End-to-End Tests (Manual)** — YES. Test all user flows (patient, doctor, admin) manually.
- **Security Tests (Manual)** — YES. Test all security scenarios.
- **Email Tests (Manual)** — YES. Verify all email triggers.
- **Mobile Tests (Manual)** — YES. Test all pages on 375px viewport.
- **Deployment Tests (Manual)** — YES. Verify production deployment.

**Automated Testing:**
- All automated tests (unit, API, Playwright) from Phases 0–6 should still pass. Run them as a regression check before starting Phase 7.

---

## Regression Testing

Before starting Phase 7, run all automated tests from previous phases to ensure no regressions:

```bash
# Run all tests
npm run test:unit   # Unit tests for utilities
npm run test:api    # API tests for all endpoints
npm run test:e2e    # Playwright end-to-end tests
npx tsc --noEmit   # TypeScript check
```

**Expected:** All tests pass with 0 failures.

---

## Manual Test Plans

---

### Patient Flow Test Plan

**Tester:** QA Engineer or Developer
**Environment:** Staging (mirrors production)

| Step | Action | Expected Result | Status |
|---|---|---|---|
| 1 | Visit home page as guest | All sections load, Book Now buttons visible | [ ] |
| 2 | Browse Experts page | Only active doctors show, cards have photo/name/specializations | [ ] |
| 3 | Click Book Now without login | Redirect to `/login` | [ ] |
| 4 | Register new patient account | Success message, verification email sent | [ ] |
| 5 | Check email, click verification link | Email verified, redirect to success page | [ ] |
| 6 | Log in | Redirect to `/dashboard` | [ ] |
| 7 | Go to `/book` | Calendar loads, available dates highlighted | [ ] |
| 8 | Select available date | Time slots appear as button chips | [ ] |
| 9 | Select a slot | Booking summary shows correct details | [ ] |
| 10 | Complete payment with test card | Redirect to `/booking/success`, booking confirmed | [ ] |
| 11 | Verify confirmation page | Checkmark icon, booking details, Go to My Appointments button | [ ] |
| 12 | Check email for confirmation | Confirmation email arrives with correct details | [ ] |
| 13 | Go to My Appointments | Booking appears in upcoming tab | [ ] |
| 14 | Verify Join Session button | Grayed out if outside time window, active if within | [ ] |
| 15 | Cancel booking (>24hr) | Confirmation dialog, booking moves to past tab | [ ] |
| 16 | Check email for cancellation | Cancellation email arrives | [ ] |
| 17 | Verify cancelled booking | Appears in past tab with Cancelled badge | [ ] |
| 18 | Go to My Payments | Payment record appears with SUCCESS status | [ ] |
| 19 | Update profile | Changes save, success toast appears | [ ] |

---

### Doctor Flow Test Plan

**Tester:** QA Engineer or Developer
**Environment:** Staging

| Step | Action | Expected Result | Status |
|---|---|---|---|
| 1 | Admin creates doctor account | Success toast, welcome email sent | [ ] |
| 2 | Check doctor's email | Welcome email with login credentials arrives | [ ] |
| 3 | Log in as doctor | Redirect to `/doctor/calendar` | [ ] |
| 4 | Verify incomplete profile banner | Shows if bio is empty | [ ] |
| 5 | Complete profile | Bio, specializations, photo save correctly | [ ] |
| 6 | Go to `/doctor/calendar` | Assigned bookings appear (after patient books) | [ ] |
| 7 | Switch between month/week/day views | Correct date ranges load | [ ] |
| 8 | Click booking event | Modal shows patient name, details | [ ] |
| 9 | Verify Join Session button | Grayed out if outside time window | [ ] |
| 10 | At session time, join session | Jitsi room loads, doctor can see/hear | [ ] |
| 11 | Verify patient and doctor in same room | Both enter same Jitsi room | [ ] |

---

### Admin Flow Test Plan

**Tester:** QA Engineer or Developer
**Environment:** Staging

| Step | Action | Expected Result | Status |
|---|---|---|---|
| 1 | Log in as seed admin | Redirect to `/admin/overview` | [ ] |
| 2 | Verify overview stats | Stats match actual DB counts | [ ] |
| 3 | Add new doctor | Success toast, welcome email sent | [ ] |
| 4 | Verify doctor can log in | Doctor logs in with emailed credentials | [ ] |
| 5 | Edit doctor profile from admin | Changes save correctly | [ ] |
| 6 | Set doctor availability | Slots appear on `/book` for that day | [ ] |
| 7 | View All Appointments | All bookings appear on master calendar | [ ] |
| 8 | Apply doctor filter | Only selected doctor's bookings show | [ ] |
| 9 | Cancel booking from admin | No 24hr restriction, patient receives email | [ ] |
| 10 | Add staff member with limited permissions | Success toast, staff can log in | [ ] |
| 11 | Log in as staff member | Only sees allowed sidebar links | [ ] |
| 12 | Verify staff cannot access `/admin/doctors` | 403 or redirect | [ ] |
| 13 | Edit staff permissions | Permissions update, staff sees new links | [ ] |
| 14 | Deactivate staff | Staff cannot log in | [ ] |
| 15 | Go to Manage Patients | Patient list and detail page work | [ ] |
| 16 | Go to Manage Payments | All transactions with correct totals | [ ] |
| 17 | Go to Settings, update session price | New price appears in booking flow | [ ] |
| 18 | Verify payment keys masked | Keys show as `****abcd` | [ ] |
| 19 | Try to deactivate seed admin | Error message, seed admin remains active | [ ] |

---

### Security Test Plan

**Tester:** QA Engineer or Developer
**Environment:** Staging

| Test | Action | Expected Result | Status |
|---|---|---|---|
| 1 | Patient accesses `/doctor` | Redirect to `/dashboard` or 403 | [ ] |
| 2 | Patient accesses `/admin` | Redirect to `/dashboard` or 403 | [ ] |
| 3 | Doctor accesses `/admin` | Redirect to `/doctor` or 403 | [ ] |
| 4 | Staff without PATIENTS READ calls `GET /api/admin/patients` | 403 | [ ] |
| 5 | Unauthenticated user calls `/api/patient/appointments` | 401 | [ ] |
| 6 | Unauthenticated user calls `/api/doctor/bookings` | 401 | [ ] |
| 7 | Unauthenticated user calls `/api/admin/overview` | 401 | [ ] |
| 8 | Patient fetches another patient's appointments | 403 | [ ] |
| 9 | Patient accesses another patient's session room | 403 | [ ] |
| 10 | Doctor fetches another doctor's bookings | 403 | [ ] |
| 11 | Payment webhook with invalid signature | 400 | [ ] |
| 12 | Booking a slot just taken by another patient | 400 | [ ] |
| 13 | JWT tampered token | 401, cookie cleared | [ ] |
| 14 | Password reset token expired | 400 (link expired) | [ ] |
| 15 | Deactivated account login | 403 | [ ] |

---

### Email Test Plan

**Tester:** QA Engineer or Developer
**Environment:** Staging (with real email sending)

| Trigger | Action | Expected Result | Status |
|---|---|---|---|
| 1 | Registration | Register patient | Verification email arrives, link works | [ ] |
| 2 | Password reset | Request reset | Reset email arrives, link works and expires | [ ] |
| 3 | Booking confirmation (patient) | Complete booking | Confirmation email with correct details | [ ] |
| 4 | Booking confirmation (doctor) | Complete booking | Notification email with correct details | [ ] |
| 5 | Cancellation (patient) | Cancel booking | Cancellation email arrives | [ ] |
| 6 | Cancellation (admin) | Admin cancels booking | Cancellation email arrives | [ ] |
| 7 | Doctor welcome | Admin creates doctor | Welcome email with credentials | [ ] |
| 8 | Staff welcome | Admin creates staff | Welcome email with credentials | [ ] |

**Additional Checks:**
- [ ] Sender name is "Tawasul Academy"
- [ ] Sender email is verified domain (not `noreply@resend.dev`)
- [ ] Email content includes all relevant details
- [ ] Links in emails work (verification, reset)

---

### Mobile Responsiveness Test Plan

**Tester:** QA Engineer or Developer
**Environment:** Chrome DevTools (375px viewport)

| Page | Action | Expected Result | Status |
|---|---|---|---|
| 1 | Home page | Scroll and interact | All sections readable, CTA buttons usable | [ ] |
| 2 | Experts listing | Scroll and click | Usable, doctor cards readable | [ ] |
| 3 | Expert profile | Scroll and interact | Profile and Book Now button reachable | [ ] |
| 4 | Booking calendar | Change month, select date | Navigable, dates clickable | [ ] |
| 5 | Slot selection | Select slot | Usable, slots clickable | [ ] |
| 6 | Patient dashboard sidebar | View on mobile | Collapses to bottom nav | [ ] |
| 7 | Appointments cards | View on mobile | Readable, buttons usable | [ ] |
| 8 | Payments table | View on mobile | Collapses to card list | [ ] |
| 9 | Doctor dashboard sidebar | View on mobile | Collapses to bottom nav | [ ] |
| 10 | Doctor calendar | View on mobile | Navigable (default to day view) | [ ] |
| 11 | Admin dashboard sidebar | View on mobile | Collapses to bottom nav | [ ] |
| 12 | Admin tables | Scroll horizontally | Scrollable, data readable | [ ] |
| 13 | Permission builder modal | Open on mobile | Scrollable, all options visible | [ ] |

---

## Production Deployment Verification

**Tester:** DevOps Engineer or Developer
**Environment:** Production (`https://yourdomain.com`)

| Check | Action | Expected Result | Status |
|---|---|---|---|
| 1 | Site accessible | Visit `https://yourdomain.com` | Site loads without errors | [ ] |
| 2 | HTTP → HTTPS redirect | Visit `http://yourdomain.com` | Redirects to `https://yourdomain.com` | [ ] |
| 3 | Registration works | Register new patient | Verification email sent, account created | [ ] |
| 4 | Email verification works | Click verification link | Email verified, can log in | [ ] |
| 5 | Login and redirect | Log in as patient/doctor/staff | Redirects to correct dashboard | [ ] |
| 6 | Booking flow end-to-end | Book, pay, confirm | Booking confirmed, emails sent | [ ] |
| 7 | Real payment | Use minimum amount | Payment completes, webhook fires | [ ] |
| 8 | Confirmation email | Check inbox | Arrives from verified domain | [ ] |
| 9 | Doctor dashboard | Log in as doctor | Calendar loads, bookings visible | [ ] |
| 10 | Admin dashboard | Log in as admin | Overview loads, stats correct | [ ] |
| 11 | Photo uploads persist | Upload photo, restart container | Photo still exists | [ ] |
| 12 | pgAdmin not accessible | Visit `:5050` | Connection refused or not found | [ ] |

---

## Completion Criteria

Mark each item PASS or FAIL before considering Phase 7 complete:

### QA Completion
```
[ ] All regression tests pass (unit, API, Playwright)
[ ] Patient flow test plan completed (all 19 steps PASS)
[ ] Doctor flow test plan completed (all 11 steps PASS)
[ ] Admin flow test plan completed (all 19 steps PASS)
[ ] Security test plan completed (all 15 tests PASS)
[ ] Email test plan completed (all 8 emails PASS)
[ ] Mobile responsiveness test plan completed (all 13 tests PASS)
[ ] All critical bugs fixed (0 open critical bugs)
[ ] All high-priority bugs fixed or documented (0 open high-priority bugs)
```

### Deploy Completion
```
[ ] VPS set up with Ubuntu 22.04
[ ] Docker and Docker Compose installed
[ ] Git installed, repo cloned
[ ] .env.prod created with production values (not committed)
[ ] Nginx config created and tested
[ ] SSL certificate issued and auto-renewal configured
[ ] Database migrated and seeded
[ ] All containers running (postgres, app, nginx)
[ ] Site accessible at https://yourdomain.com
[ ] HTTP redirects to HTTPS
[ ] All post-deploy checks pass (12/12)
[ ] UptimeRobot monitor configured
[ ] First 24 hours of logs reviewed
```

### Final Sign-Off
```
[ ] QA Track complete (all tests PASS)
[ ] Deploy Track complete (all checks PASS)
[ ] No critical or high-priority bugs open
[ ] Production site is live and functional
[ ] Monitoring is in place
```

**Phase 7 is complete only when all items above are marked PASS.**

---

## Notes for the AI

- **Do not deploy until QA is complete.** All critical and high-priority bugs must be fixed.
- **Document all bugs** in a `bugs.md` file in the `phase-7/` folder.
- **Test with real data volumes** (e.g., 100+ bookings, 20+ doctors).
- **Verify email deliverability** before deploy (emails must not go to spam).
- **Test payment webhooks** with real test cards before going live.
- **First real payment:** Use the minimum chargeable amount. Confirm everything works before announcing the platform.
- **Backup everything** before deploy (code, database, uploads).
