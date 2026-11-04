import { expandLocalTable, stripStressRows } from '../../app/localStressData'

export type CatalogueStatus = 'ACTIVE' | 'INACTIVE'

export interface BreedItem {
  id: string
  code: string
  name: string
  group: string
  description: string
  cattleInHerd: number
  status: CatalogueStatus
}

export interface VaccineItem {
  id: string
  code: string
  name: string
  disease: string
  manufacturer: string
  referenceDose: string
  route: string
  boosterIntervalDays: number
  withdrawalDays: number
  inUse: number
  status: CatalogueStatus
}

export interface MedicineItem {
  id: string
  code: string
  name: string
  referenceDose: string
  route: string
  withdrawalDays: number
  notes: string
  inUse: number
  status: CatalogueStatus
}

export interface ProductionPurposeItem {
  id: string
  code: string
  name: string
  purposeType: string
  description: string
  cattleInHerd: number
  receivingPens: string
  status: CatalogueStatus
}

export type CatalogueItem = BreedItem | VaccineItem | MedicineItem | ProductionPurposeItem

export interface ParameterValues {
  weaningAgeMonths: number
  youngStockAgeMonths: number
  adultAgeMonths: number
  minimumBreedingAgeMonths: number
  minimumBreedingWeightKg: number
  gestationLengthDays: number
  pregnancyCheckAfterDays: number
  recheckAfterInconclusiveDays: number
  calvingPreparationLeadDays: number
  postCalvingBreedingIntervalDays: number
  breedingWindowStartHours: number
  breedingWindowEndHours: number
  estrusCycleLengthDays: number
  bcsScale: '1–5 · bước 0,5' | '1–9 · bước 1'
  weighingIntervalDays: number
  vaccinationReminderLeadDays: number
  targetFinishingWeightKg: number | null
}

export interface ParameterVersion {
  version: string
  effectiveFrom: string
  sourceNote: string
  author: string
  savedAt: string
  values: ParameterValues
}

export type CatalogueKind = 'breeds' | 'vaccines' | 'medicines' | 'productionPurposes'
export type CatalogueDraft = Record<string, string | undefined>

export const VACCINE_ROUTES = ['Tiêm bắp', 'Tiêm dưới da', 'Uống', 'Xịt mũi', 'Khác'] as const
export const MEDICINE_ROUTES = ['Tiêm bắp', 'Tiêm dưới da', 'Tiêm tĩnh mạch', 'Uống', 'Bôi ngoài da', 'Xịt mũi', 'Khác'] as const
export const PURPOSE_TYPES = ['Sinh sản', 'Vỗ béo', 'Đực giống', 'Chưa xác định'] as const

export const PARAMETER_DEFINITIONS: Array<{
  key: Exclude<keyof ParameterValues, 'bcsScale'>
  label: string
  min: number
  max: number
  step: number
  optional?: boolean
}> = [
  { key: 'weaningAgeMonths', label: 'Tuổi cai sữa (tháng)', min: 3, max: 12, step: 1 },
  { key: 'youngStockAgeMonths', label: 'Tuổi hậu bị (tháng)', min: 6, max: 24, step: 1 },
  { key: 'adultAgeMonths', label: 'Tuổi trưởng thành (tháng)', min: 15, max: 48, step: 1 },
  { key: 'minimumBreedingAgeMonths', label: 'Tuổi tối thiểu phối giống (tháng)', min: 6, max: 36, step: 1 },
  { key: 'minimumBreedingWeightKg', label: 'Khối lượng tối thiểu phối giống (kg)', min: 100, max: 600, step: 0.1 },
  { key: 'gestationLengthDays', label: 'Thời gian mang thai (ngày)', min: 270, max: 300, step: 1 },
  { key: 'pregnancyCheckAfterDays', label: 'Khám thai sau phối (ngày)', min: 25, max: 90, step: 1 },
  { key: 'recheckAfterInconclusiveDays', label: 'Khám lại sau chưa kết luận (ngày)', min: 7, max: 60, step: 1 },
  { key: 'calvingPreparationLeadDays', label: 'Chuẩn bị trước sinh (ngày)', min: 1, max: 60, step: 1 },
  { key: 'postCalvingBreedingIntervalDays', label: 'Khoảng sau sinh trước phối (ngày)', min: 20, max: 120, step: 1 },
  { key: 'breedingWindowStartHours', label: 'Bắt đầu cửa sổ phối sau động dục (giờ)', min: 0, max: 24, step: 1 },
  { key: 'breedingWindowEndHours', label: 'Kết thúc cửa sổ phối sau động dục (giờ)', min: 1, max: 36, step: 1 },
  { key: 'estrusCycleLengthDays', label: 'Chu kỳ động dục (ngày)', min: 17, max: 25, step: 1 },
  { key: 'weighingIntervalDays', label: 'Khoảng cân (ngày)', min: 7, max: 180, step: 1 },
  { key: 'vaccinationReminderLeadDays', label: 'Nhắc vaccine trước (ngày)', min: 1, max: 30, step: 1 },
  { key: 'targetFinishingWeightKg', label: 'Khối lượng xuất chuồng mục tiêu (kg)', min: 150, max: 900, step: 0.1, optional: true },
]

