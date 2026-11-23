import { businessDate } from '../../../shared/lib/date/farmTime'
import type { EntryCow, EntryType, NewEntrySeller } from '../types'

type ValidationInput = {
  date?: string; type?: EntryType; sourceId?: string; receiver?: string; cows?: EntryCow[]; pricing?: 'kg' | 'con'
  paid?: number; total?: number; freight?: number; method?: string; due?: string; newSeller?: NewEntrySeller | null; today?: string
}

type PaymentErrors = Partial<Record<'freight' | 'paid' | 'method' | 'due', string>>

export const entryToday = businessDate

/** Voucher-level money rules are shared by direct payment fields and posting. */
export function validateEntryPayment({ freight, paid, total, method, due, date }: Pick<ValidationInput, 'freight' | 'paid' | 'total' | 'method' | 'due' | 'date'>): PaymentErrors {
  const errors: PaymentErrors = {}
  const transportFee = Number(freight ?? 0)
  const amountPaid = Number(paid ?? 0)
  const payable = Number(total ?? 0)
  if (!Number.isFinite(transportFee) || transportFee < 0) errors.freight = 'Phí vận chuyển phải là số không âm.'
  if (!Number.isFinite(amountPaid) || amountPaid < 0) errors.paid = 'Trả trước phải là số không âm.'
  else if (Number.isFinite(payable) && amountPaid > payable) errors.paid = 'Số tiền đã thanh toán không được vượt quá tổng phải trả.'
  if (amountPaid > 0 && !String(method ?? '').trim()) errors.method = 'Vui lòng chọn phương thức thanh toán.'
  if (due && date && due < date) errors.due = 'Hạn trả phần nợ không được trước ngày nhập.'
  return errors
}

const firstPaymentError = (errors: PaymentErrors): string | null => errors.freight ?? errors.paid ?? errors.method ?? errors.due ?? null

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
  const newSeller = input.newSeller
  if (input.type === 'Mua ngoài' && !String(input.sourceId ?? '').trim() && !String(newSeller?.name ?? '').trim()) return 'Vui lòng chọn hoặc thêm nguồn bán.'
  if (input.type === 'Mua ngoài' && newSeller) {
    const name = newSeller.name.trim()
    if (!name) return 'Tên nguồn bán là bắt buộc.'
    if (name.length > 150) return 'Tên nguồn bán tối đa 150 ký tự.'
    if (newSeller.phone.trim().length > 50) return 'Số điện thoại tối đa 50 ký tự.'
    if (newSeller.area.trim().length > 255) return 'Khu vực tối đa 255 ký tự.'
  }
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
  return firstPaymentError(validateEntryPayment(input))
}
