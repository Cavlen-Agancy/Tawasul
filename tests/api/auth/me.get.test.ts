import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/auth/server/api/auth/me.get'
import { generateJWT } from '~/server/utils/auth'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'

describe('GET /api/auth/me', () => {
  const toDelete: string[] = []

  afterAll(async () => {
    await Promise.all(toDelete.map((id) => deleteTestUser(id)))
  })

  it('returns the logged-in patient without sensitive fields', async () => {
    const user = await createTestUser({ emailVerified: true, email: `me-patient-${Date.now()}@test.com` })
    toDelete.push(user.id)
    const token = generateJWT({ userId: user.id, email: user.email, accountType: 'PATIENT' })

    const event = createApiEvent({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { auth_token: token },
      context: { user: { userId: user.id, email: user.email, accountType: 'PATIENT' } },
    })

    const res = await handler(event) as unknown as Record<string, unknown>

    expect(res.id).toBe(user.id)
    expect(res.name).toBe(user.name)
    expect(res.email).toBe(user.email)
    expect(res.accountType).toBe('PATIENT')
    expect(res).not.toHaveProperty('password')
    expect(res).not.toHaveProperty('permissions')
  })

  it('includes permissions for STAFF users', async () => {
    const user = await createTestUser({
      emailVerified: true,
      email: `me-staff-${Date.now()}@test.com`,
      accountType: 'STAFF',
      permissions: [{ resource: 'PATIENTS', action: 'READ' }],
    })
    toDelete.push(user.id)
    const token = generateJWT({ userId: user.id, email: user.email, accountType: 'STAFF' })

    const event = createApiEvent({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { auth_token: token },
      context: { user: { userId: user.id, email: user.email, accountType: 'STAFF' } },
    })

    const res = await handler(event) as { accountType: string; permissions: { resource: string; action: string }[] }

    expect(res.accountType).toBe('STAFF')
    expect(res.permissions).toEqual(expect.arrayContaining([{ resource: 'PATIENTS', action: 'READ' }]))
  })

  it('rejects unauthenticated requests with 401', async () => {
    const event = createApiEvent({ method: 'GET', url: '/api/auth/me' })

    try {
      await handler(event)
      throw new Error('expected an error')
    } catch (e) {
      expectApiError(e, 401, 'Unauthorized')
    }
  })
})