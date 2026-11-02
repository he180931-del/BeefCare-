import { describe, expect, it, vi } from 'vitest'
import { createFarmOverviewApi } from '../../../src/features/farm-overview/api/farmOverviewApi'
import { createFarmOverviewDemoStore } from '../../../src/features/farm-overview/data/farmOverviewDemoStore'
import type { ReportRequest } from '../../../src/features/farm-overview/types'

const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() })
const make = () => createFarmOverviewApi({ mode: 'local', farmId: 1, transport: transport(), store: createFarmOverviewDemoStore() })
const owner = { role: 'OWNER' as const }
const manager = { role: 'MANAGER' as const }
const newFarm = { role: 'OWNER' as const, scenario: 'new-farm' as const }
const rpt05: ReportRequest = { reportType: 'RPT-05', dateFrom: '2026-07-01', dateTo: '2026-09-30' }

describe('dashboard indicators', () => {
  it('adds up the herd cells into M01-M09 and counts every cattle once', async () => {
    const view = await make().getDashboard({ period: '30' }, owner)
    const i = view.indicators
    expect(view.activeCattle).toBe(248)
    expect(i.m01).toEqual({ total: 248, zebu: 142, sind: 106 })
    expect(i.m02).toEqual({ total: 7, treating: 5, withdrawal: 2 })
    expect(i.m03).toEqual({ total: 18, overdue: 3 })
    expect(i.m04).toEqual({ total: 6, within7: 2 })
    expect(i.m05.total).toBe(248)
    expect(i.m05.rows.reduce((t, r) => t + r.head, 0)).toBe(248)
    expect(i.m05.pregnant).toBe(41)
    expect(i.m06).toMatchObject({ value: 0.62, byGroup: [{ label: 'Bò tơ', value: 0.51 }, { label: 'Vỗ béo', value: 0.78 }] })
    expect(i.m07).toEqual({ total: 12 })
    expect(i.m08).toEqual({ head: 248, capacity: 300, percent: 83, fullPens: 2 })
    expect(view.attention).toHaveLength(8)
  })

  it('applies pen, group and stage filters to compatible indicators', async () => {
    const api = make()
    const pen = await api.getDashboard({ period: '30', pen: 'D1' }, owner)
    expect(pen.indicators.m01.total).toBe(40)
    expect(pen.indicators.m08).toMatchObject({ head: 40, capacity: 40, fullPens: 1 })
    expect(pen.attention.map((a) => a.code)).toEqual(['BC-000088'])
    const group = await api.getDashboard({ period: '30', herdGroup: 'BREEDING_FEMALE' }, owner)
    expect(group.indicators.m01.total).toBe(96)
    expect(group.indicators.m05.rows.map((r) => r.label)).toEqual(['Bò cái sinh sản'])
  })

  it('shows ADG only when the period covers 14 days (GBR-39) and lowers it over a long window', async () => {
    const api = make()
    expect((await api.getDashboard({ period: '7' }, owner)).indicators.m06).toMatchObject({ value: null, unavailable: 'PERIOD_TOO_SHORT' })
    expect((await api.getDashboard({ period: '90' }, owner)).indicators.m06.value).toBeLessThan(0.62)
  })

  it('rejects a custom period whose start is after its end', async () => {
    await expect(make().getDashboard({ period: 'custom', from: '2026-10-10', to: '2026-10-01' }, owner)).rejects.toThrow('Ngày bắt đầu không được sau ngày kết thúc.')
    await expect(make().getDashboard({ period: 'custom' }, owner)).rejects.toThrow('Kỳ là bắt buộc.')
  })

  it('only lets the Owner act on the pending exit voucher row', async () => {
    const api = make()
    const row = (v: Awaited<ReturnType<typeof api.getDashboard>>) => v.attention.find((a) => a.kind === 'A03')!
    expect(row(await api.getDashboard({ period: '30' }, owner)).to).toBe('/herd-exit')
    expect(row(await api.getDashboard({ period: '30' }, manager)).to).toBeNull()
  })

  it('refuses the dashboard to a Technician', async () => {
    await expect(make().getDashboard({ period: '30' }, { role: 'TECHNICIAN' })).rejects.toThrow('Bạn không có quyền')
  })
})

