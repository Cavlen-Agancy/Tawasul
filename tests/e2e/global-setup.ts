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

  // Give the staff fixture the same operational permissions as the seed
  // administrator so the admin overview is rendered for the admin workspace.
  const staffUser = await prisma.user.findUniqueOrThrow({ where: { email: FIXTURES.staff.email } })
  const staffPermissions = [
    'APPOINTMENTS:READ', 'APPOINTMENTS:UPDATE', 'APPOINTMENTS:DELETE',
    'PATIENTS:READ', 'DOCTORS:CREATE', 'DOCTORS:READ', 'DOCTORS:UPDATE',
    'PAYMENTS:READ', 'SETTINGS:READ', 'SETTINGS:UPDATE',
    'STAFF:CREATE', 'STAFF:READ', 'STAFF:UPDATE', 'STAFF:DELETE',
  ]
  for (const permission of staffPermissions) {
    const [resource, action] = permission.split(':')
    await prisma.permission.upsert({
      where: { userId_resource_action: { userId: staffUser.id, resource, action } },
      create: { userId: staffUser.id, resource, action },
      update: {},
    })
  }

  await prisma.$disconnect()
}

export { FIXTURES }
