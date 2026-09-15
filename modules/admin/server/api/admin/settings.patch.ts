import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { settingsPatchSchema, validationMessage } from '~/server/utils/validation'

function maskKey(value: string | null): string {
  if (!value || value.length <= 4) return value ?? ''
  return `****${value.slice(-4)}`
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'SETTINGS', 'UPDATE')

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = settingsPatchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }

  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue
    if ((key === 'paymentGatewayKey' || key === 'paymentGatewaySecret') && typeof value === 'string' && value.startsWith('****')) {
      continue
    }
    data[key] = value
  }

  const settings = await prisma.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...(data as Record<string, never>) },
    update: data,
  })

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
  }
})
