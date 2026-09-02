import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { patientProfileSchema, parseBody } from '~/server/utils/validation'

const nullablePhoneSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    phone: z
      .string()
      .max(30)
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .passthrough()

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])
  const body = await readBody<unknown>(event).catch(() => undefined)

  const parsed = parseBody(body, patientProfileSchema)
  if (!parsed) {
    throw createError({
      statusCode: 400,
      message: 'Name must be at least 2 characters',
    })
  }

  const normalized = nullablePhoneSchema.safeParse(parsed)
  const data = normalized.success ? normalized.data : { name: parsed.name, phone: null }

  try {
    const update = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        name: data.name,
        phone: data.phone ?? null,
      },
      select: { id: true, name: true, email: true, phone: true, photo: true },
    })
    return update
  } catch {
    throw createError({ statusCode: 404, message: 'User not found' })
  }
})
