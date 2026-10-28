// Dữ liệu phiếu xuất (thuộc worker "Xuất đàn + Chuồng trại").
export const initialExports = [
  { id: 'PX-2026-0009', date: '2026-10-22', type: 'Bán', who: 'Thương lái Nguyễn Văn Phúc – Sơn Tây', sub: '3 con · chuồng B1', count: 3, weight: '1.002 kg', total: 92184000, due: 32184000, dueNote: '(nháp)', status: 'Nháp' },
  { id: 'PX-2026-0008', date: '2026-10-21', type: 'Chết / mất', who: 'Từ ca HC-0418 · tiêu chảy cấp', sub: 'BC-000156 · A2', count: 1, weight: '~180 kg', total: null, due: null, status: 'Chờ xác nhận' },
  {
    id: 'PX-2026-0007', date: '2026-10-15', type: 'Bán', who: 'Lò mổ Hà Đông', sub: 'KD-HN-2026-004402 · B1', count: 4, weight: '1.380 kg', total: 124200000, due: 12400000, status: 'Đã xuất',
    detail: {
      quarantine: 'KD-HN-2026-004402', buyer: 'Lò mổ Hà Đông', phone: '0243 555 018', plate: '29C-778.21',
      by: 'N. V. Hùng · 15/10/2026 07:10', note: 'Cân tại trại trước khi lên xe',
      cows: [
        { code: 'BC-000188', tag: 'VN-0390', breed: 'Zebu đỏ · Đực', weight: 352, barn: 'B1 – Vỗ béo', amount: 31680000 },
        { code: 'BC-000190', tag: 'VN-0392', breed: 'Lai Sind · Đực', weight: 338, barn: 'B1 – Vỗ béo', amount: 30420000 },
        { code: 'BC-000193', tag: 'VN-0395', breed: 'Brahman lai · Đực', weight: 361, barn: 'B1 – Vỗ béo', amount: 32490000 },
        { code: 'BC-000196', tag: 'VN-0399', breed: 'Zebu đỏ · Đực', weight: 329, barn: 'B1 – Vỗ béo', amount: 29610000 },
      ],
      cowsTotal: 124200000, deduction: 0,
      payments: [
        { date: '15/10/2026', by: 'N. V. Hùng', method: 'Chuyển khoản', ref: 'LMHD-1510-PX07', amount: 100000000 },
        { date: '18/10/2026', by: 'N. V. Hùng', method: 'Tiền mặt', ref: 'PT-1810-02', amount: 11800000 },
      ],
      docs: [{ ext: 'PDF', name: 'hop-dong-lo-mo-HD-1510.pdf' }, { ext: 'PDF', name: 'phieu-can-xuat-1510.pdf' }],
      history: [
        '14/10 20:30 · N. V. Hùng tạo phiếu nháp',
        '15/10 07:10 · N. V. Hùng xác nhận xuất 4 con',
        '15/10 07:10 · Hệ thống hủy 6 mũi tiêm và 4 nhắc việc sau ngày xuất',
        '18/10 09:00 · N. V. Hùng ghi nhận thu 11.800.000 đ',
      ],
    },
  },
  { id: 'PX-2026-0006', date: '2026-09-28', type: 'Loại thải', who: 'Bò cái vô sinh – bán thương lái', sub: 'Hủy: ghi nhầm con', count: 1, weight: '390 kg', total: 31200000, due: null, status: 'Đã hủy' },
  { id: 'PX-2026-0005', date: '2026-09-20', type: 'Bán', who: 'HTX chăn nuôi Ba Vì', sub: 'KD-HN-2026-003977 · B1', count: 2, weight: '690 kg', total: 62100000, due: 0, status: 'Đã xuất' },
  { id: 'PX-2026-0004', date: '2026-09-05', type: 'Chết / mất', who: 'Báo mất tích – đã tìm thấy bò', sub: 'Từ ca HC-0381 · Chủ trại bác', count: 1, weight: null, total: null, due: null, status: 'Đã bác' },
]
