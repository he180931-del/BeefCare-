import { businessDate } from '../../../shared/lib/date/farmTime'
import type { EntryCow, EntryType } from '../types'

type ValidationInput = {
  date?: string; type?: EntryType; sourceId?: string; receiver?: string; cows?: EntryCow[]; pricing?: 'kg' | 'con'
  paid?: number; total?: number; method?: string; today?: string
}

export const entryToday = businessDate

const purchaseWeightError = (cow: EntryCow, pricing: 'kg' | 'con', forPost = true): string | null => {
  const weight = Number(cow.weight)
  if (forPost && pricing === 'kg' && weight === 0) return 'cân nhập phải lớn hơn 0 kg.'
  if (!Number.isFinite(weight) || weight < 0 || (weight > 0 && (weight < 1 || weight > 1500))) return 'cân nhập phải từ 1 đến 1.500 kg.'
  // Purchase form infers MEASURED; legacy / Excel ESTIMATED stays supported.
  return null
}

/** Drafts may omit a weight; entered weights must always have a valid range/basis. */
export function validateEntryWeights(cows: EntryCow[], pricing: 'kg' | 'con'): string | null {
  for (const [index, cow] of cows.entries()) {
    const error = purchaseWeightError(cow, pricing, false)
    if (error) return `Con #${index + 1}: ${error}`
  }
  return null
}

export const missingKgWeightLines = (cows: EntryCow[], pricing: 'kg' | 'con'): number[] => pricing === 'kg'
  ? cows.flatMap((cow, index) => Number(cow.weight) === 0 ? [index + 1] : [])
  : []

/** Field and inter-field rules required before the editor can post a voucher. */
export function validateEntryForPost(input: ValidationInput): string | null {
  const today = input.today ?? entryToday()
  if (!input.date) return 'Ngày nhập là bắt buộc.'
  if (input.date > today) return 'Ngày nhập không được ở tương lai.'
  if (input.type === 'Mua ngoài' && !String(input.sourceId ?? '').trim()) return 'Vui lòng chọn người bán.'
  // receiver undefined = máy chủ tự ghi người tạo theo phiên, không cần nhập tay.
  if (input.type === 'Mua ngoài' && input.receiver !== undefined && !input.receiver.trim()) return 'Vui lòng nhập người thực hiện nhập đàn.'
  const cows = input.cows ?? []
  if (!cows.length) return 'Phiếu nhập phải có ít nhất một con bò.'
  for (const [index, cow] of cows.entries()) {
    const line = `Con #${index + 1}`
    if (!String(cow.breed ?? '').trim()) return `${line}: vui lòng chọn giống.`
    if (!String(cow.sex ?? '').trim()) return `${line}: giới tính là bắt buộc.`
    if (!String(cow.purpose ?? '').trim()) return `${line}: vui lòng chọn mục đích nuôi.`
    if (!String(cow.stage ?? '').trim()) return `${line}: vui lòng chọn giai đoạn sinh trưởng.`
    if (!String(cow.barn ?? '').trim()) return `${line}: vui lòng chọn chuồng nhận.`
    if (input.type === 'Mua ngoài') {
      if (typeof cow.quarantineUntil === 'string' && cow.quarantineUntil && cow.quarantineUntil < input.date) return `${line}: cách ly nhập đàn đến không được trước ngày nhập.`
      const weightError = purchaseWeightError(cow, input.pricing ?? cow.pricing ?? 'kg')
      if (weightError) return `${line}: ${weightError}`
    } else if ((cow.pricing ?? input.pricing ?? 'kg') === 'kg') {
      const weightBasis = cow.weightBasis ?? (Number(cow.weight) > 0 ? 'MEASURED' : null)
      if (!weightBasis) return `${line}: vui lòng chọn cơ sở cân.`
      if (!Number.isFinite(Number(cow.weight)) || Number(cow.weight) <= 0) return `${line}: cân nhập phải lớn hơn 0 kg.`
    }
    if (input.type === 'Mua ngoài' && (!Number.isFinite(Number(cow.unitPrice)) || Number(cow.unitPrice) <= 0)) return `${line}: đơn giá phải lớn hơn 0.`
    const hist = cow.hist ?? { vaccine: '', disease: '', repro: '' }
    if (hist.vaccine === 'Có' && !String(hist.vaccineNote ?? '').trim()) return `${line}: cần nhập thông tin tiêm phòng.`
    if (hist.disease === 'Có' && !String((hist as Record<string, unknown>).diseaseNote ?? '').trim()) return `${line}: cần mô tả bệnh đã biết.`
    if (hist.repro === 'Có' && hist.pregnantAtEntry === 'YES' && (!Number.isFinite(Number((hist as Record<string, unknown>).pregnancyMonths)) || Number((hist as Record<string, unknown>).pregnancyMonths) < 1 || Number((hist as Record<string, unknown>).pregnancyMonths) > 9)) return `${line}: cần nhập số tháng mang thai từ 1 đến 9.`
  }
  const paid = Number(input.paid ?? 0)
  if (paid > 0 && !String(input.method ?? '').trim()) return 'Vui lòng chọn phương thức thanh toán.'
  if (paid > Number(input.total ?? 0)) return 'Số tiền đã thanh toán không được vượt quá tổng phải trả.'
  return null
}
