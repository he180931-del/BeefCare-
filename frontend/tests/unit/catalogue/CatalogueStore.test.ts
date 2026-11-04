import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PARAMETERS,
  catalogueStorageKey,
  getCatalogueStorageScope,
  getCatalogueUsage,
  loadCatalogueItems,
  loadParameterHistory,
  loadParameters,
  saveCatalogueItems,
  saveParameterVersion,
  selectCurrentParameterVersion,
  todayInHoChiMinh,
  validateCatalogueDraft,
  validateParameterDraft,
} from '../../../src/features/catalogue/catalogueStore'

describe('catalogue local-first store validation', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('round-trips a catalogue item through the dedicated localStorage key', () => {
    const item = loadCatalogueItems('breeds')[0]
    expect(saveCatalogueItems('breeds', [{ ...item, name: 'Brahman lai' }])).toBe(true)

    expect(window.localStorage.getItem(catalogueStorageKey('breeds'))).toContain('Brahman lai')
    expect(loadCatalogueItems('breeds')[0]).toMatchObject({ id: item.id, name: 'Brahman lai' })
  })

  it('rejects duplicate codes and missing required vaccine fields', () => {
    const items = loadCatalogueItems('vaccines')
    expect(validateCatalogueDraft('vaccines', { code: items[0].code, name: 'Mới', disease: 'LMLM' }, items, undefined)).toMatch(/đã tồn tại/i)
    expect(validateCatalogueDraft('vaccines', { code: 'VX-NEW', name: 'Mới', disease: '' }, items, undefined)).toMatch(/Bệnh phòng/i)
  })

  it('validates every parameter range, integer rule, cross-field rule, and effective date', () => {
    const invalid = { ...DEFAULT_PARAMETERS.values, gestationLengthDays: 301 }
    expect(validateParameterDraft(invalid, 'Nguồn', '2026-11-02', '2026-11-03')).toMatch(/mang thai/i)
    expect(validateParameterDraft({ ...DEFAULT_PARAMETERS.values, breedingWindowEndHours: 7 }, 'Nguồn', '2026-11-03', '2026-11-03')).toMatch(/cửa sổ phối/i)
    expect(validateParameterDraft(DEFAULT_PARAMETERS.values, '', '2026-11-03', '2026-11-03')).toMatch(/source note/i)
    expect(validateParameterDraft(DEFAULT_PARAMETERS.values, 'Nguồn', '2026-11-02', '2026-11-03')).toMatch(/hiệu lực/i)
  })

  it('persists a new parameter version and keeps the prior history', () => {
    const next = { ...DEFAULT_PARAMETERS, version: 'v4', sourceNote: 'Kiểm tra nội bộ' }
    expect(saveParameterVersion(next, [DEFAULT_PARAMETERS, next])).toBe(true)

    expect(loadParameters()).toMatchObject({ version: 'v4', sourceNote: 'Kiểm tra nội bộ' })
    expect(loadParameterHistory()).toHaveLength(2)
  })

  it('scopes catalogue data by account and farm and envelopes it with a schema version', () => {
    window.localStorage.setItem('beefcare-ui-demo', JSON.stringify({ account: { 'SCR-02': { Email: 'owner@example.com' }, 'farm-selection': { farm: 'Trại Ba Vì' } } }))
    const first = loadCatalogueItems('breeds')[0]
    saveCatalogueItems('breeds', [{ ...first, name: 'Giống scoped' }])
    expect(getCatalogueStorageScope()).toEqual({ accountId: 'owner-example-com', farmId: 'trai-ba-vi' })
    expect(window.localStorage.getItem(catalogueStorageKey('breeds'))).toMatch(/schemaVersion/)

    window.localStorage.setItem('beefcare-ui-demo', JSON.stringify({ account: { 'SCR-02': { Email: 'other@example.com' }, 'farm-selection': { farm: 'Trại Ba Vì' } } }))
    expect(loadCatalogueItems('breeds')[0].name).not.toBe('Giống scoped')
  })

  it('derives guards from current local cattle, pens, vaccine, and treatment records', () => {
    const breed = loadCatalogueItems('breeds')[0]
    window.localStorage.setItem('beefcare:cattle', JSON.stringify([{ code: 'C-1', breed: breed.code, status: 'ACTIVE' }, { code: 'C-2', breed: 'OTHER', status: 'ACTIVE' }]))
    window.localStorage.setItem('beefcare:pens', JSON.stringify([{ code: 'A2', purpose: 'PP-FAT', status: 'ACTIVE' }]))
    const vaccine = loadCatalogueItems('vaccines')[0]
    window.localStorage.setItem('beefcare-ui-demo', JSON.stringify({ account: { 'vaccination-preview': [{ vaccineCode: vaccine.code, status: 'ADMINISTERED' }], 'health-events-preview': [] } }))
    expect(getCatalogueUsage('breeds', breed)).toMatchObject({ count: 1, cattleInHerd: 1 })
    expect(getCatalogueUsage('vaccines', vaccine)).toMatchObject({ count: 1, inUse: 1 })
  })

  it('keeps future parameter versions scheduled until their HCM effective date', () => {
    const future = { ...DEFAULT_PARAMETERS, version: 'v4', effectiveFrom: '2026-11-05' }
    expect(selectCurrentParameterVersion([DEFAULT_PARAMETERS, future], '2026-11-03').version).toBe('v3')
    expect(selectCurrentParameterVersion([DEFAULT_PARAMETERS, future], '2026-11-05').version).toBe('v4')
    expect(todayInHoChiMinh(new Date('2026-11-02T17:00:00.000Z'))).toBe('2026-11-03')
  })
})
