import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const settingsDefaults = {
    id: 'singleton',
    platformName: 'Tawasul Academy',
    contactEmail: '',
    contactPhone: '',
    whatsappNumber: '',
    paymentGateway: 'paymob' as const,
    paymentGatewayKey: '',
    paymentGatewaySecret: '',
    sessionPricePerHour: 0,
    defaultSessionDuration: 60,
    defaultWorkingStart: '09:00',
    defaultWorkingEnd: '17:00',
    jitsiDomain: 'meet.jit.si',
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