import { penMap } from './pensData.js'

export const TODAY = '2026-10-20'
export const MANAGER = 'Trần Quốc Long'
export const OWNER = 'Nguyễn Văn Hùng'
export const STAGES = ['Bê', 'Bò tơ', 'Vỗ béo', 'Bò cái sinh sản', 'Đực giống', 'Chưa xác định']
export const PURPOSES = ['Sinh sản', 'Vỗ béo', 'Đực giống', 'Chưa xác định']
export const BREEDS = ['Zebu đỏ', 'Lai Sind', 'Brahman đỏ']
export const QR_REASONS = ['Thẻ bị hỏng', 'Thẻ bị mất', 'Mã mờ, không quét được', 'Khác']
// Backward-compatible name used by the screens; sourced from canonical pens.
export const BARNS0 = penMap
// Phần đàn KHÔNG nằm trong các bò mẫu: tổng 248 = 241 + 7 bò trong danh sách.
export const BASELINE = { 'Bò cái sinh sản': 83, 'Bò tơ': 36, 'Vỗ béo': 45, 'Bê': 68, 'Đực giống': 9, 'Chưa xác định': 0 }
export const EXPORTED_COUNT = 17

const RECORDER = 'Nguyễn Văn Hùng'

// Bò có đủ hồ sơ mẫu theo Figma; các trường chưa nêu được điền mặc định.
const auto = (o) => ({
  name: '', tag: '', weightEst: false, health: null, repro: null, headerBadges: [['Khỏe mạnh', 'ok']],
  inList: true, status: 'ACTIVE', importRecord: null, mother: '—', father: 'Ngoài trại · tinh BRD-118', description: '—',
  internalId: `4f7b9e21-${o.code.slice(-4)}-a0c3`, birth: '—', source: `Sinh tại trại · ${o.birth}`,
  purposeSince: '01/03/2024', barnSince: '01/03/2024', qrFrom: '05/2024', qrFromWho: RECORDER,
  care: {
    last: o.weight != null ? `${o.weight} kg · ${o.weightDate}` : '—', adg: '—', bcs: '—', healthCase: 'Không có ca mở', repro: '—',
    vaccine: { label: 'Đủ mũi tiêm', tone: 'ok' }, reminders: [],
  },
  ...o,
  qrHistory: [{ code: o.qr, status: 'ACTIVE', from: o.qrFrom || '05/2024', to: '—', reason: 'Cấp lần đầu', by: RECORDER }],
  barnHistory: [{ from: o.barnSince || '01/03/2024', to: '—', barn: BARNS0[o.barn].name, reason: 'Phân chuồng ban đầu', by: RECORDER }],
  events: [
    ...(o.weight != null ? [{ id: `${o.code}-w`, at: '2026-10-10T07:00', cat: 'weight', title: `Cân ${o.weight} kg`, badge: { label: 'Cân thực tế', tone: 'ok' }, detail: 'Cân điện tử tại chuồng', meta: `Xảy ra ${o.weightDate} · ${MANAGER}` }] : []),
    { id: `${o.code}-q`, at: '2024-05-01T08:00', cat: 'qr', title: 'Cấp thẻ QR', badge: { label: 'Tại trại', tone: 'info' }, detail: 'Cấp lần đầu', meta: `Ghi 05/2024 · ${RECORDER}` },
  ],
})

