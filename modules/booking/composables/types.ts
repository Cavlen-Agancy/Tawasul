export interface Slot {
  startTime: string
  endTime: string
  sessionDuration: number
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
}

export interface CreateBookingResponse {
  bookingId: string
  amount: number
  currency: string
}
