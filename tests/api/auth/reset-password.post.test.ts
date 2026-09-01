import { describe, expect, it, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import handler from '~/modules/auth/server/api/auth/reset-password.post'
import { comparePassword } from '~/server/utils/auth'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'

describe('POST /api/auth/reset-password', () => {
  const toDelete: string[] = []

  afterAll(async () => {
    await Promise.all(toDelete.map((id) => deleteTestUser(id)))
  })

  it('updates the password with a valid token', async () => {
    const user = await createTestUser({
      emailVerified: true,
      password: 'OldPass123!',
      email: `reset-ok-${Date.now()}@test.com`,
      passwordResetToken: 'VALID_TOKEN',
      passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000),
    })
    toDelete.push(user.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/reset-password',
      body: { token: 'VALID_TOKEN', newPassword: 'NewPass123!' },
    })

    const res = await handler(event) as { message: string }
    expect(res.message).toBe('Password updated successfully.')

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(await comparePassword('NewPass123!', updated?.password ?? '')).toBe(true)
    expect(updated?.passwordResetToken).toBeNull()
    expect(updated?.passwordResetExpiry).toBeNull()
  })

  it('rejects an unknown token with 400', async () => {
    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/reset-password',
      body: { token: 'INVALID_TOKEN', newPassword: 'NewPass123!' },
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 400, 'Invalid or expired link')
    }
  })

  it('rejects an expired token with 400', async () => {
    const user = await createTestUser({
      email: `reset-expired-${Date.now()}@test.com`,
      passwordResetToken: 'EXPIRED_TOKEN',
      passwordResetExpiry: new Date(Date.now() - 10 * 1000),
    })
    toDelete.push(user.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/reset-password',
      body: { token: 'EXPIRED_TOKEN', newPassword: 'NewPass123!' },
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 400, 'Link has expired')
    }
  })

  it('rejects a short new password with 400', async () => {
    const user = await createTestUser({
      email: `reset-short-${Date.now()}@test.com`,
      passwordResetToken: 'VALID_TOKEN',
      passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000),
    })
    toDelete.push(user.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/reset-password',
      body: { token: 'VALID_TOKEN', newPassword: '123' },
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 400, 'Password must be at least 8 characters')
    }
  })
})