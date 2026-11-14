import { describe, expect, it, vi } from 'vitest'
import { createHealthApi } from '../../../src/features/health/api/healthApi'
import { createHealthDemoStore } from '../../../src/features/health/data/healthDemoStore'
import { HealthValidationError } from '../../../src/features/health/domain/healthRules'
import type { StatusCommand, TreatmentCommand } from '../../../src/features/health/types'

const NOW = '2026-10-20T08:00'

function setup() {
  const store = createHealthDemoStore()
  const transport = { get: vi.fn(), command: vi.fn(), farmPath: vi.fn() }
  const api = createHealthApi({ mode: 'local', farmId: 1, transport, store })
  return { store, transport, api }
}

const treatment = (over: Partial<TreatmentCommand> = {}): TreatmentCommand => ({
  medicineId: 3, treatmentTime: '2026-10-20T07:30', dose: '20 ml', route: 'INTRAMUSCULAR', courseDays: 1, withdrawalDays: 15, performer: 'Trần Quốc Long', veterinaryAdvice: '', ...over,
})
const status = (over: Partial<StatusCommand>): StatusCommand => ({ action: 'KEEP', progressText: '', diagnosis: '', suspectedContagious: false, confirmedBy: 'Trần Quốc Long', ...over })

async function rejection(promise: Promise<unknown>) {
  try { await promise } catch (e) { return e as Error }
  throw new Error('expected rejection')
}

describe('danh sách ca sức khỏe', () => {
  it('tab Đang mở hiện mọi ca chưa đóng, kỳ chỉ lọc ca đã đóng', async () => {
    const { api } = setup()
    const open = await api.listCases({ tab: 'open', from: '2026-10-19', to: '2026-10-20' })
    expect(open.rows.map((r) => r.caseCode)).toEqual(['HC-0418', 'HC-0417', 'HC-0416', 'HC-0415', 'HC-0412', 'HC-0409', 'HC-0405'])
    expect(open.counts).toEqual({ open: 7, chronic: 2, closed: 11, all: 20 })
    const closed = await api.listCases({ tab: 'closed', from: '2026-09-20', to: '2026-10-20' })
    expect(closed.rows).toHaveLength(7)
    expect(closed.rows.every((r) => r.status === 'CLOSED')).toBe(true)
  })

  it('lọc theo mức độ, chuồng, từ khóa và sắp theo mã ca', async () => {
    const { api } = setup()
    expect((await api.listCases({ tab: 'open', severity: 'SEVERE' })).rows.map((r) => r.caseCode)).toEqual(['HC-0417'])
    expect((await api.listCases({ tab: 'open', penCode: 'B1' })).rows.map((r) => r.caseCode)).toEqual(['HC-0412'])
    expect((await api.listCases({ tab: 'all', search: 'bc-000203', from: '2000-01-01', to: '2030-01-01' })).rows.map((r) => r.caseCode).sort()).toEqual(['HC-0207', 'HC-0331', 'HC-0412'])
    const asc = await api.listCases({ tab: 'open', sort: 'caseCode', dir: 'asc' })
    expect(asc.rows[0].caseCode).toBe('HC-0405')
  })
})

describe('hồ sơ sức khỏe của bò', () => {
  it('BC-000203: đang điều trị, ngưng thịt đến 10/11, dòng thời gian mới nhất trước', async () => {
    const { api } = setup()
    const p = await api.getProfile('BC-000203')
    expect(p.healthState).toBe('UNDER_TREATMENT')
    expect(p.withdrawalEndDate).toBe('2026-11-10')
    expect(p.activeCases).toHaveLength(1)
    expect(p.activeCases[0]).toMatchObject({ caseCode: 'HC-0412', treatmentCount: 2, day: 8, withdrawalEndDate: '2026-11-10' })
    expect(p.previousCases.map((c) => c.caseCode)).toEqual(['HC-0331', 'HC-0207'])
    const current = p.timeline.filter((r) => r.caseCode === 'HC-0412')
    expect(current.map((r) => r.type)).toEqual(['FOLLOW_UP', 'TREATMENT', 'TREATMENT', 'OPENING'])
    expect(current[2].details).toBe('Oxytetracycline 20% LA · 30 ml · tiêm bắp · ngưng 28 ngày')
  })

  it('bò chưa có ca nào là khỏe mạnh', async () => {
    const { api } = setup()
    const p = await api.getProfile('BC-000999')
    expect(p.healthState).toBe('HEALTHY')
    expect(p.activeCases).toEqual([])
  })
})

