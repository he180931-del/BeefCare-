// Canonical cattle fixtures shared by Entry, Exit and the cattle domain.
// Pen counts are seeded independently in pensData; these rows describe identity
// and voucher links only, so bootstrapping never adjusts occupancy twice.
const cow = (code, fields = {}) => ({
  code,
  tag: '',
  breed: 'Chưa xác định',
  sex: 'Cái',
  barn: null,
  status: 'ACTIVE',
  events: [],
  ...fields,
})

export const canonicalCattle = [
  cow('BC-000203', { tag: 'VN-0412', breed: 'Zebu đỏ', sex: 'Đực', barn: 'B1', weight: 322 }),
  cow('BC-000205', { tag: 'VN-0415', breed: 'Brahman lai', sex: 'Đực', barn: 'B1', weight: 348, withdrawalUntil: '2026-10-25' }),
  cow('BC-000211', { tag: 'VN-0431', breed: 'Lai Sind', sex: 'Đực', barn: 'B1', weight: 332, weightEst: true }),
  cow('BC-000214', { tag: 'VN-0436', breed: 'Zebu đỏ', sex: 'Đực', barn: 'B1', weight: 305 }),
  cow('BC-000198', { tag: 'VN-0402', breed: 'Lai Sind', sex: 'Đực', barn: 'B1', weight: 356 }),
  cow('BC-000156', { tag: 'VN-0301', breed: 'Lai Sind', sex: 'Cái', barn: 'A2', weight: 180, weightEst: true }),
  cow('BC-000248', { tag: 'VN-0480', breed: 'Zebu đỏ', barn: 'A2', weight: 218, entryVoucherId: 'PN-2026-0011', entryLineNo: 1 }),
  cow('BC-000239', { tag: 'VN-0471', breed: 'Brahman đỏ', sex: 'Đực', barn: 'B2', weight: 410, entryVoucherId: 'PN-2026-0009', entryLineNo: 1 }),
  cow('BC-000240', { tag: 'VN-0472', breed: 'Brahman đỏ', barn: 'A2', weight: 352, entryVoucherId: 'PN-2026-0009', entryLineNo: 2 }),
  cow('BC-000241', { tag: 'VN-0473', breed: 'Brahman đỏ', barn: 'A2', weight: 318, entryVoucherId: 'PN-2026-0009', entryLineNo: 3 }),
  cow('BC-000242', { tag: 'VN-0474', breed: 'Brahman đỏ', barn: 'A2', weight: 340, entryVoucherId: 'PN-2026-0009', entryLineNo: 4 }),
  cow('BC-000188', { tag: 'VN-0390', breed: 'Zebu đỏ', sex: 'Đực', barn: 'B1', lastPen: 'B1', status: 'EXITED', exitVoucherId: 'PX-2026-0007' }),
  cow('BC-000190', { tag: 'VN-0392', breed: 'Lai Sind', sex: 'Đực', barn: 'B1', lastPen: 'B1', status: 'EXITED', exitVoucherId: 'PX-2026-0007' }),
  cow('BC-000193', { tag: 'VN-0395', breed: 'Brahman lai', sex: 'Đực', barn: 'B1', lastPen: 'B1', status: 'EXITED', exitVoucherId: 'PX-2026-0007' }),
  cow('BC-000196', { tag: 'VN-0399', breed: 'Zebu đỏ', sex: 'Đực', barn: 'B1', lastPen: 'B1', status: 'EXITED', exitVoucherId: 'PX-2026-0007' }),
]
