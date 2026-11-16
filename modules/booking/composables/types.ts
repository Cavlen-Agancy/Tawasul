export interface PublicDoctor {
  id: string
  name: string
  photo: string | null
  slug: string
  bio: string | null
  specializations: string[]
}

export interface Slot {
  doctorId: string
  doctorName: string
  startTime: string
  endTime: string
  sessionDuration: number
  service: string
}

export interface BookingDetail {
  id: string
  patientName: string
  doctorId: string | null
  doctorName: string | null
  date: string
  startTime: string
  endTime: string
  service: string
  status: string
  paymentStatus: string
  amount: number
  currency: string
  sessionType?: 'ONLINE' | 'IN_CLINIC'
}

export interface CreateBookingResponse {
  bookingId: string
  doctorId: string
  amount: number
  currency: string
  sessionType: 'ONLINE' | 'IN_CLINIC'
}
