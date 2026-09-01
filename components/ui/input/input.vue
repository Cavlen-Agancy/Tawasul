<script setup lang="ts">
import type { InputHTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    type?: string
    placeholder?: string
    name?: string
    autocomplete?: string
    error?: boolean
    class?: InputHTMLAttributes['class']
  }>(),
  {
    type: 'text',
    placeholder: '',
    name: undefined,
    autocomplete: undefined,
    error: false,
  },
)
</script>

<template>
  <input
    v-model="model"
    :type="props.type"
    :name="props.name"
    :placeholder="props.placeholder"
    :autocomplete="props.autocomplete"
    :class="cn(
      'h-12 w-full rounded-xl border-[1.5px] bg-[#FAFAFA] px-4 text-base text-foreground transition-all duration-150 ease-out',
      'placeholder:text-muted-foreground placeholder:text-sm',
      'focus:border-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FCE4F3]',
      'disabled:cursor-not-allowed disabled:border-border disabled:bg-[#F5F5F5] disabled:text-[#888888]',
      props.error ? 'border-destructive bg-[#FEF2F2]' : 'border-input',
      props.class,
    )"
  >
</template>