import { describe, expect, it, vi } from 'vitest'
import { createFinanceBackendApi } from '../../../src/features/platform-finance/api/financeBackendApi'
import type { BackendTransport } from '../../../src/api/backendTransport'

const transport = (responses: Record<string, unknown> = {}) => {
  const get = vi.fn(async (path: string) => responses[path] ?? {})
  const command = vi.fn(async (path: string, body: unknown) => {
    if (path.endsWith('/records')) return { id: 1, recordCode: 'FR-0001', type: 'EXPENSE', category: 'SERVER', amountVnd: 1200, occurredOn: '2026-11-01', scope: 'GENERAL', state: 'DRAFT', version: 1, sourceType: 'MANUAL' }
    return { id: 1, recordCode: 'FR-0001', type: 'EXPENSE', category: 'SERVER', amountVnd: 1200, occurredOn: '2026-11-01', scope: 'GENERAL', state: 'POSTED', version: 2, sourceType: 'MANUAL' }
  })
  return { get, command, farmPath: vi.fn() } as unknown as BackendTransport & { get: typeof get; command: typeof command }
}

describe('financeBackendApi', () => {
  it('maps a Spring Page and keeps real server-side filters', async () => {
    const http = transport({ '/api/platform/finance/records?type=EXPENSE&category=SERVER&from=2026-11-01&to=2026-11-30&page=0&size=5': { content: [{ id: 1, recordCode: 'FR-0001', amountVnd: '1200.00', state: 'DRAFT', type: 'EXPENSE', category: 'SERVER', occurredOn: '2026-11-01', scope: 'GENERAL', version: 1 }], totalElements: 1, number: 0, size: 5 } })
    const api = createFinanceBackendApi(http)
    const page = await api.listRecords({ type: 'EXPENSE', category: 'SERVER', from: '2026-11-01', to: '2026-11-30', size: 5 })
    expect(page.rows[0]).toMatchObject({ recordCode: 'FR-0001', amountVnd: 1200, state: 'DRAFT' })
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('type=EXPENSE'))
  })

  it('translates UI BANK source to backend BANK_TRANSACTION and preserves idempotent command transport', async () => {
    const http = transport()
    const api = createFinanceBackendApi(http)
    await api.createDraft({ type: 'INCOME', category: 'SERVICE', amountVnd: 5000, occurredOn: '2026-11-01', scope: 'GENERAL', farmId: null, documentNumber: 'DOC-1', description: 'Thu', sourceType: 'BANK', sourceEvidenceId: 42 })
    expect(http.command).toHaveBeenCalledWith('/api/platform/finance/records', expect.objectContaining({ sourceEvidenceId: 42, fields: expect.objectContaining({ sourceType: 'BANK_TRANSACTION' }) }))
  })

  it('dùng evidenceId nội bộ để ghi sổ, transactionId chỉ là mã giao dịch hiển thị', async () => {
    const http = transport({ '/api/platform/finance/bank-transactions': [{ evidenceId: 901, transactionId: 843, sourceReference: 'SEPAY:MOCK:LOCAL-MOCK:843', amount: 1000, bankPaidAt: '2026-11-01T10:00:00Z', direction: 'IN', bank: 'SePay', paymentReference: 'BCF' }] })
    const api = createFinanceBackendApi(http)
    const rows = await api.listBankTransactions()
    expect(rows[0]).toMatchObject({ transactionId: 843, evidenceId: 901 })
  })

  it('normalizes public report source labels to backend enum and maps decimal totals', async () => {
    const http = transport()
    const api = createFinanceBackendApi(http)
    await api.runReport({ dateFrom: '2026-11-01', dateTo: '2026-11-02', farmId: null, sourceFilter: 'RECEIPTS' })
    expect(http.command).toHaveBeenCalledWith('/api/platform/finance/reports', expect.objectContaining({ sourceFilter: 'RECEIPTS_ONLY' }))
  })

  it('giải mã recordCode thành id số trước khi gọi detail và command', async () => {
    const http = transport({
      '/api/platform/finance/records?page=0&size=100': {
        content: [{ id: 42, recordCode: 'FR-0042', state: 'DRAFT', version: 3, type: 'EXPENSE', category: 'SERVER', amountVnd: 1000, occurredOn: '2026-11-01', scope: 'GENERAL' }],
        totalElements: 1, number: 0, size: 100,
      },
      '/api/platform/finance/records/42': { record: { id: 42, recordCode: 'FR-0042', state: 'DRAFT', version: 3, type: 'EXPENSE', category: 'SERVER', amountVnd: 1000, occurredOn: '2026-11-01', scope: 'GENERAL' }, history: [] },
    })
    const api = createFinanceBackendApi(http)
    await api.getRecord('FR-0042')
    expect(http.get).toHaveBeenCalledWith('/api/platform/finance/records/42')
    await api.post('FR-0042', 3)
    expect(http.command).toHaveBeenCalledWith('/api/platform/finance/records/42/post', { version: 3 })
  })

  it('gửi scope FARM và farmId số khi lọc theo trại', async () => {
    const http = transport({ '/api/platform/finance/records?scope=FARM&farmId=7&page=0&size=5': { content: [], totalElements: 0, number: 0, size: 5 } })
    const api = createFinanceBackendApi(http)
    await api.listRecords({ scope: '7', size: 5 })
    expect(http.get).toHaveBeenCalledWith('/api/platform/finance/records?scope=FARM&farmId=7&page=0&size=5')
  })
})
