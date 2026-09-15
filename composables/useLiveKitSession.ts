import { ref, shallowRef, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalParticipant,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalTracks,
  ParticipantEvent,
  type TrackPublication,
} from 'livekit-client'

export interface RemoteParticipantTrack {
  sid: string
  track: RemoteTrack
  participantIdentity: string
  participantName: string
  isMuted: boolean
}

export interface WaitingParticipant {
  identity: string
  name: string
}

export interface SessionInfo {
  doctorName?: string
  patientName?: string
  date?: string | Date
  startTime?: string
  endTime?: string
  service?: string
}

export interface UseLiveKitSessionOptions {
  serverUrl: string
  token: Ref<string | undefined> | ComputedRef<string | undefined>
  isModerator?: boolean
  onDisconnected?: () => void
}

export function getArabicMediaErrorMessage(err: unknown, deviceType: 'camera' | 'microphone'): string {
  const name = err instanceof Error ? err.name : String(err)
  const message = (err instanceof Error ? err.message : '').toLowerCase()

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || message.includes('denied') || message.includes('permission')) {
    return deviceType === 'camera'
      ? 'لم نتمكن من تشغيل الكاميرا. تأكد من السماح للمتصفح باستخدام الكاميرا من إعدادات الموقع.'
      : 'لم نتمكن من تشغيل الميكروفون. تأكد من السماح للمتصفح باستخدام الميكروفون من إعدادات الموقع.'
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || message.includes('not found')) {
    return deviceType === 'camera'
      ? 'لم يتم العثور على كاميرا متصلة بجهازك.'
      : 'لم يتم العثور على ميكروفون متصل بجهازك.'
  }

  if (name === 'NotReadableError' || name === 'TrackStartError' || message.includes('in use') || message.includes('busy')) {
    return deviceType === 'camera'
      ? 'تعذر تشغيل الكاميرا. تأكد من أن الكاميرا ليست مستخدمة بواسطة تطبيق آخر.'
      : 'تعذر تشغيل الميكروفون. تأكد من أن الميكروفون ليس مستخدمًا بواسطة تطبيق آخر.'
  }

  if (name === 'OverconstrainedError') {
    return deviceType === 'camera'
      ? 'دقة الكاميرا المطلوبة غير مدعومة بجهازك.'
      : 'إعدادات الميكروفون المطلوبة غير مدعومة بجهازك.'
  }

  return deviceType === 'camera'
    ? 'تعذر تفعيل الكاميرا. يرجى إعادة المحاولة.'
    : 'تعذر تفعيل الميكروفون. يرجى إعادة المحاولة.'
}