const COW_125 = {
  code: 'BC-000125', name: 'Hoa Đỏ', tag: 'VN-BV-0457', breed: 'Zebu đỏ', sex: 'Cái', ageShort: '4t 7th', ageLong: '4 tuổi 7 tháng', months: 55,
  barn: 'A1', purpose: 'Sinh sản', stage: 'Bò cái sinh sản', status: 'ACTIVE', inList: true, weight: 342, weightEst: false, weightDate: '12/10',
  health: { label: 'Khỏe', tone: 'ok' }, repro: { label: 'Mang thai', tone: 'info' },
  headerBadges: [['Khỏe mạnh', 'ok'], ['Đang mang thai', 'info']],
  internalId: 'c8f2a1e4-7b3d-4f19-9a6e-2c5d8b0f4e1a', birth: '12/03/2022', source: 'Sinh tại trại · 12/03/2022',
  purposeSince: '01/05/2023', barnSince: '20/05/2026', mother: 'BC-000032 “Mơ”', father: 'Ngoài trại · tinh BRD-118',
  description: 'Lông đỏ, đốm trắng trán', qr: 'QR-7F3K-0125',
  qrHistory: [{ code: 'QR-7F3K-0125', status: 'ACTIVE', from: '05/2024', to: '—', reason: 'Cấp lần đầu', by: RECORDER }],
  barnHistory: [
    { from: '20/05/2026', to: '—', barn: 'A1 – Bò cái sinh sản', reason: 'Hết thời gian nuôi con, quay lại nhóm sinh sản', by: MANAGER },
    { from: '12/02/2026', to: '20/05/2026', barn: 'A3 – Bê theo mẹ', reason: 'Đẻ lứa 2, nuôi con', by: MANAGER },
    { from: '01/11/2025', to: '12/02/2026', barn: 'D – Chuồng đẻ', reason: 'Cận đẻ', by: MANAGER },
    { from: '01/05/2023', to: '01/11/2025', barn: 'A1 – Bò cái sinh sản', reason: 'Bắt đầu mục đích sinh sản', by: RECORDER },
  ],
  events: [
    { id: 'e-125-5', at: '2026-10-12T07:00', cat: 'weight', title: 'Cân 342 kg · BCS 3,5', badge: { label: 'Cân thực tế', tone: 'ok' }, detail: 'Cân điện tử tại chuồng A1', meta: `Xảy ra 12/10 07:00 · ghi 12/10 07:05 · ${MANAGER}` },
    { id: 'e-125-4', at: '2026-09-17T08:20', cat: 'vaccine', title: 'Tiêm LMLM mũi 1', badge: { label: 'Tại trại', tone: 'info' }, detail: 'Aftopor · lô AFT-2608-03 · 2 ml · tiêm bắp', meta: `Xảy ra 17/09 08:20 · ghi 17/09 09:00 · ${MANAGER}` },
    { id: 'e-125-3', at: '2026-09-10T06:45', cat: 'weight', title: 'Cân 335 kg', badge: { label: 'Ước tính', tone: 'warn' }, detail: 'Thước dây', meta: `Xảy ra 10/09 06:45 · ghi 11/09 · ${MANAGER}` },
    { id: 'e-125-2', at: '2026-06-10T09:00', cat: 'repro', title: 'Khám thai: Có thai', badge: { label: 'Thực tế', tone: 'ok' }, detail: 'Siêu âm · BS Trần Văn Bình · DK đẻ 19/02/2027', meta: `Xảy ra 10/06 09:00 · ghi 10/06 10:30 · ${MANAGER}` },
    { id: 'e-125-1', at: '2026-05-20T00:00', cat: 'barn', title: 'Chuyển chuồng A3 → A1', badge: { label: 'Thực tế', tone: 'ok' }, detail: 'Hết thời gian nuôi con, quay lại nhóm sinh sản', meta: `Hiệu lực 20/05 · ghi 20/05 · ${MANAGER}` },
  ],
  importRecord: null,
  care: {
    last: '342 kg · 12/10', adg: '0,31 kg/ngày', bcs: '3,5 / 5', healthCase: 'Không có ca mở', repro: 'Mang thai · DK đẻ 19/02/2027',
    vaccine: { label: '1 mũi quá hạn', tone: 'err' },
    reminders: [{ title: 'LMLM mũi 2', due: { label: '15/10 · quá hạn', tone: 'err' } }, { title: 'Cân định kỳ', due: { label: '12/11' } }],
  },
}

const COW_142 = {
  code: 'BC-000142', name: '', tag: '', breed: 'Zebu đỏ', sex: 'Cái', ageShort: '14th', ageLong: '14 tháng', months: 14,
  barn: 'C1', purpose: 'Sinh sản', stage: 'Bò tơ', status: 'ACTIVE', inList: true, weight: 236, weightEst: false, weightDate: '15/10',
  health: { label: 'Khỏe', tone: 'ok' }, repro: { label: 'Động dục', tone: 'info' },
  headerBadges: [['Khỏe mạnh', 'ok']],
  internalId: '9d1e6a20-54c8-4b7e-8f31-0a7b2e6c9d42', birth: '15/08/2025', source: 'Sinh tại trại · 15/08/2025',
  purposeSince: '02/07/2026', barnSince: '02/07/2026', mother: 'BC-000087 “Mận”', father: 'Ngoài trại · tinh BRD-118',
  description: 'Lông đỏ nâu', qr: 'QR-5T8W-0142',
  qrHistory: [{ code: 'QR-5T8W-0142', status: 'ACTIVE', from: '08/2025', to: '—', reason: 'Cấp lần đầu', by: RECORDER }],
  barnHistory: [
    { from: '02/07/2026', to: '—', barn: 'C1 – Bò tơ', reason: 'Cai sữa, chuyển nhóm bò tơ', by: MANAGER },
    { from: '10/09/2025', to: '02/07/2026', barn: 'C2 – Bê cai sữa', reason: 'Sau cai sữa', by: MANAGER },
  ],
  events: [
    { id: 'e-142-1', at: '2026-10-15T07:00', cat: 'weight', title: 'Cân 236 kg', badge: { label: 'Cân thực tế', tone: 'ok' }, detail: 'Cân điện tử tại chuồng C1', meta: `Xảy ra 15/10 07:00 · ghi 15/10 · ${MANAGER}` },
    { id: 'e-142-0', at: '2025-08-15T08:00', cat: 'qr', title: 'Cấp thẻ QR', badge: { label: 'Tại trại', tone: 'info' }, detail: 'Cấp lần đầu', meta: `Ghi 08/2025 · ${RECORDER}` },
  ],
  importRecord: null,
  care: {
    last: '236 kg · 15/10', adg: '0,45 kg/ngày', bcs: '3,0 / 5', healthCase: 'Không có ca mở', repro: 'Động dục',
    vaccine: { label: 'Đủ mũi tiêm', tone: 'ok' }, reminders: [{ title: 'Cân định kỳ', due: { label: '12/11' } }],
  },
}

