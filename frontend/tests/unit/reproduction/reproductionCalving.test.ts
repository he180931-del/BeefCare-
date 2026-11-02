import { describe, expect, it, vi } from 'vitest'
import { createReproductionApi } from '../../../src/features/reproduction/api/reproductionApi'
import { createReproductionDemoStore } from '../../../src/features/reproduction/data/reproductionDemoStore'
import { REPRODUCTION_DEMO } from '../../../src/features/reproduction/data/reproductionMock'
import { ReproductionValidationError } from '../../../src/features/reproduction/domain/reproductionRules'
import type { BackendTransport } from '../../../src/api/backendTransport'
import type { CalvingCommand } from '../../../src/features/reproduction/types'

const transport: BackendTransport = { get: vi.fn(), command: vi.fn(), farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`) }
const setup = () => createReproductionApi({ mode: 'local', farmId: 1, transport, store: createReproductionDemoStore(REPRODUCTION_DEMO) })
const calving = (calves: CalvingCommand['calves']): CalvingCommand => ({
  birthAt: '2026-10-20T04:20', pregnancyId: 'preg-087-3', dataSource: 'DIRECT_OBSERVATION', attendant: 'Trần Quốc Long',
  course: 'NORMAL', damCondition: 'GOOD', retainedPlacenta: false, calves,
})
const registered = { outcome: 'LIVE', sex: 'MALE', weightKg: 24, weightBasis: 'MEASURED', penId: 'pen-d', penCode: 'D', breed: 'Lai Sind', registration: 'REGISTER_NOW', productionPurpose: 'UNDECIDED' } as const
const draft = { outcome: 'LIVE', sex: 'FEMALE', weightKg: 19, weightBasis: 'ESTIMATED', penId: 'pen-d', penCode: 'D', breed: 'Lai Sind', registration: 'DRAFT' } as const

describe('calving through the mock API', () => {
  it('rejects a tag already used in the farm with the owner and keeps the profile unchanged', async () => {
    const api = setup()
    const error = await api.recordCalving('BC-000087', calving([{ ...registered, earTag: 'QR-6701-0001' }]), 'MANAGER').catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(ReproductionValidationError)
    expect((error as ReproductionValidationError).issues).toEqual([{ calf: 0, field: 'earTag', message: 'Mã QR-6701-0001 đã dùng cho bò BC-000112' }])
    const profile = await api.getProfile('BC-000087')
    expect(profile.status).toBe('PREGNANT')
    expect(profile.calvings).toHaveLength(2)
  })

  it('saves two calves, closes the pregnancy and shows the calves on the profile and timeline', async () => {
    const api = setup()
    const after = await api.recordCalving('BC-000087', calving([{ ...registered, earTag: 'QR-6701-0249' }, draft]), 'MANAGER')
    expect(after.status).toBe('POST_CALVING')
    expect(after.openPregnancy).toBeNull()
    expect(after.parity).toBe(3)
    expect(after.calvings[0]?.calves.map((calf) => calf.registrationStatus)).toEqual(['REGISTERED', 'PENDING_CONFIRMATION'])
    expect(after.events.find((event) => event.id === after.calvings[0]!.id)?.details).toBe('2 bê: Sống · Đực · 24 kg · QR-6701-0249; Sống · Cái · 19 kg')
    const again = await api.recordCalving('BC-000061', { ...calving([{ ...registered, earTag: 'qr-6701-0249' }]), pregnancyId: null }, 'MANAGER').catch((cause: unknown) => cause)
    expect((again as ReproductionValidationError).issues[0]?.message).toContain('Mã qr-6701-0249 đã dùng cho')
  })

  it('voids a draft calf but not a registered one and never the last calf', async () => {
    const api = setup()
    const after = await api.recordCalving('BC-000087', calving([{ ...registered, earTag: 'QR-6701-0249' }, draft]), 'MANAGER')
    const record = after.calvings[0]!
    await expect(api.voidCalf('BC-000087', record.id, record.calves[0]!.id, 'Ghi nhầm', 'MANAGER')).rejects.toThrow('đã đăng ký')
    const voided = await api.voidCalf('BC-000087', record.id, record.calves[1]!.id, 'Ghi nhầm bê nháp', 'MANAGER')
    expect(voided.calvings[0]?.calves[1]?.status).toBe('VOIDED')
    expect(voided.events.find((event) => event.id === record.id)?.details).toBe('1 bê: Sống · Đực · 24 kg · QR-6701-0249')
    expect(voided.revisions[0]?.reason).toBe('Ghi nhầm bê nháp')
    const single = await api.recordCalving('BC-000061', { ...calving([draft]), pregnancyId: null }, 'MANAGER')
    await expect(api.voidCalf('BC-000061', single.calvings[0]!.id, single.calvings[0]!.calves[0]!.id, 'Ghi nhầm', 'MANAGER')).rejects.toThrow('hủy cả sự kiện đẻ')
  })

  it('rebuilds the breeding timeline line after a correction of sire and semen', async () => {
    const api = setup()
    const breeding = (await api.getProfile('BC-000061')).events.find((event) => event.type === 'BREEDING')!
    const corrected = await api.correctEvent('BC-000061', breeding.id, { sireLabel: 'Brahman đỏ', semenCode: 'BRD-204' }, 'Nhập nhầm mã tinh', 'MANAGER')
    expect(corrected.events.find((event) => event.id === breeding.id)?.details).toBe('Thụ tinh nhân tạo · Brahman đỏ BRD-204 · Nguyễn Văn Tâm')
  })

  it('words the worklist next action from status and eligibility', async () => {
    const rows = await setup().listWorklist()
    const action = (code: string) => rows.find((row) => row.cattleCode === code)?.nextAction
    expect(action('BC-000142')).toBe('Xem xét phối giống')
    expect(action('BC-000188')).toBe('Theo dõi cân nặng')
    expect(action('BC-000061')).toBe('Kiểm tra có thai')
    expect(action('BC-000087')).toBe('Chuẩn bị chuồng đẻ')
  })
})
