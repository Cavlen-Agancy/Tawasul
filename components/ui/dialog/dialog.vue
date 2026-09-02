<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open?: boolean
    defaultOpen?: boolean
  }>(),
  { open: undefined, defaultOpen: false },
)

const internalOpen = ref(props.defaultOpen)
const isOpen = computed(() => (props.open !== undefined ? props.open : internalOpen.value))

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

function close() {
  if (props.open === undefined) internalOpen.value = false
  emit('update:open', false)
}

provide('dialog:close', close)
provide('dialog:open', isOpen)
</script>

<template>
  <slot :open="isOpen" :close="close" />
</template>
