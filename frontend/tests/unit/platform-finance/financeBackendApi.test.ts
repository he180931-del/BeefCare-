import { describe, expect, it, vi } from 'vitest'
import { createFinanceBackendApi } from '../../../src/features/platform-finance/api/financeBackendApi'
import type { BackendTransport } from '../../../src/shared/api/backendTransport'

const transport = (responses: Record<string, unknown> = {}) => {
  const get = vi.fn(async (path: string) => responses[path] ?? {})
  const command = vi.fn(async (path: string, body: unknown) => {
    if (path.endsWith('/records')) return { id: 1, recordCode: 'FR-0001', type: 'EXPENSE', category: 'SERVER', amountVnd: 1200, occurredOn: '2026-11-01', scope: 'GENERAL', state: 'DRAFT', version: 1, sourceType: 'MANUAL' }
    return { id: 1, recordCode: 'FR-0001', type: 'EXPENSE', category: 'SERVER', amountVnd: 1200, occurredOn: '2026-11-01', scope: 'GENERAL', state: 'POSTED', version: 2, sourceType: 'MANUAL' }
  })
  return { get, command, farmPath: vi.fn() } as unknown as BackendTransport & { get: typeof get; command: typeof command }
}

describe('financeBackendApi', () => {
  it('đọc đúng FarmServicePage để hiển thị danh sách trại trong phạm vi FARM', async () => {
    const http = transport({
      '/api/platform/farms?page=0&size=100': {
        tiles: { total: 1, active: 1, activePercent: 100, pendingPayment: 0, expired: 0, suspended: 0 },
        items: [{
          farmId: 7,
          farmName: 'Trại Bò Bình An',
          ownerId: 21,
          ownerName: 'Nguyễn Văn An',
          ownerEmail: 'owner@example.test',
          serviceStatus: 'ACTIVE',
          coverageEnd: '2027-11-14T00:00:00Z',
          suspended: false,
          suspendedAt: null,
          activeCattle: 180,
          version: 3,
        }],
        total: 1,
      },
    })
    const api = createFinanceBackendApi(http)

    await expect(api.listFarms()).resolves.toEqual([{ id: 7, name: 'Trại Bò Bình An' }])
  })

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

  it('giữ trạng thái bỏ nháp riêng, scope PLATFORM và phiên bản nguồn của snapshot', async () => {
    const http = transport({
      '/api/platform/finance/records?page=0&size=5': {
        content: [{ id: 9, recordCode: 'FR-0009', state: 'DISCARDED', version: 4, type: 'EXPENSE', category: 'SOFTWARE', amountVnd: 1000, occurredOn: '2026-11-01', scope: 'GENERAL' }],
        totalElements: 1, number: 0, size: 5,
      },
      '/api/platform/finance/reports/latest': {
        id: 12,
        code: 'SNAP-12',
        criteria: { dateFrom: '2026-11-01', dateTo: '2026-11-02', farmId: null, sourceFilter: 'ALL' },
        summary: { subscriptionReceipts: 0, otherIncome: 0, totalIncome: 0, totalExpense: 1000, netCashFlow: -1000, scopes: [{ scope: 'PLATFORM', farmId: null, farmName: 'Platform total', subscriptionReceipts: 0, otherIncome: 0, expense: 1000 }], dailyIncome: [], note: 'Cash flow only' },
        lines: [{ sourceType: 'MANUAL_FINANCE', code: 'FR-0001', scope: 'GENERAL', farmName: 'General platform', direction: 'EXPENSE', category: 'SOFTWARE', amount: 1000, cashDate: '2026-11-01', status: 'POSTED', sourceReference: 'BANK:A', sourceVersion: 7 }],
        generatedAt: '2026-11-02T10:00:00Z', expiresAt: '2026-12-02T10:00:00Z',
      },
    })
    const api = createFinanceBackendApi(http)
    const page = await api.listRecords({ size: 5 })
    const report = await api.currentReport()
    expect(page.rows[0].state).toBe('DISCARDED')
    expect(report.summary.scopes[0]).toMatchObject({ scope: 'PLATFORM', farmName: 'Toàn nền tảng' })
    expect(report.lines[0]).toMatchObject({ sourceVersion: 7, farmName: 'Chung nền tảng' })
  })

  it('báo cáo lọc một trại ghi dòng tổng là "Tổng cộng"', async () => {
    const http = transport({
      '/api/platform/finance/reports/latest': {
        id: 13, code: 'SNAP-13',
        criteria: { dateFrom: '2026-11-01', dateTo: '2026-11-30', farmId: 5, sourceFilter: 'ALL' },
        summary: { subscriptionReceipts: 5000, otherIncome: 0, totalIncome: 5000, totalExpense: 0, netCashFlow: 5000, scopes: [
          { scope: 'FARM', farmId: 5, farmName: 'Trại A', subscriptionReceipts: 5000, otherIncome: 0, expense: 0 },
          { scope: 'PLATFORM', farmId: null, farmName: 'Tổng cộng', subscriptionReceipts: 5000, otherIncome: 0, expense: 0 },
        ], dailyIncome: [], note: '' },
        lines: [], generatedAt: '2026-11-26T10:00:00Z', expiresAt: '2026-12-26T10:00:00Z',
      },
    })
    const report = await createFinanceBackendApi(http).currentReport()
    expect(report.summary.scopes.map((x) => x.farmName)).toEqual(['Trại A', 'Tổng cộng'])
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

  it('đổi mã lịch sử backend thành tiếng Việt và chỉ mô tả các trường đã sửa', async () => {
    const before = {
      id: 42, recordCode: 'FR-0042', state: 'DRAFT', version: 1, type: 'EXPENSE', category: 'SERVER_STORAGE',
      amountVnd: 1000000, occurredOn: '2026-11-01', scope: 'GENERAL', farmId: null, farmName: null,
      documentNumber: 'CT-01', description: 'Chi phí máy chủ cũ', sourceType: 'MANUAL', sourceReference: null,
    }
    const after = {
      ...before,
      version: 2,
      type: 'INCOME',
      category: 'USER_TRAINING',
      amountVnd: 1200000,
      occurredOn: '2026-11-02',
      scope: 'FARM',
      farmId: 7,
      farmName: 'Trại Bò Bình An',
      documentNumber: 'CT-02',
      description: 'Chi phí máy chủ mới',
      sourceType: 'BANK_TRANSACTION',
      sourceReference: 'SEPAY:LIVE:MAIN:843',
    }
    const history = [
      { id: 1, action: 'CREATE', changedAt: '2026-11-01T01:00:00Z', actor: 'PM', beforeJson: null, afterJson: JSON.stringify(before) },
      { id: 2, action: 'EDIT', changedAt: '2026-11-01T02:00:00Z', actor: 'PM', beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) },
      { id: 3, action: 'POST', changedAt: '2026-11-01T03:00:00Z', actor: 'PM', beforeJson: JSON.stringify(after), afterJson: JSON.stringify({ ...after, state: 'POSTED' }) },
      { id: 4, action: 'VOID', changedAt: '2026-11-01T04:00:00Z', actor: 'PM', reason: 'Ghi trùng', beforeJson: JSON.stringify(after), afterJson: JSON.stringify({ ...after, state: 'VOID' }) },
      { id: 5, action: 'DISCARD', changedAt: '2026-11-01T05:00:00Z', actor: 'PM', beforeJson: JSON.stringify(after), afterJson: JSON.stringify({ ...after, state: 'DISCARDED' }) },
      { id: 6, action: 'REPLACEMENT_CREATE', changedAt: '2026-11-01T06:00:00Z', actor: 'PM', beforeJson: null, afterJson: JSON.stringify(after) },
    ]
    const http = transport({
      '/api/platform/finance/records?page=0&size=100': { content: [after], totalPages: 1 },
      '/api/platform/finance/records/42': { record: after, history },
    })

    const detail = await createFinanceBackendApi(http).getRecord('FR-0042')

    expect(detail.record.history.map((item) => item.action)).toEqual([
      'Tạo khoản nháp', 'Sửa khoản nháp', 'Ghi sổ', 'Hủy khoản đã ghi sổ', 'Bỏ khoản nháp', 'Tạo khoản nháp thay thế',
    ])
    expect(detail.record.history[1].detail).toBe([
      'Loại: Chi → Thu',
      'Danh mục: Máy chủ và lưu trữ → Phí hướng dẫn sử dụng',
      'Số tiền: 1.000.000 VND → 1.200.000 VND',
      'Ngày phát sinh: 01/11/2026 → 02/11/2026',
      'Phạm vi: Chung nền tảng → Trại Bò Bình An',
      'Số chứng từ: “CT-01” → “CT-02”',
      'Diễn giải: “Chi phí máy chủ cũ” → “Chi phí máy chủ mới”',
      'Nguồn: Nhập thủ công → Giao dịch ngân hàng',
    ].join('; '))
    expect(detail.record.history.every((item) => !item.detail?.includes('{'))).toBe(true)
    expect(detail.history).toEqual(detail.record.history)
  })

  it('tìm recordCode qua các trang backend khi mã không nằm ở trang đầu', async () => {
    const http = transport({
      '/api/platform/finance/records?page=0&size=100': { content: [{ id: 1, recordCode: 'FR-0001' }], totalPages: 2 },
      '/api/platform/finance/records?page=1&size=100': { content: [{ id: 142, recordCode: 'FR-0142', state: 'DRAFT', version: 1, type: 'EXPENSE', category: 'SOFTWARE', amountVnd: 1000, occurredOn: '2026-11-01', scope: 'GENERAL' }], totalPages: 2 },
      '/api/platform/finance/records/142': { record: { id: 142, recordCode: 'FR-0142', state: 'DRAFT', version: 1, type: 'EXPENSE', category: 'SOFTWARE', amountVnd: 1000, occurredOn: '2026-11-01', scope: 'GENERAL' }, history: [] },
    })
    const api = createFinanceBackendApi(http)
    await api.getRecord('FR-0142')
    expect(http.get).toHaveBeenCalledWith('/api/platform/finance/records/142')
  })

  it('gửi scope FARM và farmId số khi lọc theo trại', async () => {
    const http = transport({ '/api/platform/finance/records?scope=FARM&farmId=7&page=0&size=5': { content: [], totalElements: 0, number: 0, size: 5 } })
    const api = createFinanceBackendApi(http)
    await api.listRecords({ scope: '7', size: 5 })
    expect(http.get).toHaveBeenCalledWith('/api/platform/finance/records?scope=FARM&farmId=7&page=0&size=5')
  })

  it('đọc biên nhận theo paymentId rồi ghép đầy đủ chi tiết chỉ đọc', async () => {
    const http = transport({
      '/api/platform/finance/receipts?q=RC-26-0001&page=0&size=100': {
        items: [{ paymentId: 77, receiptCode: 'RC-26-0001', paymentCode: 'PAY-77', farmId: 9, farmName: 'Trại A', termYears: 1, amount: '1200000', bankPaidAt: '2026-11-05T10:00:00Z' }],
        total: 1, page: 0, size: 100,
      },
      '/api/platform/finance/receipts/77': {
        receipt: { paymentId: 77, receiptCode: 'RC-26-0001', paymentCode: 'PAY-77', farmId: 9, farmName: 'Trại A', termYears: 1, amount: '1200000', bankPaidAt: '2026-11-05T10:00:00Z' },
        paymentState: 'PAID', priceVersionId: 4, confirmedAt: '2026-11-05T10:01:00Z', confirmationSource: 'PM_ACCEPT', purchasedStart: '2026-11-05T00:00:00Z', purchasedEnd: '2027-11-04T23:59:59Z', evidenceId: 901, maskedTransactionId: '****0843',
      },
    })
    const api = createFinanceBackendApi(http)
    const receipt = await api.getReceipt('RC-26-0001')
    expect(receipt).toMatchObject({ code: 'RC-26-0001', priceVersion: 'v4', confirmedBy: 'PM_ACCEPT', evidenceCode: 'E-901', periodStart: '2026-11-05T00:00:00Z' })
    expect(http.get).toHaveBeenCalledWith('/api/platform/finance/receipts/77')
  })

  it('trả blob xuất XLSX của đúng snapshot', async () => {
    const blob = new Blob(['xlsx'])
    const http = transport({ '/api/platform/finance/reports/12/xlsx': blob })
    const api = createFinanceBackendApi(http)
    await expect(api.exportXlsx(12)).resolves.toMatchObject({ fileName: 'beefcare-cash-report-12.xlsx', blob })
    expect(http.get).toHaveBeenCalledWith('/api/platform/finance/reports/12/xlsx', {
      headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    })
  })
})
