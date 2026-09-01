import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import handler from '~/modules/auth/server/api/auth/verify-email.get'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'

describe('GET /api/auth/verify-email', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    user = await createTestUser({
      emailVerified: false,
      emailVerificationToken: 'VALID_TOKEN',
      emailVerificationExpiry: new Date(Date.now() + 60 * 60 * 1000),
    })
  })

  afterAll(async () => {
    await deleteTestUser(user.id)
  })

  it('verifies a valid token and marks the email as verified', async () => {
    const event = createApiEvent({
      method: 'GET',
      url: `/api/auth/verify-email?token=VALID_TOKEN`,
    })

    const res = await handler(event) as { message: string }

    expect(res.message).toBe('Email verified. You can now log in.')

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated?.emailVerified).toBe(true)
    expect(updated?.emailVerificationToken).toBeNull()
    expect(updated?.emailVerificationExpiry).toBeNull()
  })

  it('rejects an invalid/unknown token with 400', async () => {
    const event = createApiEvent({
      method: 'GET',
      url: `/api/auth/verify-email?token=INVALID_TOKEN`,
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 400, 'Invalid or expired link')
    }
  })

  it('rejects an expired token with 400', async () => {
    const expired = await createTestUser({
      emailVerified: false,
      emailVerificationToken: 'EXPIRED_TOKEN',
      emailVerificationExpiry: new Date(Date.now() - 10 * 1000),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: `/api/auth/verify-email?token=EXPIRED_TOKEN`,
      })

      try {
        await handler(event)
        throw new Error('expected an error')
      } catch (e) {
        expectApiError(e, 400, 'Link has expired')
      }
    } finally {
      await deleteTestUser(expired.id)
    }
  })

  it('rejects a missing token with 400', async () => {
    const event = createApiEvent({
      method: 'GET',
      url: `/api/auth/verify-email`,
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 400, 'Invalid or expired link')
    }
  })
})