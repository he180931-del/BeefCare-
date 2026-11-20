import { useCallback, useRef } from 'react'

interface HeldKey { signature: string; key: string }

const PREFIX = 'beefcare.requestKey.'

/** Dấu vân tay ngắn (cyrb53) của dữ liệu form: chỉ để so "cùng dữ liệu hay không", không lưu dữ liệu gốc. */
function fingerprint(value: unknown): string {
  const text = JSON.stringify(value) ?? ''
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

function read(storageKey: string): HeldKey | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Partial<HeldKey> | null
    return value && typeof value.signature === 'string' && typeof value.key === 'string' ? { signature: value.signature, key: value.key } : null
  } catch { return null }
}
function write(storageKey: string, value: HeldKey | null) {
  try {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value))
    else sessionStorage.removeItem(storageKey)
  } catch { /* chế độ riêng tư / bị chặn: chỉ giữ trong bộ nhớ */ }
}

/**
 * Khóa yêu cầu (`Idempotency-Key`) cho một lần gửi form (GBR-88, R-02-02).
 * - Cùng dữ liệu → cùng khóa, kể cả khi bấm lại sau lỗi mạng hoặc tải lại trang (giữ trong sessionStorage của tab).
 * - Đổi dữ liệu → khóa mới (máy chủ từ chối dùng lại khóa cho dữ liệu khác).
 * - `clear()` sau khi gửi thành công, để lần đăng ký sau là một yêu cầu mới.
 */
export function useRequestKey(scope: string) {
  const storageKey = PREFIX + scope
  const held = useRef<HeldKey | null>(null)
  const keyFor = useCallback((payload: unknown) => {
    const signature = fingerprint(payload)
    const current = held.current ?? read(storageKey)
    if (current && current.signature === signature) {
      held.current = current
      return current.key
    }
    const next = { signature, key: globalThis.crypto.randomUUID() }
    held.current = next
    write(storageKey, next)
    return next.key
  }, [storageKey])
  const clear = useCallback(() => {
    held.current = null
    write(storageKey, null)
  }, [storageKey])
  return { keyFor, clear }
}