const COW_240 = {
  code: 'BC-000240', name: '', tag: 'VN-0472', breed: 'Brahman đỏ', sex: 'Cái', ageShort: '3t 5th', ageLong: '3 tuổi 5 tháng', months: 41,
  barn: 'A2', purpose: 'Sinh sản', stage: 'Bò cái sinh sản', status: 'ACTIVE', inList: false, weight: 352, weightEst: false, weightDate: '02/10',
  health: null, repro: null, headerBadges: [['Khỏe mạnh', 'ok']], headerAge: false,
  internalId: '3b6f0c52-1e9a-4d87-a4c0-7f2e9b1d6a08', birth: '05/2023 · ước tính', source: 'Mua ngoài · PN-2026-0009',
  purposeSince: '02/10/2026', barnSince: '02/10/2026', mother: '—', father: '—', description: '—', qr: 'QR-8B2F-0240',
  qrHistory: [{ code: 'QR-8B2F-0240', status: 'ACTIVE', from: '02/10/2026', to: '—', reason: 'Cấp khi nhập đàn', by: MANAGER }],
  barnHistory: [{ from: '02/10/2026', to: '—', barn: 'A2 – Bò cái sinh sản', reason: 'Nhập đàn', by: MANAGER }],
  events: [
    { id: 'e-240-2', at: '2026-10-02T09:00', cat: 'barn', title: 'Nhập đàn từ phiếu PN-2026-0009', badge: { label: 'Thực tế', tone: 'ok' }, detail: 'Mua ngoài · Trại giống Mộc Châu', meta: `Hiệu lực 02/10 · ghi 02/10 · ${MANAGER}` },
    { id: 'e-240-1', at: '2026-10-02T09:05', cat: 'weight', title: 'Cân nhập 352 kg', badge: { label: 'Cân thực tế', tone: 'ok' }, detail: 'Cân nhập tại trại', meta: `Xảy ra 02/10 · ghi 02/10 · ${MANAGER}` },
  ],
  importRecord: {
    plan: 'PN-2026-0009', date: '02/10/2026', by: MANAGER, onlyImportEvents: true,
    fields: [
      ['date', 'Ngày nhập (áp dụng cả phiếu)', '02/10/2026', '02/10/2026'],
      ['source', 'Thông tin nguồn', 'Trại giống Mộc Châu', '—'],
      ['weight', 'Cân nhập · cơ sở', '352 kg · thực tế', '348 kg · thực tế'],
      ['price', 'Đơn giá', '95.000 đ/kg', '—'],
      ['breed', 'Giống · giới tính', 'Brahman đỏ · Cái', '—'],
      ['birth', 'Ngày sinh · độ chính xác', '05/2023 · ước tính', '—'],
      ['prior', 'Lịch sử trước nhập đàn', 'Tiêm: Có · Bệnh: Không rõ', 'LINK'],
    ],
  },
  care: { last: '352 kg · 02/10', adg: '—', bcs: '—', healthCase: 'Không có ca mở', repro: '—', vaccine: { label: 'Đủ mũi tiêm', tone: 'ok' }, reminders: [] },
}

