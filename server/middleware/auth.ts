import { getCookie, deleteCookie, type H3Event } from 'h3'
import { verifyJWT } from '../utils/auth'

export default async function authMiddleware(event: H3Event) {
  const token = getCookie(event, 'auth_token')

  if (!token) {
    event.context.user = null
    return
  }

  try {
    event.context.user = verifyJWT(token)
  } catch {
    deleteCookie(event, 'auth_token')
    event.context.user = null
  }
}