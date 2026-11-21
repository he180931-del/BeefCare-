import { describe, expect, it } from 'vitest'
import { canCancelExit } from '../../../src/features/herd-exit/hooks/useExitDetail'
import type { HerdExit } from '../../../src/features/herd-exit/types'

const record: HerdExit = { id: 'PX-1', status: 'Đã xuất', type: 'Bán', count: 1 }
const detail = { cows: [{ code: 'BC-1' }] }

describe('useExitDetail selectors', () => {
  it('allows cancellation only when the server or every cattle link is valid', () => {
    expect(canCancelExit(record, detail, { serverChecked: true })).toBe(true)
    expect(canCancelExit(record, detail, { serverChecked: false, cattle: [{ code: 'BC-1', exitVoucherId: 'PX-1' }] })).toBe(true)
    expect(canCancelExit(record, detail, { serverChecked: false, cattle: [{ code: 'BC-2', exitVoucherId: 'PX-1' }] })).toBe(false)
  })

  it('denies cancellation for non-confirmed or empty details', () => {
    expect(canCancelExit({ ...record, status: 'Nháp' }, detail, { serverChecked: true })).toBe(false)
    expect(canCancelExit(record, {}, { serverChecked: true })).toBe(false)
    expect(canCancelExit(record, detail)).toBe(false)
  })
})
