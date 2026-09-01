# Tawasul Academy — Sitemap v2
> Updated based on revised project scope

---

## Platform Structure

| Section | Audience |
|---|---|
| Marketing Pages | Public visitors |
| Auth Pages | All roles |
| Booking Flow | Patient |
| Patient Dashboard | Patient |
| Doctor Dashboard | Doctor |
| Admin Dashboard | Admin + Staff (permission-based) |

---

## 1. Marketing Pages (Public)

| Page | Key Content |
|---|---|
| Home | Hero + CTA, Services overview, Experts preview, Testimonials |
| About Us | Who we are, Vision, Mission |
| Services | List of services, each with Book button |
| Our Experts | Expert cards with photo, name, specialization |
| Expert Profile | Bio, services, Book Now button |
| Contact Us | Form, WhatsApp, Phone, Email |

> Blog, Events, Courses — content is ready in structure, will be activated in Phase 2

---

## 2. Auth Pages

| Page | Notes |
|---|---|
| Register | Patient self-registration only |
| Login | All roles enter here, redirect by role after login |
| Forgot Password | Reset via email |
| Email Verification | Confirm email after registration |

> Doctors and staff accounts are created by Admin only — no self-registration

---

## 3. Booking Flow (Patient)

```
Patient clicks Book Now (from any page)
            |
Available slots calendar
(shows all available times across all doctors)
            |
Select a time slot
            |
Booking summary (date, time, price)
            |
Online payment
            |
Auto-confirmation after payment
            |
Confirmation email sent to patient
Notification sent to assigned doctor
```

> The patient does not choose a doctor — the admin assigns doctors to time slots

---

## 4. Patient Dashboard

| Page | Content |
|---|---|
| My Appointments | Upcoming + past bookings, Join Session button (active 5 min before) |
| My Payments | Payment history, invoice per session |
| Profile | Name, phone, photo — editable |
| Session Room | Video call page (accessible 5 min before session only) |

---

## 5. Doctor Dashboard

| Page | Content |
|---|---|
| My Profile | Photo, bio, specializations (visible to Admin only) |
| My Calendar | All assigned appointments — Month / Week / Day view |
| Session Room | Video call page (accessible 5 min before session only) |

---

## 6. Admin Dashboard

| Page | Content |
|---|---|
| Overview | Platform stats — bookings, revenue, patients, doctors |
| All Appointments | Master calendar — all bookings, all doctors, filters |
| Manage Doctors | Add, edit, view doctor profiles and calendars |
| Manage Patients | Patient list, session history, contact info |
| Manage Payments | All transactions, filters, totals |
| Manage Staff | Add staff accounts, assign custom permissions |
| Settings | Platform name, contact info, payment gateway, session pricing, working hours |

### Permission System (Admin)
Admin can create any account and assign permissions per resource:

| Resource | Permissions Available |
|---|---|
| Appointments | Read, Update, Delete |
| Patients | Read |
| Doctors | Create, Read, Update |
| Payments | Read |
| Settings | Read, Update |
| Staff | Create, Read, Update, Delete |

---

## 7. Session Room (Shared)

- Accessible to both patient and doctor
- Opens 5 minutes before the session start time
- Closes 15 minutes after session end time
- Contains: video call + text chat
- Patient enters from My Appointments
- Doctor enters from My Calendar

---

## Phase 2 — Ready to Activate (Structure Built, Content Pending)

| Feature | Type |
|---|---|
| Blog | Articles, categories, admin-managed |
| Recorded Courses | Video content, paid or free |
| Live Online Courses | Scheduled, booking required |
| Events (Online) | Registration + online attendance |
| Events (Offline) | Registration + location info |

---

## User Flows

### Patient
```
Visit site → Browse services or experts
    → Click Book Now → Select time slot
    → Pay → Confirmation email
    → Dashboard → Join Session (5 min before)
```

### Doctor
```
Admin creates account → Login
    → Complete profile
    → View calendar (assigned appointments)
    → Join Session (5 min before)
```

### Admin
```
Login → Overview
    → Add doctors and staff
    → Manage all bookings
    → Assign permissions to staff
    → Configure platform settings
```

---

## Automatic vs Manual

### Automatic
- Booking confirmed after payment
- Confirmation email to patient
- Notification email to doctor
- Session room opens 5 min before session
- Session room closes 15 min after session ends
- Reminder email 24hr before session

### Manual
- Admin adds doctor accounts
- Admin adds staff accounts and sets permissions
- Admin configures session pricing and working hours
- Doctor completes their own profile
- Admin cancels bookings if needed

---

Tawasul Academy — Sitemap v2.0
