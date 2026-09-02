import { describe, expect, it, afterAll } from 'vitest'
import { createEvent } from 'h3'
import handler from '~/modules/patient/server/api/patient/profile/photo.post'
import { deleteTestUser } from '../../helpers'
import { createPatient } from '../helpers'
import type { User } from '@prisma/client'

const toDelete: string[] = []
afterAll(async () => {
  await Promise.all(toDelete.map((id) => deleteTestUser(id)))
})

const BOUNDARY = '----TestBoundary7MA4YWxkTrZu0gW'

function makeMultipartEvent(
  user: User,
  parts: { name: string; filename?: string; type?: string; data: Buffer | string }[],
) {
  const chunks: Buffer[] = []
  for (const part of parts) {
    let header = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"`
    if (part.filename) header += `; filename="${part.filename}"`
    header += '\r\n'
    if (part.type) header += `Content-Type: ${part.type}\r\n`
    header += '\r\n'
    chunks.push(Buffer.from(header))
    chunks.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(String(part.data)))
    chunks.push(Buffer.from('\r\n'))
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`))
  const body = Buffer.concat(chunks)

  const res: Record<string, unknown> = {
    statusCode: 200,
    statusMessage: 'OK',
    headers: new Map(),
    setHeader: (k: string, v: string | string[]) => (res.headers as Map<string, unknown>).set(k, v),
    getHeader: (k: string) => (res.headers as Map<string, unknown>).get(k),
    removeHeader: (k: string) => (res.headers as Map<string, unknown>).delete(k),
    appendHeader: (k: string, v: string) => (res.headers as Map<string, string>).set(k, v),
  }
  const req: Record<string, unknown> = {
    method: 'POST',
    url: '/api/patient/profile/photo',
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    body,
  }
  const event = createEvent(req as never, res as never)
  event.context = { user: { userId: user.id, email: user.email, accountType: 'PATIENT' } }
  return event
}

describe('POST /api/patient/profile/photo', () => {
  it('uploads a valid image', async () => {
    const patient = await createPatient({ email: `photo-ok-${Date.now()}@test.com` })
    toDelete.push(patient.id)

    const event = makeMultipartEvent(patient, [
      { name: 'file', filename: 'avatar.jpg', type: 'image/jpeg', data: Buffer.from('fakejpegdata') },
    ])
    const res = await handler(event) as { photoUrl: string }
    expect(res.photoUrl).toMatch(/^\/patients\//)
  })

  it('rejects an invalid file type', async () => {
    const patient = await createPatient({ email: `photo-bad-${Date.now()}@test.com` })
    toDelete.push(patient.id)

    const event = makeMultipartEvent(patient, [
      { name: 'file', filename: 'doc.pdf', type: 'application/pdf', data: Buffer.from('%PDF-1.4') },
    ])
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400, message: 'Only image files are allowed' })
  })

  it('rejects a file that is too large', async () => {
    const patient = await createPatient({ email: `photo-big-${Date.now()}@test.com` })
    toDelete.push(patient.id)

    // 3MB buffer exceeds the 2MB default UPLOAD_MAX_SIZE
    const big = Buffer.alloc(3 * 1024 * 1024, 1)
    const event = makeMultipartEvent(patient, [
      { name: 'file', filename: 'big.jpg', type: 'image/jpeg', data: big },
    ])
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400, message: 'File size exceeds maximum limit' })
  })

  it('rejects unauthenticated', async () => {
    const patient = await createPatient({ email: `photo-unauth-${Date.now()}@test.com` })
    toDelete.push(patient.id)
    const event = makeMultipartEvent(patient, [
      { name: 'file', filename: 'a.jpg', type: 'image/jpeg', data: Buffer.from('x') },
    ])
    event.context = {}
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401, message: 'Unauthorized' })
  })
})
