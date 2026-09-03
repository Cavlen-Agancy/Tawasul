import { describe, expect, it, afterAll } from 'vitest'
import getHandler from '~/modules/admin/server/api/admin/schedule/index.get'
import postHandler from '~/modules/admin/server/api/admin/schedule/index.post'
import patchHandler from '~/modules/admin/server/api/admin/schedule/[id].patch'
import deleteHandler from '~/modules/admin/server/api/admin/schedule/[id].delete'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'

const toDeleteStaff: string[] = []
const toDeleteSchedules: string[] = []

function staffContext(userId: string) {
  return { user: { userId, email: 'staff@test.com', accountType: 'STAFF' } }
}

afterAll(async () => {
  await Promise.all(toDeleteSchedules.map((id) => prisma.adminSchedule.deleteMany({ where: { id } })))
  await Promise.all(toDeleteStaff.map((id) => deleteTestUser(id)))
})

describe('GET /api/admin/schedule', () => {
  it('returns all admin schedule records', async () => {
    const staff = await createTestUser({
      emailVerified: true,
      accountType: 'STAFF',
      email: `sch-get-${Date.now()}@test.com`,
      permissions: [{ resource: 'SETTINGS', action: 'UPDATE' }],
    })
    toDeleteStaff.push(staff.id)

    const schedule = await prisma.adminSchedule.create({
      data: { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', sessionDuration: 60 },
    })
    toDeleteSchedules.push(schedule.id)

    const event = createApiEvent({
      method: 'GET',
      url: '/api/admin/schedule',
      context: staffContext(staff.id),
    })
    const res = await getHandler(event) as { schedules: Array<{ id: string; dayOfWeek: number }> }
    expect(Array.isArray(res.schedules)).toBe(true)
    expect(res.schedules.some((s) => s.id === schedule.id)).toBe(true)
  })

  it('returns 403 without SETTINGS UPDATE permission', async () => {
    const staff = await createTestUser({ emailVerified: true, accountType: 'STAFF', email: `sch-noperm-${Date.now()}@test.com` })
    toDeleteStaff.push(staff.id)
    const event = createApiEvent({ method: 'GET', url: '/api/admin/schedule', context: staffContext(staff.id) })
    try {
      await getHandler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'You do not have permission to perform this action')
    }
  })
})

describe('POST /api/admin/schedule', () => {
  it('creates a record with valid data', async () => {
    const staff = await createTestUser({
      emailVerified: true,
      accountType: 'STAFF',
      email: `sch-post-${Date.now()}@test.com`,
      permissions: [{ resource: 'SETTINGS', action: 'UPDATE' }],
    })
    toDeleteStaff.push(staff.id)

    const event = createApiEvent({
      method: 'POST',
      url: '/api/admin/schedule',
      context: staffContext(staff.id),
      body: { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', sessionDuration: 30 },
    })
    const res = await postHandler(event) as { schedule: { id: string; dayOfWeek: number; sessionDuration: number } }
    expect(res.schedule.dayOfWeek).toBe(2)
    expect(res.schedule.sessionDuration).toBe(30)
    toDeleteSchedules.push(res.schedule.id)
  })

  it('returns 400 for invalid dayOfWeek', async () => {
    const staff = await createTestUser({
      emailVerified: true,
      accountType: 'STAFF',
      email: `sch-day-${Date.now()}@test.com`,
      permissions: [{ resource: 'SETTINGS', action: 'UPDATE' }],
    })
    toDeleteStaff.push(staff.id)
    const event = createApiEvent({
      method: 'POST',
      url: '/api/admin/schedule',
      context: staffContext(staff.id),
      body: { dayOfWeek: 7, startTime: '09:00', endTime: '17:00', sessionDuration: 60 },
    })
    try {
      await postHandler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid request')
    }
  })

  it('returns 400 when startTime >= endTime', async () => {
    const staff = await createTestUser({
      emailVerified: true,
      accountType: 'STAFF',
      email: `sch-time-${Date.now()}@test.com`,
      permissions: [{ resource: 'SETTINGS', action: 'UPDATE' }],
    })
    toDeleteStaff.push(staff.id)
    const event = createApiEvent({
      method: 'POST',
      url: '/api/admin/schedule',
      context: staffContext(staff.id),
      body: { dayOfWeek: 3, startTime: '17:00', endTime: '09:00', sessionDuration: 60 },
    })
    try {
      await postHandler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'startTime must be before endTime')
    }
  })

  it('returns 400 for invalid sessionDuration', async () => {
    const staff = await createTestUser({
      emailVerified: true,
      accountType: 'STAFF',
      email: `sch-dur-${Date.now()}@test.com`,
      permissions: [{ resource: 'SETTINGS', action: 'UPDATE' }],
    })
    toDeleteStaff.push(staff.id)
    const event = createApiEvent({
      method: 'POST',
      url: '/api/admin/schedule',
      context: staffContext(staff.id),
      body: { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', sessionDuration: 90 },
    })
    try {
      await postHandler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Invalid request')
    }
  })

  it('returns 403 without permission', async () => {
    const staff = await createTestUser({ emailVerified: true, accountType: 'STAFF', email: `sch-postnoperm-${Date.now()}@test.com` })
    toDeleteStaff.push(staff.id)
    const event = createApiEvent({
      method: 'POST',
      url: '/api/admin/schedule',
      context: staffContext(staff.id),
      body: { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', sessionDuration: 60 },
    })
    try {
      await postHandler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'You do not have permission to perform this action')
    }
  })
})

describe('PATCH /api/admin/schedule/:id', () => {
  it('updates an existing schedule', async () => {
    const staff = await createTestUser({
      emailVerified: true,
      accountType: 'STAFF',
      email: `sch-patch-${Date.now()}@test.com`,
      permissions: [{ resource: 'SETTINGS', action: 'UPDATE' }],
    })
    toDeleteStaff.push(staff.id)
    const schedule = await prisma.adminSchedule.create({
      data: { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', sessionDuration: 60 },
    })
    toDeleteSchedules.push(schedule.id)

    const event = createApiEvent({
      method: 'PATCH',
      url: `/api/admin/schedule/${schedule.id}`,
      context: { params: { id: schedule.id }, ...staffContext(staff.id) },
      body: { startTime: '10:00', isActive: false },
    })
    const res = await patchHandler(event) as { schedule: { startTime: string; isActive: boolean } }
    expect(res.schedule.startTime).toBe('10:00')
    expect(res.schedule.isActive).toBe(false)
  })
})

describe('DELETE /api/admin/schedule/:id', () => {
  it('deletes an existing schedule', async () => {
    const staff = await createTestUser({
      emailVerified: true,
      accountType: 'STAFF',
      email: `sch-del-${Date.now()}@test.com`,
      permissions: [{ resource: 'SETTINGS', action: 'UPDATE' }],
    })
    toDeleteStaff.push(staff.id)
    const schedule = await prisma.adminSchedule.create({
      data: { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', sessionDuration: 45 },
    })

    const event = createApiEvent({
      method: 'DELETE',
      url: `/api/admin/schedule/${schedule.id}`,
      context: { params: { id: schedule.id }, ...staffContext(staff.id) },
    })
    const res = await deleteHandler(event) as { ok: boolean }
    expect(res.ok).toBe(true)

    const gone = await prisma.adminSchedule.findUnique({ where: { id: schedule.id } })
    expect(gone).toBeNull()
  })
})