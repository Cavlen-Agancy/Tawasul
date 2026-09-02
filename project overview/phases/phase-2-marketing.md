# Phase 2 — Marketing Pages

## Goal
Build all public-facing marketing pages. After this phase, visitors can browse the platform, learn about services and experts, and reach the booking flow. Pages use real data from the database where applicable.

---

## Stack Used in This Phase
- Nuxt pages + default layout
- shadcn-vue components
- Prisma (Doctor, Settings models — read only)
- Resend (contact form email)

---

## Overview

All pages in this phase are public — no authentication required. They use the `default` layout with the top navigation bar and footer. Content is a mix of static (About, FAQ) and dynamic (Experts pulled from DB, Settings pulled for contact info).

---

## Step 1 — Navigation Bar (default layout update)

Update `layouts/default.vue` with full navigation:

Links: Home, About, Services, Our Experts, Contact
Right side: Login button (shadcn-vue Button, variant outline) + Book Now button (shadcn-vue Button, primary color `#E91E8C`)

On mobile: hamburger menu that opens a shadcn-vue Drawer with the same links.

Logo: display the Tawasul Academy logo from `/public/logo.png`. Link to `/`.

---

## Step 2 — Pages

All pages inside `modules/marketing/pages/` or `pages/` depending on project structure choice.

---

### `/` — Home Page

Sections in order:

**Hero Section**
- Large headline: "Your Path to Mental Wellness Starts Here"
- Subheadline: brief platform description
- Two buttons: "Book a Session" (primary) → `/book`, "Learn More" (outline) → `/about`
- Background: soft magenta gradient from `#E91E8C` to `#F472B6` at low opacity behind a white card, or full-width image

**Services Section**
- Section title: "Our Services"
- Grid of service cards (shadcn-vue Card) — 3 columns on desktop, 1 on mobile
- Services are static for MVP: Marital Counseling, Family Counseling, Parenting Consultation, Psychological Support, Personal Development
- Each card: icon, title, short description, "Book Now" button → `/book`

**Our Experts Section**
- Section title: "Meet Our Experts"
- Fetch active doctors from `GET /api/public/doctors` (max 4, isActive: true)
- Doctor cards: photo, name, specializations tags
- "View All Experts" button → `/experts`

**Testimonials Section**
- Static for MVP — 3 testimonial cards with quote, name, and star rating

**CTA Section**
- Full-width section with magenta background
- Headline: "Ready to Start Your Journey?"
- "Book Your First Session" button (white, links to /book)

---

### `/about` — About Us

Static content page:
- Who We Are (paragraph)
- Our Vision (paragraph)
- Our Mission (paragraph)
- Why Choose Tawasul (4 feature cards with icon + text)

---

### `/services` — Services

Static content page:
- Page title + intro paragraph
- One section per service with: title, description, what to expect, Book a Session button → `/book`
- Services: Marital Counseling, Family Counseling, Parenting Consultation, Psychological Support, Personal Development

---

### `/experts` — Our Experts

Dynamic page:
- Fetch all active doctors from `GET /api/public/doctors`
- Grid of doctor cards: photo, name, specializations, "Book a Session" button → `/book`
- If no doctors: show a friendly empty state

---

### `/experts/[slug]` — Expert Profile

Dynamic page:
- Fetch doctor by slug from `GET /api/public/doctors/:slug`
- If not found: show 404 page
- Display: photo, name, specializations, full bio
- "Book a Session" button → `/book`
- If not logged in and user clicks Book: redirect to `/login` first, then back to `/book`

---

### `/contact` — Contact Us

Sections:
- Contact form: Name, Email, Phone, Message fields (shadcn-vue Input + Textarea)
- On submit: POST /api/public/contact — sends email to admin via Resend
- Always show success message after submit
- Contact details pulled from Settings: phone, email, WhatsApp

---

## Step 3 — Public API Endpoints

Create inside `modules/marketing/server/api/public/` or `server/api/public/`.

### GET /api/public/doctors
- No auth required
- Fetch all Users with accountType DOCTOR and isActive true, with their Doctor record
- Return: id, name, photo, slug, specializations, bio (truncated to 150 chars)
- Sort by name ascending

### GET /api/public/doctors/:slug
- No auth required
- Fetch Doctor by slug where isActive true
- Return: id, name, photo, slug, specializations, full bio
- Return 404 if not found or inactive

### POST /api/public/contact
- No auth required
- Validate: name (required), email (required, valid format), message (required, min 10 chars)
- Send email to admin contact email (from Settings) with the form data
- Return 200 always (do not reveal if email sent failed)

---

## Step 4 — SEO

Add `useSeoMeta` to each page with relevant title and description:
- Home: "Tawasul Academy — Online Mental Health Counseling"
- About: "About Us | Tawasul Academy"
- Services: "Our Services | Tawasul Academy"
- Experts: "Our Experts | Tawasul Academy"
- Contact: "Contact Us | Tawasul Academy"

---

## Checks — Phase 2 Complete

- [ ] Home page loads with real doctor data from DB (Experts section)
- [ ] Experts page shows only active doctors
- [ ] Expert profile loads correctly by slug
- [ ] Expert profile shows 404 for unknown slugs
- [ ] Book a Session button on all pages links correctly to /book
- [ ] Contact form submits and admin receives email
- [ ] All pages are responsive on 375px mobile viewport
- [ ] Navigation links work correctly on desktop and mobile
- [ ] Hamburger menu opens and closes on mobile
- [ ] Logo links to home page
- [ ] shadcn-vue components render with correct brand colors

---

## Notes for the AI

- Doctors section on Home page: if no active doctors in DB yet, show a placeholder message — never crash.
- Contact details in the footer and contact page come from the Settings record — always fetch them server-side to avoid hardcoding.
- The Book Now CTA must link to `/book` on all pages. The booking flow is built in Phase 3.
- Do not build the booking flow or any dashboard in this phase. Only marketing pages.
- Keep all marketing page content in the Nuxt pages — no CMS for MVP.
