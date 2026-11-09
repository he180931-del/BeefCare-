import { asRecord, asRows, numberValue, textValue, type BackendTransport } from '../../../api/backendTransport'
import type { BankTransactionChoice, CashReport, Farm, FinanceRecord, Receipt, ReceiptFilters, RecordFields, RecordFilters, ReportCriteria, ReportLine, ReportSummary, ScopeTotals } from '../types'

const decimal = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return fallback
}

const iso = (value: unknown): string => typeof value === 'string' ? value : ''
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const query = (values: Record<string, unknown>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  return params.toString()
}

const mapFarm = (value: unknown): Farm => { const row = asRecord(value); return { id: numberValue(row.id), name: textValue(row.name, '—') } }

const mapBank = (value: unknown): BankTransactionChoice => {
  const row = asRecord(value)
  return {
    sourceReference: textValue(row.sourceReference), transactionId: numberValue(row.transactionId), amount: decimal(row.amount),
    evidenceId: row.evidenceId == null ? undefined : numberValue(row.evidenceId),
    bankPaidAt: iso(row.bankPaidAt), direction: textValue(row.direction) === 'OUT' ? 'OUT' : 'IN', bank: textValue(row.bank),
    paymentReference: textValue(row.paymentReference), claimedBy: row.claimedBy == null ? undefined : textValue(row.claimedBy), evidenceCode: textValue(row.sourceReference),
  }
}

const mapRecord = (value: unknown, history: Record<string, unknown>[] = []): FinanceRecord => {
  const row = asRecord(value)
  const backendSource = textValue(row.sourceType, 'MANUAL')
  return {
    id: numberValue(row.id), recordCode: textValue(row.recordCode), type: textValue(row.type, 'EXPENSE') as FinanceRecord['type'],
    category: textValue(row.category), amountVnd: decimal(row.amountVnd), occurredOn: iso(row.occurredOn),
    scope: textValue(row.scope, 'GENERAL') as FinanceRecord['scope'], farmId: row.farmId == null ? null : numberValue(row.farmId),
    farmName: textValue(row.farmName), documentNumber: textValue(row.documentNumber), description: textValue(row.description),
    sourceType: backendSource.toUpperCase() === 'BANK_TRANSACTION' || backendSource.toUpperCase() === 'BANK' ? 'BANK' : 'MANUAL',
    sourceReference: textValue(row.sourceReference), sourceEvidenceId: row.sourceEvidenceId == null ? null : numberValue(row.sourceEvidenceId),
    state: textValue(row.state, 'DRAFT') === 'DISCARDED' ? 'VOID' : textValue(row.state, 'DRAFT') as FinanceRecord['state'], version: numberValue(row.version),
    createdAt: iso(row.createdAt), createdBy: textValue(row.createdBy), postedAt: row.postedAt == null ? undefined : iso(row.postedAt), postedBy: row.postedBy == null ? undefined : textValue(row.postedBy),
    voidedAt: row.voidedAt == null ? undefined : iso(row.voidedAt), voidedBy: row.voidedBy == null ? undefined : textValue(row.voidedBy), voidReason: row.voidReason == null ? undefined : textValue(row.voidReason),
    replacementOf: row.replacementOf == null ? undefined : textValue(row.replacementOf), replacementRecordId: row.replacementRecordId == null ? undefined : numberValue(row.replacementRecordId),
    history: history.map((item) => { const h = asRecord(item); return { id: numberValue(h.id), action: textValue(h.action), changedAt: iso(h.changedAt), actor: textValue(h.actor), reason: h.reason == null ? undefined : textValue(h.reason), detail: h.afterJson == null ? undefined : textValue(h.afterJson) } }),
  }
}

const mapReceipt = (value: unknown, detail: Record<string, unknown> = {}): Receipt => {
  const row = asRecord(value); const extra = asRecord(detail)
  const payment = asRecord(extra.receipt)
  const merged = { ...row, ...payment }
  const confirmedBy = textValue(extra.confirmationSource).toUpperCase() === 'PM_ACCEPT' ? 'PM_ACCEPT' : 'SEPAY'
  return {
    code: textValue(merged.receiptCode), paymentCode: textValue(merged.paymentCode), farmId: numberValue(merged.farmId), farmName: textValue(merged.farmName),
    termYears: Math.max(1, Math.min(3, numberValue(merged.termYears, 1))) as 1 | 2 | 3, amountVnd: decimal(merged.amount), priceVersion: extra.priceVersionId == null ? '—' : `v${numberValue(extra.priceVersionId)}`,
    bankPaidAt: iso(merged.bankPaidAt), bankFirstSeenAt: iso(merged.bankPaidAt), confirmedAt: iso(extra.confirmedAt) || iso(merged.bankPaidAt), confirmedBy,
    periodStart: iso(extra.purchasedStart), periodEnd: iso(extra.purchasedEnd), evidenceCode: extra.evidenceId == null ? '—' : `E-${numberValue(extra.evidenceId)}`, evidenceLabel: textValue(extra.maskedTransactionId, 'Chứng từ ngân hàng'),
  }
}

