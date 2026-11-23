import type { ExitStatus } from '../types'

export function exitCattleStatus(current: string | undefined, voucherStatus: ExitStatus): 'ACTIVE' | 'EXITED' | null {
  if (current === 'ACTIVE' || current === 'EXITED') return current
  if ((current === undefined || current === '') && voucherStatus === 'Đã xuất') return 'EXITED'
  return null
}
