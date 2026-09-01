# Phase 5 — Doctor Dashboard
## flow.md

---

## Feature 1 — Doctor Dashboard Layout

**Action:** Create `modules/doctor/layouts/DoctorLayout.vue`.

**Frontend Behavior:**
- Extends `layouts/dashboard.vue` (from Phase 0).
- **Desktop:**
  - Sidebar (240px wide) with links:
    - My Calendar (HeroUI Icon + text)
    - My Profile (HeroUI Icon + text)
    - Logout (HeroUI Icon + text)
  - Main content area (flex-1, overflow-auto) for `<slot />`.
- **Mobile:**
  - Bottom navigation bar with icons for the same links.
  - Hide desktop sidebar.
- **Incomplete Profile Banner:**
  - If the logged-in doctor's `bio` is empty or null, show a yellow HeroUI Alert banner at the top of the main content area:
    - Message: "Your profile is incomplete. Please complete your profile so patients can find you."
    - Link to `/doctor/profile`.

**Server Logic:**
- No server logic. Pure frontend component.
- Fetch doctor profile in the layout to check `bio` (or use `useDoctorDashboard` composable).

**Edge Cases:**
- User not logged in: Redirect to `/login` (handled by middleware).
- User is not a DOCTOR: Redirect to correct dashboard (handled by middleware).

---

## Feature 2 — API Endpoints

---

### GET /api/doctor/profile

**User Action:** Page load for `/doctor/profile` or layout load (for banner check).

**Frontend Behavior:**
- Call this endpoint on page load to pre-fill profile form.
- Use in layout to check if `bio` is empty (for banner).

**API Call:**
- **Method:** GET
- **Path:** `/api/doctor/profile`
- **Auth:** DOCTOR only (via `requireAuth(event, ['DOCTOR'])`).
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
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 401 or 403

**Server Logic:**
1. Call `requireAuth(event, ['DOCTOR'])`.
2. Fetch `User` and linked `Doctor` record for the logged-in user.
3. Return combined data. **Never return password or tokens.**

**Edge Cases:**
- Doctor record not found: Return 404.

---

### PATCH /api/doctor/profile

**User Action:** Doctor submits profile update form.

**Frontend Behavior:**
- On success: Show HeroUI Toast success notification.
- On error: Show error message.

