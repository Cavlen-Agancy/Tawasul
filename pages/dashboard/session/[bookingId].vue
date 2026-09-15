<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Room, RoomEvent, Track, RemoteTrack, LocalVideoTrack, LocalAudioTrack, createLocalTracks } from 'livekit-client'
import type { RemoteTrackPublication, RemoteParticipant } from 'livekit-client'

interface SessionTokenResponse {
  roomName: string
  liveKitToken: string
}

interface AttachableMediaTrack {
  attach(element: HTMLMediaElement): HTMLMediaElement
  detach(): HTMLMediaElement[]
}

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
  pageTransition: false,
  layoutTransition: false,
})

const route = useRoute()
const bookingId = String(route.params.bookingId ?? '')

const { data } = await useFetch<SessionTokenResponse>(`/api/patient/session/${bookingId}`)
const token = computed(() => data.value?.liveKitToken)
const serverUrl = String(useRuntimeConfig().public.liveKitUrl || 'ws://localhost:7880')

const room = new Room()

const remoteVideoTracks = ref<{ sid: string; track: AttachableMediaTrack; participantName: string }[]>([])
const remoteAudioTracks = ref<{ sid: string; track: AttachableMediaTrack }[]>([])

const isWaiting = ref(true)
const isDoctorPresent = ref(false)
const micEnabled = ref(false)
const camEnabled = ref(false)

const waitingVideoContainer = ref<HTMLDivElement | null>(null)
const sessionVideoTile = ref<HTMLDivElement | null>(null)

let localVideoTrack: LocalVideoTrack | null = null
let localAudioTrack: LocalAudioTrack | null = null
let permCheck: ReturnType<typeof setInterval> | null = null

room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
  console.log('[patient] TrackSubscribed:', track.kind, 'from', participant?.identity)
  if (track.kind === Track.Kind.Video) {
    if (!remoteVideoTracks.value.some(t => t.sid === track.sid)) {
      remoteVideoTracks.value.push({ sid: track.sid!, track: track, participantName: participant.name || 'Doctor' })
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

room.on(RoomEvent.ParticipantConnected, () => {
  isDoctorPresent.value = true
})

room.on(RoomEvent.ParticipantDisconnected, () => {
  if (room.remoteParticipants.size === 0) {
    isDoctorPresent.value = false
  }
})

room.on(RoomEvent.Disconnected, () => {
  navigateTo('/dashboard/appointments')
})

async function initLocalTracks() {
  try {
    const tracks = await createLocalTracks({
      audio: true,
      video: true,
    })
    for (const track of tracks) {
      if (track.kind === Track.Kind.Video) {
        localVideoTrack = track as LocalVideoTrack
      } else if (track.kind === Track.Kind.Audio) {
        localAudioTrack = track as LocalAudioTrack
      }
    }
  } catch (e) {
    console.error('Failed to access camera or microphone', e)
  }
}

function attachWaitingPreview() {
  const el = waitingVideoContainer.value
  if (el && localVideoTrack && !el.querySelector('video')) {
    const videoEl = localVideoTrack.attach()
    videoEl.style.cssText = 'width:100%;height:100%;object-fit:cover'
    el.appendChild(videoEl)
  }
}

watch(waitingVideoContainer, (el: HTMLDivElement | null) => {
  if (el) attachWaitingPreview()
})

async function toggleMic() {
  micEnabled.value = !micEnabled.value
  if (!isWaiting.value && localAudioTrack) {
    if (micEnabled.value) {
      await room.localParticipant.publishTrack(localAudioTrack)
    } else {
      await room.localParticipant.unpublishTrack(localAudioTrack)
    }
  }
}

async function toggleCam() {
  camEnabled.value = !camEnabled.value
  if (!isWaiting.value && localVideoTrack) {
    if (camEnabled.value) {
      await room.localParticipant.publishTrack(localVideoTrack)
    } else {
      await room.localParticipant.unpublishTrack(localVideoTrack)
    }
  }
}

onMounted(async () => {
  await initLocalTracks()
  attachWaitingPreview()
  if (token.value) {
    await room.connect(serverUrl, token.value)
    console.log('[patient] room connected, canPublish =', room.localParticipant.permissions?.canPublish)

    if (room.remoteParticipants.size > 0) {
      isDoctorPresent.value = true
    }

    if (room.localParticipant.permissions?.canPublish) {
      isWaiting.value = false
      if (localVideoTrack && camEnabled.value) await room.localParticipant.publishTrack(localVideoTrack)
      if (localAudioTrack && micEnabled.value) await room.localParticipant.publishTrack(localAudioTrack)
    } else {
      // Poll for permission change
      permCheck = setInterval(async () => {
        if (room.localParticipant.permissions?.canPublish) {
          console.log('[patient] permissions granted, leaving waiting room')
          isWaiting.value = false
          if (permCheck) clearInterval(permCheck)
          
          if (localVideoTrack && camEnabled.value) await room.localParticipant.publishTrack(localVideoTrack)
          if (localAudioTrack && micEnabled.value) await room.localParticipant.publishTrack(localAudioTrack)
        }
      }, 500)
    }
  }
})

watch(isWaiting, async (val: boolean) => {
  if (!val) {
    await nextTick()
    if (localVideoTrack && sessionVideoTile.value) {
      const el = localVideoTrack.attach()
      el.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0'
      sessionVideoTile.value.appendChild(el)
    }
  }
})

onUnmounted(() => {
  if (permCheck) clearInterval(permCheck)
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
    <div v-if="isWaiting" class="waiting-room">
      <div class="waiting-card">
        <h2 class="text-xl mb-4 font-bold text-white text-center">⏳ في انتظار موافقة الدكتور</h2>
        <div class="preview-container" ref="waitingVideoContainer"></div>
        <div class="controls-bar mt-4 rounded-lg">
          <button @click="toggleMic" :class="{'bg-primary': micEnabled}">🎤 {{ micEnabled ? 'Mic ON' : 'Mic OFF' }}</button>
          <button @click="toggleCam" :class="{'bg-primary': camEnabled}">📷 {{ camEnabled ? 'Cam ON' : 'Cam OFF' }}</button>
          <button class="leave-btn" @click="leaveSession">مغادرة</button>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- Main video — الدكتور -->
      <div class="main-video">
        <div v-if="remoteVideoTracks.length === 0" class="flex h-full items-center justify-center text-white">
          في انتظار الدكتور...
        </div>
        <div v-for="t in remoteVideoTracks" :key="t.sid" class="w-full h-full relative">
          <video class="w-full h-full object-cover" autoplay playsinline :ref="el => attachVideo(el, t.track)" />
          <span class="participant-name">د. {{ t.participantName }}</span>
        </div>
      </div>

      <!-- Strip سفلي — المريض نفسه -->
      <div class="participants-strip">
        <div class="participant-tile" ref="sessionVideoTile">
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
    </template>
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
}

.waiting-room {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.waiting-card {
  background: #1a1d27;
  padding: 24px;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
}

.preview-container {
  width: 100%;
  height: 240px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
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