describe('mở ca và ghi theo dõi', () => {
  it('kiểm tra thân nhiệt, dấu hiệu, mức độ và thời điểm tương lai', async () => {
    const { api } = setup()
    const e = await rejection(api.openCase('BC-000231', { observedAt: '2026-10-21T08:00', observer: 'Trần Quốc Long', temperatureC: 44, signs: '', diagnosis: '', suspectedContagious: false, severity: '' }))
    expect(e).toBeInstanceOf(HealthValidationError)
    const errors = (e as HealthValidationError).errors
    expect(errors.temperatureC).toBe('Thân nhiệt phải trong khoảng 35,0 – 43,0 °C.')
    expect(errors.signs).toBe('Dấu hiệu / mô tả là bắt buộc.')
    expect(errors.severity).toBe('Mức độ là bắt buộc.')
    expect(errors.observedAt).toBe('Thời điểm không được ở tương lai.')
  })

  it('mở ca mới có mã HC-nnnn, đặt trạng thái Theo dõi; nối vào ca đang có không tạo ca mới', async () => {
    const { api } = setup()
    const opened = await api.openCase('BC-000125', { observedAt: '2026-10-20T06:50', observer: 'Trần Quốc Long', temperatureC: 39.6, signs: 'Ho, chảy nước mũi', diagnosis: 'Viêm phổi', suspectedContagious: false, severity: 'MILD' })
    expect(opened).toMatchObject({ caseCode: 'HC-0419', kind: 'OPENED', status: 'OPEN', healthState: 'MONITORING' })
    const added = await api.openCase('BC-000125', { existingCaseId: opened.id, expectedVersion: opened.version, observedAt: '2026-10-20T07:30', observer: 'Trần Quốc Long', temperatureC: null, signs: 'Bú kém', diagnosis: '', suspectedContagious: false, severity: 'MODERATE' })
    expect(added).toMatchObject({ caseCode: 'HC-0419', kind: 'ADDED' })
    expect((await api.getProfile('BC-000125')).activeCases.map((c) => c.caseCode).sort()).toEqual(['HC-0398', 'HC-0419'])
  })

  it('theo dõi không được trước lúc mở ca và bị chặn khi phiên bản đã đổi', async () => {
    const { api } = setup()
    const card = (await api.getProfile('BC-000203')).activeCases[0]
    const base = { observedAt: '2026-10-20T07:10', temperatureC: 38.5, progress: 'IMPROVED' as const, description: 'Ăn uống bình thường' }
    const early = await rejection(api.recordFollowUp(card.id, { ...base, expectedVersion: card.version, observedAt: '2026-10-12T07:00' }))
    expect((early as HealthValidationError).errors.observedAt).toContain('13/10/2026 07:00')
    const stale = await rejection(api.recordFollowUp(card.id, { ...base, expectedVersion: card.version + 5 }))
    expect(stale.message).toContain('tải lại')
    await api.recordFollowUp(card.id, { ...base, expectedVersion: card.version })
    expect((await api.getProfile('BC-000203')).timeline[0]).toMatchObject({ type: 'FOLLOW_UP', details: 'Ăn uống bình thường · 38,5°C' })
  })
})

