<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Room, RoomEvent, Track, RemoteTrack, LocalVideoTrack, LocalAudioTrack, createLocalTracks, RemoteParticipant } from 'livekit-client'
import type { RemoteTrackPublication } from 'livekit-client'

interface SessionTokenResponse {
  roomName: string
  liveKitToken: string
}

interface AttachableMediaTrack {
  attach(element: HTMLMediaElement): HTMLMediaElement
  detach(): HTMLMediaElement[]
}

definePageMeta({
  layout: 'doctor-layout',
  middleware: ['auth', 'doctor-only'],
  pageTransition: false,
  layoutTransition: false,
})

const route = useRoute()
const bookingId = String(route.params.bookingId ?? '')

const { data } = await useFetch<SessionTokenResponse>(`/api/doctor/session/${bookingId}`)
const token = computed(() => data.value?.liveKitToken)
const serverUrl = String(useRuntimeConfig().public.liveKitUrl || 'ws://localhost:7880')

const room = new Room()

const remoteVideoTracks = ref<{ sid: string; track: AttachableMediaTrack; participantName: string }[]>([])
const remoteAudioTracks = ref<{ sid: string; track: AttachableMediaTrack }[]>([])
const waitingList = ref<{ identity: string; name: string }[]>([])

const isPatientPresent = ref(false)

const micEnabled = ref(false)
const camEnabled = ref(false)

const localVideoContainer = ref<HTMLDivElement | null>(null)
let localVideoTrack: LocalVideoTrack | null = null
let localAudioTrack: LocalAudioTrack | null = null

room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
  console.log('[doctor] TrackSubscribed:', track.kind, 'from', participant?.identity)
  isPatientPresent.value = true
  if (track.kind === Track.Kind.Video) {
    if (!remoteVideoTracks.value.some(t => t.sid === track.sid)) {
      remoteVideoTracks.value.push({ sid: track.sid!, track: track, participantName: participant.name || 'Patient' })
    }
  } else if (track.kind === Track.Kind.Audio) {
    if (!remoteAudioTracks.value.some(t => t.sid === track.sid)) {
      remoteAudioTracks.value.push({ sid: track.sid!, track: track })
    }
  }
})

room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
  if (track.kind === Track.Kind.Video) {
    const entry = remoteVideoTracks.value.find(t => t.sid === track.sid)
    entry?.track.detach()
    remoteVideoTracks.value = remoteVideoTracks.value.filter(t => t.sid !== track.sid)
  } else if (track.kind === Track.Kind.Audio) {
    const entry = remoteAudioTracks.value.find(t => t.sid === track.sid)
    entry?.track.detach()
    remoteAudioTracks.value = remoteAudioTracks.value.filter(t => t.sid !== track.sid)
  }
})

room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
  if (!participant.permissions?.canPublish) {
    if (!waitingList.value.some(p => p.identity === participant.identity)) {
      waitingList.value.push({ identity: participant.identity, name: participant.name || 'Patient' })
    }
  } else {
    isPatientPresent.value = true
  }
})

room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
  waitingList.value = waitingList.value.filter(p => p.identity !== participant.identity)
  if (participant.permissions?.canPublish) {
    checkPatientPresence()
  }
})

room.on(RoomEvent.ParticipantPermissionsChanged, (prevPermissions: any, participant: any) => {
  if (participant && participant.permissions?.canPublish) {
    waitingList.value = waitingList.value.filter(p => p.identity !== participant.identity)
    isPatientPresent.value = true
  } else if (participant && !participant.permissions?.canPublish) {
    checkPatientPresence()
  }
})

function checkPatientPresence() {
  let present = false
  room.remoteParticipants.forEach(p => {
    if (p.permissions?.canPublish) present = true
  })
  isPatientPresent.value = present
}

room.on(RoomEvent.Disconnected, () => {
  navigateTo('/doctor/calendar')
})

const admittingId = ref<string | null>(null)
const admitError = ref('')

async function admit(identity: string) {
  admittingId.value = identity
  admitError.value = ''
  try {
    console.log('[doctor] admitting participant:', identity)
    await $fetch(`/api/doctor/session/${bookingId}/admit`, {
      method: 'POST',
      body: { identity }
    })
    waitingList.value = waitingList.value.filter(p => p.identity !== identity)
    // isPatientPresent flips automatically when the admitted patient's track arrives (TrackSubscribed)
  } catch (e) {
    console.error('Failed to admit participant', e)
    admitError.value = 'تعذر قبول المريض. حاول مرة أخرى.'
  } finally {
    admittingId.value = null
  }
}

async function initLocalTracks() {
  try {
    const tracks = await createLocalTracks({
      audio: true,
      video: true,
    })
    for (const track of tracks) {
      if (track.kind === Track.Kind.Video) {
        localVideoTrack = track as LocalVideoTrack
        if (localVideoContainer.value) {
          const el = localVideoTrack.attach()
          el.style.width = '100%'
          el.style.height = '100%'
          el.style.objectFit = 'cover'
          localVideoContainer.value.appendChild(el)
        }
      } else if (track.kind === Track.Kind.Audio) {
        localAudioTrack = track as LocalAudioTrack
      }
    }
  } catch (e) {
    console.error('Failed to access camera or microphone', e)
  }
}

