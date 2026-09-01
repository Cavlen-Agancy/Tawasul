<script setup lang="ts">
import { z } from 'zod'
import { getApiMessage } from '~/lib/api'

definePageMeta({ layout: 'default', middleware: 'guest' })

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

const email = ref('')
const error = ref('')
const sent = ref(false)
const submitting = ref(false)

async function onSubmit() {
  error.value = ''
  const parsed = forgotSchema.safeParse({ email: email.value })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message || 'Please enter a valid email address'
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value },
    })
    sent.value = true
  } catch (e) {
    if (!sent.value) error.value = getApiMessage(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex w-full justify-center px-4 py-12 lg:py-20">
    <Card class="w-full max-w-[440px] p-6 sm:p-8">
      <CardHeader class="p-0 pb-6">
        <CardTitle class="text-2xl font-semibold tracking-tight">
          Forgot your password?
        </CardTitle>
        <CardDescription class="mt-2 text-sm">
          Enter your email and we'll send you a link to reset your password.
        </CardDescription>
      </CardHeader>

      <form v-if="!sent" class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="flex flex-col gap-1.5">
          <label for="forgot-email" class="text-sm font-medium">Email</label>
          <Input
            id="forgot-email"
            v-model="email"
            data-testid="forgot-email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="ahmed@example.com"
            :error="Boolean(error)"
          >
          </Input>
          <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
        </div>

        <Button type="submit" data-testid="forgot-submit" class="mt-2 w-full" :disabled="submitting">
          {{ submitting ? 'Sending…' : 'Send reset link' }}
        </Button>
      </form>

      <CardContent v-else class="p-0">
        <p data-testid="forgot-success" class="text-base font-medium text-success">
          ✓ If this email exists, a reset link has been sent.
        </p>
        <p class="mt-2 text-sm text-muted-foreground">
          The link expires in 1 hour.
        </p>
      </CardContent>

      <CardFooter class="p-0 pt-6">
        <NuxtLink to="/login" class="text-sm font-semibold text-primary hover:underline">
          Back to login
        </NuxtLink>
      </CardFooter>
    </Card>
  </div>
</template>