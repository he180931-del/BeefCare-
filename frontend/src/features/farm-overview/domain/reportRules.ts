import { fmtDec, fmtInt, formatKey, formatKeyShort, pct } from './format'
import type { ReportCell, ReportCode, ReportFilterKey, ReportRequest, ReportRowSeed, ReportTile, ReportView } from '../types'

export const REPORT_CATALOGUE: Array<{ code: ReportCode; label: string; title: string; filters: ReportFilterKey[] }> = [
  { code: 'RPT-01', label: 'RPT-01 Tổng hợp đàn', title: 'Tổng hợp đàn', filters: ['pen', 'group', 'stage'] },
  { code: 'RPT-02', label: 'RPT-02 Tăng trưởng', title: 'Hiệu quả tăng trưởng', filters: ['pen', 'group', 'stage'] },
  { code: 'RPT-03', label: 'RPT-03 Tiêm phòng', title: 'Tuân thủ tiêm phòng', filters: [] },
  { code: 'RPT-04', label: 'RPT-04 Sức khỏe & điều trị', title: 'Sức khỏe & điều trị', filters: ['pen', 'group'] },
  { code: 'RPT-05', label: 'RPT-05 Sinh sản', title: 'Sinh sản', filters: ['pen', 'breed', 'group', 'stage'] },
  { code: 'RPT-06', label: 'RPT-06 Biến động đàn', title: 'Biến động đàn', filters: ['pen'] },
  { code: 'RPT-07', label: 'RPT-07 Hiệu quả vỗ béo', title: 'Hiệu quả vỗ béo', filters: ['pen'] },
]

type Rows = ReportRowSeed[]
interface Col { key: string; label: string; fmt: (v: Record<string, number>, missing: number) => ReportCell; total: (rows: Rows) => ReportCell }
interface Def { columns: Col[]; tiles: (rows: Rows) => ReportTile[] }

const S = (rows: Rows, k: string) => rows.reduce((t, r) => t + (r.v[k] ?? 0), 0)
const W = (rows: Rows, k: string, w: string) => { const n = S(rows, w); return n ? rows.reduce((t, r) => t + r.v[k] * r.v[w], 0) / n : 0 }
const missingOf = (rows: Rows) => rows.reduce((t, r) => t + (r.missing ?? 0), 0)
const sumCol = (key: string, label: string): Col => ({ key, label, fmt: (v) => fmtInt(v[key]), total: (rows) => fmtInt(S(rows, key)) })
const avgCol = (key: string, label: string, weight: string, digits: number): Col => ({
  key, label, fmt: (v) => fmtDec(v[key], digits), total: (rows) => (rows.length ? fmtDec(W(rows, key, weight), digits) : '—'),
})
const ratio = (part: number, whole: number) => (whole < 3 ? 'Không đủ dữ liệu' : `${pct(part, whole)}%`) // GBR-106: n < 3

