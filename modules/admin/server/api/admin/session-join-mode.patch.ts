import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'
import { sessionJoinModePatchSchema, validationMessage } from '~/server/utils/validation'

/**
 * ADMIN-only write of the Session Join Mode. Deliberately separate from the
 * general settings PATCH so STAFF permissions can never change it.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = sessionJoinModePatchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }

  const settings = await prisma.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', sessionJoinMode: parsed.data.mode },
    update: { sessionJoinMode: parsed.data.mode },
    select: { sessionJoinMode: true },
  })

  return { mode: settings.sessionJoinMode }
})
