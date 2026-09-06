import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  const settings = await prisma.settings.findUnique({
    where: { id: 'singleton' },
    select: { contactEmail: true, contactPhone: true, whatsappNumber: true },
  })

  if (!settings) {
    throw createError({ statusCode: 404, message: 'Settings not found' })
  }

  return settings
})
