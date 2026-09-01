# Phase 4 — Patient Dashboard
## flow.md

---

## Feature 1 — Patient Dashboard Layout

**Action:** Create `modules/patient/layouts/PatientLayout.vue`.

**Frontend Behavior:**
- Extends `layouts/dashboard.vue` (from Phase 0).
- **Desktop:**
  - Sidebar (240px wide) with links:
    - My Appointments (HeroUI Icon + text)
    - My Payments (HeroUI Icon + text)
    - Profile (HeroUI Icon + text)
    - Logout (HeroUI Icon + text)
  - Main content area (flex-1, overflow-auto) for `<slot />`.
- **Mobile:**
  - Bottom navigation bar with icons for the same links.
  - Hide desktop sidebar.

**Server Logic:**
- No server logic. Pure frontend component.

**Edge Cases:**
- User not logged in: Redirect to `/login` (handled by middleware).
- User is not a PATIENT: Redirect to correct dashboard (handled by middleware).

---

## Feature 2 — API Endpoints

---

### GET /api/patient/profile

**User Action:** Page load for `/dashboard/profile`.

**Frontend Behavior:**
- Call this endpoint on page load to pre-fill profile form.

**API Call:**
- **Method:** GET
- **Path:** `/api/patient/profile`
- **Auth:** PATIENT only (via `requireAuth(event, ['PATIENT'])`).
- **Response (Success):**
  ```typescript
  {
    id: string,
    name: string,
    email: string,
    phone?: string,
    photo?: string
  }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 401

**Server Logic:**
1. Call `requireAuth(event, ['PATIENT'])`.
2. Fetch `User` by `event.context.user.userId`.
3. Select fields: `id`, `name`, `email`, `phone`, `photo`.
4. Return user data. **Never return password or tokens.**

**Edge Cases:**
- User not found: Return 404.

---

### PATCH /api/patient/profile

**User Action:** User submits profile update form.

**Frontend Behavior:**
- On success: Show HeroUI Toast success notification.
- On error: Show error message.

**API Call:**
- **Method:** PATCH
- **Path:** `/api/patient/profile`
- **Auth:** PATIENT only.
- **Body:**
  ```typescript
  {
    name: string (min 2 chars),
    phone?: string
  }
  ```
- **Response (Success):**
  ```typescript
  {
    id: string,
    name: string,
    email: string,
    phone?: string,
    photo?: string
  }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 400 or 401

**Server Logic:**
1. Call `requireAuth(event, ['PATIENT'])`.
2. Validate request body with Zod:
   - `name`: string, min 2 chars.
   - `phone`: optional string.
3. Update `User` record for the logged-in patient:
   - Only update `name` and `phone`. **Email cannot be changed.**
4. Return updated user data.

**Edge Cases:**
- Name too short: Return 400.
- User not found: Return 404.

---

### POST /api/patient/profile/photo

**User Action:** User uploads a profile photo.

**Frontend Behavior:**
- On file selection: Immediately call this endpoint, update displayed photo.
- On success: Show HeroUI Toast success notification.
- On error: Show error message.

