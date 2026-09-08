import { describe, expect, it, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import postHandler from '~/modules/admin/server/api/admin/doctors/index.post'
import getHandler from '~/modules/admin/server/api/admin/doctors/[id].get'
import patchHandler from '~/modules/admin/server/api/admin/doctors/[id].patch'
import availabilityHandler from '~/modules/admin/server/api/admin/doctors/[id]/availability.post'
import blockHandler from '~/modules/admin/server/api/admin/doctors/[id]/availability/block.post'
import unblockHandler from '~/modules/admin/server/api/admin/doctors/[id]/availability/block/[blockId].delete'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { deleteTestAdminDoctor } from './helpers'

const toDeleteUsers: string[] = []
const toDeleteDoctors: string[] = []

function staffContext(userId: string) {
  return { user: { userId, email: 'staff@test.com', accountType: 'STAFF' } }
}

async function staffWithDoctosPerms(): Promise<string> {
  const staff = await createTestUser({
    emailVerified: true,
    accountType: 'STAFF',
    email: `adc-staff-${Date.now()}-${Math.random()}@test.com`,
    permissions: [
      { resource: 'DOCTORS', action: 'CREATE' },
      { resource: 'DOCTORS', action: 'READ' },
      { resource: 'DOCTORS', action: 'UPDATE' },
    ],
  })
  toDeleteUsers.push(staff.id)
  return staff.id
}

afterAll(async () => {
  await Promise.all(toDeleteDoctors.map(async (doctorId) => {
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } }).catch(() => null)
    if (doctor) await deleteTestAdminDoctor(doctorId, doctor.userId).catch(() => undefined)
  }))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('POST /api/admin/doctors', () => {
  it('creates a doctor and returns 201', async () => {
    const staffId = await staffWithDoctosPerms()
    const email = `adc-dr-${Date.now()}@test.com`
    const res = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/doctors',
      body: { name: 'Dr. New Doctor', email, specializations: ['Family'] },
      context: staffContext(staffId),
    })) as { id: string; email: string; slug: string }
    expect(res.email).toBe(email)
    expect(res.slug.startsWith('dr-')).toBe(true)
    toDeleteDoctors.push(res.id)
    toDeleteUsers.push((await prisma.doctor.findUnique({ where: { id: res.id } }))!.userId)
  })

  it('returns 400 if the email exists', async () => {
    const staffId = await staffWithDoctosPerms()
    const email = `adc-dup-${Date.now()}@test.com`
    const first = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/doctors',
      body: { name: 'Dr. Dup One', email },
      context: staffContext(staffId),
    })) as { id: string }
    toDeleteDoctors.push(first.id)
    toDeleteUsers.push((await prisma.doctor.findUnique({ where: { id: first.id } }))!.userId)
    try {
      await postHandler(createApiEvent({
        method: 'POST',
        url: '/api/admin/doctors',
        body: { name: 'Dr. Dup Two', email },
        context: staffContext(staffId),
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Email already in use')
    }
  })
})

describe('GET /api/admin/doctors/:id', () => {
  it('returns the full profile with session counts', async () => {
    const staffId = await staffWithDoctosPerms()
    const email = `adc-get-${Date.now()}@test.com`
    const created = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/doctors',
      body: { name: 'Dr. Get Detail', email },
      context: staffContext(staffId),
    })) as { id: string }
    toDeleteDoctors.push(created.id)
    toDeleteUsers.push((await prisma.doctor.findUnique({ where: { id: created.id } }))!.userId)

    const res = await getHandler(createApiEvent({
      method: 'GET',
      url: `/api/admin/doctors/${created.id}`,
      context: { ...staffContext(staffId), params: { id: created.id } } as never,
    }) as never) as { email: string; sessionCountThisMonth: number; sessionCountAllTime: number; availability: unknown[] }
    expect(res.email).toBe(email)
    expect(res.sessionCountThisMonth).toBe(0)
    expect(res.sessionCountAllTime).toBe(0)
    expect(Array.isArray(res.availability)).toBe(true)
  })
})

