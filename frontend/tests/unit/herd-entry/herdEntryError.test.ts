import { expect, it } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import { herdEntryError } from '../../../src/features/herd-entry/api/herdEntryError'
it('maps entry codes and delegates transport errors', () => { expect(herdEntryError(new BackendError(422, { code: 'MSG-FE06-13', params: { amount: 10 } }), 'fallback')).toContain('10'); expect(herdEntryError(new BackendError(503), 'fallback')).toContain('Máy chủ') })

it.each([
  [409, 'MSG-FE06-02', 'Bê đã được đăng ký thành BC-001.'],
  [422, 'MSG-FE06-04', 'Bê chết khi sinh không được đăng ký.'],
  [409, 'MSG-COM-05', 'Dữ liệu đã thay đổi. Vui lòng tải lại.'],
])('preserves the server explanation for calf status error %s/%s', (status, code, message) => {
  expect(herdEntryError(new BackendError(status, { code, message }))).toBe(message)
})

it.each([
  ['BIRTH_DATE_AFTER_ENTRY_DATE', 'ngày sinh không được sau ngày nhập'],
  ['ENTRY_DATE_BEFORE_BIRTH_DATE', 'ngày nhập mới trước ngày sinh'],
  ['EVENT_BEFORE_ENTRY_DATE', 'ngày nhập mới sau sự kiện đã ghi'],
  ['PAYMENT_BEFORE_ENTRY_DATE', 'đã có thanh toán ngày'],
  ['ENTRY_DATE_AFTER_FIRST_PLACEMENT_END', 'ngày nhập mới sau ngày kết thúc lần xếp chuồng đầu'],
  ['SEX_CHANGE_WITH_REPRODUCTIVE_EVENTS', 'bò đã có sự kiện sinh sản'],
  ['FARM_BORN_DATA_COMES_FROM_THE_CALVING', 'dữ liệu bê sinh tại trại lấy từ lần đẻ'],
])('explains correction reason %s in Vietnamese', (reason, message) => {
  const text = herdEntryError(new BackendError(422, { code: 'MSG-FE06-07', params: { reason, date: '2026-11-01', cattle_code: 'BC-001' } }))
  expect(text).toMatch(/^Không thể sửa:/)
  expect(text).toContain(message)
  if (reason === 'EVENT_BEFORE_ENTRY_DATE' || reason === 'PAYMENT_BEFORE_ENTRY_DATE') expect(text).toContain('01/11/2026')
  if (reason === 'EVENT_BEFORE_ENTRY_DATE') expect(text).toContain('BC-001')
})

it('keeps the server message for an unknown correction reason', () => {
  expect(herdEntryError(new BackendError(422, { code: 'MSG-FE06-07', params: { reason: 'NEW_REASON' }, message: 'Lý do mới do server giải thích.' }))).toBe('Lý do mới do server giải thích.')
})

it.each(['Cân ngày 01/11', ['Cân ngày 01/11', 'Tiêm ngày 02/11']])('explains events that block voiding a line', events => {
  const text = herdEntryError(new BackendError(422, { code: 'MSG-FE06-09', params: { cattle_code: 'BC-001', events } }))
  expect(text).toContain('Không thể hủy vì BC-001 đã có sự kiện được ghi: Cân ngày 01/11')
})

it('directs the last valid line to whole-voucher voiding only for VOID_VOUCHER', () => {
  expect(herdEntryError(new BackendError(422, { code: 'MSG-FE06-20', params: { action: 'VOID_VOUCHER' } }))).toBe('Đây là con cuối cùng còn hiệu lực của phiếu. Hãy dùng Hủy phiếu.')
  expect(herdEntryError(new BackendError(422, { code: 'MSG-FE06-20', params: {} }))).not.toContain('con cuối cùng')
})
it('explains backend event codes in Vietnamese while retaining already-readable labels', () => {
  expect(herdEntryError(new BackendError(422, { code: 'MSG-FE06-09', params: { cattle_code: 'BC-1', events: 'WEIGHT, PEN_MOVE' } }))).toContain('Cân nặng, Chuyển chuồng')
})
