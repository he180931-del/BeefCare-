// Canonical pen seed shared by Pen management, Cattle, Entry and Exit flows.
type PenOptions = {
  accept?: string
  status?: string
  purpose?: string
  stage?: string
  minAge?: number | null
  minAgeOp?: string
  minWeight?: number | null
  minWeightOp?: string
  sex?: string
  tag?: string
  version?: string
  desc?: string
  cows?: PenCowLink[]
}
const pen = (code: string, name: string, count: number, capacity: number, options: PenOptions = {}): Pen => ({
  code,
  name,
  count,
  capacity,
  accept: options.accept ?? options.stage ?? 'Mọi giai đoạn',
  status: options.status ?? 'ACTIVE',
  purpose: options.purpose ?? 'Mọi mục đích',
  stage: options.stage ?? 'Mọi giai đoạn',
  minAge: options.minAge ?? null,
  minAgeOp: options.minAgeOp ?? '≥',
  minWeight: options.minWeight ?? null,
  minWeightOp: options.minWeightOp ?? '≥',
  // Aliases consumed by the cattle acceptance UI.
  minMonths: options.minAge ?? 0,
  minKg: options.minWeight ?? 0,
  sex: options.sex ?? 'Cả hai',
  tag: options.tag ?? options.accept ?? options.stage ?? name,
  version: options.version ?? 'v1 từ 01/06/2026',
  desc: options.desc ?? '',
  cows: options.cows ?? [],
})

export const seedPens: Pen[] = [
  pen('A1', 'A1 – Bò cái sinh sản', 58, 64, { accept: 'Sinh sản', purpose: 'Sinh sản', stage: 'Bò cái sinh sản', minAge: 13, minWeight: 230, sex: 'Cái', version: 'v2 từ 01/09/2026', cows: [['BC-000125', 'Mang thai 5 tháng']] }),
  pen('A2', 'A2 – Bò chửa', 22, 30, { accept: 'Bò chửa', purpose: 'Sinh sản', stage: 'Bò cái sinh sản', minAge: 13, minWeight: 230, sex: 'Cái', cows: [['BC-000240', 'Bò chửa']] }),
  pen('A3', 'A3 – Bê theo mẹ', 28, 40, { accept: 'Bê theo mẹ', stage: 'Bê', minAge: 0, minWeight: 0 }),
  pen('B1', 'B1 – Vỗ béo', 46, 50, { accept: 'Vỗ béo', purpose: 'Vỗ béo', stage: 'Vỗ béo', minAge: 12, minWeight: 250, sex: 'Đực', cows: [['BC-000203', 'Vỗ béo ngày 62'], ['BC-000061', 'Theo dõi sinh sản']] }),
  pen('B2', 'B2 – Đực giống', 10, 12, { accept: 'Đực giống', purpose: 'Đực giống', stage: 'Đực giống', minAge: 24, minWeight: 400, sex: 'Đực', cows: [['BC-000017', 'Đực giống khỏe']] }),
  pen('C1', 'C1 – Bò tơ', 37, 40, { accept: 'Bò tơ', purpose: 'Sinh sản', stage: 'Bò tơ', minAge: 9, minWeight: 120, sex: 'Cái', cows: [['BC-000142', 'Phát triển tốt']] }),
  pen('C2', 'C2 – Bê cai sữa', 41, 45, { accept: 'Bê cai sữa', stage: 'Bê', cows: [['BC-000219', 'Bê cai sữa']] }),
  pen('D', 'D – Chuồng đẻ', 3, 8, { accept: 'Bò chửa cận đẻ', purpose: 'Sinh sản', stage: 'Bò cái sinh sản', minAge: 13, minWeight: 230, sex: 'Cái', cows: [['BC-000087', 'Sắp đẻ']] }),
  pen('Q', 'Q – Cách ly nhập đàn', 3, 12, { accept: 'Mọi mục đích', stage: 'Mọi giai đoạn' }),
  pen('E', 'E – Đang sửa chữa', 0, 38, { accept: '—', purpose: '—', stage: '—', status: 'INACTIVE' }),
]

export const penMap = Object.fromEntries(seedPens.map((row) => [row.code, row]))
export const PEN_PURPOSES = ['Sinh sản', 'Nuôi thương phẩm', 'Vỗ béo', 'Đực giống', 'Mọi mục đích']
export const PEN_STAGES = ['Bò cái sinh sản', 'Bò chửa', 'Bê theo mẹ', 'Vỗ béo', 'Đực giống', 'Bò tơ', 'Bê', 'Bê cai sữa', 'Bò chửa cận đẻ', 'Mọi giai đoạn']
export const thresholdText = (row: Pen) => [row.minAge != null && `${row.minAgeOp || '≥'} ${row.minAge} tháng`, row.minWeight != null && `${row.minWeightOp || '≥'} ${row.minWeight} kg`].filter(Boolean).join(' và ') || '—'
import type { Pen, PenCowLink } from '../types'
