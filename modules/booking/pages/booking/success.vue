<script setup lang="ts">
import { CheckCircle2 } from 'lucide-vue-next'

definePageMeta({ layout: 'patient-layout' })

const { fetchBookingDetail } = useBooking()

const route = useRoute()
const booking = ref<Awaited<ReturnType<typeof fetchBookingDetail>> | null>(null)
const notFound = ref(false)
const loading = ref(true)

async function load() {
  loading.value = true
  const id = route.query.bookingId
  if (typeof id !== 'string' || !id) {
    notFound.value = true
    loading.value = false
    return
  }
  booking.value = await fetchBookingDetail(id)
  if (!booking.value) notFound.value = true
  loading.value = false
}

onMounted(load)

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<template>
  <div class="flex w-full justify-center px-4 py-12 lg:py-20">
    <div class="w-full max-w-[520px]">
      <div v-if="loading" class="text-center text-sm text-muted-foreground">
        Loading your booking…
      </div>

      <Card v-else-if="booking" class="w-full p-6 sm:p-8">
        <CardHeader class="items-center p-0 pb-6 text-center">
          <CheckCircle2 class="h-14 w-14 text-primary" />
          <CardTitle class="text-2xl font-semibold tracking-tight">
            Booking Confirmed
          </CardTitle>
          <CardDescription class="mt-2 text-sm">
            Your session has been confirmed. Details are below.
          </CardDescription>
        </CardHeader>
        <CardContent class="p-0">
          <dl class="divide-y divide-border rounded-2xl border border-border">
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Doctor</dt>
              <dd class="text-sm font-medium text-foreground">{{ booking.doctorName }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Date</dt>
              <dd class="text-sm font-medium text-foreground">{{ formatDateLabel(booking.date) }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Time</dt>
              <dd class="text-sm font-medium text-foreground">{{ booking.startTime }} – {{ booking.endTime }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Service</dt>
              <dd class="text-sm font-medium text-foreground">{{ booking.service }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Price</dt>
              <dd class="text-sm font-medium text-foreground">
                {{ booking.amount.toLocaleString() }} {{ booking.currency }}
              </dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter class="flex flex-col gap-3 p-0 pt-6">
          <Button class="w-full" as="a" href="/dashboard">
            Go to My Appointments
          </Button>
        </CardFooter>
      </Card>

      <Card v-else class="w-full p-6 sm:p-8">
        <CardHeader class="p-0 pb-6">
          <CardTitle class="text-xl font-semibold tracking-tight">
            Booking details not found
          </CardTitle>
          <CardDescription class="mt-2 text-sm">
            We couldn't find a booking for this link.
          </CardDescription>
        </CardHeader>
        <CardFooter class="p-0">
          <Button class="w-full" as="a" href="/book">
            Book a Session
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
