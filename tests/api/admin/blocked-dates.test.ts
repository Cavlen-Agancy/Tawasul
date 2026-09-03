import { describe, expect, it, afterAll } from 'vitest'
import getHandler from '~/modules/admin/server/api/admin/blocked-dates/index.get'
import postHandler from '~/modules/admin/server/api/admin/blocked-dates/index.post'
import deleteHandler from '~/modules/admin/server/api/admin/blocked-dates/[id].delete'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'

const toDeleteStaff: string[] = []
const toDeleteBlocked: string[] = []

function staffContext(userId: string) {
  return { user: { userId, email: 'staff@test.com', accountType: 'STAFF' } }
}

async function staffWithPermission(): Promise<{ id: string }> {
  const staff = await createTestUser({
    emailVerified: true,
    accountType: 'STAFF',
    email: `bd-staff-${Date.now()}@test.com`,
    permissions: [{ resource: 'SETTINGS', action: 'UPDATE' }],
  })
  toDeleteStaff.push(staff.id)
  return { id: staff.id }
}

function futureDateISO(days = 30): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const [y, m, dd] = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')]
  return `${y}-${m}-${dd}`
}

afterAll(async () => {
  await Promise.all(toDeleteBlocked.map((id) => prisma.globalBlockedDate.deleteMany({ where: { id } })))
  await Promise.all(toDeleteStaff.map((id) => deleteTestUser(id)))
})

describe('GET /api/admin/blocked-dates', () => {
  it('returns future blocked dates sorted ascending', async () => {
    const staff = await staffWithPermission()
    const date = futureDateISO(10)
    const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
    const record = await prisma.globalBlockedDate.create({ data: { date: new Date(y, m - 1, d) } })
    toDeleteBlocked.push(record.id)

    const event = createApiEvent({ method: 'GET', url: '/api/admin/blocked-dates', context: staffContext(staff.id) })
    const res = await getHandler(event) as { blockedDates: Array<{ id: string }> }
    expect(Array.isArray(res.blockedDates)).toBe(true)
    expect(res.blockedDates.some((b) => b.id === record.id)).toBe(true)
  })

  it('returns 403 without permission', async () => {
    const staff = await createTestUser({ emailVerified: true, accountType: 'STAFF', email: `bd-noperm-${Date.now()}@test.com` })
    toDeleteStaff.push(staff.id)
    const event = createApiEvent({ method: 'GET', url: '/api/admin/blocked-dates', context: staffContext(staff.id) })
    try {
      await getHandler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'You do not have permission to perform this action')
    }
  })
})

describe('POST /api/admin/blocked-dates', () => {
  it('creates a blocked date in the future', async () => {
    const staff = await staffWithPermission()
    const date = futureDateISO(20)
    const event = createApiEvent({
      method: 'POST',
      url: '/api/admin/blocked-dates',
      context: staffContext(staff.id),
      body: { date, reason: 'Training day' },
    })
    const res = await postHandler(event) as { blockedDate: { id: string; reason: string | null } }
    expect(res.blockedDate.reason).toBe('Training day')
    toDeleteBlocked.push(res.blockedDate.id)
  })

  it('rejects a past date', async () => {
    const staff = await staffWithPermission()
    const event = createApiEvent({
      method: 'POST',
      url: '/api/admin/blocked-dates',
      context: staffContext(staff.id),
      body: { date: '2020-01-01' },
    })
    try {
      await postHandler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Date must be in the future')
    }
  })
})

describe('DELETE /api/admin/blocked-dates/:id', () => {
  it('deletes an existing blocked date', async () => {
    const staff = await staffWithPermission()
    const date = futureDateISO(40)
    const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
    const record = await prisma.globalBlockedDate.create({ data: { date: new Date(y, m - 1, d) } })

    const event = createApiEvent({
      method: 'DELETE',
      url: `/api/admin/blocked-dates/${record.id}`,
      context: { params: { id: record.id }, ...staffContext(staff.id) },
    })
    const res = await deleteHandler(event) as { ok: boolean }
    expect(res.ok).toBe(true)

    const gone = await prisma.globalBlockedDate.findUnique({ where: { id: record.id } })
    expect(gone).toBeNull()
  })
})