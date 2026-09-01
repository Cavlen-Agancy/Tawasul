# Phase 0 — Project Setup
## overview.md

---

## Goal

Phase 0 bootstraps the entire technical foundation of the Tawasul Academy platform. By the end of this phase, the development environment runs completely inside Docker, PostgreSQL is connected and seeded, Prisma schema is applied, HeroUI is configured with the brand colors, the module folder structure exists, all shared server utilities are written, and the base layouts are in place. No feature code is written in this phase — only infrastructure. The coding agent who receives Phase 1 must be able to start writing feature code immediately without any setup work.

---

## Scope

- Initialize Nuxt 3 project with TypeScript and SSR enabled
- Install all project dependencies (exact list below)
- Copy provided config files: `nuxt.config.ts`, `schema.prisma`, `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml`, `Dockerfile.dev`, `Dockerfile.prod`
- Create `.env` from `.env.example` with development values filled in
- Create `docker-compose.yml` and both Dockerfiles
- Create `.dockerignore` and `.gitignore`
- Create the full module folder structure (all folders, even if empty)
- Write `server/utils/prisma.ts` — singleton Prisma client
- Write `server/utils/auth.ts` — hashPassword, comparePassword, generateJWT, verifyJWT, generateToken, requireAuth
- Write `server/utils/email.ts` — sendEmail function + all 6 email templates
- Write `server/utils/permissions.ts` — requirePermission function
- Write `server/middleware/auth.ts` — global JWT cookie reader
- Configure HeroUI with brand colors in `nuxt.config.ts` and `tailwind.config.ts`
- Create `assets/css/tailwind.css` and `assets/css/main.css`
- Create `layouts/default.vue` — public layout with navbar and footer
- Create `layouts/dashboard.vue` — base dashboard layout with sidebar slot
- Write `prisma/seed.ts` — creates Settings singleton and seed admin account
- Apply schema with `prisma db push`
- Run seed with `prisma db seed`
- Initialize Git repository with correct branches
- Verify everything works with the check list at the end

---

## Out of Scope

- Any authentication pages or logic (Phase 1)
- Any marketing pages (Phase 2)
- Any booking or payment logic (Phase 3)
- Any dashboard pages (Phases 4–6)
- Production deployment (Phase 7)
- The actual content of the navbar links — just the shell with placeholder links
- Any real email sending beyond a single test — just verify the utility works

---

## Dependencies

Nothing. This is the first phase. The coding agent starts from zero.

Required external accounts before starting:
- Resend account with a verified sender domain (for `RESEND_FROM_EMAIL` and `RESEND_API_KEY`)
- Docker Desktop installed on the development machine

---

## Stack Used

```
nuxt: ^3.x
@heroui/nuxt: latest
@nuxtjs/tailwindcss: latest
@vueuse/nuxt: latest
@nuxt/image: latest
prisma: ^5.x
@prisma/client: ^5.x
bcryptjs: ^2.x
@types/bcryptjs: ^2.x
jsonwebtoken: ^9.x
@types/jsonwebtoken: ^9.x
resend: ^3.x
zod: ^3.x
typescript: ^5.x
vitest: ^1.x
@vitejs/plugin-vue: latest
```

---

## Folder Structure

The coding agent must create every file and folder listed below. Folders marked with `(empty)` need to exist but contain no files yet.

```
tawasul/
├── .env                          (created from .env.example — not committed)
├── .env.example                  (copy from provided file)
├── .gitignore
├── .dockerignore
├── docker-compose.yml            (copy from provided file)
├── docker-compose.prod.yml       (copy from provided file)
├── Dockerfile.dev                (copy from provided file)
├── Dockerfile.prod               (copy from provided file)
├── nuxt.config.ts                (copy from provided file)
├── tailwind.config.ts            (create — see flow.md)
├── package.json
├── tsconfig.json
│
├── prisma/
│   ├── schema.prisma             (copy from provided file)
│   └── seed.ts                   (create — see flow.md)
│
├── server/
│   ├── middleware/
│   │   └── auth.ts               (create — see flow.md)
│   └── utils/
│       ├── prisma.ts             (create — see flow.md)
│       ├── auth.ts               (create — see flow.md)
│       ├── email.ts              (create — see flow.md)
│       └── permissions.ts        (create — see flow.md)
│
├── middleware/                   (empty — route middleware added in Phase 1)
│
├── layouts/
│   ├── default.vue               (create — see flow.md)
│   └── dashboard.vue             (create — see flow.md)
│
├── pages/
│   └── index.vue                 (create — temporary test page only)
│
├── plugins/                      (empty — auth plugin added in Phase 1)
│
├── components/                   (empty)
├── composables/                  (empty)
│
├── assets/
│   └── css/
│       ├── tailwind.css          (create)
│       └── main.css              (create)
│
├── public/
│   ├── logo.png                  (place Tawasul Academy logo here)
│   └── favicon.png               (place favicon here)
│
├── uploads/                      (empty — created by Docker volume)
│
└── modules/
    ├── auth/
    │   ├── components/           (empty)
    │   ├── composables/          (empty)
    │   ├── pages/                (empty)
    │   └── server/
    │       └── api/
    │           └── auth/         (empty)
    ├── booking/
    │   ├── components/           (empty)
    │   ├── composables/          (empty)
    │   ├── pages/                (empty)
    │   └── server/
    │       └── api/
    │           └── booking/      (empty)
    ├── payment/
    │   ├── components/           (empty)
    │   ├── composables/          (empty)
    │   ├── pages/                (empty)
    │   └── server/
    │       └── api/
    │           └── payment/      (empty)
    ├── patient/
    │   ├── components/           (empty)
    │   ├── composables/          (empty)
    │   ├── pages/                (empty)
    │   └── server/
    │       └── api/
    │           └── patient/      (empty)
    ├── doctor/
    │   ├── components/           (empty)
    │   ├── composables/          (empty)
    │   ├── pages/                (empty)
    │   └── server/
    │       └── api/
    │           └── doctor/       (empty)
    ├── admin/
    │   ├── components/           (empty)
    │   ├── composables/          (empty)
    │   ├── pages/                (empty)
    │   └── server/
    │       └── api/
    │           └── admin/        (empty)
    └── session/
        ├── components/           (empty)
        ├── composables/          (empty)
        ├── pages/                (empty)
        └── server/
            └── api/
                └── session/      (empty)
```

---

## Key Conventions

- **Prisma client:** Import only from `server/utils/prisma.ts`. Never instantiate `PrismaClient` anywhere else in the codebase.
- **Environment variables:** Always read from `useRuntimeConfig()` in server code, never from `process.env` directly in route handlers.
- **TypeScript:** Strict mode on. No `any` types without an explanatory comment.
- **HeroUI:** Use `color="primary"` prop for brand-colored elements. Never hardcode `#E91E8C` in component templates.
- **Email:** All email sending goes through `sendEmail()` from `server/utils/email.ts`. Never call Resend directly in a route handler.
- **Auth protection:** All protected routes must call `requireAuth()` as the absolute first line of the handler.
- **Error responses:** Always return `{ message: string }` as the response body for errors. Never return raw error objects.
