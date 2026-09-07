import { describe, expect, it } from 'vitest'
import { canJoinMeetingAt, meetingWindow, MEETING_OPEN_EARLY_MIN, MEETING_CLOSE_LATE_MIN } from '../../server/utils/meeting'

/**
 * Builds a "today at hh:mm" local Date for wall-clock expectations.
 * `booking.date` itself models a real Prisma `@db.Date` readback: UTC midnight
 * of the intended calendar day (NOT a local-midnight Date).
 */
function todayAt(hour: number, minute = 0): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0, 0)
}

function todayAsDbDate(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

describe('meetingWindow', () => {
  it('opens MEETING_OPEN_EARLY_MIN minutes before start and closes MEETING_CLOSE_LATE_MIN after end', () => {
    const booking = { date: todayAsDbDate(), startTime: '10:00', endTime: '11:00' }
    const expectedStart = todayAt(10).getTime()
    const expectedEnd = todayAt(11).getTime()

    const { openAt, closeAt } = meetingWindow(booking)
    expect(openAt).toBe(expectedStart - MEETING_OPEN_EARLY_MIN * 60 * 1000)
    expect(closeAt).toBe(expectedEnd + MEETING_CLOSE_LATE_MIN * 60 * 1000)
  })
})

describe('canJoinMeetingAt (5-minute join rule)', () => {
  it('is joinable at exactly start minus the early buffer', () => {
    const booking = { date: todayAsDbDate(), startTime: '10:00', endTime: '11:00' }
    const { openAt: open, closeAt } = meetingWindow(booking)
    expect(canJoinMeetingAt(booking, open)).toBe(true)
    expect(canJoinMeetingAt(booking, closeAt)).toBe(true)
  })

  it('is not joinable one minute before the window opens', () => {
    const booking = { date: todayAsDbDate(), startTime: '10:00', endTime: '11:00' }
    const { openAt } = meetingWindow(booking)
    expect(canJoinMeetingAt(booking, openAt - 60 * 1000)).toBe(false)
  })

  it('is not joinable one minute after the window closes', () => {
    const booking = { date: todayAsDbDate(), startTime: '10:00', endTime: '11:00' }
    const { closeAt } = meetingWindow(booking)
    expect(canJoinMeetingAt(booking, closeAt + 60 * 1000)).toBe(false)
  })

  it('is joinable strictly inside the window', () => {
    const booking = { date: todayAsDbDate(), startTime: '10:00', endTime: '11:00' }
    const { openAt } = meetingWindow(booking)
    expect(canJoinMeetingAt(booking, openAt + 5 * 60 * 1000)).toBe(true)
  })
})