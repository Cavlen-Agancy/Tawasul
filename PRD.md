# Product Requirements Document (PRD)

## Tawasul Academy — Online Mental Health Counseling Platform

| Field              | Value                                      |
|--------------------|--------------------------------------------|
| **Product Name**   | Tawasul Academy                            |
| **Version**        | 1.0 (MVP)                                  |
| **Date**           | September 2026                             |
| **Status**         | In Development                             |
| **Prepared For**   | Business & Engineering Stakeholders        |

---

## 1. Executive Summary

Tawasul Academy (تواصل — "connection") is a **web-based mental health counseling platform** that enables patients to discover licensed therapists, book paid video sessions, and receive ongoing care — all from a single portal. The platform serves three distinct user roles: **Patients**, **Doctors (Therapists)**, and **Admin/Staff**, each with tailored dashboards and workflows.

The MVP targets the Arabic-speaking market with an emphasis on a warm, calming user experience appropriate for mental health services. Revenue is generated through a per-session booking fee processed via integrated payment gateways.

---

## 2. Business Objectives

| # | Objective                                | Success Metric                                       |
|---|------------------------------------------|------------------------------------------------------|
| 1 | Provide accessible online therapy        | Patients can book & attend sessions within 5 minutes |
| 2 | Generate session-based revenue           | Payment flow completes end-to-end with <2% failure   |
| 3 | Reduce admin operational overhead        | Admins can assign doctors to bookings in <30 seconds |
| 4 | Build patient trust & retention          | Patients can view history, manage profile, cancel     |
| 5 | Scale therapist onboarding               | Doctors can be added/managed via admin panel          |

---

## 3. Target Users & Personas

### 3.1 Patient (End User)
- **Who:** Individuals seeking mental health counseling.
- **Needs:** Easy booking, secure payment, private video sessions, session history.
- **Pain Points:** Stigma, complexity of finding therapists, opaque pricing, long wait times.
- **Goal:** Book a session, pay, and join a video call with minimal friction.

### 3.2 Doctor / Therapist
- **Who:** Licensed mental health professionals.
- **Needs:** Clear schedule visibility, patient session access, professional profile.
- **Pain Points:** Manual scheduling, no-shows, administrative burden.
- **Goal:** Focus on patient care; platform handles logistics.

### 3.3 Admin / Staff
- **Who:** Platform operators managing day-to-day operations.
- **Needs:** Oversee bookings, manage doctor assignments, control availability, process settings.
- **Pain Points:** Manual coordination, lack of visibility into bookings and payments.
- **Goal:** Efficiently manage the platform with full operational control.

---

## 4. Scope

### 4.1 In Scope (MVP)

| Feature Area              | Description                                                                 |
|---------------------------|-----------------------------------------------------------------------------|
| **Authentication**        | Registration (patients), login (all roles), email verification, password reset, JWT-based sessions |
| **Patient Dashboard**     | View/book/cancel appointments, payment history, profile management, session room access |
| **Booking System**        | Calendar-based slot selection, availability driven by admin schedule, 24-hour cancellation policy |
| **Payment Processing**    | Paymob (primary) & Stripe (alternative) integration, webhook confirmation, dev mock mode |
| **Admin Dashboard**       | Appointment oversight, pending booking triage, doctor assignment, schedule & blocked-date management, settings |
| **Video Sessions**        | Jitsi-powered video calls with time-windowed access (5 min before, 15 min after scheduled time) |
| **Email Notifications**   | Transactional emails: verification, password reset, booking confirmation, reminders |
| **Role-Based Access**     | Granular permissions for staff; route-level guards for patient/doctor/admin areas |

### 4.2 Out of Scope (Post-MVP)

| Feature Area              | Planned For     |
|---------------------------|-----------------|
| Doctor Dashboard          | Phase 5         |
| Mobile apps (iOS/Android) | Phase 8+        |
| In-app chat / messaging   | Future          |
| Insurance integration     | Future          |
| Multi-language support    | Future          |
| Self-hosted Jitsi         | Production      |
| Doctor self-scheduling    | Future          |
| Patient reviews/ratings   | Future          |
| Analytics & reporting     | Future          |

