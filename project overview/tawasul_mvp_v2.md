# Tawasul Academy — MVP Scope v2
**Timeline: 45 days**
**UI Library: shadcn-vue**
**Stack: Nuxt 3 + Nitro + Prisma + PostgreSQL + Docker + Resend + Jitsi**

---

## Architecture Updates — Booking System

> This section documents the correction to the booking architecture. Apply start (Track 2) and be reflected in the phase-3 and phase-6 planning docs.

**Problem:** The original design assumed doctors control their own availability (per-doctor `Availability`/`BlockedSlot`), which wrongly made a patient calendar slot unavailable unless a doctor was pre-assigned.

**Correct business model:** The Admin controls the global schedule; a patient slot is available as long as it exists on the global `AdminSchedule` and is not globally blocked. A doctor is assigned only AFTER the patient books.

**Changes:**

1. **Add `AdminSchedule`** (global schedule, admin-controlled): `{ id, dayOfWeek (0-6), startTime, endTime, sessionDuration, isActive, createdAt, updatedAt }`.
2. **Add `GlobalBlockedDate`** (admin-controlled date blocks): `{ id, date (@db.Date), reason?, createdAt }`.
3. **Make `Booking.doctorId` nullable** — a booking is created without a doctor and stays `PENDING` until the admin assigns one.
4. **Add `IN_REVIEW` to `BookingStatus` enum** (reserved for future use; current statuses `PENDING | CONFIRMED | CANCELLED`).

**New flow:** Patient selects slot from global schedule → `PENDING` after payment → Admin assigns a doctor → `CONFIRMED` → patient and doctor receive confirmation emails.

**Availability logic:** New `server/utils/admin-availability.ts` with `getAdminAvailableSlots(date)` and `getAdminAvailableDates(month, year)`, reading from `AdminSchedule`/`GlobalBlockedDate` — NOT from doctor `Availability`. The `Availability` model remains in the schema for doctor calendar display (Phase 5) but is not used in the booking flow.

**Phase changes:**
- Phase 3 (Booking): booking is created without `doctorId`, stays PENDING after payment, sends a "booking received" acknowledgment email (not a confirmation).
- Phase 6 (Admin): new schedule management, blocked dates, and booking assignment workflow (view pending bookings, assign doctor, send confirmation emails).

---

## What We Are Building

A mental health counseling platform where patients book online sessions, pay, and join video calls with doctors. The admin manages everything from a central dashboard with a flexible permission system.

---

## Core (Building Now)

### 1. Marketing Pages

| Page | Included |
|---|---|
| Home | Hero + CTA, Services overview, Experts preview, Testimonials |
| About Us | Who we are, Vision, Mission |
| Services | List of services, Book button per service |
| Our Experts | Expert cards — photo, name, specialization |
| Expert Profile | Bio, services, Book Now button |
| Contact Us | Contact form, WhatsApp, Phone, Email |

---

### 2. Authentication

| Page | Included |
|---|---|
| Register | Patient self-registration — name, email, phone, password |
| Login | All roles — redirect by role after login |
| Forgot Password | Reset link via email |
| Email Verification | Confirm email after registration |

Rules:
- Patients register themselves
- Doctor and staff accounts created by Admin only
- Admin-created accounts skip email verification

---

### 3. Booking Flow

| Step | Included |
|---|---|
| Available Slots | Calendar showing all available times |
| Select Slot | Patient picks a date and time |
| Booking Summary | Date, time, service, price |
| Payment | Online payment via Paymob or Stripe |
| Confirmation | Auto-confirm after payment |
| Emails | Confirmation to patient + notification to doctor |

Rules:
- Patient does not choose a doctor
- Admin assigns doctors to time slots
- No double booking
- Payment must succeed before booking is confirmed

---

### 4. Patient Dashboard

| Page | Included |
|---|---|
| My Appointments | Upcoming + past, cancel button (24hr rule), Join Session button |
| My Payments | Payment history, invoice per session |
| Profile | Name, phone, photo — editable |
| Session Room | Video call + chat, opens 5 min before session only |

