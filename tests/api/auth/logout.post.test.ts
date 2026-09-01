import { describe, expect, it } from 'vitest'
import handler from '~/modules/auth/server/api/auth/logout.post'
import { createApiEvent, getSetCookie } from '../helpers'

describe('POST /api/auth/logout', () => {
  it('clears the auth_token cookie when authenticated', async () => {
    const event = createApiEvent({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { auth_token: 'some-valid-or-invalid-jwt' },
    })

    const res = await handler(event) as { message: string }
    expect(res.message).toBe('Logged out successfully')

    const raw = getSetCookie(event).find((c) => c.startsWith('auth_token='))
    expect(raw).toBeTruthy()
    expect(raw).toContain('Max-Age=0')
  })

  it('still returns 200 when unauthenticated', async () => {
    const event = createApiEvent({ method: 'POST', url: '/api/auth/logout' })
    const res = await handler(event) as { message: string }
    expect(res.message).toBe('Logged out successfully')
  })
})