import { prisma } from '~/server/utils/prisma'
import { hashPassword } from '~/server/utils/auth'

let counter = 0

export interface TestAdminDoctorFixture {
  user: { id: string }
  doctor: { id: string }
}

export async function createTestAdminDoctor(): Promise<TestAdminDoctorFixture> {
  const email = `admin-dr-${Date.now()}-${counter++}@test.com`
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Admin Test Doctor',
      password: await hashPassword('CorrectPass123!'),
      accountType: 'DOCTOR',
      emailVerified: true,
      isActive: true,
    },
  })
  const doctor = await prisma.doctor.create({
    data: {
      userId: user.id,
      slug: `admin-dr-${Date.now()}-${counter++}`,
      bio: 'Test doctor',
      specializations: ['Marital Counseling'],
      isActive: true,
    },
  })
  return { user: { id: user.id }, doctor: { id: doctor.id } }
}

export async function deleteTestAdminDoctor(doctorId: string, userId: string): Promise<void> {
  await prisma.booking.deleteMany({ where: { doctorId } }).catch(() => undefined)
  await prisma.doctor.deleteMany({ where: { id: doctorId } }).catch(() => undefined)
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined)
}