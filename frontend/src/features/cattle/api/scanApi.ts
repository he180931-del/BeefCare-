import { backendMode } from '../../../api/backendTransport'
import { listCows, loadProfile } from './cattleApi'
import type { CowSeed } from '../../../data/cowsData'

export type ScanResult = { cow: CowSeed; replacedTag?: string } | null

/**
 * Tra bò theo mã hiển thị, số thẻ tai hoặc mã thẻ QR (UC-FE05-05).
 * GET /api/farms/{farmId}/cattle/resolve?code=
 */
export async function resolveCattle(input: string): Promise<ScanResult> {
  const key = input.trim()
  if (!key) return null
  if (backendMode === 'backend') {
    try {
      return { cow: (await loadProfile(key)).cow }
    } catch {
      return null
    }
  }
  const needle = key.toLowerCase()
  const cows = await listCows()
  for (const cow of cows) {
    const history = cow.qrHistory ?? []
    const tagRow = history.find((t) => t.code.toLowerCase() === needle)
    if (tagRow) return { cow, replacedTag: tagRow.status === 'REPLACED' ? tagRow.code : undefined }
    if ([cow.code, cow.tag, cow.qr].some((v) => v && v.toLowerCase() === needle)) return { cow }
  }
  return null
}
