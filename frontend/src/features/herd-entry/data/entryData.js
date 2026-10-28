import { seedPens } from '../../../data/pensData.js'

const penByCode = Object.fromEntries(seedPens.map((pen) => [pen.code, pen]))
const asBarn = (code) => ({ code, name: penByCode[code].name, count: penByCode[code].count, capacity: penByCode[code].capacity })
export const BARNS = ['A1', 'A2', 'B1', 'B2', 'C1'].map(asBarn)
export const GROUPS = ['Bò tơ', 'Vỗ béo', 'Bò cái', 'Đực giống', 'Chưa xác định']
export const CALF_BARN = asBarn('A3')
export const PURPOSES = ['Chưa xác định', 'Nuôi thương phẩm', 'Giữ giống']
export const SOURCES = [
  { id: 's1', name: 'Hộ ông Lê Văn C – Sơn Tây', phone: '0912 345 678' },
  { id: 's2', name: 'Chợ bò Tòng Bạt – Ba Vì', phone: '0903 111 222' },
  { id: 's3', name: 'Trại giống Mộc Châu – Sơn La', phone: '0912 888 456' },
]
export const PAY_METHODS = ['Chuyển khoản', 'Tiền mặt']
export const initialCalves = [
  { name: 'Bê số 1', tag: 'VN-0611', mother: 'BC-000093', father: 'tinh BRD-118', born: '2026-10-19', sex: 'Cái', weight: 24, estimated: false, purpose: 'Chưa xác định', picked: true, barn: 'A3' },
  { name: 'Bê số 1', tag: 'VN-0612', mother: 'BC-000108', father: 'BC-000140', born: '2026-10-20', sex: 'Đực', weight: 27, estimated: true, purpose: 'Chưa xác định', picked: true, barn: 'A3' },
  { name: 'Bê số 1', tag: '', mother: 'BC-000118', father: 'bò không rõ', born: '2026-10-21', sex: 'Cái', weight: 22, estimated: false, purpose: 'Chưa xác định', picked: false, barn: '' },
]
export const INITIAL_COWS = [
  { tag: 'VN-0503', breed: 'Lai Sind', sex: 'Cái', group: 'Bò tơ', ageMonths: 18, weight: 236, estimated: true, barn: 'A1', unitPrice: 85000 },
  { tag: 'VN-0504', breed: 'Brahman lai', sex: 'Đực', group: 'Vỗ béo', ageMonths: 14, weight: 285, estimated: false, barn: 'B1', unitPrice: 85000 },
  { tag: '', breed: 'Zebu', sex: 'Cái', group: 'Chưa xác định', ageMonths: 12, weight: 198, estimated: true, barn: 'C1', unitPrice: 80000 },
]
