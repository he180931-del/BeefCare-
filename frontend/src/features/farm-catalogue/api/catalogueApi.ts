import { backendFarmId, backendMode, backendTransport, asRecord, asRows, numberValue, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { BackendError } from '../../../api/backendClient'
import { catalogueDemoStore, type CatalogueDemoStore } from '../data/catalogueDemoStore'
import { FieldErrors, todayIso, type FieldErrorMap } from '../domain/catalogueRules'
import { DEFAULT_PARAMETERS, PARAMETER_FIELDS, describeChanges } from '../domain/parameterRules'
import type {
  BcsScale, Breed, BreedCommand, CatalogueFilters, Medicine, MedicineCommand, NumericParameterKey, ParameterValues, ParameterVersion,
  ParameterVersionCommand, Purpose, PurposeCommand, PurposeType, Route, Vaccine, VaccineCommand,
} from '../types'

/** Frontend parameter keys ↔ backend FarmParameterVersion keys (SCR-56, §3.5). */
const PARAMETER_KEY: Record<NumericParameterKey, string> = {
  weaningAgeMonths: 'WEANING_AGE_MONTHS', youngStockAgeMonths: 'YOUNG_STOCK_AGE_MONTHS', adultAgeMonths: 'ADULT_AGE_MONTHS',
  minBreedingAgeMonths: 'MIN_BREEDING_AGE_MONTHS', minBreedingWeightKg: 'MIN_BREEDING_WEIGHT_KG',
  gestationLengthDays: 'GESTATION_LENGTH_DAYS', pregnancyCheckDays: 'PREGNANCY_CHECK_DAYS', recheckDays: 'PREGNANCY_RECHECK_DAYS',
  calvingPrepLeadDays: 'CALVING_LEAD_DAYS', postCalvingIntervalDays: 'POST_CALVING_DAYS',
  windowStartHours: 'BREEDING_WINDOW_START_HOURS', windowEndHours: 'BREEDING_WINDOW_END_HOURS', estrusCycleDays: 'ESTRUS_CYCLE_DAYS',
  weighingIntervalDays: 'WEIGHING_INTERVAL_DAYS', vaccinationLeadDays: 'VACCINATION_LEAD_DAYS', targetFinishingWeightKg: 'TARGET_FINISHING_WEIGHT_KG',
}
const FRONT_KEY = Object.fromEntries(Object.entries(PARAMETER_KEY).map(([front, back]) => [back, front])) as Record<string, NumericParameterKey>
const BCS_TO_BACKEND: Record<BcsScale, string> = { '1-5': '1-5:0.5', '1-9': '1-9:1' }

const ROUTES: Route[] = ['INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRAVENOUS', 'ORAL', 'INTRANASAL', 'TOPICAL', 'OTHER']
const route = (value: unknown): Route | '' => (ROUTES.includes(value as Route) ? value as Route : '')
const PURPOSE_TYPES: PurposeType[] = ['BREEDING', 'FATTENING', 'SIRE', 'UNDECIDED']

export const mapBreed = (row: Record<string, unknown>): Breed => ({
  id: numberValue(row.id), code: textValue(row.code), name: textValue(row.name), group: textValue(row.group), description: textValue(row.description),
  available: row.available === true, version: numberValue(row.version), activeCattle: numberValue(row.activeCattle), referenced: row.referenced === true,
  referencedCount: numberValue(row.referencedCount),
})
export const mapPurpose = (row: Record<string, unknown>): Purpose => ({
  id: numberValue(row.id), code: textValue(row.code), name: textValue(row.name), description: textValue(row.description),
  purposeType: (PURPOSE_TYPES.includes(row.purposeType as PurposeType) ? row.purposeType : 'UNDECIDED') as PurposeType,
  available: row.available === true, version: numberValue(row.version), activeCattle: numberValue(row.activeCattle), referenced: row.referenced === true,
  receivingPens: asRows(row.receivingPens).map((p) => ({ id: numberValue(p.id), code: textValue(p.code), name: textValue(p.name) })),
  referencedCount: numberValue(row.referencedCount),
})
export const mapVaccine = (row: Record<string, unknown>): Vaccine => ({
  id: numberValue(row.id), code: textValue(row.code), name: textValue(row.name), diseasePrevented: textValue(row.diseasePrevented),
  manufacturer: textValue(row.manufacturer), dose: textValue(row.dose), route: route(row.route),
  boosterInterval: typeof row.boosterInterval === 'number' ? row.boosterInterval : null, withdrawalDays: numberValue(row.withdrawalDays),
  available: row.available === true, version: numberValue(row.version), scheduleCount: numberValue(row.scheduleCount), recordCount: numberValue(row.recordCount),
  completeFromLabel: row.completeFromLabel === true,
})
export const mapMedicine = (row: Record<string, unknown>): Medicine => ({
  id: numberValue(row.id), code: textValue(row.code), name: textValue(row.name), description: textValue(row.description),
  dose: textValue(row.dose), route: route(row.route), withdrawalDays: numberValue(row.withdrawalDays),
  available: row.available === true, version: numberValue(row.version), usageCount: numberValue(row.referencedCount ?? row.recordCount),
})

/** Backend parameter values (UPPER_SNAKE) as the form's values; keys missing in an old version take the SCR-56 default. */
export function toParameterValues(raw: Record<string, unknown>, gestation?: unknown): ParameterValues {
  const values: ParameterValues = { ...DEFAULT_PARAMETERS, targetFinishingWeightKg: null }
  for (const [key, value] of Object.entries(raw)) {
    const front = FRONT_KEY[key]
    if (front && value != null && Number.isFinite(Number(value))) values[front] = Number(value)
  }
  if (typeof gestation === 'number') values.gestationLengthDays = gestation
  values.bcsScale = String(raw.BCS_SCALE ?? '').startsWith('1-9') ? '1-9' : '1-5'
  return values
}
export function toBackendParameters(values: ParameterValues): Record<string, unknown> {
  const out: Record<string, unknown> = { BCS_SCALE: BCS_TO_BACKEND[values.bcsScale] }
  for (const [front, back] of Object.entries(PARAMETER_KEY) as Array<[NumericParameterKey, string]>) out[back] = values[front]
  return out
}

/** Versions newest first, with the change summary against the previous version and CURRENT / SCHEDULED / PAST (SCR-56). */
export function decorateVersions(rows: Array<Record<string, unknown>>, today: string): ParameterVersion[] {
  const records = rows.map((row) => ({
    id: numberValue(row.id), versionNo: numberValue(row.versionNo), effectiveFrom: textValue(row.effectiveFrom),
    parameters: toParameterValues(asRecord(row.parameters), row.gestationLengthDays),
    sourceNote: textValue(row.sourceNote), savedBy: textValue(row.savedBy, '—'),
  })).sort((a, b) => a.versionNo - b.versionNo)
  const current = [...records].reverse().find((v) => v.effectiveFrom <= today)
  return records.map((v, i) => ({
    ...v,
    changes: describeChanges(i === 0 ? null : records[i - 1]!.parameters, v.parameters),
    status: (v.id === current?.id ? 'CURRENT' : v.effectiveFrom > today ? 'SCHEDULED' : 'PAST') as ParameterVersion['status'],
  })).reverse()
}

const PARAMETER_LABEL = Object.fromEntries(PARAMETER_FIELDS.map((f) => [f.key, f.label])) as Record<string, string>

/**
 * Backend field errors shown under the field like the local validation (FieldErrors): MSG-FE18-02 duplicate code,
 * MSG-FE18-06 parameter range, MSG-FE18-09 purpose type, MSG-COM-06 / -10 on a named field. Others stay form errors.
 */
export function fieldErrorsOf(error: unknown): FieldErrors | null {
  if (!(error instanceof BackendError)) return null
  const p = error.params ?? {}
  const fields: FieldErrorMap = {}
  if (error.code === 'MSG-FE18-02') fields.code = `Mã ${String(p.code ?? '')} đã tồn tại trong danh mục này.`
  else if (error.code === 'MSG-FE18-09') fields.purposeType = `Không thể đổi loại mục đích vì mục đích này đang được ${String(p.count ?? '')} con bò hoặc tiêu chí chuồng sử dụng.`
  else if (error.code === 'MSG-FE18-06') {
    const key = FRONT_KEY[String(p.parameter ?? '')]
    if (key) fields[key] = `${PARAMETER_LABEL[key] ?? key} phải từ ${String(p.min)} đến ${String(p.max)}.`
  } else if (error.code === 'MSG-COM-06' || error.code === 'MSG-COM-10') {
    const field = String(p.field ?? '').replace(/^parameters\./, '')
    const key = FRONT_KEY[field] ?? field
    if (key) fields[key] = error.code === 'MSG-COM-06' ? 'Trường này là bắt buộc.' : 'Giá trị không hợp lệ.'
  }
  return Object.keys(fields).length ? new FieldErrors(fields) : null
}

const withFieldErrors = async <T>(job: () => Promise<T>): Promise<T> => {
  try { return await job() } catch (error) { throw fieldErrorsOf(error) ?? error }
}
const query = (filters: CatalogueFilters) => {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.status) params.set('status', filters.status)
  const text = params.toString()
  return text ? `?${text}` : ''
}
/** Vaccines and medicines have no q / status on the backend list: filtered here (spec A3, A5). */
const filterLocal = <T extends { code: string; name: string; available: boolean }>(rows: T[], filters: CatalogueFilters, extra: (r: T) => string = () => '') => {
  const q = filters.q?.trim().toLowerCase() ?? ''
  return rows.filter((r) => (!filters.status || (filters.status === 'ACTIVE') === r.available)
    && (!q || `${r.code} ${r.name} ${extra(r)}`.toLowerCase().includes(q)))
}

