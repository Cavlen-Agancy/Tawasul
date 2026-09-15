import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const settingsDefaults = {
    id: 'singleton',
    platformName: 'Tawasul Academy',
    contactEmail: 'admin@tawasul.com',
    contactPhone: '+201234567890',
    whatsappNumber: '',
    paymentGateway: 'paymob' as const,
    paymentGatewayKey: '',
    paymentGatewaySecret: '',
    sessionPricePerHour: 0,
    defaultSessionDuration: 60,
    defaultWorkingStart: '09:00',
    defaultWorkingEnd: '17:00',
  }

  await prisma.settings.upsert({
    where: { id: 'singleton' },
    create: settingsDefaults,
    update: settingsDefaults,
  })
  console.log('✓ Settings created')

  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  const name = process.env.SEED_ADMIN_NAME
  if (!email || !password || !name) {
    throw new Error('Missing seed environment variables')
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: hashedPassword,
      name,
      accountType: 'STAFF',
      emailVerified: true,
      isActive: true,
    },
    update: {
      name,
      isActive: true,
    },
  })
  console.log('✓ Admin account created')

  // Grant the full permission set to the admin so every admin API is authorized.
  const adminUser = await prisma.user.findUnique({ where: { email } })
  const adminPermissions = [
    'APPOINTMENTS:READ',
    'APPOINTMENTS:UPDATE',
    'APPOINTMENTS:DELETE',
    'PATIENTS:READ',
    'DOCTORS:CREATE',
    'DOCTORS:READ',
    'DOCTORS:UPDATE',
    'PAYMENTS:READ',
    'SETTINGS:READ',
    'SETTINGS:UPDATE',
    'STAFF:CREATE',
    'STAFF:READ',
    'STAFF:UPDATE',
    'STAFF:DELETE',
  ]
  if (adminUser) {
    for (const perm of adminPermissions) {
      const [resource, action] = perm.split(':')
      await prisma.permission.upsert({
        where: { userId_resource_action: { userId: adminUser.id, resource, action } },
        create: { userId: adminUser.id, resource, action },
        update: {},
      })
    }
    console.log(`✓ Admin permissions granted (${adminPermissions.length})`)
  }

  // Seed default global booking schedule (all 7 days, 09:00-17:00, 60 min sessions),
  // matching the Settings default working hours. Friday is the weekly closure
  // day enforced by the UI; Saturday and Sunday are bookable.
  // Admin can adjust via the admin panel.
  const seedSchedules = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: '09:00',
    endTime: '17:00',
    sessionDuration: 60,
    isActive: true,
  }))

  for (const schedule of seedSchedules) {
    await prisma.adminSchedule.upsert({
      where: { dayOfWeek: schedule.dayOfWeek },
      create: schedule,
      update: schedule,
    })
  }
  console.log('✓ Default AdminSchedule (all week) created')

  console.log('Seed complete.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })