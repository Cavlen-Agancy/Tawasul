import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SESSION_JOIN_MODE,
  MEETING_OPEN_EARLY_MIN,
  canJoinSessionAt,
  joinWindowMessage,
  meetingWindowFor,
  normalizeSessionJoinMode,
} from '../../lib/session-join'
import { canJoinMeetingAt, meetingWindow } from '../../server/utils/meeting'

function bookingToday(start = '10:00', end = '11:00') {
  const d = new Date()
  return {
    date: new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())),
    startTime: start,
    endTime: end,
  }
}

describe('session join mode normalization', () => {
  it('defaults to PRODUCTION when the value is missing or invalid', () => {
    expect(DEFAULT_SESSION_JOIN_MODE).toBe('PRODUCTION')
    expect(normalizeSessionJoinMode(undefined)).toBe('PRODUCTION')
    expect(normalizeSessionJoinMode(null)).toBe('PRODUCTION')
    expect(normalizeSessionJoinMode('')).toBe('PRODUCTION')
    expect(normalizeSessionJoinMode('prod')).toBe('PRODUCTION')
    expect(normalizeSessionJoinMode(1)).toBe('PRODUCTION')
  })

  it('only accepts the explicit TEST value', () => {
    expect(normalizeSessionJoinMode('TEST')).toBe('TEST')
    expect(normalizeSessionJoinMode('PRODUCTION')).toBe('PRODUCTION')
  })
})

describe('PRODUCTION join window', () => {
  const booking = bookingToday()
  const { openAt, closeAt } = meetingWindowFor(booking)

  it('opens exactly MEETING_OPEN_EARLY_MIN minutes before start', () => {
    const startLocal = new Date(booking.date.getFullYear(), booking.date.getMonth(), booking.date.getDate(), 10, 0).getTime()
    expect(openAt).toBe(startLocal - MEETING_OPEN_EARLY_MIN * 60 * 1000)
    expect(canJoinSessionAt(booking, openAt, 'PRODUCTION')).toBe(true)
    expect(canJoinSessionAt(booking, openAt - 1000, 'PRODUCTION')).toBe(false)
  })

  it('closes at the exact appointment end with no grace', () => {
    expect(canJoinSessionAt(booking, closeAt - 1000, 'PRODUCTION')).toBe(true)
    expect(canJoinSessionAt(booking, closeAt, 'PRODUCTION')).toBe(false)
    expect(canJoinSessionAt(booking, closeAt + 60 * 1000, 'PRODUCTION')).toBe(false)
  })

  it('provides a clock-based reason for an unavailable join', () => {
    // The UI calls this only when canJoinSessionAt returned false.
    expect(joinWindowMessage(booking, closeAt)).toBe('Session has ended')
    expect(joinWindowMessage(booking, openAt - 1000)).toContain(String(MEETING_OPEN_EARLY_MIN))
  })
})

describe('TEST join mode', () => {
  const booking = bookingToday()
  const { openAt, closeAt } = meetingWindowFor(booking)

  it('bypasses only the clock check (before, during, after)', () => {
    expect(canJoinSessionAt(booking, openAt - 60 * 60 * 1000, 'TEST')).toBe(true)
    expect(canJoinSessionAt(booking, (openAt + closeAt) / 2, 'TEST')).toBe(true)
    expect(canJoinSessionAt(booking, closeAt + 60 * 60 * 1000, 'TEST')).toBe(true)
  })

  it('leaves the PRODUCTION-only message helper to the UI mode guard', () => {
    // joinWindowMessage is intentionally clock-based; the patient/doctor UI
    // skips it entirely while the effective mode is TEST.
    expect(joinWindowMessage(booking, closeAt + 1000)).toBe('Session has ended')
  })
})

describe('server/client window consistency', () => {
  it('server meetingWindow and client meetingWindowFor agree', () => {
    const booking = bookingToday()
    expect(meetingWindow(booking)).toEqual(meetingWindowFor(booking))
  })

  it('server canJoinMeetingAt default matches PRODUCTION canonical rule', () => {
    const booking = bookingToday()
    const { openAt, closeAt } = meetingWindow(booking)
    expect(canJoinMeetingAt(booking, openAt - 1)).toBe(canJoinSessionAt(booking, openAt - 1, 'PRODUCTION'))
    expect(canJoinMeetingAt(booking, closeAt)).toBe(canJoinSessionAt(booking, closeAt, 'PRODUCTION'))
  })
})
