import bcrypt from 'bcryptjs'
import jwt, { type SignOptions } from 'jsonwebtoken'
import crypto from 'node:crypto'
import { createError, type H3Event } from 'h3'
import { getServerRuntimeConfig } from '~/server/utils/runtime'

export interface AuthUser {
  userId: string
  email: string
  accountType: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed)
}

export function generateJWT(payload: AuthUser): string {
  const config = getServerRuntimeConfig()
  const secret = config?.jwtSecret ?? process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  const expiresIn = (config?.jwtExpiresIn ?? (process.env.JWT_EXPIRES_IN || '7d')) as SignOptions['expiresIn']
  return jwt.sign(payload, secret, { expiresIn })
}

export function verifyJWT(token: string): AuthUser {
  const secret = getServerRuntimeConfig()?.jwtSecret ?? process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return jwt.verify(token, secret) as AuthUser
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function requireAuth(event: H3Event, accountTypes?: string[]): AuthUser {
  const user = event.context.user as AuthUser | null | undefined
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (accountTypes && !accountTypes.includes(user.accountType)) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return user
}