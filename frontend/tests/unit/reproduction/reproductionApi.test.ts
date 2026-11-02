import { describe, expect, it, vi } from 'vitest'
import { createReproductionApi } from '../../../src/features/reproduction/api/reproductionApi'
import { createReproductionDemoStore } from '../../../src/features/reproduction/data/reproductionDemoStore'
import { REPRODUCTION_DEMO } from '../../../src/features/reproduction/data/reproductionMock'
import type { BackendTransport } from '../../../src/api/backendTransport'

const transport: BackendTransport = {
  get: vi.fn(),
  command: vi.fn(),
  farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`),
}

// The lifecycle scenarios run past the demo day, so they bring their own clock.
const AFTER_LIFECYCLE = () => '2026-11-02T09:00'

describe('reproduction mock API boundary', () => {
  it('records breeding, pregnancy check and loss as a consistent local lifecycle', async () => {
    const store = createReproductionDemoStore(REPRODUCTION_DEMO, AFTER_LIFECYCLE)
    const api = createReproductionApi({ mode: 'local', farmId: 1, transport, store })

    const bred = await api.recordEvent('BC-000142', {
      type: 'BREEDING', occurredAt: '2026-10-21T09:00', method: 'NATURAL_SERVICE',
      sireSource: 'FARM', farmSireId: 'SIRE-001', performer: 'Nguyễn Văn An',
    }, 'MANAGER')
    expect(bred.status).toBe('BRED')
    const breeding = bred.events.find((event) => event.type === 'BREEDING')!

    const pregnant = await api.recordEvent('BC-000142', {
      type: 'PREGNANCY_CHECK', occurredAt: '2026-10-31T09:00', result: 'PREGNANT',
      method: 'ULTRASOUND', linkedBreedingId: breeding.id, examiner: 'BS. Minh',
    }, 'MANAGER')
    expect(pregnant.status).toBe('PREGNANT')
    expect(pregnant.openPregnancy?.linkedBreedingId).toBe(breeding.id)

    const lost = await api.recordEvent('BC-000142', {
      type: 'PREGNANCY_UPDATE', occurredAt: '2026-11-01T10:00', updateType: 'LOSS', details: 'Sảy thai',
    }, 'MANAGER')
    expect(lost.status).toBe('AWAITING_BREEDING')
    expect(lost.openPregnancy).toBeNull()
    expect(lost.events.find((event) => event.type === 'PREGNANCY_UPDATE')?.status).toBe('VALID')
  })

  it('records a calving and calf outcomes, then moves the dam to post-calving', async () => {
    const store = createReproductionDemoStore(REPRODUCTION_DEMO, AFTER_LIFECYCLE)
    const api = createReproductionApi({ mode: 'local', farmId: 1, transport, store })
    const before = await api.getProfile('BC-000087')

    const after = await api.recordCalving('BC-000087', {
      birthAt: '2026-10-21T08:00', pregnancyId: before.openPregnancy!.id,
      dataSource: 'DIRECT_OBSERVATION', attendant: 'Trần Long', course: 'NORMAL',
      damCondition: 'GOOD', retainedPlacenta: false,
      calves: [{
        outcome: 'LIVE', sex: 'FEMALE', weightKg: 27, weightBasis: 'MEASURED',
        earTag: 'VN-BV-0320', penId: 'pen-d', breed: 'Lai Sind', registration: 'DRAFT',
      }],
    }, 'MANAGER')

    expect(after.status).toBe('POST_CALVING')
    expect(after.openPregnancy).toBeNull()
    expect(after.parity).toBe(3)
    expect(after.calvings[0]?.calves[0]?.registrationStatus).toBe('PENDING_CONFIRMATION')

    const corrected = await api.correctCalving('BC-000087', after.calvings[0]!.id, { course: 'ASSISTED' }, 'Bổ sung diễn biến đẻ', 'MANAGER')
    expect(corrected.calvings[0]?.course).toBe('ASSISTED')
    expect(corrected.events.find((event) => event.id === after.calvings[0]!.id)?.corrected).toBe(true)
    const voided = await api.voidCalving('BC-000087', after.calvings[0]!.id, 'Ghi nhầm sự kiện', 'MANAGER')
    expect(voided.status).toBe('PREGNANT')
    expect(voided.parity).toBe(2)
    expect(voided.calvings[0]?.voidReason).toBe('Ghi nhầm sự kiện')
  })

  it('requires a correction reason and blocks voiding a breeding used by a later check', async () => {
    const store = createReproductionDemoStore(REPRODUCTION_DEMO, AFTER_LIFECYCLE)
    const api = createReproductionApi({ mode: 'local', farmId: 1, transport, store })
    const cow = await api.getProfile('BC-000061')
    const breeding = cow.events.find((event) => event.type === 'BREEDING')!

    await api.recordEvent('BC-000061', {
      type: 'PREGNANCY_CHECK', occurredAt: '2026-10-30T09:00', result: 'PREGNANT',
      method: 'ULTRASOUND', linkedBreedingId: breeding.id, examiner: 'BS. Minh',
    }, 'MANAGER')

    await expect(api.voidEvent('BC-000061', breeding.id, '', 'MANAGER'))
      .rejects.toThrow('Nhập lý do sửa hoặc hủy.')
    await expect(api.voidEvent('BC-000061', breeding.id, 'Ghi nhầm', 'MANAGER'))
      .rejects.toThrow('Không thể hủy vì đã có khám thai liên quan.')
  })

  it('updates a corrected pregnancy result and refuses to orphan a pregnancy with dependent events', async () => {
    const store = createReproductionDemoStore(REPRODUCTION_DEMO, AFTER_LIFECYCLE)
    const api = createReproductionApi({ mode: 'local', farmId: 1, transport, store })
    const cow = await api.getProfile('BC-000061')
    const breeding = cow.events.find((event) => event.type === 'BREEDING')!
    const pregnant = await api.recordEvent('BC-000061', {
      type: 'PREGNANCY_CHECK', occurredAt: '2026-10-30T09:00', result: 'PREGNANT',
      method: 'ULTRASOUND', linkedBreedingId: breeding.id, examiner: 'BS. Minh',
    }, 'MANAGER')
    const check = pregnant.events.find((event) => event.type === 'PREGNANCY_CHECK')!

    const corrected = await api.correctEvent('BC-000061', check.id, { result: 'NOT_PREGNANT' }, 'Đọc nhầm kết quả', 'MANAGER')
    expect(corrected.status).toBe('AWAITING_BREEDING')
    expect(corrected.openPregnancy).toBeNull()
    expect(corrected.events.find((event) => event.id === check.id)?.summary).toBe('Khám thai · Không có thai')
    expect(corrected.events.find((event) => event.id === check.id)?.expectedCalvingAt).toBeNull()

    const cowWithDependents = await api.getProfile('BC-000087')
    const activeCheck = cowWithDependents.events.find((event) => event.type === 'PREGNANCY_CHECK')!
    await expect(api.correctEvent('BC-000087', activeCheck.id, { result: 'NOT_PREGNANT' }, 'Sửa kết quả', 'MANAGER'))
      .rejects.toThrow('Không thể sửa kết quả khám thai vì đã có diễn biến hoặc sự kiện đẻ liên quan.')
  })

  it('rejects a corrected calving date in the future', async () => {
    const store = createReproductionDemoStore(REPRODUCTION_DEMO, AFTER_LIFECYCLE)
    const api = createReproductionApi({ mode: 'local', farmId: 1, transport, store })
    const calving = (await api.getProfile('BC-000087')).calvings[0]!

    await expect(api.correctCalving('BC-000087', calving.id, { birthAt: '2099-01-01T08:00' }, 'Sửa ngày', 'MANAGER'))
      .rejects.toThrow('Thời điểm đẻ không được ở tương lai.')
  })

  it('keeps a before/after revision when a manager corrects an event and enforces read-only roles', async () => {
    const store = createReproductionDemoStore(REPRODUCTION_DEMO, AFTER_LIFECYCLE)
    const api = createReproductionApi({ mode: 'local', farmId: 1, transport, store })
    const cow = await api.getProfile('BC-000142')
    const estrus = cow.events.find((event) => event.type === 'ESTRUS')!

    await expect(api.correctEvent('BC-000142', estrus.id, { details: 'Sửa dấu hiệu' }, '', 'MANAGER'))
      .rejects.toThrow('Nhập lý do sửa hoặc hủy.')
    await expect(api.voidEvent('BC-000142', estrus.id, 'Không chính xác', 'TECHNICIAN'))
      .rejects.toThrow('Chỉ Quản lý mới được ghi, sửa hoặc hủy sự kiện sinh sản.')

    const corrected = await api.correctEvent('BC-000142', estrus.id, { details: 'Đứng yên, dịch nhầy trong' }, 'Bổ sung dấu hiệu', 'MANAGER')
    expect(corrected.events.find((event) => event.id === estrus.id)?.corrected).toBe(true)
    expect(corrected.revisions[0]?.reason).toBe('Bổ sung dấu hiệu')
    expect(corrected.revisions[0]?.before).toMatchObject({ details: estrus.details })
  })

  it('never falls back to synthetic reproduction data in backend mode', async () => {
    const store = {
      list: vi.fn(async () => REPRODUCTION_DEMO),
      get: vi.fn(async () => REPRODUCTION_DEMO[0]),
      recordEvent: vi.fn(), recordCalving: vi.fn(), correctEvent: vi.fn(), voidEvent: vi.fn(),
      correctCalving: vi.fn(), voidCalving: vi.fn(), voidCalf: vi.fn(), reset: vi.fn(),
    }
    const api = createReproductionApi({ mode: 'backend', farmId: 1, transport, store })

    await expect(api.listWorklist()).rejects.toThrow('Chưa tích hợp dữ liệu sinh sản với backend.')
    expect(store.list).not.toHaveBeenCalled()
    expect(transport.get).not.toHaveBeenCalled()
    expect(transport.command).not.toHaveBeenCalled()
  })
})
