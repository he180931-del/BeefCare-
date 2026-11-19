import { backendMode } from '../../../api/backendTransport'

// Mock mode stays on the day the frames and seed describe, so day counts and breeding windows do not drift.
const DEMO_NOW = '2026-10-20T15:00'

/** Local date-time as yyyy-mm-ddTHH:mm. */
export function reproductionNow(): string {
  if (backendMode !== 'backend') return DEMO_NOW
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
