// Dữ liệu phiếu nhập (thuộc worker "Nhập đàn").
export const initialImports = [
  { id: 'PN-2026-0012', date: '2026-10-22', type: 'Mua ngoài', source: 'Hộ ông Lê Văn C – Sơn Tây · 2 con cân ước tính', count: 3, weight: 719, total: 61625000, debt: 21625000, status: 'Nháp' },
  { id: 'PN-2026-0013', date: '2026-10-22', type: 'Bê sinh tại trại', source: 'Bê của BC-000093, BC-000108', count: 2, weight: 51, total: null, debt: null, status: 'Nháp' },
  {
    id: 'PN-2026-0011', date: '2026-10-17', type: 'Mua ngoài', source: 'Chợ bò Tòng Bạt – Ba Vì · KD-HN-2026-004390', count: 1, weight: 218, total: 18530000, debt: 8530000, status: 'Đã nhập',
    detail: {
      sourceName: 'Chợ bò Tòng Bạt – Ba Vì', quarantine: 'KD-HN-2026-004390', phone: '0903 111 222', plate: '29C-118.46', by: 'T. Q. Long · 17/10/2026 10:20', note: 'Nhận đủ 1 con, thể trạng bình thường',
      cows: [{ code: 'BC-000248', tag: 'VN-0480', breed: 'Zebu đỏ · Cái', weight: 218, barn: 'A2 – Bò cái', current: 'ACTIVE · A2', amount: 18530000 }], cowsTotal: 18530000, freight: 0,
      payments: [{ date: '17/10/2026', by: 'T. Q. Long', method: 'Chuyển khoản', ref: 'FT26290417702', amount: 10000000 }], docs: [{ ext: 'PDF', name: 'giay-kiem-dich-HN-004390.pdf' }],
      history: ['17/10 10:05 · T. Q. Long tạo phiếu nháp', '17/10 10:20 · T. Q. Long lưu & tạo hồ sơ 1 con (BC-000248)', '17/10 10:21 · In 1 tem QR', '17/10 10:25 · T. Q. Long ghi nhận thanh toán 10.000.000 đ'],
    },
  },
  { id: 'PN-2026-0010', date: '2026-10-14', type: 'Bê sinh tại trại', source: 'Bê của BC-000087 · sinh 14/10/2026', count: 1, weight: 24, total: null, debt: null, status: 'Đã nhập' },
  {
    id: 'PN-2026-0009', date: '2026-10-02', type: 'Mua ngoài', source: 'Trại giống Mộc Châu – Sơn La · KD-SL-2026-00871', count: 4, weight: 1420, total: 136000000, debt: 0, status: 'Đã nhập',
    detail: {
      sourceName: 'Trại giống Mộc Châu – Sơn La', quarantine: 'KD-SL-2026-00871', phone: '0912 888 456', plate: '26C-045.12',
      by: 'T. Q. Long · 02/10/2026 09:40', note: 'Nhận đủ 4 con, 1 con trầy chân nhẹ – theo dõi',
      cows: [
        { code: 'BC-000239', tag: 'VN-0471', breed: 'Brahman đỏ · Đực', weight: 410, barn: 'B2 – Đực giống', current: 'ACTIVE · B2', amount: 38950000 },
        { code: 'BC-000240', tag: 'VN-0472', breed: 'Brahman đỏ · Cái', weight: 352, barn: 'A2 – Bò cái', current: 'ACTIVE · A2', amount: 33440000 },
        { code: 'BC-000241', tag: 'VN-0473', breed: 'Brahman đỏ · Cái', weight: 318, barn: 'A2 – Bò cái', current: 'ACTIVE · A2', amount: 30210000 },
        { code: 'BC-000242', tag: 'VN-0474', breed: 'Brahman đỏ · Cái', weight: 340, barn: 'A2 – Bò cái', current: 'ACTIVE · A2', amount: 32300000 },
      ],
      cowsTotal: 134900000, freight: 1100000,
      payments: [
        { date: '02/10/2026', by: 'T. Q. Long', method: 'Chuyển khoản', ref: 'FT26275318804', amount: 100000000 },
        { date: '15/10/2026', by: 'N. V. Hùng', method: 'Tiền mặt', ref: 'PT-1510-01', amount: 36000000 },
      ],
      docs: [{ ext: 'PDF', name: 'giay-kiem-dich-SL-00871.pdf' }, { ext: 'PDF', name: 'hop-dong-mua-ban-0210.pdf' }],
      history: [
        '02/10 08:15 · T. Q. Long tạo phiếu nháp',
        '02/10 09:40 · T. Q. Long lưu & tạo hồ sơ 4 con (BC-000239 → BC-000242)',
        '02/10 09:41 · In 4 tem QR',
        '15/10 16:05 · N. V. Hùng ghi nhận thanh toán 36.000.000 đ',
      ],
    },
  },
  { id: 'PN-2026-0008', date: '2026-09-28', type: 'Mua ngoài', source: 'Hộ dân xã Yên Bài · Hủy: ghi nhầm nguồn bán', count: 2, weight: 410, total: 33800000, debt: null, status: 'Đã hủy' },
  { id: 'PN-2026-0007', date: '2026-09-21', type: 'Bê sinh tại trại', source: 'Bê của BC-000061, BC-000033', count: 2, weight: 49, total: null, debt: null, status: 'Đã nhập' },
]

// Ngày làm việc hiện tại của luồng nhập (dùng cho ngày mặc định và lịch sử).
export const TODAY = '2026-10-22'

