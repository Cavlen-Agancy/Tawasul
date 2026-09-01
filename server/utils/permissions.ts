import { createError, type H3Event } from 'h3'
import { prisma } from './prisma'
import { requireAuth } from './auth'

export async function requirePermission(event: H3Event, resource: string, action: string): Promise<void> {
  const user = requireAuth(event, ['STAFF'])

  const permissions = await prisma.permission.findMany({
    where: { userId: user.userId, resource: resource as never, action: action as never },
  })

  if (permissions.length === 0) {
    throw createError({ statusCode: 403, message: 'You do not have permission to perform this action' })
  }
}