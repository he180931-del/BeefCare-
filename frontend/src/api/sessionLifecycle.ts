export const SESSION_EXPIRED_EVENT = 'beefcare:session-expired'
export const SESSION_SIGNED_OUT_EVENT = 'beefcare:session-signed-out'

export function notifySessionExpired(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

export function onSessionExpired(listener: () => void): () => void {
  window.addEventListener(SESSION_EXPIRED_EVENT, listener)
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
}

export function notifySessionSignedOut(): void {
  window.dispatchEvent(new Event(SESSION_SIGNED_OUT_EVENT))
}

export function onSessionSignedOut(listener: () => void): () => void {
  window.addEventListener(SESSION_SIGNED_OUT_EVENT, listener)
  return () => window.removeEventListener(SESSION_SIGNED_OUT_EVENT, listener)
}
