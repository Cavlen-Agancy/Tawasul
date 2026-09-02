# Phase 2 — Marketing Pages
## flow.md

---

## Feature 1 — Navigation Bar Update

**Action:** Update `layouts/default.vue` with full navigation and mobile menu.

**Frontend Behavior:**
- **Desktop:**
  - Left: Logo (`/public/logo.png`) linked to `/`.
  - Center: Navigation links (Home, About, Services, Our Experts, Contact).
  - Right: Login button (shadcn-vue Button, variant="bordered") + Book Now button (shadcn-vue Button, color="primary").
- **Mobile:**
  - Hide center links and right buttons.
  - Show hamburger icon (shadcn-vue IconButton) that opens a shadcn-vue Drawer.
  - Drawer contains stacked navigation links + Login + Book Now buttons.

**Server Logic:**
- No server logic. Pure frontend component.

**Edge Cases:**
- Logo image missing: Fall back to text "Tawasul Academy".
- User is logged in: Replace Login button with Logout button (use `useAuth` composable).

---

## Feature 2 — Home Page (`/`)

**User Action:** User visits the homepage.

**Frontend Behavior:**
- Render 5 sections in order: Hero, Services, Our Experts, Testimonials, CTA.
- Show loading skeleton (shadcn-vue Skeleton) while fetching dynamic data (experts).

**Sections:**

### Hero Section
- **Content:**
  - Headline: "Your Path to Mental Wellness Starts Here"
  - Subheadline: "Connect with expert counselors for personalized support and guidance."
  - Two buttons:
    - "Book a Session" (primary, links to `/book`)
    - "Learn More" (outline, links to `/about`)
- **Background:** Soft magenta gradient (`#E91E8C` to `#F472B6` at 10% opacity) or full-width background image.

### Services Section
- **Title:** "Our Services"
- **Content:** Grid of 5 service cards (3 columns on desktop, 1 on mobile).
- **Services:**
  1. Marital Counseling
  2. Family Counseling
  3. Parenting Consultation
  4. Psychological Support
  5. Personal Development
- **Card Structure:**
  - shadcn-vue Card with icon (shadcn-vue Icon), title, short description, "Book Now" button (links to `/book`).

### Our Experts Section
- **Title:** "Meet Our Experts"
- **Content:**
  - Fetch up to 4 active doctors from `GET /api/public/doctors`.
  - Grid of doctor cards (4 columns on desktop, 2 on tablet, 1 on mobile).
  - Each card: photo (fallback to placeholder if missing), name, specializations (as shadcn-vue Chips).
  - "View All Experts" button (links to `/experts`).
- **Loading State:** shadcn-vue Skeleton for each card while fetching.
- **Empty State:** If no doctors, show "No experts available at this time."

### Testimonials Section
- **Title:** "What Our Clients Say"
- **Content:** 3 static testimonial cards (shadcn-vue Card) with:
  - Quote text
  - Client name
  - Star rating (5 stars, shadcn-vue Icon)

### CTA Section
- **Background:** Full-width magenta (`#E91E8C`).
- **Content:**
  - Headline: "Ready to Start Your Journey?"
  - Subheadline: "Book your first session today and take the first step toward a healthier you."
  - "Book Your First Session" button (white, links to `/book`).

**Server Logic:**
- Call `GET /api/public/doctors?limit=4` to fetch experts for the Our Experts section.

**Edge Cases:**
- No active doctors: Show placeholder message.
- Doctor photo missing: Use a default avatar placeholder.

---

## Feature 3 — About Us Page (`/about`)

**User Action:** User visits `/about`.

**Frontend Behavior:**
- Static content page with:
  - **Hero Section:**
    - Headline: "About Tawasul Academy"
    - Subheadline: "Your trusted partner in mental wellness."
  - **Who We Are:** 2–3 paragraphs about the platform's mission and values.
  - **Our Vision:** 1 paragraph.
  - **Our Mission:** 1 paragraph.
  - **Why Choose Tawasul:** 4 feature cards with icon + title + description.
    - Experienced Professionals
    - Confidential & Secure
    - Flexible Scheduling
    - Personalized Care

