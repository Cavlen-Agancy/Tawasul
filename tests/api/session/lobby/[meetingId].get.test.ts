import { describe, expect, it, vi } from 'vitest'
import type { User } from '@prisma/client'
import handler from '~/modules/session/server/api/meeting/lobby/[meetingId].get'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../../helpers'
import { createPatient, createBookedFixture, deletePatientBookingFixture, deletePatient } from '../../patient/helpers'
import { createTestDoctor, deleteTestDoctor, type TestDoctorFixture } from '../../booking/helpers'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function fmt(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function today(): Date {
  return new Date()
}

interface LobbyResponse {
  meetingId: string
  role: 'patient' | 'doctor' | 'staff'
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  canJoin: boolean
  patientName: string
  doctorName: string
  date: string
  startTime: string
  endTime: string
  service: string
}

function request(meetingId: string, user: User) {
  return createApiEvent({
    method: 'GET',
    url: `/api/meeting/lobby/${meetingId}`,
    context: {
      params: { meetingId },
      user: { userId: user.id, email: user.email, accountType: user.accountType },
    },
  })
}

// Pin "now" to 13:00 today so in-window fixtures never straddle midnight
// (a known limitation of the start/end string + single-date booking model).
function fixedNow(): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 13, 0, 0, 0).getTime()
}

function useFixedNow() {
  const now = fixedNow()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  return now
}

function inWindowFixture(patient: User) {
  const now = fixedNow()
  const start = new Date(now - 3 * 60 * 1000)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  return createBookedFixture(patient, {
    status: 'CONFIRMED',
    date: new Date(now),
    startTime: fmt(start),
    endTime: fmt(end),
  })
}

describe('GET /api/meeting/lobby/:meetingId', () => {
  it('lets the owning patient join a confirmed meeting in-window', async () => {
    useFixedNow()
    const patient = await createPatient({ email: `lobby-owner-${Date.now()}@test.com` })
    const fixture = await inWindowFixture(patient)
    try {
      const res = (await handler(request(fixture.bookingId, patient))) as LobbyResponse
      expect(res.meetingId).toBe(fixture.bookingId)
      expect(res.role).toBe('patient')
      expect(res.status).toBe('CONFIRMED')
      expect(res.canJoin).toBe(true)
      expect(res.doctorName).toBeTruthy()
      expect(res.patientName).toBe(patient.name)
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('lets the assigned doctor join as doctor', async () => {
    useFixedNow()
    const patient = await createPatient({ email: `lobby-dr-patient-${Date.now()}@test.com` })
    const fixture = await inWindowFixture(patient)
    const doctor = fixture.doctor.user
    try {
      const res = (await handler(request(fixture.bookingId, doctor))) as LobbyResponse
      expect(res.role).toBe('doctor')
      expect(res.canJoin).toBe(true)
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('lets staff join as staff', async () => {
    useFixedNow()
    const patient = await createPatient({ email: `lobby-staff-patient-${Date.now()}@test.com` })
    const fixture = await inWindowFixture(patient)
    const staff = await createTestUser({ accountType: 'STAFF', emailVerified: true, email: `lobby-staff-${Date.now()}@test.com` })
    try {
      const res = (await handler(request(fixture.bookingId, staff))) as LobbyResponse
      expect(res.role).toBe('staff')
      expect(res.canJoin).toBe(true)
    } finally {
      vi.restoreAllMocks()
      await deletePatientBookingFixture(fixture, patient)
      await deleteTestUser(staff.id)
    }
  })

  it('rejects a patient who is not part of the meeting', async () => {
    const owner = await createPatient({ email: `lobby-owner2-${Date.now()}@test.com` })
    const other = await createPatient({ email: `lobby-intruder-${Date.now()}@test.com` })
    const fixture = await inWindowFixture(owner)
    try {
      try {
        await handler(request(fixture.bookingId, other))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'You are not part of this meeting')
      }
    } finally {
      await deletePatientBookingFixture(fixture, owner)
      await deletePatient(other)
    }
  })

  it('rejects a doctor who is not the assigned doctor', async () => {
    const owner = await createPatient({ email: `lobby-wrongdoc-patient-${Date.now()}@test.com` })
    const fixture = await inWindowFixture(owner)
    const wrongDoctor: TestDoctorFixture = await createTestDoctor({
      dayOfWeek: 2,
      startTime: '09:00',
      endTime: '18:00',
    })
    try {
      try {
        await handler(request(fixture.bookingId, wrongDoctor.user))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'You are not part of this meeting')
      }
    } finally {
      await deletePatientBookingFixture(fixture, owner)
      await deleteTestDoctor(wrongDoctor.doctor.id, wrongDoctor.user.id)
    }
  })

  it('returns canJoin false for a confirmed meeting outside the window (5-minute rule)', async () => {
    const patient = await createPatient({ email: `lobby-far-${Date.now()}@test.com` })
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      startTime: '09:00',
      endTime: '10:00',
    })
    try {
      const res = (await handler(request(fixture.bookingId, patient))) as LobbyResponse
      expect(res.status).toBe('CONFIRMED')
      expect(res.canJoin).toBe(false)
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('returns canJoin false (status PENDING) for a pending booking', async () => {
    const patient = await createPatient({ email: `lobby-pending-${Date.now()}@test.com` })
    const start = new Date(Date.now() + 2 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fixture = await createBookedFixture(patient, {
      status: 'PENDING',
      date: today(),
      startTime: fmt(start),
      endTime: fmt(end),
    })
    try {
      const res = (await handler(request(fixture.bookingId, patient))) as LobbyResponse
      expect(res.status).toBe('PENDING')
      expect(res.canJoin).toBe(false)
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('returns 404 for a nonexistent meeting', async () => {
    const patient = await createPatient({ email: `lobby-nf-${Date.now()}@test.com` })
    try {
      try {
        await handler(request('nonexistent', patient))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 404, 'Meeting not found')
      }
    } finally {
      await deletePatient(patient)
    }
  })

  it('rejects unauthenticated users', async () => {
    const event = createApiEvent({
      method: 'GET',
      url: '/api/meeting/lobby/some-id',
      context: { params: { meetingId: 'some-id' }, user: null },
    })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 401, 'Unauthorized')
    }
  })
})