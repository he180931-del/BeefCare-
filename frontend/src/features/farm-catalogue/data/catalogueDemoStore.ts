import {
  FieldErrors, matchesFilters, purposeUsage, todayIso, validateBreed, validateMedicine, validatePurpose, validateVaccine, vaccineUsage,
  type FieldErrorMap,
} from '../domain/catalogueRules'
import { describeChanges, validateParameterVersion } from '../domain/parameterRules'
import type {
  Breed, BreedCommand, CatalogueBase, CatalogueFilters, Medicine, MedicineCommand, ParameterVersion, ParameterVersionCommand, Purpose,
  PurposeCommand, Vaccine, VaccineCommand,
} from '../types'
import { CATALOGUE_DEMO, type CatalogueSeed } from './catalogueMock'

const CONFLICT = 'Bản ghi đã được thay đổi. Vui lòng tải lại và kiểm tra trước khi thử lại.' // MSG-COM-05
const NOT_FOUND = 'Không tìm thấy mục trong danh mục.'
const nextId = (rows: Array<{ id: number }>) => rows.reduce((max, r) => Math.max(max, r.id), 0) + 1

interface UpsertOptions<T extends CatalogueBase, C extends { code: string; expectedVersion?: number }> {
  rows: T[]
  id: number | null
  command: C
  errors: FieldErrorMap
  referenced: (row: T) => boolean
  build: (existing: T | null, id: number, version: number) => T
}

/** Phần chung của mọi danh mục: phiên bản, mã duy nhất, khóa mã khi đã được dùng. */
function upsert<T extends CatalogueBase, C extends { code: string; expectedVersion?: number }>(o: UpsertOptions<T, C>): T {
  const existing = o.id === null ? null : (o.rows.find((r) => r.id === o.id) ?? null)
  if (o.id !== null && !existing) throw new Error(NOT_FOUND)
  if (existing && o.command.expectedVersion !== undefined && o.command.expectedVersion !== existing.version) throw new Error(CONFLICT)
  const code = o.command.code.trim()
  const errors = { ...o.errors }
  if (!errors.code && existing && o.referenced(existing) && code !== existing.code) errors.code = 'Không sửa được mã khi mục này đã được dùng.'
  if (!errors.code && o.rows.some((r) => r.id !== o.id && r.code === code)) errors.code = `Mã ${code} đã tồn tại trong danh mục này.` // MSG-FE18-02
  if (Object.keys(errors).length) throw new FieldErrors(errors)
  const next = o.build(existing, existing?.id ?? nextId(o.rows), (existing?.version ?? 0) + 1)
  if (existing) o.rows[o.rows.indexOf(existing)] = next
  else o.rows.push(next)
  return structuredClone(next)
}

