import { describe, expect, it, vi } from 'vitest'
import { createCattleBackendApi, mapBackendCattle } from '../../../src/api/cattleBackendApi'

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

  it('renders health, withdrawal, herd group and reproductive state as separate header badges', () => {
    const cow = mapBackendCattle({ id: 45, displayCode: 'BC-045', herdStatus: 'ACTIVE', herdGroup: 'BREEDING_FEMALES', healthState: 'HEALTHY', withdrawalActive: true, reproductiveStatus: 'IN_ESTRUS' })
    expect(cow.headerBadges).toEqual([
      ['Khỏe · Ngưng sử dụng thịt', 'warn'],
      ['Bò cái sinh sản', 'info'],
      ['Động dục', 'info'],
    ])
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
