import { describe, expect, it } from 'vitest'
import { mapHistory, mapVoucher } from '../../../src/features/herd-exit/api/herdExitMapper'

describe('exit voucher history (SCR-76 #7)', () => {
  it('renders backend history events in Vietnamese from type + data, not the English text', () => {
    const history = mapHistory([
      { time: '2026-11-25T13:41:00Z', type: 'CREATED', actor: 'An', text: 'Voucher created', data: {} },
      { time: '2026-11-25T13:41:00Z', type: 'CONFIRMED', actor: 'An', text: 'Voucher confirmed', data: {} },
      { time: '2026-11-25T13:41:00Z', type: 'ITEMS_CANCELLED', actor: 'system', text: 'Doses and reminders cancelled by the exit', data: { doses: 1, reminders: 2 } },
      { time: '2026-11-25T13:45:00Z', type: 'COLLECTION_RECORDED', actor: 'An', text: 'Collection recorded', data: { amount: 5000000, method: 'CASH' } },
      { time: '2026-11-25T13:46:00Z', type: 'COLLECTION_VOIDED', actor: null, text: 'Collection voided', data: { amount: 5000000, method: 'CASH', reason: 'Ghi nhầm' } },
      { time: '2026-11-25T13:50:00Z', type: 'VOIDED', actor: 'An', text: 'Voucher voided', data: { reason: 'Kiểm thử' } },
      { time: '2026-11-25T13:50:00Z', type: 'FUTURE_EVENT', actor: 'An', text: 'Something new', data: {} },
    ])
    expect(history.map((h) => [h.actor, h.text])).toEqual([
      ['An', 'Tạo phiếu'],
      ['An', 'Xác nhận xuất đàn'],
      ['Hệ thống', 'Hủy 1 mũi tiêm và 2 nhắc việc sau ngày xuất'],
      ['An', 'Ghi thu 5.000.000 đ (Tiền mặt)'],
      ['', 'Hủy khoản thu 5.000.000 đ – lý do: Ghi nhầm'],
      ['An', 'Hủy phiếu – lý do: Kiểm thử'],
      ['An', 'Something new'],
    ])
  })

  it('keeps destination and note apart on an Other draft', () => {
    const row = mapVoucher({ id: 1, code: 'PX-1', status: 'DRAFT', exitType: 'OTHER', exitDate: '2026-11-25', destination: 'Trại bạn', note: 'Nuôi hộ', lines: [] })
    expect(row.draft).toMatchObject({ destination: 'Trại bạn', note: 'Nuôi hộ' })
    expect(row.detail?.note).toBe('Nuôi hộ')
    expect(row.who).toBe('Trại bạn')
  })
})
