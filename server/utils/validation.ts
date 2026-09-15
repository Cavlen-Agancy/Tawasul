import { z } from 'zod'

export const authRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email format').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(1, 'Password is required').max(128),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

export const availableDatesQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1000).max(9999),
})

export const availableSlotsQuerySchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format'),
})

export const createBookingSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format'),
  startTime: z.string().regex(timeRegex, 'Invalid time format'),
})

export const initiatePaymentSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
})

export const patientProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().max(30).optional().or(z.literal('')),
})

export const patientAppointmentsQuerySchema = z.object({
  tab: z.enum(['upcoming', 'past', 'all']).optional().default('upcoming'),
})

export const scheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, 'Invalid time format'),
  endTime: z.string().regex(timeRegex, 'Invalid time format'),
  sessionDuration: z.number().int().refine((n) => [30, 45, 60].includes(n), 'sessionDuration must be 30, 45, or 60'),
})

export const scheduleUpdateSchema = z.object({
  startTime: z.string().regex(timeRegex, 'Invalid time format').optional(),
  endTime: z.string().regex(timeRegex, 'Invalid time format').optional(),
  sessionDuration: z.number().int().refine((n) => [30, 45, 60].includes(n), 'sessionDuration must be 30, 45, or 60').optional(),
  isActive: z.boolean().optional(),
})

export const blockedDateSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format'),
  reason: z.string().max(255).optional().or(z.literal('')),
})

export const assignDoctorSchema = z.object({
  doctorId: z.string().min(1, 'Doctor ID is required'),
})

export const doctorProfilePatchSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().max(30).optional().or(z.literal('')),
  bio: z.string().max(2000).optional().or(z.literal('')),
  specializations: z.array(z.string().min(1).max(100)).max(20).optional(),
})

export const doctorBookingsQuerySchema = z.object({
  start: z.string().regex(dateRegex, 'Invalid date format'),
  end: z.string().regex(dateRegex, 'Invalid date format'),
})

export const adminDoctorCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email format').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  bio: z.string().max(2000).optional().or(z.literal('')),
  specializations: z.array(z.string().min(1).max(100)).max(20).optional(),
})

export const adminDoctorPatchSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z.string().max(30).optional().or(z.literal('')),
  bio: z.string().max(2000).optional().or(z.literal('')),
  specializations: z.array(z.string().min(1).max(100)).max(20).optional(),
  isActive: z.boolean().optional(),
})

export const availabilityReplaceSchema = z.object({
  availability: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, 'Invalid time format'),
    endTime: z.string().regex(timeRegex, 'Invalid time format'),
    sessionDuration: z.number().int().refine((n) => [30, 45, 60].includes(n), 'sessionDuration must be 30, 45, or 60'),
  })).max(7),
})

export const blockSlotSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format'),
  startTime: z.string().regex(timeRegex, 'Invalid time format'),
  endTime: z.string().regex(timeRegex, 'Invalid time format'),
})

const permissionItemSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1),
})

export const staffCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  phone: z.string().max(30).optional().or(z.literal('')),
  permissions: z.array(permissionItemSchema).max(24).optional(),
})

export const staffPatchSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z.string().max(30).optional().or(z.literal('')),
  permissions: z.array(permissionItemSchema).max(24).optional(),
  isActive: z.boolean().optional(),
})

export const settingsPatchSchema = z.object({
  platformName: z.string().max(100).optional(),
  contactEmail: z.string().max(255).optional().or(z.literal('')),
  contactPhone: z.string().max(30).optional().or(z.literal('')),
  whatsappNumber: z.string().max(30).optional().or(z.literal('')),
  paymentGateway: z.string().max(30).optional(),
  paymentGatewayKey: z.string().max(500).optional(),
  paymentGatewaySecret: z.string().max(500).optional(),
  sessionPricePerHour: z.number().min(0).max(1000000).optional(),
  defaultSessionDuration: z.number().int().refine((n) => [30, 45, 60].includes(n), 'defaultSessionDuration must be 30, 45, or 60').optional(),
  defaultWorkingStart: z.string().regex(timeRegex, 'Invalid time format').optional(),
  defaultWorkingEnd: z.string().regex(timeRegex, 'Invalid time format').optional(),
}).passthrough()

/**
 * Extracts a single human-readable message from a ZodError.
 * Falls back to the first issue message, then a generic message.
 */
export function validationMessage(error: z.ZodError): string {
  for (const issue of error.issues) {
    if (issue.code === 'too_small' && issue.path[0] === 'name') return 'Name must be at least 2 characters'
    if (issue.code === 'invalid_string' && issue.path[0] === 'email') return 'Invalid email format'
    if (issue.message.startsWith('Password')) return issue.message
    return issue.message
  }
  return 'Invalid request'
}

export function parseBody<T>(body: unknown, schema: z.ZodSchema<T>): T | null {
  const result = schema.safeParse(body)
  if (!result.success) return null
  return result.data
}