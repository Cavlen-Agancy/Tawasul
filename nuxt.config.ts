// Tawasul Academy — Nuxt Configuration

import { readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

interface ModulePage {
  name: string
  path: string
  file: string
}

function registerModulePages(pages: ModulePage[], dir: string, moduleName: string, prefix = ''): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue
      registerModulePages(pages, resolve(dir, entry.name), moduleName, `${prefix}${entry.name}/`)
      continue
    }
    if (!entry.name.endsWith('.vue')) continue
    const base = entry.name.replace(/\.vue$/, '')
    if (base.startsWith('_')) continue
    const routePath = `/${prefix}${base}`.replace(/\[(\w+)\]/g, ':$1')
    pages.push({
      name: `${moduleName}-${prefix.replace(/\//g, '-')}${base}`,
      path: routePath,
      file: resolve(dir, entry.name),
    })
  }
}

export default defineNuxtConfig({

  // ─────────────────────────────────────────
  // General
  // ─────────────────────────────────────────
  devtools: { enabled: process.env.NODE_ENV === 'development' },
  ssr: true,

  // ─────────────────────────────────────────
  // TypeScript
  // ─────────────────────────────────────────
  typescript: {
    strict: true,
    typeCheck: false, // enable after initial setup to avoid slowing down dev
  },

  // ─────────────────────────────────────────
  // Runtime Config
  // All server-only secrets go under "private"
  // Anything the frontend needs goes under the root
  // ─────────────────────────────────────────
  runtimeConfig: {
    // Server-only (never exposed to the browser)
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
    resendFromName: process.env.RESEND_FROM_NAME || 'Tawasul Academy',
    databaseUrl: process.env.DATABASE_URL,
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '2097152'),
    paymentGateway: process.env.PAYMENT_GATEWAY || 'paymob',
    paymobApiKey: process.env.PAYMOB_API_KEY,
    paymobIntegrationId: process.env.PAYMOB_INTEGRATION_ID,
    paymobHmacSecret: process.env.PAYMOB_HMAC_SECRET,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    seedAdminEmail: process.env.SEED_ADMIN_EMAIL,
    seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
    seedAdminName: process.env.SEED_ADMIN_NAME,

    // Public (safe to expose to the browser)
    public: {
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      liveKitUrl: process.env.LIVEKIT_URL || 'ws://localhost:7880',
      enableSessionTestMode: process.env.NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE === 'true',
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    },
  },

  // ─────────────────────────────────────────
  // Modules
  // ─────────────────────────────────────────
  // UI library: shadcn-vue components in ./components/ui, auto-imported via shadcn-nuxt.
  // NOTE: original plan referenced @heroui/nuxt which does not exist for Vue — see phase-0/notes.md
  // NOTE: 'shadcn-vue/nuxt' does not exist in shadcn-vue v2 (CLI-only package);
  // the official Nuxt module is the separate 'shadcn-nuxt' package.
  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    '@nuxt/image',
    'shadcn-nuxt',
  ],
  shadcn: {
    prefix: '',
    componentDir: './components/ui',
  },

  // ─────────────────────────────────────────
  // Tailwind CSS
  // @nuxtjs/tailwindcss defaults are used:
  // cssPath = ~/assets/css/tailwind.css, configPath = tailwind.config.ts
  // ─────────────────────────────────────────

  // ─────────────────────────────────────────
  // Pages & Routing
  // Module-based page directories registered here
  // ─────────────────────────────────────────
  hooks: {
    'pages:extend'(pages) {
      // Register pages kept inside module directories (modules/*/pages/)
      // Each module page file maps to a flat URL from its filename.
      for (const moduleName of readdirSync(resolve(process.cwd(), 'modules'))) {
        const pagesDir = resolve(process.cwd(), 'modules', moduleName, 'pages')
        if (!existsSync(pagesDir)) continue
        registerModulePages(pages, pagesDir, moduleName)
      }
    },
  },

  dir: {
    pages: 'pages',
  },

  // Register module page dirs as additional page sources
  // Each module exposes its pages through the global pages dir via symlink or re-export
  // Alternatively, use Nuxt Layers for full module isolation

  // ─────────────────────────────────────────
  // Server (Nitro)
  // Module server directories are registered by each module's index.ts
  // via addServerScanDir (see modules/*/index.ts).
  // ─────────────────────────────────────────

  // ─────────────────────────────────────────
  // Components
  // Auto-import components from module component dirs
  // ─────────────────────────────────────────
  components: [
    { path: '~/components', pathPrefix: false },
    { path: '~/modules/auth/components', pathPrefix: false },
    { path: '~/modules/booking/components', pathPrefix: false },
    { path: '~/modules/payment/components', pathPrefix: false },
    { path: '~/modules/patient/components', pathPrefix: false },
    { path: '~/modules/doctor/components', pathPrefix: false },
    { path: '~/modules/admin/components', pathPrefix: false },
    { path: '~/modules/session/components', pathPrefix: false },
  ],

  // ─────────────────────────────────────────
  // Composables
  // Auto-import composables from module composable dirs
  // ─────────────────────────────────────────
  imports: {
    dirs: [
      'composables',
      'modules/auth/composables',
      'modules/booking/composables',
      'modules/payment/composables',
      'modules/patient/composables',
      'modules/doctor/composables',
      'modules/admin/composables',
      'modules/session/composables',
    ],
  },

  // ─────────────────────────────────────────
  // CSS
  // ─────────────────────────────────────────
  css: [
    '~/assets/css/main.css',
  ],

  // ─────────────────────────────────────────
  // Image
  // ─────────────────────────────────────────
  image: {
    dir: 'public',
    quality: 80,
    format: ['webp', 'jpg'],
  },

  // ─────────────────────────────────────────
  // App Head
  // ─────────────────────────────────────────
  app: {
    head: {
      title: 'Tawasul Academy',
      titleTemplate: '%s | Tawasul Academy',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Online mental health counseling platform' },
        { name: 'theme-color', content: '#E91E8C' },
      ],
      script: [
        {
          innerHTML: `(function(){try{var m=localStorage.getItem('tawasul-color-mode')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
        },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
        },
      ],
    },
  },

  // ─────────────────────────────────────────
  // Compatibility
  // ─────────────────────────────────────────
  compatibilityDate: '2024-11-01',
})
