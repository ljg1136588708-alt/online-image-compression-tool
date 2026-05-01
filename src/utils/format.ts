export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '0 B'
  if (bytes < 0) return `-${formatBytes(-bytes)}`
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

