<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    variant?: 'icon' | 'text'
    size?: 'sm' | 'default'
    showLabel?: boolean
  }>(),
  {
    variant: 'icon',
    size: 'default',
    showLabel: false,
  },
)

const { isDark, toggleTheme, theme } = useTheme()

const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})
</script>

<template>
  <button
    type="button"
    class="relative inline-flex items-center justify-center rounded-2xl border border-border/70 bg-card/60 p-2 text-foreground/80 backdrop-blur-sm transition-all duration-200 hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
    :class="[
      props.size === 'sm' ? 'h-9 w-9' : 'h-10 w-10',
      props.showLabel ? 'w-auto px-3 gap-2' : '',
    ]"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    data-testid="theme-toggle"
    @click="toggleTheme"
  >
    <div class="relative flex items-center justify-center">
      <!-- Sun icon (shown in dark mode to switch to light, or vice versa) -->
      <Sun
        class="transition-all duration-300"
        :class="[
          props.size === 'sm' ? 'size-4' : 'size-5',
          isMounted && isDark
            ? 'scale-100 rotate-0 text-amber-400 opacity-100'
            : 'absolute -rotate-90 scale-0 opacity-0 text-muted-foreground',
        ]"
      />
      <!-- Moon icon -->
      <Moon
        class="transition-all duration-300"
        :class="[
          props.size === 'sm' ? 'size-4' : 'size-5',
          !isMounted || !isDark
            ? 'scale-100 rotate-0 text-primary opacity-100'
            : 'absolute rotate-90 scale-0 opacity-0 text-muted-foreground',
        ]"
      />
    </div>

    <span v-if="props.showLabel" class="text-xs font-medium">
      {{ isDark ? 'Light' : 'Dark' }}
    </span>
  </button>
</template>
