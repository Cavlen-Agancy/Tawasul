# Phase 6 — Admin Dashboard & Permission System
## flow.md

---

## Feature 1 — Admin Dashboard Layout

**Action:** Create `modules/admin/layouts/AdminLayout.vue`.

**Frontend Behavior:**
- Extends `layouts/dashboard.vue` (from Phase 0).
- **Sidebar (Desktop):**
  - Width: 240px.
  - Links (show only if user has READ permission for the resource, except Overview):
    - Overview (always visible)
    - All Appointments (requires `APPOINTMENTS READ`)
    - Manage Doctors (requires `DOCTORS READ`)
    - Manage Patients (requires `PATIENTS READ`)
    - Manage Payments (requires `PAYMENTS READ`)
    - Manage Staff (requires `STAFF READ`)
    - Settings (requires `SETTINGS READ`)
    - Logout
  - Use shadcn-vue components for sidebar styling.
- **Mobile:**
  - Bottom navigation bar with icons for the same links (filtered by permissions).
  - Hide desktop sidebar.

**Server Logic:**
- No server logic. Pure frontend component.
- Use `useAuth().hasPermission(resource, 'READ')` to check permissions for sidebar links.

**Edge Cases:**
- User not logged in: Redirect to `/login` (handled by middleware).
- User is not STAFF: Redirect to correct dashboard (handled by middleware).
- User has no permissions: Only Overview and Logout are visible.

---

## Feature 2 — Permission Middleware

**Action:** `server/utils/permissions.ts` was created in Phase 0. Phase 6 begins using it.

**`requirePermission(event: H3Event, resource: Resource, action: Action): Promise<void>`**

**Purpose:** Check if the logged-in STAFF user has the required permission.

**Server Logic:**
1. Call `requireAuth(event, ['STAFF'])` — ensures the user is authenticated and is STAFF.
2. Fetch all `Permission` records from the database for the user:
   ```typescript
   prisma.permission.findMany({
     where: { userId: user.userId, resource, action }
   })
   ```
3. If the result array is empty → throw `createError({ statusCode: 403, message: 'You do not have permission to perform this action' })`.
4. If found, return void (let the route handler continue).

**Edge Cases:**
- User not authenticated: Handled by `requireAuth` (throws 401).
- User not STAFF: Handled by `requireAuth` (throws 403).
- Permission not found: Throws 403.

---

## Feature 3 — API Endpoints

---

### GET /api/admin/overview

**User Action:** Page load for `/admin/overview`.

