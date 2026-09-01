# Phase 2 — Marketing Pages
## expected-output.md

---

## API Endpoints Delivered

| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/public/doctors` | No | Fetch all active doctors (paginated). |
| GET | `/api/public/doctors/:slug` | No | Fetch a single doctor by slug. |
| POST | `/api/public/contact` | No | Submit contact form. |

---

## Pages Delivered

| Route | Layout Used | Middleware Applied | Description |
|---|---|---|---|
| `/` | `default` | None | Home page with Hero, Services, Experts, Testimonials, CTA sections. |
| `/about` | `default` | None | About Us page with Who We Are, Vision, Mission, Why Choose Tawasul. |
| `/services` | `default` | None | Services page with list of all services. |
| `/experts` | `default` | None | Our Experts page with grid of all active doctors. |
| `/experts/[slug]` | `default` | None | Expert Profile page with doctor details. |
| `/contact` | `default` | None | Contact Us page with form and contact details. |

---

## Components Delivered

None. All pages use HeroUI components directly. Reusable components will be added in later phases if needed.

---

## Composables Delivered

None. No composables are needed for marketing pages.

---

## Server Utilities Delivered

**Reused from Phase 0:**
- `server/utils/prisma.ts` — `prisma` singleton.
- `server/utils/email.ts` — `sendEmail` function.

**New in Phase 2:**
None.

---

## Middleware Delivered

**Reused from Phase 1:**
- `middleware/guest.ts` — Redirect logged-in users to their dashboard (applied to `/login` and `/register` in Phase 1, not needed for marketing pages).

**New in Phase 2:**
None.

---

## Layouts Delivered

| File | Changes |
|---|---|
| `layouts/default.vue` | Added full navigation bar (desktop + mobile), footer with contact info, and Book Now CTA. |

---

## Database Changes

No schema changes in this phase. Uses existing `Doctor`, `User`, and `Settings` models.

---

## Emails Sent

| Trigger Event | Recipient | Template Used | Key Variables |
|---|---|---|---|
| Contact form submission | Admin email (from Settings) | Custom HTML (not a template function) | `name`, `email`, `phone`, `message` |

---

## Static Assets Delivered

| File | Purpose |
|---|---|
| `/public/logo.png` | Tawasul Academy logo for navbar. |
| `/public/favicon.png` | Favicon for browser tab. |

---

## Environment Variables Used

| Variable | Where Used |
|---|---|
| `RESEND_API_KEY` | `sendEmail` in `server/api/public/contact.post.ts`. |
| `RESEND_FROM_EMAIL` | `sendEmail` in `server/api/public/contact.post.ts`. |
| `RESEND_FROM_NAME` | `sendEmail` in `server/api/public/contact.post.ts`. |
| `APP_URL` | Not directly used, but may be used for generating absolute URLs in future. |

---

## SEO Delivered

| Page | Title | Description |
|---|---|---|
| Home | "Tawasul Academy — Online Mental Health Counseling" | "Connect with expert counselors for personalized mental health support. Book your session today." |
| About | "About Us | Tawasul Academy" | "Learn about our mission, vision, and team of licensed mental health professionals." |
| Services | "Our Services | Tawasul Academy" | "Explore our mental health services, including marital counseling, family therapy, and more." |
| Experts | "Our Experts | Tawasul Academy" | "Meet our team of experienced counselors and therapists." |
| Expert Profile | Dynamic: `"{Doctor Name} | Tawasul Academy"` | Dynamic: `"Learn about {Doctor Name}, a licensed {specializations} specialist at Tawasul Academy."` |
| Contact | "Contact Us | Tawasul Academy" | "Get in touch with Tawasul Academy for inquiries or support." |

---

## What the Next Phase (Phase 3) Will Receive

- All marketing pages (`/`, `/about`, `/services`, `/experts`, `/experts/[slug]`, `/contact`) working and tested.
- `layouts/default.vue` with full navigation and footer.
- Public API endpoints for fetching doctors and submitting contact form.
- SEO meta tags for all marketing pages.
- Responsive design for all pages (mobile-friendly).
- Book Now CTAs linking to `/book` (ready for Phase 3).
- Contact form functional and sending emails to admin.
