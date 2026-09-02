import type { Slot, CreateBookingResponse, BookingDetail } from './types'

function getApiMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return 'Something went wrong. Please try again.'
}

export function useBooking() {
  const step = useState<number>('booking-step', () => 1)
  const selectedDate = useState<string | null>('booking-selected-date', () => null)
  const selectedSlot = useState<Slot | null>('booking-selected-slot', () => null)
  const availableDates = useState<string[]>('booking-available-dates', () => [])
  const availableSlots = useState<Slot[]>('booking-available-slots', () => [])
  const bookingId = useState<string | null>('booking-id', () => null)
  const bookingAmount = useState<number>('booking-amount', () => 0)
  const bookingCurrency = useState<string>('booking-currency', () => 'EGP')
  const isLoading = useState<boolean>('booking-loading', () => false)
  const error = useState<string | null>('booking-error', () => null)

  function reset() {
    step.value = 1
    selectedDate.value = null
    selectedSlot.value = null
    availableSlots.value = []
    bookingId.value = null
    bookingAmount.value = 0
    bookingCurrency.value = 'EGP'
    error.value = null
  }

  async function fetchAvailableDates(month: number, year: number) {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{ dates: string[] }>('/api/booking/available-dates', {
        query: { month, year },
      })
      availableDates.value = data.dates
      return data.dates
    } catch (e) {
      error.value = getApiMessage(e)
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAvailableSlots(date: string) {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{ slots: Slot[] }>('/api/booking/available-slots', {
        query: { date },
      })
      availableSlots.value = data.slots
      return data.slots
    } catch (e) {
      error.value = getApiMessage(e)
      return []
    } finally {
      isLoading.value = false
    }
  }

  function selectSlot(date: string, slot: Slot) {
    selectedDate.value = date
    selectedSlot.value = slot
    step.value = 2
  }

  function backToStep1() {
    step.value = 1
    error.value = null
  }

  async function createAndPay(): Promise<void> {
    if (!selectedDate.value || !selectedSlot.value) {
      error.value = 'Please select a time slot'
      return
    }
    isLoading.value = true
    error.value = null
    step.value = 3

    try {
      const created = await $fetch<CreateBookingResponse>('/api/booking/create', {
        method: 'POST',
        body: {
          date: selectedDate.value,
          startTime: selectedSlot.value.startTime,
          doctorId: selectedSlot.value.doctorId,
        },
      })
      bookingId.value = created.bookingId
      bookingAmount.value = created.amount
      bookingCurrency.value = created.currency

      const payment = await $fetch<{ paymentUrl?: string; clientSecret?: string }>('/api/payment/initiate', {
        method: 'POST',
        body: { bookingId: created.bookingId },
      })

      if (payment.clientSecret) {
        // Stripe Checkout — no direct URL in MVP; fall back to app URL handling in page
        error.value = 'Stripe Checkout is not configured on this deployment. Your booking will remain pending.'
        return
      }

      if (payment.paymentUrl) {
        window.location.href = payment.paymentUrl
      }
    } catch (e) {
      error.value = getApiMessage(e)
    } finally {
      isLoading.value = false
    }
  }

  async function retryPayment(): Promise<boolean> {
    if (!bookingId.value) return false
    isLoading.value = true
    error.value = null
    try {
      const payment = await $fetch<{ paymentUrl?: string; clientSecret?: string }>('/api/payment/initiate', {
        method: 'POST',
        body: { bookingId: bookingId.value },
      })
      if (payment.paymentUrl) {
        window.location.href = payment.paymentUrl
        return true
      }
      return false
    } catch (e) {
      error.value = getApiMessage(e)
      return false
    } finally {
      isLoading.value = false
    }
  }

  function fetchBookingDetail(id: string): Promise<BookingDetail | null> {
    return $fetch<BookingDetail>(`/api/booking/${id}`).catch(() => null)
  }

  return {
    step,
    selectedDate,
    selectedSlot,
    availableDates,
    availableSlots,
    bookingId,
    bookingAmount,
    bookingCurrency,
    isLoading,
    error,
    reset,
    fetchAvailableDates,
    fetchAvailableSlots,
    selectSlot,
    backToStep1,
    createAndPay,
    retryPayment,
    fetchBookingDetail,
  }
}
