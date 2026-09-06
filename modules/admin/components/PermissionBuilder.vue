<script setup lang="ts">
export interface PermissionItem {
  resource: string
  action: string
}

const props = defineProps<{
  modelValue: PermissionItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PermissionItem[]]
}>()

const RESOURCES = ['APPOINTMENTS', 'PATIENTS', 'DOCTORS', 'PAYMENTS', 'SETTINGS', 'STAFF']
const ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE']

function has(resource: string, action: string): boolean {
  return props.modelValue.some((p) => p.resource === resource && p.action === action)
}

function toggle(resource: string, action: string, checked: boolean) {
  if (checked) {
    if (!has(resource, action)) {
      emit('update:modelValue', [...props.modelValue, { resource, action }])
    }
  } else {
    emit('update:modelValue', props.modelValue.filter((p) => !(p.resource === resource && p.action === action)))
  }
}

function summaryFor(resource: string): string {
  const actions = props.modelValue.filter((p) => p.resource === resource).map((p) => p.action)
  return actions.length > 0 ? actions.join(', ') : '—'
}
</script>

<template>
  <div class="grid gap-3" data-testid="permission-builder">
    <div
      v-for="resource in RESOURCES"
      :key="resource"
      class="rounded-xl border border-border p-3"
    >
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold text-foreground">{{ resource }}</p>
        <p class="text-xs text-muted-foreground" :data-testid="`perms-summary-${resource}`">{{ summaryFor(resource) }}</p>
      </div>
      <div class="mt-2 flex flex-wrap gap-3">
        <label
          v-for="action in ACTIONS"
          :key="`${resource}-${action}`"
          class="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
          :title="action === 'UPDATE' ? 'UPDATE works best together with READ' : undefined"
        >
          <input
            type="checkbox"
            :checked="has(resource, action)"
            :data-testid="`perm-${resource}-${action}`"
            class="size-4 accent-pink-600"
            @change="toggle(resource, action, ($event.target as HTMLInputElement).checked)"
          />
          {{ action }}
        </label>
      </div>
    </div>
  </div>
</template>
