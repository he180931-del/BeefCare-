import type { BankTransactionChoice, Farm, FinanceRecord, PmNotice, Receipt, RecordHistory } from '../types'

export const DEMO_NOW = '2026-10-19T21:00:00'
export const PM_NAME = 'Đỗ Minh Quân'

export const FARMS: Farm[] = [
  { id: 1, name: 'Trại bò Yên Bài – Ba Vì' },
  { id: 2, name: 'Trại Mai Pha' },
  { id: 3, name: 'Trại Vân Hòa' },
  { id: 4, name: 'Trại Ba Trại' },
  { id: 5, name: 'Trại Cẩm Lĩnh' },
  { id: 6, name: 'Trại Suối Hai' },
  { id: 7, name: 'Trại Tản Viên' },
  { id: 8, name: 'Trại Sơn Đà' },
  { id: 9, name: 'Trại Phú Cường' },
  { id: 10, name: 'Trại Minh Quang' },
]
const farmName = (id: number) => FARMS.find((f) => f.id === id)?.name ?? ''

const PRICE: Record<1 | 2 | 3, number> = { 1: 1200000, 2: 2160000, 3: 3060000 }
const pad = (n: number) => String(n).padStart(2, '0')
const addYears = (date: string, y: number) => `${Number(date.slice(0, 4)) + y}${date.slice(4)}`

function receipt(no: number, farmId: number, term: 1 | 2 | 3, bankPaidAt: string, paymentCode: string, evidenceNo: number, over: Partial<Receipt> = {}): Receipt {
  const day = bankPaidAt.slice(0, 10)
  return {
    code: `RC-26-${String(no).padStart(4, '0')}`, paymentCode, farmId, farmName: farmName(farmId), termYears: term, amountVnd: PRICE[term],
    priceVersion: 'v3', bankPaidAt, bankFirstSeenAt: bankPaidAt.slice(0, 17) + '14', confirmedAt: `${day}T${pad(Number(bankPaidAt.slice(11, 13)) + 1)}:${bankPaidAt.slice(14, 16)}:00`,
    confirmedBy: 'SEPAY', periodStart: day, periodEnd: addYears(day, term), evidenceCode: `EV-${String(evidenceNo).padStart(4, '0')}`, evidenceLabel: 'SePay LIVE beefcare-main', ...over,
  }
}

const NAMED: Receipt[] = [
  receipt(412, 1, 1, '2026-10-18T09:05:12', 'BCF7K2Q9', 843, { confirmedAt: '2026-10-18T10:18:00', confirmedBy: 'PM_ACCEPT', periodStart: '2026-11-15', periodEnd: '2027-11-14' }),
  receipt(411, 3, 2, '2026-10-18T08:41:05', 'BCA9X2M1', 842),
  receipt(408, 2, 3, '2026-10-16T20:15:40', 'BCM3T7R4', 839),
  receipt(402, 4, 1, '2026-10-14T10:02:31', 'BCB6N1K8', 833),
  receipt(397, 5, 1, '2026-10-12T07:44:09', 'BCC2L5H6', 828),
]
// 32 biên nhận còn lại: 9 gói 2 năm + 23 gói 3 năm, để tổng tháng 10 đúng 98.640.000 đ.
const OTHERS: Receipt[] = Array.from({ length: 32 }, (_, i) => {
  const term: 2 | 3 = i % 7 === 2 || i % 7 === 5 ? 2 : 3
  return { term, i }
}).reduce<Receipt[]>((acc, { term, i }) => {
  const day = 11 - Math.floor(i / 3)
  const at = `2026-10-${pad(day)}T${pad(8 + (i % 9))}:${pad(10 + i)}:20`
  acc.push(receipt(396 - i, 6 + (i % 5), term, at, `BC${(i * 7919 + 100003).toString(36).toUpperCase().slice(0, 6).padEnd(6, 'X')}`, 827 - i))
  return acc
}, [])

export const RECEIPTS_SEED: Receipt[] = [...NAMED, ...OTHERS]

const hist = (items: [string, string, string?, string?][]): RecordHistory[] => items.map(([action, changedAt, reason, detail], i) => ({ id: i + 1, action, changedAt, actor: PM_NAME, reason, detail }))

function rec(id: number, over: Partial<FinanceRecord> & Pick<FinanceRecord, 'recordCode' | 'type' | 'category' | 'amountVnd' | 'occurredOn' | 'state'>): FinanceRecord {
  const scope = over.scope ?? 'GENERAL'
  const farmId = over.farmId ?? null
  const base: FinanceRecord = {
    id, scope, farmId, farmName: farmId ? farmName(farmId) : '', documentNumber: '', description: '', sourceType: 'MANUAL', sourceReference: '', sourceEvidenceId: null,
    version: 3, createdAt: `${over.occurredOn}T09:00:00`, createdBy: PM_NAME, history: [], ...over,
  }
  if (!base.history.length) {
    base.history = hist([['Tạo nháp', base.createdAt], ...(base.state !== 'DRAFT' ? [['Ghi sổ', '2026-10-19T21:00:00'] as [string, string]] : [])])
    if (base.state !== 'DRAFT') { base.postedAt = '2026-10-19T21:00:00'; base.postedBy = PM_NAME }
  }
  return base
}

