import { describe, expect, it, vi, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import handler from '~/modules/auth/server/api/auth/register.post'
import { sendEmail } from '~/server/utils/email'
import { createApiEvent, expectApiError, getAuthCookie, getSetCookie, createTestUser, deleteTestUser } from '../helpers'

vi.mock('~/server/utils/email', () => ({ sendEmail: vi.fn() }))

describe('POST /api/auth/register', () => {
  const emails: string[] = []

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('registers a valid patient as active and signs them in with no email sent', async () => {
    const email = `register-${Date.now()}@test.com`
    emails.push(email)
    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/register',
      body: { name: 'Ahmed', email, password: 'Password123!' },
    })

    const res = await handler(event) as { id: string; name: string; email: string; accountType: string }

    expect(event.node.res.statusCode).toBe(201)
    expect(res.id).toBeTruthy()
    expect(res.name).toBe('Ahmed')
    expect(res.email).toBe(email)
    expect(res.accountType).toBe('PATIENT')

    // Signed in: the same auth_token session cookie the login handler sets
    expect(getAuthCookie(event)).toBeTruthy()
    expect(getSetCookie(event).find((c) => c.startsWith('auth_token='))).toContain('HttpOnly')

    const user = await prisma.user.findUnique({ where: { email } })
    expect(user).not.toBeNull()
    expect(user?.accountType).toBe('PATIENT')
    expect(user?.emailVerified).toBe(true)
    expect(user?.isActive).toBe(true)
    expect(user?.emailVerificationToken).toBeNull()
    expect(user?.password).not.toBe('Password123!')

    // No verification (or any other) email is sent on registration
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled()
  })

  it('rejects a duplicate email with 400', async () => {
    const email = `duplicate-${Date.now()}@test.com`
    const user = await createTestUser({ email, emailVerified: true })
    try {
      const event = createApiEvent({
        method: 'POST',
        url: '/api/auth/register',
        body: { name: 'Ahmed', email, password: 'Password123!' },
      })

      try {
        await handler(event)
        throw new Error('expected an error')
      } catch (e) {
        expectApiError(e, 400, 'Email already in use')
      }
    } finally {
      await deleteTestUser(user.id)
    }
  })

  it('rejects an invalid email format with 400', async () => {
    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/register',
      body: { name: 'Ahmed', email: 'invalid-email', password: 'Password123!' },
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 400, 'Invalid email format')
    }
  })

  it('rejects a short password with 400', async () => {
    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/register',
      body: { name: 'Ahmed', email: `short-${Date.now()}@test.com`, password: '123' },
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 400, 'Password must be at least 8 characters')
    }
  })

  it('rejects a short name with 400', async () => {
    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/register',
      body: { name: 'A', email: `shortname-${Date.now()}@test.com`, password: 'Password123!' },
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 400, 'Name must be at least 2 characters')
    }
  })
})