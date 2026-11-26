import { describe, expect, it, vi } from 'vitest'
import { createFarmOverviewApi } from '../../../src/features/farm-overview/api/farmOverviewApi'
import { createFarmOverviewDemoStore } from '../../../src/features/farm-overview/data/farmOverviewDemoStore'
import { dueLabel, EMPTY_FILTERS, filterReminders, reminderGroupKey, toItem, typeOptionsFor } from '../../../src/features/farm-overview/domain/reminderRules'
import { REPORT_CATALOGUE } from '../../../src/features/farm-overview/domain/reportRules'
import type { ReminderSeed, ReportRequest } from '../../../src/features/farm-overview/types'

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
  it('groups reminders by farm-local date and keeps the Technician feed filter available', () => {
    expect(reminderGroupKey({ dueAt: '2026-11-14T18:00:00Z', urgency: 'TODAY' }, true, 'Asia/Ho_Chi_Minh')).toBe('2026-11-15')
    expect(reminderGroupKey({ dueAt: '2026-11-10T16:30:00Z', urgency: 'TODAY' }, true, 'Asia/Ho_Chi_Minh')).toBe('2026-11-10')
    expect(typeOptionsFor('TECHNICIAN')).toContain('feed')
    expect(typeOptionsFor('TECHNICIAN')).not.toContain('draft-calf')
  })

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

  it('TC-14-09: classifies the planned dose on 20/11 as upcoming on 15/11, then counts overdue days', () => {
    const seed: ReminderSeed = {
      id: 1409, rule: 'REM-06', type: 'vaccination', title: 'Liều tiêm dự kiến', code: 'BC-1409',
      breed: null, pen: null, due: '2026-11-20', basis: 'PLANNED', parameterVersion: 1,
      source: 'Lịch tiêm', to: null, openLabel: null, audience: ['OWNER'],
    }
    const planned = toItem(seed, '2026-11-15')
    expect(planned.urgency).toBe('UPCOMING')
    expect(filterReminders([planned], { ...EMPTY_FILTERS, range: 'due7' }, '2026-11-15')).toEqual([planned])

    const oneDayLate = toItem(seed, '2026-11-21')
    expect(oneDayLate.urgency).toBe('OVERDUE')
    expect(dueLabel(oneDayLate, '2026-11-21')).toBe('Hôm qua')
    const threeDaysLate = toItem(seed, '2026-11-23')
    expect(dueLabel(threeDaysLate, '2026-11-23')).toBe('Quá hạn 3 ngày')
  })
})

