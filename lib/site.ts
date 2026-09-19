// Tawasul Academy — isolated site configuration.
// Real values come from /api/public/settings (DB singleton).
// Fallbacks below are intentionally neutral placeholders — do not
// treat them as production contact data. Replace via admin settings.

export const siteConfig = {
  brand: {
    nameAr: 'أكاديمية تواصل',
    nameEn: 'Tawasul Academy',
    sloganAr: 'نتواصل · نفهم · نساند',
    logoSrc: '/logo.png',
  },
  contact: {
    // Filled from DB at runtime; fallbacks are empty on purpose.
    emailFallback: '',
    phoneFallback: '',
    whatsappFallback: '',
    addressAr: 'القاهرة، مصر — يُحدَّد عنوان المقر عند الحجز الحضوري',
    workingHoursAr: 'السبت – الخميس · 10 صباحًا – 10 مساءً · الجمعة إجازة',
    mapsUrl: 'https://maps.google.com/?q=Cairo+Egypt',
  },
  booking: {
    basePath: '/book',
    onlinePath: '/book?mode=online',
    inPersonPath: '/book?mode=in-person',
  },
  auth: {
    loginPath: '/login',
    registerPath: '/register',
  },
} as const

export function buildWhatsappUrl(raw: string, text = ''): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (!digits) return ''
  const suffix = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${digits}${suffix}`
}

export function toTelHref(raw: string): string {
  if (!raw) return ''
  const cleaned = raw.replace(/[\s()-]/g, '')
  return `tel:${cleaned}`
}
