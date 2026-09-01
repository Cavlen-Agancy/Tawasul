# Phase 7 — QA & Production Deploy

## Goal
Verify the entire platform works correctly across all roles, fix all critical bugs, and deploy to a production VPS. After this phase, the platform is live and accessible on a real domain over HTTPS.

---

## Stack Used in This Phase
- Docker + Docker Compose (production)
- Nginx (reverse proxy)
- Certbot (SSL)
- UptimeRobot (monitoring)

---

## Overview

Two parallel tracks:

**Track 1 — QA:** Test every flow across all roles. Fix all critical and high-priority bugs before going live.

**Track 2 — Deploy:** Prepare production Docker setup, configure VPS, deploy.

Do not deploy until Track 1 is complete.

---

## Track 1 — QA

### Patient Flow (complete journey)

1. Visit home page as a guest — verify all sections load.
2. Browse Experts page — verify only active doctors show.
3. Click Book Now without login — verify redirect to /login.
4. Register a new patient account.
5. Check email — click verification link.
6. Log in — verify redirect to /dashboard.
7. Go to /book — verify calendar loads with available dates highlighted.
8. Select an available date — verify time slots appear.
9. Select a slot — verify booking summary is correct (doctor, date, time, price).
10. Complete payment with test card.
11. Verify confirmation page shows correct booking details.
12. Check email — verify confirmation email received.
13. Go to My Appointments — verify booking in upcoming tab.
14. Verify Join Session button is grayed out outside time window.
15. Cancel booking (more than 24hr) — verify confirmation dialog appears.
16. Verify cancellation email received.
17. Verify cancelled booking moves to past tab.
18. Go to My Payments — verify payment record appears with correct status.
19. Update profile — name, phone, photo. Verify changes save.

---

### Doctor Flow (complete journey)

1. Admin creates doctor account — verify welcome email received.
2. Log in as doctor — verify redirect to /doctor/calendar.
3. Verify incomplete profile banner shows.
4. Go to My Profile — complete bio, specializations, upload photo.
5. Verify profile saves correctly.
6. Go to /doctor/calendar — verify assigned bookings appear after a patient books.
7. Switch between month, week, day views — verify correct date ranges load.
8. Click a booking event — verify patient name and details are correct.
9. Verify Join Session button in modal is grayed out outside time window.
10. At session time — verify Jitsi room loads.
11. Verify patient and doctor enter the same Jitsi room.

---

### Admin Flow (complete journey)

1. Log in as seed admin — verify redirect to /admin/overview.
2. Verify overview stats match actual database counts.
3. Add a new doctor — verify welcome email sent, doctor can log in.
4. Edit doctor profile from admin — verify changes save.
5. Set doctor availability from admin panel — verify slots appear on /book.
6. View All Appointments — verify all bookings appear.
7. Apply doctor filter — verify only that doctor's bookings show.
8. Cancel a booking from admin — verify no 24hr restriction, patient receives email.
9. Add a staff member with limited permissions (APPOINTMENTS READ only).
10. Log in as that staff member — verify they can only see Appointments in sidebar.
11. Verify staff member cannot access /admin/doctors (403).
12. Back in admin — edit staff permissions to add DOCTORS READ.
13. Re-verify staff member can now see Manage Doctors.
14. Go to Manage Patients — verify patient list and detail page.
15. Go to Manage Payments — verify all transactions with correct totals.
16. Go to Settings — update session price. Verify new price appears in booking flow.
17. Verify payment gateway keys are always masked in the Settings page.

---

### Security Tests

- [ ] Patient cannot access /doctor or /admin — must redirect
- [ ] Doctor cannot access /admin — must redirect
- [ ] Staff without PATIENTS READ cannot call GET /api/admin/patients — must return 403
- [ ] Unauthenticated user cannot call any /api/patient, /api/doctor, /api/admin endpoint — must return 401
- [ ] Patient cannot fetch another patient's appointments by changing the booking id in the URL
- [ ] Patient cannot access another patient's session room
- [ ] Doctor cannot fetch another doctor's bookings
- [ ] Payment webhook rejects requests with invalid signature
- [ ] Booking a slot that was just taken by another patient returns 400
- [ ] JWT tampered token is rejected and cookie is cleared
- [ ] Password reset token expires after 1 hour
- [ ] Deactivated account cannot log in

---

### Email Tests

- [ ] Registration verification email arrives and link works
- [ ] Password reset email arrives and link works and expires
- [ ] Booking confirmation email arrives with correct details
- [ ] Doctor booking notification email arrives
- [ ] Cancellation email arrives (patient-initiated)
- [ ] Cancellation email arrives (admin-initiated)
- [ ] Doctor welcome email arrives with correct login credentials
- [ ] Staff welcome email arrives with correct login credentials
- [ ] Session reminder email arrives 24hr before session (if implemented)

---

### Mobile Responsiveness Tests (375px viewport)

