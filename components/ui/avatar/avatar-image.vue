<script setup lang="ts">
import { ref } from 'vue'
import { cn } from '~/lib/utils'

const props = withDefaults(
  defineProps<{
    src?: string
    alt?: string
    class?: string
  }>(),
  {
    src: undefined,
    alt: '',
    class: undefined,
  },
)

const failed = ref(false)
</script>

<template>
  <img
    v-if="props.src && !failed"
    :src="props.src"
    :alt="props.alt"
    :class="cn('aspect-square h-full w-full rounded-full object-cover', props.class)"
    @error="failed = true"
  >
  <slot v-else />
</template>
