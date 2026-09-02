import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/modules/patient/server/api/patient/profile.patch'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, deleteTestUser } from '../helpers'
import { createPatient } from './helpers'
import type { User } from '@prisma/client'

const toDelete: string[] = []
afterAll(async () => {
  await Promise.all(toDelete.map((id) => deleteTestUser(id)))
})

function authedEvent(patient: User, body: unknown) {
  return createApiEvent({
    method: 'PATCH',
    url: '/api/patient/profile',
    body,
    context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
  })
}

describe('PATCH /api/patient/profile', () => {
  it('updates name and phone', async () => {
    const patient = await createPatient({ email: `pf-patch-${Date.now()}@test.com` })
    toDelete.push(patient.id)

    const res = await handler(authedEvent(patient, { name: 'New Name', phone: '+20123456789' })) as {
      name: string
      phone: string
      email: string
    }
    expect(res.name).toBe('New Name')
    expect(res.phone).toBe('+20123456789')
    expect(res.email).toBe(patient.email)

    const updated = await prisma.user.findUnique({ where: { id: patient.id } })
    expect(updated?.name).toBe('New Name')
    expect(updated?.phone).toBe('+20123456789')
  })

  it('updates name only', async () => {
    const patient = await createPatient({ email: `pf-patch-name-${Date.now()}@test.com` })
    toDelete.push(patient.id)

    const res = await handler(authedEvent(patient, { name: 'New Name' })) as { phone: string | null }
    expect(res.phone).toBeNull()
  })

  it('rejects a short name', async () => {
    const patient = await createPatient({ email: `pf-patch-short-${Date.now()}@test.com` })
    toDelete.push(patient.id)

    try {
      await handler(authedEvent(patient, { name: 'A' }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Name must be at least 2 characters')
    }
  })
})
