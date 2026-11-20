/**
 * UC-FE01-02 AF2 / UC-FE03-04 AF3 (D28): an invitation link opened while signed out must survive Google sign-in and
 * e-mail verification, which come back through the backend to another page (often in another tab). Only the internal
 * SCR-15 path is kept, in this browser, for 24 hours, and it is removed as soon as it is read. The token alone grants
 * nothing: SCR-15 still requires the signed-in, verified invited e-mail (GBR-17).
 */
const KEY = 'beefcare.pendingInvitation'
export const INVITATION_PATH = '/invitation/accept'
const TTL_MS = 24 * 60 * 60 * 1000

interface Pending { path: string; savedAt: number }

const isInvitationLink = (path: string) => {
  const url = new URL(path, 'http://beefcare.invalid')
  return url.pathname === INVITATION_PATH && (url.searchParams.get('token') ?? '').length > 0 && path.startsWith(INVITATION_PATH)
}

export function rememberInvitationLink(path: string, now = Date.now()): void {
  if (!isInvitationLink(path)) return
  try { localStorage.setItem(KEY, JSON.stringify({ path, savedAt: now } satisfies Pending)) } catch { /* storage blocked: the e-mail link still works */ }
}

/** Returns the remembered link once (then forgets it); null when absent, stale, malformed or already the current page. */
export function takeInvitationLink(currentPath: string, now = Date.now()): string | null {
  let saved: Partial<Pending> | null = null
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Pending> | null
    localStorage.removeItem(KEY)
  } catch { return null }
  if (!saved || typeof saved.path !== 'string' || typeof saved.savedAt !== 'number') return null
  if (now - saved.savedAt > TTL_MS || saved.savedAt > now || !isInvitationLink(saved.path)) return null
  return saved.path === currentPath ? null : saved.path
}
