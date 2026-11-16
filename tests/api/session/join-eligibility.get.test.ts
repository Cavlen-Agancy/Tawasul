import { describe, expect, it, vi, afterAll } from 'vitest'
import handler from '~/modules/session/server/api/session/join-eligibility.get'
import { prisma } from '~/server/utils/prisma'
import { createApiEvent } from '../helpers'
import { createPatient, createBookedFixture, deletePatientBookingFixture, deletePatient } from '../patient/helpers'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function fmt(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function useFixedNow() {
  const d = new Date()
  const now = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 13, 0, 0, 0).getTime()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  return now
}

function eligibilityRequest(user: { id: string; email: string; accountType: string }) {
  return createApiEvent({
    method: 'GET',
    url: '/api/session/join-eligibility',
    context: { user: { userId: user.id, email: user.email, accountType: user.accountType } },
  })
}

interface EligibilityResponse {
  eligibility: Array<{ bookingId: string; canJoin: boolean; reason?: string }>
}

describe('GET /api/session/join-eligibility', () => {
  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('returns server-computed eligibility for in-window and ended bookings without exposing the mode', async () => {
    const mockedNow = useFixedNow()
    const patient = await createPatient({ email: `elig-owner-${Date.now()}@test.com` })
    const inWindowStart = new Date(mockedNow + 2 * 60 * 1000)
    const inWindow = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(inWindowStart.getFullYear(), inWindowStart.getMonth(), inWindowStart.getDate(), 12, 0, 0, 0),
      startTime: fmt(inWindowStart),
      endTime: fmt(new Date(inWindowStart.getTime() + 60 * 60 * 1000)),
    })
    const now = new Date()
    const ended = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
      startTime: '08:00',
      endTime: '09:00',
    })

    try {
      const res = (await handler(eligibilityRequest(patient))) as EligibilityResponse
      expect(res).not.toHaveProperty('mode')
      const byId = Object.fromEntries(res.eligibility.map((e) => [e.bookingId, e]))
      expect(byId[inWindow.bookingId]?.canJoin).toBe(true)
      expect(byId[ended.bookingId]?.canJoin).toBe(false)
      expect(byId[ended.bookingId]?.reason).toBe('Session has ended')
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(inWindow, patient)
      await deletePatientBookingFixture(ended, patient)
    }
  })

  it('does not expose another patient’s bookings and denies STAFF', async () => {
    const owner = await createPatient({ email: `elig-other-owner-${Date.now()}@test.com` })
    const other = await createPatient({ email: `elig-other-${Date.now()}@test.com` })
    const fixture = await createBookedFixture(owner, {
      status: 'CONFIRMED',
      startTime: '10:00',
      endTime: '11:00',
    })

    try {
      const own = (await handler(eligibilityRequest(other))) as EligibilityResponse
      expect(own.eligibility).toHaveLength(0)

      const staff = { ...other, accountType: 'STAFF' }
      await expect(handler(eligibilityRequest(staff))).rejects.toMatchObject({ statusCode: 403 })
    } finally {
      await deletePatientBookingFixture(fixture, owner)
      await deletePatient(other)
    }
  })

  it('TEST mode relaxes only the clock in eligibility responses', async () => {
    useFixedNow()
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { sessionJoinMode: true },
    })
    const previousMode = settings?.sessionJoinMode ?? 'PRODUCTION'
    await prisma.settings.update({
      where: { id: 'singleton' },
      data: { sessionJoinMode: 'TEST' },
    })

    const patient = await createPatient({ email: `elig-test-${Date.now()}@test.com` })
    const now = new Date()
    const ended = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
      startTime: '08:00',
      endTime: '09:00',
    })

    try {
      const res = (await handler(eligibilityRequest(patient))) as EligibilityResponse
      expect(res).not.toHaveProperty('mode')
      expect(res.eligibility.find((e) => e.bookingId === ended.bookingId)?.canJoin).toBe(true)
    } finally {
      await prisma.settings.update({
        where: { id: 'singleton' },
        data: { sessionJoinMode: previousMode },
      }).catch(() => undefined)
      vi.restoreAllMocks()
      await deletePatientBookingFixture(ended, patient)
    }
  })
})
