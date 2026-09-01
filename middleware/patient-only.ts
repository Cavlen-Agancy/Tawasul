export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn, user } = useAuth()
  if (!isLoggedIn.value) {
    return navigateTo('/login', { redirectCode: 302 })
  }
  if (user.value?.accountType !== 'PATIENT') {
    return navigateTo(dashboardFor(user.value?.accountType), { redirectCode: 302 })
  }
})

function dashboardFor(accountType?: string): string {
  switch (accountType) {
    case 'DOCTOR':
      return '/doctor'
    case 'STAFF':
      return '/admin'
    default:
      return '/dashboard'
  }
}