export type AuthAccountType = 'PATIENT' | 'DOCTOR' | 'STAFF'

export interface AuthUser {
  id: string
  name: string
  email: string
  phone?: string
  photo?: string
  accountType: AuthAccountType
  permissions?: { resource: string; action: string }[]
}

export interface AuthPermission {
  resource: string
  action: string
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const loading = useState<boolean>('auth-loading', () => false)

  const isLoggedIn = computed(() => user.value !== null)
  const isPatient = computed(() => user.value?.accountType === 'PATIENT')
  const isDoctor = computed(() => user.value?.accountType === 'DOCTOR')
  const isStaff = computed(() => user.value?.accountType === 'STAFF')

  function dashboardFor(accountType?: AuthAccountType): string {
    switch (accountType) {
      case 'DOCTOR':
        return '/doctor'
      case 'STAFF':
        return '/admin'
      default:
        return '/dashboard'
    }
  }

  async function fetchMe(): Promise<AuthUser | null> {
    loading.value = true
    try {
      // On the server, forwarding the incoming request's cookies is required so
      // the httpOnly auth_token is sent to /api/me; otherwise SSR would treat an
      // already-authenticated user as logged out. On the client this is the same
      // as global $fetch.
      const _fetch = import.meta.server ? useRequestFetch() : $fetch
      const me = await _fetch<AuthUser>('/api/auth/me')
      user.value = me
      return me
    } catch {
      user.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string): Promise<AuthUser> {
    loading.value = true
    try {
      const loggedIn = await $fetch<AuthUser>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      user.value = loggedIn
      await navigateTo(dashboardFor(loggedIn.accountType))
      return loggedIn
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    loading.value = true
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Clear state even if the server call fails
    } finally {
      user.value = null
      loading.value = false
      await navigateTo('/login')
    }
  }

  function hasPermission(resource: string, action: string): boolean {
    if (!user.value || user.value.accountType !== 'STAFF') return false
    return (user.value.permissions ?? []).some((p) => p.resource === resource && p.action === action)
  }

  return {
    user,
    loading,
    isLoggedIn,
    isPatient,
    isDoctor,
    isStaff,
    fetchMe,
    login,
    logout,
    hasPermission,
  }
}