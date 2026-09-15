import { AccessToken } from 'livekit-server-sdk'
import dotenv from 'dotenv'
dotenv.config()

const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
  identity: 'test',
  name: 'test',
  ttl: 3600,
})

token.addGrant({
  roomJoin: true,
  room: 'test',
  canPublish: false,
  canSubscribe: false,
})

token.toJwt().then(jwt => console.log('Token created successfully'))
