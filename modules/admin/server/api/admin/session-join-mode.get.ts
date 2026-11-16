import { defineEventHandler } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'
import { DEFAULT_SESSION_JOIN_MODE, normalizeSessionJoinMode } from '~/lib/session-join'

/**
 * ADMIN-only read of the Session Join Mode. Returns only the mode string; no
 * other platform settings and no secrets. Non-admin roles are rejected before
 * any database access.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const settings = await prisma.settings.findUnique({
    where: { id: 'singleton' },
    select: { sessionJoinMode: true },
  })

  return { mode: normalizeSessionJoinMode(settings?.sessionJoinMode ?? DEFAULT_SESSION_JOIN_MODE) }
})
