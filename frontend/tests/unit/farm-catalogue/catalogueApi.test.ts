import { describe, expect, it, vi } from 'vitest'
import { createCatalogueApi } from '../../../src/features/farm-catalogue/api/catalogueApi'
import { createCatalogueDemoStore } from '../../../src/features/farm-catalogue/data/catalogueDemoStore'
import { FieldErrors } from '../../../src/features/farm-catalogue/domain/catalogueRules'
import { DEFAULT_PARAMETERS } from '../../../src/features/farm-catalogue/domain/parameterRules'
import type { BreedCommand, ParameterVersionCommand, PurposeCommand, VaccineCommand } from '../../../src/features/farm-catalogue/types'

const TODAY = '2026-10-20'
function setup() {
  const transport = { get: vi.fn(), command: vi.fn(), farmPath: vi.fn() }
  const store = createCatalogueDemoStore(undefined, { today: () => TODAY })
  return { store, transport, api: createCatalogueApi({ mode: 'local', farmId: 1, transport, store }) }
}
const fieldsOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(FieldErrors)
  return (error as FieldErrors).fields
}
const breed = (over: Partial<BreedCommand> = {}): BreedCommand => ({ code: 'NEW-1', name: 'Giống mới', group: 'Zebu', description: '', available: true, ...over })
const vaccine = (over: Partial<VaccineCommand> = {}): VaccineCommand => ({
  code: 'NEW-V', name: 'Vắc-xin mới', diseasePrevented: 'Bệnh X', manufacturer: '', dose: '2 ml', route: 'INTRAMUSCULAR', boosterInterval: 180, withdrawalDays: 0, available: true, ...over,
})
const params = (over: Partial<ParameterVersionCommand['parameters']> = {}, meta: Partial<ParameterVersionCommand> = {}): ParameterVersionCommand => ({
  parameters: { ...DEFAULT_PARAMETERS, targetFinishingWeightKg: 380, ...over }, gestationLengthDays: 283, effectiveFrom: TODAY, sourceNote: 'Phỏng vấn chủ trại 20/10/2026', ...meta,
})

describe('catalogue api: breeds', () => {
  it('filters by text (accent-insensitive) and by status', async () => {
    const { api } = setup()
    expect((await api.listBreeds()).length).toBe(6)
    expect((await api.listBreeds({ q: 'brahman' })).map((b) => b.code)).toEqual(['BRAHMAN-DO'])
    expect((await api.listBreeds({ q: 'viet nam' })).map((b) => b.code)).toEqual(['VANG-VN'])
    expect((await api.listBreeds({ status: 'INACTIVE' })).map((b) => b.code)).toEqual(['VANG-VN'])
  })

  it('creates a breed, rejects duplicate and badly formed codes', async () => {
    const { api } = setup()
    const created = await api.saveBreed(null, breed())
    expect(created).toMatchObject({ code: 'NEW-1', activeCattle: 0, referenced: false, version: 1 })
    expect((await fieldsOf(api.saveBreed(null, breed({ code: 'ZEB-DO' })))).code).toBe('Mã ZEB-DO đã tồn tại trong danh mục này.')
    expect((await fieldsOf(api.saveBreed(null, breed({ code: 'abc' })))).code).toMatch(/2–20 ký tự/)
    expect((await fieldsOf(api.saveBreed(null, breed({ name: ' ' })))).name).toBe('Tên giống là bắt buộc.')
  })

  it('locks the code of a referenced breed but allows deactivating it, never deleting', async () => {
    const { api } = setup()
    const [zebu] = await api.listBreeds({ q: 'ZEB-DO' })
    expect((await fieldsOf(api.saveBreed(zebu!.id, breed({ code: 'ZEB-2' })))).code).toMatch(/Không sửa được mã/)
    const saved = await api.saveBreed(zebu!.id, breed({ code: 'ZEB-DO', name: zebu!.name, available: false, expectedVersion: zebu!.version }))
    expect(saved).toMatchObject({ available: false, version: 2, activeCattle: 142 })
    expect((await api.listBreeds()).length).toBe(6)
  })

  it('reports a stale version as a conflict', async () => {
    const { api } = setup()
    const [zebu] = await api.listBreeds({ q: 'ZEB-DO' })
    await api.saveBreed(zebu!.id, breed({ code: 'ZEB-DO', name: 'Zebu đỏ 2', expectedVersion: zebu!.version }))
    await expect(api.saveBreed(zebu!.id, breed({ code: 'ZEB-DO', name: 'Zebu đỏ 3', expectedVersion: zebu!.version }))).rejects.toThrow(/đã được thay đổi/)
  })
})

