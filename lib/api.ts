export function getApiMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as { data?: { message?: string }; message?: string }
    if (err.data?.message) return err.data.message
    if (err.message && !err.message.includes('fetch failed')) return err.message
  }
  return fallback
}