---

## 5. User Flows

### 5.1 Patient — Book a Session
```
Landing Page → Register / Login
  → Browse Available Dates (calendar)
    → Select Date → View Available Time Slots
      → Confirm Booking
        → Redirect to Payment Gateway
          → Payment Success → Confirmation Email
            → Session appears in "My Appointments"
              → Join Video Call (5 min before session)
```

### 5.2 Patient — Cancel a Session
```
Dashboard → My Appointments
  → Select Upcoming Booking
    → Click Cancel
      → Confirmation Dialog (24-hour rule enforced)
        → Booking Status → CANCELLED
          → Refund initiated (if applicable)
```

### 5.3 Admin — Assign Doctor to Booking
```
Admin Dashboard → Appointments
  → View Pending Bookings Tab
    → Select Unassigned Booking
      → Open Assign Doctor Modal
        → Choose Available Doctor
          → Confirm Assignment
            → Booking Status → CONFIRMED
              → Confirmation email sent to patient
```

### 5.4 Admin — Manage Availability
```
Admin Dashboard → Settings → Schedule
  → View / Add / Edit / Delete working hours
  → Manage blocked dates (holidays, maintenance)
    → Changes reflected immediately in patient booking calendar
```

---

## 6. Functional Requirements

### 6.1 Authentication & User Management

| ID     | Requirement                                                              | Priority |
|--------|--------------------------------------------------------------------------|----------|
| AU-01  | Patients can self-register with email, name, phone, and password         | P0       |
| AU-02  | Email verification required before full access                           | P0       |
| AU-03  | Login for all roles via email + password                                  | P0       |
| AU-04  | Forgot/reset password flow via email                                      | P0       |
| AU-05  | Role-based route protection (patient, doctor, admin)                     | P0       |
| AU-06  | JWT stored in httpOnly cookies (not accessible to JS)                    | P0       |
| AU-07  | Admin/Staff have granular permission system (per-resource + action)       | P1       |
| AU-08  | Account activation/deactivation managed by admin                         | P1       |

### 6.2 Booking System

| ID     | Requirement                                                              | Priority |
|--------|--------------------------------------------------------------------------|----------|
| BK-01  | Patients view available dates on a calendar (admin-defined schedule)     | P0       |
| BK-02  | Patients select a date and view available time slots                     | P0       |
| BK-03  | Booking created with PENDING status until doctor assigned                | P0       |
| BK-04  | 24-hour cancellation policy enforced (no cancellation within 24h)        | P0       |
| BK-05  | Admin-controlled blocked dates excluded from patient calendar            | P0       |
| BK-06  | Doctor-specific blocked slots excluded from availability                | P1       |
| BK-07  | Booking confirmation sent via email                                      | P0       |

### 6.3 Payment Processing

| ID     | Requirement                                                              | Priority |
|--------|--------------------------------------------------------------------------|----------|
| PY-01  | Paymob integration as default payment gateway                            | P0       |
| PY-02  | Stripe integration as configurable alternative                           | P1       |
| PY-03  | Webhook-based payment confirmation (no client-side trust)                | P0       |
| PY-04  | Dev/mock payment mode for local development                              | P1       |
| PY-05  | Payment record linked to booking and patient                              | P0       |
| PY-06  | Failed payment handling with clear user feedback                         | P0       |

### 6.4 Patient Dashboard

| ID     | Requirement                                                              | Priority |
|--------|--------------------------------------------------------------------------|----------|
| PT-01  | "My Appointments" — calendar view of upcoming and past sessions          | P0       |
| PT-02  | "My Payments" — payment history with status and amount                   | P0       |
| PT-03  | Profile management (name, phone, photo)                                  | P0       |
| PT-04  | Session room access (video call link)                                    | P0       |
| PT-05  | Time-windowed session access: 5 min before to 15 min after               | P0       |

### 6.5 Admin Dashboard

