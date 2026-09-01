export default defineNuxtPlugin(async () => {
  // Restore auth state from the httpOnly cookie on every page load.
  // Runs on the client only — the user must already have a valid auth_token cookie.
  if (import.meta.client) {
    const { fetchMe } = useAuth()
    await fetchMe()
  }
})