describe('getting started (new farm, D10)', () => {
  it('derives data steps, lets the user mark review steps and hides the panel when done', async () => {
    const api = make()
    const empty = await api.getDashboard({ period: '30' }, newFarm)
    expect(empty.empty).toBe(true)
    expect(empty.indicators.m01.total).toBe(0)
    expect(empty.indicators.m08).toBeNull()

    const start = await api.getGettingStarted(newFarm)
    expect(start.visible).toBe(true)
    expect(start.steps.filter((s) => s.done).map((s) => s.step)).toEqual(['PENS', 'BREEDS_PURPOSES'])
    await expect(api.markStepDone('FIRST_HERD_ENTRY', newFarm)).rejects.toThrow('tính tự động')

    const marked = await api.markStepDone('FARM_PARAMETERS', newFarm)
    expect(marked.steps.find((s) => s.step === 'FARM_PARAMETERS')?.done).toBe(true)
    expect(marked.visible).toBe(true)
  })

  it('hides the owner-only invite step from a Manager and can be dismissed', async () => {
    const api = make()
    expect((await api.getGettingStarted({ role: 'MANAGER', scenario: 'new-farm' })).steps.map((s) => s.step)).not.toContain('INVITE_MEMBERS')
    const dismissed = await api.dismissGettingStarted(newFarm)
    expect(dismissed).toMatchObject({ dismissed: true, visible: false })
  })
})

describe('reminders', () => {
  it('groups by urgency and hides management-only rules from the Technician', async () => {
    const api = make()
    const all = await api.listReminders('OWNER')
    expect(all.items).toHaveLength(17)
    expect(all.items.filter((i) => i.urgency === 'OVERDUE')).toHaveLength(2)
    expect(all.items.filter((i) => i.urgency === 'TODAY')).toHaveLength(4)
    expect(all.items[0].urgency).toBe('OVERDUE')
    const tech = await api.listReminders('TECHNICIAN')
    expect(tech.items.some((i) => ['draft-calf', 'feed', 'exit-finishing'].includes(i.type))).toBe(false)
    expect(tech.items).toHaveLength(13)
  })

  it('keeps a reminder with a missing basis and no due date', async () => {
    const item = (await make().listReminders('MANAGER')).items.find((i) => i.basisMissing)!
    expect(item.dueAt).toBeNull()
    expect(item.urgency).toBe('UPCOMING')
  })
})

describe('management reports', () => {
  it('builds RPT-05 totals from the per-pen rows', async () => {
    const view = await make().runReport(rpt05, 'OWNER')
    expect(view.tiles.map((t) => t.value)).toEqual(['86', '41', '58%', '17'])
    expect(view.tiles[1].note).toBe('TTNT 33 · tự nhiên 8')
    expect(view.totalRow?.cells).toMatchObject({ cows: '86', breed: '41', check: '36', preg: '26', calv: '18', interval: '—' })
    expect(view.rows[2].cells.interval).toEqual({ badge: 'Thiếu dữ liệu (4 con)' })
    expect(view.chart?.bars).toHaveLength(3)
  })

  it('filters by pen, recomputes the total and drops the farm-level chart', async () => {
    const view = await make().runReport({ ...rpt05, pen: 'A2' }, 'MANAGER')
    expect(view.rows).toHaveLength(1)
    expect(view.totalRow?.cells.cows).toBe('22')
    expect(view.chart).toBeNull()
  })

  it('validates the period: required, ordered and at most 24 months', async () => {
    const api = make()
    await expect(api.runReport({ ...rpt05, dateFrom: '' }, 'OWNER')).rejects.toThrow('Kỳ báo cáo là bắt buộc.')
    await expect(api.runReport({ ...rpt05, dateFrom: '2026-10-01', dateTo: '2026-09-01' }, 'OWNER')).rejects.toThrow('Ngày bắt đầu không được sau ngày kết thúc.')
    await expect(api.runReport({ ...rpt05, dateFrom: '2024-09-30', dateTo: '2026-09-30' }, 'OWNER')).rejects.toThrow('tối đa 24 tháng')
    await expect(api.runReport({ ...rpt05, dateFrom: '2024-10-01', dateTo: '2026-09-30' }, 'OWNER')).resolves.toBeTruthy()
  })

  it('answers every report type in the catalogue', async () => {
    const api = make()
    for (const reportType of ['RPT-01', 'RPT-02', 'RPT-03', 'RPT-04', 'RPT-06', 'RPT-07'] as const) {
      const view = await api.runReport({ ...rpt05, reportType }, 'OWNER')
      expect(view.rows.length).toBeGreaterThan(0)
      expect(view.tiles).toHaveLength(4)
    }
  })
})

describe('backend mode', () => {
  it('rejects every call and never touches the mock store', async () => {
    const store = createFarmOverviewDemoStore()
    const spy = vi.spyOn(store, 'getDashboard')
    const api = createFarmOverviewApi({ mode: 'backend', farmId: 1, transport: transport(), store })
    await expect(api.getDashboard({ period: '30' }, owner)).rejects.toBeTruthy()
    await expect(api.listReminders('OWNER')).rejects.toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })
})
