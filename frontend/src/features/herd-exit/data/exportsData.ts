import { businessDate } from '../../../shared/lib/date/farmTime'
// Dữ liệu phiếu xuất (thuộc worker "Xuất đàn + Chuồng trại").
export const initialExports: HerdExit[] = [
  {
    id: 'PX-2026-0009', date: '2026-10-22', type: 'Bán', who: 'Thương lái Nguyễn Văn Phúc – Sơn Tây', sub: 'KD-HN-2026-005130', count: 3, weightKg: 1002, weightEstimated: true, pens: ['B1'], total: 92184000, due: 32184000, dueNote: '(nháp)', status: 'Nháp',
    draft: {
      date: '2026-10-22', buyerId: 'b1', quarantine: 'KD-HN-2026-005130', plate: '29H-456.78', note: 'Xuất bán vỗ béo đạt trọng lượng, cân tại trại trước khi lên xe', pricing: 'kg',
      cows: [{ code: 'BC-000203', weight: 322, unitPrice: 92000, estimated: false }, { code: 'BC-000205', weight: 348, unitPrice: 92000, estimated: false }, { code: 'BC-000211', weight: 332, unitPrice: 92000, estimated: true }],
      deduction: 0, collected: 60000000, method: 'Chuyển khoản', dueDate: '2026-10-29', docs: [{ ext: 'PDF', name: 'phieu-can-xuat-2210.pdf' }],
    },
  },
  {
    id: 'PX-2026-0008', date: '2026-10-21', type: 'Chết / mất', who: 'Từ ca HC-0418 · tiêu chảy cấp', sub: 'Ca sức khỏe HC-0418', count: 1, weightKg: 180, weightEstimated: true, pens: ['A2'], total: null, due: null, status: 'Chờ xác nhận',
    detail: {
      death: true, lossType: 'Chết', date: '2026-10-21', source: 'Ca sức khỏe HC-0418 · đóng: Chết', sourceHealthCaseId: 418, sourceHealthCaseCode: 'HC-0418', reporter: 'Trần Quốc Long · 21/10/2026 17:20', reason: 'Tiêu chảy cấp, điều trị 3 ngày không đáp ứng', disposal: 'Tiêu hủy / chôn lấp tại trại',
      cow: { code: 'BC-000156', tag: 'VN-0377', breed: 'Lai Sind', sex: 'Cái', age: '14 tháng', barn: 'A2 – Bò cái', weight: 180, estimated: true, caseLine: ['HC-0418', 'đóng: Chết · 21/10'] },
      barnShift: 'A2 – Bò cái (28 → 27)', checks: [['Ca sức khỏe nguồn', 'HC-0418 đã đóng (Chết)'], ['Ca mở / mạn tính khác', 'Không có'], ['Mũi tiêm tương lai', '1 mũi – sẽ hủy'], ['Thai đang theo dõi', 'Không'], ['Bê nháp của bò mẹ', 'Không có']], docs: [{ ext: 'JPG', name: 'anh-bo-chet-BC000156.jpg' }],
    },
  },
  {
    id: 'PX-2026-0007', date: '2026-10-15', type: 'Bán', who: 'Lò mổ Hà Đông', sub: 'KD-HN-2026-004402', count: 4, weightKg: 1380, weightEstimated: false, pens: ['B1'], total: 124200000, due: 12400000, status: 'Đã xuất',
    detail: {
      quarantine: 'KD-HN-2026-004402', buyer: 'Lò mổ Hà Đông', phone: '0243 555 018', plate: '29C-778.21',
      createdAt: '2026-10-14T20:30:00+07:00', confirmedBy: 'N. V. Hùng', confirmedAt: '2026-10-15T07:10:00+07:00', note: 'Cân tại trại trước khi lên xe',
      cows: [
        { code: 'BC-000188', tag: 'VN-0390', breed: 'Zebu đỏ', sex: 'Đực', weight: 352, weightBasis: 'MEASURED', barn: 'B1 – Vỗ béo', amount: 31680000 },
        { code: 'BC-000190', tag: 'VN-0392', breed: 'Lai Sind', sex: 'Đực', weight: 338, weightBasis: 'MEASURED', barn: 'B1 – Vỗ béo', amount: 30420000 },
        { code: 'BC-000193', tag: 'VN-0395', breed: 'Brahman lai', sex: 'Đực', weight: 361, weightBasis: 'MEASURED', barn: 'B1 – Vỗ béo', amount: 32490000 },
        { code: 'BC-000196', tag: 'VN-0399', breed: 'Zebu đỏ', sex: 'Đực', weight: 329, weightBasis: 'MEASURED', barn: 'B1 – Vỗ béo', amount: 29610000 },
      ],
      cowsTotal: 124200000, deduction: 0,
      payments: [
        { date: '15/10/2026', by: 'N. V. Hùng', method: 'Chuyển khoản', ref: 'LMHD-1510-PX07', amount: 100000000 },
        { date: '18/10/2026', by: 'N. V. Hùng', method: 'Tiền mặt', ref: 'PT-1810-02', amount: 11800000 },
      ],
      docs: [{ ext: 'PDF', name: 'hop-dong-lo-mo-HD-1510.pdf' }, { ext: 'PDF', name: 'phieu-can-xuat-1510.pdf' }],
      history: [
        { time: '2026-10-14T20:30:00+07:00', actor: 'N. V. Hùng', text: 'Tạo phiếu nháp' },
        { time: '2026-10-15T07:10:00+07:00', actor: 'N. V. Hùng', text: 'Xác nhận xuất 4 con' },
        { time: '2026-10-15T07:10:00+07:00', actor: 'Hệ thống', text: 'Hủy 6 mũi tiêm và 4 nhắc việc sau ngày xuất' },
        { time: '2026-10-18T09:00:00+07:00', actor: 'N. V. Hùng', text: 'Ghi nhận thu 11.800.000 đ' },
      ],
    },
  },
  { id: 'PX-2026-0006', date: '2026-09-28', type: 'Loại thải', who: 'Bò cái vô sinh – bán thương lái', sub: '', count: 1, weightKg: 390, weightEstimated: false, pens: ['A1'], total: 31200000, due: null, status: 'Đã hủy', reason: 'Ghi nhầm con', cancelReason: 'Ghi nhầm con' },
  { id: 'PX-2026-0005', date: '2026-09-20', type: 'Bán', who: 'HTX chăn nuôi Ba Vì', sub: 'KD-HN-2026-003977', count: 2, weightKg: 690, weightEstimated: false, pens: ['B1'], total: 62100000, due: 0, status: 'Đã xuất' },
  { id: 'PX-2026-0004', date: '2026-09-05', type: 'Chết / mất', who: 'Báo mất tích – đã tìm thấy bò', sub: 'Ca sức khỏe HC-0381', count: 1, weightKg: null, weightEstimated: false, pens: ['A2'], total: null, due: null, status: 'Đã bác', reason: 'Đã tìm thấy bò', cancelReason: 'Đã tìm thấy bò' },
]

