import type { EntryCow, EntryType } from '../../types'

// The supported farm time zones all use UTC+07:00, matching FarmClock.
const farmDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })

type ValidationInput = {
  date?: string
  type?: EntryType
  sourceId?: string
  receiver?: string
  cows?: EntryCow[]
  pricing?: 'kg' | 'con'
  paid?: number
  total?: number
  method?: string
  today?: string
}

export function entryToday(): string {
  const parts = Object.fromEntries(farmDate.formatToParts(new Date()).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Rules required to transition an entry voucher from DRAFT to POSTED. */
export function validateEntryForPost(input: ValidationInput): string | null {
  const today = input.today ?? entryToday()
  if (!input.date) return 'Ngày nhập là bắt buộc.'
  if (input.date > today) return 'Ngày nhập không được ở tương lai.'
  if (input.type === 'Mua ngoài' && !String(input.sourceId ?? '').trim()) return 'Vui lòng chọn người bán.'
  // The farm-born form has no receiver field (the recorder is the signed-in user).
  if (input.type === 'Mua ngoài' && !String(input.receiver ?? '').trim()) return 'Vui lòng nhập người thực hiện nhập đàn.'
  const cows = input.cows ?? []
  if (!cows.length) return 'Phiếu nhập phải có ít nhất một con bò.'
  for (const [index, cow] of cows.entries()) {
    const line = `Con #${index + 1}`
    // Ear tag may stay empty (SRS: tag later); the line still gets a cattle code and QR.
    if (!String(cow.breed ?? '').trim()) return `${line}: vui lòng chọn giống.`
    if (!String(cow.sex ?? '').trim()) return `${line}: giới tính là bắt buộc.`
    if (!String(cow.purpose ?? '').trim()) return `${line}: vui lòng chọn mục đích nuôi.`
    if (!String(cow.stage ?? '').trim()) return `${line}: vui lòng chọn giai đoạn sinh trưởng.`
    if (!String(cow.barn ?? '').trim()) return `${line}: vui lòng chọn chuồng nhận.`
    const linePricing = cow.pricing ?? input.pricing ?? 'kg'
    if (linePricing === 'kg') {
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