describe('điều trị và ngưng sử dụng thịt', () => {
  it('ca mạn tính trở về OPEN, hết ngưng = ngày dùng cuối + số ngày ngưng', async () => {
    const { api } = setup()
    const card = (await api.getProfile('BC-000125')).activeCases[0]
    expect(card.status).toBe('CHRONIC')
    const r = await api.recordTreatment(card.id, treatment({ expectedVersion: card.version, courseDays: 3, withdrawalDays: 15 }))
    expect(r).toMatchObject({ caseStatus: 'OPEN', returnedToOpen: true, withdrawalEndDate: '2026-11-06', healthState: 'UNDER_TREATMENT' })
  })

  it('từ chối thuốc ngưng sử dụng, liệu trình ngoài 1-30 ngày và thời điểm trước lúc mở ca', async () => {
    const { api } = setup()
    const card = (await api.getProfile('BC-000203')).activeCases[0]
    const inactive = await rejection(api.recordTreatment(card.id, treatment({ medicineId: 7 })))
    expect((inactive as HealthValidationError).errors.medicineId).toBe('Enrofloxacin 10% đã ngưng sử dụng, không thể chọn cho bản ghi mới.')
    const bad = await rejection(api.recordTreatment(card.id, treatment({ courseDays: 31, treatmentTime: '2026-10-10T07:00' })))
    const errors = (bad as HealthValidationError).errors
    expect(errors.courseDays).toContain('1 đến 30')
    expect(errors.treatmentTime).toContain('13/10/2026 07:00')
  })
})

describe('đóng ca', () => {
  it('chuyển sang mạn tính rồi về OPEN', async () => {
    const { api } = setup()
    const card = (await api.getProfile('BC-000203')).activeCases[0]
    const chronic = await api.updateStatus(card.id, status({ expectedVersion: card.version, action: 'TO_CHRONIC' }))
    expect(chronic).toMatchObject({ status: 'CHRONIC', kind: 'CHRONIC', healthState: 'MONITORING' })
    const reopened = await api.updateStatus(card.id, status({ expectedVersion: chronic.version, action: 'TO_OPEN' }))
    expect(reopened).toMatchObject({ status: 'OPEN', kind: 'REOPENED', healthState: 'UNDER_TREATMENT' })
  })

  it('thời điểm đóng không được trước lần ghi gần nhất; đóng Khỏi rồi không ghi thêm được', async () => {
    const { api } = setup()
    const card = (await api.getProfile('BC-000203')).activeCases[0]
    const early = await rejection(api.updateStatus(card.id, status({ expectedVersion: card.version, action: 'CLOSE', outcome: 'RECOVERED', closedAt: '2026-10-18T07:00' })))
    expect((early as HealthValidationError).errors.closedAt).toContain('18/10/2026 07:10')
    const missing = await rejection(api.updateStatus(card.id, status({ expectedVersion: card.version, action: 'CLOSE', closedAt: NOW })))
    expect((missing as HealthValidationError).errors.outcome).toBe('Kết quả là bắt buộc.')
    const closed = await api.updateStatus(card.id, status({ expectedVersion: card.version, action: 'CLOSE', outcome: 'RECOVERED', closedAt: NOW }))
    expect(closed).toMatchObject({ status: 'CLOSED', outcome: 'RECOVERED', healthState: 'HEALTHY', deathVoucher: null })
    await rejection(api.recordFollowUp(card.id, { observedAt: NOW, temperatureC: null, progress: 'IMPROVED', description: 'x' }))
  })

  it('đóng Chết tạo phiếu xuất chờ, bò vẫn ACTIVE nhưng không nhận sự kiện mới; vẫn sửa được bản ghi cũ', async () => {
    const { api } = setup()
    const profile = await api.getProfile('BC-000203')
    const card = profile.activeCases[0]
    const r = await api.updateStatus(card.id, status({ expectedVersion: card.version, action: 'CLOSE', outcome: 'DIED', closedAt: NOW, progressText: 'Bỏ ăn hoàn toàn, nằm liệt' }))
    expect(r.deathVoucher).toMatchObject({ type: 'DEATH', status: 'PENDING', cattleCode: 'BC-000203', caseCode: 'HC-0412' })
    expect(await api.listPendingExits()).toHaveLength(1)
    const after = await api.getProfile('BC-000203')
    expect(after.cattle.status).toBe('ACTIVE')
    expect(after.pendingExit).not.toBeNull()
    const blocked = await rejection(api.openCase('BC-000203', { observedAt: NOW, observer: 'Trần Quốc Long', temperatureC: null, signs: 'x', diagnosis: '', suspectedContagious: false, severity: 'MILD' }))
    expect(blocked.message).toContain('chờ xác nhận chết / mất')
    const row = profile.timeline.find((t) => t.type === 'TREATMENT')!
    await api.correctEntry(row.id, { expectedVersion: row.version, reason: 'Sửa liều', dose: '25 ml' })
  })

  it('mất tích tạo phiếu OTHER với lý do Mất tích', async () => {
    const { api } = setup()
    const card = (await api.getProfile('BC-000017')).activeCases[0]
    const r = await api.updateStatus(card.id, status({ expectedVersion: card.version, action: 'CLOSE', outcome: 'MISSING', closedAt: NOW }))
    expect(r.deathVoucher).toMatchObject({ type: 'OTHER', reason: 'Mất tích' })
  })
})

