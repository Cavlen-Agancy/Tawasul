import { defineEventHandler, readMultipartFormData, createError } from 'h3'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const parts = await readMultipartFormData(event).catch(() => undefined)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: 'No file uploaded' })
  }

  const file = parts.find((p) => p.name === 'file' && p.data && p.data.length > 0)
  if (!file || !file.data) {
    throw createError({ statusCode: 400, message: 'No file uploaded' })
  }

  const type = file.type ?? ''
  if (!ALLOWED_TYPES.has(type)) {
    throw createError({ statusCode: 400, message: 'Only image files are allowed' })
  }

  const maxSize = parseInt(process.env.UPLOAD_MAX_SIZE || '2097152', 10)
  if (file.data.length > maxSize) {
    throw createError({ statusCode: 400, message: 'File size exceeds maximum limit' })
  }

  const uploadDir = process.env.UPLOAD_PATH || './uploads'
  const patientsDir = path.join(uploadDir, 'patients')
  fs.mkdirSync(patientsDir, { recursive: true })

  const ext = IMAGE_EXT[type] ?? 'jpg'
  const filename = `${auth.userId}-${Date.now()}.${ext}`
  const fullPath = path.join(patientsDir, filename)
  fs.writeFileSync(fullPath, file.data)

  const photoPath = `/patients/${filename}`
  await prisma.user.update({
    where: { id: auth.userId },
    data: { photo: photoPath },
  })

  return { photoUrl: photoPath }
})