export const CATALOGUE_SCHEMA_VERSION = 2
export const CATALOGUE_KEYS = {
  breeds: 'breeds',
  vaccines: 'vaccines',
  medicines: 'medicines',
  productionPurposes: 'productionPurposes',
  parameters: 'parameters',
  parameterHistory: 'parameterHistory',
} as const

const initialBreeds: BreedItem[] = [
  { id: 'breed-angus', code: 'BR-ANGUS', name: 'Angus lai', group: 'Crossbred', description: 'Bò thịt lai Angus phù hợp nuôi vỗ béo.', cattleInHerd: 48, status: 'ACTIVE' },
  { id: 'breed-zebu', code: 'BR-ZEBU', name: 'Zebu đỏ', group: 'Zebu', description: 'Giống địa phương chịu nhiệt tốt.', cattleInHerd: 0, status: 'ACTIVE' },
]

const initialVaccines: VaccineItem[] = [
  { id: 'vaccine-fmd', code: 'VX-FMD', name: 'Vaccine LMLM', disease: 'Lở mồm long móng', manufacturer: 'NAVETCO', referenceDose: '2 ml', route: 'Tiêm bắp', boosterIntervalDays: 180, withdrawalDays: 0, inUse: 12, status: 'ACTIVE' },
  { id: 'vaccine-bq', code: 'VX-BQ', name: 'Vaccine tụ huyết trùng', disease: 'Tụ huyết trùng', manufacturer: 'HANVET', referenceDose: '2 ml', route: 'Tiêm dưới da', boosterIntervalDays: 365, withdrawalDays: 0, inUse: 0, status: 'ACTIVE' },
]

const initialMedicines: MedicineItem[] = [
  { id: 'medicine-oxy', code: 'MD-OXY', name: 'Oxytetracycline', referenceDose: '1 ml/10 kg thể trọng', route: 'Tiêm bắp', withdrawalDays: 21, notes: 'Thuốc tham chiếu; kê đơn theo ca bệnh.', inUse: 6, status: 'ACTIVE' },
  { id: 'medicine-flu', code: 'MD-FLU', name: 'Flunixin', referenceDose: '2,2 mg/kg', route: 'Tiêm tĩnh mạch', withdrawalDays: 10, notes: '', inUse: 0, status: 'ACTIVE' },
]

const initialPurposes: ProductionPurposeItem[] = [
  { id: 'purpose-fattening', code: 'PP-FAT', name: 'Nuôi thịt', purposeType: 'Vỗ béo', description: 'Nhóm bò hướng tới tăng trọng và xuất bán.', cattleInHerd: 206, receivingPens: 'A2, C1', status: 'ACTIVE' },
  { id: 'purpose-breeding', code: 'PP-BREED', name: 'Sinh sản', purposeType: 'Sinh sản', description: 'Nhóm bò cái phục vụ sinh sản.', cattleInHerd: 74, receivingPens: 'B1', status: 'ACTIVE' },
]

