import { seedPens } from '../../../data/pensData.js'

const penByCode = Object.fromEntries(seedPens.map((pen) => [pen.code, pen]))
export const BARNS = ['A1', 'A2', 'B1', 'B2', 'C1'].map((code) => ({ code, name: penByCode[code].name, count: penByCode[code].count, capacity: penByCode[code].capacity }))
export const BUYERS = [
  { id: 'b1', name: 'Nguyễn Văn Phúc – Sơn Tây', phone: '0987 654 321' },
  { id: 'b2', name: 'Lò mổ Hà Đông', phone: '0243 555 018' },
  { id: 'b3', name: 'HTX chăn nuôi Ba Vì', phone: '0243 777 009' },
]
export const PAY_METHODS = ['Chuyển khoản', 'Tiền mặt']
export const HERD = [
  { code: 'BC-000203', tag: 'VN-0412', breed: 'Zebu đỏ', sex: 'Đực', age: '24 tháng', group: 'Vỗ béo', barn: 'B1', weight: 322, estimated: false },
  { code: 'BC-000205', tag: 'VN-0415', breed: 'Brahman lai', sex: 'Đực', age: '26 tháng', group: 'Vỗ béo', barn: 'B1', weight: 348, estimated: false, withdrawalUntil: '2026-10-25' },
  { code: 'BC-000211', tag: 'VN-0431', breed: 'Lai Sind', sex: 'Đực', age: '24 tháng', group: 'Vỗ béo', barn: 'B1', weight: 332, estimated: true },
  { code: 'BC-000214', tag: 'VN-0436', breed: 'Zebu đỏ', sex: 'Đực', age: '22 tháng', group: 'Vỗ béo', barn: 'B1', weight: 305, estimated: false },
  { code: 'BC-000156', tag: 'VN-0301', breed: 'Lai Sind', sex: 'Cái', age: '30 tháng', group: 'Bò cái', barn: 'A2', weight: 180, estimated: true },
]
