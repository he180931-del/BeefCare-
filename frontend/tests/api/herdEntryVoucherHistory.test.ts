import assert from 'node:assert/strict'
import test from 'node:test'
import { formatEntryHistoryItem } from '../../src/features/herd-entry/domain/entryVoucherHistory'
import { mapVoucher } from '../../src/features/herd-entry/api/herdEntryMapper'

const at = '2026-11-22T01:30:00Z' // 08:30 UTC+7
const line = (kind: string, details: Record<string, unknown> = {}) => formatEntryHistoryItem({ at, kind, actor: 'Chủ trại', details })

test('SCR-75 history renders every audit kind as Vietnamese with UTC+7 time and actor', () => {
  assert.equal(line('ENTRY_DRAFT_CREATE', { code: 'PN-1', type: 'PURCHASE' }), '22/11/2026 08:30 · Chủ trại · Tạo phiếu nháp')
  assert.equal(line('ENTRY_DRAFT_UPDATE', { lines: 3 }), '22/11/2026 08:30 · Chủ trại · Sửa phiếu nháp (3 con)')
  assert.equal(line('ENTRY_IMPORT', { rows: 5, added: 4, errors: 1 }), '22/11/2026 08:30 · Chủ trại · Nhập Excel: thêm 4/5 dòng')
  assert.equal(line('ENTRY_POST', { count: 2, cattle: ['BC-1', 'BC-2'] }), '22/11/2026 08:30 · Chủ trại · Ghi sổ, tạo 2 con: BC-1, BC-2')
  assert.equal(line('ENTRY_VOID', { reason: 'Ghi nhầm nguồn' }), '22/11/2026 08:30 · Chủ trại · Hủy phiếu · Ghi nhầm nguồn')
  assert.equal(line('PAYMENT_RECORDED', { amount: 5000000, method: 'BANK_TRANSFER', date: '2026-11-21' }), '22/11/2026 08:30 · Chủ trại · Ghi thanh toán 5.000.000 đ (Chuyển khoản) ngày 21/11/2026')
  assert.equal(line('PAYMENT_RECORDED', { amount: 1000, method: 'CASH', date: '2026-11-21' }), '22/11/2026 08:30 · Chủ trại · Ghi thanh toán 1.000 đ (Tiền mặt) ngày 21/11/2026')
  assert.equal(line('PAYMENT_VOIDED', { amount: 1000, reason: 'Nhập nhầm' }), '22/11/2026 08:30 · Chủ trại · Hủy thanh toán 1.000 đ · Nhập nhầm')
  assert.equal(line('ENTRY_LINE_CORRECT', { cattle: 'BC-1', reason: 'Sửa cân' }), '22/11/2026 08:30 · Chủ trại · Sửa bản ghi nhập BC-1 · Sửa cân')
})

test('an unknown history kind never prints its raw code', () => {
  const text = line('ENTRY_SOMETHING_NEW')
  assert.equal(text, '22/11/2026 08:30 · Chủ trại · Thao tác khác')
  assert.doesNotMatch(text, /ENTRY_/)
  assert.equal(formatEntryHistoryItem({ kind: 'ENTRY_DRAFT_CREATE' }), 'Tạo phiếu nháp')
})

test('mapVoucher keeps the SCR-23 row and SCR-75 actor fields', () => {
  const row = mapVoucher({ id: 5, code: 'PN-2026-0005', entryType: 'FARM_BORN', status: 'VOIDED', entryDate: '2026-11-01', damCodes: ['BC-10', 'BC-11'],
    estimatedWeightCount: 2, voidReason: 'Ghi nhầm', quarantineCertNo: 'KD-5', createdBy: 'A', createdAt: '2026-11-01T01:00:00Z', postedBy: 'B',
    postedAt: '2026-11-01T02:00:00Z', voidedBy: 'C', voidedAt: '2026-11-02T03:00:00Z',
    lines: [{ id: 1, status: 'VALID', cattleCode: 'BC-20', currentHerdStatus: 'EXITED', currentPenCode: 'A1' }] })
  assert.deepEqual(row.damCodes, ['BC-10', 'BC-11'])
  assert.equal(row.estimatedWeightCount, 2)
  assert.equal(row.cancelReason, 'Ghi nhầm')
  assert.equal(row.quarantine, 'KD-5')
  assert.deepEqual([row.createdBy, row.createdAt, row.postedBy, row.postedAt, row.voidedBy, row.voidedAt], ['A', '2026-11-01T01:00:00Z', 'B', '2026-11-01T02:00:00Z', 'C', '2026-11-02T03:00:00Z'])
  assert.equal(row.detail?.cows?.[0].herdStatus, 'EXITED')
})
