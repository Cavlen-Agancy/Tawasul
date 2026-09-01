# Phase 2 — Marketing Pages
## testing.md

---

## Testing Strategy

Phase 2 introduces public-facing pages and API endpoints. Testing includes:

- **Unit Tests (Vitest)** — NO. No pure utility functions are added in this phase.
- **API Tests (Vitest + supertest)** — YES. Test all 3 public API endpoints.
- **End-to-End Tests (Playwright)** — YES. Test all marketing pages and navigation flows.

---

## API Tests

---

### Test File: `tests/api/public/doctors.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch all doctors | No query params | 200 | `{ doctors: [...] }` (array of active doctors) |
| Fetch with limit | Query: `?limit=2` | 200 | `{ doctors: [...] }` (max 2 doctors) |
| No active doctors | DB has no active doctors | 200 | `{ doctors: [] }` |
| Doctor fields | Any request | 200 | Each doctor has `id`, `name`, `photo?`, `slug`, `specializations`, `bio` (truncated) |

---

### Test File: `tests/api/public/doctors/[slug].get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Valid slug | Path: `/api/public/doctors/dr-ahmed-hassan` | 200 | `{ id, name, photo?, slug, specializations, bio }` |
| Invalid slug | Path: `/api/public/doctors/nonexistent` | 404 | `{ message: "Expert not found" }` |
| Inactive doctor | Path: `/api/public/doctors/inactive-doctor` | 404 | `{ message: "Expert not found" }` |

---

### Test File: `tests/api/public/contact.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Valid submission | Body: `{ name: "Ahmed", email: "ahmed@test.com", message: "Hello world" }` | 200 | `{ message: "Thank you for your message..." }` |
| Missing name | Body: `{ email: "ahmed@test.com", message: "Hello" }` | 400 | `{ message: "Name is required" }` |
| Invalid email | Body: `{ name: "Ahmed", email: "invalid", message: "Hello" }` | 400 | `{ message: "Invalid email format" }` |
| Short message | Body: `{ name: "Ahmed", email: "ahmed@test.com", message: "Hi" }` | 400 | `{ message: "Message must be at least 10 characters" }` |

---

## End-to-End Tests (Playwright)

---

### Test File: `tests/e2e/marketing.spec.ts`

#### Test: Home Page Loads
- **Starting State:** On `/` (homepage).
- **Steps:**
  1. Navigate to `/`.
- **Assertions:**
  - Page title is "Tawasul Academy — Online Mental Health Counseling".
  - Hero section headline is visible.
  - Services section is visible.
  - Our Experts section is visible (if doctors exist).
  - Testimonials section is visible.
  - CTA section is visible.
  - Book Now button in Hero links to `/book`.
  - Book Now button in CTA links to `/book`.

#### Test: Navigation Links Work
- **Starting State:** On `/`.
- **Steps:**
  1. Click "About" link in navbar.
  2. Click "Services" link.
  3. Click "Our Experts" link.
  4. Click "Contact" link.
  5. Click logo to return to `/`.
- **Assertions:**
  - Each link navigates to the correct page.
  - URL updates correctly.
  - Page titles match expected SEO titles.

#### Test: Mobile Navigation Works
- **Starting State:** On `/` with viewport set to 375px (mobile).
- **Steps:**
  1. Click hamburger menu icon.
  2. Verify drawer opens.
  3. Click "About" link in drawer.
  4. Click hamburger menu again to close.
- **Assertions:**
  - Hamburger menu is visible on mobile.
  - Drawer opens and shows all navigation links.
  - Links in drawer work correctly.
  - Drawer closes after navigation.

#### Test: Experts Page Shows Doctors
- **Starting State:** DB has at least 1 active doctor, on `/experts`.
- **Steps:**
  1. Navigate to `/experts`.
- **Assertions:**
  - Page title is "Our Experts | Tawasul Academy".
  - At least 1 doctor card is visible.
  - Each card has a photo (or placeholder), name, and specializations.
  - "View Profile" button links to `/experts/[slug]`.

#### Test: Expert Profile Page Works
- **Starting State:** DB has a doctor with slug `dr-ahmed-hassan`, on `/experts/dr-ahmed-hassan`.
- **Steps:**
  1. Navigate to `/experts/dr-ahmed-hassan`.
- **Assertions:**
  - Page title includes doctor name.
  - Doctor photo, name, specializations, and bio are visible.
  - "Book a Session" button links to `/book`.

