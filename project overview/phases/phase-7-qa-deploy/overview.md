# Phase 7 — QA & Production Deploy
## overview.md

---

## Goal

Phase 7 verifies the entire Tawasul Academy platform works correctly across all roles, fixes all critical bugs, and deploys to a production VPS. After this phase, the platform is live and accessible on a real domain over HTTPS. This phase is divided into two parallel tracks:

- **Track 1 — QA:** Test every flow across all roles (patient, doctor, admin). Fix all critical and high-priority bugs before going live.
- **Track 2 — Deploy:** Prepare production Docker setup, configure VPS, deploy.

**Do not deploy until Track 1 is complete.**

---

## Scope

### Track 1 — QA
- **Patient Flow:** Complete journey from registration to session completion.
- **Doctor Flow:** Complete journey from account creation to session completion.
- **Admin Flow:** Complete journey for all admin tasks (overview, bookings, doctors, patients, payments, staff, settings).
- **Security Tests:** 12+ tests for auth bypass, data leakage, session access, etc.
- **Email Tests:** 8+ tests for all email triggers.
- **Mobile Responsiveness Tests:** 12+ tests for all pages on 375px viewport.
- **Bug Fixes:** Fix all critical and high-priority bugs before deploy.

### Track 2 — Production Deploy
- **Nginx Config:** Reverse proxy with SSL, gzip, caching headers.
- **VPS Setup:** Ubuntu 22.04 with Docker, Docker Compose, Git, non-root user.
- **SSL Certificate:** Certbot for Let's Encrypt certificates.
- **Database Setup:** PostgreSQL with migrations and seed.
- **Start Full Stack:** Docker Compose production setup.
- **Post-Deploy Verification:** 10+ checks for live site functionality.
- **Monitoring:** UptimeRobot for HTTP monitoring.

---

## Out of Scope

- New feature development (all features must be complete by Phase 6).
- Major refactoring (only critical bug fixes allowed).
- Non-critical UI polish (unless it affects usability).

---

## Dependencies

**Must exist from Phase 0:**
- All Docker files (`docker-compose.prod.yml`, `Dockerfile.prod`).
- `.env.example` with all production variables.

**Must exist from Phase 1:**
- All auth flows working.

**Must exist from Phase 2:**
- All marketing pages working.

**Must exist from Phase 3:**
- Booking and payment flows working.

**Must exist from Phase 4:**
- Patient dashboard working.

**Must exist from Phase 5:**
- Doctor dashboard working.

**Must exist from Phase 6:**
- Admin dashboard and permission system working.

**External Dependencies:**
- VPS with Ubuntu 22.04 (e.g., DigitalOcean, Linode, AWS Lightsail).
- Domain name with DNS access.
- Resend account with verified domain for production emails.
- Payment gateway account (Paymob or Stripe) with production keys.
- Let's Encrypt for SSL certificates (free).
- UptimeRobot account (free tier).

---

## Stack Used

### QA
- Browser testing (Chrome, Firefox, Safari).
- Mobile emulation (Chrome DevTools 375px viewport).
- Email testing (real inboxes or mailcatcher).
- Payment testing (test cards for Paymob/Stripe).

### Deploy
```
docker: ^24.x
nginx: alpine
certbot: latest
ubuntu: 22.04
```

---

## Folder Structure

```
nginx/
├── nginx.conf              (create)
└── conf.d/
    └── tawasul.conf        (create)

scripts/
└── deploy.sh               (optional, for automation)

.env.prod                  (create, not committed)
```

---

## Key Conventions

- **QA:** Test on staging environment that mirrors production.
- **Deploy:** Follow the exact steps in this document. Do not deviate.
- **Security:** Never commit `.env.prod` to Git. Use `chmod 600` for sensitive files.
- **Monitoring:** Set up alerts for downtime within 5 minutes.
- **Rollback:** Have a rollback plan (e.g., previous Docker image, DB backup).

---

## Notes for the AI

- **Do not deploy until all critical bugs are fixed.**
- **Test with real data:** Use production-like data volumes for QA.
- **Payment testing:** Use the minimum chargeable amount for the first real payment on production.
- **Email testing:** Verify all emails are sent from a verified domain (not `noreply@resend.dev`).
- **Backup:** Take a full DB backup before running migrations or seed on production.
- **Seed admin:** Keep the seed admin password in a secure location (password manager). It cannot be recovered from the database.
- **Docker volumes:** Ensure `uploads` and `postgres_data` volumes are mounted correctly to persist data across container restarts.
