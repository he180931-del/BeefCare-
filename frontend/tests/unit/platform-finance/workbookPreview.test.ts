import { describe, expect, it } from 'vitest'
import { buildWorkbookPreview, monthsBetween } from '../../../src/features/platform-finance/components/ReportParts'
import type { CashReport, ReportLine } from '../../../src/features/platform-finance/types'

const line = (p: Partial<ReportLine>): ReportLine => ({
  sourceType: 'MANUAL', code: 'FR-1', scope: 'FARM', farmName: 'Trại A', direction: 'IN', category: 'OTHER_INCOME',
  amountVnd: 0, cashDate: '2026-10-05', status: 'POSTED', reference: '', sourceVersion: 1, ...p,
})

const report: CashReport = {
  id: 1, code: 'SNAP-1', expired: false, generatedAt: '2026-11-26T06:46:00', expiresAt: '2026-11-27T06:46:00',
  criteria: { dateFrom: '2026-10-01', dateTo: '2026-11-26', farmId: null, sourceFilter: 'BOTH' },
  summary: {
    subscriptionReceipts: 1_000_000, otherIncome: 200_000, totalIncome: 1_200_000, totalExpense: 300_000, netCashFlow: 900_000,
    scopes: [], dailyIncome: [], note: '',
  },
  lines: [
    line({ code: 'RC-1', sourceType: 'RECEIPT', category: 'SUBSCRIPTION', amountVnd: 1_000_000, cashDate: '2026-10-03', farmName: 'Trại B' }),
    line({ code: 'FR-2', amountVnd: 200_000, cashDate: '2026-11-02' }),
    line({ code: 'FR-3', direction: 'OUT', category: 'MARKETING', amountVnd: 300_000, cashDate: '2026-11-10', scope: 'GENERAL', farmName: 'Chung' }),
  ],
}

const sheet = () => buildWorkbookPreview(report, 'Tất cả trại', 'Biên nhận + thủ công')[0]
const row = (label: string) => sheet().rows.find((r) => r.cells[0] === label)?.cells

describe('XLSX preview: sheet Tổng hợp', () => {
  it('có đủ 4 sheet theo thứ tự', () => {
    expect(buildWorkbookPreview(report, 'Tất cả trại', 'x').map((s) => s.name)).toEqual(['Tổng hợp', 'Theo trại', 'Thu', 'Chi'])
  })

  it('kết quả chính gồm tổng thu, chi, ròng và tỷ lệ chi / thu', () => {
    expect(row('Tổng thu')).toEqual(['Tổng thu', 1_200_000])
    expect(row('Tổng chi')).toEqual(['Tổng chi', 300_000])
    expect(row('Dòng tiền ròng')).toEqual(['Dòng tiền ròng', 900_000])
    expect(row('Tỷ lệ chi / thu')).toEqual(['Tỷ lệ chi / thu', '25%'])
  })

  it('theo tháng: mỗi tháng trong kỳ một dòng, có ròng lũy kế', () => {
    expect(row('Tháng 10/2026')).toEqual(['Tháng 10/2026', 1_000_000, 0, 1_000_000, 1_000_000])
    expect(row('Tháng 11/2026')).toEqual(['Tháng 11/2026', 200_000, 300_000, -100_000, 900_000])
  })

  it('điểm nổi bật: số giao dịch, trại thu nhiều nhất', () => {
    expect(row('Số giao dịch thu')).toEqual(['Số giao dịch thu', '2'])
    expect(row('Số giao dịch chi')).toEqual(['Số giao dịch chi', '1'])
    expect(row('Trại thu nhiều nhất')?.[1]).toMatch(/^Trại B/)
  })

  it('không lặp bảng theo trại, không có dòng ghi chú', () => {
    const labels = sheet().rows.map((r) => String(r.cells[0] ?? ''))
    expect(labels).not.toContain('Theo trại')
    expect(labels.some((l) => l.startsWith('Ghi chú'))).toBe(false)
  })

  it('monthsBetween gồm cả tháng trống và qua năm', () => {
    expect(monthsBetween('2026-11-15', '2027-02-01')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
})
