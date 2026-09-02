import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const FIXTURES = {
  patient: { email: 'e2e.patient@test.com', password: 'TestPass123!', accountType: 'PATIENT' },
  doctor: { email: 'e2e.doctor@test.com', password: 'TestPass123!', accountType: 'DOCTOR' },
  staff: { email: 'e2e.staff@test.com', password: 'TestPass123!', accountType: 'STAFF' },
} as const

export default async function globalSetup() {
  const password = await bcrypt.hash(FIXTURES.patient.password, 12)

  for (const fixture of [FIXTURES.patient, FIXTURES.doctor, FIXTURES.staff]) {
    await prisma.user.upsert({
      where: { email: fixture.email },
      update: { isActive: true, emailVerified: true },
      create: {
        name: fixture.accountType === 'DOCTOR' ? 'Dr. E2E Doctor' : `E2E ${fixture.accountType}`,
        email: fixture.email,
        password,
        accountType: fixture.accountType,
        emailVerified: true,
        isActive: true,
      },
    })
  }

  await prisma.$disconnect()
}

export { FIXTURES }
