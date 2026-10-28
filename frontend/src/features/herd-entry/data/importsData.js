// Dữ liệu phiếu nhập (thuộc worker "Nhập đàn").
export const initialImports = [
  { id: 'PN-2026-0012', date: '2026-10-22', type: 'Mua ngoài', source: 'Hộ ông Lê Văn C – Sơn Tây · 2 con cân ước tính', count: 3, weight: 719, total: 61625000, debt: 21625000, status: 'Nháp' },
  { id: 'PN-2026-0013', date: '2026-10-22', type: 'Bê sinh tại trại', source: 'Bê của BC-000093, BC-000108', count: 2, weight: 51, total: null, debt: null, status: 'Nháp' },
  { id: 'PN-2026-0011', date: '2026-10-17', type: 'Mua ngoài', source: 'Chợ bò Tòng Bạt – Ba Vì · KD-HN-2026-004390', count: 1, weight: 218, total: 18530000, debt: 8530000, status: 'Đã nhập' },
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
