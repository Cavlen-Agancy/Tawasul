import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import handler from '~/modules/auth/server/api/auth/register.post'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'

describe('POST /api/auth/register', () => {
  const emails: string[] = []

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('registers a valid patient and returns 201', async () => {
    const email = `register-${Date.now()}@test.com`
    emails.push(email)
    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/register',
      body: { name: 'Ahmed', email, password: 'Password123!' },
    })

    const res = await handler(event) as { message: string }

    expect(event.node.res.statusCode).toBe(201)
    expect(res.message).toBe('Registration successful. Please check your email.')

    const user = await prisma.user.findUnique({ where: { email } })
    expect(user).not.toBeNull()
    expect(user?.accountType).toBe('PATIENT')
    expect(user?.emailVerified).toBe(false)
    expect(user?.isActive).toBe(true)
    expect(user?.emailVerificationToken).toBeTruthy()
    expect(user?.password).not.toBe('Password123!')
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