describe('PATCH /api/admin/doctors/:id', () => {
  it('updates bio and deactivates both Doctor and User records', async () => {
    const staffId = await staffWithDoctosPerms()
    const email = `adc-patch-${Date.now()}@test.com`
    const created = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/doctors',
      body: { name: 'Dr. Patch Me', email },
      context: staffContext(staffId),
    })) as { id: string }
    toDeleteDoctors.push(created.id)
    const docRecord = await prisma.doctor.findUnique({ where: { id: created.id } })
    toDeleteUsers.push(docRecord!.userId)

    const res = await patchHandler(createApiEvent({
      method: 'PATCH',
      url: `/api/admin/doctors/${created.id}`,
      body: { bio: 'Updated bio', isActive: false },
      context: { ...staffContext(staffId), params: { id: created.id } } as never,
    }) as never) as { bio: string; isActive: boolean }
    expect(res.bio).toBe('Updated bio')
    expect(res.isActive).toBe(false)

    // Verify User record was also deactivated
    const updatedUser = await prisma.user.findUnique({ where: { id: docRecord!.userId } })
    expect(updatedUser?.isActive).toBe(false)
  })

  it('reactivates both Doctor and User when isActive: true is sent', async () => {
    const staffId = await staffWithDoctosPerms()
    const email = `adc-reactivate-${Date.now()}@test.com`
    const created = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/doctors',
      body: { name: 'Dr. Reactivate Me', email },
      context: staffContext(staffId),
    })) as { id: string }
    toDeleteDoctors.push(created.id)
    const docRecord = await prisma.doctor.findUnique({ where: { id: created.id } })
    toDeleteUsers.push(docRecord!.userId)

    // First deactivate
    await patchHandler(createApiEvent({
      method: 'PATCH',
      url: `/api/admin/doctors/${created.id}`,
      body: { isActive: false },
      context: { ...staffContext(staffId), params: { id: created.id } } as never,
    }) as never)

    // Reactivate
    const res = await patchHandler(createApiEvent({
      method: 'PATCH',
      url: `/api/admin/doctors/${created.id}`,
      body: { isActive: true },
      context: { ...staffContext(staffId), params: { id: created.id } } as never,
    }) as never) as { isActive: boolean }
    expect(res.isActive).toBe(true)

    const updatedUser = await prisma.user.findUnique({ where: { id: docRecord!.userId } })
    expect(updatedUser?.isActive).toBe(true)
  })

  it('does not modify User.isActive when isActive is omitted', async () => {
    const staffId = await staffWithDoctosPerms()
    const email = `adc-omit-${Date.now()}@test.com`
    const created = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/doctors',
      body: { name: 'Dr. Omit Test', email },
      context: staffContext(staffId),
    })) as { id: string }
    toDeleteDoctors.push(created.id)
    const docRecord = await prisma.doctor.findUnique({ where: { id: created.id } })
    toDeleteUsers.push(docRecord!.userId)

    await patchHandler(createApiEvent({
      method: 'PATCH',
      url: `/api/admin/doctors/${created.id}`,
      body: { name: 'Dr. Renamed Doctor' },
      context: { ...staffContext(staffId), params: { id: created.id } } as never,
    }) as never)

    const updatedUser = await prisma.user.findUnique({ where: { id: docRecord!.userId } })
    expect(updatedUser?.name).toBe('Dr. Renamed Doctor')
    expect(updatedUser?.isActive).toBe(true)
  })
})

describe('POST /api/admin/doctors/:id/availability', () => {
  it('replaces availability', async () => {
    const staffId = await staffWithDoctosPerms()
    const email = `adc-avail-${Date.now()}@test.com`
    const created = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/doctors',
      body: { name: 'Dr. Avail Able', email },
      context: staffContext(staffId),
    })) as { id: string }
    toDeleteDoctors.push(created.id)
    toDeleteUsers.push((await prisma.doctor.findUnique({ where: { id: created.id } }))!.userId)

    const res = await availabilityHandler(createApiEvent({
      method: 'POST',
      url: `/api/admin/doctors/${created.id}/availability`,
      body: { availability: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00', sessionDuration: 60 }] },
      context: { ...staffContext(staffId), params: { id: created.id } } as never,
    }) as never) as { success: boolean; availability: Array<{ dayOfWeek: number }> }
    expect(res.success).toBe(true)
    expect(res.availability).toHaveLength(1)
    expect(res.availability[0].dayOfWeek).toBe(1)
  })
})

describe('doctor availability block/unblock', () => {
  it('blocks and unblocks a slot', async () => {
    const staffId = await staffWithDoctosPerms()
    const email = `adc-block-${Date.now()}@test.com`
    const created = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/doctors',
      body: { name: 'Dr. Block Test', email },
      context: staffContext(staffId),
    })) as { id: string }
    toDeleteDoctors.push(created.id)
    toDeleteUsers.push((await prisma.doctor.findUnique({ where: { id: created.id } }))!.userId)

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    const blocked = await blockHandler(createApiEvent({
      method: 'POST',
      url: `/api/admin/doctors/${created.id}/availability/block`,
      body: { date: dateStr, startTime: '10:00', endTime: '11:00' },
      context: { ...staffContext(staffId), params: { id: created.id } } as never,
    }) as never) as { blockedSlot: { id: string } }
    expect(blocked.blockedSlot.id).toBeTruthy()

    const removed = await unblockHandler(createApiEvent({
      method: 'DELETE',
      url: `/api/admin/doctors/${created.id}/availability/block/${blocked.blockedSlot.id}`,
      context: { ...staffContext(staffId), params: { id: created.id, blockId: blocked.blockedSlot.id } } as never,
    }) as never) as { success: boolean }
    expect(removed.success).toBe(true)
  })
})
