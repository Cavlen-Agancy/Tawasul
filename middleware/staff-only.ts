export default defineNuxtRouteMiddleware(async (to) => {
  const { isLoggedIn, user, fetchMe, hasPermission } = useAuth()
  if (!isLoggedIn.value || (user.value?.accountType === 'STAFF' && !user.value?.permissions)) {
    await fetchMe()
  }
  if (!isLoggedIn.value) {
    return navigateTo('/login', { redirectCode: 302 })
  }
  if (user.value?.accountType !== 'STAFF') {
    return navigateTo(dashboardFor(user.value?.accountType), { redirectCode: 302 })
  }

  // Determine required resource from page meta or path
  const metaPerm = to.meta.permission as { resource: string; action?: string } | undefined
  let resource = metaPerm?.resource
  const action = metaPerm?.action || 'READ'

  if (!resource) {
    if (to.path.startsWith('/admin/doctors')) resource = 'DOCTORS'
    else if (to.path.startsWith('/admin/patients')) resource = 'PATIENTS'
    else if (to.path.startsWith('/admin/appointments')) resource = 'APPOINTMENTS'
    else if (to.path.startsWith('/admin/payments')) resource = 'PAYMENTS'
    else if (to.path.startsWith('/admin/staff')) resource = 'STAFF'
    else if (to.path.startsWith('/admin/settings')) resource = 'SETTINGS'
  }

  if (resource && !hasPermission(resource, action)) {
    return navigateTo('/admin', { redirectCode: 302 })
  }
})

function dashboardFor(accountType?: string): string {
  switch (accountType) {
    case 'PATIENT':
      return '/dashboard'
    case 'DOCTOR':
      return '/doctor'
    default:
      return '/login'
  }
}