**API Call:**
- **Method:** POST
- **Path:** `/api/patient/profile/photo`
- **Auth:** PATIENT only.
- **Headers:** `Content-Type: multipart/form-data`
- **Body:** File (image).
- **Response (Success):**
  ```typescript
  {
    photoUrl: string // Relative or absolute path to the uploaded photo
  }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 400 or 401

**Server Logic:**
1. Call `requireAuth(event, ['PATIENT'])`.
2. Validate uploaded file:
   - Type: image only (jpeg, png, webp).
   - Size: max 2MB (from `UPLOAD_MAX_SIZE` env var).
3. Generate filename: `{userId}-{timestamp}.{ext}`.
4. Save file to `UPLOAD_PATH/patients/{filename}`.
5. Update `User.photo` field to the relative path (e.g., `/patients/{filename}`).
6. Return `{ photoUrl: /patients/{filename} }`.

**Edge Cases:**
- No file uploaded: Return 400.
- Invalid file type: Return 400.
- File too large: Return 400.
- `UPLOAD_PATH` directory does not exist: Create it or return 500.

---

### GET /api/patient/appointments

**User Action:** Page load for `/dashboard/appointments`.

**Frontend Behavior:**
- Call this endpoint on page load for both "Upcoming" and "Past" tabs.
- After cancel: Move card from upcoming to past without page reload.

**API Call:**
- **Method:** GET
- **Path:** `/api/patient/appointments`
- **Query Params:**
  ```typescript
  {
    tab?: 'upcoming' | 'past' // Default: 'upcoming'
  }
  ```
- **Auth:** PATIENT only.
- **Response (Success):**
  ```typescript
  {
    appointments: {
      id: string;
      doctorName: string;
      doctorPhoto?: string;
      date: string;       // YYYY-MM-DD
      startTime: string;  // "10:00"
      endTime: string;    // "11:00"
      service: string;
      status: BookingStatus;
      sessionRoom?: {
        roomName: string
      }
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requireAuth(event, ['PATIENT'])`.
2. Fetch `Booking` records where `userId` matches the logged-in patient.
3. If `tab` is `upcoming`:
   - Filter: `status: CONFIRMED` AND `date` >= today.
   - Sort by `date` ASC.
4. If `tab` is `past`:
   - Filter: `status: CONFIRMED` AND `date` < today, OR `status: CANCELLED`.
   - Sort by `date` DESC.
5. For each booking, include:
   - `doctorName` and `doctorPhoto` from linked `Doctor` and `User` records.
   - `sessionRoom.roomName` if exists.
6. Return `{ appointments }`.

**Edge Cases:**
- No appointments: Return `{ appointments: [] }`.
- Doctor not found: Use placeholder name/photo.

---

### GET /api/patient/payments

**User Action:** Page load for `/dashboard/payments`.

**Frontend Behavior:**
- Call this endpoint on page load.
- Display payments in a table or card list.

**API Call:**
- **Method:** GET
- **Path:** `/api/patient/payments`
- **Auth:** PATIENT only.
- **Response (Success):**
  ```typescript
  {
    payments: {
      id: string;
      amount: number;
      currency: string;
      status: PaymentStatus;
      createdAt: string; // ISO date
      booking: {
        doctorName: string;
        date: string;     // YYYY-MM-DD
        service: string
      }
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requireAuth(event, ['PATIENT'])`.
2. Fetch `Payment` records linked to `Booking` records where `userId` matches the logged-in patient.
3. For each payment, include:
   - `booking.doctorName` (from linked `Doctor` and `User`).
   - `booking.date` and `booking.service`.
4. Sort by `createdAt` DESC.
5. Return `{ payments }`.

**Edge Cases:**
- No payments: Return `{ payments: [] }`.
- Booking not found: Use placeholder data.

---

### GET /api/patient/session/:bookingId

**User Action:** User clicks "Join Session" button or visits `/dashboard/session/[bookingId]`.

**Frontend Behavior:**
- On page load: Call this endpoint.
- If 403 (outside time window): Show waiting state with countdown timer and booking details. Poll API every 30 seconds. Auto-enter room when window opens.
- If success: Render Jitsi session.

**API Call:**
- **Method:** GET
- **Path:** `/api/patient/session/:bookingId`
- **Auth:** PATIENT only.
- **Response (Success):**
  ```typescript
  {
    roomName: string,
    jitsiDomain: string
  }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 403 or 404

**Server Logic:**
1. Call `requireAuth(event, ['PATIENT'])`.
2. Fetch `Booking` by `bookingId`.
3. Verify `userId` matches the logged-in patient. If not → return 403.
4. Verify `status` is `CONFIRMED`. If not → return 403.
5. Check time window:
   - Current time must be within 5 minutes before `startTime` and 15 minutes after `endTime`.
   - If outside → return 403 with `{ message: "Session is not available at this time" }`.
6. Fetch or create `SessionRoom`:
   - If exists: return `roomName`.
   - If not: Generate `roomName = tawasul-{bookingId}`.
     - Set `expiresAt` to `endTime + 15 minutes`.
     - Create `SessionRoom` record.
7. Return `{ roomName, jitsiDomain }` (from `Settings.jitsiDomain` or `JITSI_DOMAIN` env var).

**Edge Cases:**
- Booking not found: Return 404.
- Booking belongs to another user: Return 403.
- Booking not confirmed: Return 403.
- Outside time window: Return 403.

---

### PATCH /api/booking/:id/cancel

**User Action:** Patient or staff cancels a booking.

**Frontend Behavior:**
- Patient: Cancel button visible only if more than 24 hours before session. On click: show HeroUI confirmation dialog. On confirm: call the API. On success: update local state.
- Staff: No 24-hour restriction. Cancel available any time.

**API Call:**
- **Method:** PATCH
- **Path:** `/api/booking/:id/cancel`
- **Auth:** PATIENT (own booking) or STAFF with APPOINTMENTS DELETE permission.
- **Body:** None
- **Success Response (200):**
  ```typescript
  { message: "Booking cancelled successfully" }
  ```
- **Error Response (400):**
  ```typescript
  { message: "Cannot cancel booking less than 24 hours before session" }
  ```
- **Error Response (403):**
  ```typescript
  { message: "Forbidden" }
  ```

**Server Logic:**
1. Call `requireAuth(event)`.
2. Fetch Booking by id.
3. If accountType is PATIENT: verify `booking.userId === event.context.user.userId`. If not → throw 403.
4. If accountType is STAFF: call `requirePermission(event, 'APPOINTMENTS', 'DELETE')`.
5. Verify booking status is CONFIRMED. If CANCELLED → throw 400 "Booking is already cancelled."
6. If accountType is PATIENT: check 24-hour rule. Calculate time difference between now and `booking.date + booking.startTime`. If less than 24 hours → throw 400 with the message above.
7. Update Booking: `status: CANCELLED`.
8. Update linked Payment: `status: REFUNDED`.
9. Send cancellation email to patient using `bookingCancellationTemplate`.
10. Return 200 with success message.

**Edge Cases:**
- Already cancelled: return 400.
- Less than 24hr (patient): return 400.
- Wrong owner (patient): return 403.
- Staff without permission: return 403.

---

## Feature 3 — Frontend Pages

---

### `/dashboard` — Redirect Page

**Layout:** None (redirect).
**Middleware:** `auth` + `patient-only`.

**Behavior:**
- Redirect to `/dashboard/appointments` on load.

---

### `/dashboard/appointments` — Appointments Page

**Layout:** `PatientLayout`
**Middleware:** `auth` + `patient-only`.

**Behavior:**
- **Tabs:** HeroUI Tabs for "Upcoming" and "Past".
- **Upcoming Tab:**
  - Show appointment cards (HeroUI Card) for each upcoming appointment:
    - Doctor photo (fallback to placeholder) + name.
    - Date formatted as "Monday, 4 March 2024".
    - Time formatted as "10:00 AM – 11:00 AM".
    - Service name.
    - "Join Session" button:
      - Active (magenta) only within time window (5 min before to 15 min after).
      - Outside window: Grayed out with tooltip "Available 5 minutes before your session".
      - Links to `/dashboard/session/[bookingId]`.
    - "Cancel" button:
      - Visible only if more than 24 hours before session.
      - On click: Open HeroUI Modal confirmation dialog.
      - On confirm: Call `PATCH /api/booking/:id/cancel`, then move card to past tab (local state update).
  - Empty state: "No upcoming appointments. Book your first session." with Book Now button (links to `/book`).
- **Past Tab:**
  - Show appointment cards for past appointments:
    - Doctor photo + name.
    - Date and time.
    - Service.
    - Status badge: Completed (green) or Cancelled (gray) — HeroUI Chip.
  - Empty state: "No past appointments."
- **Loading State:** HeroUI Skeleton for cards while fetching.
- **Auto-Update:** Recalculate Join Session button state every 60 seconds using `setInterval`.

**Data Fetching:**
- On load: Call `GET /api/patient/appointments?tab=upcoming` and `GET /api/patient/appointments?tab=past`.
- After cancel: Update local state to move card from upcoming to past.

---

### `/dashboard/payments` — Payments Page

**Layout:** `PatientLayout`
**Middleware:** `auth` + `patient-only`.

**Behavior:**
- **Desktop:** HeroUI Table with columns:
  - Date (formatted)
  - Doctor
  - Service
  - Amount (formatted with currency)
  - Status (HeroUI Chip: SUCCESS=green, PENDING=yellow, FAILED=red, REFUNDED=gray)
- **Mobile:** Table collapses to card list (one card per row).
- **Empty State:** "No payment history."
- **Loading State:** HeroUI Skeleton for table rows while fetching.

**Data Fetching:**
- On load: Call `GET /api/patient/payments`.

---

### `/dashboard/profile` — Profile Page

**Layout:** `PatientLayout`
**Middleware:** `auth` + `patient-only`.

**Behavior:**
- **Layout:** Two-column layout (desktop) or stacked (mobile).
  - **Left Column:**
    - Profile photo (circular, large).
    - "Upload Photo" button (HeroUI Button, secondary).
    - On click: Open file picker, immediately upload on selection.
  - **Right Column:**
    - Name input (HeroUI Input, required).
    - Phone input (HeroUI Input, optional).
    - Email (read-only text, not input).
    - "Save Changes" button (HeroUI Button, primary).
- **Behavior:**
  - On load: Call `GET /api/patient/profile`, pre-fill fields.
  - Photo upload: On file selection, call `POST /api/patient/profile/photo`, update displayed photo.
  - On save: Call `PATCH /api/patient/profile`, show HeroUI Toast success notification.
  - Inline validation: Name required, min 2 chars.

---

### `/dashboard/session/[bookingId]` — Session Room Page

**Layout:** `PatientLayout`
**Middleware:** `auth` + `patient-only`.

**Behavior:**
- On load:
  1. Call `GET /api/patient/session/[bookingId]`.
  2. If 403 (outside time window):
     - Show waiting state:
       - Headline: "Your session starts soon"
       - Booking details (doctor, date, time).
       - Countdown timer (e.g., "Session starts in 10 minutes").
       - Poll API every 30 seconds.
       - Auto-enter room when window opens.
  3. If success:
     - Render Jitsi session.

**Jitsi Embed:**
- Load Jitsi Meet External API script dynamically:
  ```html
  <script src="https://meet.jit.si/external_api.js"></script>
  ```
- Initialize with:
  ```javascript
  const domain = 'meet.jit.si' // or from API response
  const options = {
    roomName: roomName, // from API
    width: '100%',
    height: '100%',
    parentNode: document.getElementById('jitsi-container'),
    userInfo: {
      displayName: patientName // from useAuth
    },
    configOverwrite: {
      prejoinPageEnabled: false,
      startWithAudioMuted: true,
      startWithVideoMuted: true
    }
  }
  const api = new JitsiMeetExternalAPI(domain, options)
  ```
- **Layout:**
  - Full-height video area (left 70%).
  - Text chat panel (right 30%, use Jitsi's built-in chat).
- **Leave Session Button:**
  - HeroUI Button, top right.
  - On click: HeroUI Modal confirmation.
  - On confirm: Disconnect Jitsi, redirect to `/dashboard/appointments`.

**Edge Cases:**
- Outside time window: Show countdown, poll API.
- Jitsi script fails to load: Show error message.
- Room not found: Show error message.

---

## Feature 4 — Patient Dashboard Composable

**File:** `modules/patient/composables/usePatientDashboard.ts`

**State:**
```typescript
const profile = useState<User | null>('patient-profile', () => null)
const upcomingAppointments = useState<Booking[]>('patient-upcoming-appointments', () => [])
const pastAppointments = useState<Booking[]>('patient-past-appointments', () => [])
const payments = useState<Payment[]>('patient-payments', () => [])
const isLoading = useState<boolean>('patient-dashboard-loading', () => false)
const error = useState<string | null>('patient-dashboard-error', () => null)
```

**Methods:**
- `fetchProfile()`: Calls `GET /api/patient/profile`.
- `updateProfile(data: { name: string; phone?: string })`: Calls `PATCH /api/patient/profile`.
- `uploadPhoto(file: File)`: Calls `POST /api/patient/profile/photo`.
- `fetchAppointments()`: Calls `GET /api/patient/appointments` for both tabs.
- `cancelAppointment(bookingId: string)`: Calls `PATCH /api/booking/:id/cancel`, updates local state.
- `fetchPayments()`: Calls `GET /api/patient/payments`.

---

## Edge Cases Summary

- Patient cannot access another patient's appointments: Enforce `userId` filter in all endpoints.
- Patient cannot access another patient's session room: Verify `userId` in `GET /api/patient/session/:bookingId`.
- Join Session button state: Recalculate every 60 seconds.
- Session room countdown: Poll API every 30 seconds.
- Photo upload directory: Ensure `UPLOAD_PATH/patients` exists and is mounted in Docker.
- Jitsi roomName: Use `tawasul-{bookingId}` format for uniqueness.
- Mobile responsiveness: All pages must work on 375px viewport.
