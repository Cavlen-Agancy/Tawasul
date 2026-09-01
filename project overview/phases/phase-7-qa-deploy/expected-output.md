# Phase 7 — QA & Production Deploy
## expected-output.md

---

## QA Deliverables

### Test Plans

| Test Plan | Description | Status |
|---|---|---|
| Patient Flow Test Plan | 19-step test for complete patient journey | Complete |
| Doctor Flow Test Plan | 11-step test for complete doctor journey | Complete |
| Admin Flow Test Plan | 19-step test for complete admin journey | Complete |
| Security Test Plan | 12 tests for auth bypass, data leakage, etc. | Complete |
| Email Test Plan | 8 tests for all email triggers | Complete |
| Mobile Responsiveness Test Plan | 12 tests for 375px viewport | Complete |

---

### Bug Reports

**Critical Bugs (must fix before deploy):**
| ID | Description | Status | Fixed In |
|---|---|---|---|
| (Example) | Payment webhook not firing | Fixed | Phase 3 |
| (Example) | Patient can access another patient's appointments | Fixed | Phase 4 |

**High-Priority Bugs (fix before deploy if time allows):**
| ID | Description | Status | Fixed In |
|---|---|---|---|
| (Example) | Calendar not showing available dates | Fixed | Phase 3 |

**Medium-Priority Bugs (first post-launch patch):**
| ID | Description | Status | Fixed In |
|---|---|---|---|
| (Example) | Missing loading state on booking page | Open | Phase 7 |

---

## Deploy Deliverables

### Infrastructure

| Item | Description | Status |
|---|---|---|
| VPS | Ubuntu 22.04 server with Docker | Ready |
| Domain | Pointed to VPS IP with A records | Ready |
| SSL Certificate | Let's Encrypt via Certbot | Ready |
| Docker Containers | postgres, app, nginx, certbot | Ready |
| Volumes | postgres_data, uploads_data, certbot_certs | Ready |

---

### Config Files

| File | Purpose | Status |
|---|---|---|
| `nginx/nginx.conf` | Nginx main config | Created |
| `nginx/conf.d/tawasul.conf` | Tawasul reverse proxy config | Created |
| `.env.prod` | Production environment variables | Created (not committed) |
| `docker-compose.prod.yml` | Production Docker Compose | Copied from Phase 0 |
| `Dockerfile.prod` | Production Dockerfile | Copied from Phase 0 |

---

### Monitoring

| Item | Description | Status |
|---|---|---|
| UptimeRobot Monitor | HTTP check every 5 minutes | Active |
| Docker Restart Policy | `unless-stopped` for all containers | Configured |
| Log Monitoring | First 24 hours of logs reviewed | Complete |

---

## What the Project is Ready For

After Phase 7, the Tawasul Academy platform is:

1. **Fully Tested:**
   - All user flows (patient, doctor, admin) tested end-to-end.
   - All security tests passed.
   - All email triggers verified.
   - Mobile responsiveness confirmed.

2. **Production-Ready:**
   - Deployed on a VPS with HTTPS.
   - Database seeded with admin account.
   - All services running in Docker containers.
   - Monitoring in place.

3. **Live:**
   - Accessible at `https://yourdomain.com`.
   - Ready for real users to register, book, and attend sessions.

---

## Post-Deploy Tasks (Optional)

These are not part of Phase 7 but may be done after launch:

- Set up automated backups for PostgreSQL.
- Configure CI/CD for future updates.
- Set up analytics (e.g., Google Analytics, Plausible).
- Implement logging to a centralized service (e.g., Sentry, Papertrail).
- Set up database monitoring (e.g., pgBadger).

---

## Rollback Plan

If deployment fails:

1. **Revert to previous Docker image:**
   - Tag all production images with version numbers.
   - Roll back to the previous tag.

2. **Restore database backup:**
   - Take a backup before migrations/seed:
     ```bash
     docker compose -f docker-compose.prod.yml exec postgres pg_dump -U tawasul tawasul_db > backup.sql
     ```
   - Restore with:
     ```bash
     docker compose -f docker-compose.prod.yml exec postgres psql -U tawasul tawasul_db < backup.sql
     ```

3. **Switch to maintenance mode:**
   - Update Nginx config to serve a maintenance page.
   - Reload Nginx:
     ```bash
     docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
     ```
