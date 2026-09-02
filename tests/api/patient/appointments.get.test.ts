import { describe, expect, it } from 'vitest'
import handler from '~/modules/patient/server/api/patient/appointments.get'
import { createApiEvent, expectApiError } from '../helpers'
import { createPatient, createBookedFixture, deletePatientBookingFixture, deletePatient } from './helpers'

interface Appointment {
  id: string
  status: string
}

describe('GET /api/patient/appointments', () => {
  it('returns upcoming CONFIRMED bookings', async () => {
    const patient = await createPatient({ email: `appt-up-${Date.now()}@test.com` })
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/appointments?tab=upcoming',
        context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      })
      const res = await handler(event) as { appointments: Appointment[] }
      expect(res.appointments.length).toBe(1)
      expect(res.appointments[0].id).toBe(fixture.bookingId)
      expect(res.appointments[0].status).toBe('CONFIRMED')
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('excludes past and cancelled from upcoming', async () => {
    const patient = await createPatient({ email: `appt-up2-${Date.now()}@test.com` })
    const future = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    const past = await createBookedFixture(patient, {
      status: 'CANCELLED',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/appointments?tab=upcoming',
        context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      })
      const res = await handler(event) as { appointments: Appointment[] }
      const ids = res.appointments.map((a) => a.id)
      expect(ids).toContain(future.bookingId)
      expect(ids).not.toContain(past.bookingId)
    } finally {
      await deletePatientBookingFixture(future, patient)
      await deletePatientBookingFixture(past, patient)
    }
  })

  it('returns past confirmed and cancelled bookings', async () => {
    const patient = await createPatient({ email: `appt-past-${Date.now()}@test.com` })
    const pastConfirmed = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    })
    const cancelled = await createBookedFixture(patient, {
      status: 'CANCELLED',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/appointments?tab=past',
        context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      })
      const res = await handler(event) as { appointments: Appointment[] }
      const ids = res.appointments.map((a) => a.id)
      expect(ids).toContain(pastConfirmed.bookingId)
      expect(ids).toContain(cancelled.bookingId)
    } finally {
      await deletePatientBookingFixture(pastConfirmed, patient)
      await deletePatientBookingFixture(cancelled, patient)
    }
  })

  it('defaults to upcoming when no tab provided', async () => {
    const patient = await createPatient({ email: `appt-default-${Date.now()}@test.com` })
    const future = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/appointments',
        context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      })
      const res = await handler(event) as { appointments: Appointment[] }
      expect(res.appointments.map((a) => a.id)).toContain(future.bookingId)
    } finally {
      await deletePatientBookingFixture(future, patient)
    }
  })

  it('returns empty list when no appointments', async () => {
    const patient = await createPatient({ email: `appt-empty-${Date.now()}@test.com` })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/appointments?tab=upcoming',
        context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      })
      const res = await handler(event) as { appointments: Appointment[] }
      expect(res.appointments).toEqual([])
    } finally {
      await deletePatient(patient)
    }
  })

  it('does not leak another patients bookings', async () => {
    const patientA = await createPatient({ email: `appt-a-${Date.now()}@test.com` })
    const fixtureA = await createBookedFixture(patientA, {
      status: 'CONFIRMED',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    const patientB = await createPatient({ email: `appt-b-${Date.now()}@test.com` })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/appointments?tab=upcoming',
        context: { user: { userId: patientB.id, email: patientB.email, accountType: 'PATIENT' } },
      })
      const res = await handler(event) as { appointments: Appointment[] }
      expect(res.appointments).toEqual([])
    } finally {
      await deletePatientBookingFixture(fixtureA, patientA)
      await deletePatient(patientB)
    }
  })

  it('returns all bookings with tab=all (confirmed past + future + cancelled)', async () => {
    const patient = await createPatient({ email: `appt-all-${Date.now()}@test.com` })
    const future = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    const pastConfirmed = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    })
    const cancelled = await createBookedFixture(patient, {
      status: 'CANCELLED',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/appointments?tab=all',
        context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      })
      const res = await handler(event) as { appointments: Appointment[] }
      const ids = res.appointments.map((a) => a.id)
      expect(ids).toContain(future.bookingId)
      expect(ids).toContain(pastConfirmed.bookingId)
      expect(ids).toContain(cancelled.bookingId)
    } finally {
      await deletePatientBookingFixture(future, patient)
      await deletePatientBookingFixture(pastConfirmed, patient)
      await deletePatientBookingFixture(cancelled, patient)
    }
  })

  it('rejects unauthenticated', async () => {
    const event = createApiEvent({ method: 'GET', url: '/api/patient/appointments' })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 401, 'Unauthorized')
    }
  })
})
