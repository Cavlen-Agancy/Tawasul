import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import crypto from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { requirePermission } from '~/server/utils/permissions'
import { hashPassword } from '~/server/utils/auth'
import { staffCreateSchema, validationMessage } from '~/server/utils/validation'
import { sendEmail, doctorWelcomeTemplate } from '~/server/utils/email'

const VALID_RESOURCES = new Set(['APPOINTMENTS', 'PATIENTS', 'DOCTORS', 'PAYMENTS', 'SETTINGS', 'STAFF'])
const VALID_ACTIONS = new Set(['CREATE', 'READ', 'UPDATE', 'DELETE'])

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'STAFF', 'CREATE')

  const body = await readBody<unknown>(event).catch(() => undefined)
  const parsed = staffCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: validationMessage(parsed.error) })
  }
  const { name, email, phone, password, permissions } = parsed.data

  const normalizedEmail = email.toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    throw createError({ statusCode: 400, message: 'Email already in use' })
  }

  for (const p of permissions ?? []) {
    if (!VALID_RESOURCES.has(p.resource) || !VALID_ACTIONS.has(p.action)) {
      throw createError({ statusCode: 400, message: 'Invalid permission' })
    }
  }

  const rawPassword = password || crypto.randomBytes(8).toString('base64')
  const hashed = await hashPassword(rawPassword)

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? phone : null,
      password: hashed,
      accountType: 'STAFF',
      emailVerified: true,
      isActive: true,
      permissions: {
        create: (permissions ?? []).map((p) => ({
          resource: p.resource as never,
          action: p.action as never,
        })),
      },
    },
    include: { permissions: { select: { resource: true, action: true } } },
  })

  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  try {
    await sendEmail({
      to: user.email,
      subject: 'Welcome to Tawasul Academy — Your account is ready',
      html: doctorWelcomeTemplate(user.name, user.email, rawPassword, appUrl),
    })
  } catch (error) {
    console.error('[admin] Staff welcome email failed:', error)
  }

  setResponseStatus(event, 201)
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    photo: user.photo,
    isActive: user.isActive,
    permissions: user.permissions,
  }
})
