import { createError, type H3Event } from 'h3'
import { prisma } from './prisma'
import { requireAuth, type AuthUser } from './auth'

/**
 * STAFF permission gate for the existing admin modules. ADMIN is a distinct
 * platform role and is not expressed through the STAFF permission table, so it
 * passes without a permission lookup. STAFF behaviour is unchanged.
 */
export async function requirePermission(event: H3Event, resource: string, action: string): Promise<AuthUser> {
  const user = requireAuth(event, ['STAFF', 'ADMIN'])
  if (user.accountType === 'ADMIN') return user

  const permissions = await prisma.permission.findMany({
    where: { userId: user.userId, resource: resource as never, action: action as never },
  })

  if (permissions.length === 0) {
    throw createError({ statusCode: 403, message: 'You do not have permission to perform this action' })
  }

  return user
}
