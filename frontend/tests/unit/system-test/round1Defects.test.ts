import { describe, expect, it } from 'vitest'
import { BackendError } from '../../../src/shared/api/backendClient'
import { cattleError } from '../../../src/features/cattle/api/cattleError'
import { mapTimeline } from '../../../src/features/cattle/api/cattleTimeline'
import { fieldErrorsOf } from '../../../src/features/farm-catalogue/api/catalogueApi'
import { mapChecks, mapVoucher } from '../../../src/features/herd-exit/api/herdExitMapper'

// Regression tests for the defects found in Report 5.3 System Test Round 1 (DEF-ST-xx).
describe('System test Round 1 defects', () => {
  it('DEF-ST-01: a 400 bean-validation error on the code is shown under Mã giống', () => {
    const error = new BackendError(400, { errorKey: 'error.validation', fieldErrors: [{ objectName: 'breedRequest', field: 'code', message: 'size must be between 2 and 20' }] })
    expect(fieldErrorsOf(error, 'Mã giống')?.fields).toEqual({ code: 'Mã giống gồm 2–20 ký tự: chữ in hoa, số và "-".' })
  })

  it('DEF-ST-05: a re-issued QR code already used in the farm shows MSG-FE12-08', () => {
    const error = new BackendError(422, { code: 'MSG-FE12-08', params: { tag_code: 'QR-1801-000003' } })
    expect(cattleError(error, 'fallback')).toBe('Mã thẻ QR-1801-000003 đã được dùng trong trại.')
  })

  it('DEF-ST-07 / DEF-ST-13: a pen event shows the warning reason and Vietnamese labels', () => {
    const pen = mapTimeline({ category: 'PEN', type: 'PEN_ASSIGNMENT', sourceId: 3, occurredAt: '2026-11-28T00:00:00+07:00', status: 'VALID', values: { penCode: 'ST-A', toDate: null, reason: 'Tạm gửi', warningReason: 'Chuồng đực đang sửa' } }, 0)
    expect(pen.detail).toBe('đang ở · Lý do: Tạm gửi · Lý do cảnh báo: Chuồng đực đang sửa')
    const correction = mapTimeline({ category: 'PEN', type: 'PEN_ASSIGNMENT', sourceId: 4, occurredAt: '2026-11-28T00:00:00+07:00', status: 'VALID', values: { penCode: 'ST-B', reason: 'Correction' } }, 1)
    expect(correction.detail).toContain('Lý do: Sửa nhầm (chuyển ngược)')
    const growth = mapTimeline({ category: 'GROWTH', type: 'GROWTH_ASSESSMENT', sourceId: 5, occurredAt: '2026-11-28T00:00:00+07:00', status: 'VALID', values: { weightKg: 325, method: 'SCALE' } }, 2)
    expect(growth.detail).toBe('Phương pháp cân điện tử')
  })

  it('DEF-ST-16: a MISSING loss stored as OTHER is titled "Mất tích" on the timeline', () => {
    const exit = mapTimeline({ category: 'ENTRY_EXIT', type: 'HERD_EXIT', sourceId: 6, occurredAt: '2026-11-28T00:00:00+07:00', status: 'CONFIRMED', values: { exitType: 'OTHER', lossKind: 'MISSING', date: '2026-11-28' } }, 3)
    expect(exit.title).toBe('Xuất đàn – Mất tích')
  })

  it('DEF-ST-11: saved exit lines keep the withdrawal end and show the life-stage label; check texts use dd/mm/yyyy', () => {
    const mapped = mapVoucher({
      id: 61, code: 'PX-2026-0001', exitType: 'SALE', status: 'DRAFT', exitDate: '2026-11-28', pricingBasis: 'PER_KG', version: 2,
      lines: [{ id: 1, cattleId: 4, cattleCode: 'BC-000004', lifeStage: 'ADULT', exitWeightKg: 420, check: { withdrawal: { endDate: '2026-12-19', breach: true } } }],
    }, [], '/api/farms/1/exit-vouchers', 61)
    const cow = (mapped.draft?.cows ?? mapped.detail?.cows ?? [])[0] as Record<string, unknown>
    expect(cow).toMatchObject({ stage: 'Bò trưởng thành', withdrawalUntil: '2026-12-19' })
    const checks = mapChecks({ voucherId: 61, code: 'PX-2026-0001', cattle: [{ cattleId: 4, cattleCode: 'BC-000004', hasWarnings: true, messages: [{ code: 'MSG-FE13-07', text: 'BC-000004 đang ngưng giết mổ đến 2026-12-19.' }] }] })
    expect(checks.cattle[0]?.messages[0]?.text).toBe('BC-000004 đang ngưng giết mổ đến 19/12/2026.')
  })
})