- [ ] Home page all sections readable
- [ ] Experts listing usable
- [ ] Expert profile and Book Now button reachable
- [ ] Booking calendar navigable
- [ ] Slot selection usable
- [ ] Patient dashboard sidebar collapses to bottom nav
- [ ] Appointments cards readable
- [ ] Payments table collapses to card list
- [ ] Doctor dashboard sidebar collapses
- [ ] Doctor calendar navigable (default to day view on mobile)
- [ ] Admin dashboard sidebar collapses
- [ ] Admin tables scroll horizontally
- [ ] Permission builder modal scrollable on mobile

---

### Bug Priority

**Critical (fix before deploy):**
- Payment flow broken
- Booking not confirming after payment
- Emails not sending
- Auth bypass (wrong role accessing wrong dashboard)
- Data leaking between users
- Session room accessible without valid booking or outside time window

**High (fix before deploy if time allows):**
- Calendar not loading availability correctly
- Doctor availability not reflecting on /book
- Mobile layout broken on a key page

**Medium (first post-launch patch):**
- UI inconsistencies
- Missing loading states
- Minor validation gaps

---

## Track 2 — Production Deploy

### Step 1 — Nginx Config

Create `nginx/nginx.conf` and `nginx/conf.d/tawasul.conf`.

The config must:
- Listen on port 80, redirect all HTTP → HTTPS
- Listen on port 443 with SSL certs from Certbot
- Proxy all requests to the Nuxt app on port 3000
- Set headers: X-Real-IP, X-Forwarded-For, X-Forwarded-Proto
- Client max body size: 10MB (for photo uploads)
- Enable gzip for text, CSS, JS, JSON
- Cache headers for `/_nuxt/` path: max-age 1 year, immutable

### Step 2 — VPS Setup

On Ubuntu 22.04 VPS:

1. Update system: `apt update && apt upgrade -y`
2. Install Docker: follow official Docker docs for Ubuntu
3. Install Docker Compose plugin
4. Install Git: `apt install git -y`
5. Create non-root user: `adduser tawasul && usermod -aG docker tawasul`
6. Switch to tawasul user
7. Clone repo: `git clone [repo-url] /var/www/tawasul`
8. Create `.env.prod` with all production values:
   - `NODE_ENV=production`
   - `APP_URL=https://yourdomain.com`
   - `DATABASE_URL` with production DB credentials
   - Strong `JWT_SECRET` (generate with openssl)
   - Real `RESEND_API_KEY` and verified `RESEND_FROM_EMAIL`
   - Real payment gateway keys
   - `JITSI_DOMAIN=meet.jit.si`
   - Production `UPLOAD_PATH=/var/www/tawasul/uploads`

### Step 3 — SSL Certificate

Point domain DNS A record to VPS IP. Wait for propagation.

Run Certbot standalone to issue certificate before starting the full stack:
```
docker run --rm -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  --email your@email.com --agree-tos --no-eff-email \
  -d yourdomain.com -d www.yourdomain.com
```

Set up auto-renewal cron: `0 12 * * * certbot renew --quiet`

### Step 4 — Database Setup

Start postgres only:
```
docker compose -f docker-compose.prod.yml up -d postgres
```

Run migrations and seed:
```
docker compose -f docker-compose.prod.yml run --rm app npx prisma db push
docker compose -f docker-compose.prod.yml run --rm app npx prisma db seed
```

### Step 5 — Start Full Stack

```
docker compose -f docker-compose.prod.yml up -d
```

Verify all containers running:
```
docker compose -f docker-compose.prod.yml ps
```

Check app logs:
```
docker compose -f docker-compose.prod.yml logs -f app
```

### Step 6 — Post-Deploy Verification

- [ ] Site accessible at https://yourdomain.com
- [ ] HTTP redirects to HTTPS
- [ ] Registration and email verification work on live domain
- [ ] Login and role redirect work
- [ ] Booking flow works end to end on production
- [ ] Real payment completes (use minimum amount for test)
- [ ] Confirmation email arrives from verified Resend domain
- [ ] Doctor dashboard accessible and calendar loads
- [ ] Admin dashboard accessible and stats correct
- [ ] Photo uploads persist after container restart (verify volume mount)
- [ ] pgAdmin not accessible from outside (port not exposed)

### Step 7 — Monitoring

- Sign up at UptimeRobot (free)
- Add HTTP monitor for https://yourdomain.com, check every 5 minutes
- Set email alert for downtime
- Configure Docker restart policy (already set to `unless-stopped` in prod compose)
- Monitor logs for first 24 hours: `docker compose -f docker-compose.prod.yml logs -f`

---

## Notes for the AI

- Never commit `.env.prod` to Git.
- The production Dockerfile is multi-stage — verify it builds correctly locally before pushing to VPS.
- Photo uploads volume must be mounted to the same path defined in `UPLOAD_PATH` — verify this in docker-compose.prod.yml.
- PostgreSQL port must not be exposed in production — only accessible within the Docker network.
- Run `prisma db push` not `prisma migrate` for MVP.
- The first real payment on production: use the minimum chargeable amount. Confirm webhook fires, booking confirms, email arrives — then announce the platform.
- Keep the seed admin password in a secure location (password manager) — it cannot be recovered from the database (only the hash is stored).
