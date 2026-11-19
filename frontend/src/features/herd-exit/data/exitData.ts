import { seedPens } from '../../../data/pensData'

const penByCode = Object.fromEntries(seedPens.map((pen) => [pen.code, pen]))
export const BARNS = ['A1', 'A2', 'B1', 'B2', 'C1'].map((code) => ({ code, name: penByCode[code].name, count: penByCode[code].count, capacity: penByCode[code].capacity }))
export const BUYERS = [
  { id: 'b1', name: 'Nguyễn Văn Phúc – Sơn Tây', phone: '0987 654 321' },
  { id: 'b2', name: 'Lò mổ Hà Đông', phone: '0243 555 018' },
  { id: 'b3', name: 'HTX chăn nuôi Ba Vì', phone: '0243 777 009' },
]
export const PAY_METHODS = ['Chuyển khoản', 'Tiền mặt']
// Backward-compatible name; the candidate list has one source of truth.
export { EXPORT_HERD as HERD } from './exportsData'
