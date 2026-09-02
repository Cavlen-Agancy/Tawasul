export default defineNuxtPlugin(async () => {
  // Restore auth state from the httpOnly cookie on every page load.
  // Runs on both the server (for SSR so protected routes see the session before
  // route middleware executes) and the client (for hydration + SPA navigation).
  // On the server, useRequestFetch() forwards the incoming auth_token cookie to
  // /api/auth/me so an already-authenticated user is not treated as logged out.
  const { fetchMe } = useAuth()
  await fetchMe()
})