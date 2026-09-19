<script setup lang="ts">
import { MapPin, Phone, Mail, ArrowLeft } from 'lucide-vue-next'
import { siteConfig } from '~/lib/site'

const { email, phone, whatsappUrl, phoneHref } = useSiteSettings()

// Fallback display values matching Image 1 when settings are empty
const displayPhone = computed(() => phone.value || '+20 100 808 0080')
const displayEmail = computed(() => email.value || 'info@tawasul-academy.com')
</script>

<template>
  <section id="contact" aria-labelledby="contact-title" class="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-2xl text-center">
      <p class="text-xs font-bold uppercase tracking-wider text-primary">نحن هنا لمساعدتك</p>
      <h2 id="contact-title" class="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
        تواصل معنا وسنسعد بالرد على جميع استفساراتك
      </h2>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        فريق خدمة العملاء والاستقبال متاح للرد على استفساراتك وتقديم المشورة حول اختيار الخدمة المناسبة وحجز المواعيد.
      </p>
    </div>

    <!-- Contact & Map Grid matching Image 1 -->
    <div class="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
      <!-- Right Column: Contact info list (in RTL) -->
      <div class="flex flex-col justify-between gap-6">
        <div class="flex flex-col gap-5">
          <!-- Item 1: Address -->
          <div class="flex items-start gap-4">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card text-primary shadow-soft" aria-hidden="true">
              <MapPin class="size-5" />
            </span>
            <div>
              <p class="text-sm font-bold text-foreground">المقر الرئيسي:</p>
              <p class="mt-1 text-xs sm:text-sm text-muted-foreground">
                جمهورية مصر العربية — القاهرة
              </p>
            </div>
          </div>

          <!-- Item 2: Phone & WhatsApp -->
          <div class="flex items-start gap-4">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card text-primary shadow-soft" aria-hidden="true">
              <Phone class="size-5" />
            </span>
            <div>
              <p class="text-sm font-bold text-foreground">الهاتف والواتساب الموحد:</p>
              <a
                :href="phoneHref || (whatsappUrl || '#')"
                dir="ltr"
                class="tnum mt-1 inline-block text-xs sm:text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                {{ displayPhone }}
              </a>
            </div>
          </div>

          <!-- Item 3: Email -->
          <div class="flex items-start gap-4">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card text-primary shadow-soft" aria-hidden="true">
              <Mail class="size-5" />
            </span>
            <div>
              <p class="text-sm font-bold text-foreground">البريد الإلكتروني:</p>
              <a
                :href="`mailto:${displayEmail}`"
                dir="ltr"
                class="tnum mt-1 inline-block text-xs sm:text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                {{ displayEmail }}
              </a>
            </div>
          </div>
        </div>

        <!-- Bottom Note -->
        <p class="text-xs leading-6 text-muted-foreground/80">
          <span class="font-bold text-foreground">تنبيه حجز:</span>
          الزيارات للمقر تتطلب حجزًا مسبقًا لضمان راحتك واستقبالك دون انتظار.
        </p>
      </div>

      <!-- Left Column: Location Card matching Image 1 -->
      <div class="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-7 sm:p-9 shadow-soft backdrop-blur-md">
        <!-- Subtle grid background -->
        <div
          class="pointer-events-none absolute inset-0 opacity-[0.2] dark:opacity-10"
          style="background-image: radial-gradient(hsl(var(--primary) / 0.4) 1px, transparent 1px); background-size: 20px 20px;"
          aria-hidden="true"
        />

        <div class="relative flex flex-col justify-between h-full gap-6">
          <div>
            <span class="inline-block rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold text-primary">
              موقع الأكاديمية
            </span>
            <h3 class="mt-3 text-xl font-bold text-foreground sm:text-2xl">
              مرحباً بكم في مقر تواصل
            </h3>
            <p class="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground">
              مقر هادئ ومصمم بعناية ليضمن راحتكم وسرية جلستكم، مع توفير أماكن انتظار صامتة ومواقف سيارات قريبة.
            </p>
          </div>

          <!-- Schedule pill box -->
          <div class="rounded-2xl border border-border/70 bg-muted/40 p-3.5 text-center text-xs font-semibold text-foreground/90">
            أوقات العمل: السبت - الخميس (١٠ ص حتى ١٠ م)
          </div>

          <!-- Google Maps Button -->
          <Button
            as="a"
            :href="siteConfig.contact.mapsUrl"
            target="_blank"
            rel="noopener"
            class="w-full rounded-full bg-primary py-6 font-bold text-xs sm:text-sm text-white shadow-magenta hover:bg-primary/90 flex items-center justify-center gap-2"
          >
            <span>التوجيهات عبر خرائط Google</span>
            <ArrowLeft class="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>