const mapSummary = (value: unknown): ReportSummary => {
  const row = asRecord(value)
  const scopeRows: ScopeTotals[] = asRows(row.scopes).map((item) => ({ scope: textValue(item.scope, 'OTHER') as ScopeTotals['scope'], farmId: item.farmId == null ? null : numberValue(item.farmId), farmName: textValue(item.farmName), subscriptionReceipts: decimal(item.subscriptionReceipts), otherIncome: decimal(item.otherIncome), expense: decimal(item.expense) }))
  return { subscriptionReceipts: decimal(row.subscriptionReceipts), otherIncome: decimal(row.otherIncome), totalIncome: decimal(row.totalIncome), totalExpense: decimal(row.totalExpense), netCashFlow: decimal(row.netCashFlow), scopes: scopeRows, dailyIncome: asRows(row.dailyIncome).map((item) => ({ date: iso(item.date), income: decimal(item.income) })), note: textValue(row.note, 'Dòng tiền, không phải lợi nhuận kế toán.') }
}

const mapLine = (value: unknown): ReportLine => { const row = asRecord(value); return { sourceType: textValue(row.sourceType) === 'SUBSCRIPTION_RECEIPT' ? 'RECEIPT' : 'MANUAL', code: textValue(row.code), scope: textValue(row.scope, 'GENERAL') as ReportLine['scope'], farmName: textValue(row.farmName), direction: textValue(row.direction) === 'EXPENSE' || textValue(row.direction) === 'OUT' ? 'OUT' : 'IN', category: textValue(row.category), amountVnd: decimal(row.amount ?? row.amountVnd), cashDate: iso(row.cashDate), status: textValue(row.status), reference: textValue(row.sourceReference ?? row.reference) } }

const mapReport = (value: unknown): CashReport => {
  const row = asRecord(value)
  return { id: numberValue(row.id), code: textValue(row.code, `SNAP-${numberValue(row.id)}`), expired: row.expired === true, criteria: (() => { const c = asRecord(row.criteria); const source = textValue(c.sourceFilter, 'ALL'); return { dateFrom: iso(c.dateFrom), dateTo: iso(c.dateTo), farmId: c.farmId == null ? null : numberValue(c.farmId), sourceFilter: (source === 'ALL' ? 'BOTH' : source.replace('_ONLY', '')) as ReportCriteria['sourceFilter'] } })(), summary: mapSummary(row.summary), lines: asRows(row.lines).map(mapLine), generatedAt: iso(row.generatedAt), expiresAt: iso(row.expiresAt) }
}

