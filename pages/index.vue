<script setup lang="ts">
definePageMeta({ layout: 'default' })

useHead({
  title: 'أكاديمية تواصل — نتواصل نفهم نساند',
  meta: [
    {
      name: 'description',
      content: 'أكاديمية تواصل — استشارات نفسية وتربوية وأسرية وتخاطب، أونلاين وحضوريًا بسرية تامة.',
    },
    { property: 'og:title', content: 'أكاديمية تواصل — نتواصل نفهم نساند' },
    {
      property: 'og:description',
      content: 'مساحتك الآمنة للدعم النفسي والتربوي والأسري — احجز أونلاين أو حضوريًا.',
    },
    { property: 'og:locale', content: 'ar_EG' },
  ],
  htmlAttrs: { dir: 'rtl', lang: 'ar' },
})
</script>

<template>
  <div dir="rtl" lang="ar">
    <HomeHero />
    <HomeServices />
    <HomeAbout />
    <HomeTraining />
    <HomeBookingChannels />
    <HomeFaq />
    <HomeContact />
  </div>
</template>