export const todayIso = businessDate

// Kept for the local demo data and collection form; new backend vouchers use todayIso() directly.
export const TODAY = '2026-10-22'

// Bò có thể chọn vào phiếu xuất (thẻ tai, giống, tuổi, cân gần nhất + ghi chú cân, cảnh báo).
export const EXPORT_HERD = [
  { code: 'BC-000203', tag: 'VN-BV-0512', breed: 'Zebu đỏ', sex: 'Đực', age: '24 tháng', group: 'Vỗ béo', stage: 'Trưởng thành', barn: 'B1', weight: 322, weightNote: 'cân 22/10', estimated: false },
  { code: 'BC-000205', tag: 'VN-0415', breed: 'Brahman lai', sex: 'Đực', age: '26 tháng', group: 'Vỗ béo', stage: 'Trưởng thành', barn: 'B1', weight: 348, weightNote: 'cân 22/10', estimated: false, withdrawalUntil: '2026-10-25' },
  { code: 'BC-000211', tag: 'VN-0431', breed: 'Lai Sind', sex: 'Đực', age: '24 tháng', group: 'Vỗ béo', stage: 'Trưởng thành', barn: 'B1', weight: 332, weightNote: 'ước tính 15/10', estimated: true },
  { code: 'BC-000214', tag: 'VN-0436', breed: 'Zebu đỏ', sex: 'Đực', age: '22 tháng', group: 'Vỗ béo', stage: 'Bò tơ', barn: 'B1', weight: 305, weightNote: 'cân 15/10', estimated: false },
  { code: 'BC-000198', tag: 'VN-0402', breed: 'Lai Sind', sex: 'Đực', age: '28 tháng', group: 'Vỗ béo', stage: 'Trưởng thành', barn: 'B1', weight: 356, weightNote: 'cân 15/10', estimated: false, openCase: 'HC-0415' },
]
import type { HerdExit } from '../types'