#### Test: Expert Profile 404
- **Starting State:** On `/experts/nonexistent`.
- **Steps:**
  1. Navigate to `/experts/nonexistent`.
- **Assertions:**
  - 404 page is shown.
  - "Expert not found" message is visible.

#### Test: Contact Form Submission
- **Starting State:** On `/contact`.
- **Steps:**
  1. Fill in name: "Test User".
  2. Fill in email: `test-${Date.now()}@example.com`.
  3. Fill in message: "This is a test message for Tawasul Academy."
  4. Click submit.
- **Assertions:**
  - Success message is visible.
  - Form fields are cleared.
  - No error messages are shown.

#### Test: Contact Details Display
- **Starting State:** Settings record has `contactEmail` and `contactPhone` set, on `/contact`.
- **Steps:**
  1. Navigate to `/contact`.
- **Assertions:**
  - Contact email is visible and clickable (mailto link).
  - Contact phone is visible and clickable (tel link).

#### Test: Home Page Experts Section
- **Starting State:** DB has 3 active doctors, on `/`.
- **Steps:**
  1. Navigate to `/`.
- **Assertions:**
  - Our Experts section shows up to 4 doctors.
  - "View All Experts" button links to `/experts`.

#### Test: Home Page Experts Empty State
- **Starting State:** DB has no active doctors, on `/`.
- **Steps:**
  1. Navigate to `/`.
- **Assertions:**
  - Our Experts section shows placeholder message (e.g., "No experts available at this time.").

#### Test: Book Now CTAs
- **Starting State:** On any marketing page.
- **Steps:**
  1. Check all "Book Now" buttons/links.
- **Assertions:**
  - All link to `/book`.

---

## Manual Verification Checklist

Complete every item below before marking Phase 2 as done:

1. **Home Page:**
   - [ ] Hero section renders correctly with headline, subheadline, and buttons.
   - [ ] Services section shows all 5 services with cards.
   - [ ] Our Experts section shows up to 4 active doctors.
   - [ ] Testimonials section shows 3 testimonials.
   - [ ] CTA section renders with magenta background and button.

2. **Navigation:**
   - [ ] All navbar links work on desktop.
   - [ ] Hamburger menu works on mobile (375px viewport).
   - [ ] Logo links to `/`.
   - [ ] Book Now button in navbar links to `/book`.

3. **Pages:**
   - [ ] About page loads with all sections.
   - [ ] Services page loads with all 5 services.
   - [ ] Experts page loads with all active doctors.
   - [ ] Expert profile page loads with correct data.
   - [ ] Contact page loads with form and contact details.

4. **Dynamic Data:**
   - [ ] Experts data is fetched from DB and displayed.
   - [ ] Contact details are fetched from Settings.
   - [ ] Expert profile 404 works for non-existent slugs.

5. **Forms:**
   - [ ] Contact form validates fields.
   - [ ] Contact form submits successfully.
   - [ ] Success message shows after submission.

6. **SEO:**
   - [ ] Each page has correct title and description.
   - [ ] OpenGraph tags are set.

7. **Responsiveness:**
   - [ ] All pages are usable on 375px mobile viewport.
   - [ ] Navigation collapses to hamburger on mobile.
   - [ ] Experts grid stacks on mobile.
   - [ ] Services grid stacks on mobile.

8. **Visuals:**
   - [ ] HeroUI components render with brand colors.
   - [ ] Magenta primary color is consistent.
   - [ ] No console errors in browser.

---

## Completion Criteria

Mark each item PASS or FAIL with a note before handing off to Phase 3:

```
[ ] All API tests pass (0 failures) — run `npm run test:api`
[ ] All Playwright tests pass (0 failures) — run `npm run test:e2e`
[ ] No TypeScript errors — `npx tsc --noEmit` shows 0 errors
[ ] Manual verification checklist completed
[ ] No console errors in the browser on any marketing page
[ ] All marketing pages load with correct data
[ ] Navigation works on desktop and mobile
[ ] Contact form submits and admin receives email
[ ] SEO meta tags are correct for all pages
[ ] All pages are responsive on mobile (375px)
```

**The phase is complete only when all 10 items above are marked PASS.**

If any item is FAIL, fix it before moving to Phase 3. Document what failed and what was done to fix it in a `notes.md` file inside the `phase-2/` folder.
