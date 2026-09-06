import { defineEventHandler, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'

export function maskKey(value: string | null): string {
  if (!value || value.length <= 4) return value ?? ''
  return `****${value.slice(-4)}`
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'SETTINGS', 'READ')

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  if (!settings) {
    throw createError({ statusCode: 404, message: 'Settings not found' })
  }

  return {
    id: settings.id,
    platformName: settings.platformName,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    whatsappNumber: settings.whatsappNumber,
    paymentGateway: settings.paymentGateway,
    paymentGatewayKey: maskKey(settings.paymentGatewayKey),
    paymentGatewaySecret: maskKey(settings.paymentGatewaySecret),
    sessionPricePerHour: Number(settings.sessionPricePerHour),
    defaultSessionDuration: settings.defaultSessionDuration,
    defaultWorkingStart: settings.defaultWorkingStart,
    defaultWorkingEnd: settings.defaultWorkingEnd,
    jitsiDomain: settings.jitsiDomain,
  }
})
