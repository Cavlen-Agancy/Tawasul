# Phase 5 — Blog Management & Public Content

**Requirement:** C — Blog Management System.  
**Decision status:** D1 (`publishedAt`), D2 (Unicode slugs/immutability), and D3 (public visibility/no-cache) are DECIDED. These are implementation rules, not owner-approval items.  
**Priority rationale:** Business Impact 2, UX Severity 3, Security Risk 3, Technical Risk 2. Independent of booking/payment; placed after the business-critical work.

## 1. Business Objective

Give the academy a simple first-party blog:

- admins can create, edit, delete, and publish/unpublish articles;
- visitors can browse published articles and read an individual article;
- drafts and unpublished posts are never publicly accessible.

The implementation must fit the existing Nuxt/Prisma/modular-monolith stack and must not introduce a CMS dependency.

## 2. Scope

Included:

- Prisma `BlogPost` model + `BlogStatus` enum.
- `BLOG` RBAC resource.
- Admin list/create/edit/delete/publish UI.
- Public listing and article pages.
- Public APIs restricted to published posts.
- Plain-text content rendering with no `v-html`.
- Navigation/footer links and SEO metadata.
- Validation and tests.

Out of scope:

- Categories/tags, comments, likes, authors directory, rich media uploads.
- Markdown/HTML rendering, WYSIWYG editors, CMS integrations.
- Scheduling future publication (not supported in this release; public visibility is `status=PUBLISHED` only).
- Blog search.
- Email verification or any auth change.

## 3. Prerequisites

- Phase 2's admin/doctor nav patterns are merged.
- Existing admin layout and `PermissionBuilder` are the insertion points.
- Database snapshot/backup before migration.
- No new package required for the recommended plain-text implementation.

## 4. Current Facts

- No blog model, API, page, or navigation exists. **MISSING.**
- No markdown/renderer/CMS dependency exists in `package.json`. **CONFIRMED.**
- Admin navigation is a static array in `layouts/admin.vue` filtered by `hasPermission(resource, 'READ')`. **CONFIRMED.**
- Admin page permissions use `definePageMeta({ permission: { resource, action } })` and `staff-only` maps unknown paths by prefix. **CONFIRMED.**
- `PermissionBuilder.vue` has a hard-coded six-resource list. **CONFIRMED.**
- Staff permission validation has duplicated resource sets in `staff/index.post.ts` and `staff/[id].patch.ts`. **CONFIRMED.**
- Public layout nav is generated from `homeNavItems` in `lib/home-content.ts`; `/blog` can be added as an anchor-style link. **CONFIRMED.**

## 5. Implementation Tasks

### Task 1: Add the database model and RBAC resource

**Files:**
- Modify: `prisma/schema.prisma`
- Add migration: `prisma/migrations/<timestamp>_blog/migration.sql` (proposed; not authored here)
- Modify: `prisma/seed.ts`
- Modify: `modules/admin/components/PermissionBuilder.vue`
- Modify: `modules/admin/server/api/admin/staff/index.post.ts`
- Modify: `modules/admin/server/api/admin/staff/[id].patch.ts`
- Modify: `middleware/staff-only.ts`
- Modify: `layouts/admin.vue`

Schema:

```prisma
enum BlogStatus {
  DRAFT
  PUBLISHED
}

model BlogPost {
  id          String     @id @default(cuid())
  slug        String     @unique
  title       String
  excerpt     String?
  content     String
  status      BlogStatus @default(DRAFT)
  publishedAt DateTime?
  authorId    String?
  author      User?      @relation("BlogPosts", fields: [authorId], references: [id], onDelete: SetNull)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([status, publishedAt])
  @@map("blog_posts")
}
```

Add to `User`:

```prisma
blogPosts BlogPost[] @relation("BlogPosts")
```

Resource:

- Add `BLOG` to the `Resource` enum.
- Add all four BLOG actions to the seed admin's permission list (14 → 18).
- Add `BLOG` to `PermissionBuilder` `RESOURCES`.
- Add `BLOG` to both admin staff validation `VALID_RESOURCES` sets. Prefer extracting a single shared constant to prevent drift.
- Add `/admin/blog` → `BLOG` mapping in `middleware/staff-only.ts` (or rely on page meta; both is fine).
- Add an admin nav item:
  - label “Blog”
  - `to: '/admin/blog'`
  - icon from `lucide-vue-next` (e.g., `Newspaper` or `FileText`)
  - `resource: 'BLOG'`

Acceptance:

- Only staff with `BLOG:READ` can open the admin blog page.
- Only `BLOG:CREATE/UPDATE/DELETE` actions can mutate posts.
- A staff member with only `SETTINGS` permissions cannot manage blog posts.
- Seed admin can manage blog posts.