export function createCatalogueApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: CatalogueDemoStore }) {
  if (mode !== 'backend') {
    return {
      listBreeds: (filters: CatalogueFilters = {}) => store.listBreeds(filters),
      saveBreed: (id: number | null, command: BreedCommand) => store.saveBreed(id, command),
      listVaccines: (filters: CatalogueFilters = {}) => store.listVaccines(filters),
      saveVaccine: (id: number | null, command: VaccineCommand) => store.saveVaccine(id, command),
      deleteVaccine: (item: Pick<Vaccine, 'id' | 'version'>) => store.deleteVaccine(item.id),
      listMedicines: (filters: CatalogueFilters = {}) => store.listMedicines(filters),
      saveMedicine: (id: number | null, command: MedicineCommand) => store.saveMedicine(id, command),
      listPurposes: (filters: CatalogueFilters = {}) => store.listPurposes(filters),
      savePurpose: (id: number | null, command: PurposeCommand) => store.savePurpose(id, command),
      listParameterVersions: () => store.listParameterVersions(),
      saveParameterVersion: (command: ParameterVersionCommand, author = 'Chủ trại') => store.saveParameterVersion(command, author),
    }
  }

  const path = (suffix: string) => transport.farmPath(farmId, suffix)
  const save = (base: string, id: number | null, body: unknown) =>
    transport.command(id === null ? path(base) : path(`${base}/${id}`), body, { method: id === null ? 'POST' : 'PUT' })
  const remove = (suffix: string, version: number) => transport.command(path(suffix), undefined, { method: 'DELETE', headers: { 'If-Match': String(version) } })

  return {
    // A2: GET /catalogues/breeds?q&status · POST / PUT
    async listBreeds(filters: CatalogueFilters = {}) { return asRows(await transport.get(path(`/catalogues/breeds${query(filters)}`))).map(mapBreed) },
    saveBreed: (id: number | null, c: BreedCommand) => withFieldErrors(async () => mapBreed(asRecord(await save('/catalogues/breeds', id, {
      code: c.code.trim(), name: c.name.trim(), group: c.group.trim() || null, description: c.description.trim() || null, available: c.available, expectedVersion: c.expectedVersion,
    })))),

    // A3, A4: GET /vaccines (lọc q/status ở đây) · POST / PUT · DELETE vắc-xin chưa dùng
    async listVaccines(filters: CatalogueFilters = {}) { return filterLocal(asRows(await transport.get(path('/vaccines'))).map(mapVaccine), filters, (v) => v.diseasePrevented) },
    saveVaccine: (id: number | null, c: VaccineCommand) => withFieldErrors(async () => mapVaccine(asRecord(await save('/vaccines', id, {
      code: c.code.trim(), name: c.name.trim(), diseasePrevented: c.diseasePrevented.trim(), manufacturer: c.manufacturer.trim() || null,
      dose: c.dose.trim() || null, route: c.route || null, boosterInterval: c.boosterInterval, withdrawalDays: c.withdrawalDays ?? 0,
      available: c.available, expectedVersion: c.expectedVersion,
    })))),
    deleteVaccine: (item: Pick<Vaccine, 'id' | 'version'>) => remove(`/vaccines/${item.id}`, item.version),

    // A5: GET /medicines (lọc q/status ở đây) · POST / PUT
    async listMedicines(filters: CatalogueFilters = {}) { return filterLocal(asRows(await transport.get(path('/medicines'))).map(mapMedicine), filters) },
    saveMedicine: (id: number | null, c: MedicineCommand) => withFieldErrors(async () => mapMedicine(asRecord(await save('/medicines', id, {
      code: c.code.trim(), name: c.name.trim(), description: c.description.trim() || null, dose: c.dose.trim() || null, route: c.route || null,
      withdrawalDays: c.withdrawalDays, available: c.available, expectedVersion: c.expectedVersion,
    })))),

    // A6: GET /catalogues/production-purposes?q&status · POST / PUT
    async listPurposes(filters: CatalogueFilters = {}) { return asRows(await transport.get(path(`/catalogues/production-purposes${query(filters)}`))).map(mapPurpose) },
    savePurpose: (id: number | null, c: PurposeCommand) => withFieldErrors(async () => mapPurpose(asRecord(await save('/catalogues/production-purposes', id, {
      code: c.code.trim(), name: c.name.trim(), purposeType: c.purposeType, description: c.description.trim() || null, available: c.available, expectedVersion: c.expectedVersion,
    })))),

    // A9: GET /parameters/versions · A10: POST /parameters/versions (tác giả lấy từ phiên đăng nhập)
    async listParameterVersions() { return decorateVersions(asRows(await transport.get(path('/parameters/versions'))), todayIso()) },
    saveParameterVersion: (c: ParameterVersionCommand, _author?: string) => withFieldErrors(async () => {
      const saved = asRecord(await transport.command(path('/parameters/versions'), {
        parameters: toBackendParameters(c.parameters), gestationLengthDays: c.gestationLengthDays, effectiveFrom: c.effectiveFrom,
        sourceNote: c.sourceNote.trim(), baseVersion: c.baseVersion ?? null,
      }, { method: 'POST' }))
      const all = decorateVersions(asRows(await transport.get(path('/parameters/versions'))), todayIso())
      return all.find((v) => v.id === numberValue(saved.id)) ?? decorateVersions([saved], todayIso())[0]!
    }),
  }
}
export type CatalogueApi = ReturnType<typeof createCatalogueApi>

export const catalogueApi = createCatalogueApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: catalogueDemoStore })
