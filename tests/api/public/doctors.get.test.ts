import { describe, expect, it, afterAll } from 'vitest'
import handler from '~/server/api/public/doctors.get'
import { createApiEvent } from '../helpers'
import { createTestDoctor, deleteTestDoctor } from '../booking/helpers'
import { prisma } from '~/server/utils/prisma'

const toDelete: Array<{ doctorId: string; userId: string }> = []

async function allDoctors() {
  const items: Array<Record<string, unknown>> = []
  let page = 1
  let totalPages = 1
  do {
    const res = await handler(createApiEvent({
      method: 'GET',
      url: `/api/public/doctors?page=${page}&pageSize=12`,
    })) as { items: Array<Record<string, unknown>>; totalPages: number }
    items.push(...res.items)
    totalPages = res.totalPages
    page += 1
  } while (page <= totalPages)
  return items
}

describe('GET /api/public/doctors', () => {

  afterAll(async () => {
    await Promise.all(toDelete.map(({ doctorId, userId }) => deleteTestDoctor(doctorId, userId)))
  })

  it('paginates with a default page size capped at 12', async () => {
    const res = await handler(createApiEvent({ method: 'GET', url: '/api/public/doctors' })) as {
      items: Array<{ id: string }>
      doctors: Array<{ id: string }>
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
    expect(res.page).toBe(1)
    expect(res.pageSize).toBe(12)
    expect(res.items.length).toBeLessThanOrEqual(12)
    expect(res.doctors).toEqual(res.items)
    expect(res.total).toBeGreaterThanOrEqual(res.items.length)
    expect(res.totalPages).toBeGreaterThanOrEqual(1)
  })

  it('caps pageSize above 12', async () => {
    const res = await handler(createApiEvent({
      method: 'GET',
      url: '/api/public/doctors?page=1&pageSize=50',
    })) as { items: unknown[]; pageSize: number }
    expect(res.pageSize).toBe(12)
    expect(res.items.length).toBeLessThanOrEqual(12)
  })

  it('returns non-overlapping stable pages', async () => {
    const first = await handler(createApiEvent({
      method: 'GET',
      url: '/api/public/doctors?page=1&pageSize=12',
    })) as { items: Array<{ id: string }> }
    const second = await handler(createApiEvent({
      method: 'GET',
      url: '/api/public/doctors?page=2&pageSize=12',
    })) as { items: Array<{ id: string }> }

    if (first.items.length === 12) {
      expect(second.items.length).toBeGreaterThan(0)
      expect(second.items.some((doctor) => first.items.some((d) => d.id === doctor.id))).toBe(false)
    }
  })

  it('returns an empty predictable page beyond the last page', async () => {
    const res = await handler(createApiEvent({
      method: 'GET',
      url: '/api/public/doctors?page=9999&pageSize=12',
    })) as { items: unknown[]; page: number; total: number }
    expect(res.page).toBe(9999)
    expect(res.items).toEqual([])
    expect(res.total).toBeGreaterThan(0)
  })

  it('returns only active doctors with safe public fields', async () => {
    const active = await createTestDoctor({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', specializations: ['Family Counseling'] })
    const inactive = await createTestDoctor({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: false })
    toDelete.push({ doctorId: active.doctor.id, userId: active.user.id })
    toDelete.push({ doctorId: inactive.doctor.id, userId: inactive.user.id })

    const doctors = await allDoctors()
    const ids = doctors.map((doctor) => doctor.id)
    expect(ids).toContain(active.doctor.id)
    expect(ids).not.toContain(inactive.doctor.id)

    const doctor = doctors.find((d) => d.id === active.doctor.id)!
    expect(doctor).toMatchObject({ name: active.user.name, slug: active.doctor.slug })
    expect(doctor).not.toHaveProperty('email')
    expect(doctor).not.toHaveProperty('userId')
  })

  it('excludes doctors whose user is inactive', async () => {
    const doctor = await createTestDoctor({ dayOfWeek: 2, startTime: '09:00', endTime: '17:00' })
    toDelete.push({ doctorId: doctor.doctor.id, userId: doctor.user.id })
    await prisma.user.update({ where: { id: doctor.user.id }, data: { isActive: false } })

    const doctors = await allDoctors()
    expect(doctors.map((d) => d.id)).not.toContain(doctor.doctor.id)
  })
})
