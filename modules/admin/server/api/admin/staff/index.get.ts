import { defineEventHandler } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'STAFF', 'READ')

  const seedEmail = process.env.SEED_ADMIN_EMAIL

  const staff = await prisma.user.findMany({
    where: {
      accountType: 'STAFF',
      ...(seedEmail ? { email: { not: seedEmail } } : {}),
    },
    include: {
      permissions: { select: { resource: true, action: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      photo: s.photo,
      isActive: s.isActive,
      permissions: s.permissions,
    })),
  }
})
