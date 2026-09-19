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
  <!-- Full viewport wrapper with fixed cover background image -->
  <div
    class="fixed inset-0 h-[100dvh] w-full overflow-y-auto"
    style="background-image: url('/cover.jpeg'); background-size: cover; background-position: center; background-attachment: fixed; z-index: 0;"
  >
    <!-- Dark overlay (z-index: 1, rgba 0,0,0,0.5) -->
    <div
      class="fixed inset-0 bg-black/50 pointer-events-none"
      style="z-index: 1;"
      aria-hidden="true"
    />

    <!-- Form container: takes full 100dvh, scrolls vertically if needed, centers card -->
    <div
      class="relative flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-6 py-10"
      style="z-index: 2;"
    >
      <Card
        class="auth-card w-[90%] sm:w-full max-w-[450px] rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-[10px] m-auto"
        style="background-color: rgba(20, 20, 30, 0.85);"
      >
        <CardHeader class="p-0 pb-6">
          <CardTitle class="auth-title text-2xl font-semibold tracking-tight text-white">
            Welcome back
          </CardTitle>
          <CardDescription class="auth-subtitle mt-2 text-sm text-white/70">
            Log in to your Tawasul Academy account.
          </CardDescription>
        </CardHeader>

        <form class="auth-form flex flex-col gap-4" @submit.prevent="onSubmit">
          <div class="auth-field flex flex-col gap-1.5">
            <label for="login-email" class="auth-label text-sm font-medium text-white/90">Email</label>
            <Input
              id="login-email"
              v-model="email"
              data-testid="login-email"
              type="email"
              name="email"
              autocomplete="email"
              placeholder="ahmed@example.com"
              :error="Boolean(issueFor('email'))"
              class="auth-input bg-black/30 border-white/15 text-white placeholder:text-white/40 focus:border-primary"
            >
            </Input>
            <p v-if="issueFor('email')" class="auth-error text-xs text-destructive">{{ issueFor('email') }}</p>
          </div>

          <div class="auth-field flex flex-col gap-1.5">
            <label for="login-password" class="auth-label text-sm font-medium text-white/90">Password</label>
            <Input
              id="login-password"
              v-model="password"
              data-testid="login-password"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="Your password"
              :error="Boolean(issueFor('password'))"
              class="auth-input bg-black/30 border-white/15 text-white placeholder:text-white/40 focus:border-primary"
            >
            </Input>
            <p v-if="issueFor('password')" class="auth-error text-xs text-destructive">{{ issueFor('password') }}</p>
          </div>

          <div class="flex items-center justify-between">
            <NuxtLink to="/forgot-password" class="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </NuxtLink>
          </div>

          <p v-if="error" data-testid="login-error" class="auth-error text-sm text-destructive">{{ error }}</p>

          <Button type="submit" data-testid="login-submit" class="auth-button mt-2 w-full shadow-magenta" :disabled="isSubmitting">
            {{ isSubmitting ? 'Logging in…' : 'Log in' }}
          </Button>
        </form>

        <CardFooter class="p-0 pt-6">
          <p class="text-center text-sm text-white/70 w-full">
            Don't have an account?
            <NuxtLink to="/register" class="font-semibold text-primary hover:underline">
              Register
            </NuxtLink>
          </p>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>

<style scoped>
/* Mobile-only clean dark glassmorphism styling (max-width: 768px) */
@media (max-width: 768px) {
  .auth-card {
    background: rgba(15, 15, 25, 0.80) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 24px !important;
    padding: 2rem 1.5rem !important;
    margin: auto !important;
    width: 90% !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
  }

  .auth-title {
    font-size: 1.5rem !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    text-align: center !important;
  }

  .auth-subtitle {
    font-size: 0.85rem !important;
    color: rgba(255, 255, 255, 0.6) !important;
    text-align: center !important;
    margin-bottom: 1.5rem !important;
  }

  .auth-form {
    gap: 1rem !important;
    padding-top: 0 !important;
  }

  .auth-field {
    gap: 0 !important;
  }

  .auth-label {
    color: rgba(255, 255, 255, 0.8) !important;
    font-size: 0.85rem !important;
    margin-bottom: 0.25rem !important;
    display: block !important;
    text-align: right !important;
  }

  .auth-input,
  .auth-input :deep(input),
  :deep(.auth-input input) {
    background: rgba(255, 255, 255, 0.06) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    border-radius: 12px !important;
    padding: 0.75rem 1rem !important;
    color: #ffffff !important;
    font-size: 0.9rem !important;
    width: 100% !important;
  }

  .auth-input:focus,
  .auth-input:focus-within,
  .auth-input :deep(input:focus),
  :deep(.auth-input input:focus) {
    border-color: #e91e8c !important;
    outline: none !important;
    box-shadow: 0 0 0 1px #e91e8c !important;
  }

  .auth-error {
    color: #ff6b6b !important;
    font-size: 0.75rem !important;
    margin-top: 0.25rem !important;
  }

  .auth-button {
    background: linear-gradient(135deg, #e91e8c, #c2185b) !important;
    border-radius: 12px !important;
    padding: 0.85rem !important;
    font-size: 1rem !important;
    font-weight: 600 !important;
    width: 100% !important;
    color: #ffffff !important;
    margin-top: 0.5rem !important;
    box-shadow: 0 4px 15px rgba(233, 30, 140, 0.4) !important;
    border: none !important;
  }
}
</style>
