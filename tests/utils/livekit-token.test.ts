import { describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'
import { generateLiveKitToken } from '~/server/utils/livekit-token'

interface DecodedToken {
  exp?: number
  nbf?: number
  iat?: number
  sub?: string
  name?: string
  video?: {
    room?: string
    roomJoin?: boolean
    canPublish?: boolean
    canSubscribe?: boolean
  }
}

function decode(token: string): DecodedToken {
  return jwt.decode(token) as DecodedToken
}

function payload(overrides: Partial<Parameters<typeof generateLiveKitToken>[0]> = {}) {
  return {
    userId: 'patient-user-id',
    userName: 'Test Patient',
    roomName: 'tawasul-booking-id',
    role: 'member' as const,
    ...overrides,
  }
}

describe('generateLiveKitToken', () => {
  it('issues a room-scoped member token without publish/subscribe permission', async () => {
    const token = await generateLiveKitToken(payload())
    const decoded = decode(token)

    expect(decoded.sub).toBe('patient-user-id')
    expect(decoded.name).toBe('Test Patient')
    expect(decoded.video?.room).toBe('tawasul-booking-id')
    expect(decoded.video?.roomJoin).toBe(true)
    expect(decoded.video?.canPublish).toBe(false)
    expect(decoded.video?.canSubscribe).toBe(false)
  })

  it('issues a moderator token with publish/subscribe permission', async () => {
    const token = await generateLiveKitToken(payload({ role: 'moderator' }))
    const decoded = decode(token)

    expect(decoded.video?.canPublish).toBe(true)
    expect(decoded.video?.canSubscribe).toBe(true)
  })

  it('honors an explicit TTL bounded to the appointment window', async () => {
    const token = await generateLiveKitToken(payload({ ttlSeconds: 125 }))
    const decoded = decode(token)

    // LiveKit uses nbf as issuance; iat is not guaranteed.
    expect((decoded.exp ?? 0) - (decoded.nbf ?? 0)).toBe(125)
  })

  it('uses the existing 3600-second default when no TTL is provided', async () => {
    const token = await generateLiveKitToken(payload())
    const decoded = decode(token)

    // LiveKit uses nbf as issuance; iat is not guaranteed.
    expect((decoded.exp ?? 0) - (decoded.nbf ?? 0)).toBe(3600)
  })
})
