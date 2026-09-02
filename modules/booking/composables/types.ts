export interface Slot {
  doctorId: string
  doctorName: string
  startTime: string
  endTime: string
  service: string
}

export interface BookingDetail {
  id: string
  patientName: string
  doctorName: string
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
