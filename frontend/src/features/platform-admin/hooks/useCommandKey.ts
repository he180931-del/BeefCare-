import { useCallback, useRef } from 'react'

/**
 * Idempotency-Key của một hộp thoại SCR-16 (GBR-88, D32, D33): cùng dữ liệu → cùng khóa (bấm lặp, thử lại sau lỗi lưu /
 * mạng); đổi dữ liệu → khóa mới (máy chủ từ chối dùng lại khóa cho dữ liệu khác). `clear()` sau khi xong hoặc bị từ chối.
 */
export function useCommandKey() {
  const held = useRef<{ signature: string; key: string } | null>(null)
  const keyFor = useCallback((payload: unknown) => {
    const signature = JSON.stringify(payload)
    if (held.current?.signature !== signature) held.current = { signature, key: globalThis.crypto.randomUUID() }
    return held.current.key
  }, [])
  const clear = useCallback(() => { held.current = null }, [])
  return { keyFor, clear }
}
