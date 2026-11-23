import type { EntryCow, EntryDeclarationStatus, EntryLineChanges } from '../types'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { fullDate, validEntryDate } from './entryDate'

export type EntryHistory = EntryCow['hist']
export const unknownEntryHistory = (): EntryHistory => ({ vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' })
const clean = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const status = (value: string): EntryDeclarationStatus => value === 'Có' || value === 'KNOWN' ? 'KNOWN' : value === 'Không' || value === 'NONE' ? 'NONE' : 'UNKNOWN'

export function historyDeclarations(hist: EntryHistory): Required<Pick<EntryLineChanges, 'vaccination' | 'disease' | 'reproduction'>> {
  const vaccinationStatus = status(hist.vaccine), diseaseStatus = status(hist.disease), reproductionStatus = status(hist.repro)
  const rows = hist.vaccineItems ?? (hist.vaccineId != null || hist.vaccineName || hist.vaccineDate || hist.vaccineSource
    ? [{ vaccineId: hist.vaccineId, vaccineName: hist.vaccineName, vaccineDate: hist.vaccineDate, vaccineSource: hist.vaccineSource }] : [])
  const pregnant = hist.pregnantAtEntry === 'YES' ? 'YES' : hist.pregnantAtEntry === 'NO' ? 'NO' : 'UNKNOWN'
  return {
    vaccination: { status: vaccinationStatus,
      informationSource: vaccinationStatus === 'KNOWN' ? clean(hist.vaccineDeclarationSource ?? hist.vaccineSource ?? hist.vaccineNote) : null,
      items: vaccinationStatus === 'KNOWN' ? rows.map(row => ({ vaccineId: row.vaccineId ?? null, vaccineName: clean(row.vaccineName), date: fullDate(row.vaccineDate), informationSource: clean(row.vaccineSource) })) : [] },
    disease: { status: diseaseStatus, description: diseaseStatus === 'KNOWN' ? clean(hist.diseaseNote) : null },
    reproduction: { status: reproductionStatus, earlierCalvings: reproductionStatus === 'KNOWN' ? hist.earlierCalvings ?? 0 : null,
      pregnantAtEntry: reproductionStatus === 'KNOWN' ? pregnant : null,
      estMonthsPregnant: reproductionStatus === 'KNOWN' && pregnant === 'YES' ? hist.pregnancyMonths ?? null : null,
      description: reproductionStatus === 'KNOWN' ? clean(hist.reproductionNote) : null },
  }
}

export function validateEntryHistory(hist: EntryHistory, showReproduction = true, entryDate = businessDate()): string | null {
  const { vaccination, disease } = historyDeclarations(hist)
  if (vaccination.status === 'KNOWN') {
    if (!vaccination.items.length || vaccination.items.some(item => !item.vaccineId && !item.vaccineName)) return 'Vui lòng nhập thông tin tiêm phòng.'
    if ((vaccination.informationSource?.length ?? 0) > 255 || vaccination.items.some(item => (item.vaccineName?.length ?? 0) > 255 || (item.informationSource?.length ?? 0) > 255)) return 'Tên vắc-xin và nguồn thông tin tối đa 255 ký tự.'
    if (vaccination.items.some(item => item.date && (!validEntryDate(item.date) || item.date > entryDate || item.date > businessDate()))) return 'Ngày tiêm phải hợp lệ và không sau ngày nhập.'
  }
  if (disease.status === 'KNOWN' && !disease.description) return 'Vui lòng mô tả bệnh đã biết.'
  if ((disease.description?.length ?? 0) > 1000 || (hist.reproductionNote?.length ?? 0) > 1000) return 'Mô tả tối đa 1.000 ký tự.'
  if (showReproduction && hist.repro === 'Có') {
    if (hist.pregnantAtEntry === 'YES' && (!Number.isInteger(hist.pregnancyMonths) || Number(hist.pregnancyMonths) < 1 || Number(hist.pregnancyMonths) > 9)) return 'Vui lòng nhập số tháng mang thai từ 1 đến 9.'
    if (!Number.isInteger(hist.earlierCalvings) || Number(hist.earlierCalvings) < 0 || Number(hist.earlierCalvings) > 15) return 'Vui lòng nhập số lứa đã đẻ từ 0 đến 15.'
  }
  return null
}

export function entryHistorySummary(hist: EntryHistory, female: boolean): string {
  const declarations = historyDeclarations(hist)
  return [`Tiêm: ${hist.vaccine}${declarations.vaccination.items.length ? ` · ${declarations.vaccination.items.length} vắc-xin` : ''}`,
    `Bệnh: ${hist.disease}`, ...(female ? [`Sinh sản: ${hist.repro}${hist.repro === 'Có' ? ` · ${hist.earlierCalvings ?? 0} lứa${hist.pregnantAtEntry === 'YES' ? ` · mang thai ~${hist.pregnancyMonths ?? '?'} tháng` : ''}` : ''}`] : [])].join(' | ')
}
