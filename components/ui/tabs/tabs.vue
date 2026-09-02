<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

const props = withDefaults(
  defineProps<{
    defaultValue?: string
    modelValue?: string
    class?: HTMLAttributes['class']
  }>(),
  { defaultValue: '', modelValue: undefined, class: undefined },
)

const active = ref<string>(props.modelValue ?? props.defaultValue)
provide('tabs:active', active)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

watch(
  () => props.modelValue,
  (v) => {
    if (v !== undefined) active.value = v
  },
)

function setActive(value: string) {
  active.value = value
  emit('update:modelValue', value)
}

provide('tabs:setActive', setActive)
</script>

<template>
  <div :class="props.class">
    <slot :active="active" />
  </div>
</template>
