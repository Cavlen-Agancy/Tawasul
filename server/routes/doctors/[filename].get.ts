import { defineEventHandler, createError, sendStream } from 'h3'
import fs from 'node:fs'
import path from 'node:path'

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'filename')
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.startsWith('.')) {
    throw createError({ statusCode: 400, message: 'Invalid file name' })
  }

  const ext = path.extname(filename).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    throw createError({ statusCode: 400, message: 'Invalid file type' })
  }

  const uploadDir = process.env.UPLOAD_PATH || './uploads'
  const fullPath = path.resolve(uploadDir, 'doctors', filename)

  if (!fs.existsSync(fullPath)) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  const stat = fs.statSync(fullPath)
  const stream = fs.createReadStream(fullPath)

  event.node.res.statusCode = 200
  event.node.res.setHeader('Content-Type', CONTENT_TYPES[ext] ?? 'application/octet-stream')
  event.node.res.setHeader('Content-Length', stat.size)
  event.node.res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

  return sendStream(event, stream)
})
