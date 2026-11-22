import { businessDate } from '../../../shared/lib/date/farmTime'
import type { EntryBirthAccuracy, EntryCattleDetail, EntryLineChanges, EntrySexCode, EntryWeightBasis, HerdEntry } from '../types'

export type EntryLineForm = Record<keyof EntryLineChanges, string>
export const emptyEntryLineForm = (): EntryLineForm => ({ entryDate: '', sellerId: '', quarantineCertNo: '', vehiclePlate: '', entryWeightKg: '', weightBasis: '', unitPrice: '', breedId: '', sex: '', birthDate: '', birthDateAccuracy: '' })
export const isFarmBornEntry = (record: HerdEntry) => record.entryType === 'FARM_BORN' || record.type === 'Bê sinh tại trại'
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

/** Blank new values retain the snapshot. Totals and later-event chronology remain server-owned. */
export function buildEntryLineChanges(record: HerdEntry, line: EntryCattleDetail, form: EntryLineForm): { changes: EntryLineChanges; error: string | null } {
  const changes: EntryLineChanges = {}
  let error: string | null = null
  const fail = (message: string) => { error ??= message }
  const weight = form.entryWeightKg.trim()
  const weightChanged = weight !== '' && Number(weight) !== line.weight
  if (weight) {
    if (!Number.isFinite(Number(weight)) || Number(weight) < 1 || Number(weight) > 1500) fail('Cân nhập phải từ 1 đến 1.500 kg.')
    else if (weightChanged) changes.entryWeightKg = Number(weight)
  }
  if (weightChanged && !form.weightBasis) fail('Vui lòng chọn cơ sở cân khi đổi cân nhập.')
  if (form.weightBasis) {
    if (!['MEASURED', 'ESTIMATED'].includes(form.weightBasis)) fail('Cơ sở cân không hợp lệ.')
    else if (weightChanged || form.weightBasis !== line.weightBasis) changes.weightBasis = form.weightBasis as EntryWeightBasis
  }
  if (isFarmBornEntry(record)) return { changes, error }

  const entryDate = form.entryDate.trim()
  if (entryDate) {
    if (!validDate(entryDate)) fail('Ngày nhập không hợp lệ.')
    else if (entryDate > businessDate()) fail('Ngày nhập không được ở tương lai.')
    else if (entryDate !== record.date) changes.entryDate = entryDate
  }
  for (const [key, current] of [['sellerId', record.sellerId], ['breedId', line.breedId]] as const) {
    if (!form[key]) continue
    const id = Number(form[key])
    if (!Number.isSafeInteger(id) || id <= 0) fail('Vui lòng chọn giá trị trong danh mục.')
    else if (id !== current) changes[key] = id
  }
  for (const [key, current, limit] of [['quarantineCertNo', record.detail?.quarantine, 50], ['vehiclePlate', record.detail?.plate, 20]] as const) {
    const text = form[key].trim()
    if (text.length > limit) fail(`${key === 'vehiclePlate' ? 'Biển số xe' : 'Số giấy kiểm dịch'} tối đa ${limit} ký tự.`)
    else if (text && text !== (current ?? '').trim()) changes[key] = text
  }
  const price = form.unitPrice.trim()
  if (price) {
    if (!Number.isSafeInteger(Number(price)) || Number(price) < 0) fail('Đơn giá phải là số nguyên không âm.')
    else if (Number(price) !== line.unitPrice) changes.unitPrice = Number(price)
  }
  if (form.sex) {
    if (!['MALE', 'FEMALE'].includes(form.sex)) fail('Giới tính không hợp lệ.')
    else if (form.sex !== line.sexCode) changes.sex = form.sex as EntrySexCode
  }

  const accuracy = form.birthDateAccuracy || line.birthDateAccuracy || (line.birthDate ? 'EXACT' : 'UNKNOWN')
  let birth = form.birthDate || line.birthDate || ''
  if (form.birthDate && !validDate(form.birthDate)) fail('Ngày sinh không hợp lệ.')
  if (!['EXACT', 'ESTIMATED', 'UNKNOWN'].includes(accuracy)) fail('Độ chính xác ngày sinh không hợp lệ.')
  if (accuracy === 'ESTIMATED' && birth) birth = `${birth.slice(0, 7)}-01`
  const birthChanged = Boolean(form.birthDate && birth !== (line.birthDate ?? '') || form.birthDateAccuracy && accuracy !== line.birthDateAccuracy)
  if (birthChanged) {
    if (accuracy !== 'UNKNOWN' && !birth) fail('Vui lòng chọn ngày sinh cùng độ chính xác.')
    if (form.birthDate && accuracy === 'UNKNOWN') fail('Vui lòng chọn độ chính xác cho ngày sinh mới.')
    // The backend merges date and accuracy together; preserve the omitted sibling.
    changes.birthDate = birth || undefined
    changes.birthDateAccuracy = accuracy as EntryBirthAccuracy
  }
  if (birth && birth > (entryDate || record.date || businessDate())) fail('Ngày sinh không được sau ngày nhập.')
  return { changes, error }
}
