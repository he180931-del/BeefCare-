// Dữ liệu mẫu theo thiết kế Figma (trang 16 · Nhập/Xuất & Chuồng).
export const BARNS = [
  { code: 'A1', name: 'A1 – Bò cái', count: 29, capacity: 30 },
  { code: 'A2', name: 'A2 – Bò cái', count: 18, capacity: 30 },
  { code: 'B1', name: 'B1 – Vỗ béo', count: 46, capacity: 50 },
  { code: 'B2', name: 'B2 – Đực giống', count: 6, capacity: 10 },
  { code: 'C1', name: 'C1 – Cách ly', count: 0, capacity: 10 },
]

export const GROUPS = ['Bò tơ', 'Vỗ béo', 'Bò cái', 'Đực giống', 'Chưa xác định']

export const CALF_BARN = { code: 'A3', name: 'A3 – Bê theo mẹ', count: 6, capacity: 12 }
export const PURPOSES = ['Chưa xác định', 'Nuôi thương phẩm', 'Giữ giống']

// Bê từ sự kiện đẻ đang Chờ xác nhận (chọn vào phiếu nhập bê sinh tại trại).
export const initialCalves = [
  { name: 'Bê số 1', tag: 'VN-0611', mother: 'BC-000093', father: 'tinh BRD-118', born: '2026-10-19', sex: 'Cái', weight: 24, estimated: false, purpose: 'Chưa xác định', picked: true, barn: 'A3' },
  { name: 'Bê số 1', tag: 'VN-0612', mother: 'BC-000108', father: 'BC-000140', born: '2026-10-20', sex: 'Đực', weight: 27, estimated: true, purpose: 'Chưa xác định', picked: true, barn: 'A3' },
  { name: 'Bê số 1', tag: '', mother: 'BC-000118', father: 'bò không rõ', born: '2026-10-21', sex: 'Cái', weight: 22, estimated: false, purpose: 'Chưa xác định', picked: false, barn: '' },
]

export const SOURCES = [
  { id: 's1', name: 'Hộ ông Lê Văn C – Sơn Tây', phone: '0912 345 678' },
  { id: 's2', name: 'Chợ bò Tòng Bạt – Ba Vì', phone: '0903 111 222' },
  { id: 's3', name: 'Trại giống Mộc Châu – Sơn La', phone: '0912 888 456' },
]

export const BUYERS = [
  { id: 'b1', name: 'Nguyễn Văn Phúc – Sơn Tây', phone: '0987 654 321' },
  { id: 'b2', name: 'Lò mổ Hà Đông', phone: '0243 555 018' },
  { id: 'b3', name: 'HTX chăn nuôi Ba Vì', phone: '0243 777 009' },
]

export const PAY_METHODS = ['Chuyển khoản', 'Tiền mặt']

// Đàn bò hiện có, dùng cho "Chọn bò" khi lập phiếu xuất.
export const HERD = [
  { code: 'BC-000203', tag: 'VN-0412', breed: 'Zebu đỏ', sex: 'Đực', age: '24 tháng', group: 'Vỗ béo', barn: 'B1', weight: 322, estimated: false },
  { code: 'BC-000205', tag: 'VN-0415', breed: 'Brahman lai', sex: 'Đực', age: '26 tháng', group: 'Vỗ béo', barn: 'B1', weight: 348, estimated: false, withdrawalUntil: '2026-10-25' },
  { code: 'BC-000211', tag: 'VN-0431', breed: 'Lai Sind', sex: 'Đực', age: '24 tháng', group: 'Vỗ béo', barn: 'B1', weight: 332, estimated: true },
  { code: 'BC-000214', tag: 'VN-0436', breed: 'Zebu đỏ', sex: 'Đực', age: '22 tháng', group: 'Vỗ béo', barn: 'B1', weight: 305, estimated: false },
  { code: 'BC-000156', tag: 'VN-0301', breed: 'Lai Sind', sex: 'Cái', age: '30 tháng', group: 'Bò cái', barn: 'A2', weight: 180, estimated: true },
]