export const DEFAULT_PARAMETERS: ParameterVersion = {
  version: 'v3', effectiveFrom: '2026-11-03', sourceNote: 'Owner interview 20/09/2026', author: 'Nguyễn Văn Hùng', savedAt: '2026-11-03 08:00',
  values: {
    weaningAgeMonths: 6, youngStockAgeMonths: 12, adultAgeMonths: 24,
    minimumBreedingAgeMonths: 13, minimumBreedingWeightKg: 230,
    gestationLengthDays: 283, pregnancyCheckAfterDays: 28, recheckAfterInconclusiveDays: 14,
    calvingPreparationLeadDays: 30, postCalvingBreedingIntervalDays: 45,
    breedingWindowStartHours: 8, breedingWindowEndHours: 12, estrusCycleLengthDays: 21,
    bcsScale: '1–5 · bước 0,5', weighingIntervalDays: 30, vaccinationReminderLeadDays: 7,
    targetFinishingWeightKg: 450,
  },
}

function draftValue(draft: CatalogueDraft, key: string) {
  return draft[key]?.trim() ?? ''
}

/** Shared field validation for the four master-data editors. */
export function validateCatalogueDraft(kind: CatalogueKind, draft: CatalogueDraft, items: CatalogueItem[], selectedId?: string): string {
  const code = draftValue(draft, 'code')
  if (!/^[A-Z0-9-]{2,20}$/.test(code)) return 'Mã phải gồm 2–20 ký tự in hoa, chữ số hoặc dấu gạch ngang.'
  if (items.some((item) => item.code === code && item.id !== selectedId)) return 'Mã đã tồn tại trong danh mục này.'
  if (!draftValue(draft, 'name')) return 'Tên là bắt buộc.'
  if (draftValue(draft, 'status') && !['ACTIVE', 'INACTIVE'].includes(draftValue(draft, 'status'))) return 'Chọn trạng thái ACTIVE hoặc INACTIVE.'

  if (kind === 'breeds') {
    if (draftValue(draft, 'name').length > 100) return 'Tên giống tối đa 100 ký tự.'
    if (draftValue(draft, 'group').length > 50) return 'Nhóm giống tối đa 50 ký tự.'
    if (draftValue(draft, 'description').length > 500) return 'Mô tả tối đa 500 ký tự.'
  }
  if (kind === 'vaccines') {
    const disease = draftValue(draft, 'disease')
    if (!disease || disease.length > 150) return 'Bệnh phòng là bắt buộc và tối đa 150 ký tự.'
    if (draftValue(draft, 'name').length > 150 || draftValue(draft, 'manufacturer').length > 100 || draftValue(draft, 'referenceDose').length > 50) return 'Tên vaccine tối đa 150, nhà sản xuất 100, liều tham chiếu 50 ký tự.'
    const booster = draftValue(draft, 'boosterIntervalDays') === '' ? 0 : Number(draftValue(draft, 'boosterIntervalDays'))
    const withdrawal = draftValue(draft, 'withdrawalDays') === '' ? 0 : Number(draftValue(draft, 'withdrawalDays'))
    if (!Number.isInteger(booster) || booster < 0 || booster > 730) return 'Khoảng nhắc mũi tăng cường phải là số nguyên 0–730 ngày.'
    if (!Number.isInteger(withdrawal) || withdrawal < 0 || withdrawal > 365) return 'Thời gian ngưng sử dụng phải là số nguyên 0–365 ngày.'
    if (draftValue(draft, 'route') && !VACCINE_ROUTES.includes(draftValue(draft, 'route') as typeof VACCINE_ROUTES[number])) return 'Chọn đường dùng hợp lệ.'
  }
  if (kind === 'medicines') {
    const withdrawal = draftValue(draft, 'withdrawalDays')
    if (draftValue(draft, 'name').length > 150 || draftValue(draft, 'referenceDose').length > 100 || draftValue(draft, 'notes').length > 500) return 'Tên thuốc tối đa 150, liều 100, ghi chú 500 ký tự.'
    if (!withdrawal || !Number.isInteger(Number(withdrawal)) || Number(withdrawal) < 0 || Number(withdrawal) > 365) return 'Thời gian ngưng thịt là bắt buộc, số nguyên 0–365 ngày.'
    if (draftValue(draft, 'route') && !MEDICINE_ROUTES.includes(draftValue(draft, 'route') as typeof MEDICINE_ROUTES[number])) return 'Chọn đường dùng hợp lệ.'
  }
  if (kind === 'productionPurposes') {
    if (draftValue(draft, 'name').length > 100 || draftValue(draft, 'description').length > 500) return 'Tên mục đích tối đa 100 và mô tả tối đa 500 ký tự.'
    if (!PURPOSE_TYPES.includes(draftValue(draft, 'purposeType') as typeof PURPOSE_TYPES[number])) return 'Chọn loại mục đích hợp lệ.'
  }
  return ''
}

