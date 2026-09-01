export function getServerRuntimeConfig(): ReturnType<typeof useRuntimeConfig> | null {
  return typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : null
}