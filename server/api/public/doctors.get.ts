import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '~/server/utils/prisma'

const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 12

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return parsed
}

/**
 * Public, unauthenticated list of bookable doctors. Only active Doctor rows
 * belonging to active users are exposed, and only safe public fields.
 *
 * Pagination is server-side; pageSize is hard-capped at 12 even if a larger
 * value is requested. The legacy `doctors` alias is retained for compatibility.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parsePositiveInt(query.page, 1)
  const requestedPageSize = parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE)
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE)

  // Server-side search so results span all pages (the doctor list is paginated).
  // Matches the doctor's patient-visible name, case-insensitively.
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const where: Record<string, unknown> = {
    isActive: true,
    user: { isActive: true },
  }

  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [total, doctors] = await Promise.all([
    prisma.doctor.count({ where }),
    prisma.doctor.findMany({
      where,
      select: {
        id: true,
        slug: true,
        bio: true,
        specializations: true,
        user: { select: { name: true, photo: true } },
      },
      orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  const items = doctors.map((doctor) => ({
    id: doctor.id,
    name: doctor.user.name,
    photo: doctor.user.photo,
    slug: doctor.slug,
    bio: doctor.bio,
    specializations: doctor.specializations,
  }))

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    items,
    doctors: items,
    page,
    pageSize,
    total,
    totalPages,
  }
})
