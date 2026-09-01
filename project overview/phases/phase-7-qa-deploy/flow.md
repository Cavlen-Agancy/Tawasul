# Phase 7 — QA & Production Deploy
## flow.md

---

## Track 1 — QA

---

### Patient Flow (Complete Journey)

**User Action:** Test the entire patient journey from registration to session completion.

**Steps:**
1. **Visit home page as a guest:**
   - Verify all sections load (Hero, Services, Experts, Testimonials, CTA).
   - Verify Book Now buttons link to `/book`.

2. **Browse Experts page:**
   - Verify only active doctors show.
   - Verify doctor cards have photo, name, specializations.

3. **Click Book Now without login:**
   - Verify redirect to `/login`.

4. **Register a new patient account:**
   - Fill in name, email, phone, password.
   - Submit form.
   - Verify success message: "Check your email to verify your account."

5. **Check email:**
   - Verify verification email arrives within 2 minutes.
   - Click verification link.
   - Verify redirect to verification success page.

6. **Log in:**
   - Enter email and password.
   - Verify redirect to `/dashboard`.

7. **Go to `/book`:**
   - Verify calendar loads with available dates highlighted in magenta.
   - Verify unavailable dates are grayed out and non-clickable.

8. **Select an available date:**
   - Click a date with available slots.
   - Verify time slots appear as button chips below the calendar.

9. **Select a slot:**
   - Click an available slot.
   - Verify booking summary is correct (doctor, date, time, price).

10. **Complete payment:**
    - Click "Confirm and Pay".
    - Use test card for Paymob/Stripe.
    - Verify redirect to payment gateway.
    - Complete payment.
    - Verify redirect to `/booking/success?bookingId=...`.

11. **Verify confirmation page:**
    - Verify checkmark icon, "Booking Confirmed" headline, and booking summary are visible.
    - Verify "Go to My Appointments" button links to `/dashboard/appointments`.

12. **Check email:**
    - Verify confirmation email arrives with correct details (doctor, date, time, service).

13. **Go to My Appointments:**
    - Verify booking appears in the upcoming tab.
    - Verify all details are correct.

14. **Verify Join Session button:**
    - If session is >5 minutes away: Verify button is grayed out with tooltip.
    - If session is within 5 minutes: Verify button is active (magenta).

15. **Cancel booking (>24hr before):**
    - Click "Cancel" button.
    - Verify confirmation dialog appears.
    - Confirm cancellation.
    - Verify booking moves to past tab.

16. **Verify cancellation email:**
    - Verify cancellation email arrives with correct details.

17. **Verify cancelled booking:**
    - Verify booking appears in past tab with "Cancelled" status badge.

18. **Go to My Payments:**
    - Verify payment record appears with correct status (SUCCESS).

19. **Update profile:**
    - Go to `/dashboard/profile`.
    - Update name, phone, photo.
    - Verify changes save and success toast appears.

**Edge Cases:**
- Try to book a slot that was just taken by another user (simulate concurrent booking).
- Try to cancel a booking <24hr before (verify button is hidden).
- Try to access another patient's session room (verify 403).

---

### Doctor Flow (Complete Journey)

**User Action:** Test the entire doctor journey from account creation to session completion.

**Steps:**
1. **Admin creates doctor account:**
   - Log in as admin.
   - Go to `/admin/staff` or `/admin/doctors`.
   - Add a new doctor with name, email, phone, bio, specializations.
   - Verify success toast: "Doctor created. Credentials sent to their email."

2. **Verify welcome email:**
   - Check the doctor's email inbox.
   - Verify welcome email arrives with login credentials.

3. **Log in as doctor:**
   - Use the emailed credentials.
   - Verify redirect to `/doctor/calendar`.

4. **Verify incomplete profile banner:**
   - If bio is empty: Verify yellow banner shows: "Your profile is incomplete..."

5. **Complete profile:**
   - Go to `/doctor/profile`.
   - Fill in bio, specializations, upload photo.
   - Verify profile saves correctly.

6. **Verify calendar:**
   - Go to `/doctor/calendar`.
   - Verify assigned bookings appear after a patient books (simulate in QA).