export const initialCows = [
  COW_125,
  auto({ code: 'BC-000087', name: 'Mận', tag: 'VN-BV-0311', breed: 'Lai Sind', sex: 'Cái', ageShort: '6t 2th', ageLong: '6 tuổi 2 tháng', months: 74, barn: 'D', purpose: 'Sinh sản', stage: 'Bò cái sinh sản', inList: true, weight: 365, weightDate: '08/10', health: { label: 'Theo dõi', tone: 'warn' }, repro: { label: 'Sắp đẻ', tone: 'warn' }, headerBadges: [['Theo dõi', 'warn'], ['Sắp đẻ', 'warn']], birth: '03/2020 · ước tính', qr: 'QR-3C9N-0087', care: { last: '365 kg · 08/10', adg: '0,18 kg/ngày', bcs: '3,0 / 5', healthCase: '1 ca đang theo dõi', repro: 'Sắp đẻ · DK đẻ 28/10/2026', vaccine: { label: 'Đủ mũi tiêm', tone: 'ok' }, reminders: [{ title: 'Theo dõi sau đẻ', due: { label: '28/10' } }] } }),
  auto({ code: 'BC-000203', name: 'Bão', tag: 'VN-0412', breed: 'Zebu đỏ', sex: 'Đực', ageShort: '2t 1th', ageLong: '2 tuổi 1 tháng', months: 25, barn: 'B1', purpose: 'Vỗ béo', stage: 'Vỗ béo', inList: true, weight: 318, weightEst: true, weightDate: '10/10', health: { label: 'Đang điều trị', tone: 'err' }, repro: null, headerBadges: [['Đang điều trị', 'err']], birth: '09/2024 · ước tính', qr: 'QR-6R1J-0203', care: { last: '318 kg* · 10/10', adg: '0,40 kg/ngày', bcs: '3,0 / 5', healthCase: '1 ca đang điều trị', repro: '—', vaccine: { label: 'Đủ mũi tiêm', tone: 'ok' }, reminders: [] } }),
  auto({ code: 'BC-000061', name: 'Nâu', tag: 'VN-BV-0206', breed: 'Lai Sind', sex: 'Cái', ageShort: '5t', ageLong: '5 tuổi', months: 60, barn: 'B1', barnTag: 'Sinh sản', purpose: 'Sinh sản', stage: 'Bò cái sinh sản', inList: true, weight: 338, weightDate: '01/10', health: { label: 'Khỏe', tone: 'ok' }, repro: { label: 'Chờ khám', tone: 'grey' }, headerBadges: [['Khỏe mạnh', 'ok']], birth: '2021 · ước tính', qr: 'QR-2L7Y-0061', care: { last: '338 kg · 01/10', adg: '0,22 kg/ngày', bcs: '3,0 / 5', healthCase: 'Không có ca mở', repro: 'Chờ khám', vaccine: { label: 'Đủ mũi tiêm', tone: 'ok' }, reminders: [] } }),
  auto({ code: 'BC-000219', name: '', tag: '', breed: 'Zebu đỏ', sex: 'Cái', ageShort: '9th', ageLong: '9 tháng', months: 9, barn: 'C2', purpose: 'Chưa xác định', stage: 'Bê', inList: true, weight: null, weightDate: '', health: { label: 'Khỏe', tone: 'ok' }, repro: null, headerBadges: [['Khỏe mạnh', 'ok']], birth: '01/2026 · ước tính', purposeSince: '10/09/2026', barnSince: '10/09/2026', qr: 'QR-4N6P-0219', qrFrom: '09/2026', care: { last: '—', adg: '—', bcs: '—', healthCase: 'Không có ca mở', repro: '—', vaccine: { label: 'Đủ mũi tiêm', tone: 'ok' }, reminders: [] } }),
  auto({ code: 'BC-000017', name: 'Sắm', tag: 'VN-BV-0101', breed: 'Brahman đỏ', sex: 'Đực', ageShort: '5t 4th', ageLong: '5 tuổi 4 tháng', months: 64, barn: 'B2', purpose: 'Đực giống', stage: 'Đực giống', inList: true, weight: 512, weightDate: '30/09', health: { label: 'Khỏe', tone: 'ok' }, repro: null, headerBadges: [['Khỏe mạnh', 'ok']], birth: '06/2021 · ước tính', qr: 'QR-9D4S-0017', care: { last: '512 kg · 30/09', adg: '0,15 kg/ngày', bcs: '3,5 / 5', healthCase: 'Không có ca mở', repro: 'Đực giống · phối 12 con', vaccine: { label: 'Đủ mũi tiêm', tone: 'ok' }, reminders: [] } }),
  COW_142,
  COW_240,
]

/** Mã QR kế tiếp theo số thẻ đã cấp (lần đầu của BC-000125 = QR-9M2D-0125). */
export const newQrCode = (cow) => `QR-${['9M2D', '4K8P', '7X3Q', '2H6V'][(cow.qrHistory.length - 1) % 4]}-${cow.code.slice(-4)}`

/** Số đếm một nhóm đàn = phần nền + bò đang nuôi trong danh sách ở giai đoạn đó. */
export const groupCount = (cows, stage) =>
  BASELINE[stage] + cows.filter((c) => c.inList && c.status === 'ACTIVE' && c.stage === stage).length
