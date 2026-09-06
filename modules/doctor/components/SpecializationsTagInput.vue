<script setup lang="ts">
const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const input = ref('')

function addTag() {
  const tag = input.value.trim()
  if (!tag) return
  if (!props.modelValue.includes(tag)) {
    emit('update:modelValue', [...props.modelValue, tag])
  }
  input.value = ''
}

function removeTag(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addTag()
  }
}
</script>

<template>
  <div>
    <div class="flex gap-2">
      <Input
        v-model="input"
        type="text"
        placeholder="Add a specialization and press Enter"
        data-testid="specializations-input"
        @keydown="onKeydown"
      />
      <Button type="button" variant="outline" data-testid="specializations-add" @click="addTag">
        Add
      </Button>
    </div>
    <div v-if="modelValue.length > 0" class="mt-2 flex flex-wrap gap-2">
      <Badge
        v-for="(tag, i) in modelValue"
        :key="`${tag}-${i}`"
        variant="secondary"
        class="inline-flex items-center gap-1"
        :data-testid="`specialization-chip-${i}`"
      >
        {{ tag }}
        <button
          type="button"
          class="ml-1 inline-flex size-4 items-center justify-center rounded-full text-xs hover:bg-muted"
          :aria-label="`Remove ${tag}`"
          :data-testid="`specialization-remove-${i}`"
          @click="removeTag(i)"
        >
          ×
        </button>
      </Badge>
    </div>
  </div>
</template>
