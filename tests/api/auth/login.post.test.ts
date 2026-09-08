import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/auth/server/api/auth/login.post'
import { createApiEvent, expectApiError, getAuthCookie, getSetCookie, createTestUser, deleteTestUser } from '../helpers'

describe('POST /api/auth/login', () => {
  const toDelete: string[] = []

  afterAll(async () => {
    await Promise.all(toDelete.map((id) => deleteTestUser(id)))
  })

  it('logs in a verified patient and sets the auth_token cookie', async () => {
    const user = await createTestUser({ emailVerified: true, email: `login-ok-${Date.now()}@test.com` })
    toDelete.push(user.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: user.email, password: 'CorrectPass123!' },
    })

    const res = await handler(event) as {
      id: string
      name: string
      email: string
      accountType: string
      photo?: string
    }

    expect(res.id).toBe(user.id)
    expect(res.name).toBe(user.name)
    expect(res.email).toBe(user.email)
    expect(res.accountType).toBe('PATIENT')
    expect(res).not.toHaveProperty('password')
    expect(res).not.toHaveProperty('phone')

    const cookie = getAuthCookie(event)
    expect(cookie).toBeTruthy()
    const raw = getSetCookie(event).find((c) => c.startsWith('auth_token='))
    expect(raw).toContain('HttpOnly')
    expect(raw).toContain('SameSite=Strict')
    expect(raw).not.toContain('Secure') // NODE_ENV=test
  })

  it('rejects a wrong password with 401', async () => {
    const user = await createTestUser({ emailVerified: true, email: `login-wrong-${Date.now()}@test.com` })
    toDelete.push(user.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: user.email, password: 'WrongPass123!' },
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 401, 'Invalid credentials')
    }
  })

  it('rejects a non-existent email with 401 without revealing existence', async () => {
    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'nonexistent@test.com', password: 'AnyPass123!' },
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 401, 'Invalid credentials')
    }
  })

  it('rejects an unverified email with 403', async () => {
    const user = await createTestUser({ emailVerified: false, email: `login-unverified-${Date.now()}@test.com` })
    toDelete.push(user.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: user.email, password: 'CorrectPass123!' },
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 403, 'Please verify your email before logging in')
    }
  })

  it('rejects a deactivated account with 403', async () => {
    const user = await createTestUser({
      emailVerified: true,
      isActive: false,
      email: `login-inactive-${Date.now()}@test.com`,
    })
    toDelete.push(user.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: user.email, password: 'CorrectPass123!' },
    })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 403, 'Your account has been deactivated')
    }
  })

  it('logs in a STAFF user and returns permissions', async () => {
    const user = await createTestUser({
      emailVerified: true,
      accountType: 'STAFF',
      email: `login-staff-${Date.now()}@test.com`,
      permissions: [
        { resource: 'APPOINTMENTS', action: 'READ' },
        { resource: 'DOCTORS', action: 'READ' },
      ],
    })
    toDelete.push(user.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: user.email, password: 'CorrectPass123!' },
    })

    const res = await handler(event) as {
      id: string
      accountType: string
      permissions: Array<{ resource: string; action: string }>
    }

    expect(res.accountType).toBe('STAFF')
    expect(res.permissions).toBeDefined()
    expect(res.permissions).toEqual(
      expect.arrayContaining([
        { resource: 'APPOINTMENTS', action: 'READ' },
        { resource: 'DOCTORS', action: 'READ' },
      ]),
    )
  })
})