**Server Logic:**
- No server logic. Pure static content.

---

## Feature 4 — Services Page (`/services`)

**User Action:** User visits `/services`.

**Frontend Behavior:**
- **Hero Section:**
  - Headline: "Our Services"
  - Subheadline: "Comprehensive mental health support tailored to your needs."
- **Services List:** One section per service (5 total) with:
  - Title (e.g., "Marital Counseling")
  - Description (2–3 sentences)
  - "What to Expect" (bullet points)
  - "Book a Session" button (links to `/book`)

**Services:**
1. Marital Counseling
2. Family Counseling
3. Parenting Consultation
4. Psychological Support
5. Personal Development

**Server Logic:**
- No server logic. Pure static content.

---

## Feature 5 — Our Experts Page (`/experts`)

**User Action:** User visits `/experts`.

**Frontend Behavior:**
- **Hero Section:**
  - Headline: "Our Experts"
  - Subheadline: "Meet our team of licensed mental health professionals."
- **Experts Grid:**
  - Fetch all active doctors from `GET /api/public/doctors`.
  - Grid of doctor cards (3 columns on desktop, 2 on tablet, 1 on mobile).
  - Each card: photo, name, specializations (shadcn-vue Chips), "View Profile" button (links to `/experts/[slug]`).
- **Loading State:** shadcn-vue Skeleton for grid while fetching.
- **Empty State:** "No experts available at this time. Check back later."

**Server Logic:**
- Call `GET /api/public/doctors` to fetch all active doctors.

**Edge Cases:**
- No active doctors: Show empty state.
- Doctor photo missing: Use default avatar.

---

## Feature 6 — Expert Profile Page (`/experts/[slug]`)

**User Action:** User visits `/experts/dr-ahmed-hassan`.

**Frontend Behavior:**
- **Loading State:** shadcn-vue Skeleton while fetching doctor data.
- **Content:**
  - Photo (large, centered)
  - Name (heading)
  - Specializations (shadcn-vue Chips)
  - Bio (formatted text)
  - "Book a Session" button (shadcn-vue Button, primary, links to `/book`)
- **404 State:** If doctor not found or inactive, show 404 page with "Expert not found" message.

**Server Logic:**
- Call `GET /api/public/doctors/[slug]` to fetch doctor by slug.
- If not found or inactive, return 404.

**Edge Cases:**
- Doctor not found: Show 404.
- Doctor inactive: Show 404.
- Slug format invalid: Show 404.

---

## Feature 7 — Contact Us Page (`/contact`)

**User Action:** User visits `/contact`.

**Frontend Behavior:**
- **Hero Section:**
  - Headline: "Contact Us"
  - Subheadline: "We're here to help. Get in touch with us today."
- **Contact Form:**
  - Fields: Name (required), Email (required, valid format), Phone (optional), Message (required, min 10 chars).
  - Submit button (shadcn-vue Button, primary).
  - On submit: Call `POST /api/public/contact`.
  - On success: Show success message (shadcn-vue Alert) + clear form.
  - On error: Show error message (but never reveal if email sending failed).
- **Contact Details:**
  - Fetched from `GET /api/public/settings` (or directly from Settings singleton).
  - Display: Phone, Email, WhatsApp (with clickable links).

**Server Logic:**
- Call `POST /api/public/contact` to submit the form.
- Fetch contact details from Settings singleton for display.

**Edge Cases:**
- Form validation fails: Show inline errors.
- Email sending fails: Still show success message to user.

---

## Feature 8 — Public API Endpoints

---

### GET /api/public/doctors

**User Action:** Page load for `/experts` or Home page Experts section.

**API Call:**
- **Method:** GET
- **Path:** `/api/public/doctors`
- **Query Params:**
  - `limit?: number` (optional, default 100)