**API Call:**
- **Method:** PATCH
- **Path:** `/api/doctor/profile`
- **Auth:** DOCTOR only.
- **Body:**
  ```typescript
  {
    name?: string (min 2 chars),
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
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 400 or 401

**Server Logic:**
1. Call `requireAuth(event, ['DOCTOR'])`.
2. Validate request body with Zod (all fields optional):
   - `name`: string, min 2 chars (if provided).
   - `phone`: string (if provided).
   - `bio`: string (if provided).
   - `specializations`: string array (if provided).
3. Update `User` (name, phone) and `Doctor` (bio, specializations) records.
4. Return updated profile.

**Edge Cases:**
- Name too short: Return 400.
- Doctor record not found: Return 404.

---

### POST /api/doctor/profile/photo

**User Action:** Doctor uploads a profile photo.

**Frontend Behavior:**
- On file selection: Immediately call this endpoint, update displayed photo.
- On success: Show HeroUI Toast success notification.
- On error: Show error message.

**API Call:**
- **Method:** POST
- **Path:** `/api/doctor/profile/photo`
- **Auth:** DOCTOR only.
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
1. Call `requireAuth(event, ['DOCTOR'])`.
2. Validate uploaded file:
   - Type: image only (jpeg, png, webp).
   - Size: max 2MB (from `UPLOAD_MAX_SIZE` env var).
3. Generate filename: `{userId}-{timestamp}.{ext}`.
4. Save file to `UPLOAD_PATH/doctors/{filename}`.
5. Update `User.photo` field to the relative path (e.g., `/doctors/{filename}`).
6. Return `{ photoUrl: /doctors/{filename} }`.

**Edge Cases:**
- No file uploaded: Return 400.
- Invalid file type: Return 400.
- File too large: Return 400.
- `UPLOAD_PATH/doctors` directory does not exist: Create it or return 500.

---

### GET /api/doctor/bookings

**User Action:** Calendar loads or date range changes in `/doctor/calendar`.

**Frontend Behavior:**
- Call this endpoint with `start` and `end` date range for the current calendar view.
- Render returned bookings as events on FullCalendar.

**API Call:**
- **Method:** GET
- **Path:** `/api/doctor/bookings`
- **Query Params:**
  ```typescript
  {
    start: string, // YYYY-MM-DD (inclusive)
    end: string    // YYYY-MM-DD (inclusive)
  }
  ```
- **Auth:** DOCTOR only.
- **Response (Success):**
  ```typescript
  {
    bookings: {
      id: string;
      patientName: string;
      patientPhoto?: string;
      date: string;       // YYYY-MM-DD
      startTime: string;  // "10:00"
      endTime: string;    // "11:00"
      service: string;
      status: BookingStatus
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Call `requireAuth(event, ['DOCTOR'])`.
2. Validate `start` and `end` date formats (YYYY-MM-DD).
3. Fetch `Doctor` record for the logged-in user.
4. Fetch all `Booking` records where:
   - `doctorId` matches the logged-in doctor.
   - `date` is between `start` and `end` (inclusive).
5. For each booking, include:
   - `patientName` and `patientPhoto` from linked `User` record.
6. Sort by `date` ASC, then `startTime` ASC.
7. Return `{ bookings }`.

**Edge Cases:**
- Invalid date format: Return 400.
- No bookings in range: Return `{ bookings: [] }`.
- Doctor record not found: Return 404.

---

### GET /api/doctor/bookings/:id

**User Action:** Doctor clicks a booking event on the calendar.

**Frontend Behavior:**
- Call this endpoint to fetch full booking details for the modal.

**API Call:**
- **Method:** GET
- **Path:** `/api/doctor/bookings/:id`
- **Auth:** DOCTOR only.
- **Response (Success):**
  ```typescript
  {
    id: string,
    patientName: string,
    patientEmail: string,
    date: string,       // YYYY-MM-DD
    startTime: string,  // "10:00"
    endTime: string,    // "11:00"
    service: string,
    status: BookingStatus,
    paymentStatus: PaymentStatus
  }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 403 or 404

**Server Logic:**
1. Call `requireAuth(event, ['DOCTOR'])`.
2. Fetch `Booking` by `id`.
3. Verify `doctorId` matches the logged-in doctor. If not → return 403.
4. Fetch linked `User` (patient) record.
5. Return booking details with patient name and email.

**Edge Cases:**
- Booking not found: Return 404.
- Booking belongs to another doctor: Return 403.

---

### GET /api/doctor/session/:bookingId

**User Action:** Doctor clicks "Join Session" in the booking detail modal or visits `/doctor/session/[bookingId]`.

**Frontend Behavior:**
- On page load: Call this endpoint.
- If 403 (outside time window): Show waiting state with countdown timer and booking details. Poll API every 30 seconds. Auto-enter room when window opens.
- If success: Render Jitsi session.

**API Call:**
- **Method:** GET
- **Path:** `/api/doctor/session/:bookingId`
- **Auth:** DOCTOR only.
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
1. Call `requireAuth(event, ['DOCTOR'])`.
2. Fetch `Booking` by `bookingId`.
3. Verify `doctorId` matches the logged-in doctor. If not → return 403.
4. Verify `status` is `CONFIRMED`. If not → return 403.
5. Check time window:
   - Current time must be within 5 minutes before `startTime` and 15 minutes after `endTime`.
   - If outside → return 403 with `{ message: "Session is not available at this time" }`.
6. Fetch or create `SessionRoom`:
   - Use `upsert` with `bookingId` as the unique key.
   - If creating: Generate `roomName = tawasul-{bookingId}`.
     - Set `expiresAt` to `endTime + 15 minutes`.
   - If exists: Use existing `roomName`.
7. Return `{ roomName, jitsiDomain }` (from `Settings.jitsiDomain` or `JITSI_DOMAIN` env var).

**Edge Cases:**
- Booking not found: Return 404.
- Booking belongs to another doctor: Return 403.
- Booking not confirmed: Return 403.
- Outside time window: Return 403.

---

## Feature 3 — Frontend Pages

---

### `/doctor` — Redirect Page

**Layout:** None (redirect).
**Middleware:** `auth` + `doctor-only`.

**Behavior:**
- Redirect to `/doctor/calendar` on load.

---

### `/doctor/calendar` — Calendar Page

**Layout:** `DoctorLayout`
**Middleware:** `auth` + `doctor-only`.

**Behavior:**
- **FullCalendar Configuration:**
  - Views: Month, Week, Day (with view switcher buttons top right).
  - `initialView: 'dayGridMonth'`.
  - On load and on view/date change (`datesSet` callback):
    - Debounce by 100ms.
    - Call `GET /api/doctor/bookings?start=START_DATE&end=END_DATE`.
    - Render returned bookings as events.
- **Event Rendering:**
  - Each confirmed booking = event with:
    - Title: `patientName` (from API response).
    - Start/End: `date` + `startTime`/`endTime`.
    - Color: Primary magenta (`#E91E8C`).
  - Cancelled bookings: Show with reduced opacity (e.g., `opacity-50`).
- **Event Click:**
  - Open HeroUI Modal with booking details:
    - Patient name.
    - Date and time.
    - Service.
    - Status badge.
    - "Join Session" button:
      - Active only within time window (5 min before to 15 min after).
      - Links to `/doctor/session/[bookingId]`.

**Edge Cases:**
- No bookings in date range: Calendar shows empty.
- Doctor has no `Doctor` record: Show error message.

---

### `/doctor/profile` — Profile Page

**Layout:** `DoctorLayout`
**Middleware:** `auth` + `doctor-only`.

**Behavior:**
- **Layout:** Two-column layout (desktop) or stacked (mobile).
  - **Left Column:**
    - Profile photo (circular, large).
    - "Upload Photo" button (HeroUI Button, secondary).
    - On click: Open file picker, immediately upload on selection.
  - **Right Column:**
    - Name input (HeroUI Input, required, min 2 chars).
    - Phone input (HeroUI Input, optional).
    - Email (read-only text, not input).
    - Bio (HeroUI Textarea, optional).
    - Specializations (tag input component):
      - Type to add a new specialization, press Enter to confirm.
      - Click X on a tag to remove it.
    - "Save Changes" button (HeroUI Button, primary).
- **Behavior:**
  - On load: Call `GET /api/doctor/profile`, pre-fill fields.
  - Photo upload: On file selection, call `POST /api/doctor/profile/photo`, update displayed photo.
  - On save: Call `PATCH /api/doctor/profile`, show HeroUI Toast success notification.
  - If `bio` is empty on load: Show inline warning below the bio field (e.g., "Please add a bio so patients can find you").

**Specializations Tag Input:**
- Use a simple custom component:
  ```vue
  <div class="flex flex-wrap gap-2">
    <HeroChip v-for="(spec, index) in specializations" :key="index">
      {{ spec }}
      <button @click="removeSpecialization(index)">X</button>
    </HeroChip>
    <input v-model="newSpecialization" @keydown.enter="addSpecialization" />
  </div>
  ```

---

### `/doctor/session/[bookingId]` — Session Room Page

**Layout:** `DoctorLayout`
**Middleware:** `auth` + `doctor-only`.

**Behavior:**
- Same structure and behavior as the patient session room page (Phase 4), but:
  - Calls `GET /api/doctor/session/:bookingId` for the room.
  - Jitsi initialized with doctor's name as `displayName`.
  - "Leave Session" redirects to `/doctor/calendar`.

**Jitsi Embed:**
- Reuse the same Jitsi External API integration as Phase 4:
  ```javascript
  const domain = jitsiDomain // from API response
  const options = {
    roomName: roomName,
    width: '100%',
    height: '100%',
    parentNode: document.getElementById('jitsi-container'),
    userInfo: {
      displayName: doctorName // from useAuth
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
  - On confirm: Disconnect Jitsi, redirect to `/doctor/calendar`.

**Edge Cases:**
- Outside time window: Show countdown, poll API every 30 seconds.
- Jitsi script fails to load: Show error message.

---

## Feature 4 — Doctor Dashboard Composable

**File:** `modules/doctor/composables/useDoctorDashboard.ts`

**State:**
```typescript
const profile = useState<{
  id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  bio?: string;
  slug: string;
  specializations: string[];
  isActive: boolean;
} | null>('doctor-profile', () => null)

const bookings = useState<Booking[]>('doctor-bookings', () => [])
const isLoading = useState<boolean>('doctor-dashboard-loading', () => false)
const error = useState<string | null>('doctor-dashboard-error', () => null)
```

**Methods:**
- `fetchProfile()`: Calls `GET /api/doctor/profile`.
- `updateProfile(data: { name?: string; phone?: string; bio?: string; specializations?: string[] })`: Calls `PATCH /api/doctor/profile`.
- `uploadPhoto(file: File)`: Calls `POST /api/doctor/profile/photo`.
- `fetchBookings(start: string, end: string)`: Calls `GET /api/doctor/bookings?start=START&end=END`.

---

## Edge Cases Summary

- Doctor cannot access another doctor's bookings: Verify `doctorId` in all endpoints.
- Doctor and patient enter the same Jitsi room for the same booking: Use shared `roomName` (`tawasul-{bookingId}`).
- `SessionRoom` record is shared: Use `upsert` to handle both patient and doctor creating/reading the same record.
- `datesSet` callback fires twice on init: Debounce by 100ms.
- Doctor session endpoint must verify `doctorId` ownership: Never skip this check.
- Specializations tag input: Simple custom component with text input and removable chips.
- Doctor profile is visible to admin only: Public expert profile uses `/api/public/doctors/:slug` (Phase 2).
