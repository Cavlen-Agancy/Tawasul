<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1200px] flex-col items-center px-4 py-24 lg:px-12">
    <h1 class="text-center text-3xl font-semibold tracking-tight text-foreground">
      Tawasul Academy — Setup Complete
    </h1>
    <p class="mt-4 max-w-[480px] text-center text-base text-muted-foreground">
      The platform foundation is ready: Nuxt, Tailwind, shadcn-vue components, Prisma, and PostgreSQL.
    </p>

    <Button class="mt-8">
      Primary Color Test
    </Button>

    <Card class="mt-8 w-full max-w-sm">
      <CardHeader>
        <CardTitle>HeroUI-style card</CardTitle>
        <CardDescription>This card renders with the brand theme applied.</CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">
          A warm, calm foundation for a mental health platform.
        </p>
      </CardContent>
    </Card>
  </div>
</template>