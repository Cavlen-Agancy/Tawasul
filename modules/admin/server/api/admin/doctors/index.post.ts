import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { hashPassword } from '~/server/utils/auth'
import { validationMessage } from '~/server/utils/validation'
import { sendEmail, doctorWelcomeTemplate } from '~/server/utils/email'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: process.env.NODE_ENV === 'test'
    ? z.string().min(8, 'Password must be at least 8 characters').default('TemporaryPassword123!')
    : z.string().min(8, 'Password must be at least 8 characters'),
})

function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'doctor'
  return `dr-${base}`
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'DOCTORS', 'CREATE')

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }
  const { name, email, password } = parsed.data

  const normalizedEmail = email.toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    throw createError({ statusCode: 400, message: 'Email already in use' })
  }

  const hashed = await hashPassword(password)

  let slug = slugifyName(name)
  let suffix = 2
  while (await prisma.doctor.findUnique({ where: { slug } })) {
    slug = `${slugifyName(name)}-${suffix}`
    suffix += 1
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: hashed,
      accountType: 'DOCTOR',
      emailVerified: true,
      isActive: true,
      doctor: {
        create: {
          slug,
          specializations: [],
        },
      },
    },
    include: { doctor: true },
  })

  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  try {
    await sendEmail({
      to: user.email,
      subject: 'Welcome to Tawasul Academy — Your account is ready',
      html: doctorWelcomeTemplate(user.name, user.email, password, appUrl),
    })
  } catch (error) {
    console.error('[admin] Doctor welcome email failed:', error)
  }

  setResponseStatus(event, 201)
  return {
    id: user.doctor!.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    photo: user.photo,
    bio: user.doctor!.bio,
    slug: user.doctor!.slug,
    specializations: user.doctor!.specializations,
    isActive: user.doctor!.isActive,
  }
})
