<template>
  <section id="contact" aria-label="موقع الأكاديمية على الخريطة" class="w-full m-0 p-0 leading-none">
    <iframe
      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3453.5!2d31.2357!3d30.0444!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAyJzM5LjgiTiAzMcKwMTQnMDguNiJF!5e0!3m2!1sar!2seg!4v1234567890"
      class="contact-map-iframe block w-full border-0 m-0 p-0"
      style="border: none; display: block;"
      allowfullscreen=""
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      title="موقع أكاديمية تواصل على الخريطة"
    />
  </section>
</template>

<style scoped>
.contact-map-iframe {
  width: 100%;
  height: 500px;
}

@media (max-width: 768px) {
  .contact-map-iframe {
    height: 300px !important;
  }
}
</style>