- **Auth:** None
- **Response (Success):**
  ```typescript
  {
    doctors: {
      id: string;
      name: string;
      photo?: string;
      slug: string;
      specializations: string[];
      bio: string (truncated to 150 chars)
    }[]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Fetch all `User` records with `accountType: DOCTOR` and linked `Doctor` records where `isActive: true`.
2. Select fields: `id`, `name`, `photo`, `slug`, `specializations`, `bio`.
3. Truncate `bio` to 150 characters.
4. Sort by `name` ascending.
5. Apply `limit` if provided.
6. Return list.

**Edge Cases:**
- No active doctors: Return empty array.
- Doctor missing photo: Return `photo: null`.

---

### GET /api/public/doctors/:slug

**User Action:** Page load for `/experts/[slug]`.

**API Call:**
- **Method:** GET
- **Path:** `/api/public/doctors/:slug`
- **Auth:** None
- **Response (Success):**
  ```typescript
  {
    id: string;
    name: string;
    photo?: string;
    slug: string;
    specializations: string[];
    bio: string
  }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: "Expert not found" }
  ```
  - **Status:** 404

**Server Logic:**
1. Fetch `Doctor` by `slug` where `isActive: true`.
2. If not found → return 404.
3. Fetch linked `User` record.
4. Return doctor data with `User.name` and `User.photo`.

**Edge Cases:**
- Doctor not found: Return 404.
- Doctor inactive: Return 404.

---

### POST /api/public/contact

**User Action:** User submits contact form.

**API Call:**
- **Method:** POST
- **Path:** `/api/public/contact`
- **Body:**
  ```typescript
  {
    name: string (required),
    email: string (required, valid email),
    phone?: string,
    message: string (required, min 10 chars)
  }
  ```
- **Auth:** None
- **Response (Success):**
  ```typescript
  { message: "Thank you for your message. We will get back to you soon." }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 400

**Server Logic:**
1. Validate request body with Zod:
   - `name`: required string.
   - `email`: required, valid email format.
   - `phone`: optional string.
   - `message`: required, min 10 chars.
2. Fetch `Settings` singleton to get admin contact email (`contactEmail`).
3. Send email to `contactEmail` using `sendEmail` with:
   - Subject: `New Contact Form Submission from ${name}`
   - HTML: Format the form data (name, email, phone, message).
4. Return 200 with success message.

**Edge Cases:**
- Invalid email format: Return 400.
- Message too short: Return 400.
- Settings record missing: Use fallback email (e.g., `RESEND_FROM_EMAIL`).
- Email sending fails: Log error but return 200.

---

## Feature 9 — SEO

**Action:** Add SEO meta tags to all marketing pages.

**Frontend Behavior:**
- Use `useSeoMeta` in each page to set:
  - `title`
  - `description`
  - `og:title`
  - `og:description`
  - `og:url`

**SEO Config per Page:**

| Page | Title | Description |
|---|---|---|
| Home | "Tawasul Academy — Online Mental Health Counseling" | "Connect with expert counselors for personalized mental health support. Book your session today." |
| About | "About Us | Tawasul Academy" | "Learn about our mission, vision, and team of licensed mental health professionals." |
| Services | "Our Services | Tawasul Academy" | "Explore our mental health services, including marital counseling, family therapy, and more." |
| Experts | "Our Experts | Tawasul Academy" | "Meet our team of experienced counselors and therapists." |
| Expert Profile | "{Doctor Name} | Tawasul Academy" | "Learn about {Doctor Name}, a licensed {specializations} specialist at Tawasul Academy." |
| Contact | "Contact Us | Tawasul Academy" | "Get in touch with Tawasul Academy for inquiries or support." |

---

## Edge Cases Summary

- No active doctors in DB: Show placeholder message in Experts sections.
- Doctor photo missing: Use default avatar placeholder.
- Contact form submission fails: Still show success to user.
- Settings record missing: Use fallback values for contact details.
- Invalid slug in expert profile URL: Show 404.
- Mobile viewport: All pages must be responsive (375px width).
