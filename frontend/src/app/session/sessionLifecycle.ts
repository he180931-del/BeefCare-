// Session lifecycle events of the whole app. The 401 signal is raised by the shared HTTP client, so it lives in
// `shared/api/sessionExpiry` and is re-exported here; sign-out is an app-level event.
export { SESSION_EXPIRED_EVENT, notifySessionExpired, onSessionExpired } from '../../shared/api/sessionExpiry'

export const SESSION_SIGNED_OUT_EVENT = 'beefcare:session-signed-out'

export function notifySessionSignedOut(): void {
  window.dispatchEvent(new Event(SESSION_SIGNED_OUT_EVENT))
}

export function onSessionSignedOut(listener: () => void): () => void {
  window.addEventListener(SESSION_SIGNED_OUT_EVENT, listener)
  return () => window.removeEventListener(SESSION_SIGNED_OUT_EVENT, listener)
}
