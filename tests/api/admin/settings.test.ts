import { describe, expect, it, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import getHandler from '~/modules/admin/server/api/admin/settings.get'
import patchHandler from '~/modules/admin/server/api/admin/settings.patch'
import { createApiEvent, createTestUser, deleteTestUser } from '../helpers'

const toDeleteUsers: string[] = []

function staffContext(userId: string, perms: Array<{ resource: string; action: string }>) {
  void perms
  return { user: { userId, email: 'staff@test.com', accountType: 'STAFF' } }
}

async function staffWith(action: 'READ' | 'UPDATE'): Promise<string> {
  const staff = await createTestUser({
    emailVerified: true,
    accountType: 'STAFF',
    email: `aset-staff-${action}-${Date.now()}-${Math.random()}@test.com`,
    permissions: [{ resource: 'SETTINGS', action }],
  })
  toDeleteUsers.push(staff.id)
  return staff.id
}

let originalKey: string | null = null
let originalSecret: string | null = null

afterAll(async () => {
  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { paymentGatewayKey: originalKey ?? '', paymentGatewaySecret: originalSecret ?? '' },
  }).catch(() => undefined)
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('GET /api/admin/settings', () => {
  it('masks gateway keys', async () => {
    const current = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    originalKey = current?.paymentGatewayKey ?? null
    originalSecret = current?.paymentGatewaySecret ?? null
    await prisma.settings.update({
      where: { id: 'singleton' },
      data: { paymentGatewayKey: 'sk_live_abcdef123456', paymentGatewaySecret: 'whsec_987654' },
    })

    const staffId = await staffWith('READ')
    const res = await getHandler(createApiEvent({
      method: 'GET',
      url: '/api/admin/settings',
      context: staffContext(staffId, [{ resource: 'SETTINGS', action: 'READ' }]),
    })) as { paymentGatewayKey: string; paymentGatewaySecret: string }
    expect(res.paymentGatewayKey).toBe('****3456')
    expect(res.paymentGatewaySecret).toBe('****7654')
  })
})

describe('PATCH /api/admin/settings', () => {
  it('preserves masked keys submitted with ****', async () => {
    const staffId = await staffWith('UPDATE')
    const res = await patchHandler(createApiEvent({
      method: 'PATCH',
      url: '/api/admin/settings',
      body: { platformName: 'Tawasul Academy Test', paymentGatewayKey: '****3456', paymentGatewaySecret: '****7654' },
      context: staffContext(staffId, [{ resource: 'SETTINGS', action: 'UPDATE' }]),
    })) as { platformName: string; paymentGatewayKey: string }

    expect(res.platformName).toBe('Tawasul Academy Test')
    expect(res.paymentGatewayKey).toBe('****3456')

    const stored = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    expect(stored?.paymentGatewayKey).toBe('sk_live_abcdef123456')

    await patchHandler(createApiEvent({
      method: 'PATCH',
      url: '/api/admin/settings',
      body: { platformName: 'Tawasul Academy' },
      context: staffContext(staffId, [{ resource: 'SETTINGS', action: 'UPDATE' }]),
    }))
  })
})
