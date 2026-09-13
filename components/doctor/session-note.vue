<script setup lang="ts">
import { StickyNote, Pencil, Trash2, Eye } from 'lucide-vue-next'

const props = defineProps<{
  bookingId: string
  patientUserId: string
  isOwnSession: boolean
}>()

interface SessionNoteItem {
  id: string
  content: string
  doctorId: string
  doctorName: string
  createdAt: string
  updatedAt: string
  isOwn: boolean
}

const notes = ref<SessionNoteItem[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

const draft = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)

const editing = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)

const ownNote = computed(() => notes.value.find((n) => n.isOwn) ?? null)
const peerNotes = computed(() => notes.value.filter((n) => !n.isOwn))

const notesUrl = computed(
  () => `/api/doctor/patients/${props.patientUserId}/sessions/${props.bookingId}/notes`,
)

async function fetchNotes() {
  loading.value = true
  loadError.value = null
  try {
    const res = await $fetch<{ notes: SessionNoteItem[] }>(notesUrl.value)
    notes.value = res.notes ?? []
  } catch (e) {
    loadError.value = (e as { data?: { message?: string } }).data?.message || 'Could not load notes'
    notes.value = []
  } finally {
    loading.value = false
  }
}

function startEdit() {
  draft.value = ownNote.value?.content ?? ''
  saveError.value = null
  confirmDelete.value = false
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  draft.value = ''
  saveError.value = null
}

async function saveNote() {
  const content = draft.value.trim()
  if (!content || content.length > 2000 || saving.value) return
  saving.value = true
  saveError.value = null
  try {
    if (ownNote.value) {
      const res = await $fetch<{ note: SessionNoteItem }>(
        `${notesUrl.value}/${ownNote.value.id}`,
        { method: 'PATCH', body: { content } },
      )
      const idx = notes.value.findIndex((n) => n.id === ownNote.value?.id)
      if (idx >= 0) notes.value[idx] = { ...res.note, doctorName: ownNote.value.doctorName, isOwn: true }
    } else {
      const res = await $fetch<{ note: SessionNoteItem }>(
        notesUrl.value,
        { method: 'POST', body: { content } },
      )
      notes.value = [{ ...res.note, doctorName: '', isOwn: true }, ...notes.value]
    }
    editing.value = false
    draft.value = ''
  } catch (e) {
    saveError.value = (e as { data?: { message?: string } }).data?.message || 'Could not save note'
  } finally {
    saving.value = false
  }
}

async function deleteNote() {
  if (!ownNote.value || deleting.value) return
  deleting.value = true
  saveError.value = null
  try {
    await $fetch(`${notesUrl.value}/${ownNote.value.id}`, { method: 'DELETE' })
    notes.value = notes.value.filter((n) => n.id !== ownNote.value?.id)
    confirmDelete.value = false
    editing.value = false
  } catch (e) {
    saveError.value = (e as { data?: { message?: string } }).data?.message || 'Could not delete note'
  } finally {
    deleting.value = false
  }
}

function formatDate(value: string): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

onMounted(() => {
  void fetchNotes()
})
</script>

<template>
  <div class="space-y-3" :data-testid="`session-note-${bookingId}`">
    <p class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <StickyNote class="size-3.5" aria-hidden="true" />
      Session note
    </p>

    <!-- Loading state -->
    <div v-if="loading" class="grid gap-2" aria-label="Loading note">
      <Skeleton class="h-4 w-full rounded-md" />
      <Skeleton class="h-4 w-3/4 rounded-md" />
    </div>

    <!-- Error state -->
    <p v-else-if="loadError" class="text-xs text-destructive" role="alert">{{ loadError }}</p>

    <template v-else>
      <!-- Own note (read view) — own notes only exist on own sessions -->
      <div
        v-if="ownNote && !editing && isOwnSession"
        class="rounded-xl border border-border/70 bg-muted/20 p-3.5 text-sm"
        data-testid="own-note"
      >
        <p class="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{{ ownNote.content }}</p>
        <p class="mt-2 text-[11px] text-muted-foreground">
          Last updated {{ formatDate(ownNote.updatedAt || ownNote.createdAt) }}
        </p>
        <div v-if="isOwnSession" class="mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 text-xs"
            data-testid="edit-note"
            @click="startEdit"
          >
            <Pencil class="size-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button
            v-if="!confirmDelete"
            variant="ghost"
            size="sm"
            class="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
            data-testid="delete-note"
            @click="confirmDelete = true"
          >
            <Trash2 class="size-3.5" aria-hidden="true" />
            Delete
          </Button>
          <span v-else class="inline-flex items-center gap-2 text-xs">
            <span class="font-medium text-foreground">Delete this note?</span>
            <Button
              variant="destructive"
              size="sm"
              class="h-8 text-xs"
              :disabled="deleting"
              :data-testid="`confirm-delete-note-${ownNote.id}`"
              @click="deleteNote"
            >
              {{ deleting ? 'Deleting…' : 'Confirm' }}
            </Button>
            <Button variant="ghost" size="sm" class="h-8 text-xs" @click="confirmDelete = false">
              Keep
            </Button>
          </span>
        </div>
      </div>

      <!-- Own note (edit view) / new note -->
      <div v-if="isOwnSession && (editing || !ownNote)" class="space-y-2.5">
        <label class="sr-only" :for="`note-draft-${bookingId}`">Session note</label>
        <textarea
          :id="`note-draft-${bookingId}`"
          v-model="draft"
          rows="4"
          maxlength="2000"
          placeholder="Write a private note about this session…"
          class="min-h-24 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          :data-testid="`note-textarea-${bookingId}`"
        />
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] tabular-nums text-muted-foreground">{{ draft.trim().length }}/2000</span>
          <div class="flex items-center gap-2">
            <Button
              v-if="editing"
              variant="ghost"
              size="sm"
              class="h-8 text-xs"
              @click="cancelEdit"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              class="h-8 px-5 text-xs"
              :disabled="!draft.trim() || saving"
              :data-testid="`save-note-${bookingId}`"
              @click="saveNote"
            >
              {{ saving ? 'Saving…' : ownNote ? 'Update note' : 'Save note' }}
            </Button>
          </div>
        </div>
        <p v-if="saveError" class="text-xs text-destructive" role="alert">{{ saveError }}</p>
      </div>

      <!-- Empty state for own session -->
      <p v-if="isOwnSession && !ownNote && !editing" class="text-xs text-muted-foreground">
        No note yet — add one below.
      </p>

      <!-- Peer notes (read-only, visible on own and peer sessions alike) -->
      <div v-for="n in peerNotes" :key="n.id" class="rounded-xl border border-border/60 bg-muted/20 p-3.5" data-testid="peer-note">
        <p class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Eye class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          Note by Dr. {{ n.doctorName }}
        </p>
        <p class="mt-0.5 text-[11px] text-muted-foreground">{{ formatDate(n.createdAt) }}</p>
        <p class="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{{ n.content }}</p>
      </div>
    </template>
  </div>
</template>