export function createFinanceBackendApi(transport: BackendTransport) {
  const root = '/api/platform/finance'
  const getPage = async (path: string) => asRecord(await transport.get(path))
  const resolveRecordId = async (code: string): Promise<number> => {
    if (/^\d+$/.test(code)) return Number(code)
    let pageNumber = 0
    while (true) {
      const page = await getPage(`${root}/records?page=${pageNumber}&size=100`)
      const row = asRows(page.content).find((item) => textValue(item.recordCode) === code)
      if (row) return numberValue(row.id)
      const totalPages = numberValue(page.totalPages, pageNumber + 1)
      if (pageNumber + 1 >= totalPages || asRows(page.content).length === 0) break
      pageNumber += 1
    }
    throw new Error(`Không tìm thấy khoản thu chi ${code}.`)
  }
  const fields = (input: RecordFields) => ({ ...input, sourceType: input.sourceType === 'BANK' ? 'BANK_TRANSACTION' : 'MANUAL', farmId: input.scope === 'FARM' ? input.farmId : null })
  const recordCommand = (input: RecordFields, sourceEvidenceId?: number | null) => ({ fields: fields(input), sourceEvidenceId: sourceEvidenceId ?? input.sourceEvidenceId ?? null })
  const mapRecordResponse = (value: unknown) => mapRecord(value)
  return {
    async listFarms() { const page = await getPage('/api/platform/farms?page=0&size=100'); return asRows(page.content).map(mapFarm) },
    async listCategories() { const row = asRecord(await transport.get(`${root}/categories`)); return { income: strings(row.income), expense: strings(row.expense) } },
    async listReceipts(filters: ReceiptFilters = {}) { const suffix = query({ q: filters.search, farmId: filters.farmId, bankFrom: filters.from, bankTo: filters.to, page: (filters.page ?? 1) - 1, size: filters.size ?? 5 }); const page = await getPage(`/api/platform/finance/receipts?${suffix}`); return { rows: asRows(page.items).map((item) => mapReceipt(item)), total: numberValue(page.total), page: numberValue(page.page) + 1, pageCount: Math.max(1, Math.ceil(numberValue(page.total) / numberValue(page.size, filters.size ?? 5))), totalAmount: decimal(page.totalAmount) } },
    async getReceipt(code: string) { const page = await getPage(`/api/platform/finance/receipts?q=${encodeURIComponent(code)}&page=0&size=100`); const row = asRows(page.items).find((item) => textValue(item.receiptCode) === code); if (!row) throw new Error('Không tìm thấy biên nhận.'); const detail = asRecord(await transport.get(`/api/platform/finance/receipts/${numberValue(row.paymentId)}`)); return mapReceipt(detail.receipt ?? detail, detail) },
    async listRecords(filters: RecordFilters = {}) {
      const farmScope = filters.scope && /^\d+$/.test(filters.scope)
        ? { scope: 'FARM', farmId: Number(filters.scope) }
        : { scope: filters.scope === 'GENERAL' ? 'GENERAL' : undefined, farmId: undefined }
      const base = { type: filters.type, category: filters.category, ...farmScope, from: filters.from, to: filters.to, page: (filters.page ?? 1) - 1, size: filters.size ?? 5 }
      const suffix = query({ ...base, state: filters.state }); const page = await getPage(`${root}/records?${suffix}`)
      const counts = await Promise.all(['DRAFT', 'POSTED', 'VOID'].map(async (state) => numberValue((await getPage(`${root}/records?${query({ ...base, state, page: 0, size: 1 })}`)).totalElements)))
      return { rows: asRows(page.content).map(mapRecordResponse), total: numberValue(page.totalElements), page: numberValue(page.number) + 1, pageCount: Math.max(1, Math.ceil(numberValue(page.totalElements) / numberValue(page.size, filters.size ?? 5))), counts: { ALL: counts.reduce((sum, count) => sum + count, 0), DRAFT: counts[0], POSTED: counts[1], VOID: counts[2] } }
    },
    async getRecord(code: string) { const detail = asRecord(await transport.get(`${root}/records/${await resolveRecordId(code)}`)); return { record: mapRecord(detail.record, asRows(detail.history)), history: asRows(detail.history) } },
    async listBankTransactions() { return asRows(await transport.get(`${root}/bank-transactions`)).map(mapBank) },
    async createDraft(input: RecordFields) { return mapRecordResponse(await transport.command(`${root}/records`, recordCommand(input))) },
    async saveDraft(code: string, input: RecordFields, expectedVersion: number) { return mapRecordResponse(await transport.command(`${root}/records/${await resolveRecordId(code)}`, { ...recordCommand(input), version: expectedVersion }, { method: 'PUT' })) },
    async discard(code: string, expectedVersion: number) { return mapRecordResponse(await transport.command(`${root}/records/${await resolveRecordId(code)}/discard`, { version: expectedVersion })) },
    async post(code: string, expectedVersion: number) { return mapRecordResponse(await transport.command(`${root}/records/${await resolveRecordId(code)}/post`, { version: expectedVersion })) },
    async voidRecord(code: string, expectedVersion: number, reason: string) { return mapRecordResponse(await transport.command(`${root}/records/${await resolveRecordId(code)}/void`, { version: expectedVersion, reason })) },
    async createReplacement(code: string, expectedVersion: number, overrides: { amountVnd?: number; description?: string } = {}) { return mapRecordResponse(await transport.command(`${root}/records/${await resolveRecordId(code)}/replacement`, { version: expectedVersion, reason: null, amountVnd: overrides.amountVnd ?? null, description: overrides.description ?? null })) },
    async currentReport() { return mapReport(await transport.get(`${root}/reports/latest`)) },
    async getReport(id: number) { return mapReport(await transport.get(`${root}/reports/${id}`)) },
    async runReport(criteria: ReportCriteria) { const sourceFilter = criteria.sourceFilter === 'RECEIPTS' ? 'RECEIPTS_ONLY' : criteria.sourceFilter === 'MANUAL' ? 'MANUAL_ONLY' : 'ALL'; return mapReport(await transport.command(`${root}/reports`, { ...criteria, sourceFilter })) },
    async exportXlsx(id: number) { const value = await transport.get(`${root}/reports/${id}/xlsx`); return { fileName: `beefcare-cash-report-${id}.xlsx`, blob: value } },
  }
}

export type FinanceBackendApi = ReturnType<typeof createFinanceBackendApi>
