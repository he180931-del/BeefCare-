import { describe, expect, it } from 'vitest'
import { useExitComposition } from '../../../src/features/herd-exit/hooks/useExitComposition'

describe('useExitComposition', () => {
  it('composes warning rows from backend checks', () => {
    const result = useExitComposition({ checks: { voucherId: 1, code: 'PX-1', version: 2, exitDate: '2026-11-21', occupancy: [], cattle: [{ cattleId: 1, cattleCode: 'BC-1', penId: 2, penCode: 'A2', hasWarnings: true, messages: [{ code: 'WARN', text: 'Cân thiếu' }] }] }, checksError: null, checking: false, displayError: () => 'error' })
    expect(result.checksReady).toBe(true)
    expect(result.warningCount).toBe(1)
    expect(result.checkRows[1]).toEqual(['BC-1', 'Cân thiếu', true])
  })

  it('composes pending/error status when checks are unavailable', () => {
    expect(useExitComposition({ checks: null, checksError: new Error('offline'), checking: false, displayError: () => 'mất mạng' }).checkRows[0][1]).toBe('Không tải được kiểm tra: mất mạng')
    expect(useExitComposition({ checks: null, checksError: null, checking: true, displayError: () => 'error' }).checkRows[0][1]).toBe('Đang tải kết quả kiểm tra…')
  })
})
