import type { Slot, CreateBookingResponse, BookingDetail, PublicDoctor } from './types'

function getApiMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return 'Something went wrong. Please try again.'
}

export function useBooking() {
  const step = useState<number>('booking-step', () => 1)
  const doctors = useState<PublicDoctor[]>('booking-doctors', () => [])
  const doctorsPage = useState<number>('booking-doctors-page', () => 1)
  const doctorsPageSize = useState<number>('booking-doctors-page-size', () => 12)
  const doctorsTotal = useState<number>('booking-doctors-total', () => 0)
  const doctorsTotalPages = useState<number>('booking-doctors-total-pages', () => 1)
  const doctorsRequestSeq = useState<number>('booking-doctors-request-seq', () => 0)
  const doctorsSearch = useState<string>('booking-doctors-search', () => '')
  const selectedDoctor = useState<PublicDoctor | null>('booking-selected-doctor', () => null)
  const sessionType = useState<'ONLINE' | 'IN_CLINIC'>('booking-session-type', () => 'ONLINE')
  const selectedDate = useState<string | null>('booking-selected-date', () => null)
  const selectedSlot = useState<Slot | null>('booking-selected-slot', () => null)
  const availableDates = useState<string[]>('booking-available-dates', () => [])
  const availableSlots = useState<Slot[]>('booking-available-slots', () => [])
  const bookingId = useState<string | null>('booking-id', () => null)
  const bookingAmount = useState<number>('booking-amount', () => 0)
  const bookingCurrency = useState<string>('booking-currency', () => 'EGP')
  const isLoading = useState<boolean>('booking-loading', () => false)
  const error = useState<string | null>('booking-error', () => null)

  function resetDependentSelections() {
    selectedDate.value = null
    selectedSlot.value = null
    availableDates.value = []
    availableSlots.value = []
    bookingId.value = null
    bookingAmount.value = 0
    bookingCurrency.value = 'EGP'
    step.value = 1
    error.value = null
  }

  function reset() {
    selectedDoctor.value = null
    resetDependentSelections()
  }

  async function fetchDoctors(page = 1) {
    const requestId = ++doctorsRequestSeq.value
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{
        items: PublicDoctor[]
        doctors?: PublicDoctor[]
        page: number
        pageSize: number
        total: number
        totalPages: number
      }>('/api/public/doctors', {
        query: { page, pageSize: 12, ...(doctorsSearch.value ? { search: doctorsSearch.value } : {}) },
      })
      if (requestId !== doctorsRequestSeq.value) return doctors.value
      doctors.value = data.items ?? data.doctors ?? []
      doctorsPage.value = data.page
      doctorsPageSize.value = data.pageSize
      doctorsTotal.value = data.total
      doctorsTotalPages.value = data.totalPages
      return doctors.value
    } catch (e) {
      if (requestId !== doctorsRequestSeq.value) return doctors.value
      error.value = getApiMessage(e)
      doctors.value = []
      return []
    } finally {
      if (requestId === doctorsRequestSeq.value) isLoading.value = false
    }
  }

  /**
   * Set the doctor search query and reset pagination to the first page so
   * patients never land on an empty later page of the filtered result set.
   */
  function setDoctorsSearch(query: string) {
    doctorsSearch.value = query.trim()
    doctorsPage.value = 1
    void fetchDoctors(1)
  }

  async function goToDoctorsPage(page: number) {
    const safePage = Math.min(Math.max(1, page), doctorsTotalPages.value)
    if (safePage === doctorsPage.value) return
    selectDoctor(null)
    await fetchDoctors(safePage)
  }

  function selectDoctor(doctor: PublicDoctor | null) {
    if (selectedDoctor.value?.id === doctor?.id) return
    selectedDoctor.value = doctor
    resetDependentSelections()
  }

  function setSessionType(type: 'ONLINE' | 'IN_CLINIC') {
    if (sessionType.value === type) return
    sessionType.value = type
  }

  async function fetchAvailableDates(month: number, year: number) {
    if (!selectedDoctor.value) {
      availableDates.value = []
      return []
    }
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{ dates: string[] }>('/api/booking/available-dates', {
        query: { month, year, doctorId: selectedDoctor.value.id },
      })
      availableDates.value = data.dates
      return data.dates
    } catch (e) {
      error.value = getApiMessage(e)
      availableDates.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAvailableSlots(date: string) {
    if (!selectedDoctor.value) {
      availableSlots.value = []
      return []
    }
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{ slots: Slot[] }>('/api/booking/available-slots', {
        query: { date, doctorId: selectedDoctor.value.id },
      })
      availableSlots.value = data.slots
      return data.slots
    } catch (e) {
      error.value = getApiMessage(e)
      availableSlots.value = []
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
    if (!selectedDoctor.value) {
      error.value = 'Please select a doctor'
      return
    }
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
          doctorId: selectedDoctor.value.id,
          date: selectedDate.value,
          startTime: selectedSlot.value.startTime,
          sessionType: sessionType.value,
        },
      })
      bookingId.value = created.bookingId
      bookingAmount.value = created.amount
      bookingCurrency.value = created.currency

      if (created.sessionType === 'IN_CLINIC') {
        await navigateTo(`/booking/success?bookingId=${encodeURIComponent(created.bookingId)}`)
        return
      }

      const payment = await $fetch<{ paymentUrl?: string; clientSecret?: string }>('/api/payment/initiate', {
        method: 'POST',
        body: { bookingId: created.bookingId },
      })

      if (payment.clientSecret) {
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
    doctors,
    doctorsPage,
    doctorsPageSize,
    doctorsTotal,
    doctorsTotalPages,
    doctorsSearch,
    selectedDoctor,
    sessionType,
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
    fetchDoctors,
    goToDoctorsPage,
    selectDoctor,
    setDoctorsSearch,
    setSessionType,
    fetchAvailableDates,
    fetchAvailableSlots,
    selectSlot,
    backToStep1,
    createAndPay,
    retryPayment,
    fetchBookingDetail,
  }
}
