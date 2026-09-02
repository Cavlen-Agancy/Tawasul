import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/patient/server/api/patient/profile.get'
import { createApiEvent, expectApiError, deleteTestUser } from '../helpers'
import { createPatient } from './helpers'
import type { User } from '@prisma/client'

const toDelete: string[] = []
afterAll(async () => {
  await Promise.all(toDelete.map((id) => deleteTestUser(id)))
})

describe('GET /api/patient/profile', () => {
  it('fetches own profile', async () => {
    const patient = await createPatient({ email: `pf-get-${Date.now()}@test.com` })
    toDelete.push(patient.id)

    const event = createApiEvent({
      method: 'GET',
      url: '/api/patient/profile',
      context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
    })
    const res = await handler(event) as Record<string, unknown>
    expect(res.id).toBe(patient.id)
    expect(res.email).toBe(patient.email)
    expect(res).toHaveProperty('name')
    expect(res).not.toHaveProperty('password')
  })

  it('rejects a non-PATIENT role', async () => {
    const user = await createPatient({ email: `pf-nonpatient-${Date.now()}@test.com` })
    toDelete.push(user.id)

    const event = createApiEvent({
      method: 'GET',
      url: '/api/patient/profile',
      context: { user: { userId: user.id, email: user.email, accountType: 'DOCTOR' } },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })

  it('rejects unauthenticated', async () => {
    const event = createApiEvent({ method: 'GET', url: '/api/patient/profile' })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 401, 'Unauthorized')
    }
  })
})