const DEFS: Record<ReportCode, Def> = {
  'RPT-01': {
    columns: [sumCol('head', 'Số con'), sumCol('in', 'Nhập đàn'), sumCol('out', 'Xuất đàn')],
    tiles: (r) => [
      { label: 'Số con cuối kỳ', value: fmtInt(S(r, 'head')), note: 'đang nuôi' },
      { label: 'Nhập đàn trong kỳ', value: fmtInt(S(r, 'in')), note: 'con' },
      { label: 'Xuất đàn trong kỳ', value: fmtInt(S(r, 'out')), note: 'con' },
      { label: 'Chuồng đang dùng', value: fmtInt(r.filter((x) => x.v.head > 0).length), note: 'có bò' },
    ],
  },
  'RPT-02': {
    columns: [sumCol('weigh', 'Lượt cân hợp lệ'), sumCol('est', 'Cân ước tính'), avgCol('avgW', 'Cân nặng TB (kg)', 'weigh', 0), avgCol('adg', 'ADG (kg/ngày)', 'weigh', 2)],
    tiles: (r) => [
      { label: 'Lượt cân hợp lệ', value: fmtInt(S(r, 'weigh')), note: 'trong kỳ' },
      { label: 'ADG trung bình', value: r.length ? fmtDec(W(r, 'adg', 'weigh')) : '—', note: 'kg/ngày' },
      { label: 'Cân nặng trung bình', value: r.length ? fmtInt(W(r, 'avgW', 'weigh')) : '—', note: 'kg' },
      { label: 'Tỷ lệ cân ước tính', value: `${pct(S(r, 'est'), S(r, 'weigh'))}%`, note: `${fmtInt(S(r, 'est'))}/${fmtInt(S(r, 'weigh'))} lượt cân` },
    ],
  },
  'RPT-03': {
    columns: [sumCol('planned', 'Kế hoạch'), sumCol('done', 'Đã tiêm'), sumCol('deferred', 'Hoãn'), sumCol('overdue', 'Quá hạn')],
    tiles: (r) => [
      { label: 'Liều kế hoạch', value: fmtInt(S(r, 'planned')), note: 'trong kỳ' },
      { label: 'Đã tiêm', value: fmtInt(S(r, 'done')), note: `đạt ${pct(S(r, 'done'), S(r, 'planned'))}% kế hoạch` },
      { label: 'Hoãn', value: fmtInt(S(r, 'deferred')), note: 'liều' },
      { label: 'Quá hạn', value: fmtInt(S(r, 'overdue')), note: 'liều' },
    ],
  },
  'RPT-04': {
    columns: [sumCol('opened', 'Ca mở'), sumCol('chronic', 'Theo dõi mạn tính'), sumCol('closed', 'Ca đã đóng'), sumCol('treat', 'Lượt điều trị'), sumCol('withdraw', 'Đang ngưng thịt')],
    tiles: (r) => [
      { label: 'Ca mở trong kỳ', value: fmtInt(S(r, 'opened')), note: 'ca' },
      { label: 'Theo dõi mạn tính', value: fmtInt(S(r, 'chronic')), note: 'ca cuối kỳ' },
      { label: 'Ca đã đóng', value: fmtInt(S(r, 'closed')), note: 'ca' },
      { label: 'Đang ngưng thịt', value: fmtInt(S(r, 'withdraw')), note: 'con' },
    ],
  },
  'RPT-05': {
    columns: [
      sumCol('cows', 'Bò cái'), sumCol('breed', 'Phối'), sumCol('check', 'Khám thai'), sumCol('preg', 'Có thai'), sumCol('calv', 'Đẻ trong kỳ'),
      {
        key: 'interval',
        label: 'Khoảng cách lứa đẻ',
        fmt: (v, missing) => (missing ? { badge: `Thiếu dữ liệu (${missing} con)` } : `${fmtInt(v.intervalDays)} ngày (TB ${fmtInt(v.intervalN)} con)`),
        total: () => '—',
      },
    ],
    tiles: (r) => [
      { label: 'Bò cái theo dõi', value: fmtInt(S(r, 'cows')), note: 'đủ điều kiện sinh sản' },
      { label: 'Lượt phối', value: fmtInt(S(r, 'breed')), note: `TTNT ${fmtInt(S(r, 'ttnt'))} · tự nhiên ${fmtInt(S(r, 'breed') - S(r, 'ttnt'))}` },
      { label: 'Đậu thai lần phối đầu', value: ratio(S(r, 'fsPreg'), S(r, 'fs')), note: `${fmtInt(S(r, 'fsPreg'))}/${fmtInt(S(r, 'fs'))} có kết quả khám thai` },
      { label: 'Bê sinh sống', value: fmtInt(S(r, 'live')), note: `${fmtInt(S(r, 'still'))} chết lúc sinh` },
    ],
  },
  'RPT-06': {
    columns: [sumCol('in', 'Nhập đàn'), sumCol('out', 'Xuất đàn'), sumCol('moveIn', 'Chuyển đến'), sumCol('moveOut', 'Chuyển đi')],
    tiles: (r) => [
      { label: 'Nhập đàn', value: fmtInt(S(r, 'in')), note: 'con' },
      { label: 'Xuất đàn', value: fmtInt(S(r, 'out')), note: 'con' },
      { label: 'Lượt chuyển chuồng', value: fmtInt(S(r, 'moveIn')), note: 'con' },
      { label: 'Chuồng có biến động', value: fmtInt(r.filter((x) => x.v.in + x.v.out + x.v.moveIn + x.v.moveOut > 0).length), note: 'chuồng' },
    ],
  },
  'RPT-07': {
    columns: [
      {
        key: 'head',
        label: 'Số con',
        fmt: (v, missing) => ({ text: fmtInt(v.head), badge: missing ? `Thiếu cân (${missing} con)` : undefined }),
        total: (rows) => ({ text: fmtInt(S(rows, 'head')), badge: missingOf(rows) ? `Thiếu cân (${missingOf(rows)} con)` : undefined }),
      },
      avgCol('startW', 'Cân đầu kỳ (kg)', 'incl', 0), avgCol('endW', 'Cân cuối kỳ (kg)', 'incl', 0), avgCol('adg', 'ADG (kg/ngày)', 'incl', 2),
      avgCol('feed', 'Thức ăn/kg tăng', 'incl', 1), avgCol('cost', 'Chi phí/kg tăng (đ)', 'incl', 0), sumCol('reached', 'Đạt cân xuất'),
    ],
    tiles: (r) => [
      { label: 'ADG', value: r.length ? fmtDec(W(r, 'adg', 'incl')) : '—', note: 'kg/ngày' },
      { label: 'Thức ăn/kg tăng', value: r.length ? fmtDec(W(r, 'feed', 'incl'), 1) : '—', note: 'kg thức ăn/kg tăng' },
      { label: 'Chi phí thức ăn/kg tăng', value: r.length ? fmtInt(W(r, 'cost', 'incl')) : '—', note: 'đ/kg tăng' },
      { label: 'Đạt cân xuất', value: fmtInt(S(r, 'reached')), note: 'con đạt khối lượng mục tiêu' },
    ],
  },
}

