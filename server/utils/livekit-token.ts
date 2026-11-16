import { AccessToken } from 'livekit-server-sdk'

interface LiveKitTokenPayload {
  userId: string
  userName: string
  roomName: string
  role: 'moderator' | 'member'
  /**
   * Optional token lifetime in seconds. Session routes pass the remaining
   * appointment window so a token cannot outlive the session.
   */
  ttlSeconds?: number
}

export async function generateLiveKitToken(payload: LiveKitTokenPayload): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not configured')
  }

  const ttl = payload.ttlSeconds && payload.ttlSeconds > 0
    ? Math.floor(payload.ttlSeconds)
    : 3600

  const token = new AccessToken(apiKey, apiSecret, {
    identity: payload.userId,
    name: payload.userName,
    ttl,
  })

  // Members (patients) never receive publish/subscribe permission from their
  // token. The assigned doctor must explicitly admit each LiveKit connection.
  // Moderators (doctors) receive publish/subscribe from their own token.
  token.addGrant({
    roomJoin: true,
    room: payload.roomName,
    canPublish: payload.role === 'moderator',
    canSubscribe: payload.role === 'moderator',
    roomAdmin: false,
  })

  return await token.toJwt()
}