/** Validate parameter values independently of browser min/max attributes. */
export function todayInHoChiMinh(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function validateParameterDraft(values: ParameterValues, sourceNote: string, effectiveFrom: string, today = todayInHoChiMinh()): string {
  for (const definition of PARAMETER_DEFINITIONS) {
    const value = values[definition.key]
    if (value === null || value === undefined || Number.isNaN(value)) {
      if (!definition.optional) return `${definition.label} là bắt buộc.`
      continue
    }
    if (definition.step === 1 && !Number.isInteger(value)) return `${definition.label} phải là số nguyên.`
    if (value < definition.min || value > definition.max) return `${definition.label} phải trong khoảng ${definition.min}–${definition.max}.`
  }
  if (!['1–5 · bước 0,5', '1–9 · bước 1'].includes(values.bcsScale)) return 'BCS scale không hợp lệ.'
  if (values.youngStockAgeMonths <= values.weaningAgeMonths || values.adultAgeMonths <= values.youngStockAgeMonths) return 'Tuổi hậu bị phải lớn hơn tuổi cai sữa và tuổi trưởng thành phải lớn hơn tuổi hậu bị.'
  if (values.breedingWindowEndHours <= values.breedingWindowStartHours) return 'Kết thúc cửa sổ phối phải lớn hơn thời điểm bắt đầu.'
  if (!sourceNote.trim() || sourceNote.length > 255) return 'Source note là bắt buộc và tối đa 255 ký tự.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || Number.isNaN(Date.parse(effectiveFrom)) || effectiveFrom < today) return 'Ngày hiệu lực phải là hôm nay hoặc một ngày trong tương lai.'
  return ''
}

type CatalogueStorageScope = { accountId: string; farmId: string }
type StorageEnvelope<T> = { schemaVersion: number; value: T }

function storage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

function slug(value: string, fallback: string) {
  const cleaned = value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return cleaned || fallback
}

export function getCatalogueStorageScope(target: Storage | undefined = storage()): CatalogueStorageScope {
  if (!target) return { accountId: 'default-account', farmId: 'default-farm' }
  try {
    const root = JSON.parse(target.getItem('beefcare-ui-demo') || '{}') as { account?: Record<string, unknown> }
    const account = root.account || {}
    const rawFarmSelection = account['farm-selection']
    const farmSelection = (rawFarmSelection && typeof rawFarmSelection === 'object' ? rawFarmSelection : {}) as Record<string, unknown>
    const auth = (account['SCR-02'] || account['SCR-03'] || account['SCR-07'] || {}) as Record<string, unknown>
    return {
      accountId: slug(String(auth.Email || auth.email || auth['Email đăng nhập'] || 'default-account'), 'default-account'),
      farmId: slug(String((typeof rawFarmSelection === 'string' ? rawFarmSelection : farmSelection.farm || farmSelection.farmId) || account['farm-id'] || 'default-farm'), 'default-farm'),
    }
  } catch {
    return { accountId: 'default-account', farmId: 'default-farm' }
  }
}

export function catalogueStorageKey(kind: keyof typeof CATALOGUE_KEYS, scope = getCatalogueStorageScope()): string {
  return `beefcare:catalogue:v${CATALOGUE_SCHEMA_VERSION}:${scope.accountId}:${scope.farmId}:${CATALOGUE_KEYS[kind]}`
}

function readEnvelope<T>(key: string, fallback: T, target = storage()): T {
  if (!target) return fallback
  try {
    const raw = target.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as StorageEnvelope<T> | T
    if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && 'value' in parsed) {
      return parsed.schemaVersion === CATALOGUE_SCHEMA_VERSION ? parsed.value as T : fallback
    }
    return parsed as T
  } catch { return fallback }
}

