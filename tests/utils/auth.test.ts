import { beforeEach, afterEach, afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  hashPassword,
  comparePassword,
  generateJWT,
  verifyJWT,
  generateToken,
  requireAuth,
} from '../../server/utils/auth'

function mockEvent(user: unknown) {
  return { context: { user } }
}

describe('hashPassword', () => {
  it('returns a string', async () => {
    const result = await hashPassword('password123')
    expect(typeof result).toBe('string')
  })

  it('returns a bcrypt hash (starts with $2)', async () => {
    const result = await hashPassword('password123')
    expect(result.startsWith('$2')).toBe(true)
  })

  it('same input produces different hashes (salt)', async () => {
    const [a, b] = await Promise.all([hashPassword('password123'), hashPassword('password123')])
    expect(a).not.toBe(b)
  })

  it('hash length is always 60 characters', async () => {
    const result = await hashPassword('anypassword')
    expect(result.length).toBe(60)
  })
})

describe('comparePassword', () => {
  it('returns true for correct password', async () => {
    const hashed = await hashPassword('password123')
    expect(await comparePassword('password123', hashed)).toBe(true)
  })

  it('returns false for wrong password', async () => {
    const hashed = await hashPassword('password123')
    expect(await comparePassword('wrongpassword', hashed)).toBe(false)
  })

  it('returns false for empty string', async () => {
    const hashed = await hashPassword('password123')
    expect(await comparePassword('', hashed)).toBe(false)
  })
})

describe('generateJWT', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-unit-tests'
    process.env.JWT_EXPIRES_IN = '7d'
  })

  afterAll(() => {
    delete process.env.JWT_SECRET
    delete process.env.JWT_EXPIRES_IN
  })

  it('returns a string', () => {
    const token = generateJWT({ userId: 'u1', email: 'a@b.com', accountType: 'PATIENT' })
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('token has three parts (header.payload.signature)', () => {
    const token = generateJWT({ userId: 'u1', email: 'a@b.com', accountType: 'PATIENT' })
    expect(token.split('.')).toHaveLength(3)
  })

  it('token contains the payload data', () => {
    const token = generateJWT({ userId: 'u1', email: 'a@b.com', accountType: 'PATIENT' })
    const decoded = verifyJWT(token)
    expect(decoded.userId).toBe('u1')
    expect(decoded.email).toBe('a@b.com')
    expect(decoded.accountType).toBe('PATIENT')
  })
})

describe('verifyJWT', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-unit-tests'
    process.env.JWT_EXPIRES_IN = '7d'
  })

  afterEach(() => {
    delete process.env.JWT_SECRET
    delete process.env.JWT_EXPIRES_IN
  })

  it('returns the original payload', () => {
    const token = generateJWT({ userId: 'u1', email: 'a@b.com', accountType: 'STAFF' })
    const decoded = verifyJWT(token)
    expect(decoded).toMatchObject({ userId: 'u1', email: 'a@b.com', accountType: 'STAFF' })
  })

  it('throws on invalid token', () => {
    expect(() => verifyJWT('invalid.token.string')).toThrow()
  })

  it('throws on tampered token', () => {
    const token = generateJWT({ userId: 'u1', email: 'a@b.com', accountType: 'PATIENT' })
    const [header, payload, signature] = token.split('.')
    const tampered = `${header}.${payload}.${signature.slice(0, -1)}${signature.endsWith('a') ? 'b' : 'a'}`
    expect(() => verifyJWT(tampered)).toThrow()
  })

  it('throws on token signed with wrong secret', () => {
    const token = generateJWT({ userId: 'u1', email: 'a@b.com', accountType: 'PATIENT' })
    process.env.JWT_SECRET = 'wrong-secret'
    expect(() => verifyJWT(token)).toThrow()
  })
})

describe('generateToken', () => {
  it('returns a string', () => {
    expect(typeof generateToken()).toBe('string')
  })

  it('returns 64 characters', () => {
    expect(generateToken()).toHaveLength(64)
  })

  it('returns hex characters only', () => {
    expect(/^[a-f0-9]+$/.test(generateToken())).toBe(true)
  })

  it('two calls return different values', () => {
    expect(generateToken()).not.toBe(generateToken())
  })
})

describe('requireAuth', () => {
  it('returns user when authenticated', () => {
    const event = mockEvent({ userId: 'u1', email: 'a@b.com', accountType: 'PATIENT' }) as never
    const result = requireAuth(event, undefined)
    expect(result).toEqual({ userId: 'u1', email: 'a@b.com', accountType: 'PATIENT' })
  })

  it('returns user when accountType matches', () => {
    const event = mockEvent({ userId: 'u1', email: 'a@b.com', accountType: 'DOCTOR' }) as never
    expect(requireAuth(event, ['DOCTOR'])).toEqual({
      userId: 'u1',
      email: 'a@b.com',
      accountType: 'DOCTOR',
    })
  })

  it('returns user when accountType is in list', () => {
    const event = mockEvent({ userId: 'u1', email: 'a@b.com', accountType: 'STAFF' }) as never
    expect(requireAuth(event, ['DOCTOR', 'STAFF']).accountType).toBe('STAFF')
  })

  it('throws 401 when no user', () => {
    const event = mockEvent(null) as never
    try {
      requireAuth(event)
      expect.unreachable('should have thrown')
    } catch (error: unknown) {
      expect((error as { statusCode?: number }).statusCode).toBe(401)
    }
  })

  it('throws 401 when user is undefined', () => {
    const event = mockEvent(undefined) as never
    try {
      requireAuth(event)
      expect.unreachable('should have thrown')
    } catch (error: unknown) {
      expect((error as { statusCode?: number }).statusCode).toBe(401)
    }
  })

  it('throws 403 when accountType not in list', () => {
    const event = mockEvent({ accountType: 'PATIENT' }) as never
    try {
      requireAuth(event, ['DOCTOR'])
      expect.unreachable('should have thrown')
    } catch (error: unknown) {
      expect((error as { statusCode?: number }).statusCode).toBe(403)
    }
  })

  it('throws 403 when accountType is STAFF but list is PATIENT only', () => {
    const event = mockEvent({ accountType: 'STAFF' }) as never
    try {
      requireAuth(event, ['PATIENT'])
      expect.unreachable('should have thrown')
    } catch (error: unknown) {
      expect((error as { statusCode?: number }).statusCode).toBe(403)
    }
  })
})