describe('sửa và hủy bản ghi', () => {
  it('sửa liệu trình tính lại ngưng thịt, giữ lý do và đánh dấu Đã sửa', async () => {
    const { api } = setup()
    const row = (await api.getProfile('BC-000203')).timeline.find((t) => t.medicineName === 'Oxytetracycline 20% LA')!
    const noReason = await rejection(api.correctEntry(row.id, { expectedVersion: row.version, reason: ' ', courseDays: 5 }))
    expect((noReason as HealthValidationError).errors.reason).toBe('Lý do là bắt buộc.')
    const r = await api.correctEntry(row.id, { expectedVersion: row.version, reason: 'Liệu trình thực tế 5 ngày', courseDays: 5 })
    expect(r).toMatchObject({ action: 'CORRECTED', withdrawalBefore: '2026-11-10', withdrawalAfter: '2026-11-14' })
    const after = (await api.getProfile('BC-000203')).timeline.find((t) => t.id === row.id)!
    expect(after).toMatchObject({ corrected: true, status: 'VALID', courseDays: 5 })
  })

  it('không hủy được lần ghi mở ca; hủy hết điều trị thì còn Theo dõi và hết ngưng', async () => {
    const { api } = setup()
    const timeline = (await api.getProfile('BC-000203')).timeline
    const opening = timeline.find((t) => t.type === 'OPENING' && t.caseCode === 'HC-0412')!
    const e = await rejection(api.voidEntry(opening.id, { reason: 'Nhầm' }))
    expect(e.message).toBe('Lần ghi mở ca không thể hủy. Hãy sửa lại, hoặc đóng ca kèm lý do.')
    for (const t of timeline.filter((x) => x.type === 'TREATMENT')) await api.voidEntry(t.id, { expectedVersion: t.version, reason: 'Ghi nhầm' })
    const p = await api.getProfile('BC-000203')
    expect(p).toMatchObject({ healthState: 'MONITORING', withdrawalEndDate: null })
    expect(p.timeline.filter((t) => t.status === 'VOIDED')).toHaveLength(2)
  })
})

describe('chế độ backend', () => {
  it('chỉ gọi API qua transport, không đụng vào store (adapter chi tiết: tests/api/healthBackendApi.test.ts)', async () => {
    const { store, transport } = setup()
    const spy = vi.spyOn(store, 'listCases')
    transport.farmPath.mockImplementation((farmId: string | number, suffix = '') => `/api/farms/${farmId}${suffix}`)
    transport.get.mockImplementation(async (path: string) => {
      if (path.endsWith('/context')) return { id: 1, timeZone: 'Asia/Ho_Chi_Minh' }
      if (path.endsWith('/pens')) return []
      return { items: [], total: 0, page: 0, size: 200, counts: { open: 0, chronic: 0, closed: 0, all: 0 } }
    })
    const api = createHealthApi({ mode: 'backend', farmId: 1, transport, store })
    expect((await api.listCases()).rows).toEqual([])
    expect(spy).not.toHaveBeenCalled()
    expect(transport.get).toHaveBeenCalledWith('/api/farms/1/health-cases?tab=OPEN&page=0&size=200')
    expect(transport.command).not.toHaveBeenCalled()
  })
})
