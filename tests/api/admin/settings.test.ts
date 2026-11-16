import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import getHandler from '~/modules/admin/server/api/admin/settings.get'
import patchHandler from '~/modules/admin/server/api/admin/settings.patch'
import joinModeGetHandler from '~/modules/admin/server/api/admin/session-join-mode.get'
import joinModePatchHandler from '~/modules/admin/server/api/admin/session-join-mode.patch'
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

async function adminUser(): Promise<string> {
  const admin = await createTestUser({
    emailVerified: true,
    accountType: 'ADMIN',
    email: `aset-admin-${Date.now()}-${Math.random()}@test.com`,
  })
  toDeleteUsers.push(admin.id)
  return admin.id
}

function adminContext(userId: string) {
  return { user: { userId, email: 'admin@test.com', accountType: 'ADMIN' } }
}

const deniedContexts = [
  { user: { userId: 'doctor-1', email: 'd@test.com', accountType: 'DOCTOR' } },
  { user: { userId: 'patient-1', email: 'p@test.com', accountType: 'PATIENT' } },
  { user: { userId: 'staff-1', email: 's@test.com', accountType: 'STAFF' } },
]

let originalKey: string | null = null
let originalSecret: string | null = null
let originalJoinMode: 'PRODUCTION' | 'TEST' | null = null

beforeAll(async () => {
  const current = await prisma.settings.findUnique({ where: { id: 'singleton' }, select: { sessionJoinMode: true } })
  originalJoinMode = current?.sessionJoinMode ?? null
})

afterAll(async () => {
  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { paymentGatewayKey: originalKey ?? '', paymentGatewaySecret: originalSecret ?? '' },
  }).catch(() => undefined)
  if (originalJoinMode) {
    await prisma.settings.update({
      where: { id: 'singleton' },
      data: { sessionJoinMode: originalJoinMode },
    }).catch(() => undefined)
  }
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

describe('Session Join Mode authorization (ADMIN-only)', () => {
  it('allows ADMIN to read the mode through both admin endpoints', async () => {
    const adminId = await adminUser()
    const dedicated = await joinModeGetHandler(createApiEvent({
      method: 'GET',
      url: '/api/admin/session-join-mode',
      context: adminContext(adminId),
    })) as { mode: string }
    expect(['PRODUCTION', 'TEST']).toContain(dedicated.mode)

    const general = await getHandler(createApiEvent({
      method: 'GET',
      url: '/api/admin/settings',
      context: adminContext(adminId),
    })) as { sessionJoinMode?: string }
    expect(general.sessionJoinMode).toBe(dedicated.mode)
  })

  it('denies STAFF with SETTINGS:READ and hides the mode from the general response', async () => {
    const staffId = await staffWith('READ')

    const general = await getHandler(createApiEvent({
      method: 'GET',
      url: '/api/admin/settings',
      context: staffContext(staffId, [{ resource: 'SETTINGS', action: 'READ' }]),
    })) as Record<string, unknown>
    expect(general).not.toHaveProperty('sessionJoinMode')

    await expect(joinModeGetHandler(createApiEvent({
      method: 'GET',
      url: '/api/admin/session-join-mode',
      context: staffContext(staffId, [{ resource: 'SETTINGS', action: 'READ' }]),
    }))).rejects.toMatchObject({ statusCode: 403 })
  })

  it('denies DOCTOR, PATIENT and STAFF (without permission) reads', async () => {
    for (const ctx of deniedContexts) {
      await expect(getHandler(createApiEvent({
        method: 'GET', url: '/api/admin/settings', context: ctx,
      }))).rejects.toMatchObject({ statusCode: 403 })
      await expect(joinModeGetHandler(createApiEvent({
        method: 'GET', url: '/api/admin/session-join-mode', context: ctx,
      }))).rejects.toMatchObject({ statusCode: 403 })
    }
  })

  it('allows ADMIN to update the mode and rejects invalid values', async () => {
    const adminId = await adminUser()

    const res = await joinModePatchHandler(createApiEvent({
      method: 'PATCH',
      url: '/api/admin/session-join-mode',
      body: { mode: 'TEST' },
      context: adminContext(adminId),
    })) as { mode: string }
    expect(res.mode).toBe('TEST')

    await expect(joinModePatchHandler(createApiEvent({
      method: 'PATCH',
      url: '/api/admin/session-join-mode',
      body: { mode: 'EVIL' },
      context: adminContext(adminId),
    }))).rejects.toMatchObject({ statusCode: 400 })

    await expect(joinModePatchHandler(createApiEvent({
      method: 'PATCH',
      url: '/api/admin/session-join-mode',
      body: {},
      context: adminContext(adminId),
    }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('denies STAFF with SETTINGS:UPDATE even through the general PATCH', async () => {
    const staffId = await staffWith('UPDATE')
    const before = await prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { sessionJoinMode: true },
    })

    await expect(joinModePatchHandler(createApiEvent({
      method: 'PATCH',
      url: '/api/admin/session-join-mode',
      body: { mode: 'TEST' },
      context: staffContext(staffId, [{ resource: 'SETTINGS', action: 'UPDATE' }]),
    }))).rejects.toMatchObject({ statusCode: 403 })

    await expect(patchHandler(createApiEvent({
      method: 'PATCH',
      url: '/api/admin/settings',
      body: { sessionJoinMode: 'TEST' },
      context: staffContext(staffId, [{ resource: 'SETTINGS', action: 'UPDATE' }]),
    }))).rejects.toMatchObject({ statusCode: 403 })

    const after = await prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { sessionJoinMode: true },
    })
    expect(after?.sessionJoinMode).toBe(before?.sessionJoinMode)
  })

  it('denies DOCTOR and PATIENT updates', async () => {
    for (const ctx of deniedContexts.slice(0, 2)) {
      await expect(joinModePatchHandler(createApiEvent({
        method: 'PATCH',
        url: '/api/admin/session-join-mode',
        body: { mode: 'TEST' },
        context: ctx,
      }))).rejects.toMatchObject({ statusCode: 403 })
    }
  })

  it('keeps unrelated STAFF settings updates working', async () => {
    const staffId = await staffWith('UPDATE')
    const res = await patchHandler(createApiEvent({
      method: 'PATCH',
      url: '/api/admin/settings',
      body: { platformName: 'Tawasul Academy Test' },
      context: staffContext(staffId, [{ resource: 'SETTINGS', action: 'UPDATE' }]),
    })) as Record<string, unknown>
    expect(res.platformName).toBe('Tawasul Academy Test')
    expect(res).not.toHaveProperty('sessionJoinMode')

    await patchHandler(createApiEvent({
      method: 'PATCH',
      url: '/api/admin/settings',
      body: { platformName: 'Tawasul Academy' },
      context: staffContext(staffId, [{ resource: 'SETTINGS', action: 'UPDATE' }]),
    }))
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