| ID     | Requirement                                                              | Priority |
|--------|--------------------------------------------------------------------------|----------|
| AD-01  | Overview with key statistics (bookings, revenue, doctors)                | P0       |
| AD-02  | Appointments page with pending bookings triage                          | P0       |
| AD-03  | Assign doctor to pending bookings                                       | P0       |
| AD-04  | Master calendar view of all bookings                                     | P1       |
| AD-05  | Schedule management (create/edit/delete working hours)                   | P0       |
| AD-06  | Blocked date management (add/remove holidays/closures)                   | P0       |
| AD-07  | Platform settings (payment gateway, pricing, session duration)           | P0       |
| AD-08  | Doctor list management (view, activate/deactivate)                      | P1       |

### 6.6 Video Sessions

| ID     | Requirement                                                              | Priority |
|--------|--------------------------------------------------------------------------|----------|
| VS-01  | Jitsi-based video calls embedded in the platform                        | P0       |
| VS-02  | Time-windowed access (5 min before, 15 min after scheduled time)         | P0       |
| VS-03  | Meeting room tied to specific booking                                    | P0       |
| VS-04  | Session lobby with booking details before joining                        | P1       |

### 6.7 Email Notifications

| ID     | Requirement                                                              | Priority |
|--------|--------------------------------------------------------------------------|----------|
| EM-01  | Email verification on registration                                      | P0       |
| EM-02  | Password reset email                                                     | P0       |
| EM-03  | Booking confirmation email                                               | P0       |
| EM-04  | Booking cancellation email                                               | P1       |
| EM-05  | Payment confirmation email                                               | P1       |

---

## 7. Non-Functional Requirements

### 7.1 Security
- Passwords hashed with bcrypt (12 rounds).
- JWT tokens stored in httpOnly, secure cookies.
- CSRF protection on state-changing endpoints.
- Zod validation on all API inputs.
- Role-based authorization checked server-side on every request.

### 7.2 Performance
- Page load < 3 seconds on 3G connection.
- Calendar availability fetched in < 500ms.
- Payment webhook processed in < 2 seconds.
- SSR enabled for SEO and initial load performance.

### 7.3 Reliability
- Payment webhooks are idempotent (safe to retry).
- Database migrations versioned via Prisma.
- Graceful error handling with user-friendly messages.

### 7.4 Scalability
- Docker-based deployment (PostgreSQL + Nginx + Certbot).
- Horizontal scaling possible via container orchestration.
- Database connection pooling via Prisma.

### 7.5 Accessibility
- WCAG 2.1 AA compliance target.
- Semantic HTML with ARIA labels.
- Keyboard-navigable interface.
- Responsive design (mobile-first).

---

## 8. Technical Architecture (High Level)

```
┌──────────────┐     ┌──────────────────────────────────────┐
│   Browser    │────▶│         Nuxt 3 (SSR + Client)        │
│  (Patient)   │◀────│  Vue 3 · TypeScript · Tailwind CSS   │
└──────────────┘     └──────────────┬───────────────────────┘
                                    │
                                    ▼
                      ┌──────────────────────────┐
                      │     Nitro Server Engine   │
                      │   API Routes (REST)       │
                      │   Middleware (JWT Auth)    │
                      └──────┬───────┬────────────┘
                             │       │
              ┌──────────────┘       └──────────────┐
              ▼                                      ▼
   ┌──────────────────┐                ┌──────────────────┐
   │    PostgreSQL     │                │   External APIs   │
   │   (Prisma ORM)   │                │ Paymob / Stripe   │
   │  Users, Bookings │                │ Resend (Email)    │
   │  Payments, etc.  │                │ Jitsi (Video)     │
   └──────────────────┘                └──────────────────┘
```

---

## 9. Database Summary