const FILLER_CATS: [string, string, 'INCOME' | 'EXPENSE'][] = [['Hạ tầng máy chủ', 'VPS tháng', 'EXPENSE'], ['Phí dịch vụ email', 'Gói gửi email', 'EXPENSE'], ['Đào tạo tại trại', 'Buổi hướng dẫn', 'INCOME'], ['Phí nhắn tin SMS', 'SMS OTP', 'EXPENSE']]
const FILLERS = Array.from({ length: 16 }, (_, i) => {
  const [category, description, type] = FILLER_CATS[i % 4]
  const month = i < 8 ? '08' : '09'
  return rec(60 + i, { recordCode: `FR-${String(76 + i).padStart(4, '0')}`, type, category, description: `${description} ${month}/2026`, amountVnd: 400000 + i * 50000, occurredOn: `2026-${month}-${pad(5 + (i % 8) * 3)}`, state: 'POSTED' })
})

export const RECORDS_SEED: FinanceRecord[] = [
  rec(104, { recordCode: 'FR-0104', type: 'EXPENSE', category: 'Hạ tầng máy chủ', description: 'VPS & CDN tháng 10', amountVnd: 3200000, occurredOn: '2026-10-15', documentNumber: 'VPS-CDN-1026', state: 'POSTED' }),
  rec(103, { recordCode: 'FR-0103', type: 'EXPENSE', category: 'Phí dịch vụ email', description: 'Gói gửi email 50k/tháng', amountVnd: 650000, occurredOn: '2026-10-12', state: 'POSTED' }),
  rec(101, { recordCode: 'FR-0101', type: 'INCOME', category: 'Đào tạo tại trại', description: 'Buổi hướng dẫn quét QR & nhập lịch sử', amountVnd: 1500000, occurredOn: '2026-10-10', scope: 'FARM', farmId: 2, sourceType: 'BANK', sourceEvidenceId: 1010, sourceReference: 'SePay / LIVE / beefcare-main / TX-TRAIN-1010', state: 'POSTED' }),
  rec(108, {
    recordCode: 'FR-0108', type: 'EXPENSE', category: 'In thẻ tai QR', description: 'In 300 thẻ tai QR chống nước cho đàn Zebu đỏ', amountVnd: 2700000, occurredOn: '2026-10-08', scope: 'FARM', farmId: 1,
    documentNumber: 'HĐ 0001287 – In ấn Sơn Tây', state: 'DRAFT', version: 2, createdAt: '2026-10-08T14:22:00',
    history: hist([['Tạo nháp', '2026-10-08T14:22:00'], ['Sửa số tiền', '2026-10-09T09:10:00', undefined, '2.500.000 → 2.700.000']]),
  }),
  rec(95, {
    recordCode: 'FR-0095', type: 'EXPENSE', category: 'Hạ tầng máy chủ', description: 'Ghi trùng khoản VPS', amountVnd: 3200000, occurredOn: '2026-10-01', state: 'VOID', version: 4,
    voidedAt: '2026-10-19T21:05:00', voidedBy: PM_NAME, voidReason: 'Ghi trùng khoản VPS; loại khoản trùng khỏi báo cáo', postedAt: '2026-10-19T21:00:00', postedBy: PM_NAME,
    history: hist([['Tạo nháp', '2026-10-08T14:22:00'], ['Ghi sổ', '2026-10-19T21:00:00'], ['Hủy bỏ', '2026-10-19T21:05:00', 'Ghi trùng khoản VPS; loại khoản trùng khỏi báo cáo']]),
  }),
  rec(92, { recordCode: 'FR-0092', type: 'EXPENSE', category: 'Phí nhắn tin SMS', description: 'SMS OTP tháng 10', amountVnd: 2700000, occurredOn: '2026-10-01', state: 'POSTED' }),
  rec(94, { recordCode: 'FR-0094', type: 'EXPENSE', category: 'Quảng bá', description: 'Bài quảng bá tháng 9 (nhập nhầm)', amountVnd: 900000, occurredOn: '2026-09-28', state: 'VOID', version: 4, voidedAt: '2026-09-30T10:00:00', voidedBy: PM_NAME, voidReason: 'Nhập nhầm số tiền', postedAt: '2026-09-29T09:00:00', postedBy: PM_NAME }),
  rec(106, { recordCode: 'FR-0106', type: 'EXPENSE', category: 'Quảng bá', description: 'Banner hội chợ nông nghiệp', amountVnd: 1100000, occurredOn: '2026-09-29', state: 'DRAFT', version: 1 }),
  ...FILLERS,
]

