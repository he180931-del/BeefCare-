import { describe, expect, it, vi } from 'vitest'
import { createCattleBackendApi, mapBackendCattle } from '../../../src/features/cattle/api/cattleBackendApi'

describe('SCR-18 cattle contract', () => {
  it.each([
    ['UNWEANED_CALF', 'Bê chưa cai sữa'],
    ['WEANED_CALF', 'Bê cai sữa'],
    ['YOUNG_STOCK', 'Bò tơ'],
    ['ADULT', 'Bò trưởng thành'],
  ])('maps backend life stage %s while keeping herdGroup separate', (lifeStage, label) => {
    const cow = mapBackendCattle({
      id: 41, displayCode: 'BC-041', birthDate: '2024-01-01', lifeStage, herdGroup: 'FATTENING',
      herdStatus: 'ACTIVE', healthState: 'MONITORING',
    }, null, [], [], {}, '2026-10-20')

    expect(cow.lifeStage).toBe(lifeStage)
    expect(cow.stage).toBe(label)
    expect(cow.herdGroup).toBe('FATTENING')
    expect(cow.health).toMatchObject({ label: 'Theo dõi', tone: 'warn' })
  })

  it('keeps measured weight date and meat withdrawal separate from entry/exit dates', () => {
    const cow = mapBackendCattle({
      id: 44,
      displayCode: 'BC-044',
      birthDate: '2024-01-01',
      birthDateAccuracy: 'ESTIMATED',
      latestWeightKg: 320,
      latestWeightDate: '2026-10-18',
      withdrawalEndDate: '2026-10-25',
      withdrawalActive: true,
      entry: { entryDate: '2026-01-01', weightKg: 220, weightBasis: 'MEASURED' },
      herdStatus: 'ACTIVE',
    })

    expect(cow.weightDate).toBe('18/10/2026')
    expect(cow.withdrawalUntil).toBe('2026-10-25')
    // SCR-19 #9 / TC-05-37: ngày sinh ước tính có "~" và "(ước tính)".
    expect(cow.birth).toBe('~01/01/2024 (ước tính)')
  })

  it('orders header badges herd group → health → contagious → meat withdrawal → reproduction (SCR-19 #4, §3.2)', () => {
    const cow = mapBackendCattle({ id: 45, displayCode: 'BC-045', herdStatus: 'ACTIVE', herdGroup: 'BREEDING_FEMALES', healthState: 'HEALTHY', suspectedContagious: true, withdrawalActive: true, withdrawalEndDate: '2026-12-05', reproductiveStatus: 'POST_CALVING' })
    expect(cow.headerBadges).toEqual([
      ['Bò cái sinh sản', 'info'],
      ['Khỏe mạnh', 'ok'],
      ['Nghi truyền nhiễm – cách ly', 'err'],
      ['Cách ly thịt đến 05/12/2026', 'warn'],
      ['Sau sinh', 'info'],
    ])
    expect(cow.health).toEqual({ label: 'Khỏe mạnh', tone: 'ok' })
    expect(cow.care.healthCase).toBe('Khỏe mạnh · Nghi truyền nhiễm – cách ly')
  })

  it('keeps the reproduction fields of the profile and summarises them (SCR-19 #20)', () => {
    const cow = mapBackendCattle({ id: 46, displayCode: 'BC-046', herdStatus: 'ACTIVE', sex: 'FEMALE', reproductiveStatus: 'PREGNANT', expectedCalvingDate: '2027-03-01', expectedBasis: 'CONFIRMED', breedingEligible: null, failedBreedingConditions: [] })
    expect(cow).toMatchObject({ expectedCalvingDate: '2027-03-01', expectedBasis: 'CONFIRMED', breedingEligible: undefined, failedBreedingConditions: [] })
    expect(cow.care.repro).toBe('Mang thai · Dự kiến đẻ 01/03/2027 (đã xác nhận)')
    const open = mapBackendCattle({ id: 47, herdStatus: 'ACTIVE', sex: 'FEMALE', reproductiveStatus: 'AWAITING_BREEDING', breedingEligible: false, failedBreedingConditions: ['MINIMUM_AGE', 'MINIMUM_WEIGHT'] })
    expect(open.breedingEligible).toBe(false)
    expect(open.care.repro).toBe('Chờ phối · Chưa đủ: tuổi; cân nặng')
    expect(mapBackendCattle({ id: 48, herdStatus: 'ACTIVE', sex: 'FEMALE', reproductiveStatus: 'IN_ESTRUS', breedingEligible: true }).care.repro).toBe('Động dục · Đủ điều kiện phối')
    expect(mapBackendCattle({ id: 49, herdStatus: 'ACTIVE', sex: 'MALE', reproductiveStatus: 'NOT_APPLICABLE' }).care.repro).toBe('Không áp dụng')
    // Overdue doses are not in the profile: never claim the cattle is unvaccinated.
    expect(mapBackendCattle({ id: 49, herdStatus: 'ACTIVE' }).care.vaccine.label).toBe('—')
  })

  it('takes purpose / life stage "from" dates from the latest PROFILE_CHANGE, else the herd-entry date (SCR-19 #12, #13)', () => {
    const profile = { id: 50, herdStatus: 'ACTIVE', lifeStage: 'YOUNG_STOCK', entry: { entryDate: '2026-01-10' } }
    const timeline = [
      { type: 'PROFILE_CHANGE', occurredAt: '2026-05-01T03:00:00Z', values: { fieldGroup: 'LIFE_STAGE' } },
      { type: 'PROFILE_CHANGE', occurredAt: '2026-08-20T20:00:00Z', values: { fieldGroup: 'LIFE_STAGE' } },
      { type: 'PROFILE_CHANGE', occurredAt: '2026-09-01T03:00:00Z', status: 'VOIDED', values: { fieldGroup: 'LIFE_STAGE' } },
      { type: 'PROFILE_CHANGE', occurredAt: '2026-04-02', values: { fieldGroup: 'EAR_TAG' } },
    ]
    const cow = mapBackendCattle(profile, null, [], timeline)
    // 2026-08-20T20:00Z is 21/08 in farm time (UTC+7).
    expect(cow.stageSince).toBe('21/08/2026')
    expect(cow.purposeSince).toBe('10/01/2026')
    expect(mapBackendCattle({ id: 51, herdStatus: 'ACTIVE', birthDate: '2026-02-03', entry: { source: 'FARM_BORN' } }).stageSince).toBe('03/02/2026')
  })

  it('keeps the warning reason of a pen assignment (SCR-20 #5)', () => {
    const cow = mapBackendCattle({ id: 52, herdStatus: 'ACTIVE' }, { history: [{ fromDate: '2026-10-01', penCode: 'C-01', reason: 'Tách đàn', warningReason: 'Chuồng đầy tạm thời' }] })
    expect(cow.barnHistory[0]).toMatchObject({ reason: 'Tách đàn', warningReason: 'Chuồng đầy tạm thời' })
  })

  it.each(['ACTIVE', 'EXIT_PENDING', 'EXITED', 'VOIDED'] as const)('preserves herd status %s', (herdStatus) => {
    const cow = mapBackendCattle({ id: 42, displayCode: 'BC-042', herdStatus })
    expect(cow.status).toBe(herdStatus)
  })

  it('uses an explicit farm/as-of date when calculating age, never a baked-in calendar date', () => {
    expect(mapBackendCattle({ id: 43, birthDate: '2024-01-15', herdStatus: 'ACTIVE' }, null, [], [], {}, '2025-01-14').months).toBe(11)
    expect(mapBackendCattle({ id: 43, birthDate: '2024-01-15', herdStatus: 'ACTIVE' }, null, [], [], {}, '2025-01-15').months).toBe(12)
  })

  it('sends the four backend LifeStage enum values without conflating herdGroup', async () => {
    const get = vi.fn(async (_path: string) => ({ items: [], total: 0, page: 0, size: 25, counts: {} }))
    const api = createCattleBackendApi({
      farmId: 9,
      transport: { get, command: vi.fn(), farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}` },
    })

    for (const lifeStage of ['UNWEANED_CALF', 'WEANED_CALF', 'YOUNG_STOCK', 'ADULT']) {
      await api.listPage({ lifeStage, herdGroup: 'FATTENING' })
      const url = new URL(String(get.mock.calls[get.mock.calls.length - 1]?.[0]), 'http://backend.test')
      expect(url.searchParams.get('lifeStage')).toBe(lifeStage)
      expect(url.searchParams.get('herdGroup')).toBe('FATTENING')
    }
  })

  it('exposes real profile and QR commands with optimistic version guards', async () => {
    const command = vi.fn(async () => ({ id: 41 }))
    const api = createCattleBackendApi({
      farmId: 9,
      transport: { get: vi.fn(), command, farmPath: (farmId, suffix = '') => `/api/farms/${farmId}${suffix}` },
    })

    await api.updateProfile(41, { name: 'Bông mới', expectedVersion: 7, effectiveDate: '2026-10-30', reason: 'Cập nhật' })
    await api.issueQr(41, { reason: 'DAMAGED', note: 'Rách', cattleVersion: 8 })

    expect(command).toHaveBeenNthCalledWith(1, '/api/farms/9/cattle/41/profile', expect.objectContaining({ name: 'Bông mới', expectedVersion: 7 }), expect.objectContaining({ method: 'PUT' }))
    expect(command).toHaveBeenNthCalledWith(2, '/api/farms/9/cattle/41/qr-tags', expect.objectContaining({ reason: 'DAMAGED', cattleVersion: 8 }), expect.objectContaining({ method: 'POST' }))
  })
})
