/**
 * Technical signal raised by the HTTP client when the backend answers 401. `app/session/sessionLifecycle` re-exports it
 * and the auth provider listens to it; the transport itself never decides what happens next.
 */
export const SESSION_EXPIRED_EVENT = 'beefcare:session-expired'

export function notifySessionExpired(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

export function onSessionExpired(listener: () => void): () => void {
  window.addEventListener(SESSION_EXPIRED_EVENT, listener)
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
}
