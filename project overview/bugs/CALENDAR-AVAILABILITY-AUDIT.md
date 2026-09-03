# Patient Calendar Availability Architecture — Diagnostic Report

> **Task type:** READ-ONLY diagnostic audit. No code was modified.

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Current Availability Source](#2-current-availability-source)
3. [Business Model Mismatch](#3-business-model-mismatch)
4. [Root Cause: Why All/Most Days Are Unavailable](#4-root-cause-why-allmost-days-are-unavailable)
5. [Database Audit](#5-database-audit)
6. [API Audit](#6-api-audit)
7. [Concrete Date Trace: 2026-09-15](#7-concrete-date-trace-2026-09-15)
8. [Correct Target Architecture](#8-correct-target-architecture)
9. [Missing Pieces](#9-missing-pieces)
10. [Recommended Next Step](#10-recommended-next-step)

---

## 1. Current Architecture

The Patient Calendar availability system is **Doctor-controlled**:

```
Database (Availability model tied to doctorId)
    ↓
server/utils/availability.ts (queries Availability where doctor.isActive = true)
    ↓
API: /api/booking/available-dates, /api/booking/available-slots
    ↓
Frontend: useBooking composable → appointments.vue FullCalendar
```

**Core Logic:**
- `getAvailableDates(month, year)` queries `Availability` records for **active doctors** and returns dates where ≥1 doctor has ≥1 unbooked, unblocked slot.
- `getAvailableSlots(date)` queries `Availability` records for the date's `dayOfWeek` from **active doctors** and returns time slots not overlapping with CONFIRMED bookings or `BlockedSlot` records.
- **Both functions return empty arrays if no doctors have availability configured.**

---

## 2. Current Availability Source

**Entity controlling Patient Calendar availability: DOCTOR**

- **`Availability` model** (`prisma/schema.prisma:139-155`): Belongs to `doctorId`, defines `dayOfWeek`, `startTime`, `endTime`, `sessionDuration`.
- **`BlockedSlot` model** (`prisma/schema.prisma:161-174`): Belongs to `doctorId`, defines specific date/time single blocks.
- **No Admin-controlled schedule model exists.**

**Evidence:**
- `availability.ts:81-91`: `prisma.availability.findMany({ where: { doctor: { isActive: true } } })`
- `availability.ts:154-163`: Same query for date-level calculation.
- `create.post.ts:15,36`: Requires `doctorId` in booking creation.

---

## 3. Business Model Mismatch

### Current Code Assumptions (Doctor → Availability → Patient Booking)

| Location | Code | Assumption |
|---|---|---|
| `availability.ts:81-91` | `where: { doctor: { isActive: true } }` | Availability comes from doctors |
| `availability.ts:154-163` | Same query | Date availability comes from doctors |
| `create.post.ts:15,36` | `doctorId: z.string()` | Booking requires a doctor |
| `useBooking.ts` | `Slot.doctorId` | Slots are tied to specific doctors |
| `appointments.vue` | Dialog shows doctor name | Patient books with a specific doctor |

### Intended Business Model (Admin → Availability → Patient Booking)

```
Admin Schedule → Available Dates → Available Slots → Patient Booking (PENDING) → Admin Review → Doctor Assignment → CONFIRMED
```

### Key Differences

| Aspect | Current | Intended |
|---|---|---|
| Availability source | Doctor | Admin |
| Doctor assignment | At booking time (required) | After admin approval |
| Booking status flow | PENDING → CONFIRMED | PENDING → IN_REVIEW → CONFIRMED |
| Slot definition | Per-doctor | Global (admin-controlled) |

---

## 4. Root Cause: Why All/Most Days Are Unavailable

### Primary Root Cause

**No `Availability` records exist for any doctors, OR all doctors have `isActive = false`.**

**Flow:**
1. `getAvailableDates(month, year)` queries all `Availability` records where `doctor.isActive = true`.
2. If the query returns 0 records → Line 165: `if (availabilities.length === 0) return []`.
3. UI receives empty `availableDates` array.
4. All calendar days show as `fc-tawasul-unavailable` (grayed out).

### Secondary Causes (Even If Availability Exists)

1. **Holidays**: `isHoliday(date)` check (Line 76 in `getAvailableSlots`, Line 199 in `getAvailableDates`).
2. **Past Dates**: Slots before current time filtered out (Line 128, 221).
3. **All Slots Booked**: All slots for a date overlap with CONFIRMED bookings (Line 130, 223).
4. **All Slots Blocked**: All slots for a date overlap with `BlockedSlot` records (Line 133, 225).

### Most Likely Scenario

In a typical deployment:
- No doctors have `Availability` records configured, **OR**
- Doctors exist but `isActive = false`.

**Result:** `getAvailableDates()` returns `[]` → All days unavailable.

---

## 5. Database Audit

### Relevant Models in `prisma/schema.prisma`

| Model | Purpose | Key Fields | Relationships | Admin-Controlled? |
|---|---|---|---|---|
| **User** | All account types | `accountType` (PATIENT/DOCTOR/STAFF) | → Doctor (1:1), → Booking (1:N) | ❌ |
| **Doctor** | Doctor profile | `isActive`, `specializations` | → User (1:1), → Availability (1:N), → BlockedSlot (1:N), → Booking (1:N) | ❌ |
| **Availability** | Doctor working hours | `doctorId`, `dayOfWeek`, `startTime`, `endTime`, `sessionDuration` | → Doctor (N:1) | ❌ **DOCTOR-CONTROLLED** |
| **BlockedSlot** | Doctor-specific blocks | `doctorId`, `date`, `startTime`, `endTime` | → Doctor (N:1) | ❌ **DOCTOR-CONTROLLED** |
| **Booking** | Patient booking | `userId`, `doctorId`, `date`, `startTime`, `endTime`, `status` | → User (N:1), → Doctor (N:1) | ❌ **Requires doctorId** |
| **Settings** | Global config | `defaultWorkingStart`, `defaultWorkingEnd`, `defaultSessionDuration` | Singleton | ✅ **UNUSED** |

### Missing Models for Admin-Controlled System

1. **AdminSchedule**: Global working days/hours (replaces Doctor Availability).
2. **GlobalBlockedDate**: Admin-controlled blocked dates (replaces Doctor BlockedSlot).
3. **IN_REVIEW status**: Missing from `BookingStatus` enum.

---

## 6. API Audit

### `/api/booking/available-dates` (`modules/booking/server/api/booking/available-dates.get.ts`)

- **Input**: `month`, `year`
- **Output**: `{ dates: string[] }`
- **Implementation**: Calls `getAvailableDates(month, year)` from `availability.ts`
- **Dependency**: Requires `Availability` records with `doctor.isActive = true`
- **Logic**: Returns dates where ≥1 doctor has ≥1 unbooked, unblocked slot

### `/api/booking/available-slots` (`modules/booking/server/api/booking/available-slots.get.ts`)

- **Input**: `date` (YYYY-MM-DD)
- **Output**: `{ slots: Slot[] }`
- **Implementation**: Calls `getAvailableSlots(date)` from `availability.ts`
- **Dependency**: Requires `Availability` records matching `dayOfWeek` with `doctor.isActive = true`
- **Logic**: Returns time slots for date based on doctor availability, excluding booked/blocked slots

### `/api/booking/create` (`modules/booking/server/api/booking/create.post.ts`)

- **Input**: `{ date, startTime, doctorId }`
- **Output**: `{ bookingId, amount, currency }`
- **Implementation**:
  - Validates slot via `getAvailableSlots(date)`.
  - **Requires `doctorId`** in request body.
  - Creates booking with `doctorId` and status = `PENDING`.
- **Dependency**: Doctor must exist and slot must be available.

---

## 7. Concrete Date Trace: 2026-09-15

**Date**: 2026-09-15 (Tuesday, `dayOfWeek = 2`)

### Step 1: Holiday Check

- `holidays.ts`: Islamic holidays for 2026 include `'2026-08-24': 'Prophet's Birthday'`.
- 2026-09-15 is **NOT** in the holiday list.
- **Result**: NOT a holiday. ✅

### Step 2: `getAvailableDates(9, 2026)`

```typescript
// availability.ts:154-163
const availabilities = await prisma.availability.findMany({
  where: { doctor: { isActive: true } },
  include: { doctor: { include: { user: true } } },
})

// availability.ts:165
if (availabilities.length === 0) return []
```

- **If no Availability records exist** → Returns `[]`
- **If no doctors have `isActive = true`** → Returns `[]`
- **If no doctors have availability for Tuesday (dayOfWeek=2)** → Date not added to output

### Step 3: `getAvailableSlots("2026-09-15")`

```typescript
// availability.ts:81-91
const availabilities = await prisma.availability.findMany({
  where: {
    dayOfWeek: 2,  // Tuesday
    doctor: { isActive: true },
  },
  include: { doctor: { include: { user: true } } },
})

// availability.ts:93
if (availabilities.length === 0) return []
```

- **If no Availability records for Tuesday** → Returns `[]`
- **Result**: No slots available for 2026-09-15

### Final Result for 2026-09-15

**UNAVAILABLE** because:

1. **Primary Reason**: No `Availability` records exist for any active doctor for Tuesday (`dayOfWeek=2`)
   - OR no `Availability` records exist at all
   - OR all doctors with availability have `isActive = false`.
2. **UI Impact**: Day shows as `fc-tawasul-unavailable` (gray background), not clickable.

---

## 8. Correct Target Architecture

### Desired Flow

```
Admin Schedule (Global)
    ↓
Available Dates (Global)
    ↓
Available Slots (Global)
    ↓
Patient Books (NO doctorId)
    ↓
Booking Status: PENDING / IN_REVIEW
    ↓
Admin Reviews Booking Request
    ↓
Admin Assigns Doctor
    ↓
Booking Status: CONFIRMED
    ↓
Doctor + Patient Access Meeting Lobby
```

### Key Requirements

1. **Doctor must NOT be required** for a date/slot to be available.
2. **Doctor assignment happens AFTER** patient booking (by Admin).
3. **Booking status flow**: PENDING → IN_REVIEW → CONFIRMED.
4. **Availability is global** (Admin-controlled), not per-doctor.

---

## 9. Missing Pieces

### Database Level

| Required | Current Status | Impact |
|---|---|---|
| AdminSchedule model | ❌ MISSING | No global availability source |
| GlobalBlockedDate model | ❌ MISSING | No admin-controlled blocked dates |
| IN_REVIEW status | ❌ MISSING (enum only has PENDING, CONFIRMED, CANCELLED) | Cannot implement admin approval workflow |
| Nullable doctorId in Booking | ❌ REQUIRED (currently non-nullable) | Cannot create booking without doctor |

### Logic Level

| Required | Current Status | Impact |
|---|---|---|
| Admin-controlled availability calculation | ❌ MISSING | Availability tied to doctors |
| Booking creation without doctor | ❌ MISSING | `doctorId` required in API |
| Admin approval workflow | ❌ MISSING | No endpoints for admin review/assignment |

### UI Level

| Required | Current Status | Impact |
|---|---|---|
| Admin dashboard for schedule management | ❌ MISSING | No way for admin to configure availability |
| Admin dashboard for booking management | ❌ MISSING | No way for admin to review/assign bookings |
| Booking dialog without doctor selection | ❌ CURRENTLY SHOWS DOCTOR | UI assumes doctor is known at booking time |

---

## 10. Recommended Next Step

**DO NOT IMPLEMENT YET — report only.**

### Phase 1: Database Changes (Priority: CRITICAL)

1. **Add `IN_REVIEW` to `BookingStatus` enum** in `prisma/schema.prisma`.
2. **Make `doctorId` nullable** in `Booking` model.
3. **Create `AdminSchedule` model** (replaces Doctor Availability):

   ```prisma
   model AdminSchedule {
     id              String   @id @default(cuid())
     dayOfWeek       Int      // 0-6
     startTime       String   // "09:00"
     endTime         String   // "17:00"
     sessionDuration Int      // minutes
     isActive        Boolean  @default(true)
     createdAt       DateTime @default(now())
     updatedAt       DateTime @updatedAt
   }
   ```

4. **Create `GlobalBlockedDate` model** (replaces Doctor BlockedSlot):

   ```prisma
   model GlobalBlockedDate {
     id        String   @id @default(cuid())
     date      DateTime @db.Date
     reason    String?
     createdAt DateTime @default(now())
   }
   ```

### Phase 2: Backend Changes (Priority: CRITICAL)

1. **Create `server/utils/admin-availability.ts`**:
   - `getAdminAvailableDates(month, year)`: Uses `AdminSchedule` instead of `Availability`.
   - `getAdminAvailableSlots(date)`: Uses `AdminSchedule` instead of `Availability`.

2. **Update API endpoints**:
   - `/api/booking/available-dates`: Use `getAdminAvailableDates()`.
   - `/api/booking/available-slots`: Use `getAdminAvailableSlots()`.
   - `/api/booking/create`: Remove `doctorId` requirement, create booking without doctor.

3. **Create new Admin API endpoints**:
   - `/api/admin/schedule`: CRUD for `AdminSchedule`.
   - `/api/admin/blocked-dates`: CRUD for `GlobalBlockedDate`.
   - `/api/admin/bookings/pending`: List PENDING/IN_REVIEW bookings.
   - `/api/admin/bookings/[id]/assign-doctor`: Assign doctor to booking.
   - `/api/admin/bookings/[id]/approve`: Set status to CONFIRMED.

### Phase 3: Frontend Changes (Priority: HIGH)

1. **Update `useBooking` composable**:
   - Remove `doctorId` from slot selection.
   - Update booking creation to not require doctor.

2. **Update `appointments.vue`**:
   - Remove doctor name from booking dialog.
   - Update UI text from "Book with Dr. X" to "Request Appointment".

3. **Create Admin pages**:
   - `/admin/schedule`: Configure `AdminSchedule`.
   - `/admin/bookings`: View and manage bookings.
   - `/admin/bookings/[id]`: Assign doctor and approve.

### Phase 4: Data Migration (Priority: MEDIUM)

1. Create a migration script to:
   - Copy existing `Availability` records to `AdminSchedule` (if any exist).
   - Copy existing `BlockedSlot` records to `GlobalBlockedDate` (if any exist).
   - Handle existing bookings with a nullable `doctorId`.

---

**END OF DIAGNOSTIC REPORT**

**Summary:** The Patient Calendar is **Doctor-controlled** but needs to be **Admin-controlled**. The root cause of unavailable days is that the system requires `Availability` records tied to active doctors, but no such records exist (or doctors are inactive). The fix requires creating an Admin-controlled schedule model and removing the Doctor dependency from availability calculation.