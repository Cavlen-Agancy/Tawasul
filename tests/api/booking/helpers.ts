import { prisma } from '~/server/utils/prisma'
import { hashPassword } from '~/server/utils/auth'
import type { User } from '@prisma/client'

let counter = 0

export interface TestDoctorFixture {
  user: User
  doctor: { id: string; slug: string }
  availabilityId: string
}

export async function createTestDoctor(opts: {
  dayOfWeek: number
  startTime: string
  endTime: string
  sessionDuration?: number
  specializations?: string[]
  isActive?: boolean
}): Promise<TestDoctorFixture> {
  const slug = `dr-fixture-${Date.now()}-${counter++}`
  const email = `doctor-${Date.now()}-${counter++}@test.com`
  const name = `Dr Fixture ${Date.now()}-${counter}`
  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: await hashPassword('CorrectPass123!'),
      accountType: 'DOCTOR',
      emailVerified: true,
      isActive: true,
    },
  })

  const doctor = await prisma.doctor.create({
    data: {
      userId: user.id,
      slug,
      bio: 'Test doctor',
      specializations: opts.specializations ?? ['Marital Counseling'],
      isActive: opts.isActive ?? true,
    },
  })

  const availability = await prisma.availability.create({
    data: {
      doctorId: doctor.id,
      dayOfWeek: opts.dayOfWeek,
      startTime: opts.startTime,
      endTime: opts.endTime,
      sessionDuration: opts.sessionDuration ?? 60,
    },
  })

  return { user, doctor: { id: doctor.id, slug: doctor.slug }, availabilityId: availability.id }
}

export function nextDateWithDayOfWeek(targetDay: number): string {
  const now = new Date()
  const diff = (targetDay - now.getDay() + 7) % 7
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff + 7)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function deleteTestDoctor(doctorId: string, userId: string): Promise<void> {
  await prisma.availability.deleteMany({ where: { doctorId } }).catch(() => undefined)
  await prisma.blockedSlot.deleteMany({ where: { doctorId } }).catch(() => undefined)
  await prisma.booking.deleteMany({ where: { doctorId } }).catch(() => undefined)
  await prisma.doctor.deleteMany({ where: { id: doctorId } }).catch(() => undefined)
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined)
}

export async function deleteTestBooking(bookingId: string): Promise<void> {
  await prisma.payment.deleteMany({ where: { bookingId } }).catch(() => undefined)
  await prisma.booking.deleteMany({ where: { id: bookingId } }).catch(() => undefined)
}