**Frontend Behavior:**
- Call this endpoint on page load to fetch stats.
- Display stats in shadcn-vue stat cards.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/overview`
- **Auth:** STAFF only (no specific permission required).
- **Response (Success):**
  ```typescript
  {
    totalBookingsThisMonth: number,
    totalBookingsAllTime: number,
    totalRevenueThisMonth: number,
    totalRevenueAllTime: number,
    totalActivePatients: number,
    totalActiveDoctors: number,
    recentBookings: {
      id: string;
      patientName: string;
      doctorName: string;
      date: string;
      service: string;
      status: BookingStatus
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requireAuth(event, ['STAFF'])`.
2. Run all queries in parallel with `Promise.all`:
   - **Total bookings this month (CONFIRMED):**
     ```typescript
     prisma.booking.count({
       where: {
         status: 'CONFIRMED',
         date: { gte: startOfMonth, lte: endOfMonth }
       }
     })
     ```
   - **Total bookings all time (CONFIRMED):**
     ```typescript
     prisma.booking.count({ where: { status: 'CONFIRMED' } })
     ```
   - **Total revenue this month (SUCCESS payments):**
     ```typescript
     prisma.payment.aggregate({
       where: {
         status: 'SUCCESS',
         createdAt: { gte: startOfMonth, lte: endOfMonth }
       },
       _sum: { amount: true }
     })
     ```
   - **Total revenue all time:**
     ```typescript
     prisma.payment.aggregate({
       where: { status: 'SUCCESS' },
       _sum: { amount: true }
     })
     ```
   - **Total active patients:**
     ```typescript
     prisma.user.count({
       where: {
         accountType: 'PATIENT',
         bookings: { some: { status: 'CONFIRMED' } }
       }
     })
     ```
   - **Total active doctors:**
     ```typescript
     prisma.doctor.count({ where: { isActive: true } })
     ```
   - **Last 5 bookings:**
     ```typescript
     prisma.booking.findMany({
       where: { status: 'CONFIRMED' },
       orderBy: { createdAt: 'desc' },
       take: 5,
       include: {
         user: { select: { name: true } },
         doctor: { include: { user: { select: { name: true } } } }
       }
     })
     ```
3. Return all stats as a single object.

**Edge Cases:**
- No bookings or payments: Return 0 for counts/sums.
- No recent bookings: Return empty array.

---

### GET /api/admin/bookings

**User Action:** Page load for `/admin/appointments` or filter change.

**Frontend Behavior:**
- Call this endpoint with optional filters to fetch bookings for the master calendar.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/bookings`
- **Query Params:**
  ```typescript
  {
    start?: string,
    end?: string,
    doctorId?: string,
    status?: BookingStatus
  }
  ```
- **Auth:** STAFF with `APPOINTMENTS READ` permission.
- **Response (Success):**
  ```typescript
  {
    bookings: {
      id: string;
      patientName: string;
      patientPhoto?: string;
      doctorId: string;
      doctorName: string;
      doctorPhoto?: string;
      date: string;
      startTime: string;
      endTime: string;
      service: string;
      status: BookingStatus
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'APPOINTMENTS', 'READ')`.
2. Build `where` clause for `Booking`:
   - If `start` and `end`: `date: { gte: start, lte: end }`.
   - If `doctorId`: `doctorId`.
   - If `status`: `status`.
3. Fetch `Booking` records with the filters.
4. For each booking, include:
   - `patientName` and `patientPhoto` from linked `User` (patient).
   - `doctorName` and `doctorPhoto` from linked `Doctor` and `User` (doctor).
5. Sort by `date` ASC, then `startTime` ASC.
6. Return `{ bookings }`.

**Edge Cases:**
- No filters: Return all bookings.
- No bookings match filters: Return empty array.
- Invalid date format: Return 400.

---

### GET /api/admin/bookings/:id

**User Action:** Admin clicks a booking event on the master calendar.

**Frontend Behavior:**
- Call this endpoint to fetch full booking details for the modal.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/bookings/:id`
- **Auth:** STAFF with `APPOINTMENTS READ` permission.
- **Response (Success):**
  ```typescript
  {
    id: string,
    patientName: string,
    patientEmail: string,
    patientPhone?: string,
    doctorName: string,
    doctorEmail: string,
    date: string,
    startTime: string,
    endTime: string,
    service: string,
    status: BookingStatus,
    paymentStatus: PaymentStatus,
    notes?: string
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'APPOINTMENTS', 'READ')`.
2. Fetch `Booking` by `id`.
3. Fetch linked `User` (patient) and `Doctor` (with `User`) records.
4. Return full booking details.

**Edge Cases:**
- Booking not found: Return 404.

---

### PATCH /api/admin/bookings/:id/cancel

**User Action:** Admin clicks "Cancel Booking" in the booking detail modal.

**Frontend Behavior:**
- On success: Close modal, refresh calendar.

**API Call:**
- **Method:** PATCH
- **Path:** `/api/admin/bookings/:id/cancel`
- **Auth:** STAFF with `APPOINTMENTS DELETE` permission.
- **Response (Success):**
  ```typescript
  { message: "Booking cancelled successfully" }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'APPOINTMENTS', 'DELETE')`.
2. Fetch `Booking` by `id`.
3. Verify `status` is `CONFIRMED`. If not, return 400.
4. Update `Booking` status to `CANCELLED`.
5. Update linked `Payment` status to `REFUNDED`.
6. Send cancellation email to patient using `bookingCancellationTemplate` with:
   - `patientName`, `doctorName`, `date`, `time`.
7. Return 200.

**Edge Cases:**
- Booking already cancelled: Return 400.
- No linked payment: Skip payment update.
- Email sending fails: Log error but return 200.
- **No 24hr restriction for admin** — can cancel any booking at any time.

---

### GET /api/admin/doctors

**User Action:** Page load for `/admin/doctors`.

**Frontend Behavior:**
- Call this endpoint to fetch all doctors for the table.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/doctors`
- **Auth:** STAFF with `DOCTORS READ` permission.
- **Response (Success):**
  ```typescript
  {
    doctors: {
      id: string;
      name: string;
      email: string;
      phone?: string;
      photo?: string;
      specializations: string[];
      isActive: boolean;
      sessionCountThisMonth: number;
      sessionCountAllTime: number
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'DOCTORS', 'READ')`.
2. Fetch all `User` records with `accountType: DOCTOR` and their `Doctor` records.
3. For each doctor, calculate:
   - `sessionCountThisMonth`: Count of `Booking` records with `status: CONFIRMED` and `date` in current month.
   - `sessionCountAllTime`: Count of `Booking` records with `status: CONFIRMED`.
4. Sort by `name` ASC.
5. Return `{ doctors }`.

**Edge Cases:**
- No doctors: Return empty array.

---

### GET /api/admin/doctors/:id

**User Action:** Page load for `/admin/doctors/[id]`.

**Frontend Behavior:**
- Call this endpoint to fetch full doctor details.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/doctors/:id`
- **Auth:** STAFF with `DOCTORS READ` permission.
- **Response (Success):**
  ```typescript
  {
    id: string;
    name: string;
    email: string;
    phone?: string;
    photo?: string;
    bio?: string;
    slug: string;
    specializations: string[];
    isActive: boolean;
    availability: {
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      sessionDuration: number
    }[];
    blockedSlots: {
      id: string;
      date: string;
      startTime: string;
      endTime: string
    }[];
    bookingHistory: {
      id: string;
      patientName: string;
      date: string;
      startTime: string;
      endTime: string;
      service: string;
      status: BookingStatus
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'DOCTORS', 'READ')`.
2. Fetch `Doctor` by `id` with linked `User`, `Availability`, `BlockedSlot`, and `Booking` records.
3. For each booking, include `patientName` from linked `User`.
4. Return full doctor profile with all related data.

**Edge Cases:**
- Doctor not found: Return 404.

---

### POST /api/admin/doctors

**User Action:** Admin submits "Add Doctor" form.

**Frontend Behavior:**
- On success: Show success toast, close modal, refresh doctors list.

**API Call:**
- **Method:** POST
- **Path:** `/api/admin/doctors`
- **Auth:** STAFF with `DOCTORS CREATE` permission.
- **Body:**
  ```typescript
  {
    name: string (min 2 chars),
    email: string (valid email, unique),
    phone?: string,
    bio?: string,
    specializations?: string[]
  }
  ```
- **Response (Success):**
  ```typescript
  {
    id: string,
    name: string,
    email: string,
    phone?: string,
    photo?: string,
    bio?: string,
    slug: string,
    specializations: string[],
    isActive: boolean
  }
  ```
  - **Status:** 201

**Server Logic:**
1. Call `requirePermission(event, 'DOCTORS', 'CREATE')`.
2. Validate request body with Zod:
   - `name`: string, min 2 chars.
   - `email`: valid email, not already in use.
   - `phone`: optional string.
   - `bio`: optional string.
   - `specializations`: optional string array.
3. Generate a random 12-character temporary password (alphanumeric).
4. Hash password with `hashPassword`.
5. Create `User` with:
   - `accountType: DOCTOR`
   - `emailVerified: true`
   - `isActive: true`
6. Generate a unique slug from the doctor's name (e.g., "dr-ahmed-hassan"). If slug exists, append a number (e.g., "dr-ahmed-hassan-1").
7. Create linked `Doctor` record with the slug.
8. Send welcome email using `doctorWelcomeTemplate` with:
   - `doctorName`, `email`, `temporaryPassword`.
9. Return created doctor profile. **Never return the temporary password in the response.**

**Edge Cases:**
- Email already exists: Return 400.
- Invalid email format: Return 400.
- Slug generation conflict: Append number until unique.
- Email sending fails: Log error but return 201.

---

### PATCH /api/admin/doctors/:id

**User Action:** Admin submits "Edit Doctor" form.

**Frontend Behavior:**
- On success: Show success toast, close modal, refresh doctors list.

**API Call:**
- **Method:** PATCH
- **Path:** `/api/admin/doctors/:id`
- **Auth:** STAFF with `DOCTORS UPDATE` permission.
- **Body:**
  ```typescript
  {
    name?: string (min 2 chars),
    phone?: string,
    bio?: string,
    specializations?: string[],
    isActive?: boolean
  }
  ```
- **Response (Success):**
  ```typescript
  {
    id: string,
    name: string,
    email: string,
    phone?: string,
    photo?: string,
    bio?: string,
    slug: string,
    specializations: string[],
    isActive: boolean
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'DOCTORS', 'UPDATE')`.
2. Validate request body with Zod (all fields optional):
   - `name`: string, min 2 chars (if provided).
   - `phone`: string (if provided).
   - `bio`: string (if provided).
   - `specializations`: string array (if provided).
   - `isActive`: boolean (if provided).
3. Update `User` and `Doctor` records.
4. Return updated doctor profile.

**Edge Cases:**
- Doctor not found: Return 404.
- Name too short: Return 400.

---

### GET /api/admin/doctors/:id/availability

**User Action:** Page load for `/admin/doctors/[id]` (availability tab).

**Frontend Behavior:**
- Call this endpoint to fetch doctor's availability and blocked slots.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/doctors/:id/availability`
- **Auth:** STAFF with `DOCTORS READ` permission.
- **Response (Success):**
  ```typescript
  {
    availability: {
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      sessionDuration: number
    }[],
    blockedSlots: {
      id: string;
      date: string;
      startTime: string;
      endTime: string
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'DOCTORS', 'READ')`.
2. Fetch `Doctor` by `id`. Verify exists.
3. Fetch all `Availability` and `BlockedSlot` records for the doctor.
4. Return both arrays.

---

### POST /api/admin/doctors/:id/availability

**User Action:** Admin submits doctor availability form (full replace).

**Frontend Behavior:**
- On success: Show success toast, refresh availability.

**API Call:**
- **Method:** POST
- **Path:** `/api/admin/doctors/:id/availability`
- **Auth:** STAFF with `DOCTORS UPDATE` permission.
- **Body:**
  ```typescript
  {
    availability: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      sessionDuration: number
    }[]
  }
  ```
- **Response (Success):**
  ```typescript
  { message: "Availability updated successfully" }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'DOCTORS', 'UPDATE')`.
2. Fetch `Doctor` by `id`. Verify exists.
3. Delete all existing `Availability` records for the doctor.
4. Create new `Availability` records from the submitted array.
5. Return success message.

**Edge Cases:**
- Doctor not found: Return 404.
- Invalid availability data: Return 400.

---

### POST /api/admin/doctors/:id/availability/block

**User Action:** Admin adds a blocked slot for a doctor.

**Frontend Behavior:**
- On success: Show success toast, refresh blocked slots list.

**API Call:**
- **Method:** POST
- **Path:** `/api/admin/doctors/:id/availability/block`
- **Auth:** STAFF with `DOCTORS UPDATE` permission.
- **Body:**
  ```typescript
  {
    date: string,
    startTime: string,
    endTime: string
  }
  ```
- **Response (Success):**
  ```typescript
  {
    blockedSlot: {
      id: string;
      date: string;
      startTime: string;
      endTime: string
    }
  }
  ```
  - **Status:** 201

**Server Logic:**
1. Call `requirePermission(event, 'DOCTORS', 'UPDATE')`.
2. Fetch `Doctor` by `id`. Verify exists.
3. Create `BlockedSlot` record with the submitted data.
4. Return created blocked slot.

**Edge Cases:**
- Doctor not found: Return 404.
- Invalid date format: Return 400.

---

### DELETE /api/admin/doctors/:id/availability/block/:blockId

**User Action:** Admin removes a blocked slot.

**Frontend Behavior:**
- On success: Show success toast, refresh blocked slots list.

**API Call:**
- **Method:** DELETE
- **Path:** `/api/admin/doctors/:id/availability/block/:blockId`
- **Auth:** STAFF with `DOCTORS UPDATE` permission.
- **Response (Success):**
  ```typescript
  { message: "Blocked slot removed successfully" }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'DOCTORS', 'UPDATE')`.
2. Fetch `BlockedSlot` by `blockId`. Verify `doctorId` matches the URL `doctorId`.
3. Delete the `BlockedSlot` record.
4. Return success message.

**Edge Cases:**
- Blocked slot not found: Return 404.
- Blocked slot belongs to another doctor: Return 403.

---

### GET /api/admin/patients

**User Action:** Page load for `/admin/patients`.

**Frontend Behavior:**
- Call this endpoint to fetch all patients for the table.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/patients`
- **Auth:** STAFF with `PATIENTS READ` permission.
- **Query Params:**
  ```typescript
  {
    search?: string
  }
  ```
- **Response (Success):**
  ```typescript
  {
    patients: {
      id: string;
      name: string;
      email: string;
      phone?: string;
      photo?: string;
      totalSessions: number;
      lastSessionDate?: string;
      createdAt: string
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'PATIENTS', 'READ')`.
2. Build `where` clause for `User`:
   - `accountType: PATIENT`.
   - If `search`: `OR: [{ name: { contains: search } }, { email: { contains: search } }]`.
3. Fetch `User` records with the filters.
4. For each patient, calculate:
   - `totalSessions`: Count of `Booking` records with `status: CONFIRMED`.
   - `lastSessionDate`: Most recent `date` from `Booking` records with `status: CONFIRMED`.
5. Sort by `createdAt` DESC.
6. Return `{ patients }`.

**Edge Cases:**
- No patients: Return empty array.
- No search results: Return empty array.

---

### GET /api/admin/patients/:id

**User Action:** Page load for `/admin/patients/[id]`.

**Frontend Behavior:**
- Call this endpoint to fetch full patient details.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/patients/:id`
- **Auth:** STAFF with `PATIENTS READ` permission.
- **Response (Success):**
  ```typescript
  {
    id: string;
    name: string;
    email: string;
    phone?: string;
    photo?: string;
    createdAt: string,
    bookingHistory: {
      id: string;
      doctorName: string;
      date: string;
      startTime: string;
      endTime: string;
      service: string;
      status: BookingStatus
    }[],
    paymentHistory: {
      id: string;
      amount: number;
      currency: string;
      status: PaymentStatus;
      createdAt: string
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'PATIENTS', 'READ')`.
2. Fetch `User` by `id` with `accountType: PATIENT`.
3. Fetch linked `Booking` and `Payment` records.
4. For each booking, include `doctorName` from linked `Doctor` and `User`.
5. Return full patient profile with booking and payment history.

**Edge Cases:**
- Patient not found: Return 404.

---

### GET /api/admin/payments

**User Action:** Page load for `/admin/payments`.

**Frontend Behavior:**
- Call this endpoint to fetch all payments for the table.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/payments`
- **Auth:** STAFF with `PAYMENTS READ` permission.
- **Query Params:**
  ```typescript
  {
    start?: string,
    end?: string,
    doctorId?: string,
    status?: PaymentStatus
  }
  ```
- **Response (Success):**
  ```typescript
  {
    payments: {
      id: string;
      patientName: string;
      doctorName: string;
      service: string;
      amount: number;
      currency: string;
      status: PaymentStatus;
      createdAt: string;
      gatewayReference?: string
    }[],
    summary: {
      totalSuccess: number,
      totalRefunded: number,
      totalCount: number
    }
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'PAYMENTS', 'READ')`.
2. Build `where` clause for `Payment`:
   - If `start` and `end`: `createdAt: { gte: start, lte: end }`.
   - If `doctorId`: Filter by linked `Booking.doctorId`.
   - If `status`: `status`.
3. Fetch `Payment` records with the filters, including linked `Booking`, `User` (patient), and `Doctor` (with `User`).
4. Calculate summary:
   - `totalSuccess`: Sum of `amount` for `status: SUCCESS`.
   - `totalRefunded`: Sum of `amount` for `status: REFUNDED`.
   - `totalCount`: Total number of payments.
5. Sort by `createdAt` DESC.
6. Return `{ payments, summary }`.

**Edge Cases:**
- No filters: Return all payments.
- No payments match filters: Return empty array and zero summary.

---

### GET /api/admin/staff

**User Action:** Page load for `/admin/staff`.

**Frontend Behavior:**
- Call this endpoint to fetch all staff members (excluding seed admin) for the table.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/staff`
- **Auth:** STAFF with `STAFF READ` permission.
- **Response (Success):**
  ```typescript
  {
    staff: {
      id: string;
      name: string;
      email: string;
      phone?: string;
      isActive: boolean;
      permissions: {
        resource: Resource;
        action: Action
      }[]
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'STAFF', 'READ')`.
2. Fetch all `User` records with `accountType: STAFF` **excluding** the seed admin (identified by `SEED_ADMIN_EMAIL`).
3. For each staff member, fetch their `Permission` records.
4. Return `{ staff }`.

**Edge Cases:**
- No staff members (other than seed admin): Return empty array.

---

### POST /api/admin/staff

**User Action:** Admin submits "Add Staff" form.

**Frontend Behavior:**
- On success: Show success toast, close modal, refresh staff list.

**API Call:**
- **Method:** POST
- **Path:** `/api/admin/staff`
- **Auth:** STAFF with `STAFF CREATE` permission.
- **Body:**
  ```typescript
  {
    name: string (min 2 chars),
    email: string (valid email, unique),
    phone?: string,
    permissions: {
      resource: Resource;
      action: Action
    }[]
  }
  ```
- **Response (Success):**
  ```typescript
  {
    id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
    permissions: {
      resource: Resource;
      action: Action
    }[]
  }
  ```
  - **Status:** 201

**Server Logic:**
1. Call `requirePermission(event, 'STAFF', 'CREATE')`.
2. Validate request body with Zod:
   - `name`: string, min 2 chars.
   - `email`: valid email, not already in use.
   - `phone`: optional string.
   - `permissions`: array of `{ resource, action }` objects.
3. Generate a random 12-character temporary password (alphanumeric).
4. Hash password with `hashPassword`.
5. Create `User` with:
   - `accountType: STAFF`
   - `emailVerified: true`
   - `isActive: true`
6. Create `Permission` records for each permission in the array.
7. Send welcome email using `doctorWelcomeTemplate` (reuse for staff) with:
   - `doctorName` (use staff name), `email`, `temporaryPassword`.
8. Return created staff profile. **Never return the temporary password in the response.**

**Edge Cases:**
- Email already exists: Return 400.
- Invalid email format: Return 400.
- Email sending fails: Log error but return 201.

---

### PATCH /api/admin/staff/:id

**User Action:** Admin submits "Edit Staff" form.

**Frontend Behavior:**
- On success: Show success toast, close modal, refresh staff list.

**API Call:**
- **Method:** PATCH
- **Path:** `/api/admin/staff/:id`
- **Auth:** STAFF with `STAFF UPDATE` permission.
- **Body:**
  ```typescript
  {
    name?: string (min 2 chars),
    phone?: string,
    permissions?: {
      resource: Resource;
      action: Action
    }[],
    isActive?: boolean
  }
  ```
- **Response (Success):**
  ```typescript
  {
    id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
    permissions: {
      resource: Resource;
      action: Action
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'STAFF', 'UPDATE')`.
2. Validate request body with Zod (all fields optional):
   - `name`: string, min 2 chars (if provided).
   - `phone`: string (if provided).
   - `permissions`: array of `{ resource, action }` (if provided).
   - `isActive`: boolean (if provided).
3. Update `User` record (name, phone, isActive).
4. If `permissions` provided:
   - Delete all existing `Permission` records for this user.
   - Create new `Permission` records from the submitted array.
5. Return updated staff profile with new permissions.

**Edge Cases:**
- Staff not found: Return 404.
- Name too short: Return 400.

---

### DELETE /api/admin/staff/:id

**User Action:** Admin clicks "Deactivate" on a staff member.

**Frontend Behavior:**
- On success: Show success toast, refresh staff list.

**API Call:**
- **Method:** DELETE
- **Path:** `/api/admin/staff/:id`
- **Auth:** STAFF with `STAFF DELETE` permission.
- **Response (Success):**
  ```typescript
  { message: "Staff member deactivated successfully" }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'STAFF', 'DELETE')`.
2. Verify the target is **not** the seed admin account (check `email` against `SEED_ADMIN_EMAIL`). If it is → return 403.
3. Update `User.isActive` to `false` (**soft delete** — do not hard delete).
4. Return 200.

**Edge Cases:**
- Staff not found: Return 404.
- Target is seed admin: Return 403.

---

### GET /api/admin/settings

**User Action:** Page load for `/admin/settings`.

**Frontend Behavior:**
- Call this endpoint to fetch settings for the form.

**API Call:**
- **Method:** GET
- **Path:** `/api/admin/settings`
- **Auth:** STAFF with `SETTINGS READ` permission.
- **Response (Success):**
  ```typescript
  {
    id: string;
    platformName: string;
    contactEmail: string;
    contactPhone: string;
    whatsappNumber: string;
    paymentGateway: string;
    paymentGatewayKey: string;
    paymentGatewaySecret: string;
    sessionPricePerHour: number;
    defaultSessionDuration: number;
    defaultWorkingStart: string;
    defaultWorkingEnd: string;
    jitsiDomain: string
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'SETTINGS', 'READ')`.
2. Fetch `Settings` singleton record (id = "singleton").
3. Mask `paymentGatewayKey` and `paymentGatewaySecret`:
   - Return only the last 4 characters, preceded by `****` (e.g., `****abcd`).
4. Return all other fields as-is.

**Edge Cases:**
- Settings record not found: Return 404.

---

### PATCH /api/admin/settings

**User Action:** Admin submits settings form.

**Frontend Behavior:**
- On success: Show success toast.

**API Call:**
- **Method:** PATCH
- **Path:** `/api/admin/settings`
- **Auth:** STAFF with `SETTINGS UPDATE` permission.
- **Body:**
  ```typescript
  {
    platformName?: string,
    contactEmail?: string,
    contactPhone?: string,
    whatsappNumber?: string,
    paymentGateway?: string,
    paymentGatewayKey?: string,
    paymentGatewaySecret?: string,
    sessionPricePerHour?: number,
    defaultSessionDuration?: number,
    defaultWorkingStart?: string,
    defaultWorkingEnd?: string,
    jitsiDomain?: string
  }
  ```
- **Response (Success):**
  ```typescript
  {
    // Same as GET response, with masked keys
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requirePermission(event, 'SETTINGS', 'UPDATE')`.
2. Fetch `Settings` singleton record.
3. For each field in the body:
   - If `paymentGatewayKey` or `paymentGatewaySecret` are submitted and **do not** start with `****` (i.e., not masked placeholders): update them.
   - If they start with `****`: skip updating (user did not change the key).
   - For all other fields: update normally.
4. Return updated settings with keys masked (same as GET).

**Edge Cases:**
- Settings record not found: Return 404.
- Masked placeholders submitted: Skip updating those fields.

---

## Feature 4 — Frontend Pages

---

### `/admin` — Redirect Page

**Layout:** None (redirect).
**Middleware:** `auth` + `staff-only`.

**Behavior:**
- Redirect to `/admin/overview` on load.

---

### `/admin/overview` — Overview Page

**Layout:** `AdminLayout`
**Middleware:** `auth` + `staff-only`.

**Behavior:**
- **Stats Cards:** 2x2 grid of shadcn-vue stat cards:
  1. Total Bookings This Month (with % change vs last month if possible).
  2. Total Revenue This Month (formatted as EGP).
  3. Active Patients count.
  4. Active Doctors count.
- **Recent Bookings:** shadcn-vue Table below stats with columns:
  - Patient
  - Doctor
  - Date
  - Service
  - Status
- **Loading State:** shadcn-vue Skeleton for stats and table while fetching.

**Data Fetching:**
- On load: Call `GET /api/admin/overview`.

---

### `/admin/appointments` — Master Calendar Page

**Layout:** `AdminLayout`
**Middleware:** `auth` + `staff-only`.

**Behavior:**
- **Filter Bar:** Above calendar:
  - Doctor dropdown: All doctors + "All Doctors".
  - Status dropdown: All / Confirmed / Cancelled.
- **FullCalendar:**
  - Views: Month, Week, Day.
  - Each booking = event with:
    - Title: `patientName + " - " + doctorName`.
    - Start/End: `date` + `startTime`/`endTime`.
    - Color: Assign from fixed array based on `doctorId` index (see Notes for the AI in overview.md).
  - Cancelled bookings: Reduced opacity (e.g., `opacity-50`).
  - Filter changes trigger re-fetch.
- **Event Click:**
  - Open shadcn-vue Modal with:
    - Full booking details (patient, doctor, date, time, service, status, payment status).
    - "Cancel Booking" button (visible only if user has `APPOINTMENTS DELETE` permission).

**Data Fetching:**
- On load and on filter change: Call `GET /api/admin/bookings` with current filters and date range.

---

### `/admin/doctors` — Manage Doctors Page

**Layout:** `AdminLayout`
**Middleware:** `auth` + `staff-only`.

**Behavior:**
- **Search Input:** Filter by name or email (client-side or server-side).
- **Doctors Table:** shadcn-vue Table with columns:
  - Photo (small, circular)
  - Name
  - Email
  - Specializations (comma-separated or shadcn-vue Chips)
  - Status badge (Active/Inactive)
  - Sessions This Month
  - Actions:
    - Edit button (shadcn-vue IconButton) — opens edit modal.
    - View Calendar button — opens `/admin/doctors/[id]` with calendar tab active.
    - Toggle Active/Inactive (shadcn-vue Switch).
- **Add Doctor Button:** Top right (shadcn-vue Button, primary) — opens add modal.
- **Add Doctor Modal:**
  - Fields: Name, Email, Phone (optional), Bio (optional), Specializations (tag input).
  - On success: Show toast "Doctor created. Credentials sent to their email."
- **Edit Doctor Modal:**
  - Same fields as add, pre-filled with current data.
  - On success: Show toast "Doctor updated successfully."

**Data Fetching:**
- On load: Call `GET /api/admin/doctors`.
- On search: Filter table client-side or call API with search query.

**Permissions:**
- Page visible only if user has `DOCTORS READ` permission.
- Edit button visible only if user has `DOCTORS UPDATE` permission.
- Add button visible only if user has `DOCTORS CREATE` permission.
- Toggle Active visible only if user has `DOCTORS UPDATE` permission.

---

### `/admin/doctors/[id]` — Doctor Detail Page

**Layout:** `AdminLayout`
**Middleware:** `auth` + `staff-only`.

**Behavior:**
- **Tabs:**
  - Profile (default)
  - Calendar
  - Availability
- **Profile Tab:**
  - Full doctor profile (all fields including contact details).
  - "Edit Profile" button (if `DOCTORS UPDATE` permission).
- **Calendar Tab:**
  - FullCalendar showing this doctor's bookings (same as master calendar but filtered by `doctorId`).
- **Availability Tab:**
  - Availability settings form (same as doctor's own availability page in Phase 5):
    - For each day of week: Start Time, End Time, Session Duration.
    - "Save Availability" button.
  - Blocked Slots list:
    - Table of blocked slots with date, start time, end time.
    - "Add Blocked Slot" button.
    - Delete button for each slot.

**Data Fetching:**
- On load: Call `GET /api/admin/doctors/[id]` for profile.
- On calendar tab load: Call `GET /api/admin/bookings` with `doctorId` filter.
- On availability tab load: Call `GET /api/admin/doctors/[id]/availability`.

**Permissions:**
- Page visible only if user has `DOCTORS READ` permission.
- Edit buttons visible only if user has `DOCTORS UPDATE` permission.

---

### `/admin/patients` — Manage Patients Page

**Layout:** `AdminLayout`
**Middleware:** `auth` + `staff-only`.

**Behavior:**
- **Search Input:** Filter by name or email (server-side).
- **Patients Table:** shadcn-vue Table with columns:
  - Photo (small, circular)
  - Name
  - Email
  - Phone
  - Total Sessions
  - Last Session
  - Registered (date)
  - View button (shadcn-vue IconButton) — opens `/admin/patients/[id]`.

**Data Fetching:**
- On load: Call `GET /api/admin/patients`.
- On search: Call `GET /api/admin/patients?search=QUERY`.

**Permissions:**
- Page visible only if user has `PATIENTS READ` permission.

---

### `/admin/patients/[id]` — Patient Detail Page

**Layout:** `AdminLayout`
**Middleware:** `auth` + `staff-only`.

**Behavior:**
- **Patient Profile:**
  - Photo, name, email, phone, registered date.
- **Booking History:**
  - shadcn-vue Table with columns: Date, Doctor, Service, Status.
- **Payment History:**
  - shadcn-vue Table with columns: Date, Amount, Status, Gateway Reference.

**Data Fetching:**
- On load: Call `GET /api/admin/patients/[id]`.

**Permissions:**
- Page visible only if user has `PATIENTS READ` permission.

---

### `/admin/payments` — Manage Payments Page

**Layout:** `AdminLayout`
**Middleware:** `auth` + `staff-only`.

**Behavior:**
- **Stats Cards:** 3 shadcn-vue stat cards:
  - Total Revenue (all time)
  - Revenue This Month
  - Total Refunded
- **Filter Bar:**
  - Date range picker (start and end dates).
  - Doctor dropdown (all doctors + "All Doctors").
  - Status dropdown (All / SUCCESS / PENDING / FAILED / REFUNDED).
- **Payments Table:** shadcn-vue Table with columns:
  - Date
  - Patient
  - Doctor
  - Service
  - Amount (formatted with currency)
  - Status badge
  - Gateway Reference

**Data Fetching:**
- On load: Call `GET /api/admin/payments` with default filters.
- On filter change: Call `GET /api/admin/payments` with new filters.

**Permissions:**
- Page visible only if user has `PAYMENTS READ` permission.

---

### `/admin/staff` — Manage Staff Page

**Layout:** `AdminLayout`
**Middleware:** `auth` + `staff-only`.

**Behavior:**
- **Staff Table:** shadcn-vue Table with columns:
  - Name
  - Email
  - Permissions summary (e.g., "Appointments: CRUD, Patients: R")
  - Status badge (Active/Inactive)
  - Actions:
    - Edit button (shadcn-vue IconButton) — opens edit modal.
    - Deactivate button (shadcn-vue IconButton, red) — opens confirmation modal.
- **Add Staff Button:** Top right (shadcn-vue Button, primary) — opens add modal.
- **Add Staff Modal:**
  - Fields: Name, Email, Phone (optional).
  - Permission Builder:
    - For each resource (APPOINTMENTS, PATIENTS, DOCTORS, PAYMENTS, SETTINGS, STAFF):
      - Checkboxes for each action (CREATE, READ, UPDATE, DELETE).
    - Visual hint: Gray out UPDATE/DELETE if READ is not checked (UI only).
  - On success: Show toast "Staff member created. Credentials sent to their email."
- **Edit Staff Modal:**
  - Same as add modal, pre-filled with current data.
  - On success: Show toast "Staff member updated successfully."
- **Deactivate Confirmation Modal:**
  - Message: "Are you sure you want to deactivate this staff member? They will no longer be able to log in."
  - Cannot deactivate seed admin (show error if attempted).

**Data Fetching:**
- On load: Call `GET /api/admin/staff`.

**Permissions:**
- Page visible only if user has `STAFF READ` permission.
- Add button visible only if user has `STAFF CREATE` permission.
- Edit button visible only if user has `STAFF UPDATE` permission.
- Deactivate button visible only if user has `STAFF DELETE` permission.

---

### `/admin/settings` — Settings Page

**Layout:** `AdminLayout`
**Middleware:** `auth` + `staff-only`.

**Behavior:**
- **Sections with Individual Save Buttons:**
  - **Platform Info:**
    - Platform name (shadcn-vue Input)
    - Contact email (shadcn-vue Input)
    - Contact phone (shadcn-vue Input)
    - WhatsApp number (shadcn-vue Input)
    - Save button
  - **Session Pricing:**
    - Price per session (shadcn-vue Input, number) + EGP label
    - Default session duration (shadcn-vue Select: 30/45/60 minutes)
    - Save button
  - **Default Working Hours:**
    - Start time (shadcn-vue Input, time picker)
    - End time (shadcn-vue Input, time picker)
    - Note: "These are defaults only. Each doctor sets their own availability."
    - Save button
  - **Payment Gateway:**
    - Gateway selector (Paymob / Stripe) (shadcn-vue Select)
    - Key fields (shadcn-vue Input, password type):
      - For Paymob: API Key, Integration ID, HMAC Secret
      - For Stripe: Publishable Key, Secret Key, Webhook Secret
    - "Update Keys" toggle to reveal inputs (default: masked with `****`).
    - Save button

**Data Fetching:**
- On load: Call `GET /api/admin/settings`.
- On save: Call `PATCH /api/admin/settings` with updated fields.

**Permissions:**
- Page visible only if user has `SETTINGS READ` permission.
- Save buttons visible only if user has `SETTINGS UPDATE` permission.

---

## Feature 5 — Admin Dashboard Composable

**File:** `modules/admin/composables/useAdminDashboard.ts`

**State:**
```typescript
const overview = useState<OverviewData | null>('admin-overview', () => null)
const bookings = useState<Booking[]>('admin-bookings', () => [])
const doctors = useState<Doctor[]>('admin-doctors', () => [])
const patients = useState<Patient[]>('admin-patients', () => [])
const payments = useState<Payment[]>('admin-payments', () => [])
const staff = useState<Staff[]>('admin-staff', () => [])
const settings = useState<Settings | null>('admin-settings', () => null)
const isLoading = useState<boolean>('admin-dashboard-loading', () => false)
const error = useState<string | null>('admin-dashboard-error', () => null)

// Doctor colors for master calendar
const doctorColors = useState<Map<string, string>>('doctor-colors', () => new Map())
```

**Methods:**
- `fetchOverview()`: Calls `GET /api/admin/overview`.
- `fetchBookings(filters: { start?: string; end?: string; doctorId?: string; status?: BookingStatus })`: Calls `GET /api/admin/bookings`.
- `fetchDoctors()`: Calls `GET /api/admin/doctors`.
- `fetchPatients(search?: string)`: Calls `GET /api/admin/patients`.
- `fetchPayments(filters: { start?: string; end?: string; doctorId?: string; status?: PaymentStatus })`: Calls `GET /api/admin/payments`.
- `fetchStaff()`: Calls `GET /api/admin/staff`.
- `fetchSettings()`: Calls `GET /api/admin/settings`.
- `updateSettings(data: Partial<Settings>)`: Calls `PATCH /api/admin/settings`.
- `getDoctorColor(doctorId: string): string`: Returns a color from the fixed array based on `doctorId` index.

---

## Edge Cases Summary

- Non-staff roles redirected from `/admin` routes.
- Staff with no `APPOINTMENTS READ` permission cannot see All Appointments in sidebar.
- Overview stats are accurate and use Prisma aggregate queries.
- Master calendar shows all bookings, color-coded by doctor.
- Doctor filter works correctly on master calendar.
- Admin can cancel any booking without 24hr restriction.
- Add Doctor creates account and sends welcome email.
- New doctor can log in with emailed credentials.
- Add Staff creates account with correct permissions.
- Staff member with only `PATIENTS READ` cannot access `/admin/doctors`.
- Editing staff permissions replaces old permissions completely.
- Deactivating staff prevents their login.
- Payment keys are always masked in API responses and UI.
- Updating settings without changing keys does not overwrite existing keys.
- Doctor availability management works from admin panel.
- Seed admin account cannot be deactivated.
- Permission check queries the database on every request.
