import { prisma } from '~/server/utils/prisma'
import { createTestUser, deleteTestUser, type TestUserOptions } from '../helpers'
import { createTestDoctor, deleteTestDoctor, type TestDoctorFixture } from '../booking/helpers'
import type { User } from '@prisma/client'

export interface PatientBookingFixture {
  doctor: TestDoctorFixture
  bookingId: string
  paymentId: string
}

let counter = 0

export async function createPatient(options: TestUserOptions = {}): Promise<User> {
  return createTestUser({
    accountType: 'PATIENT',
    emailVerified: true,
    email: options.email ?? `patient-${Date.now()}-${counter++}@test.com`,
    ...options,
  })
}

export interface CreateBookedFixtureOpts {
  dayOfWeek?: number
  status?: 'CONFIRMED' | 'PENDING' | 'CANCELLED'
  date?: Date
  startTime?: string
  endTime?: string
  service?: string
  paymentStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
  amount?: number
}

export async function createBookedFixture(
  patient: User,
  opts: CreateBookedFixtureOpts = {},
): Promise<PatientBookingFixture> {
  const doctor = await createTestDoctor({
    dayOfWeek: opts.dayOfWeek ?? 1,
    startTime: '09:00',
    endTime: '18:00',
    sessionDuration: 60,
    specializations: ['Marital Counseling'],
  })

  const booking = await prisma.booking.create({
    data: {
      userId: patient.id,
      doctorId: doctor.doctor.id,
      date: opts.date ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      startTime: opts.startTime ?? '10:00',
      endTime: opts.endTime ?? '11:00',
      service: opts.service ?? 'Marital Counseling',
      status: opts.status ?? 'CONFIRMED',
    },
  })

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      amount: opts.amount ?? 100,
      currency: 'EGP',
      status: opts.paymentStatus ?? 'SUCCESS',
    },
  })

  return { doctor, bookingId: booking.id, paymentId: payment.id }
}

export async function deletePatient(user: User): Promise<void> {
  await prisma.booking.deleteMany({ where: { userId: user.id } }).catch(() => undefined)
  await deleteTestUser(user.id)
}

export async function deletePatientBookingFixture(
  fixture: PatientBookingFixture,
  patient: User,
): Promise<void> {
  await prisma.payment.deleteMany({ where: { bookingId: fixture.bookingId } }).catch(() => undefined)
  await prisma.sessionRoom.deleteMany({ where: { bookingId: fixture.bookingId } }).catch(() => undefined)
  await prisma.booking.deleteMany({ where: { id: fixture.bookingId } }).catch(() => undefined)
  await deleteTestDoctor(fixture.doctor.doctor.id, fixture.doctor.user.id)
  await deleteTestUser(patient.id)
}