### Task 2: Add validation schemas

**Files:**
- Modify: `server/utils/validation.ts`
- Add: `server/utils/slug.ts` (shared Unicode-aware generator/normalizer)

Add:

```ts
export const blogPostCreateSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().trim().min(3).max(120)
    .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, 'Invalid slug')
    .optional(),
  excerpt: z.string().max(500).optional().or(z.literal('')),
  content: z.string().min(1).max(50000),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
})

export const blogPostPatchSchema = blogPostCreateSchema.partial()
```

Rules (D2):

- If slug is omitted on create, generate from the title via the shared Unicode-aware helper:
  - normalize Unicode; lowercase Latin; trim;
  - replace whitespace with `-`;
  - remove control/punctuation/unsafe characters;
  - allow Unicode letters (Arabic/Latin), numbers, and hyphens;
  - collapse repeated hyphens and trim leading/trailing hyphens.
- If the generated slug is empty, use `post-<base36 timestamp>` and verify uniqueness.
- If a generated slug already exists, append `-2`, `-3`, etc. until unique.
- If an admin supplies a slug that already exists, reject with `409`; do not silently suffix an explicit slug.
- Slug is editable while DRAFT. Once the post has ever been published, the slug is immutable; do not break public links.
- Trim title/excerpt/content.
- Reject empty content.
- `publishedAt` is set server-side only on first transition to `PUBLISHED`; never trust a client timestamp.
- Public lookup supports Unicode/percent-encoded Arabic slugs; route decoding must not bypass publication checks.

### Task 3: Build admin APIs

**Files:**
- Add: `modules/blog/index.ts` (module server scan; mirror existing module pattern)
- Add: `modules/blog/server/api/admin/blog/index.get.ts`
- Add: `modules/blog/server/api/admin/blog/index.post.ts`
- Add: `modules/blog/server/api/admin/blog/[id].get.ts`
- Add: `modules/blog/server/api/admin/blog/[id].patch.ts`
- Add: `modules/blog/server/api/admin/blog/[id].delete.ts`
- Modify: `nuxt.config.ts` if a blog module component/import path is added.

Endpoint behavior:

- `GET /api/admin/blog`
  - requires `requirePermission(event, 'BLOG', 'READ')`
  - returns all statuses
  - supports optional `status`, `search`, `page`, `limit`
  - returns `{ posts, total }` or `{ posts }` consistently with the repo's style
- `POST /api/admin/blog`
  - requires `BLOG:CREATE`
  - validates body
  - generates a Unicode slug if absent, with `-2` suffix on generated collision
  - explicit duplicate slug → `409`
  - sets `authorId = auth.userId`
  - if `status === 'PUBLISHED'`, sets `publishedAt` to now **only if it is null**
  - returns 201
- `GET /api/admin/blog/:id`
  - requires `BLOG:READ`
- `PATCH /api/admin/blog/:id`
  - requires `BLOG:UPDATE`
  - validates body
  - enforces unique slug; **rejects any slug change once the post has ever been published**
  - preserves `publishedAt` on edits, unpublish, and republish; sets it only on first publish when null
  - if no `publishedAt` exists on a legacy published row, set it from `createdAt` during migration
  - if status becomes `DRAFT`, keep `publishedAt` for audit; public query still requires `status = PUBLISHED`
  - does not let the client set `authorId`, `createdAt`, or `publishedAt`
- `DELETE /api/admin/blog/:id`
  - requires `BLOG:DELETE`
  - hard delete with a clear response
  - UI must confirm before calling
  - no public route can retrieve a deleted post

Do not expose draft posts through any public endpoint.

### Task 4: Build the admin UI

**Files:**
- Add: `pages/admin/blog.vue` (follow flat admin route convention)
- Add: `modules/blog/components/BlogEditor.vue` (optional; use a single focused component)
- Modify: `layouts/admin.vue` (nav item)
- Modify: `modules/admin/composables/useAdminDashboard.ts` or add a dedicated `modules/blog/composables/useBlogAdmin.ts` (prefer dedicated composable)
- Tests: `tests/e2e/admin-panel.spec.ts` or a new `tests/e2e/admin-blog.spec.ts`

Page requirements:

- `definePageMeta({ layout: 'admin', middleware: 'staff-only', permission: { resource: 'BLOG', action: 'READ' } })`
- List columns: title, slug, status, published date, updated date, actions.
- Search/filter by status.
- Create button opens an editor form.
- Editor fields:
  - title
  - slug (auto-suggested Unicode value; editable only while DRAFT; disabled after first publish)
  - excerpt
  - content (textarea, plain text)
  - status select: Draft / Published
  - publication date display (server-managed, read-only)
