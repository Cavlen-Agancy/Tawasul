<script setup lang="ts">
import { z } from 'zod'
import { getApiMessage } from '~/lib/api'

definePageMeta({ layout: 'default', middleware: 'guest' })

const { fetchMe } = useAuth()

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const submitting = ref(false)

async function onSubmit() {
  error.value = ''
  const parsed = registerSchema.safeParse({
    name: name.value,
    email: email.value,
    password: password.value,
    confirmPassword: confirmPassword.value,
  })

  // Show error only on form submit as a single alert message
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message || 'Please check your inputs'
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        name: name.value,
        email: email.value,
        password: password.value,
      },
    })
    await fetchMe()
    await navigateTo('/dashboard')
  } catch (e) {
    error.value = getApiMessage(e)
  } finally {
    submitting.value = false
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
      class="relative flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-6 py-6"
      style="z-index: 2;"
    >
      <Card
        class="auth-card w-[90%] sm:w-full max-w-[450px] rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-[10px] m-auto"
        style="background-color: rgba(20, 20, 30, 0.85);"
      >
        <CardHeader class="p-0 pb-4 sm:pb-6">
          <CardTitle class="auth-title text-2xl font-semibold tracking-tight text-white">
            Create your account
          </CardTitle>
          <CardDescription class="auth-subtitle mt-1.5 sm:mt-2 text-sm text-white/70">
            Join Tawasul Academy and start your journey to wellbeing.
          </CardDescription>
        </CardHeader>

        <!-- Single alert banner for validation / submission error -->
        <div
          v-if="error"
          data-testid="register-error"
          role="alert"
          class="auth-error-banner mb-3 rounded-xl border border-red-500/30 bg-red-500/15 px-3.5 py-2 text-xs text-red-300 text-center"
        >
          {{ error }}
        </div>

        <form class="auth-form flex flex-col gap-3 sm:gap-4" @submit.prevent="onSubmit">
          <!-- Full Name -->
          <div class="auth-field flex flex-col gap-1">
            <label for="register-name" class="auth-label text-sm font-medium text-white/90">Full Name</label>
            <Input
              id="register-name"
              v-model="name"
              data-testid="register-name"
              name="name"
              autocomplete="name"
              placeholder="Ahmed Hassan"
              class="auth-input bg-black/30 border-white/15 text-white placeholder:text-white/40 focus:border-primary"
            >
            </Input>
          </div>

          <!-- Email -->
          <div class="auth-field flex flex-col gap-1">
            <label for="register-email" class="auth-label text-sm font-medium text-white/90">Email</label>
            <Input
              id="register-email"
              v-model="email"
              data-testid="register-email"
              type="email"
              name="email"
              autocomplete="email"
              placeholder="ahmed@example.com"
              class="auth-input bg-black/30 border-white/15 text-white placeholder:text-white/40 focus:border-primary"
            >
            </Input>
          </div>

          <!-- Password -->
          <div class="auth-field flex flex-col gap-1">
            <label for="register-password" class="auth-label text-sm font-medium text-white/90">Password</label>
            <Input
              id="register-password"
              v-model="password"
              data-testid="register-password"
              type="password"
              name="password"
              autocomplete="new-password"
              placeholder="At least 8 characters"
              class="auth-input bg-black/30 border-white/15 text-white placeholder:text-white/40 focus:border-primary"
            >
            </Input>
          </div>

          <!-- Confirm Password -->
          <div class="auth-field flex flex-col gap-1">
            <label for="register-confirm" class="auth-label text-sm font-medium text-white/90">Confirm Password</label>
            <Input
              id="register-confirm"
              v-model="confirmPassword"
              data-testid="register-confirm"
              type="password"
              name="confirmPassword"
              autocomplete="new-password"
              placeholder="Repeat your password"
              class="auth-input bg-black/30 border-white/15 text-white placeholder:text-white/40 focus:border-primary"
            >
            </Input>
          </div>

          <Button type="submit" data-testid="register-submit" class="auth-button mt-2 w-full shadow-magenta" :disabled="submitting">
            {{ submitting ? 'Creating account…' : 'Create account' }}
          </Button>
        </form>

        <CardFooter class="p-0 pt-4 sm:pt-6">
          <p class="text-center text-xs sm:text-sm text-white/70 w-full">
            Already have an account?
            <NuxtLink to="/login" class="font-semibold text-primary hover:underline">
              Log in
            </NuxtLink>
          </p>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>

<style scoped>
/* Mobile-only compact clean dark glassmorphism styling (max-width: 768px) */
@media (max-width: 768px) {
  .auth-card {
    background: rgba(15, 15, 25, 0.80) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 20px !important;
    padding: 1.25rem !important;
    margin: auto !important;
    width: 90% !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
  }

  .auth-title {
    font-size: 1.25rem !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    text-align: center !important;
  }

  .auth-subtitle {
    font-size: 0.78rem !important;
    color: rgba(255, 255, 255, 0.6) !important;
    text-align: center !important;
    margin-bottom: 0.75rem !important;
  }

  .auth-form {
    gap: 0.65rem !important;
    padding-top: 0 !important;
  }

  .auth-field {
    gap: 0 !important;
  }

  .auth-label {
    color: rgba(255, 255, 255, 0.8) !important;
    font-size: 0.8rem !important;
    margin-bottom: 0.2rem !important;
    display: block !important;
    text-align: right !important;
  }

  .auth-input,
  .auth-input :deep(input),
  :deep(.auth-input input) {
    background: rgba(255, 255, 255, 0.06) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    border-radius: 10px !important;
    padding: 0.6rem 0.9rem !important;
    color: #ffffff !important;
    font-size: 0.85rem !important;
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

  .auth-error-banner {
    font-size: 0.75rem !important;
    padding: 0.5rem 0.75rem !important;
    margin-bottom: 0.5rem !important;
  }

  .auth-button {
    background: linear-gradient(135deg, #e91e8c, #c2185b) !important;
    border-radius: 10px !important;
    padding: 0.75rem !important;
    font-size: 0.95rem !important;
    font-weight: 600 !important;
    width: 100% !important;
    color: #ffffff !important;
    margin-top: 0.35rem !important;
    box-shadow: 0 4px 15px rgba(233, 30, 140, 0.4) !important;
    border: none !important;
  }
}
</style>
