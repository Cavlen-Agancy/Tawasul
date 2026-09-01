<script setup lang="ts">
import { z } from 'zod'
import { getApiMessage } from '~/lib/api'

definePageMeta({ layout: 'default', middleware: 'guest' })

const { login, loading } = useAuth()

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

const email = ref('')
const password = ref('')
const error = ref('')
const formTouched = ref(false)

const isSubmitting = computed(() => loading.value)

function issueFor(field: string): string | undefined {
  if (!formTouched.value) return undefined
  const parsed = loginSchema.safeParse({ email: email.value, password: password.value })
  if (!parsed.success) {
    return parsed.error.issues.find((i) => i.path[0] === field)?.message
  }
  return undefined
}

async function onSubmit() {
  formTouched.value = true
  error.value = ''
  const parsed = loginSchema.safeParse({ email: email.value, password: password.value })
  if (!parsed.success) return

  try {
    await login(email.value, password.value)
  } catch (e) {
    error.value = getApiMessage(e)
  }
}
</script>

<template>
  <div class="flex w-full justify-center px-4 py-12 lg:py-20">
    <Card class="w-full max-w-[440px] p-6 sm:p-8">
      <CardHeader class="p-0 pb-6">
        <CardTitle class="text-2xl font-semibold tracking-tight">
          Welcome back
        </CardTitle>
        <CardDescription class="mt-2 text-sm">
          Log in to your Tawasul Academy account.
        </CardDescription>
      </CardHeader>

      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="flex flex-col gap-1.5">
          <label for="login-email" class="text-sm font-medium">Email</label>
          <Input
            id="login-email"
            v-model="email"
            data-testid="login-email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="ahmed@example.com"
            :error="Boolean(issueFor('email'))"
          >
          </Input>
          <p v-if="issueFor('email')" class="text-xs text-destructive">{{ issueFor('email') }}</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="login-password" class="text-sm font-medium">Password</label>
          <Input
            id="login-password"
            v-model="password"
            data-testid="login-password"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Your password"
            :error="Boolean(issueFor('password'))"
          >
          </Input>
          <p v-if="issueFor('password')" class="text-xs text-destructive">{{ issueFor('password') }}</p>
        </div>

        <div class="flex items-center justify-between">
          <NuxtLink to="/forgot-password" class="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </NuxtLink>
        </div>

        <p v-if="error" data-testid="login-error" class="text-sm text-destructive">{{ error }}</p>

        <Button type="submit" data-testid="login-submit" class="mt-2 w-full" :disabled="isSubmitting">
          {{ isSubmitting ? 'Logging in…' : 'Log in' }}
        </Button>
      </form>

      <CardFooter class="p-0 pt-6">
        <p class="text-center text-sm text-muted-foreground">
          Don't have an account?
          <NuxtLink to="/register" class="font-semibold text-primary hover:underline">
            Register
          </NuxtLink>
        </p>
      </CardFooter>
    </Card>
  </div>
</template>