function writeEntries(entries: Array<[string, unknown]>, target = storage()): boolean {
  if (!target) return false
  const previous = new Map(entries.map(([key]) => [key, target.getItem(key)]))
  try {
    const serialized = entries.map(([key, value]) => [key, JSON.stringify({ schemaVersion: CATALOGUE_SCHEMA_VERSION, value })] as const)
    serialized.forEach(([key, value]) => target.setItem(key, value))
    if (serialized.some(([key, value]) => target.getItem(key) !== value)) throw new Error('Storage verification failed')
    return true
  } catch {
    entries.forEach(([key]) => {
      try {
        const old = previous.get(key)
        if (old === null || old === undefined) target.removeItem(key)
        else target.setItem(key, old)
      } catch { /* restore is best effort */ }
    })
    return false
  }
}

function readAccountValue<T>(key: string, fallback: T, target = storage()): T {
  if (!target) return fallback
  try {
    const root = JSON.parse(target.getItem('beefcare-ui-demo') || '{}') as { account?: Record<string, unknown> }
    return (root.account?.[key] as T) ?? fallback
  } catch { return fallback }
}

function readRows(keys: string[], target = storage()): Array<Record<string, unknown>> {
  for (const key of keys) {
    const direct = readEnvelope<unknown>(key, undefined, target)
    if (Array.isArray(direct)) return direct.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object' && !Array.isArray(row)))
    if (target) {
      try {
        const raw = target.getItem(key)
        const parsed = raw ? JSON.parse(raw) : undefined
        if (Array.isArray(parsed)) return parsed.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object' && !Array.isArray(row)))
      } catch { /* continue to next source */ }
    }
  }
  return []
}

export interface CatalogueUsage {
  count: number
  cattleInHerd: number
  inUse: number
  receivingPens: string
}

const rowText = (row: Record<string, unknown>, keys: string[]) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== null)?.toString().trim().toLowerCase() || ''
const sameCatalogueValue = (row: Record<string, unknown>, item: CatalogueItem) => {
  const values = new Set([item.code, item.name, 'purposeType' in item ? item.purposeType : ''].map((value) => value.toLowerCase()).filter(Boolean))
  return ['code', 'breed', 'breedCode', 'breedName', 'vaccine', 'vaccineCode', 'medicine', 'medicineCode', 'purpose', 'purposeCode', 'purposeType'].some((key) => values.has(String(row[key] ?? '').trim().toLowerCase()))
}

