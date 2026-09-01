<script setup lang="ts">
import { getApiMessage } from '~/lib/api'

definePageMeta({ layout: 'default' })

const route = useRoute()

const message = ref('')
const status = ref<'loading' | 'success' | 'error'>('loading')

onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string' || !token) {
    status.value = 'error'
    message.value = 'Invalid or expired link'
    return
  }

  try {
    const res = await $fetch<{ message: string }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
    status.value = 'success'
    message.value = res.message
  } catch (e) {
    status.value = 'error'
    message.value = getApiMessage(e, 'Invalid or expired link')
  }
})
</script>

<template>
  <div class="flex w-full justify-center px-4 py-12 lg:py-20">
    <Card class="w-full max-w-[440px] p-6 sm:p-8">
      <CardHeader class="p-0 pb-6">
        <CardTitle class="text-2xl font-semibold tracking-tight">
          Email verification
        </CardTitle>
      </CardHeader>
      <CardContent class="p-0">
        <div v-if="status === 'loading'" class="flex items-center gap-3 text-sm text-muted-foreground">
          <span class="inline-block size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Verifying your email…
        </div>
        <div v-else-if="status === 'success'" class="flex flex-col gap-2">
          <p data-testid="verify-success" class="text-base font-medium text-success">✓ {{ message }}</p>
        </div>
        <div v-else class="flex flex-col gap-2">
          <p data-testid="verify-error" class="text-base font-medium text-destructive">{{ message }}</p>
          <p class="text-sm text-muted-foreground">
            Try logging in or request a new registration if the link has expired.
          </p>
        </div>
      </CardContent>
      <CardFooter class="p-0 pt-6">
        <NuxtLink to="/login" class="text-sm font-semibold text-primary hover:underline">
          Go to login
        </NuxtLink>
      </CardFooter>
    </Card>
  </div>
</template>