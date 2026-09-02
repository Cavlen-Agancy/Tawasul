import { describe, expect, it } from 'vitest'
import handler from '~/modules/patient/server/api/patient/payments.get'
import { createApiEvent, expectApiError } from '../helpers'
import { createPatient, createBookedFixture, deletePatientBookingFixture, deletePatient } from './helpers'

interface PaymentRow {
  id: string
  amount: number
  currency: string
  status: string
  booking: { doctorName: string; date: string; service: string }
}

describe('GET /api/patient/payments', () => {
  it('returns payments for the patient bookings', async () => {
    const patient = await createPatient({ email: `pay-${Date.now()}@test.com` })
    const fixture = await createBookedFixture(patient, {
      status: 'CONFIRMED',
      amount: 150.5,
      paymentStatus: 'SUCCESS',
    })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/payments',
        context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      })
      const res = await handler(event) as { payments: PaymentRow[] }
      expect(res.payments.length).toBe(1)
      expect(res.payments[0].id).toBe(fixture.paymentId)
      expect(res.payments[0].amount).toBe(150.5)
      expect(res.payments[0].currency).toBe('EGP')
      expect(res.payments[0].status).toBe('SUCCESS')
      expect(res.payments[0].booking.service).toBe('Marital Counseling')
      expect(res.payments[0].booking.doctorName).toBeTruthy()
    } finally {
      await deletePatientBookingFixture(fixture, patient)
    }
  })

  it('returns empty list when no payments', async () => {
    const patient = await createPatient({ email: `pay-empty-${Date.now()}@test.com` })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/payments',
        context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      })
      const res = await handler(event) as { payments: PaymentRow[] }
      expect(res.payments).toEqual([])
    } finally {
      await deletePatient(patient)
    }
  })

  it('does not leak another patients payments', async () => {
    const patientA = await createPatient({ email: `pay-a-${Date.now()}@test.com` })
    const fixtureA = await createBookedFixture(patientA, { status: 'CONFIRMED' })
    const patientB = await createPatient({ email: `pay-b-${Date.now()}@test.com` })
    try {
      const event = createApiEvent({
        method: 'GET',
        url: '/api/patient/payments',
        context: { user: { userId: patientB.id, email: patientB.email, accountType: 'PATIENT' } },
      })
      const res = await handler(event) as { payments: PaymentRow[] }
      expect(res.payments).toEqual([])
    } finally {
      await deletePatientBookingFixture(fixtureA, patientA)
      await deletePatient(patientB)
    }
  })

  it('rejects unauthenticated', async () => {
    const event = createApiEvent({ method: 'GET', url: '/api/patient/payments' })
    try {
      await handler(event)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 401, 'Unauthorized')
    }
  })
})