export function getCatalogueUsage(kind: CatalogueKind, item: CatalogueItem, target = storage()): CatalogueUsage {
  const cattle = readRows(['beefcare:cattle'], target)
  const accountCattle = readAccountValue<Array<Record<string, unknown>>>('cattle-preview', [], target)
  const cattleRows = cattle.length ? cattle : accountCattle
  const activeCattle = cattleRows.filter((row) => !['EXITED', 'VOIDED', 'INACTIVE'].includes(rowText(row, ['status'])))
  const pens = readRows(['beefcare:pens'], target)
  const accountPens = readAccountValue<Array<Record<string, unknown>>>('pens-preview', [], target)
  const penRows = pens.length ? pens : accountPens
  const activePens = penRows.filter((row) => !['INACTIVE', 'CLOSED'].includes(rowText(row, ['status'])))
  const vaccineRows = readAccountValue<Array<Record<string, unknown>>>('vaccination-preview', [], target).filter((row) => rowText(row, ['recordStatus', 'status']) !== 'VOIDED')
  const medicineRows = readAccountValue<Array<Record<string, unknown>>>('health-events-preview', [], target).filter((row) => rowText(row, ['recordStatus', 'status']) !== 'VOIDED')
  const matchingCattle = activeCattle.filter((row) => sameCatalogueValue(row, item))
  const matchingPens = activePens.filter((row) => sameCatalogueValue(row, item))
  const matchingRecords = kind === 'vaccines' ? vaccineRows.filter((row) => sameCatalogueValue(row, item)) : kind === 'medicines' ? medicineRows.filter((row) => sameCatalogueValue(row, item)) : []
  const hasLiveSource = cattleRows.length > 0 || penRows.length > 0 || vaccineRows.length > 0 || medicineRows.length > 0
  if (!hasLiveSource) {
    if (kind === 'breeds') return { count: (item as BreedItem).cattleInHerd, cattleInHerd: (item as BreedItem).cattleInHerd, inUse: 0, receivingPens: '' }
    if (kind === 'vaccines') return { count: (item as VaccineItem).inUse, cattleInHerd: 0, inUse: (item as VaccineItem).inUse, receivingPens: '' }
    if (kind === 'medicines') return { count: (item as MedicineItem).inUse, cattleInHerd: 0, inUse: (item as MedicineItem).inUse, receivingPens: '' }
    const purpose = item as ProductionPurposeItem
    return { count: purpose.cattleInHerd + (purpose.receivingPens === '—' ? 0 : purpose.receivingPens.split(',').filter(Boolean).length), cattleInHerd: purpose.cattleInHerd, inUse: 0, receivingPens: purpose.receivingPens }
  }
  const receivingPens = matchingPens.map((row) => rowText(row, ['code', 'name'])).filter(Boolean).join(', ')
  return { count: matchingCattle.length + matchingPens.length + matchingRecords.length, cattleInHerd: matchingCattle.length, inUse: matchingRecords.length, receivingPens }
}

export function selectCurrentParameterVersion(history: ParameterVersion[], today = todayInHoChiMinh()): ParameterVersion {
  const valid = history.filter((version) => version && /^\d{4}-\d{2}-\d{2}$/.test(version.effectiveFrom) && version.effectiveFrom <= today)
  return [...(valid.length ? valid : history)].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.version.localeCompare(b.version)).at(-1) || DEFAULT_PARAMETERS
}

export function nextParameterVersion(history: ParameterVersion[]): string {
  const max = history.reduce((value, version) => Math.max(value, Number(version.version.replace(/^v/, '')) || 0), 0)
  return `v${max + 1}`
}

export function loadCatalogueItems(kind: CatalogueKind): CatalogueItem[] {
  const fallback = kind === 'breeds' ? initialBreeds : kind === 'vaccines' ? initialVaccines : kind === 'medicines' ? initialMedicines : initialPurposes
  const stored = readEnvelope<unknown>(catalogueStorageKey(kind), fallback)
  const rows = (Array.isArray(stored) ? stored : fallback).map((item) => ({ ...item })) as CatalogueItem[]
  return expandLocalTable(`catalogue-${kind}`, rows)
}

export function saveCatalogueItems(kind: CatalogueKind, items: CatalogueItem[]): boolean {
  return writeEntries([[catalogueStorageKey(kind), stripStressRows(items)]])
}

export function loadParameters(): ParameterVersion {
  const history = loadParameterHistory()
  const stored = readEnvelope<unknown>(catalogueStorageKey('parameters'), undefined)
  const storedVersion = stored && typeof stored === 'object' && 'values' in stored ? stored as ParameterVersion : undefined
  const versions = storedVersion && !history.some((version) => version.version === storedVersion.version) ? [...history, storedVersion] : history
  const selected = selectCurrentParameterVersion(versions)
  return { ...selected, values: { ...selected.values } }
}

export function loadParameterHistory(): ParameterVersion[] {
  const stored = readEnvelope<unknown>(catalogueStorageKey('parameterHistory'), [DEFAULT_PARAMETERS])
  return (Array.isArray(stored) && stored.length ? stored : [DEFAULT_PARAMETERS]) as ParameterVersion[]
}

export function saveParameterVersion(version: ParameterVersion, history: ParameterVersion[]): boolean {
  const persistedHistory = history.some((item) => item.version === version.version) ? history : [...history, version]
  const selected = selectCurrentParameterVersion(persistedHistory)
  return writeEntries([
    [catalogueStorageKey('parameters'), selected],
    [catalogueStorageKey('parameterHistory'), persistedHistory],
  ])
}