async function toggleMic() {
  micEnabled.value = !micEnabled.value
  if (localAudioTrack) {
    if (micEnabled.value) {
      await room.localParticipant.publishTrack(localAudioTrack)
    } else {
      await room.localParticipant.unpublishTrack(localAudioTrack)
    }
  }
}

async function toggleCam() {
  camEnabled.value = !camEnabled.value
  if (localVideoTrack) {
    if (camEnabled.value) {
      await room.localParticipant.publishTrack(localVideoTrack)
    } else {
      await room.localParticipant.unpublishTrack(localVideoTrack)
    }
  }
}

onMounted(async () => {
  await initLocalTracks()
  if (token.value) {
    await room.connect(serverUrl, token.value)
    if (localVideoTrack && camEnabled.value) await room.localParticipant.publishTrack(localVideoTrack)
    if (localAudioTrack && micEnabled.value) await room.localParticipant.publishTrack(localAudioTrack)
    
    // Check for participants already in room
    room.remoteParticipants.forEach(participant => {
      if (!participant.permissions?.canPublish) {
        if (!waitingList.value.some(p => p.identity === participant.identity)) {
          waitingList.value.push({ identity: participant.identity, name: participant.name || 'Patient' })
        }
      } else {
        isPatientPresent.value = true
      }
    })
  }
})

onUnmounted(() => {
  if (localVideoTrack) {
    localVideoTrack.stop()
    localVideoTrack.detach()
  }
  if (localAudioTrack) {
    localAudioTrack.stop()
    localAudioTrack.detach()
  }
  if (room.state === 'connected' || room.state === 'connecting') {
    room.disconnect()
  }
})

function attachVideo(el: unknown, track: AttachableMediaTrack) {
  if (el instanceof HTMLVideoElement && !el.srcObject) {
    track.attach(el)
  }
}

function attachAudio(el: unknown, track: AttachableMediaTrack) {
  if (el instanceof HTMLAudioElement && !el.srcObject) {
    track.attach(el)
  }
}

function leaveSession() {
  room.disconnect()
}
</script>

<template>
  <div class="session-layout">
    <!-- Admit notification -->
    <div v-if="waitingList.length" class="admit-bar">
      <div v-for="p in waitingList" :key="p.identity" class="flex items-center justify-between w-full max-w-md bg-card p-3 rounded-lg border border-border shadow-lg mx-auto mb-2">
        <span class="text-white text-sm font-medium">{{ p.name }} ينتظر في الغرفة</span>
        <button class="bg-primary text-white px-4 py-1.5 rounded-md text-sm font-bold disabled:opacity-50" :disabled="admittingId === p.identity" @click="admit(p.identity)">{{ admittingId === p.identity ? '...' : 'قبول' }}</button>
      </div>
      <p v-if="admitError" class="text-center text-sm text-red-400">{{ admitError }}</p>
    </div>

    <!-- Main video — المريض -->
    <div class="main-video">
      <div v-if="!isPatientPresent" class="flex h-full items-center justify-center text-white">
        في انتظار انضمام المريض...
      </div>
      <div v-for="t in remoteVideoTracks" :key="t.sid" class="w-full h-full relative">
        <video class="w-full h-full object-cover" autoplay playsinline :ref="el => attachVideo(el, t.track)" />
        <span class="participant-name">{{ t.participantName }}</span>
      </div>
    </div>

    <!-- Strip سفلي — الدكتور نفسه -->
    <div class="participants-strip">
      <div class="participant-tile" ref="localVideoContainer">
        <span class="absolute bottom-2 left-2 z-10 text-white text-xs bg-black/50 px-2 py-1 rounded">أنت</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls-bar">
      <button @click="toggleMic" :class="{'bg-primary': micEnabled}">🎤</button>
      <button @click="toggleCam" :class="{'bg-primary': camEnabled}">📷</button>
      <button class="leave-btn" @click="leaveSession">مغادرة</button>
    </div>

    <!-- Remote Audios (hidden) -->
    <div v-for="t in remoteAudioTracks" :key="t.sid" class="hidden">
      <audio autoplay playsinline :ref="el => attachAudio(el, t.track)" />
    </div>
  </div>
</template>

<style scoped>
.session-layout {
  background: #0f1117;
  height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.admit-bar {
  position: absolute;
  top: 16px;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.main-video {
  flex: 1;
  position: relative;
  background: #1a1d27;
  border-radius: 12px;
  margin: 16px;
  overflow: hidden;
}

.participant-name {
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.participants-strip {
  display: flex;
  gap: 8px;
  padding: 0 16px;
  height: 120px;
  flex-shrink: 0;
}

.participant-tile {
  width: 160px;
  background: #1a1d27;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.controls-bar {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: #1a1d27;
  flex-shrink: 0;
}

.controls-bar button {
  background: #2a2d37;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.controls-bar button:hover {
  background: #3a3d47;
}

.controls-bar button.bg-primary {
  background: #e91e8c;
}

.leave-btn {
  background: #ef4444 !important;
}

.leave-btn:hover {
  background: #dc2626 !important;
}
</style>