export function createCatalogueDemoStore(seed: CatalogueSeed = CATALOGUE_DEMO, options: { today?: () => string } = {}) {
  const today = options.today ?? todayIso
  let data = structuredClone(seed)
  const list = <T extends CatalogueBase>(rows: T[], filters: CatalogueFilters, texts: (r: T) => Array<string | undefined>) =>
    structuredClone(rows.filter((r) => matchesFilters(r, filters, texts(r))))

  const decorate = (): ParameterVersion[] => {
    const sorted = [...data.parameterVersions].sort((a, b) => a.versionNo - b.versionNo)
    const current = [...sorted].reverse().find((v) => v.effectiveFrom <= today())
    return sorted
      .map((v, i) => ({
        ...structuredClone(v),
        changes: describeChanges(i === 0 ? null : sorted[i - 1]!.parameters, v.parameters),
        status: (v.id === current?.id ? 'CURRENT' : v.effectiveFrom > today() ? 'SCHEDULED' : 'PAST') as ParameterVersion['status'],
      }))
      .reverse()
  }

  return {
    async listBreeds(filters: CatalogueFilters = {}): Promise<Breed[]> {
      return list(data.breeds, filters, (r) => [r.code, r.name, r.group, r.description])
    },
    async saveBreed(id: number | null, c: BreedCommand): Promise<Breed> {
      return upsert({
        rows: data.breeds, id, command: c, errors: validateBreed(c), referenced: (r) => r.referenced,
        build: (ex, newId, version) => ({
          id: newId, code: c.code.trim(), name: c.name.trim(), group: c.group.trim(), description: c.description.trim(), available: c.available,
          activeCattle: ex?.activeCattle ?? 0, referenced: ex?.referenced ?? false, version,
        }),
      })
    },

    async listVaccines(filters: CatalogueFilters = {}): Promise<Vaccine[]> {
      return list(data.vaccines, filters, (r) => [r.code, r.name, r.diseasePrevented, r.manufacturer])
    },
    async saveVaccine(id: number | null, c: VaccineCommand): Promise<Vaccine> {
      return upsert({
        rows: data.vaccines, id, command: c, errors: validateVaccine(c), referenced: (r) => vaccineUsage(r) > 0,
        build: (ex, newId, version) => ({
          id: newId, code: c.code.trim(), name: c.name.trim(), diseasePrevented: c.diseasePrevented.trim(), manufacturer: c.manufacturer.trim(),
          dose: c.dose.trim(), route: c.route, boosterInterval: c.boosterInterval, withdrawalDays: c.withdrawalDays ?? 0, available: c.available,
          scheduleCount: ex?.scheduleCount ?? 0, recordCount: ex?.recordCount ?? 0, version,
        }),
      })
    },
    /** Chỉ xóa được vắc-xin chưa từng được tham chiếu (GBR-67). */
    async deleteVaccine(id: number): Promise<void> {
      const row = data.vaccines.find((r) => r.id === id)
      if (!row) throw new Error(NOT_FOUND)
      if (vaccineUsage(row) > 0) throw new Error('Vắc-xin này đã được dùng nên không xóa được. Hãy ngừng dùng thay vì xóa.') // MSG-FE18-04
      data.vaccines = data.vaccines.filter((r) => r.id !== id)
    },

    async listMedicines(filters: CatalogueFilters = {}): Promise<Medicine[]> {
      return list(data.medicines, filters, (r) => [r.code, r.name, r.dose])
    },
    async saveMedicine(id: number | null, c: MedicineCommand): Promise<Medicine> {
      return upsert({
        rows: data.medicines, id, command: c, errors: validateMedicine(c), referenced: (r) => r.usageCount > 0,
        build: (ex, newId, version) => ({
          id: newId, code: c.code.trim(), name: c.name.trim(), description: c.description.trim(), dose: c.dose.trim(), route: c.route,
          withdrawalDays: c.withdrawalDays ?? 0, available: c.available, usageCount: ex?.usageCount ?? 0, version,
        }),
      })
    },

    async listPurposes(filters: CatalogueFilters = {}): Promise<Purpose[]> {
      return list(data.purposes, filters, (r) => [r.code, r.name, r.description])
    },
    async savePurpose(id: number | null, c: PurposeCommand): Promise<Purpose> {
      const existing = id === null ? undefined : data.purposes.find((r) => r.id === id)
      const errors = validatePurpose(c)
      // Loại mục đích cố định khi đã có bò hoặc tiêu chí chuồng tham chiếu (GBR-67, MSG-FE18-09).
      if (existing?.referenced && !errors.purposeType && existing.purposeType !== c.purposeType) {
        errors.purposeType = `Không đổi được loại mục đích vì mục đích này đang được dùng bởi ${purposeUsage(existing)} bò hoặc tiêu chí chuồng.`
      }
      return upsert({
        rows: data.purposes, id, command: c, errors, referenced: (r) => r.referenced,
        build: (ex, newId, version) => ({
          id: newId, code: c.code.trim(), name: c.name.trim(), purposeType: c.purposeType, description: c.description.trim(), available: c.available,
          activeCattle: ex?.activeCattle ?? 0, referenced: ex?.referenced ?? false, receivingPens: ex?.receivingPens ?? [], version,
        }),
      })
    },

    async listParameterVersions(): Promise<ParameterVersion[]> {
      return decorate()
    },
    /** Mỗi lần lưu tạo phiên bản mới; phiên bản cũ giữ nguyên để tra cứu (GBR-68). */
    async saveParameterVersion(c: ParameterVersionCommand, author: string): Promise<ParameterVersion> {
      const errors = validateParameterVersion(c, today())
      if (Object.keys(errors).length) throw new FieldErrors(errors)
      const record = {
        id: nextId(data.parameterVersions),
        versionNo: data.parameterVersions.reduce((max, v) => Math.max(max, v.versionNo), 0) + 1,
        effectiveFrom: c.effectiveFrom,
        parameters: structuredClone(c.parameters),
        sourceNote: c.sourceNote.trim(),
        savedBy: author,
      }
      data.parameterVersions.push(record)
      return decorate().find((v) => v.id === record.id)!
    },

    async reset() {
      data = structuredClone(seed)
    },
  }
}
export type CatalogueDemoStore = ReturnType<typeof createCatalogueDemoStore>
export const catalogueDemoStore = createCatalogueDemoStore()