describe('catalogue api: vaccines, medicines and purposes', () => {
  it('deletes only a vaccine that was never used', async () => {
    const { api } = setup()
    const all = await api.listVaccines()
    const used = all.find((v) => v.code === 'AFT-O')!
    const unused = all.find((v) => v.code === 'ANTH-1')!
    await expect(api.deleteVaccine(used)).rejects.toThrow(/đã được dùng/)
    await api.deleteVaccine(unused)
    expect((await api.listVaccines()).some((v) => v.code === 'ANTH-1')).toBe(false)
  })

  it('checks vaccine and medicine ranges', async () => {
    const { api } = setup()
    expect((await fieldsOf(api.saveVaccine(null, vaccine({ boosterInterval: 800 })))).boosterInterval).toBe('Nhắc lại sau phải nằm trong khoảng 0 đến 730.')
    expect((await fieldsOf(api.saveVaccine(null, vaccine({ withdrawalDays: 400, diseasePrevented: '' })))).diseasePrevented).toBe('Phòng bệnh là bắt buộc.')
    const med = { code: 'NEW-M', name: 'Thuốc mới', description: '', dose: '', route: '' as const, withdrawalDays: null, available: true }
    expect((await fieldsOf(api.saveMedicine(null, med))).withdrawalDays).toBe('Ngưng sử dụng thịt là bắt buộc.')
    expect(await api.saveMedicine(null, { ...med, withdrawalDays: 0 })).toMatchObject({ code: 'NEW-M', withdrawalDays: 0 })
  })

  it('fixes the purpose type once the purpose is referenced', async () => {
    const { api } = setup()
    const all = await api.listPurposes()
    const breed = all.find((p) => p.code === 'BREED')!
    const free = all.find((p) => p.code === 'SALE-Y')!
    const cmd = (p: typeof breed, purposeType: PurposeCommand['purposeType']): PurposeCommand => ({ code: p.code, name: p.name, purposeType, description: '', available: true })
    expect((await fieldsOf(api.savePurpose(breed.id, cmd(breed, 'FATTENING')))).purposeType).toBe('Không đổi được loại mục đích vì mục đích này đang được dùng bởi 90 bò hoặc tiêu chí chuồng.')
    expect(await api.savePurpose(free.id, cmd(free, 'FATTENING'))).toMatchObject({ purposeType: 'FATTENING' })
  })
})