export const BANK_SEED: BankTransactionChoice[] = [
  { sourceReference: 'SePay / LIVE / beefcare-main / FT26291000843', transactionId: 843, amount: 1200000, bankPaidAt: '2026-10-18T09:05:12', direction: 'IN', bank: 'SePay', paymentReference: 'BCF7K2Q9', claimedBy: 'Thanh toán BCF7K2Q9', evidenceCode: 'EV-0843' },
  { sourceReference: 'SePay / LIVE / beefcare-main / TX-TRAIN-1010', transactionId: 1010, amount: 1500000, bankPaidAt: '2026-10-10T14:20:00', direction: 'IN', bank: 'SePay', paymentReference: 'FT26290…', evidenceCode: 'EV-0838' },
  { sourceReference: 'SePay / LIVE / beefcare-main / TX-TRAIN-1014', transactionId: 1014, amount: 800000, bankPaidAt: '2026-10-14T16:40:00', direction: 'IN', bank: 'SePay', paymentReference: 'FT26294…', evidenceCode: 'EV-0846' },
  { sourceReference: 'SePay / LIVE / beefcare-main / TX-PRINT-1008', transactionId: 1008, amount: 2700000, bankPaidAt: '2026-10-08T11:12:00', direction: 'OUT', bank: 'SePay', paymentReference: 'FT26288…', evidenceCode: 'EV-0835' },
]

const n = (id: number, kind: 'RECON' | 'SUPPORT', title: string, summary: string, createdTime: string, unread: boolean, actionLabel: string, href: string): PmNotice => ({ id, kind, title, summary, createdTime, readTime: unread ? null : createdTime, actionLabel, href })
export const NOTICES_SEED: PmNotice[] = [
  n(1, 'RECON', 'Chứng từ FT26291…842 không khớp mã thanh toán', '1.200.000đ · 09:05 18/10 · ứng viên BCF7K2Q9', '2026-10-19T20:55:00', true, 'Xem xét', '/nen-tang/thanh-toan'),
  n(2, 'RECON', 'CS gửi yêu cầu nội bộ IR-077', 'TK-1042 · Kiểm tra giao dịch SePay', '2026-10-19T20:42:00', true, 'Mở yêu cầu', '/nen-tang/yeu-cau'),
  n(3, 'RECON', 'Chứng từ cho yêu cầu đã hết hạn', 'FT26290…177 · BCE3P8L2 · thời điểm ngân hàng ngoài hạn', '2026-10-18T22:31:00', true, 'Xem xét', '/nen-tang/thanh-toan'),
  n(4, 'RECON', '1 chứng từ đang khóa chờ hoàn tiền ngoài hệ thống', 'Cần ghi mã giao dịch hoàn khi đã thực hiện', '2026-10-18T16:00:00', false, 'Xem', '/nen-tang/thanh-toan'),
  n(5, 'RECON', 'SePay tự xác nhận 6 thanh toán', 'Ngày 17/10/2026', '2026-10-17T23:59:00', false, 'Xem', '/nen-tang/thanh-toan'),
  n(6, 'SUPPORT', 'CS Phạm Thu Hà giao yêu cầu nội bộ IR-077 cho bạn', 'TK-1042 · Kiểm tra giao dịch SePay 09:05 · 1.200.000đ', '2026-10-19T20:58:00', true, 'Mở yêu cầu', '/nen-tang/yeu-cau'),
  n(7, 'SUPPORT', 'CS bổ sung ghi chú cho IR-077', '"Khách gửi thêm ảnh biên lai chuyển khoản"', '2026-10-19T20:52:00', true, 'Xem', '/nen-tang/yeu-cau'),
  n(8, 'SUPPORT', 'IR-071 đã được CS hủy – không cần xử lý', 'Lý do: Chủ trại tự giải quyết', '2026-10-19T07:58:00', false, 'Xem', '/nen-tang/yeu-cau'),
  n(9, 'SUPPORT', 'Nhắc: IR-074 chưa có kết quả sau 4 giờ', 'TK-1031 · Kiểm tra trạng thái gói Trại Suối Hai', '2026-10-18T17:30:00', false, 'Mở yêu cầu', '/nen-tang/yeu-cau'),
  n(10, 'SUPPORT', 'CS đã nhận kết quả IR-069 của bạn', 'Yêu cầu chuyển sang Hoàn thành', '2026-10-18T11:20:00', false, 'Xem', '/nen-tang/yeu-cau'),
]