7. **Switch calendar views:**
   - Switch between month, week, day views.
   - Verify correct date ranges load for each view.

8. **Click a booking event:**
   - Verify modal opens with booking details.
   - Verify patient name and details are correct.

9. **Verify Join Session button:**
   - If session is >5 minutes away: Verify button is grayed out.
   - If session is within 5 minutes: Verify button is active.

10. **At session time:**
    - Click "Join Session".
    - Verify Jitsi room loads.
    - Verify doctor can see and hear (test with another browser/device).

11. **Verify patient and doctor in same room:**
    - Have a patient join the same session (from `/dashboard/session/[bookingId]`).
    - Verify both are in the same Jitsi room.

**Edge Cases:**
- Try to access another doctor's bookings (verify 403).
- Try to access another doctor's session room (verify 403).

---

### Admin Flow (Complete Journey)

**User Action:** Test the entire admin journey for all tasks.

**Steps:**
1. **Log in as seed admin:**
   - Use `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.
   - Verify redirect to `/admin/overview`.

2. **Verify overview stats:**
   - Verify stats match actual database counts (bookings, revenue, patients, doctors).

3. **Add a new doctor:**
   - Go to `/admin/doctors`.
   - Click "Add Doctor".
   - Fill in name, email, phone, bio, specializations.
   - Verify success toast.
   - Verify welcome email sent to doctor.

4. **Verify doctor can log in:**
   - Use the doctor's emailed credentials.
   - Verify doctor can log in and is redirected to `/doctor`.

5. **Edit doctor profile from admin:**
   - Go to `/admin/doctors/[id]`.
   - Edit name, phone, bio, or specializations.
   - Verify changes save.

6. **Set doctor availability from admin:**
   - Go to `/admin/doctors/[id]` (Availability tab).
   - Set availability for a day (e.g., Monday 09:00–17:00, 60min sessions).
   - Verify slots appear on `/book` for that day.

7. **View All Appointments:**
   - Go to `/admin/appointments`.
   - Verify all bookings appear on the master calendar.

8. **Apply doctor filter:**
   - Select a doctor from the dropdown.
   - Verify only that doctor's bookings show.

9. **Cancel a booking from admin:**
   - Click a booking event.
   - Click "Cancel Booking".
   - Verify no 24hr restriction (can cancel any booking).
   - Verify patient receives cancellation email.

10. **Add a staff member:**
    - Go to `/admin/staff`.
    - Click "Add Staff".
    - Fill in name, email, phone.
    - Assign permissions: `APPOINTMENTS READ` only.
    - Verify success toast.

11. **Verify staff permissions:**
    - Log in as the new staff member.
    - Verify they can only see "All Appointments" in the sidebar (not Doctors, Patients, etc.).

12. **Verify staff cannot access `/admin/doctors`:**
    - Try to navigate to `/admin/doctors`.
    - Verify 403 error or redirect.

13. **Edit staff permissions:**
    - Log back in as admin.
    - Go to `/admin/staff`.
    - Edit the staff member to add `DOCTORS READ` permission.
    - Verify success toast.

14. **Re-verify staff permissions:**
    - Log in as the staff member again.
    - Verify they can now see "Manage Doctors" in the sidebar.

15. **View All Appointments as staff:**
    - Go to `/admin/appointments`.
    - Verify all bookings are visible.

16. **Go to Manage Patients:**
    - Verify patient list and detail page work.

17. **Go to Manage Payments:**
    - Verify all transactions appear with correct totals.

18. **Go to Settings:**
    - Update session price.
    - Verify new price appears in the booking flow (test with a new booking).

19. **Verify payment gateway keys are masked:**
    - Go to `/admin/settings`.
    - Verify keys show as `****abcd` (not full value).

**Edge Cases:**
- Try to deactivate the seed admin (verify error message).
- Try to access `/admin` as a patient or doctor (verify redirect).

---

### Security Tests

**Test each scenario and verify the expected behavior:**

| Test | Expected Result |
|---|---|
| Patient accesses `/doctor` | Redirect to `/dashboard` or 403 |
| Patient accesses `/admin` | Redirect to `/dashboard` or 403 |
| Doctor accesses `/admin` | Redirect to `/doctor` or 403 |
| Staff without PATIENTS READ calls `GET /api/admin/patients` | 403 |
| Unauthenticated user calls `/api/patient/appointments` | 401 |
| Unauthenticated user calls `/api/doctor/bookings` | 401 |
| Unauthenticated user calls `/api/admin/overview` | 401 |
| Patient fetches another patient's appointments by changing booking ID in URL | 403 |
| Patient accesses another patient's session room | 403 |
| Doctor fetches another doctor's bookings | 403 |
| Payment webhook rejects requests with invalid signature | 400 |
| Booking a slot that was just taken by another patient | 400 |
| JWT tampered token is rejected and cookie is cleared | 401 |
| Password reset token expires after 1 hour | 400 (link expired) |
| Deactivated account cannot log in | 403 |

---

### Email Tests

**Test each email trigger and verify the email arrives with correct content:**

| Trigger | Recipient | Expected Email |
|---|---|---|
| Registration | Patient | Verification email with correct link |
| Password reset | Patient | Reset email with correct link (expires after 1 hour) |
| Booking confirmation | Patient | Confirmation email with correct details (doctor, date, time, service) |
| Booking confirmation | Doctor | Notification email with correct details |
| Cancellation (patient-initiated) | Patient | Cancellation email with correct details |
| Cancellation (admin-initiated) | Patient | Cancellation email with correct details |
| Doctor account created | Doctor | Welcome email with login credentials |
| Staff account created | Staff | Welcome email with login credentials |
| Session reminder (if implemented) | Patient + Doctor | Reminder email 24hr before session |

**Verification:**
- Check sender name is "Tawasul Academy".
- Check sender email is the verified domain (not `noreply@resend.dev`).
- Check email content includes all relevant details.
- Check links work (e.g., verification link, reset link).

---

### Mobile Responsiveness Tests (375px Viewport)

**Test each page and verify it is usable on mobile:**

| Page | Expected Behavior |
|---|---|
| Home page | All sections readable, CTA buttons usable |
| Experts listing | Usable, doctor cards readable |
| Expert profile | Expert profile and Book Now button reachable |
| Booking calendar | Navigable, dates clickable |
| Slot selection | Usable, slots clickable |
| Patient dashboard sidebar | Collapses to bottom nav |
| Appointments cards | Readable, buttons usable |
| Payments table | Collapses to card list |
| Doctor dashboard sidebar | Collapses to bottom nav |
| Doctor calendar | Navigable (default to day view on mobile) |
| Admin dashboard sidebar | Collapses to bottom nav |
| Admin tables | Scroll horizontally |
| Permission builder modal | Scrollable on mobile |

---

### Bug Priority

**Critical (fix before deploy):**
- Payment flow broken (cannot complete payment).
- Booking not confirming after payment.
- Emails not sending.
- Auth bypass (wrong role accessing wrong dashboard).
- Data leaking between users (e.g., patient sees another patient's data).
- Session room accessible without valid booking or outside time window.

**High (fix before deploy if time allows):**
- Calendar not loading availability correctly.
- Doctor availability not reflecting on `/book`.
- Mobile layout broken on a key page (e.g., booking flow unusable).

**Medium (first post-launch patch):**
- UI inconsistencies (e.g., button colors, spacing).
- Missing loading states.
- Minor validation gaps (e.g., phone number format).

---

## Track 2 — Production Deploy

---

### Step 1 — Nginx Config

**Action:** Create Nginx configuration files.

**Files to Create:**
1. **`nginx/nginx.conf`:**
   ```nginx
   user  nginx;
   worker_processes  auto;
   error_log  /var/log/nginx/error.log warn;
   pid        /var/run/nginx.pid;
   
   events {
       worker_connections  1024;
   }
   
   http {
       include       /etc/nginx/mime.types;
       default_type  application/octet-stream;
       
       log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                         '$status $body_bytes_sent "$http_referer" '
                         '"$http_user_agent" "$http_x_forwarded_for"';
       
       access_log  /var/log/nginx/access.log  main;
       
       sendfile        on;
       keepalive_timeout  65;
       
       include /etc/nginx/conf.d/*.conf;
   }
   ```

2. **`nginx/conf.d/tawasul.conf`:**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;
       return 301 https://$host$request_uri;
   }
   
   server {
       listen 443 ssl;
       server_name yourdomain.com www.yourdomain.com;
       
       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
       include /etc/letsencrypt/options-ssl-nginx.conf;
       ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
       
       location / {
           proxy_pass http://app:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
       
       # Cache static assets
       location /_nuxt/ {
           proxy_pass http://app:3000;
           proxy_cache_valid 200 1y;
           proxy_cache_valid 404 1m;
           add_header Cache-Control "public, max-age=31536000, immutable";
       }
       
       # Client max body size for file uploads
       client_max_body_size 10M;
       
       # Gzip compression
       gzip on;
       gzip_proxied any;
       gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
   }
   ```

**Notes:**
- Replace `yourdomain.com` with the actual domain.
- The config must:
  - Listen on port 80, redirect all HTTP → HTTPS.
  - Listen on port 443 with SSL certs from Certbot.
  - Proxy all requests to the Nuxt app on port 3000.
  - Set headers: `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`.
  - Client max body size: 10MB (for photo uploads).
  - Enable gzip for text, CSS, JS, JSON.
  - Cache headers for `/_nuxt/` path: `max-age 1 year, immutable`.

---

### Step 2 — VPS Setup

**Action:** Set up the Ubuntu 22.04 VPS.

**Steps:**
1. **Update system:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install Docker:**
   - Follow official Docker docs for Ubuntu:
     ```bash
     sudo apt install -y ca-certificates curl gnupg
     sudo install -m 0755 -d /etc/apt/keyrings
     curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
     sudo chmod a+r /etc/apt/keyrings/docker.gpg
     echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
     sudo apt update
     sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
     ```

3. **Install Docker Compose plugin:**
   - Already included in Docker CE for Ubuntu 22.04.

4. **Install Git:**
   ```bash
   sudo apt install -y git
   ```

5. **Create non-root user:**
   ```bash
   sudo adduser tawasul
   sudo usermod -aG docker tawasul
   ```

6. **Switch to tawasul user:**
   ```bash
   su - tawasul
   ```

7. **Clone repo:**
   ```bash
   git clone [repo-url] /var/www/tawasul
   cd /var/www/tawasul
   ```

8. **Create `.env.prod`:**
   - Copy `.env.example` to `.env.prod`.
   - Fill in production values:
     ```env
     NODE_ENV=production
     APP_URL=https://yourdomain.com
     DATABASE_URL=postgresql://tawasul:tawasul_pass@postgres:5432/tawasul_db
     JWT_SECRET=[generate with openssl rand -base64 32]
     RESEND_API_KEY=[real key]
     RESEND_FROM_EMAIL=noreply@yourdomain.com
     RESEND_FROM_NAME=Tawasul Academy
     PAYMENT_GATEWAY=paymob  # or stripe
     PAYMOB_API_KEY=[real key]
     PAYMOB_INTEGRATION_ID=[real id]
     PAYMOB_HMAC_SECRET=[real secret]
     # OR for Stripe:
     STRIPE_PUBLISHABLE_KEY=[real key]
     STRIPE_SECRET_KEY=[real key]
     STRIPE_WEBHOOK_SECRET=[real secret]
     JITSI_DOMAIN=meet.jit.si
     UPLOAD_PATH=/var/www/tawasul/uploads
     SEED_ADMIN_EMAIL=admin@yourdomain.com
     SEED_ADMIN_PASSWORD=[secure password]
     SEED_ADMIN_NAME=Platform Admin
     ```
   - **Never commit `.env.prod` to Git.**

---

### Step 3 — SSL Certificate

**Action:** Issue SSL certificate with Certbot.

**Steps:**
1. **Point domain DNS A record to VPS IP.**
   - Wait for DNS propagation (use `dig +short yourdomain.com` to verify).

2. **Run Certbot standalone:**
   ```bash
   sudo docker run --rm -p 80:80 \
     -v /etc/letsencrypt:/etc/letsencrypt \
     certbot/certbot certonly --standalone \
     --email your@email.com --agree-tos --no-eff-email \
     -d yourdomain.com -d www.yourdomain.com
   ```

3. **Set up auto-renewal:**
   - Create `/etc/letsencrypt/cli.ini` with:
     ```ini
     email = your@email.com
     agree-tos = true
     no-eff-email = true
     ```
   - Add cron job:
     ```bash
     sudo crontab -e
     ```
     Add:
     ```cron
     0 12 * * * docker run --rm -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot renew --quiet --config /etc/letsencrypt/cli.ini
     ```

---

### Step 4 — Database Setup

**Action:** Start PostgreSQL and apply migrations/seed.

**Steps:**
1. **Start postgres only:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d postgres
   ```

2. **Wait for healthcheck:**
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
   Wait until postgres shows `healthy`.

3. **Run migrations:**
   ```bash
   docker compose -f docker-compose.prod.yml run --rm app npx prisma db push
   ```

4. **Run seed:**
   ```bash
   docker compose -f docker-compose.prod.yml run --rm app npx prisma db seed
   ```

---

### Step 5 — Start Full Stack

**Action:** Start all production containers.

**Steps:**
1. **Start all services:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

2. **Verify containers:**
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
   Expected containers:
   - `tawasul_postgres` (healthy)
   - `tawasul_app` (running)
   - `tawasul_nginx` (running)
   - `tawasul_certbot` (exited, but available for renewal)

3. **Check app logs:**
   ```bash
   docker compose -f docker-compose.prod.yml logs -f app
   ```

---

### Step 6 — Post-Deploy Verification

**Verify each item:**

| Check | Expected Result |
|---|---|
| Site accessible at `https://yourdomain.com` | Site loads without errors |
| HTTP redirects to HTTPS | `http://yourdomain.com` redirects to `https://yourdomain.com` |
| Registration and email verification work | New patient can register and verify email |
| Login and role redirect work | Patients → `/dashboard`, Doctors → `/doctor`, Staff → `/admin` |
| Booking flow works end-to-end | Can book, pay, and receive confirmation |
| Real payment completes | Use minimum amount for test, verify webhook fires |
| Confirmation email arrives | From verified Resend domain |
| Doctor dashboard accessible | `/doctor` loads with calendar |
| Admin dashboard accessible | `/admin` loads with overview |
| Photo uploads persist | Upload a photo, restart container, verify photo still exists |
| pgAdmin not accessible | Port 5050 not exposed to public |

---

### Step 7 — Monitoring

**Action:** Set up monitoring for the production site.

**Steps:**
1. **Sign up at UptimeRobot:**
   - Go to [https://uptimerobot.com](https://uptimerobot.com).
   - Sign up for free account.

2. **Add HTTP monitor:**
   - Monitor URL: `https://yourdomain.com`
   - Check interval: Every 5 minutes
   - Set email alert for downtime.

3. **Configure Docker restart policy:**
   - Already set to `unless-stopped` in `docker-compose.prod.yml`.

4. **Monitor logs:**
   - For first 24 hours, monitor logs:
     ```bash
     docker compose -f docker-compose.prod.yml logs -f
     ```

---

## Notes for the AI

- **Never commit `.env.prod` to Git.**
- **The production Dockerfile is multi-stage** — verify it builds correctly locally before pushing to VPS.
- **Photo uploads volume** must be mounted to the same path defined in `UPLOAD_PATH` — verify this in `docker-compose.prod.yml`.
- **PostgreSQL port must not be exposed** in production — only accessible within the Docker network.
- **Run `prisma db push` not `prisma migrate`** for MVP (simpler for initial setup).
- **First real payment on production:** Use the minimum chargeable amount. Confirm webhook fires, booking confirms, email arrives — then announce the platform.
- **Seed admin password:** Keep in a secure location (password manager) — it cannot be recovered from the database (only the hash is stored).
- **DNS propagation:** Can take up to 48 hours. Use `dig` to verify before running Certbot.
- **Certbot renewal:** Test renewal manually before relying on cron:
  ```bash
  docker compose -f docker-compose.prod.yml run --rm certbot renew --dry-run
  ```