describe('catalogue api: parameters', () => {
  it('lists three versions with v3 current and derived change lines', async () => {
    const { api } = setup()
    const versions = await api.listParameterVersions()
    expect(versions.map((v) => [v.versionNo, v.status])).toEqual([[3, 'CURRENT'], [2, 'PAST'], [1, 'PAST']])
    expect(versions.map((v) => v.changes)).toEqual(['Cân tối thiểu phối 220 → 230 kg', 'Cân xuất mục tiêu 450 → 380 kg', 'Khởi tạo theo giá trị mặc định'])
  })

  it('validates ranges, ordering, source note and the effective date', async () => {
    const { api } = setup()
    const bad = await fieldsOf(api.saveParameterVersion(params({ weaningAgeMonths: 2, youngStockAgeMonths: 20, adultAgeMonths: 20, windowStartHours: 10, windowEndHours: 10 }, { sourceNote: ' ', effectiveFrom: '2026-10-01' })))
    expect(bad).toMatchObject({
      weaningAgeMonths: 'Tuổi cai sữa phải nằm trong khoảng 3 đến 12.',
      adultAgeMonths: 'Tuổi trưởng thành phải lớn hơn tuổi bò tơ.',
      windowEndHours: 'Giờ kết thúc phải lớn hơn giờ bắt đầu.',
      sourceNote: 'Ghi chú nguồn là bắt buộc.',
      effectiveFrom: 'Ngày áp dụng phải từ hôm nay trở đi.',
    })
    expect((await fieldsOf(api.saveParameterVersion(params({ minBreedingWeightKg: Number.NaN })))).minBreedingWeightKg).toMatch(/phải là số/)
  })

  it('saving creates v4, keeps older versions, and a future date stays scheduled', async () => {
    const { api } = setup()
    const v4 = await api.saveParameterVersion(params({ minBreedingWeightKg: 240 }), 'Nguyễn Văn Hùng')
    expect(v4).toMatchObject({ versionNo: 4, status: 'CURRENT', savedBy: 'Nguyễn Văn Hùng', changes: 'Cân tối thiểu phối 230 → 240 kg' })
    const v5 = await api.saveParameterVersion(params({ minBreedingWeightKg: 250, targetFinishingWeightKg: null }, { effectiveFrom: '2026-12-01' }))
    expect(v5.status).toBe('SCHEDULED')
    expect(v5.changes).toBe('Cân tối thiểu phối 240 → 250 kg; Cân xuất mục tiêu 380 → tắt')
    const all = await api.listParameterVersions()
    expect(all).toHaveLength(5)
    expect(all.find((v) => v.status === 'CURRENT')?.versionNo).toBe(4)
  })

  it('uses the newest effective date even if an earlier date was saved later', async () => {
    let today = TODAY
    const store = createCatalogueDemoStore(undefined, { today: () => today })
    const scheduled = await store.saveParameterVersion(params({}, { effectiveFrom: '2026-12-01' }), 'An')
    await store.saveParameterVersion(params({}, { baseVersion: scheduled.versionNo }), 'An')
    today = '2026-12-01'
    const all = await store.listParameterVersions()
    expect(all.find((v) => v.status === 'CURRENT')?.versionNo).toBe(scheduled.versionNo)
  })
})

describe('catalogue api: backend mode', () => {
  it('uses backend routes without touching the mock store', async () => {
    const transport = {
      get: vi.fn().mockResolvedValue([]),
      command: vi.fn().mockResolvedValue({ id: 9, versionNo: 4, effectiveFrom: TODAY, parameters: {}, sourceNote: 'Nguồn', savedBy: 'An' }),
      farmPath: vi.fn((_farmId: number, suffix: string) => `/api/farms/1${suffix}`),
    }
    const store = createCatalogueDemoStore()
    const spy = vi.spyOn(store, 'listBreeds')
    const api = createCatalogueApi({ mode: 'backend', farmId: 1, transport, store })
    await api.listBreeds({ q: 'lai', status: 'ACTIVE' })
    expect(await api.saveParameterVersion(params({}, { baseVersion: 3 }))).toMatchObject({ id: 9, versionNo: 4 })
    expect(transport.get).toHaveBeenNthCalledWith(1, '/api/farms/1/catalogues/breeds?q=lai&status=ACTIVE')
    expect(transport.command).toHaveBeenCalledWith('/api/farms/1/parameters/versions', expect.objectContaining({ baseVersion: 3, sourceNote: 'Phỏng vấn chủ trại 20/10/2026' }), { method: 'POST' })
    expect(transport.get).toHaveBeenCalledTimes(1)
    await api.deleteVaccine({ id: 12, version: 3 })
    expect(transport.command).toHaveBeenCalledWith('/api/farms/1/vaccines/12', undefined, { method: 'DELETE', headers: { 'If-Match': '3' } })
    expect(spy).not.toHaveBeenCalled()
  })
})
