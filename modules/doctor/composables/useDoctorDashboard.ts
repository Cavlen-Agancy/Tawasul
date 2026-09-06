export interface DoctorProfile {
  id: string
  name: string
  email: string
  phone: string | null
  photo: string | null
  bio: string | null
  slug: string
  specializations: string[]
  isActive: boolean
}

export interface DoctorBooking {
  id: string
  patientName: string
  patientPhoto: string | null
  date: string
  startTime: string
  endTime: string
  service: string
  status: string
}

export function useDoctorDashboard() {
  const profile = useState<DoctorProfile | null>('doctor-profile', () => null)
  const bookings = useState<DoctorBooking[]>('doctor-bookings', () => [])
  const isLoading = useState<boolean>('doctor-dashboard-loading', () => false)
  const error = useState<string | null>('doctor-dashboard-error', () => null)

  async function fetchProfile(): Promise<DoctorProfile | null> {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<DoctorProfile>('/api/doctor/profile')
      profile.value = data
      return data
    } catch (e) {
      error.value = (e as { data?: { message?: string } }).data?.message || 'Something went wrong'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function updateProfile(data: { name: string; phone?: string; bio?: string; specializations?: string[] }): Promise<DoctorProfile | null> {
    isLoading.value = true
    error.value = null
    try {
      const updated = await $fetch<DoctorProfile>('/api/doctor/profile', {
        method: 'PATCH',
        body: data,
      })
      profile.value = updated
      return updated
    } catch (e) {
      error.value = (e as { data?: { message?: string } }).data?.message || 'Something went wrong'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    isLoading.value = true
    error.value = null
    try {
      const form = new FormData()
      form.append('file', file)
      const data = await $fetch<{ photoUrl: string }>('/api/doctor/profile/photo', {
        method: 'POST',
        body: form,
      })
      if (profile.value) profile.value.photo = data.photoUrl
      return data.photoUrl
    } catch (e) {
      error.value = (e as { data?: { message?: string } }).data?.message || 'Something went wrong'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function fetchBookings(start: string, end: string): Promise<DoctorBooking[]> {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<{ bookings: DoctorBooking[] }>('/api/doctor/bookings', {
        query: { start, end },
      })
      bookings.value = data.bookings ?? []
      return bookings.value
    } catch (e) {
      error.value = (e as { data?: { message?: string } }).data?.message || 'Something went wrong'
      return []
    } finally {
      isLoading.value = false
    }
  }

  function clear() {
    profile.value = null
    bookings.value = []
    error.value = null
  }

  return {
    profile,
    bookings,
    isLoading,
    error,
    fetchProfile,
    updateProfile,
    uploadPhoto,
    fetchBookings,
    clear,
  }
}
