import { expect, it, vi } from 'vitest'
vi.mock('../../../src/shared/config/runtime', async original => ({ ...(await original<typeof import('../../../src/shared/config/runtime')>()), backendMode: 'local' }))
import { correctEntryLine, entryLineCorrectionEnabled, entryVoidCheck, voidEntryLine } from '../../../src/features/herd-entry/api'

it('does not simulate line correction, void-check or void in demo mode', async () => {
  expect(entryLineCorrectionEnabled).toBe(false)
  await expect(entryVoidCheck(91)).rejects.toThrow('Chế độ demo chưa hỗ trợ sửa / hủy bản ghi nhập')
  await expect(voidEntryLine(91, { reason: 'Lý do', expectedVersion: 0 })).rejects.toThrow('Chế độ demo chưa hỗ trợ sửa / hủy bản ghi nhập')
  await expect(correctEntryLine(91, { reason: 'Lý do', expectedVersion: 0, voucherVersion: 3, changes: {} })).rejects.toThrow('Chế độ demo chưa hỗ trợ sửa / hủy bản ghi nhập')
})