---

### 5. Doctor Dashboard

| Page | Included |
|---|---|
| My Profile | Photo, bio, specializations — visible to Admin only |
| My Calendar | Assigned appointments — Month / Week / Day view |
| Session Room | Video call + chat, opens 5 min before session only |

---

### 6. Admin Dashboard

| Page | Included |
|---|---|
| Overview | Total bookings, revenue, active patients, active doctors |
| All Appointments | Master calendar — all bookings, all doctors, cancel any booking |
| Manage Doctors | Add, edit, view doctor profile and calendar |
| Manage Patients | Patient list, session history, contact info |
| Manage Payments | All transactions, filters, revenue totals |
| Manage Staff | Add staff accounts, assign custom permissions per resource |
| Settings | Platform name, contact, payment gateway, session pricing, working hours |

Permission System:

| Resource | Permissions |
|---|---|
| Appointments | Read, Update, Delete |
| Patients | Read |
| Doctors | Create, Read, Update |
| Payments | Read |
| Settings | Read, Update |
| Staff | Create, Read, Update, Delete |

---

### 7. Online Session

| Feature | Included |
|---|---|
| Video Call | Jitsi integration (self-hosted or meet.jit.si) |
| Text Chat | In-session chat panel |
| Time Window | Opens 5 min before, closes 15 min after |
| Patient Entry | From My Appointments page |
| Doctor Entry | From My Calendar page |

---

### 8. Notifications (Email via Resend)

| Trigger | Recipient |
|---|---|
| Registration | Patient — email verification link |
| Password reset | Patient — reset link |
| Booking confirmed | Patient — booking details |
| Booking confirmed | Doctor — new appointment notification |
| Booking cancelled | Patient — cancellation confirmation |
| Session reminder | Patient + Doctor — 24hr before session |
| Doctor account created | Doctor — welcome email with login credentials |

---

## Phase 2 — Structure Ready, Activate Later

| Feature | Notes |
|---|---|
| Blog | Admin-managed articles and categories |
| Recorded Courses | Video content, paid or free, admin-uploaded |
| Live Online Courses | Scheduled sessions, booking required |
| Events (Online) | Registration + online attendance link |
| Events (Offline) | Registration + location info |
| Reschedule | Patient can change appointment time |
| Recurring Bookings | Fixed weekly or monthly slot |
| In-app Notifications | Real-time alerts inside the platform |
| WhatsApp Notifications | Session reminders via WhatsApp |
| Arabic + English | Full i18n support |
| Mobile App | iOS and Android |
| Doctor Earnings Page | Revenue per month for each doctor |
| Patient Notes | Doctor adds private notes after sessions |
| Analytics & Reports | Charts and data export for admin |

---

## What Is Excluded from MVP

| Excluded | Reason |
|---|---|
| Social Login (Google) | Phase 2 |
| Subscription Plans | Phase 2 |
| Session Recording | Phase 2 |
| Refund API Integration | Manual refunds via gateway dashboard for MVP |
| Multi-language | Phase 2 |
| Mobile App | Phase 2 |

---

## 45-Day Timeline

| Days | Phase | Deliverable |
|---|---|---|
| 1 – 3 | Phase 0 | Project setup, Docker, Prisma, shadcn-vue, Resend, Jitsi config |
| 4 – 8 | Phase 1 | Authentication — register, login, verify, reset |
| 9 – 13 | Phase 2 | Marketing pages — all 6 pages |
| 14 – 20 | Phase 3 | Booking flow + payment integration |
| 21 – 25 | Phase 4 | Patient dashboard |
| 26 – 30 | Phase 5 | Doctor dashboard |
| 31 – 38 | Phase 6 | Admin dashboard + permission system |
| 39 – 42 | Phase 7 | Online session (Daily.co) |
| 43 – 45 | Phase 8 | QA + production deploy |

---

Tawasul Academy — MVP Scope v2.0
