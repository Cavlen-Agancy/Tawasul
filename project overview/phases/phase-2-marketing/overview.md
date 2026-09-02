# Phase 2 — Marketing Pages
## overview.md

---

## Goal

Phase 2 builds all public-facing marketing pages for the Tawasul Academy platform. After this phase, visitors can browse the platform, learn about services and experts, and reach the booking flow. Pages use real data from the database where applicable (e.g., experts pulled from DB, contact info from Settings). All pages are public and use the `default` layout with the top navigation bar and footer.

---

## Scope

- **Navigation Bar**: Update `layouts/default.vue` with full navigation (Home, About, Services, Our Experts, Contact) and mobile hamburger menu.
- **Pages**: 6 pages (`/`, `/about`, `/services`, `/experts`, `/experts/[slug]`, `/contact`).
- **Public API Endpoints**: 3 endpoints (`GET /api/public/doctors`, `GET /api/public/doctors/:slug`, `POST /api/public/contact`).
- **SEO**: Add `useSeoMeta` to each page with relevant titles and descriptions.
- **Dynamic Data**: Fetch active doctors from DB for Experts pages. Fetch contact info from Settings for Contact page.

---

## Out of Scope

- Booking flow or any dashboard (Phases 3–6).
- Authentication pages (Phase 1).
- Admin-managed content (e.g., Blog, Events) — structure is ready but not activated in this phase.
- Any user-specific data (e.g., showing logged-in user's name in navbar).

---

## Dependencies

**Must exist from Phase 0:**
- `layouts/default.vue` — public layout (update in this phase).
- `server/utils/prisma.ts` — singleton Prisma client.
- `server/utils/email.ts` — `sendEmail` function.
- `modules/marketing/server/api/public/` directory (create in this phase).
- All `Doctor` and `Settings` model fields in `schema.prisma`.

**Must exist from Phase 1:**
- `middleware/guest.ts` — redirect logged-in users to their dashboard.
- `useAuth` composable — to check auth state for conditional UI (e.g., show "Logout" if logged in).

**Environment Variables:**
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` (for contact form).
- `APP_URL` (for generating absolute URLs).

---

## Stack Used

```
nuxt: ^3.x
shadcn-vue: latest
@nuxtjs/tailwindcss: latest
resend: ^3.x
```

---

## Folder Structure

```
modules/marketing/
├── pages/
│   ├── index.vue              (Home page)
│   ├── about.vue              (About Us)
│   ├── services.vue           (Services)
│   ├── experts.vue            (Our Experts)
│   ├── experts/
│   │   └── [slug].vue         (Expert Profile)
│   └── contact.vue            (Contact Us)
└── server/
    └── api/
        └── public/
            ├── doctors.get.ts          (GET /api/public/doctors)
            ├── doctors/
            │   └── [slug].get.ts       (GET /api/public/doctors/:slug)
            └── contact.post.ts          (POST /api/public/contact)

pages/
└── index.vue                  (Temporary, replaced by modules/marketing/pages/index.vue)

layouts/
└── default.vue                (Update with full navigation)

public/
├── logo.png                   (Tawasul Academy logo)
└── favicon.png                (Favicon)
```

---

## Key Conventions

- **Pages**: Use `definePageMeta` to set layout and middleware.
- **SEO**: Use `useSeoMeta` in each page for title, description, and OpenGraph tags.
- **Data Fetching**: Use `useAsyncData` or `useFetch` for server-side data fetching.
- **shadcn-vue**: Use shadcn-vue components for all UI elements (buttons, cards, inputs, etc.).
- **Navigation**: Use NuxtLink for internal navigation.
- **Error Handling**: Show user-friendly error messages for failed data fetching (e.g., "No experts available at this time.").
- **Empty States**: Use shadcn-vue EmptyState or custom empty states for lists with no data.

---

## Notes for the AI

- The `default` layout must include a responsive navigation bar with links to all marketing pages.
- The Book Now CTA must link to `/book` on all pages (booking flow is built in Phase 3).
- Expert profile pages must show a 404 if the doctor is not found or is inactive.
- Contact form submissions must always return 200, even if email sending fails (do not reveal failures).
- Contact details (phone, email, WhatsApp) must be fetched from the `Settings` singleton record.
- If no active doctors exist in the DB, the Experts section on the Home page must show a placeholder message.
