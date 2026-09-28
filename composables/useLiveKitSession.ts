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
  type TrackPublication,
} from 'livekit-client'
import { useSessionI18n } from './useSessionI18n'

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

export type SessionLoadingStage =
  | 'idle'
  | 'fetching_token'
  | 'connecting'
  | 'initializing_media'
  | 'ready'
  | 'failed'

export interface UseLiveKitSessionOptions {
  serverUrl: string
  token?: Ref<string | undefined> | ComputedRef<string | undefined>
  isModerator?: boolean
  onDisconnected?: () => void
}

/** Backward-compatible export for existing tests */
export function getArabicMediaErrorMessage(err: unknown, deviceType: 'camera' | 'microphone'): string {
  const { getMediaErrorMessage, locale } = useSessionI18n()
  const prevLocale = locale.value
  locale.value = 'ar'
  const msg = getMediaErrorMessage(err, deviceType)
  locale.value = prevLocale
  return msg
}

export function useLiveKitSession(options: UseLiveKitSessionOptions) {
  const isModerator = !!options.isModerator
  const rolePrefix = isModerator ? '[Doctor][Session]' : '[Patient][Session]'
  const { t, getMediaErrorMessage } = useSessionI18n()
  // Development-only verbose logging; errors/warnings always surface.
  const devLog = (...args: unknown[]) => {
    if (import.meta.dev) console.log(...args)
  }

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

  // Loading state machine
  const loadingStage = ref<SessionLoadingStage>('idle')
  const isConnecting = ref(false)

  // Single source of truth for media controls
  const isMicEnabled = ref(false)
  const isCamEnabled = ref(false)
  const isSpeakerMuted = ref(false)

  // In-flight mutex protection
  const isTogglingMic = ref(false)
  const isTogglingCam = ref(false)

  // Feedback & errors
  const mediaError = ref<string>('')
  const connectionError = ref<string>('')
  const deviceNotification = ref<string>('')

  // Local tracks
  const localVideoTrack = shallowRef<LocalVideoTrack | null>(null)
  const localAudioTrack = shallowRef<LocalAudioTrack | null>(null)

  // Remote tracks
  const remoteVideoTracks = ref<RemoteParticipantTrack[]>([])
  const remoteAudioTracks = ref<RemoteParticipantTrack[]>([])

  // Media Devices
  const audioInputDevices = ref<MediaDeviceInfo[]>([])
  const audioOutputDevices = ref<MediaDeviceInfo[]>([])
  const videoInputDevices = ref<MediaDeviceInfo[]>([])

  const selectedAudioInputId = ref<string>('')
  const selectedAudioOutputId = ref<string>('')
  const selectedVideoInputId = ref<string>('')

  const isSpeakerOutputSupported = ref<boolean>(
    typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype,
  )

  let permCheckTimer: ReturnType<typeof setInterval> | null = null

  function syncMediaStateFromLiveKit() {
    if (!isWaiting.value && (room.state === ConnectionState.Connected || room.state === ConnectionState.Reconnecting)) {
      isCamEnabled.value = room.localParticipant.isCameraEnabled
      isMicEnabled.value = room.localParticipant.isMicrophoneEnabled
    }
  }

  function checkParticipantsPresence() {
    if (isModerator) {
      let present = false
      room.remoteParticipants.forEach((p) => {
        if (p.permissions?.canPublish) {
          present = true
        }
      })
      isPatientPresent.value = present
    } else {
      isDoctorPresent.value = room.remoteParticipants.size > 0
    }
  }

  // Device Enumeration
  async function enumerateDevices() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const aInputs = devices.filter((d) => d.kind === 'audioinput')
      const aOutputs = devices.filter((d) => d.kind === 'audiooutput')
      const vInputs = devices.filter((d) => d.kind === 'videoinput')

      audioInputDevices.value = aInputs
      audioOutputDevices.value = aOutputs
      videoInputDevices.value = vInputs

      // Sync selected mic
      const activeMic = room.getActiveDevice('audioinput')
      if (activeMic && aInputs.some((d) => d.deviceId === activeMic)) {
        selectedAudioInputId.value = activeMic
      } else if (!selectedAudioInputId.value || !aInputs.some((d) => d.deviceId === selectedAudioInputId.value)) {
        selectedAudioInputId.value = aInputs[0]?.deviceId || ''
      }

      // Sync selected cam
      const activeCam = room.getActiveDevice('videoinput')
      if (activeCam && vInputs.some((d) => d.deviceId === activeCam)) {
        selectedVideoInputId.value = activeCam
      } else if (!selectedVideoInputId.value || !vInputs.some((d) => d.deviceId === selectedVideoInputId.value)) {
        selectedVideoInputId.value = vInputs[0]?.deviceId || ''
      }

      // Sync selected speaker
      const activeSpeaker = room.getActiveDevice('audiooutput')
      if (activeSpeaker && aOutputs.some((d) => d.deviceId === activeSpeaker)) {
        selectedAudioOutputId.value = activeSpeaker
      } else if (!selectedAudioOutputId.value || !aOutputs.some((d) => d.deviceId === selectedAudioOutputId.value)) {
        selectedAudioOutputId.value = aOutputs[0]?.deviceId || ''
      }
    } catch (err) {
      console.warn(`${rolePrefix} Failed to enumerate devices:`, err)
    }
  }

  // Hot device change listener
  async function handleDeviceChange() {
    devLog(`${rolePrefix} Device change detected, updating device list...`)
    await enumerateDevices()

    // If current mic is gone, fallback
    if (selectedAudioInputId.value && !audioInputDevices.value.some((d) => d.deviceId === selectedAudioInputId.value)) {
      const fallback = audioInputDevices.value[0]?.deviceId || 'default'
      await switchMicrophone(fallback)
    }

    // If current cam is gone, fallback
    if (selectedVideoInputId.value && !videoInputDevices.value.some((d) => d.deviceId === selectedVideoInputId.value)) {
      const fallback = videoInputDevices.value[0]?.deviceId || 'default'
      await switchCamera(fallback)
    }

    // If current speaker is gone, fallback
    if (selectedAudioOutputId.value && !audioOutputDevices.value.some((d) => d.deviceId === selectedAudioOutputId.value)) {
      const fallback = audioOutputDevices.value[0]?.deviceId || 'default'
      await switchSpeaker(fallback)
    }

    deviceNotification.value = t('session.devices.deviceChanged')
    setTimeout(() => {
      deviceNotification.value = ''
    }, 4000)
  }

  // Room event listeners
  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    connectionState.value = state
    if (state === ConnectionState.Connected) {
      connectionError.value = ''
    }
  })

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    devLog(`${rolePrefix} TrackSubscribed: ${track.kind} from ${participant.identity}`)
    if (track.kind === Track.Kind.Video) {
      const idx = remoteVideoTracks.value.findIndex((t) => t.sid === track.sid)
      const entry: RemoteParticipantTrack = {
        sid: track.sid || Math.random().toString(),
        track,
        participantIdentity: participant.identity,
        participantName: participant.name || (isModerator ? t('session.doctor.waitingBadge') : t('session.waitingRoom.doctorAssigned')),
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
        participantName: participant.name || (isModerator ? t('session.doctor.waitingBadge') : t('session.waitingRoom.doctorAssigned')),
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
    devLog(`${rolePrefix} ParticipantConnected: ${participant.identity}`)
    if (isModerator) {
      if (!participant.permissions?.canPublish) {
        if (!waitingList.value.some((p) => p.identity === participant.identity)) {
          waitingList.value.push({ identity: participant.identity, name: participant.name || t('session.doctor.waitingPatient') })
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
    devLog(`${rolePrefix} ParticipantDisconnected: ${participant.identity}`)
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

  room.on(RoomEvent.MediaDevicesChanged, handleDeviceChange)

  room.on(RoomEvent.Disconnected, () => {
    devLog(`${rolePrefix} room disconnected`)
    connectionState.value = ConnectionState.Disconnected
    if (options.onDisconnected) {
      options.onDisconnected()
    }
  })

  // Patient admission transition handler
  async function handlePatientAdmitted() {
    if (!isWaiting.value) return
    devLog(`${rolePrefix} patient admitted by doctor, preparing session active`)
    isWaiting.value = false
    loadingStage.value = 'initializing_media'
    if (permCheckTimer) {
      clearInterval(permCheckTimer)
      permCheckTimer = null
    }

    try {
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
      devLog(`${rolePrefix} media ready`)
      devLog(`${rolePrefix} session active`)
      loadingStage.value = 'ready'
      enumerateDevices().catch(() => {})
    } catch (err) {
      console.error(`${rolePrefix} Failed to publish admitted tracks:`, err)
      loadingStage.value = 'ready'
    }
  }

  // Pre-session local tracks acquisition (e.g. for Waiting Room preview)
  async function initLocalPreview(preferredCam = true, preferredMic = true): Promise<boolean> {
    mediaError.value = ''
    devLog(`${rolePrefix} initializing media preview`)
    try {
      const tracks = await createLocalTracks({
        audio: selectedAudioInputId.value ? { deviceId: { exact: selectedAudioInputId.value } } : true,
        video: selectedVideoInputId.value ? { deviceId: { exact: selectedVideoInputId.value } } : true,
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
      devLog(`${rolePrefix} media preview ready`)

      enumerateDevices().catch(() => {})
      return true
    } catch (err) {
      console.error(`${rolePrefix} Failed to access camera or microphone preview:`, err)
      mediaError.value = getMediaErrorMessage(err, 'camera')
      return false
    }
  }

  // Connect to LiveKit room
  async function connectRoom(providedToken?: string) {
    const tokenVal = providedToken || options.token?.value
    if (!tokenVal) {
      console.warn(`${rolePrefix} connectRoom called without token`)
      return
    }

    loadingStage.value = 'connecting'
    isConnecting.value = true
    connectionError.value = ''
    devLog(`${rolePrefix} connecting to LiveKit`)

    try {
      // Timeout protection (15 seconds)
      const connectPromise = room.connect(options.serverUrl, tokenVal)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('CONNECT_TIMEOUT')), 15000),
      )
      await Promise.race([connectPromise, timeoutPromise])

      connectionState.value = room.state
      devLog(`${rolePrefix} LiveKit connected`)

      if (isModerator) {
        isWaiting.value = false
        loadingStage.value = 'initializing_media'
        devLog(`${rolePrefix} initializing media`)

        try {
          await room.localParticipant.setCameraEnabled(true)
          await room.localParticipant.setMicrophoneEnabled(true)
          syncMediaStateFromLiveKit()
          devLog(`${rolePrefix} media ready`)
        } catch (mediaErr) {
          console.warn(`${rolePrefix} Doctor initial media error (continuing):`, mediaErr)
          mediaError.value = getMediaErrorMessage(mediaErr, 'camera')
        }

        loadingStage.value = 'ready'
        devLog(`${rolePrefix} session active`)

        room.remoteParticipants.forEach((participant) => {
          if (!participant.permissions?.canPublish) {
            if (!waitingList.value.some((p) => p.identity === participant.identity)) {
              waitingList.value.push({
                identity: participant.identity,
                name: participant.name || t('session.doctor.waitingPatient'),
              })
            }
          } else {
            isPatientPresent.value = true
          }
        })
      } else {
        if (room.localParticipant.permissions?.canPublish) {
          devLog(`${rolePrefix} patient already has publish permissions`)
          await handlePatientAdmitted()
        } else {
          isWaiting.value = true
          loadingStage.value = 'ready'
          devLog(`${rolePrefix} patient entered waiting room`)
          if (permCheckTimer) clearInterval(permCheckTimer)
          permCheckTimer = setInterval(() => {
            if (room.localParticipant.permissions?.canPublish && isWaiting.value) {
              handlePatientAdmitted()
            }
          }, 600)
        }
      }
      checkParticipantsPresence()
      enumerateDevices().catch(() => {})
    } catch (err: unknown) {
      console.error(`${rolePrefix} LiveKit connection failed:`, err)
      loadingStage.value = 'failed'
      if (err instanceof Error && err.message === 'CONNECT_TIMEOUT') {
        connectionError.value = t('session.loading.timeout')
      } else {
        connectionError.value = t('session.state.connectError')
      }
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
        if (localAudioTrack.value) {
          if (target) {
            await localAudioTrack.value.unmute()
          } else {
            await localAudioTrack.value.mute()
          }
          isMicEnabled.value = target
        } else if (target) {
          const tracks = await createLocalTracks({
            audio: selectedAudioInputId.value ? { deviceId: { exact: selectedAudioInputId.value } } : true,
            video: false,
          })
          localAudioTrack.value = tracks[0] as LocalAudioTrack
          isMicEnabled.value = true
        }
      } else {
        await room.localParticipant.setMicrophoneEnabled(target)
        syncMediaStateFromLiveKit()
      }
    } catch (err) {
      console.error(`${rolePrefix}[Microphone] toggle failed:`, err)
      mediaError.value = getMediaErrorMessage(err, 'microphone')
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
        if (localVideoTrack.value) {
          if (target) {
            await localVideoTrack.value.unmute()
          } else {
            await localVideoTrack.value.mute()
          }
          isCamEnabled.value = target
        } else if (target) {
          const tracks = await createLocalTracks({
            video: selectedVideoInputId.value ? { deviceId: { exact: selectedVideoInputId.value } } : true,
            audio: false,
          })
          localVideoTrack.value = tracks[0] as LocalVideoTrack
          isCamEnabled.value = true
        }
      } else {
        await room.localParticipant.setCameraEnabled(target)
        syncMediaStateFromLiveKit()
      }
    } catch (err) {
      console.error(`${rolePrefix}[Camera] toggle failed:`, err)
      mediaError.value = getMediaErrorMessage(err, 'camera')
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

  // Device Switching (Microphone)
  async function switchMicrophone(deviceId: string) {
    if (!deviceId) return
    selectedAudioInputId.value = deviceId
    mediaError.value = ''
    try {
      if (isWaiting.value) {
        if (localAudioTrack.value) {
          await localAudioTrack.value.setDeviceId(deviceId)
        }
      } else {
        await room.switchActiveDevice('audioinput', deviceId)
        const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone)
        if (pub?.audioTrack) {
          localAudioTrack.value = pub.audioTrack as LocalAudioTrack
        }
      }
    } catch (err) {
      console.error(`${rolePrefix}[Microphone] device switch failed:`, err)
      mediaError.value = getMediaErrorMessage(err, 'microphone')
    }
  }

  // Device Switching (Camera)
  async function switchCamera(deviceId: string) {
    if (!deviceId) return
    selectedVideoInputId.value = deviceId
    mediaError.value = ''
    try {
      if (isWaiting.value) {
        if (localVideoTrack.value) {
          await localVideoTrack.value.setDeviceId(deviceId)
        }
      } else {
        await room.switchActiveDevice('videoinput', deviceId)
        const pub = room.localParticipant.getTrackPublication(Track.Source.Camera)
        if (pub?.videoTrack) {
          localVideoTrack.value = pub.videoTrack as LocalVideoTrack
        }
      }
    } catch (err) {
      console.error(`${rolePrefix}[Camera] device switch failed:`, err)
      mediaError.value = getMediaErrorMessage(err, 'camera')
    }
  }

  // Device Switching (Speaker)
  async function switchSpeaker(deviceId: string) {
    if (!deviceId) return
    selectedAudioOutputId.value = deviceId
    if (!isSpeakerOutputSupported.value) return

    try {
      await room.switchActiveDevice('audiooutput', deviceId)
      for (const remoteAudio of remoteAudioTracks.value) {
        if (remoteAudio.track?.attachedElements) {
          for (const el of remoteAudio.track.attachedElements) {
            if ('setSinkId' in el) {
              await (el as any).setSinkId(deviceId)
            }
          }
        }
      }
    } catch (err) {
      console.error(`${rolePrefix}[Speaker] device switch failed:`, err)
    }
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
      if (selectedAudioOutputId.value && 'setSinkId' in el) {
        ;(el as any).setSinkId(selectedAudioOutputId.value).catch((err: any) => {
          console.warn(`${rolePrefix} setSinkId failed on newly attached audio element:`, err)
        })
      }
    }
  }

  // Disconnect & Cleanup
  // Async: `room.disconnect()` resolves only after the engine closes and the
  // Disconnected event is emitted — callers must await it before navigating
  // away, otherwise the trailing Disconnected event fires post-unmount.
  async function leaveSession() {
    devLog(`${rolePrefix} leaving`)
    if (permCheckTimer) {
      clearInterval(permCheckTimer)
      permCheckTimer = null
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.removeEventListener) {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
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

    if (room.state !== ConnectionState.Disconnected) {
      await room.disconnect()
    }
    loadingStage.value = 'idle'
    devLog(`${rolePrefix} cleanup complete`)
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
    loadingStage,
    isConnecting,
    isMicEnabled,
    isCamEnabled,
    isSpeakerMuted,
    isTogglingMic,
    isTogglingCam,
    mediaError,
    connectionError,
    deviceNotification,
    localVideoTrack,
    localAudioTrack,
    remoteVideoTracks,
    remoteAudioTracks,
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInputId,
    selectedAudioOutputId,
    selectedVideoInputId,
    isSpeakerOutputSupported,
    enumerateDevices,
    switchMicrophone,
    switchCamera,
    switchSpeaker,
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