| Model              | Purpose                                                     |
|--------------------|-------------------------------------------------------------|
| **User**           | Unified auth for patients, doctors, and staff               |
| **Permission**     | Granular per-resource/action permissions for staff          |
| **Doctor**         | Therapist profile (bio, specializations, slug)              |
| **Availability**   | Doctor working hours (reserved for future use)              |
| **BlockedSlot**    | Doctor-specific blocked time                                |
| **AdminSchedule**  | Global admin-controlled booking availability                |
| **GlobalBlockedDate** | Admin-controlled blocked calendar dates                  |
| **Booking**        | Appointment records (status, patient, doctor, schedule)     |
| **Payment**        | Transaction records linked to bookings                      |
| **SessionRoom**    | Jitsi meeting room metadata                                 |
| **Settings**       | Singleton config (payment gateway, pricing, hours)          |

---

## 10. Project Phases & Timeline

| Phase | Name                    | Duration  | Status        |
|-------|-------------------------|-----------|---------------|
| 0     | Project Setup           | Days 1-2  | Complete      |
| 1     | Authentication          | Days 3-7  | Complete      |
| 2     | Marketing Pages         | Days 8-12 | Partial       |
| 3     | Booking & Payment       | Days 13-20| Complete      |
| 4     | Patient Dashboard       | Days 21-28| Complete      |
| 5     | Doctor Dashboard        | Days 29-34| Not Started   |
| 6     | Admin Dashboard         | Days 35-40| Partial       |
| 7     | QA & Deployment         | Days 41-45| Not Started   |

---

## 11. Current Status & Known Issues

### Completed
- Full authentication flow with role-based access
- Patient booking calendar driven by admin schedule
- Payment integration (Paymob/Stripe) with webhook confirmation
- Patient dashboard (appointments, payments, profile, session room)
- Admin dashboard (appointments, schedule management, settings)
- 187 passing tests (unit + integration)
- Production build verified

### In Progress
- Admin dashboard frontend has endpoint mismatch issues (composable calls vs. actual routes)
- Video session (Jitsi) not fully functional for real calls
- Marketing/landing pages are placeholders

### Not Started
- Doctor dashboard (Phase 5)
- Production deployment (Phase 7)

---

## 12. Success Metrics (Post-Launch)

| Metric                        | Target              |
|-------------------------------|---------------------|
| Session booking completion    | > 90%               |
| Payment success rate          | > 98%               |
| Average booking time          | < 3 minutes         |
| Patient return rate (30 days) | > 40%               |
| Admin assignment time         | < 30 seconds        |
| System uptime                 | > 99.5%             |
| Page load time (p95)          | < 3 seconds         |

---

## 13. Risks & Mitigations

| Risk                                  | Impact | Mitigation                                       |
|---------------------------------------|--------|--------------------------------------------------|
| Payment gateway downtime              | High   | Stripe fallback; retry logic; clear error states |
| Jitsi service instability             | High   | Self-hosted Jitsi planned for production         |
| Data breach / PHI exposure            | Critical| HTTPS everywhere; httpOnly cookies; hashing     |
| Low adoption in target market         | Medium | Warm UI; easy onboarding; referral features       |
| Admin-doctor assignment bottleneck    | Medium | Automate assignment rules in future phases        |

---

## 14. Open Questions

1. Should the platform support group therapy sessions in v2?
2. What is the refund policy for cancellations within 24 hours?
3. Should doctors be able to set their own availability in a future phase?
4. Is multi-currency support needed for international patients?
5. Should session recordings be supported (with consent)?

---

## Appendix

### A. Tech Stack Summary
- **Frontend:** Nuxt 3, Vue 3, TypeScript, Tailwind CSS, shadcn-vue, FullCalendar
- **Backend:** Nitro (Nuxt server), Prisma ORM, PostgreSQL
- **Auth:** JWT (httpOnly cookies), bcryptjs
- **Email:** Resend
- **Payments:** Paymob (primary), Stripe (alternative)
- **Video:** Jitsi (meet.jit.si for MVP)
- **Infra:** Docker, Docker Compose, Nginx, Certbot

### B. Project Root
`/run/media/abdelrhman/ce5c2321-cae0-41d0-8d0b-4f69e26612db/ahmed projects/Tawasul`