export function useLiveKitSession(options: UseLiveKitSessionOptions) {
  const isModerator = !!options.isModerator
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    stopLocalTrackOnUnpublish: false, // Never auto-stop media streams on unpublish
  })

  const connectionState = ref<ConnectionState>(ConnectionState.Disconnected)
  const isWaiting = ref(!isModerator)
  const isDoctorPresent = ref(false)
  const isPatientPresent = ref(false)
  const waitingList = ref<WaitingParticipant[]>([])

  // Single source of truth for media controls
  const isMicEnabled = ref(false)
  const isCamEnabled = ref(false)
  const isSpeakerMuted = ref(false)

  // In-flight mutex protection
  const isTogglingMic = ref(false)
  const isTogglingCam = ref(false)
  const isConnecting = ref(false)

  // Feedback & errors
  const mediaError = ref<string>('')
  const connectionError = ref<string>('')

  // Local tracks
  const localVideoTrack = shallowRef<LocalVideoTrack | null>(null)
  const localAudioTrack = shallowRef<LocalAudioTrack | null>(null)

  // Remote tracks
  const remoteVideoTracks = ref<RemoteParticipantTrack[]>([])
  const remoteAudioTracks = ref<RemoteParticipantTrack[]>([])

  let permCheckTimer: ReturnType<typeof setInterval> | null = null

  function syncMediaStateFromLiveKit() {
    if (!isWaiting.value && (room.state === ConnectionState.Connected || room.state === ConnectionState.Reconnecting)) {
      isCamEnabled.value = room.localParticipant.isCameraEnabled
      isMicEnabled.value = room.localParticipant.isMicrophoneEnabled
    }
  }

  function checkParticipantsPresence() {
    if (isModerator) {
      // Doctor checks if any patient with canPublish is present
      let present = false
      room.remoteParticipants.forEach((p) => {
        if (p.permissions?.canPublish) {
          present = true
        }
      })
      isPatientPresent.value = present
    } else {
      // Patient checks if doctor is present
      isDoctorPresent.value = room.remoteParticipants.size > 0
    }
  }

  // Set up room event listeners
  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    connectionState.value = state
    if (state === ConnectionState.Connected) {
      connectionError.value = ''
    }
  })

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Video) {
      const idx = remoteVideoTracks.value.findIndex((t) => t.sid === track.sid)
      const entry: RemoteParticipantTrack = {
        sid: track.sid || Math.random().toString(),
        track,
        participantIdentity: participant.identity,
        participantName: participant.name || (isModerator ? 'المريض' : 'الطبيب'),
        isMuted: publication.isMuted,
      }
      if (idx !== -1) {
        remoteVideoTracks.value[idx] = entry
      } else {
        remoteVideoTracks.value.push(entry)
      }
      if (isModerator) isPatientPresent.value = true
      else isDoctorPresent.value = true
    } else if (track.kind === Track.Kind.Audio) {
      const idx = remoteAudioTracks.value.findIndex((t) => t.sid === track.sid)
      const entry: RemoteParticipantTrack = {
        sid: track.sid || Math.random().toString(),
        track,
        participantIdentity: participant.identity,
        participantName: participant.name || (isModerator ? 'المريض' : 'الطبيب'),
        isMuted: publication.isMuted,
      }
      if (idx !== -1) {
        remoteAudioTracks.value[idx] = entry
      } else {
        remoteAudioTracks.value.push(entry)
      }
    }
  })

  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
    track.detach()
    if (track.kind === Track.Kind.Video) {
      remoteVideoTracks.value = remoteVideoTracks.value.filter((t) => t.sid !== track.sid)
    } else if (track.kind === Track.Kind.Audio) {
      remoteAudioTracks.value = remoteAudioTracks.value.filter((t) => t.sid !== track.sid)
    }
  })

  room.on(RoomEvent.TrackMuted, (publication: TrackPublication, participant: RemoteParticipant | LocalParticipant) => {
    if (participant === room.localParticipant) {
      syncMediaStateFromLiveKit()
      return
    }
    if (publication.kind === Track.Kind.Video) {
      const item = remoteVideoTracks.value.find((t) => t.sid === publication.trackSid)
      if (item) item.isMuted = true
    } else if (publication.kind === Track.Kind.Audio) {
      const item = remoteAudioTracks.value.find((t) => t.sid === publication.trackSid)
      if (item) item.isMuted = true
    }
  })

  room.on(RoomEvent.TrackUnmuted, (publication: TrackPublication, participant: RemoteParticipant | LocalParticipant) => {
    if (participant === room.localParticipant) {
      syncMediaStateFromLiveKit()
      return
    }
    if (publication.kind === Track.Kind.Video) {
      const item = remoteVideoTracks.value.find((t) => t.sid === publication.trackSid)
      if (item) item.isMuted = false
    } else if (publication.kind === Track.Kind.Audio) {
      const item = remoteAudioTracks.value.find((t) => t.sid === publication.trackSid)
      if (item) item.isMuted = false
    }
  })

  room.on(RoomEvent.LocalTrackPublished, () => {
    syncMediaStateFromLiveKit()
    const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera)
    if (camPub?.videoTrack) {
      localVideoTrack.value = camPub.videoTrack as LocalVideoTrack
    }
    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone)
    if (micPub?.audioTrack) {
      localAudioTrack.value = micPub.audioTrack as LocalAudioTrack
    }
  })

  room.on(RoomEvent.LocalTrackUnpublished, () => {
    syncMediaStateFromLiveKit()
  })

  room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
    if (isModerator) {
      if (!participant.permissions?.canPublish) {
        if (!waitingList.value.some((p) => p.identity === participant.identity)) {
          waitingList.value.push({ identity: participant.identity, name: participant.name || 'المريض' })
        }
      } else {
        isPatientPresent.value = true
      }
    } else {
      isDoctorPresent.value = true
    }
    checkParticipantsPresence()
  })

  room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
    if (isModerator) {
      waitingList.value = waitingList.value.filter((p) => p.identity !== participant.identity)
    }
    checkParticipantsPresence()
  })

  room.on(RoomEvent.ParticipantPermissionsChanged, (_prev: unknown, participant: RemoteParticipant | LocalParticipant) => {
    if (participant === room.localParticipant) {
      if (room.localParticipant.permissions?.canPublish && isWaiting.value) {
        handlePatientAdmitted()
      }
    } else if (isModerator && participant) {
      const rp = participant as RemoteParticipant
      if (rp.permissions?.canPublish) {
        waitingList.value = waitingList.value.filter((p) => p.identity !== rp.identity)
        isPatientPresent.value = true
      } else {
        checkParticipantsPresence()
      }
    }
  })

  room.on(RoomEvent.Disconnected, () => {
    connectionState.value = ConnectionState.Disconnected
    if (options.onDisconnected) {
      options.onDisconnected()
    }
  })

  // Patient admission transition handler
  async function handlePatientAdmitted() {
    if (!isWaiting.value) return
    isWaiting.value = false
    if (permCheckTimer) {
      clearInterval(permCheckTimer)
      permCheckTimer = null
    }

    try {
      // Publish local preview tracks to the room
      if (localVideoTrack.value) {
        await room.localParticipant.publishTrack(localVideoTrack.value)
        if (!isCamEnabled.value) {
          await room.localParticipant.setCameraEnabled(false)
        }
      } else if (isCamEnabled.value) {
        await room.localParticipant.setCameraEnabled(true)
      }

      if (localAudioTrack.value) {
        await room.localParticipant.publishTrack(localAudioTrack.value)
        if (!isMicEnabled.value) {
          await room.localParticipant.setMicrophoneEnabled(false)
        }
      } else if (isMicEnabled.value) {
        await room.localParticipant.setMicrophoneEnabled(true)
      }

      syncMediaStateFromLiveKit()
    } catch (err) {
      console.error('[LiveKit] Failed to publish admitted tracks:', err)
    }
  }

  // Pre-session local tracks acquisition (e.g. for Waiting Room preview)
  async function initLocalPreview(preferredCam = true, preferredMic = true): Promise<boolean> {
    mediaError.value = ''
    try {
      const tracks = await createLocalTracks({
        audio: true,
        video: true,
      })
      for (const track of tracks) {
        if (track.kind === Track.Kind.Video) {
          localVideoTrack.value = track as LocalVideoTrack
          if (!preferredCam) {
            await (track as LocalVideoTrack).mute()
          }
        } else if (track.kind === Track.Kind.Audio) {
          localAudioTrack.value = track as LocalAudioTrack
          if (!preferredMic) {
            await (track as LocalAudioTrack).mute()
          }
        }
      }
      isCamEnabled.value = preferredCam
      isMicEnabled.value = preferredMic
      return true
    } catch (err) {
      console.error('[LiveKit] Failed to access camera or microphone:', err)
      mediaError.value = getArabicMediaErrorMessage(err, 'camera')
      return false
    }
  }

  // Connect to LiveKit room
  async function connectRoom() {
    const tokenVal = options.token.value
    if (!tokenVal || isConnecting.value) return

    isConnecting.value = true
    connectionError.value = ''

    try {
      await room.connect(options.serverUrl, tokenVal)
      connectionState.value = room.state

      if (isModerator) {
        isWaiting.value = false
        // Doctor enables cam and mic directly
        await room.localParticipant.setCameraEnabled(true)
        await room.localParticipant.setMicrophoneEnabled(true)
        syncMediaStateFromLiveKit()

        // Populate initial waiting list if any participants are already waiting
        room.remoteParticipants.forEach((participant) => {
          if (!participant.permissions?.canPublish) {
            if (!waitingList.value.some((p) => p.identity === participant.identity)) {
              waitingList.value.push({ identity: participant.identity, name: participant.name || 'المريض' })
            }
          } else {
            isPatientPresent.value = true
          }
        })
      } else {
        // Patient checks initial permissions
        if (room.localParticipant.permissions?.canPublish) {
          await handlePatientAdmitted()
        } else {
          isWaiting.value = true
          // Fallback interval check for admission
          permCheckTimer = setInterval(() => {
            if (room.localParticipant.permissions?.canPublish && isWaiting.value) {
              handlePatientAdmitted()
            }
          }, 600)
        }
      }
      checkParticipantsPresence()
    } catch (err: unknown) {
      console.error('[LiveKit] Room connect failed:', err)
      connectionError.value = 'تعذر الاتصال بخادم الجلسة. يرجى التحقق من اتصال الإنترنت.'
    } finally {
      isConnecting.value = false
    }
  }

  // Toggle Microphone
  async function toggleMicrophone() {
    if (isTogglingMic.value) return
    isTogglingMic.value = true
    mediaError.value = ''

    try {
      const target = !isMicEnabled.value
      if (isWaiting.value) {
        // In waiting room: control local track directly
        if (localAudioTrack.value) {
          if (target) {
            await localAudioTrack.value.unmute()
          } else {
            await localAudioTrack.value.mute()
          }
          isMicEnabled.value = target
        } else if (target) {
          const tracks = await createLocalTracks({ audio: true, video: false })
          localAudioTrack.value = tracks[0] as LocalAudioTrack
          isMicEnabled.value = true
        }
      } else {
        // In active session: call LiveKit
        await room.localParticipant.setMicrophoneEnabled(target)
        syncMediaStateFromLiveKit()
      }
    } catch (err) {
      console.error('[LiveKit][Microphone] toggle failed:', err)
      mediaError.value = getArabicMediaErrorMessage(err, 'microphone')
      if (!isWaiting.value) {
        syncMediaStateFromLiveKit()
      }
    } finally {
      isTogglingMic.value = false
    }
  }

  // Toggle Camera
  async function toggleCamera() {
    if (isTogglingCam.value) return
    isTogglingCam.value = true
    mediaError.value = ''

    try {
      const target = !isCamEnabled.value
      if (isWaiting.value) {
        // In waiting room: control local track directly
        if (localVideoTrack.value) {
          if (target) {
            await localVideoTrack.value.unmute()
          } else {
            await localVideoTrack.value.mute()
          }
          isCamEnabled.value = target
        } else if (target) {
          const tracks = await createLocalTracks({ video: true, audio: false })
          localVideoTrack.value = tracks[0] as LocalVideoTrack
          isCamEnabled.value = true
        }
      } else {
        // In active session: call LiveKit
        await room.localParticipant.setCameraEnabled(target)
        syncMediaStateFromLiveKit()
      }
    } catch (err) {
      console.error('[LiveKit][Camera] toggle failed:', err)
      mediaError.value = getArabicMediaErrorMessage(err, 'camera')
      if (!isWaiting.value) {
        syncMediaStateFromLiveKit()
      }
    } finally {
      isTogglingCam.value = false
    }
  }

  // Toggle Speaker / Output Audio
  function toggleSpeaker() {
    isSpeakerMuted.value = !isSpeakerMuted.value
  }

  // Safe DOM attachment helpers
  function attachLocalVideo(el: HTMLVideoElement | null) {
    if (!el) return
    const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera)
    const track = camPub?.videoTrack || localVideoTrack.value
    if (track && !track.attachedElements.includes(el)) {
      track.attach(el)
    }
  }

  function detachLocalVideo(el: HTMLVideoElement | null) {
    if (!el) return
    const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera)
    const track = camPub?.videoTrack || localVideoTrack.value
    if (track) {
      track.detach(el)
    }
  }

  function attachRemoteVideo(el: HTMLVideoElement | null, track: RemoteTrack) {
    if (!el || !track) return
    if (!track.attachedElements.includes(el)) {
      track.attach(el)
    }
  }

  function attachRemoteAudio(el: HTMLAudioElement | null, track: RemoteTrack) {
    if (!el || !track) return
    if (!track.attachedElements.includes(el)) {
      track.attach(el)
    }
  }

  // Disconnect & Cleanup
  function leaveSession() {
    if (permCheckTimer) {
      clearInterval(permCheckTimer)
      permCheckTimer = null
    }

    if (localVideoTrack.value) {
      localVideoTrack.value.detach()
      localVideoTrack.value.stop()
      localVideoTrack.value = null
    }

    if (localAudioTrack.value) {
      localAudioTrack.value.detach()
      localAudioTrack.value.stop()
      localAudioTrack.value = null
    }

    if (room.state === ConnectionState.Connected || room.state === ConnectionState.Connecting) {
      room.disconnect()
    }
  }

  onUnmounted(() => {
    leaveSession()
  })

  return {
    room,
    connectionState,
    isWaiting,
    isDoctorPresent,
    isPatientPresent,
    waitingList,
    isMicEnabled,
    isCamEnabled,
    isSpeakerMuted,
    isTogglingMic,
    isTogglingCam,
    isConnecting,
    mediaError,
    connectionError,
    localVideoTrack,
    localAudioTrack,
    remoteVideoTracks,
    remoteAudioTracks,
    initLocalPreview,
    connectRoom,
    toggleMicrophone,
    toggleCamera,
    toggleSpeaker,
    attachLocalVideo,
    detachLocalVideo,
    attachRemoteVideo,
    attachRemoteAudio,
    leaveSession,
  }
}
