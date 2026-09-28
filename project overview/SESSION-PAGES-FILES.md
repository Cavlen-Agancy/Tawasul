# Session Files

## `pages/dashboard/session/[bookingId].vue`
```vue
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Room, RoomEvent, Track, RemoteTrack, LocalVideoTrack, LocalAudioTrack, createLocalTracks } from 'livekit-client'
import type { VideoTrack, AudioTrack } from 'livekit-client'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

const route = useRoute()
const bookingId = String(route.params.bookingId ?? '')

const { data } = await useFetch<any>(`/api/patient/session/${bookingId}`)
const token = computed(() => data.value?.liveKitToken)
const serverUrl = String(useRuntimeConfig().public.liveKitUrl || 'ws://localhost:7880')

const room = new Room()

const remoteVideoTracks = ref<{ sid: string; track: VideoTrack; participantName: string }[]>([])
const remoteAudioTracks = ref<{ sid: string; track: AudioTrack }[]>([])

const isWaiting = ref(true)
const isDoctorPresent = ref(false)
const micEnabled = ref(false)
const camEnabled = ref(false)

const localVideoContainer = ref<HTMLDivElement | null>(null)
let localVideoTrack: LocalVideoTrack | null = null
let localAudioTrack: LocalAudioTrack | null = null

room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: any, participant: any) => {
  if (track.kind === Track.Kind.Video) {
    remoteVideoTracks.value.push({ sid: track.sid!, track: track as unknown as VideoTrack, participantName: participant.name || 'Doctor' })
  } else if (track.kind === Track.Kind.Audio) {
    remoteAudioTracks.value.push({ sid: track.sid!, track: track as unknown as AudioTrack })
  }
})

room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
  if (track.kind === Track.Kind.Video) {
    remoteVideoTracks.value = remoteVideoTracks.value.filter(t => t.sid !== track.sid)
  } else if (track.kind === Track.Kind.Audio) {
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

room.on(RoomEvent.ParticipantPermissionsChanged, async () => {
  if (room.localParticipant.permissions?.canPublish) {
    isWaiting.value = false
    // Start publishing local tracks
    if (localVideoTrack && camEnabled.value) {
      await room.localParticipant.publishTrack(localVideoTrack)
    }
    if (localAudioTrack && micEnabled.value) {
      await room.localParticipant.publishTrack(localAudioTrack)
    }
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
  if (token.value) {
    await room.connect(serverUrl, token.value)
    
    if (room.remoteParticipants.size > 0) {
      isDoctorPresent.value = true
    }

    if (room.localParticipant.permissions?.canPublish) {
      isWaiting.value = false
      if (localVideoTrack && camEnabled.value) await room.localParticipant.publishTrack(localVideoTrack)
      if (localAudioTrack && micEnabled.value) await room.localParticipant.publishTrack(localAudioTrack)
    }
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
  room.disconnect()
})

function attachVideo(el: any, track: any) {
  if (el && el instanceof HTMLVideoElement) {
    track.attach(el)
  }
}

function attachAudio(el: any, track: any) {
  if (el && el instanceof HTMLAudioElement) {
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
        <div class="preview-container" ref="localVideoContainer"></div>
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
        <div v-if="!isDoctorPresent" class="flex h-full items-center justify-center text-white">
          في انتظار الدكتور...
        </div>
        <div v-for="t in remoteVideoTracks" :key="t.sid" class="w-full h-full relative">
          <video class="w-full h-full object-cover" autoplay playsinline :ref="el => attachVideo(el, t.track)" />
          <span class="participant-name">د. {{ t.participantName }}</span>
        </div>
      </div>

      <!-- Strip سفلي — المريض نفسه -->
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
```

## `modules/doctor/pages/doctor/session/[bookingId].vue`
```vue
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Room, RoomEvent, Track, RemoteTrack, LocalVideoTrack, LocalAudioTrack, createLocalTracks, RemoteParticipant } from 'livekit-client'
import type { VideoTrack, AudioTrack } from 'livekit-client'

definePageMeta({
  layout: 'doctor-layout',
  middleware: ['auth', 'doctor-only'],
})

const route = useRoute()
const bookingId = String(route.params.bookingId ?? '')

const { data } = await useFetch<any>(`/api/doctor/session/${bookingId}`)
const token = computed(() => data.value?.liveKitToken)
const serverUrl = String(useRuntimeConfig().public.liveKitUrl || 'ws://localhost:7880')

const room = new Room()

const remoteVideoTracks = ref<{ sid: string; track: VideoTrack; participantName: string }[]>([])
const remoteAudioTracks = ref<{ sid: string; track: AudioTrack }[]>([])
const waitingList = ref<{ identity: string; name: string }[]>([])

const isPatientPresent = ref(false)

const micEnabled = ref(false)
const camEnabled = ref(false)

const localVideoContainer = ref<HTMLDivElement | null>(null)
let localVideoTrack: LocalVideoTrack | null = null
let localAudioTrack: LocalAudioTrack | null = null

room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: any, participant: any) => {
  if (track.kind === Track.Kind.Video) {
    remoteVideoTracks.value.push({ sid: track.sid!, track: track as unknown as VideoTrack, participantName: participant.name || 'Patient' })
  } else if (track.kind === Track.Kind.Audio) {
    remoteAudioTracks.value.push({ sid: track.sid!, track: track as unknown as AudioTrack })
  }
})

room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
  if (track.kind === Track.Kind.Video) {
    remoteVideoTracks.value = remoteVideoTracks.value.filter(t => t.sid !== track.sid)
  } else if (track.kind === Track.Kind.Audio) {
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

async function admit(identity: string) {
  try {
    await $fetch(`/api/doctor/session/${bookingId}/admit`, {
      method: 'POST',
      body: { identity }
    })
    waitingList.value = waitingList.value.filter(p => p.identity !== identity)
  } catch (e) {
    console.error('Failed to admit participant', e)
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
  room.disconnect()
})

function attachVideo(el: any, track: any) {
  if (el && el instanceof HTMLVideoElement) {
    track.attach(el)
  }
}

function attachAudio(el: any, track: any) {
  if (el && el instanceof HTMLAudioElement) {
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
        <button class="bg-primary text-white px-4 py-1.5 rounded-md text-sm font-bold" @click="admit(p.identity)">قبول</button>
      </div>
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
```

## `modules/doctor/server/api/doctor/session/[bookingId]/admit.post.ts`
```typescript
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { RoomServiceClient } from 'livekit-server-sdk'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const bookingId = getRouterParam(event, 'bookingId')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const { identity } = await readBody(event)
  if (!identity) {
    throw createError({ statusCode: 400, message: 'identity is required' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { sessionRoom: true },
  })

  if (!booking || !booking.sessionRoom) {
    throw createError({ statusCode: 404, message: 'Booking or Room not found' })
  }

  const roomName = booking.sessionRoom.roomName

  const apiKey = process.env.LIVEKIT_API_KEY!
  const apiSecret = process.env.LIVEKIT_API_SECRET!
  const liveKitUrl = (process.env.LIVEKIT_URL || 'ws://localhost:7880').replace('ws://', 'http://').replace('wss://', 'https://')

  const roomService = new RoomServiceClient(liveKitUrl, apiKey, apiSecret)

  await roomService.updateParticipant(roomName, identity, {
    permission: {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      hidden: false,
      recorder: false,
    }
  })

  return { success: true }
})
```
