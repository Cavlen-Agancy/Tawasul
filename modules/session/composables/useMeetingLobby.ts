export interface MeetingLobbyResponse {
  meetingId: string
  role: 'patient' | 'doctor' | 'staff'
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  canJoin: boolean
  patientName: string
  doctorName: string
  date: string
  startTime: string
  endTime: string
  service: string
  jitsiDomain?: string
  roomName?: string
}

/**
 * Reusable Meeting Lobby composable. Any role (patient, doctor, staff) can use
 * it against the shared /api/meeting/lobby/:id endpoint. It exposes the meeting
 * state plus a `fetch` that maps server errors into a friendly status so pages
 * can render loading / waiting / ready / error uniformly.
 */
export function useMeetingLobby() {
  const meeting = useState<MeetingLobbyResponse | null>('meeting-lobby', () => null)
  const status = useState<'loading' | 'ready' | 'error'>('meeting-lobby-status', () => 'loading')
  const message = useState<string>('meeting-lobby-message', () => '')

  async function fetchMeeting(meetingId: string): Promise<MeetingLobbyResponse | null> {
    status.value = 'loading'
    message.value = ''
    try {
      const data = await $fetch<MeetingLobbyResponse>(`/api/meeting/lobby/${meetingId}`)
      meeting.value = data
      status.value = 'ready'
      return data
    } catch (e) {
      const err = e as { status?: number; data?: { message?: string }; message?: string }
      // Protocol/joiner-role errors (404/403/409) mean the page stays on the lobby.
      meeting.value = null
      message.value = err?.data?.message || err?.message || 'Could not load this meeting.'
      status.value = 'error'
      return null
    }
  }

  function clear() {
    meeting.value = null
    status.value = 'loading'
    message.value = ''
  }

  return { meeting, status, message, fetchMeeting, clear }
}