- Save, publish/unpublish, delete with confirmation.
- Loading, empty, error, and success states.
- Responsive layout consistent with the admin panel.
- No `v-html` anywhere.
- Show character limits and validation errors from the server.

Acceptance:

- An authorized admin can create a draft, edit it, publish it, and delete it.
- A user without `BLOG` permissions cannot see the nav item and is redirected from `/admin/blog`.
- API calls enforce permissions even if the UI is bypassed.
- Duplicate slugs are handled without a crash.

### Task 5: Build public APIs

**Files:**
- Add: `modules/blog/server/api/public/blog/index.get.ts`
- Add: `modules/blog/server/api/public/blog/[slug].get.ts`
- Or add to `server/api/public/blog/` if the module scan is not desired; pick one convention and use it consistently.

Behavior:

- `GET /api/public/blog`
  - `status = PUBLISHED` only; no scheduling gate (`publishedAt` is metadata, not visibility)
  - pagination (`page`, `limit`, defaults e.g. 10/20)
  - safe fields: title, slug, excerpt, publishedAt, author display name (optional)
  - never includes full `content` if the listing does not need it
- `GET /api/public/blog/:slug`
  - `status = PUBLISHED` only
  - 404 for missing/draft/unpublished/deleted
  - returns title, slug, excerpt, content, publishedAt, author display name
- No authentication required.
- No admin fields (`authorId`, status, internal ids if unnecessary).
- Validate Unicode slug format and pagination bounds.
- Use a deterministic ordering: `publishedAt desc`, then `createdAt desc`.
- Set `Cache-Control: no-store` (or disable shared caching) in the first release. Do not cache draft-sensitive responses.
- Use one server-side `publishedPostWhere` helper so API, SSR page, and metadata cannot drift.

### Task 6: Build public pages and navigation

