import { describe, expect, it, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import handler from '~/modules/auth/server/api/auth/forgot-password.post'
import { createApiEvent, createTestUser, deleteTestUser } from '../helpers'

const SUCCESS = 'If this email exists, a reset link has been sent.'

describe('POST /api/auth/forgot-password', () => {
  const toDelete: string[] = []

  afterAll(async () => {
    await Promise.all(toDelete.map((id) => deleteTestUser(id)))
  })

  it('returns success and stores a reset token for an existing email', async () => {
    const user = await createTestUser({ emailVerified: true, email: `forgot-${Date.now()}@test.com` })
    toDelete.push(user.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/forgot-password',
      body: { email: user.email },
    })

    const res = await handler(event) as { message: string }
    expect(res.message).toBe(SUCCESS)

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated?.passwordResetToken).toBeTruthy()
    expect(updated?.passwordResetExpiry).not.toBeNull()
  })

  it('returns the same success message for a non-existent email', async () => {
    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/forgot-password',
      body: { email: 'nonexistent@test.com' },
    })

    const res = await handler(event) as { message: string }
    expect(res.message).toBe(SUCCESS)
  })

  it('returns the same success message for an invalid email format', async () => {
    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/forgot-password',
      body: { email: 'invalid-email' },
    })

    const res = await handler(event) as { message: string }
    expect(res.message).toBe(SUCCESS)
  })
})