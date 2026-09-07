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

export interface TestAdminScheduleFixture {
  adminScheduleId: string
}

/**
 * Creates an AdminSchedule record for the given weekday. The global schedule is the
 * only source of availability after the architecture fix, so tests no longer need
 * a Doctor. Returns its id for cleanup.
 */
export async function createTestAdminSchedule(opts: {
  dayOfWeek: number
  startTime: string
  endTime: string
  sessionDuration?: number
}): Promise<TestAdminScheduleFixture> {
  const schedule = await prisma.adminSchedule.upsert({
    where: { dayOfWeek: opts.dayOfWeek },
    create: {
      dayOfWeek: opts.dayOfWeek,
      startTime: opts.startTime,
      endTime: opts.endTime,
      sessionDuration: opts.sessionDuration ?? 60,
    },
    update: {
      startTime: opts.startTime,
      endTime: opts.endTime,
      sessionDuration: opts.sessionDuration ?? 60,
      isActive: true,
    },
  })
  return { adminScheduleId: schedule.id }
}

export async function deleteTestAdminSchedule(adminScheduleId: string): Promise<void> {
  await prisma.adminSchedule.deleteMany({ where: { id: adminScheduleId } }).catch(() => undefined)
}

/**
 * Restores the seeded weekend schedule rows (Sat/Sun 09:00-17:00, 60 min).
 * Several suites upsert day 0/6 rows for their own fixtures and delete them in
 * `afterAll`, which would otherwise destroy the seeded rows the E2E suite and
 * other tests rely on. Call at the end of `afterAll`, after deletions.
 */
export async function restoreSeedWeekendSchedules(): Promise<void> {
  for (const dayOfWeek of [0, 6]) {
    await prisma.adminSchedule.upsert({
      where: { dayOfWeek },
      create: { dayOfWeek, startTime: '09:00', endTime: '17:00', sessionDuration: 60, isActive: true },
      update: { startTime: '09:00', endTime: '17:00', sessionDuration: 60, isActive: true },
    })
  }
}

export async function createTestBlockedDate(date: string): Promise<string> {
  const [y, m, d] = date.split('-').map((p) => parseInt(p, 10))
  // `@db.Date` contract: store at UTC midnight so the intended calendar day
  // round-trips exactly (a local-midnight write stores the previous day).
  const atUTC = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  const record = await prisma.globalBlockedDate.upsert({
    where: { date: atUTC },
    create: { date: atUTC },
    update: {},
  })
  return record.id
}

export async function deleteTestBlockedDate(id: string): Promise<void> {
  await prisma.globalBlockedDate.deleteMany({ where: { id } }).catch(() => undefined)
}