**Files:**
- Add: `modules/blog/pages/blog.vue` (maps to `/blog` under the project's custom `pages:extend` scanner)
- Add: `modules/blog/pages/blog/[slug].vue`
- Modify: `lib/home-content.ts` (`homeNavItems`)
- Modify: `layouts/default.vue` only if the nav rendering needs a non-hash link
- Tests: new `tests/e2e/blog.spec.ts`

Listing page `/blog`:

- Fetch published posts with `useFetch`/`useAsyncData` (SSR-friendly).
- Show title, excerpt, published date.
- Loading skeleton, empty state (“No articles published yet”), error state.
- Pagination or “load more” if posts exceed the page size.
- Links to `/blog/:slug` (Unicode slugs are encoded by the router).
- SEO title/description only from published data.
- No shared cache; `Cache-Control: no-store` or equivalent.

Article page `/blog/:slug`:

- Fetch the published post server-side.
- 404 for draft/unpublished/deleted/missing; do not reveal that a draft exists.
- Render title, date, author (optional), excerpt, and plain-text content.
- Content rendering:
  - split on blank lines into paragraphs;
  - use `white-space: pre-line` or paragraph elements;
  - no `v-html`.
- SEO metadata only from the published record.
- Back-to-blog link.
- Responsive RTL layout matching public pages.
- Decode Unicode/percent-encoded slugs safely; never use the raw route param in a privileged query.

Navigation:

- Add “المدونة” (Blog) to `homeNavItems` with `href: 'blog'` so the existing `/${href}` rendering produces `/blog`.
- Add a footer link if the footer has an appropriate content column.
- Do not create a dead `#blog` anchor on the homepage.

Acceptance:

- `/blog` lists only published posts.
- `/blog/:slug` shows only a published post.
- Draft access returns 404.
- Navigation works on desktop and mobile.
- No XSS is possible through plain text content.

### Task 7: Content safety and publication rules

**Files:**
- Admin page validation and API renderer.

Rules:

- `content` is stored as plain text.
- The public page must not use `v-html`.
- If Markdown/HTML is later approved, it must be sanitized server-side with an allowlist and covered by XSS tests; it is not part of this phase.
- Only `status === 'PUBLISHED'` is public. `publishedAt` is display/order metadata, not a visibility gate in this release.
- Unpublish: keep `publishedAt`, immediately hide from listing/detail/API/metadata.
- Republish: preserve original `publishedAt`; do not reset the order.
- Delete: hard delete; UI confirms; public route 404.
- No shared/public caching in the first release; use `no-store` or disable cache. If caching is added later, it must be status-aware and invalidated on publish/unpublish/delete.
- Do not expose draft titles, excerpts, IDs, or metadata in public listing counts, SEO, sitemap, or error messages.
- No draft preview route in this release; if added later it must require authenticated preview authorization.

### Task 8: Tests and fixtures

**Files:**
- Add: `tests/api/public/blog.get.test.ts`
- Add: `tests/api/public/blog/[slug].get.test.ts`
- Add: `tests/api/admin/blog.test.ts`
- Add: `tests/e2e/blog.spec.ts`
- Modify: `tests/e2e/admin-panel.spec.ts` for nav/permission coverage

Required tests:

- Admin create draft → not public.
- Admin publish → sets `publishedAt` once; public listing/detail.
- Edit published → `publishedAt` unchanged.
- Unpublish → hides publicly but keeps `publishedAt`.
- Republish → keeps original `publishedAt` and original order.
- Generated Arabic title → valid non-empty Unicode slug.
- Generated duplicate title → `-2`/`-3` suffix; explicit duplicate slug → 409.
- Draft slug editable; published slug immutable.
- Invalid/empty/path-traversal slug rejected.
- Public API excludes drafts and deleted posts; no-store headers/behavior.
- Public SSR/metadata excludes drafts.
- Blog CRUD requires correct BLOG permission.
- Staff without BLOG cannot access admin page/API.
- E2E:
  - admin creates/publishes a post;
  - public listing shows it;
  - article renders with an Arabic slug;
  - unpublish/delete hides it;
  - draft URL 404.
- XSS regression: content containing `<script>` renders as text, not executable markup.

## 6. Expected Database Changes

- Add `BlogStatus` enum.
- Add `BlogPost` table with unique slug and status/published index.
- Add optional `authorId` relation; `onDelete: SetNull`.
- Add `BLOG` to `Resource` enum.
- Seed admin gets BLOG permissions.
- Additive migration; no existing table changes.
- Rollback: keep the table; remove nav/routes if needed. Dropping the table is destructive and not part of normal rollback.

## 7. Expected API Changes

New endpoints only; no existing endpoint changes.

Public:

- `GET /api/public/blog`
- `GET /api/public/blog/:slug`

Admin:

- `GET /api/admin/blog`
- `POST /api/admin/blog`
- `GET /api/admin/blog/:id`
- `PATCH /api/admin/blog/:id`
- `DELETE /api/admin/blog/:id`

## 8. UI/UX Considerations

- Follow existing admin panel styling: cards, table, form inputs, destructive confirmations.
- Blog editor must be usable on mobile; a textarea is acceptable.
- Slug helper should show the final URL.
- Public listing should not be confused with homepage training cards; use a distinct “المدونة” label.
- RTL text must wrap correctly; long words/URLs should not overflow.
- Empty states must be real, not fake sample articles.
- Published date uses a consistent locale/timezone; store UTC, render in the site's chosen display zone.

## 9. Acceptance Criteria

1. Admin can create, edit, publish/unpublish, and delete posts.
2. Only published posts are publicly accessible.
3. Draft/unpublished/deleted URLs return 404.
4. D1: first publish sets `publishedAt`; edits/unpublish/republish preserve it.
5. D2: Arabic titles generate valid Unicode slugs; generated collisions suffix; explicit duplicates 409; published slugs immutable.
6. D3: public listing/detail/SSR/metadata are published-only, no shared cache.
7. Blog management uses the `BLOG` RBAC resource.
8. Public listing and detail pages render without a CMS dependency.
9. Content rendering cannot execute HTML/JS.
10. Navigation links work on desktop/mobile.
11. Tests cover visibility, publication transitions, slug policy, permissions, and XSS.
12. No existing booking/payment/session behavior is touched.

## 10. Risks and Dependencies

- **Risk:** XSS if HTML rendering is introduced later. Plain text is the safe baseline.
- **Risk:** Slug collisions. Enforce uniqueness; generated collisions suffix, explicit collisions 409.
- **Risk:** Permission drift between the two staff validation files and PermissionBuilder. Extract a shared resource constant if practical.
- **Risk:** Public caching could serve a draft; no shared cache in this release.
- **Risk:** Immutable published slug means typos cannot be fixed in place; documented recovery is a new post, not a redirect.
- **Dependency:** Admin layout/nav patterns from Phase 2; no booking dependency.
- **Rollback:** additive; disable nav/routes if needed; do not drop data without approval.

## 11. Definition of Done

- Migration applied in staging.
- Admin CRUD + publication verified.
- Public listing/detail verified; drafts/deleted 404.
- PublishedAt transition tests pass.
- Unicode slug/collision/immutability tests pass.
- No-cache/SSR/meta draft-isolation tests pass.
- Plain-text XSS regression test passes.
- No new dependency added.
- No booking/payment/session code modified.
