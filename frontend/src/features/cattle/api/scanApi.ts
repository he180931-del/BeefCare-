import { backendMode } from '../../../api/backendTransport'
import { BackendError } from '../../../api/backendClient'
import { listCows, resolveScannedCode } from './cattleApi'
import type { CowSeed } from '../../../data/cowsData'

/**
 * Outcome of a scan or a manual code (UC-FE05-05, R-05-14, R-05-15):
 * - found: the cattle card; `replaced` when the scanned tag was REPLACED (MSG-FE05-05);
 * - otherFarm: the cattle belongs to another farm the user may open (MSG-FE05-06) — no cattle data is returned;
 * - rejected: unknown code, VietQR, a farm the user cannot access (MSG-FE05-09) or a draft calf (MSG-FE05-10).
 */
export type ScanOutcome =
  | { kind: 'found'; cow: CowSeed; replaced?: { scannedTag: string; currentTag: string | null; date: string | null } }
  | { kind: 'otherFarm'; farmId: number | null }
  | { kind: 'rejected'; code: 'MSG-FE05-09' | 'MSG-FE05-10' }

const dateLabel = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : null)

/** GET /api/farms/{farmId}/cattle/resolve?code= — display code, ear tag or tag code (or an app link to the tag). */
export async function scanCode(input: string): Promise<ScanOutcome | null> {
  const key = input.trim()
  if (!key) return null
  if (backendMode === 'backend') {
    try {
      const result = await resolveScannedCode(key)
      if (result.switchFarmRequired) return { kind: 'otherFarm', farmId: result.farmId }
      if (!result.cattle) return { kind: 'rejected', code: 'MSG-FE05-09' }
      return {
        kind: 'found',
        cow: result.cattle,
        ...(result.replacedTag ? { replaced: { scannedTag: key, currentTag: result.currentTagCode, date: dateLabel(result.replacedAt) } } : {}),
      }
    } catch (error) {
      if (error instanceof BackendError && error.code === 'MSG-FE05-10') return { kind: 'rejected', code: 'MSG-FE05-10' }
      return { kind: 'rejected', code: 'MSG-FE05-09' }
    }
  }
  const needle = key.toLowerCase()
  const cows = await listCows()
  for (const cow of cows) {
    const history = cow.qrHistory ?? []
    const tagRow = history.find((t) => t.code.toLowerCase() === needle)
    if (tagRow) {
      const current = history.find((t) => t.status === 'ACTIVE')?.code ?? null
      return { kind: 'found', cow, ...(tagRow.status === 'REPLACED' ? { replaced: { scannedTag: tagRow.code, currentTag: current, date: tagRow.to } } : {}) }
    }
    if ([cow.code, cow.tag, cow.qr].some((v) => v && v.toLowerCase() === needle)) return { kind: 'found', cow }
  }
  return { kind: 'rejected', code: 'MSG-FE05-09' }
}
