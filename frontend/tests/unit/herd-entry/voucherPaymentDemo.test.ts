import { expect, it } from 'vitest'
import { entryPaymentVoidEnabled, voidEntryPayment } from '../../../src/features/herd-entry/api'
import { exitPaymentVoidEnabled, voidExitPayment } from '../../../src/features/herd-exit/api'

it('hides payment void capabilities and explicitly rejects commands in demo mode', async () => {
  expect(entryPaymentVoidEnabled).toBe(false); expect(exitPaymentVoidEnabled).toBe(false)
  await expect(voidEntryPayment(1, { reason: 'Nhầm', version: 0 })).rejects.toThrow('Chế độ demo chưa hỗ trợ hủy thanh toán')
  await expect(voidExitPayment(1, { reason: 'Nhầm', version: 0 })).rejects.toThrow('Chế độ demo chưa hỗ trợ hủy thanh toán')
})
