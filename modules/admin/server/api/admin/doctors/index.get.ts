import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'DOCTORS', 'READ')

  const query = getQuery(event)
  const activeOnly = query.active === 'true'

  const doctors = await prisma.doctor.findMany({
    where: activeOnly ? { isActive: true } : {},
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          photo: true,
        },
      },
    },
    orderBy: { isActive: 'desc' },
  })

  return {
    doctors: doctors.map((d) => ({
      id: d.id,
      name: d.user.name,
      email: d.user.email,
      phone: d.user.phone,
      photo: d.user.photo,
      specializations: d.specializations,
      isActive: d.isActive,
      slug: d.slug,
    })),
  }
})