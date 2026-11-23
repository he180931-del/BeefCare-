import { expect, it, vi } from 'vitest'
import { createHerdEntryBackendApi, type BackendTransport } from '../../../src/features/herd-entry/api/herdEntryBackendApi'

it('sends null weight/basis for a missing kg draft weight and reopens it as an empty weight', async () => {
  const root = '/api/farms/1/entry-vouchers'
  const dto = {
    id: 41, code: 'PN-DRAFT-0041', version: 2, entryType: 'PURCHASE', status: 'DRAFT', pricingBasis: 'PER_KG',
    lines: [{ entryWeightKg: 250, weightBasis: 'MEASURED' }, { entryWeightKg: null, weightBasis: null }],
  }
  const command = vi.fn<BackendTransport['command']>().mockResolvedValue(dto)
  const transport: BackendTransport = {
    farmPath: (id, suffix = '') => `/api/farms/${id}${suffix}`,
    get: async (path) => path === root ? { items: [dto] } : path === `${root}/41` ? dto : [],
    command,
  }
  const api = createHerdEntryBackendApi({ transport, farmId: 1 })
  await api.save({
    record: { type: 'Mua ngoài', status: 'Nháp', pricing: 'kg' },
    cattleRows: [{ weight: 250, weightBasis: 'MEASURED', unitPrice: 120000 }, { weight: 0, weightBasis: null, unitPrice: 120000 }],
  })
  expect(command.mock.calls[0][1]).toMatchObject({ pricingBasis: 'PER_KG', lines: [
    { entryWeightKg: 250, weightBasis: 'MEASURED' }, { entryWeightKg: null, weightBasis: null },
  ] })
  const reopened = await api.get(dto.code)
  expect(reopened.draft).toMatchObject({ pricing: 'kg', cows: [
    { weight: 250, weightBasis: 'MEASURED' }, { weight: 0, weightBasis: null },
  ] })
})
