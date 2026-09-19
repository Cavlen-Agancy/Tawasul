import { siteConfig, buildWhatsappUrl, toTelHref } from '~/lib/site'

interface PublicSettings {
  contactEmail?: string | null
  contactPhone?: string | null
  whatsappNumber?: string | null
}

/**
 * Real project contact data source: /api/public/settings (DB singleton).
 * Falls back to neutral isolated config so the home page never crashes
 * when settings are missing. No fabricated production data.
 */
export function useSiteSettings() {
  const { data } = useFetch<PublicSettings>('/api/public/settings', {
    key: 'public-settings',
    // Cache for the session; cheap endpoint.
    getCachedData(key, nuxtApp) {
      return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
    },
  })

  const email = computed(() => data.value?.contactEmail || siteConfig.contact.emailFallback)
  const phone = computed(() => data.value?.contactPhone || siteConfig.contact.phoneFallback)
  const whatsappRaw = computed(() => data.value?.whatsappNumber || siteConfig.contact.whatsappFallback)

  const whatsappUrl = computed(() =>
    buildWhatsappUrl(whatsappRaw.value, 'مرحبًا، أرغب في الاستفسار عن جلسات أكاديمية تواصل'),
  )
  const phoneHref = computed(() => toTelHref(phone.value))

  return { email, phone, whatsappRaw, whatsappUrl, phoneHref, raw: data }
}