// Phiếu cũ (trước 01/07/2026) không nằm trong danh sách mẫu, chỉ dùng cho số liệu tổng.
export const OLDER = { total: 7, done: 7, drafts: 0, cancelled: 0, cows: 39, buyCows: 26, calfCows: 13, buyMoney: 357870000 }

// Chuồng nhận riêng của luồng nhập (khác BARNS của mock: B1 = 45 con theo Figma nhập đàn).
export const IMPORT_BARNS = [
  { code: 'A1', name: 'A1 – Bò cái', count: 29, capacity: 30 },
  { code: 'A2', name: 'A2 – Bò cái', count: 18, capacity: 30 },
  { code: 'B1', name: 'B1 – Vỗ béo', count: 45, capacity: 50 },
  { code: 'B2', name: 'B2 – Đực giống', count: 6, capacity: 10 },
  { code: 'C1', name: 'C1 – Cách ly', count: 0, capacity: 10, showName: true },
]

export const STAGES = [
  { value: 'Bê theo mẹ', label: 'Bê theo mẹ' },
  { value: 'Bò tơ', label: 'Bò tơ / hậu bị' },
  { value: 'Vỗ béo', label: 'Vỗ béo' },
  { value: 'Bò cái', label: 'Bò cái' },
  { value: 'Đực giống', label: 'Đực giống' },
  { value: 'Chưa xác định', label: 'Chưa xác định' },
]
export const PURPOSE_OPTIONS = ['Bò sinh sản · loại Sinh sản', 'Nuôi thương phẩm · loại Vỗ béo', 'Giữ giống · loại Đực giống', 'Chưa xác định']
export const SOURCE_FILTERS = ['Hộ ông Lê Văn C – Sơn Tây', 'Chợ bò Tòng Bạt – Ba Vì', 'Trại giống Mộc Châu – Sơn La', 'Hộ dân xã Yên Bài']
export const BREEDS = ['Lai Sind', 'Brahman lai', 'Brahman đỏ', 'Zebu', 'Zebu đỏ']

// Một con trong phiếu nhập. dob = 'YYYY-MM'.
export const INITIAL_COWS = [
  { tag: 'VN-0503', name: '', breed: 'Lai Sind', sex: 'Cái', dob: '2025-04', dobAccuracy: 'Ước tính', stage: 'Bò tơ', purpose: 'Bò sinh sản · loại Sinh sản', weight: 236, estimated: true, barn: 'A1', unitPrice: 85000, hist: { vaccine: 'Có', vaccineNote: 'LMLM · 03/2026 · theo sổ tiêm chủ cũ', disease: 'Không rõ', repro: 'Không rõ' } },
  { tag: 'VN-0504', name: '', breed: 'Brahman lai', sex: 'Đực', dob: '2025-08', dobAccuracy: 'Ước tính', stage: 'Vỗ béo', purpose: 'Nuôi thương phẩm · loại Vỗ béo', weight: 285, estimated: false, barn: 'B1', unitPrice: 85000, hist: { vaccine: 'Không rõ', vaccineNote: '', disease: 'Không rõ', repro: 'Không rõ' } },
  { tag: '', name: '', breed: 'Zebu', sex: 'Cái', dob: '2025-10', dobAccuracy: 'Ước tính', stage: 'Chưa xác định', purpose: 'Chưa xác định', weight: 198, estimated: true, barn: 'C1', unitPrice: 80000, hist: { vaccine: 'Không rõ', vaccineNote: '', disease: 'Không rõ', repro: 'Không rõ' } },
]

export const blankCow = () => ({
  tag: '', name: '', breed: '', sex: 'Cái', dob: '2025-10', dobAccuracy: 'Không rõ', stage: 'Chưa xác định', purpose: 'Chưa xác định',
  weight: 0, estimated: false, barn: 'A1', unitPrice: 85000,
  hist: { vaccine: 'Không rõ', vaccineNote: '', disease: 'Không rõ', repro: 'Không rõ' },
})

// Tuổi (tháng) tại ngày nhập: dateIso 'YYYY-MM-DD', dob 'YYYY-MM'.
export const ageOf = (dob: string, dateIso: string) => {
  if (!dob || !dateIso) return 0
  const [y, m] = dateIso.split('-').map(Number)
  const [dy, dm] = dob.split('-').map(Number)
  return y * 12 + m - (dy * 12 + dm)
}

// Dữ liệu mẫu của file Excel (12 dòng; line = số dòng trong tệp, bắt đầu từ 2).
export const EXCEL_ROWS = [
  { line: 2, tag: 'VN-0505', breed: 'Lai Sind', sex: 'Cái', kg: 241, barn: 'A1', result: { tone: 'ok', text: 'Hợp lệ' } },
  { line: 3, tag: 'VN-0506', breed: 'Zebu', sex: 'Cái', kg: 230, barn: 'A2', result: { tone: 'warn', text: 'Cảnh báo · thiếu ngày sinh → "Không rõ"' } },
  { line: 4, tag: 'VN-0498', breed: 'Brahman lai', sex: 'Đực', kg: 290, barn: 'B1', result: { tone: 'err', text: 'Lỗi · thẻ tai đã dùng cho BC-000231' } },
  { line: 5, tag: 'VN-0507', breed: 'Lai Sind', sex: 'Đực', kg: 265, barn: 'A1', result: { tone: 'err', text: 'Lỗi · A1 không nhận bò đực / đã đầy' } },
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ line: 6 + i, tag: `VN-0${508 + i}`, breed: 'Lai Sind', sex: 'Cái', kg: 220 + (i + 1) * 5, barn: 'A2', result: { tone: 'ok', text: 'Hợp lệ' } })),
]
