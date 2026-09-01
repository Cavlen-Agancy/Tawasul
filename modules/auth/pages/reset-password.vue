<script setup lang="ts">
import { z } from 'zod'
import { getApiMessage } from '~/lib/api'

definePageMeta({ layout: 'default' })

const route = useRoute()

const resetSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)

function issueFor(field: string): string | undefined {
  const parsed = resetSchema.safeParse({ newPassword: newPassword.value, confirmPassword: confirmPassword.value })
  if (!parsed.success) {
    return parsed.error.issues.find((i) => i.path[0] === field)?.message
  }
  return undefined
}

async function onSubmit() {
  error.value = ''
  const parsed = resetSchema.safeParse({ newPassword: newPassword.value, confirmPassword: confirmPassword.value })
  if (!parsed.success) return

  const token = route.query.token
  if (typeof token !== 'string' || !token) {
    error.value = 'Invalid or expired link'
    return
  }

  submitting.value = true
  try {
    const res = await $fetch<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword: newPassword.value },
    })
    success.value = res.message
    setTimeout(() => navigateTo('/login'), 2000)
  } catch (e) {
    error.value = getApiMessage(e)
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
          Set a new password
        </CardTitle>
        <CardDescription class="mt-2 text-sm">
          Choose a strong password you haven't used before.
        </CardDescription>
      </CardHeader>

      <form v-if="!success" class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="flex flex-col gap-1.5">
          <label for="reset-password" class="text-sm font-medium">New Password</label>
          <Input
            id="reset-password"
            v-model="newPassword"
            data-testid="reset-password"
            type="password"
            name="newPassword"
            autocomplete="new-password"
            placeholder="At least 8 characters"
            :error="Boolean(issueFor('newPassword'))"
          >
          </Input>
          <p v-if="issueFor('newPassword')" class="text-xs text-destructive">{{ issueFor('newPassword') }}</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="reset-confirm" class="text-sm font-medium">Confirm New Password</label>
          <Input
            id="reset-confirm"
            v-model="confirmPassword"
            data-testid="reset-confirm"
            type="password"
            name="confirmPassword"
            autocomplete="new-password"
            placeholder="Repeat your new password"
            :error="Boolean(issueFor('confirmPassword'))"
          >
          </Input>
          <p v-if="issueFor('confirmPassword')" class="text-xs text-destructive">{{ issueFor('confirmPassword') }}</p>
        </div>

        <p v-if="error" data-testid="reset-error" class="text-sm text-destructive">{{ error }}</p>

        <Button type="submit" data-testid="reset-submit" class="mt-2 w-full" :disabled="submitting">
          {{ submitting ? 'Updating…' : 'Update password' }}
        </Button>
      </form>

      <CardContent v-else data-testid="reset-success" class="p-0">
        <p class="text-base font-medium text-success">✓ {{ success }}</p>
        <p class="mt-2 text-sm text-muted-foreground">Redirecting you to login…</p>
      </CardContent>
    </Card>
  </div>
</template>