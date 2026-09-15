import { AccessToken } from 'livekit-server-sdk'

interface LiveKitTokenPayload {
  userId: string
  userName: string
  roomName: string
  role: 'moderator' | 'member'
}

export async function generateLiveKitToken(payload: LiveKitTokenPayload): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not configured')
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: payload.userId,
    name: payload.userName,
    ttl: 3600,
  })

  token.addGrant({
    roomJoin: true,
    room: payload.roomName,
    canPublish: payload.role === 'moderator',
    canSubscribe: payload.role === 'moderator',
    roomAdmin: false,
  })

  return await token.toJwt()
}