const monthsLimit = (from: string) => { const [y, m, d] = from.split('-').map(Number); return Date.UTC(y, m - 1 + 24, d) }

/** MSG-COM-06, MSG-COM-11 và kỳ tối đa 24 tháng (SCR-49). */
export function validateReportRequest(req: ReportRequest): string | null {
  if (!req.dateFrom || !req.dateTo) return 'Kỳ báo cáo là bắt buộc.'
  if (req.dateFrom > req.dateTo) return 'Ngày bắt đầu không được sau ngày kết thúc.'
  if (Date.parse(`${req.dateTo}T00:00:00Z`) >= monthsLimit(req.dateFrom)) return 'Kỳ báo cáo tối đa 24 tháng.'
  return null
}

const rangeLabel = (from: string, to: string) => (from.slice(0, 4) === to.slice(0, 4) ? `${formatKeyShort(from)}–${formatKey(to)}` : `${formatKey(from)}–${formatKey(to)}`)

export function buildReport(seedRows: Rows, req: ReportRequest, generatedAt: string, chart: Array<{ label: string; value: number }>): ReportView {
  const entry = REPORT_CATALOGUE.find((c) => c.code === req.reportType)!
  const def = DEFS[req.reportType]
  const uses = (k: ReportFilterKey) => entry.filters.includes(k)
  const rows = seedRows.filter((r) =>
    (!uses('pen') || !req.pen || r.pen === req.pen) &&
    (!uses('group') || !req.herdGroup || r.groups.length === 0 || r.groups.includes(req.herdGroup)) &&
    (!uses('stage') || !req.lifeStage || r.stages.length === 0 || r.stages.includes(req.lifeStage)))

  const unfiltered = (!uses('pen') || !req.pen) && (!uses('group') || !req.herdGroup) && (!uses('stage') || !req.lifeStage)
  const penCodes = [...new Set(rows.map((r) => r.pen))]
  const penScope = !uses('pen') ? 'Toàn trại' : penCodes.length === 0 ? 'Không có chuồng phù hợp' : req.pen || penCodes.length <= 4 ? `Chuồng ${penCodes.join(', ')}` : 'Tất cả chuồng'
  return {
    reportType: req.reportType,
    title: entry.label,
    from: req.dateFrom,
    to: req.dateTo,
    generatedAt,
    scope: `${entry.label} · ${rangeLabel(req.dateFrom, req.dateTo)} · ${penScope}`,
    tiles: def.tiles(rows),
    columns: def.columns.map(({ key, label }) => ({ key, label })),
    rows: rows.map((r) => ({ label: r.label, cells: Object.fromEntries(def.columns.map((c) => [c.key, c.fmt(r.v, r.missing ?? 0)])) })),
    totalRow: rows.length ? { label: 'Tổng', cells: Object.fromEntries(def.columns.map((c) => [c.key, c.total(rows)])) } : null,
    chart: req.reportType === 'RPT-05' && unfiltered ? { title: 'Tỷ lệ đậu thai theo tháng', sub: 'Lần phối đầu, %', bars: chart } : null,
    unavailableData: rows.filter((r) => r.missing).map((r) => `Không đủ dữ liệu cho ${r.pen} (${r.missing} con); các mục này được hiển thị riêng.`),
  }
}
