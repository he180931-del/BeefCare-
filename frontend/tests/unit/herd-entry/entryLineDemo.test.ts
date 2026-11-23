import { expect, it, vi } from 'vitest'
vi.mock('../../../src/shared/config/runtime', async original => ({ ...(await original<typeof import('../../../src/shared/config/runtime')>()), backendMode: 'local' }))
import { correctEntryHistoryDemo, correctEntryLine, entryHistoryDemoEnabled, entryLineCorrectionEnabled, entryVoidCheck, herdEntryApi, voidEntryLine } from '../../../src/features/herd-entry/api'

it('does not simulate line correction, void-check or void in demo mode', async () => {
  expect(entryLineCorrectionEnabled).toBe(false)
  await expect(entryVoidCheck(91)).rejects.toThrow('Chế độ demo chưa hỗ trợ sửa / hủy bản ghi nhập')
  await expect(voidEntryLine(91, { reason: 'Lý do', expectedVersion: 0 })).rejects.toThrow('Chế độ demo chưa hỗ trợ sửa / hủy bản ghi nhập')
  await expect(correctEntryLine(91, { reason: 'Lý do', expectedVersion: 0, voucherVersion: 3, changes: {} })).rejects.toThrow('Chế độ demo chưa hỗ trợ sửa / hủy bản ghi nhập')
})

it('persists an explicit demo history edit on the matching voucher line without simulating backend commands', async () => {
  expect(entryHistoryDemoEnabled).toBe(true)
  const original = await herdEntryApi.get('PN-2026-0011')
  try {
    const history = { vaccine: 'Không rõ', disease: 'Có', diseaseNote: 'Đã khỏi trước nhập', repro: 'Không rõ' }
    await correctEntryHistoryDemo(original.id, 'BC-000248', history, 'Bổ sung thông tin')
    const saved = await herdEntryApi.get(original.id)
    expect(saved.detail?.cows?.find(line => line.code === 'BC-000248')?.hist).toEqual(history)
    expect(saved.detail?.history?.at(-1)).toContain('Bổ sung thông tin')
    await expect(correctEntryHistoryDemo(original.id, 'BC-000248', history, ' ')).rejects.toThrow('lý do')
  } finally {
    await herdEntryApi.update(original.id, { detail: original.detail })
  }
})
