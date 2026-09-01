import { createEvent } from 'h3'
import { expect } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import { hashPassword } from '~/server/utils/auth'

export interface ApiEventOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url?: string
  cookies?: Record<string, string>
  body?: unknown
  context?: Record<string, unknown>
}

/**
 * Builds a minimal but fully functional h3 event for invoking Nitro handlers directly.
 * Uses h3's own createEvent so cookie/query/body utilities behave like on a real request.
 */
export function createApiEvent(opts: ApiEventOptions = {}) {
  const headers: Record<string, string | undefined> = {}
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const cookieString = Object.entries(opts.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  if (cookieString) headers.cookie = cookieString

  const res: Record<string, unknown> = {
    statusCode: 200,
    statusMessage: 'OK',
    headers: new Map<string, string | string[]>(),
    writableEnded: false,
    headersSent: false,
  }
  res.setHeader = (key: string, value: string | string[]) => (res.headers as Map<string, string | string[]>).set(key, value)
  res.getHeader = (key: string) => (res.headers as Map<string, string | string[]>).get(key)
  res.removeHeader = (key: string) => (res.headers as Map<string, string | string[]>).delete(key)
  res.appendHeader = (key: string, value: string) => {
    const map = res.headers as Map<string, string | string[]>
    const current = map.get(key)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.set(key, current ? ([] as any).concat(current, value) : value)
  }

  const req: Record<string, unknown> = {
    method: opts.method ?? 'POST',
    url: opts.url ?? '/api/x',
    headers,
  }
  if (opts.body !== undefined) req.body = opts.body

  const event = createEvent(req as never, res as never)
  event.context = { ...(opts.context ?? {}) }
  return event
}

export function getSetCookie(event: ReturnType<typeof createApiEvent>): string[] {
  const value = event.node.res.getHeader('set-cookie') as string | string[] | undefined
  return Array.isArray(value) ? value : value ? [value] : []
}

export function getAuthCookie(event: ReturnType<typeof createApiEvent>): string | undefined {
  const raw = getSetCookie(event).find((c) => c.startsWith('auth_token='))
  if (!raw) return undefined
  const match = raw.match(/^auth_token=([^;]*)/)
  return match?.[1]
}

export function expectApiError(error: unknown, statusCode: number, message: string) {
  const err = error as { statusCode?: number; message?: string }
  expect(err.statusCode).toBe(statusCode)
  expect(err.message).toBe(message)
}

let fixtureCounter = 0

export interface TestUserOptions {
  accountType?: 'PATIENT' | 'DOCTOR' | 'STAFF'
  email?: string
  password?: string
  emailVerified?: boolean
  isActive?: boolean
  emailVerificationToken?: string | null
  emailVerificationExpiry?: Date | null
  passwordResetToken?: string | null
  passwordResetExpiry?: Date | null
  permissions?: { resource: string; action: string }[]
}

export async function createTestUser(options: TestUserOptions = {}) {
  const email = options.email ?? `test-${Date.now()}-${fixtureCounter++}@example.com`
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: options.accountType === 'STAFF' ? 'Test Staff' : options.accountType === 'DOCTOR' ? 'Test Doctor' : 'Test Patient',
      password: await hashPassword(options.password ?? 'CorrectPass123!'),
      accountType: options.accountType ?? 'PATIENT',
      phone: null,
      photo: null,
      emailVerified: options.emailVerified ?? false,
      isActive: options.isActive ?? true,
      emailVerificationToken: options.emailVerificationToken ?? null,
      emailVerificationExpiry: options.emailVerificationExpiry ?? null,
      passwordResetToken: options.passwordResetToken ?? null,
      passwordResetExpiry: options.passwordResetExpiry ?? null,
    },
    update: {},
  })
  if (options.permissions && options.permissions.length > 0) {
    await prisma.permission.createMany({
      data: options.permissions.map((p) => ({
        userId: user.id,
        resource: p.resource as never,
        action: p.action as never,
      })),
      skipDuplicates: true,
    })
  }
  return user
}

export async function deleteTestUser(id: string) {
  await prisma.permission.deleteMany({ where: { userId: id } })
  await prisma.user.deleteMany({ where: { id } }).catch(() => undefined)
}