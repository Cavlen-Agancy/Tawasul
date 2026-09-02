import type { Component } from 'vue'

export interface ToastData {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  component?: Component
  props?: Record<string, unknown>
}

export type ToastToCreate = Omit<ToastData, 'id'>

const state = reactive<{ toasts: ToastData[] }>({
  toasts: [] as ToastData[],
})

const timeouts = new Map<string, number>()
let counter = 0

function dismiss(id: string) {
  const idx = state.toasts.findIndex((t: ToastData) => t.id === id)
  if (idx !== -1) {
    state.toasts.splice(idx, 1)
  }
  const timeout = timeouts.get(id)
  if (timeout) {
    window.clearTimeout(timeout)
    timeouts.delete(id)
  }
}

function toast(toastInput: ToastToCreate) {
  const id = `toast-${++counter}`
  const item: ToastData = { ...toastInput, id }
  state.toasts.push(item)

  if (toastInput.props?.duration !== 0) {
    const timeout = window.setTimeout(() => dismiss(id), 4000)
    timeouts.set(id, timeout)
  }
  return id
}

toast.dismiss = dismiss

export function useToast() {
  return {
    toast,
    dismiss,
    toasts: computed(() => state.toasts),
  }
}
