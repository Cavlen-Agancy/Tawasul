import type { AdminBooking, AdminDoctor, AdminSchedule, BlockedDate, PendingBooking } from './types'

function formatDateISO(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useAdminDashboard() {
  const schedules = ref<AdminSchedule[]>([])
  const blockedDates = ref<BlockedDate[]>([])
  const pendingBookings = ref<PendingBooking[]>([])
  const activeDoctors = ref<AdminDoctor[]>([])
  const bookings = ref<AdminBooking[]>([])

  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeSchedules = computed(() => schedules.value.filter((s) => s.isActive))
  const upcomingBlockedDates = computed(() =>
    blockedDates.value
      .filter((b) => b.date >= new Date().toISOString().slice(0, 10))
      .sort((a, b) => a.date.localeCompare(b.date)),
  )

  function extractMessage(e: unknown): string {
    return (e as { data?: { message?: string } }).data?.message || 'Something went wrong'
  }

  async function unwrap<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      error.value = null
      return await fn()
    } catch (e) {
      error.value = extractMessage(e)
      return null
    }
  }

  async function fetchAll() {
    loading.value = true
    await Promise.all([
      fetchSchedules(),
      fetchBlockedDates(),
      fetchPendingBookings(),
      fetchActiveDoctors(),
      fetchBookings(),
    ])
    loading.value = false
  }

  async function fetchSchedules() {
    const data = await unwrap(() => $fetch<{ schedules: AdminSchedule[] }>('/api/admin/schedule'))
    if (data) schedules.value = data.schedules
  }

  async function addSchedule(input: Omit<AdminSchedule, 'id'>): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ schedule: AdminSchedule }>('/api/admin/schedule', { method: 'POST', body: input }),
    )
    if (data?.schedule) {
      schedules.value = [...schedules.value, data.schedule]
      return true
    }
    return false
  }

  async function updateSchedule(id: string, input: Partial<AdminSchedule>): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ schedule: AdminSchedule }>(`/api/admin/schedule/${id}`, { method: 'PATCH', body: input }),
    )
    if (data?.schedule) {
      schedules.value = schedules.value.map((s) => (s.id === id ? { ...s, ...data.schedule } : s))
      return true
    }
    return false
  }

  async function deleteSchedule(id: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ ok: true }>(`/api/admin/schedule/${id}`, { method: 'DELETE' }),
    )
    if (data?.ok) {
      schedules.value = schedules.value.filter((s) => s.id !== id)
      return true
    }
    return false
  }

  async function fetchBlockedDates() {
    const data = await unwrap(() => $fetch<{ blockedDates: Array<{ id: string; date: Date | string; reason: string | null }> }>('/api/admin/blocked-dates'))
    if (data) {
      blockedDates.value = data.blockedDates.map((b) => ({
        id: b.id,
        date: formatDateISO(b.date),
        reason: b.reason,
      }))
    }
  }

  async function blockDate(input: { date: string; reason?: string | null }): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ blockedDate: { id: string; date: Date | string; reason: string | null } }>('/api/admin/blocked-dates', {
        method: 'POST',
        body: input,
      }),
    )
    if (data?.blockedDate) {
      blockedDates.value = [
        ...blockedDates.value,
        {
          id: data.blockedDate.id,
          date: formatDateISO(data.blockedDate.date),
          reason: data.blockedDate.reason,
        },
      ]
      return true
    }
    return false
  }

  async function unblockDate(id: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ ok: true }>(`/api/admin/blocked-dates/${id}`, { method: 'DELETE' }),
    )
    if (data?.ok) {
      blockedDates.value = blockedDates.value.filter((b) => b.id !== id)
      return true
    }
    return false
  }

  async function fetchPendingBookings() {
    const data = await unwrap(() =>
      $fetch<{ bookings: PendingBooking[] }>('/api/admin/bookings/pending'),
    )
    if (data) pendingBookings.value = data.bookings ?? []
  }

  async function fetchBookings() {
    const data = await unwrap(() => $fetch<{ bookings: AdminBooking[] }>('/api/admin/bookings'))
    if (data) bookings.value = data.bookings ?? []
  }

  async function updateBookingStatus(id: string, status: 'CONFIRMED' | 'CANCELLED'): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ booking: AdminBooking }>(`/api/admin/bookings/${id}/status`, {
        method: 'PATCH',
        body: { status },
      }),
    )
    if (data?.booking) {
      bookings.value = bookings.value.map((b) => (b.id === id ? { ...b, ...data.booking } : b))
      pendingBookings.value = pendingBookings.value.filter((b) => b.id !== id)
      return true
    }
    return false
  }

  async function assignDoctor(bookingId: string, doctorId: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ booking: { id: string; doctorId: string | null; status: string } }>(
        `/api/admin/bookings/${bookingId}/assign`,
        { method: 'PATCH', body: { doctorId } },
      ),
    )
    if (data?.booking) {
      pendingBookings.value = pendingBookings.value.filter((b) => b.id !== bookingId)
      bookings.value = bookings.value.map((b) =>
        b.id === bookingId ? { ...b, doctorId: data.booking.doctorId, status: data.booking.status } : b,
      )
      return true
    }
    return false
  }

  async function fetchActiveDoctors() {
    const data = await unwrap(() => $fetch<{ doctors: AdminDoctor[] }>('/api/admin/doctors?active=true'))
    if (data) activeDoctors.value = data.doctors ?? []
  }

  return {
    schedules,
    activeSchedules,
    blockedDates,
    upcomingBlockedDates,
    pendingBookings,
    activeDoctors,
    bookings,
    loading,
    error,
    fetchAll,
    fetchSchedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    fetchBlockedDates,
    blockDate,
    unblockDate,
    fetchPendingBookings,
    fetchBookings,
    updateBookingStatus,
    assignDoctor,
    fetchActiveDoctors,
  }
}