describe('management reports', () => {
  it('builds RPT-05 totals from the per-pen rows', async () => {
    const view = await make().runReport(rpt05, 'OWNER')
    expect(view.tiles.map((t) => t.value)).toEqual(['86', '58%', '18', '17'])
    expect(view.tiles.find((tile) => tile.label === 'Đậu thai lần phối đầu')?.note).toBe('19/33 có kết quả khám thai')
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
    await expect(api.runReport({ ...rpt05, dateFrom: '2024-09-30', dateTo: '2026-09-30' }, 'OWNER')).resolves.toBeTruthy()
    await expect(api.runReport({ ...rpt05, dateFrom: '2024-10-01', dateTo: '2026-09-30' }, 'OWNER')).resolves.toBeTruthy()
    await expect(api.runReport({ ...rpt05, dateFrom: '2024-10-01', dateTo: '2026-10-01' }, 'OWNER')).resolves.toBeTruthy()
    await expect(api.runReport({ ...rpt05, dateFrom: '2024-02-29', dateTo: '2026-02-28' }, 'OWNER')).resolves.toBeTruthy()
    await expect(api.runReport({ ...rpt05, dateFrom: '2024-02-29', dateTo: '2026-03-01' }, 'OWNER')).rejects.toThrow('tối đa 24 tháng')
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
  const dashboardBody = {
    farmName: 'Trại thử', activeCattle: 2, serviceStatus: 'ACTIVE', generatedAt: '2026-11-14T04:00:00Z',
    indicators: {
      M01: { count: 2, byBreed: { 'Lai Sind': 2 } },
      M02: { attentionCount: 1, underTreatment: 1, activeWithdrawal: 0 },
      M03: { dueWithin7Days: 1, overdue: 1, doses: [] },
      M04: { within30Days: 1, within7Days: 1 },
      M05: { byHerdGroup: { BREEDING_FEMALES: 1, YOUNG_STOCK: 0, FATTENING: 0, CALVES: 0, BREEDING_BULLS: 0, OTHER: 1 }, pregnantBreedingFemales: 1 },
      M06: { sampleCount: 1, averageKgPerDay: 0.5, byHerdGroup: { BREEDING_FEMALES: { averageKgPerDay: 0.5, sampleCount: 1 } } },
      M07: { overdueCount: 1 },
      M08: { totalHead: 2, totalCapacity: 4, byPen: [{ penId: 9, code: 'P1', head: 2, capacity: 4 }] },
      M09: { averageCalvingInterval: { value: null, n: 2, status: 'INSUFFICIENT_DATA' }, overallConceptionRate: { value: 0.5, n: 4, status: 'AVAILABLE' }, overdueFemales: [], overdueCount: 0 },
    },
    attention: [{ type: 'BREEDING_WINDOW', cattleId: 1, displayCode: 'C-1', dueAt: '2026-11-14T09:00:00Z' }],
  }
  const contextBody = { timeZone: 'Asia/Tokyo', serviceUntil: '2026-11-30T16:30:00Z' }
  const penBody = { pens: [{ id: 9, code: 'P1', name: 'Chuồng 1', capacity: 4, status: 'ACTIVE' }] }
  const backend = (responses: Record<string, unknown>, commands: Record<string, unknown> = {}) => {
    const get = vi.fn(async (path: string) => responses[path] ?? responses[Object.keys(responses).find((key) => path.endsWith(key) || path.includes(key)) ?? ''])
    const command = vi.fn(async (path: string, _body: unknown, _options?: { method?: string; key?: string; headers?: Record<string, string> }) => commands[path] ?? commands[Object.keys(commands).find((key) => path.endsWith(key) || path.includes(key)) ?? ''])
    const api = createFarmOverviewApi({
      mode: 'backend', farmId: 1, transport: { get, command, farmPath: (id, suffix = '') => `/api/farms/${id}${suffix}` }, store: createFarmOverviewDemoStore(),
    })
    return { api, get, command }
  }

  it('maps the backend dashboard DTO and sends farm-scoped filter IDs without reading the demo store', async () => {
    const store = createFarmOverviewDemoStore()
    const spy = vi.spyOn(store, 'getDashboard')
    const get = vi.fn(async (path: string) => {
      if (path.endsWith('/context')) return contextBody
      if (path.endsWith('/pens')) return penBody
      if (path.includes('/dashboard?')) return dashboardBody
      return undefined
    })
    const api = createFarmOverviewApi({ mode: 'backend', farmId: 1, transport: { get, command: vi.fn(), farmPath: (id, suffix = '') => `/api/farms/${id}${suffix}` }, store })
    const view = await api.getDashboard({ period: '30', pen: 'P1', herdGroup: 'BREEDING_FEMALE', lifeStage: 'ADULT' }, owner)
    const dashboardRequest = get.mock.calls.find(([path]) => path.includes('/dashboard?'))?.[0]
    const query = new URLSearchParams(dashboardRequest?.split('?')[1] ?? '')
    expect(query.get('penId')).toBe('9')
    expect(query.get('herdGroup')).toBe('BREEDING_FEMALES')
    expect(query.get('lifeStage')).toBe('ADULT')
    expect(view).toMatchObject({ farmName: 'Trại thử', activeCattle: 2, serviceUntil: '2026-11-30', timeZone: 'Asia/Ho_Chi_Minh' })
    expect(view.indicators.m01).toMatchObject({ total: 2, breedBreakdown: [{ label: 'Lai Sind', count: 2 }] })
    expect(view.indicators.m03).toEqual({ total: null, overdue: null })
    expect(view.indicators.m08).toBeNull()
    expect(view.indicators.m08Unavailable).toBe('FILTER_NOT_SUPPORTED')
    expect(view.attentionUnavailable).toBe(true)
    expect(view.indicators.m05.total).toBe(2)
    expect(view.indicators.m09).toMatchObject({ calvingIntervalDays: null, calvingIntervalN: 2, conceptionRate: 50, conceptionRateN: 4 })
    expect(view.attention).toEqual([])
    const unfiltered = await api.getDashboard({ period: '30' }, owner)
    expect(unfiltered.attention[0]).toMatchObject({ code: 'C-1', to: '/cattle/C-1', issue: 'Đang trong cửa sổ phối' })
    const penOnly = await api.getDashboard({ period: '30', pen: 'P1' }, owner)
    expect(penOnly.indicators.m08).toMatchObject({ head: 2, capacity: 4, percent: 50 })
    expect(spy).not.toHaveBeenCalled()
  })

  it('maps attention rows that the backend sends without a type (draft calf A02, pending death exit A03, finishing reached A04)', async () => {
    // Đúng hình dạng FarmDashboardService trả về: ba loại dòng này không có trường "type".
    const attention = [
      { calfOutcomeId: 3802, damId: 2719, damCode: 'BC-000019', birthTime: '2026-11-01T21:10:00Z', highlighted: true },
      { voucherId: 3951, code: 'PX-2026-0001', exitDate: '2026-11-19', highlighted: false },
      { cattleId: 5, displayCode: 'BC-000005', pen: 'A1', latestWeightKg: 455, targetKg: 450 },
    ]
    const { api } = backend({ '/context': contextBody, '/pens': penBody, '/dashboard?': { ...dashboardBody, attention } })
    const view = await api.getDashboard({ period: '30' }, owner)
    expect(view.attention.map((a) => [a.kind, a.code, a.issue])).toEqual([
      ['A02', 'BC-000019', 'Bê nháp chờ xác nhận'],
      ['A03', 'PX-2026-0001', 'Phiếu chết chờ duyệt'],
      ['A04', 'BC-000005', 'Đạt cân xuất chuồng · 455 / 450 kg'],
    ])
  })

  it('marks a filtered zero-result dashboard empty without replacing the farm-wide header count', async () => {
    const noMatches = {
      ...dashboardBody,
      indicators: {
        ...dashboardBody.indicators,
        M01: { count: 0, byBreed: {} },
        M05: { byHerdGroup: { BREEDING_FEMALES: 0, YOUNG_STOCK: 0, FATTENING: 0, CALVES: 0, BREEDING_BULLS: 0, OTHER: 0 }, pregnantBreedingFemales: 0 },
      },
    }
    const { api } = backend({ '/context': contextBody, '/pens': penBody, '/dashboard?': noMatches })
    const view = await api.getDashboard({ period: '30', herdGroup: 'BREEDING_FEMALE' }, owner)
    expect(view.activeCattle).toBe(2)
    expect(view.empty).toBe(true)
    expect(view.indicators.m01.total).toBe(0)
  })

  it('maps getting-started steps and sends mark/dismiss commands using backend step codes', async () => {
    const started = { visible: true, dismissed: false, allDone: false, steps: [{ step: 'REVIEW_BREEDS_AND_PURPOSES', screen: 'SCR-52', done: false, markable: true }] }
    const { api, command } = backend({}, {
      '/api/farms/1/dashboard/getting-started/steps/REVIEW_BREEDS_AND_PURPOSES/done': started,
      '/api/farms/1/dashboard/getting-started/dismiss': { ...started, dismissed: true, visible: false },
    })
    expect(await api.markStepDone('BREEDS_PURPOSES', owner)).toMatchObject({ steps: [{ step: 'BREEDS_PURPOSES', screen: '/danh-muc', markable: true }] })
    expect(command.mock.calls[0]?.[0]).toContain('/REVIEW_BREEDS_AND_PURPOSES/done')
    expect((await api.dismissGettingStarted(owner)).dismissed).toBe(true)
  })

  it('keeps unavailable reminder details and source actions empty instead of guessing them', async () => {
    const { api } = backend({
      '/context': contextBody,
      '/reminders': [
        { id: null, ruleType: 'REM-05', sourceRecord: 'REPRODUCTION_EVENT:8', cattleId: 8, dueTime: '2026-11-14T04:00:00Z', lifecycleStatus: 'ACTIVE', urgency: 'TODAY', highlighted: false, basisLabel: 'TENTATIVE', parameterVersion: 3 },
        { id: null, ruleType: 'REM-11', sourceRecord: 'FEED:3', dueTime: '2026-11-14T04:00:00Z', lifecycleStatus: 'ACTIVE', urgency: 'TODAY', highlighted: false },
        { id: null, ruleType: 'REM-11', sourceRecord: 'FEED:3', dueTime: '2026-11-14T04:00:00Z', lifecycleStatus: 'ACTIVE', urgency: 'TODAY', highlighted: false },
      ],
    })
    const list = await api.listReminders('OWNER')
    expect(list.today).toBeTruthy()
    expect(list.items[0]).toMatchObject({ urgency: 'TODAY', code: null, breed: null, pen: null, to: null, openLabel: null, basis: 'TENTATIVE', parameterVersion: 3 })
    expect(list.items[1]?.id).not.toBe(list.items[2]?.id)
  })

  it('maps the reminder projection and opens only role-authorized, source-matched routes', async () => {
    const cattle = { code: 'C-1', breed: 'Lai Sind', sex: 'FEMALE', ageMonths: 30, pen: 'P1' }
    const target = (type: string, fields: Record<string, unknown> = {}) => ({ type, id: null, cattleId: null, penId: null, date: null, sessionNo: null, code: null, ...fields })
    const { api } = backend({
      '/context': contextBody,
      '/reminders': [
        {
          id: 1, ruleType: 'REM-01', sourceRecord: 'CATTLE:1:WEIGHT:12', cattleId: 1, dueTime: '2026-11-14T04:00:00Z',
          lifecycleStatus: 'ACTIVE', urgency: 'TODAY', highlighted: false, basisLabel: null, parameterVersion: 4,
          sourceType: 'CATTLE', sourceId: 'CATTLE:1:WEIGHT:12', sourceSummary: 'Cân 400 kg · 15/10/2026', cattle,
          basisValues: { WEIGHING_INTERVAL_DAYS: 30 }, basisMissing: null,
          cattleProfileTarget: target('CATTLE_PROFILE', { id: 1, cattleId: 1, code: 'C-1' }),
          sourceTarget: target('GROWTH_RECORD', { id: 12, cattleId: 1 }),
        },
        {
          id: 2, ruleType: 'REM-01', sourceRecord: 'CATTLE:1:ENTRY:22', cattleId: 1, dueTime: '2026-11-14T04:00:00Z',
          lifecycleStatus: 'ACTIVE', urgency: 'TODAY', highlighted: false, sourceType: 'CATTLE', sourceId: 'CATTLE:1:ENTRY:22',
          sourceSummary: 'Nhập đàn 01/10/2026', cattle, basisValues: {},
          cattleProfileTarget: target('CATTLE_PROFILE', { id: 1, cattleId: 1, code: 'C-1' }),
          sourceTarget: target('HERD_ENTRY', { id: 22, cattleId: 1 }),
        },
        {
          id: 3, ruleType: 'REM-12', sourceRecord: 'HerdExitVoucher:47', cattleId: 1, dueTime: '2026-11-14T04:00:00Z',
          lifecycleStatus: 'ACTIVE', urgency: 'TODAY', highlighted: false, sourceType: 'HerdExitVoucher', sourceId: 'HerdExitVoucher:47',
          sourceSummary: 'Phiếu PX-2026-0047 · chờ xác nhận của Owner', cattle,
          cattleProfileTarget: target('CATTLE_PROFILE', { id: 1, cattleId: 1, code: 'C-1' }),
          sourceTarget: target('DEATH_VOUCHER', { id: 47, cattleId: 1, code: 'PX-2026-0047' }),
        },
        {
          id: 4, ruleType: 'REM-11', sourceRecord: 'PEN:9:RATION:7:DAY:2026-11-15:SESSION:2', dueTime: '2026-11-15T04:00:00Z',
          lifecycleStatus: 'ACTIVE', urgency: 'TODAY', highlighted: false, sourceType: 'PEN', sourceId: 'PEN:9:RATION:7:DAY:2026-11-15:SESSION:2',
          sourceSummary: 'Chuồng P1 · bữa 2 · 15/11/2026 · chưa ghi', cattle: null,
          sourceTarget: target('FEEDING_LOG', { penId: 9, date: '2026-11-15', sessionNo: 2, code: 'P1' }),
        },
        {
          id: 5, ruleType: 'REM-12', sourceRecord: 'HerdExitVoucher:48', cattleId: 1, dueTime: '2026-11-14T04:00:00Z',
          lifecycleStatus: 'ACTIVE', urgency: 'TODAY', highlighted: false, sourceType: 'HerdExitVoucher', sourceId: 'HerdExitVoucher:48',
          sourceSummary: 'Phiếu PX-2026-0048', cattle,
          cattleProfileTarget: target('CATTLE_PROFILE', { id: 999, cattleId: 999, code: 'OTHER' }),
          sourceTarget: target('DEATH_VOUCHER', { id: 49, cattleId: 1, code: 'PX-2026-0049' }),
        },
      ],
    })

    const list = await api.listReminders('OWNER')
    expect(list.items[0]).toMatchObject({
      code: 'C-1', breed: 'Lai Sind', sex: 'FEMALE', ageMonths: 30, pen: 'P1', cattleId: 1,
      source: 'Cân 400 kg · 15/10/2026', sourceSummary: 'Cân 400 kg · 15/10/2026',
      basisValues: { WEIGHING_INTERVAL_DAYS: 30 }, parameterVersion: 4, profileTo: '/cattle/C-1',
      sourceTarget: { type: 'GROWTH_RECORD', id: 12 }, to: null, openLabel: null,
    })
    expect(list.items[1]).toMatchObject({ to: '/herd-entry/22', openLabel: 'Xem phiếu nhập' })
    expect(list.items[2]).toMatchObject({ to: '/herd-exit/47', openLabel: 'Xem phiếu' })
    expect(list.items[4]).toMatchObject({ profileTo: null, to: null, openLabel: null })

    const technicianList = await api.listReminders('TECHNICIAN')
    expect(technicianList.items[0]?.profileTo).toBe('/kt/dan-bo/C-1')
    expect(technicianList.items[1]?.to).toBeNull()
    expect(technicianList.items[2]?.to).toBeNull()

    const managerList = await api.listReminders('MANAGER')
    expect(managerList.items[3]?.to).toBe('/thuc-an/nhat-ky?date=2026-11-15')
    expect(technicianList.items[3]?.to).toBe('/thuc-an/nhat-ky?date=2026-11-15&readOnly=1')
    // D41: REM-11 goes to the Owner too, who records feeding like a Manager.
    expect((await api.listReminders('OWNER')).items[3]?.to).toBe('/thuc-an/nhat-ky?date=2026-11-15')
  })

  it('builds the Technician home (SCR-74) from the reminder list: six reminders, REM-11 counted as unrecorded meals', async () => {
    const row = (id: number, ruleType: string, urgency: string, dueTime: string) =>
      ({ id, ruleType, sourceRecord: `R:${id}`, dueTime, lifecycleStatus: 'ACTIVE', urgency, highlighted: false })
    const store = createFarmOverviewDemoStore()
    const demoHome = vi.spyOn(store, 'getTechnicianHome')
    const get = vi.fn(async (path: string) => path.endsWith('/reminders') ? [
      row(1, 'REM-01', 'UPCOMING', '2026-11-18T01:00:00Z'),
      row(2, 'REM-11', 'TODAY', '2026-11-15T03:00:00Z'),
      row(3, 'REM-06', 'OVERDUE', '2026-11-13T01:00:00Z'),
      row(4, 'REM-11', 'OVERDUE', '2026-11-14T10:00:00Z'),
      row(5, 'REM-03', 'TODAY', '2026-11-15T01:00:00Z'),
      row(6, 'REM-05', 'UPCOMING', '2026-11-20T01:00:00Z'),
      row(7, 'REM-02', 'UPCOMING', '2026-11-16T01:00:00Z'),
      row(8, 'REM-11', 'UPCOMING', '2026-11-19T01:00:00Z'),
    ] : contextBody)
    const api = createFarmOverviewApi({ mode: 'backend', farmId: 1, transport: { get, command: vi.fn(), farmPath: (id, suffix = '') => `/api/farms/${id}${suffix}` }, store })

    const home = await api.getTechnicianHome()

    expect(home.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(home.reminders.map((item) => item.id)).toEqual([3, 4, 5, 2, 7, 1])
    expect(home.unrecordedFeedings).toBe(3)
    expect(get.mock.calls.map(([path]) => path).filter((path) => !path.endsWith('/context'))).toEqual(['/api/farms/1/reminders'])
    expect(demoHome).not.toHaveBeenCalled()
  })

  it('keeps source links closed when target details or the source identity do not match', async () => {
    const { api } = backend({
      '/context': contextBody,
      '/reminders': [
        {
          id: 1, ruleType: 'REM-11', sourceRecord: 'PEN:9:RATION:7:DAY:2026-11-15:SESSION:2', dueTime: '2026-11-15T04:00:00Z',
          lifecycleStatus: 'ACTIVE', urgency: 'TODAY', highlighted: false, sourceType: 'PEN', sourceId: 'PEN:9:RATION:7:DAY:2026-11-15:SESSION:2',
          sourceSummary: 'Chuồng P1 · bữa 2', sourceTarget: { type: 'FEEDING_LOG', penId: 9, date: '2026-11-15', code: 'P1' },
        },
        {
          id: 2, ruleType: 'REM-01', sourceRecord: 'CATTLE:1:ENTRY:22', cattleId: 1, dueTime: '2026-11-14T04:00:00Z',
          lifecycleStatus: 'ACTIVE', urgency: 'TODAY', highlighted: false, sourceType: 'CATTLE', sourceId: 'CATTLE:1:ENTRY:23',
          sourceSummary: 'Nhập đàn 01/10/2026', sourceTarget: { type: 'HERD_ENTRY', id: 22, cattleId: 1 },
        },
      ],
    })
    const list = await api.listReminders('MANAGER')
    expect(list.items.map(({ to, openLabel }) => [to, openLabel])).toEqual([[null, null], [null, null]])
  })

  it('sends report fields matching the Java DTO and maps the supplied monthly chart', async () => {
    const report = {
      reportType: 'RPT-05', from: '2026-10-01', to: '2026-10-31', generatedAt: '2026-11-14T04:00:00Z',
      summary: { headAtEnd: 2, overallConceptionRate: { value: null, n: 2, status: 'INSUFFICIENT_DATA' } },
      rows: [{ dimension: 'pen', value: 'P1', count: 2 }], totalRow: null,
      chart: { title: 'Tỷ lệ thụ thai theo tháng', sub: 'Lần phối có kết quả khám thai; tỷ lệ chỉ hiện khi n ≥ 3', bars: [{ label: '10/2026', value: null, numerator: 1, denominator: 2 }] },
      unavailableData: [],
    }
    const { api, command } = backend(
      { '/context': contextBody, '/pens': penBody, '/catalogues/breeds': [{ id: 5, code: 'SIND', name: 'Lai Sind' }] },
      { '/dashboard/reports': report },
    )
    const view = await api.runReport({ ...rpt05, pen: 'P1', breed: 'Lai Sind', herdGroup: 'BREEDING_FEMALE', lifeStage: 'ADULT' }, 'OWNER')
    expect(command.mock.calls[0]?.[1]).toEqual({
      reportType: 'RPT-05', from: rpt05.dateFrom, to: rpt05.dateTo, penIds: [9], breedIds: [5], herdGroups: ['BREEDING_FEMALES'], lifeStages: ['ADULT'],
    })
    expect(view.tiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Số bò cuối kỳ', value: '2' }),
      expect.objectContaining({ label: 'Tỷ lệ thụ thai chung', value: 'Chưa đủ dữ liệu', note: 'Mẫu tính: 2' }),
    ]))
    expect(view.rows[0]?.label).toBe('Chuồng: P1')
    expect(view.totalRow).toBeNull()
    expect(view.chart).toMatchObject({
      title: 'Tỷ lệ thụ thai theo tháng',
      sub: 'Lần phối có kết quả khám thai',
      bars: [{ label: '10/2026', value: null, numerator: 1, denominator: 2 }],
    })
  })

  it('maps the RPT-07 total row from server-supplied aggregate cells', async () => {
    const report = {
      reportType: 'RPT-07', from: '2026-09-28', to: '2026-10-28', generatedAt: '2026-11-14T04:00:00Z', summary: {
        averageAdgKgPerDay: { value: 1.5, numerator: 1.5, denominator: 1, n: 1, status: 'INSUFFICIENT_DATA' },
        feedPerKgGain: { value: 0.667, numerator: 20, denominator: 30, n: 1, status: 'INSUFFICIENT_DATA' },
        feedCostPerKgGain: { value: 3333.33, numerator: 100000, denominator: 30, n: 1, status: 'INSUFFICIENT_DATA' },
      },
      rows: [
        { pen: 'P1', cattleCount: 1, insufficientWeights: 1, gainKg: 45, feedKg: 40, feedCost: 200000, feedKgForIncluded: 20, feedCostForIncluded: 100000, feedKgPerGain: 0.667, feedCostPerGain: 3333.33 },
      ],
      totalRow: { label: 'Tổng', cells: { cattleCount: 1, insufficientWeights: 1, gainKg: 30, feedKg: 40, feedCost: 200000, feedKgForIncluded: 20, feedCostForIncluded: 100000, feedKgPerGain: 0.667, feedCostPerGain: 3333.33, projectedDaysToTarget: null } },
      chart: null, unavailableData: [],
    }
    const { api } = backend(
      { '/context': contextBody, '/pens': penBody, '/catalogues/breeds': [] },
      { '/dashboard/reports': report },
    )

    const view = await api.runReport({ ...rpt05, reportType: 'RPT-07' }, 'OWNER')

    expect(view.totalRow).toMatchObject({
      label: 'Tổng', cells: {
        cattleCount: '1', insufficientWeights: '1', gainKg: '30', feedKg: '40', feedCost: '200.000',
        feedKgForIncluded: '20', feedCostForIncluded: '100.000', feedKgPerGain: '0,667', feedCostPerGain: '3.333,33', projectedDaysToTarget: 'Chưa có dữ liệu',
      },
    })
    expect(view.tiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'ADG (kg/ngày)', value: 'Chưa đủ dữ liệu', note: 'Mẫu tính: 1' }),
      expect.objectContaining({ label: 'Thức ăn trên mỗi kg tăng (kg/kg)', value: 'Chưa đủ dữ liệu', note: 'Mẫu tính: 1' }),
      expect.objectContaining({ label: 'Chi phí thức ăn trên mỗi kg tăng (đ/kg)', value: 'Chưa đủ dữ liệu', note: 'Mẫu tính: 1' }),
    ]))
    expect(view.chart).toBeNull()
  })

  it('maps additive report sections and preserves chart zero separately from unavailable values', async () => {
    const report = {
      reportType: 'RPT-03', from: '2026-10-01', to: '2026-10-31', generatedAt: '2026-11-14T04:00:00Z', summary: {},
      rows: [], totalRow: null, chart: null, unavailableData: ['backend warning must stay visible', 'backend warning must stay visible'],
      sections: [{
        key: 'schedule', title: 'Tuân thủ theo lịch tiêm', rowHeading: 'Lịch tiêm',
        rows: [{ label: 'Lịch A', planned: 0, done: 0, deferred: 0, overdue: 0 }],
        totalRow: { label: 'Tổng (mũi)', cells: { planned: 0, done: 0, deferred: 0, overdue: 0 } },
      }],
      charts: [{
        title: 'Mũi đã tiêm', sub: 'Số mũi hợp lệ', unit: 'mũi',
        bars: [
          { label: 'Lịch A', value: 0, sampleSize: null, numerator: null, denominator: null },
          { label: 'Lịch B', value: null, sampleSize: 2, numerator: null, denominator: null },
        ],
      }],
    }
    const { api } = backend(
      { '/context': contextBody, '/pens': penBody, '/catalogues/breeds': [] },
      { '/dashboard/reports': report },
    )

    const view = await api.runReport({ ...rpt05, reportType: 'RPT-03' }, 'OWNER')

    expect(view.sections?.[0]).toMatchObject({
      key: 'schedule', rowHeading: 'Lịch tiêm', rows: [{ label: 'Lịch A', cells: { planned: '0', done: '0' } }],
      totalRow: { cells: { planned: '0', done: '0' } },
    })
    expect(view.charts?.[0]).toMatchObject({
      unit: 'mũi', bars: [{ label: 'Lịch A', value: 0 }, { label: 'Lịch B', value: null, sampleSize: 2 }],
    })
    expect(view.unavailableData).toEqual(['backend warning must stay visible', 'backend warning must stay visible'])
  })

  it('names entry sources and exit types instead of showing backend enum codes (RPT-01)', async () => {
    const report = {
      reportType: 'RPT-01', from: '2026-10-22', to: '2026-11-20', generatedAt: '2026-11-20T13:17:00Z',
      summary: { headAtEnd: 2, entriesBySource: { EXTERNAL: 1, FARM_BORN: 2 }, exitsByType: { SALE: 1, CULL: 1, DEATH: 1, OTHER: 1 } },
      rows: [{ dimension: 'entrySource', value: 'EXTERNAL', count: 1 }], totalRow: null, chart: null, unavailableData: [],
      sections: [{
        key: 'entrySource', title: 'Nhập đàn theo nguồn', rowHeading: 'Nguồn nhập',
        rows: [{ label: 'EXTERNAL', count: 1 }, { label: 'FARM_BORN', count: 2 }],
        totalRow: { label: 'Tổng (lượt)', cells: { count: 3 } },
      }],
    }
    const { api } = backend(
      { '/context': contextBody, '/pens': penBody, '/catalogues/breeds': [] },
      { '/dashboard/reports': report },
    )

    const view = await api.runReport({ ...rpt05, reportType: 'RPT-01' }, 'OWNER')

    expect(view.tiles.map((tile) => tile.label)).toEqual([
      'Số bò cuối kỳ', 'Nhập đàn theo nguồn · Mua ngoài', 'Nhập đàn theo nguồn · Bê sinh tại trại',
      'Xuất đàn theo loại · Bán', 'Xuất đàn theo loại · Loại thải', 'Xuất đàn theo loại · Chết / mất', 'Xuất đàn theo loại · Khác',
    ])
    expect(view.sections?.[0].rows.map((row) => row.label)).toEqual(['Mua ngoài', 'Bê sinh tại trại'])
    expect(view.rows[0].label).toBe('Nguồn nhập đàn: Mua ngoài')
  })

  it('maps the RPT-05 tracked female status tile and breakdown section', async () => {
    const report = {
      reportType: 'RPT-05', from: '2026-10-01', to: '2026-10-28', generatedAt: '2026-11-16T04:00:00Z',
      summary: { trackedFemales: 3, overdueFemales: { count: 2, items: [{ cattleId: 11, displayCode: 'BC-0011', daysSinceCalving: 127 }, { cattleId: 12, displayCode: 'BC-0012', daysSinceCalving: 143 }] } }, rows: [{ dimension: 'pen', value: 'Pen=12', count: 0 }], totalRow: null, chart: null, unavailableData: [],
      sections: [{
        key: 'trackedFemalesByStatus', title: 'Bò cái theo dõi theo trạng thái sinh sản', rowHeading: 'Trạng thái sinh sản',
        rows: [
          { label: 'Chờ phối (AWAITING_BREEDING)', count: 1 },
          { label: 'Mang thai (PREGNANT)', count: 2 },
          { label: 'PREGNANT (n=0)', count: 0 },
        ],
        totalRow: { label: 'Tổng (con)', cells: { count: 3 } },
      }, {
        key: 'breedingMethod', title: 'Lần phối theo phương pháp', rowHeading: 'Phương pháp',
        rows: [{ label: 'AI', count: 2 }], totalRow: { label: 'Tổng (lần phối)', cells: { count: 2 } },
      }, {
        key: 'pregnancyCheckResult', title: 'Khám thai theo kết quả', rowHeading: 'Kết quả khám',
        rows: [{ label: 'PREGNANT', count: 2 }], totalRow: { label: 'Tổng (lượt khám)', cells: { count: 2 } },
      }, {
        key: 'calvingCourse', title: 'Lần đẻ theo diễn biến', rowHeading: 'Diễn biến đẻ',
        rows: [{ label: 'LIVE', count: 1 }], totalRow: { label: 'Tổng (lần đẻ)', cells: { count: 1 } },
      }],
    }
    const { api } = backend(
      { '/context': contextBody, '/pens': penBody, '/catalogues/breeds': [] },
      { '/dashboard/reports': report },
    )

    const view = await api.runReport(rpt05, 'OWNER')

    expect(view.tiles).toContainEqual({ key: 'trackedFemales', label: 'Bò cái theo dõi', value: '3', note: '' })
    expect(view.tiles).toContainEqual({ key: 'overdueFemales.count', label: 'Cái quá hạn thụ thai · Số con', value: '2', note: '' })
    expect(view.overdueFemales).toEqual({ count: 2, items: [{ cattleId: 11, displayCode: 'BC-0011', daysSinceCalving: 127 }, { cattleId: 12, displayCode: 'BC-0012', daysSinceCalving: 143 }] })
    expect(view.rows[0]?.label).toBe('Chuồng: Pen=12')
    // The overdue list itself is detail, not an indicator: only its count becomes a tile.
    expect(view.tiles.map((tile) => tile.label)).toEqual(['Bò cái theo dõi', 'Cái quá hạn thụ thai · Số con'])
    expect(view.sections?.[0]).toMatchObject({
      key: 'trackedFemalesByStatus', rowHeading: 'Trạng thái sinh sản',
      columns: [{ key: 'count', label: 'Số con' }],
      rows: [
        { label: 'Chờ phối', cells: { count: '1' } },
        { label: 'Mang thai · Có thai', cells: { count: '2' } },
        { label: 'Có thai', cells: { count: '0' } },
      ],
      totalRow: { label: 'Tổng (con)', cells: { count: '3' } },
    })
    expect(view.sections?.find((section) => section.key === 'breedingMethod')).toMatchObject({ columns: [{ key: 'count', label: 'Số lần phối' }] })
    expect(view.sections?.find((section) => section.key === 'pregnancyCheckResult')).toMatchObject({ columns: [{ key: 'count', label: 'Số lượt khám' }] })
    expect(view.sections?.find((section) => section.key === 'calvingCourse')).toMatchObject({ columns: [{ key: 'count', label: 'Số lần đẻ' }] })
  })

  it('uses only pen and herd-group filters for vaccination reports', async () => {
    const report = { reportType: 'RPT-03', from: '2026-10-01', to: '2026-10-31', generatedAt: '2026-11-14T04:00:00Z', summary: {}, rows: [], unavailableData: [] }
    const { api, command } = backend(
      { '/context': contextBody, '/pens': penBody, '/catalogues/breeds': [] },
      { '/dashboard/reports': report },
    )
    const view = await api.runReport({ ...rpt05, reportType: 'RPT-03', pen: 'P1', breed: 'Lai Sind', herdGroup: 'BREEDING_FEMALE', lifeStage: 'ADULT' }, 'OWNER')
    expect(command.mock.calls[0]?.[1]).toEqual({
      reportType: 'RPT-03', from: rpt05.dateFrom, to: rpt05.dateTo, penIds: [9], breedIds: [], herdGroups: ['BREEDING_FEMALES'], lifeStages: [],
    })
    expect(view.scope).toContain('Chuồng P1')
    expect(view.scope).toContain('Bò cái sinh sản')
    expect(view.scope).not.toContain('Lai Sind')
    expect(view.scope).not.toContain('Trưởng thành')
    expect(view.totalRow).toBeNull()
    expect(view.chart).toBeNull()
  })

  it('omits breed, herd-group, and life-stage filters for fattening reports', async () => {
    const report = { reportType: 'RPT-07', from: '2026-10-01', to: '2026-10-31', generatedAt: '2026-11-14T04:00:00Z', summary: {}, rows: [], unavailableData: [] }
    const { api, command } = backend(
      { '/context': contextBody, '/pens': penBody, '/catalogues/breeds': [{ id: 5, code: 'SIND', name: 'Lai Sind' }] },
      { '/dashboard/reports': report },
    )

    await api.runReport({ ...rpt05, reportType: 'RPT-07', pen: 'P1', breed: 'Lai Sind', herdGroup: 'BREEDING_FEMALE', lifeStage: 'ADULT' }, 'OWNER')

    expect(command.mock.calls[0]?.[1]).toEqual({
      reportType: 'RPT-07', from: rpt05.dateFrom, to: rpt05.dateTo, penIds: [9], breedIds: [], herdGroups: [], lifeStages: [],
    })
  })

  it('maps every backend report type without dropping the typed report envelope', async () => {
    const report = { reportType: 'RPT-01', from: '2026-10-01', to: '2026-10-31', generatedAt: '2026-11-14T04:00:00Z', summary: { headAtEnd: 1 }, rows: [{ dimension: 'pen', value: 'P1', count: 1 }], totalRow: null, chart: null, unavailableData: [] }
    const { api, command } = backend(
      { '/context': contextBody, '/pens': penBody, '/catalogues/breeds': [] },
      { '/dashboard/reports': report },
    )
    command.mockImplementation(async (_path: string, body: unknown) => ({ ...report, reportType: (body as { reportType: string }).reportType }))
    for (const reportType of ['RPT-01', 'RPT-02', 'RPT-03', 'RPT-04', 'RPT-05', 'RPT-06', 'RPT-07'] as const) {
      const view = await api.runReport({ ...rpt05, reportType }, 'OWNER')
      expect(view).toMatchObject({ reportType, title: reportType === 'RPT-05' ? 'Sinh sản' : expect.any(String), printTitle: reportType === 'RPT-05' ? 'Hiệu quả sinh sản' : expect.any(String), rows: [{ label: 'Chuồng: P1' }], unavailableData: [] })
    }
    expect(command).toHaveBeenCalledTimes(7)
  })

  it('shows exactly the filter combinations required by the FE-15 report spec', () => {
    expect(REPORT_CATALOGUE.map(({ code, filters }) => [code, filters])).toEqual([
      ['RPT-01', ['pen', 'breed', 'group', 'stage']],
      ['RPT-02', ['pen', 'breed', 'group', 'stage']],
      ['RPT-03', ['pen', 'group']],
      ['RPT-04', ['pen', 'breed', 'group', 'stage']],
      ['RPT-05', ['pen', 'breed', 'group', 'stage']],
      ['RPT-06', ['pen', 'breed', 'group', 'stage']],
      ['RPT-07', ['pen']],
    ])
  })
})
