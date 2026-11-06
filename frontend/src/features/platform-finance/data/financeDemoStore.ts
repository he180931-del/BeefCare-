import { addMinutes, computeReport, filterReceipts, filterRecords, validateCriteria, validateRecordFields, isReportExpired } from '../domain/financeRules'
import type { BankTransactionChoice, CashReport, Farm, FinanceRecord, NoticeKind, PmNotice, Receipt, ReceiptFilters, RecordFields, RecordFilters, RecordState, ReportCriteria } from '../types'
import { BANK_SEED, DEMO_NOW, FARMS, NOTICES_SEED, PM_NAME, RECEIPTS_SEED, RECORDS_SEED } from './financeMock'

const STALE = 'Khoản này đã được thay đổi. Vui lòng tải lại và kiểm tra trước khi thử lại.'
const DEFAULT_CRITERIA: ReportCriteria = { dateFrom: '2026-10-01', dateTo: '2026-10-18', farmId: null, sourceFilter: 'BOTH' }

export function createFinanceDemoStore(seed = { receipts: RECEIPTS_SEED, records: RECORDS_SEED, bank: BANK_SEED, notices: NOTICES_SEED, farms: FARMS }) {
  let receipts: Receipt[] = structuredClone(seed.receipts)
  let records: FinanceRecord[] = structuredClone(seed.records)
  let notices: PmNotice[] = structuredClone(seed.notices)
  const farms: Farm[] = seed.farms
  const bank: BankTransactionChoice[] = seed.bank
  let clock = DEMO_NOW
  let nextRecordNo = 109
  let nextId = 200
  let reports: CashReport[] = []
  let reportSeq = 0

  const now = () => clock
  const farmName = (id: number | null) => farms.find((f) => f.id === id)?.name ?? ''
  const find = (code: string) => {
    const r = records.find((x) => x.recordCode === code)
    if (!r) throw new Error('Không tìm thấy khoản thu chi.')
    return r
  }
  const checkVersion = (r: FinanceRecord, version: number) => { if (r.version !== version) throw new Error(STALE) }
  const log = (r: FinanceRecord, action: string, reason?: string, detail?: string) => r.history.push({ id: r.history.length + 1, action, changedAt: clock, actor: PM_NAME, reason, detail })

  const claimOf = (tx: BankTransactionChoice, exceptCode?: string) => {
    if (tx.claimedBy) return tx.claimedBy
    const holder = records.find((r) => r.state === 'POSTED' && r.sourceEvidenceId === tx.transactionId && r.recordCode !== exceptCode)
    return holder ? `Khoản ${holder.recordCode}` : undefined
  }
  // GBR-84: nguồn ngân hàng không được vừa là biên nhận gói vừa là thu khác đã ghi sổ.
  const checkSource = (f: RecordFields, exceptCode?: string) => {
    if (f.sourceType !== 'BANK' || !f.sourceEvidenceId) return
    const tx = bank.find((b) => b.transactionId === f.sourceEvidenceId)
    if (!tx) throw new Error('Không tìm thấy chứng từ ngân hàng đã chọn.')
    const claim = claimOf(tx, exceptCode)
    if (claim && (f.type === 'INCOME' || claim.startsWith('Khoản'))) throw new Error(`Giao dịch ngân hàng này đã được ghi nhận là ${claim}. Không thể ghi như khoản thu khác.`)
  }
  const checkFields = (f: RecordFields, exceptCode?: string) => {
    const errors = validateRecordFields(f)
    const first = Object.values(errors)[0]
    if (first) throw new Error(first)
    checkSource(f, exceptCode)
  }
  const apply = (r: FinanceRecord, f: RecordFields) => {
    const tx = f.sourceType === 'BANK' ? bank.find((b) => b.transactionId === f.sourceEvidenceId) : undefined
    Object.assign(r, f, { farmId: f.scope === 'FARM' ? f.farmId : null, farmName: f.scope === 'FARM' ? farmName(f.farmId) : '', sourceReference: tx?.sourceReference ?? '', sourceEvidenceId: tx ? f.sourceEvidenceId : null })
  }
  const counts = (rows: FinanceRecord[]) => ({ ALL: rows.length, DRAFT: rows.filter((r) => r.state === 'DRAFT').length, POSTED: rows.filter((r) => r.state === 'POSTED').length, VOID: rows.filter((r) => r.state === 'VOID').length })
  const paginate = <T,>(rows: T[], page = 1, size = 5) => ({ rows: rows.slice((page - 1) * size, page * size), total: rows.length, page, pageCount: Math.max(1, Math.ceil(rows.length / size)) })

  const makeReport = (criteria: ReportCriteria): CashReport => {
    const { summary, lines } = computeReport(criteria, receipts, records, farms)
    reportSeq += 1
    const report: CashReport = { id: reportSeq, code: `SNAP-${clock.slice(0, 10).replace(/-/g, '')}-${String(reportSeq).padStart(3, '0')}`, expired: false, criteria: { ...criteria }, summary, lines, generatedAt: clock, expiresAt: addMinutes(clock, 24 * 60) }
    reports.push(report)
    return report
  }
  makeReport(DEFAULT_CRITERIA)

  const withExpiry = (r: CashReport): CashReport => ({ ...r, expired: isReportExpired(r, clock) })

  return {
    now,
    async listFarms() { return structuredClone(farms) },
    async listCategories() { return { income: ['Đào tạo tại trại', 'Dịch vụ tư vấn', 'Tài trợ / hỗ trợ'], expense: ['Hạ tầng máy chủ', 'Phí dịch vụ email', 'In thẻ tai QR', 'Phí nhắn tin SMS', 'Quảng bá'] } },

    async listReceipts(f: ReceiptFilters) {
      const all = filterReceipts(receipts, f)
      return { ...paginate(all, f.page, f.size ?? 5), totalAmount: all.reduce((t, r) => t + r.amountVnd, 0) }
    },
    async getReceipt(code: string) {
      const r = receipts.find((x) => x.code === code)
      if (!r) throw new Error('Không tìm thấy biên nhận.')
      return structuredClone(r)
    },

    async listRecords(f: RecordFilters) {
      const list = filterRecords(records, f, true)
      const shown = f.state ? list.filter((r) => r.state === f.state) : list
      return { ...paginate(shown, f.page, f.size ?? 5), counts: counts(list), rows: structuredClone(paginate(shown, f.page, f.size ?? 5).rows) }
    },
    async getRecord(code: string) { const r = find(code); return { record: structuredClone(r), history: structuredClone(r.history) } },
    async listBankTransactions(): Promise<BankTransactionChoice[]> {
      return bank.map((b) => ({ ...b, claimedBy: claimOf(b) }))
    },
    async createDraft(f: RecordFields) {
      checkFields(f)
      const code = `FR-${String(nextRecordNo++).padStart(4, '0')}`
      const r: FinanceRecord = { id: nextId++, recordCode: code, ...f, farmName: '', sourceReference: '', state: 'DRAFT', version: 1, createdAt: clock, createdBy: PM_NAME, history: [] }
      apply(r, f)
      log(r, 'Tạo nháp')
      records.push(r)
      return structuredClone(r)
    },
    async saveDraft(code: string, f: RecordFields, version: number) {
      const r = find(code)
      if (r.state !== 'DRAFT') throw new Error('Chỉ khoản nháp mới sửa được.')
      checkVersion(r, version)
      checkFields(f, code)
      const changed: string[] = []
      if (r.amountVnd !== f.amountVnd) changed.push(`Số tiền ${r.amountVnd} → ${f.amountVnd}`)
      if (r.category !== f.category) changed.push('Danh mục')
      apply(r, f)
      r.version += 1
      log(r, 'Sửa nháp', undefined, changed.join('; ') || undefined)
      return structuredClone(r)
    },
    async discard(code: string, version: number) {
      const r = find(code)
      if (r.state !== 'DRAFT') throw new Error('Chỉ khoản nháp mới bỏ được.')
      checkVersion(r, version)
      records = records.filter((x) => x !== r)
      return structuredClone(r)
    },
    async post(code: string, version: number) {
      const r = find(code)
      if (r.state !== 'DRAFT') throw new Error('Chỉ khoản nháp mới ghi sổ được.')
      checkVersion(r, version)
      checkFields(r, code)
      r.state = 'POSTED'; r.postedAt = clock; r.postedBy = PM_NAME; r.version += 1
      log(r, 'Ghi sổ')
      return structuredClone(r)
    },
    async voidRecord(code: string, version: number, reason: string) {
      const r = find(code)
      if (r.state !== 'POSTED') throw new Error('Chỉ khoản đã ghi sổ mới hủy bỏ được.')
      if (!reason.trim()) throw new Error('Lý do Hủy bỏ là bắt buộc.')
      checkVersion(r, version)
      r.state = 'VOID'; r.voidedAt = clock; r.voidedBy = PM_NAME; r.voidReason = reason.trim(); r.version += 1
      log(r, 'Hủy bỏ', r.voidReason)
      return structuredClone(r)
    },
    async createReplacement(code: string, version: number, over: Partial<Pick<RecordFields, 'amountVnd' | 'description'>>) {
      const r = find(code)
      if (r.state !== 'VOID') throw new Error('Chỉ tạo nháp thay thế từ khoản đã hủy bỏ.')
      checkVersion(r, version)
      const fields: RecordFields = { type: r.type, category: r.category, amountVnd: over.amountVnd ?? r.amountVnd, occurredOn: r.occurredOn, scope: r.scope, farmId: r.farmId, documentNumber: r.documentNumber, description: over.description ?? r.description, sourceType: 'MANUAL', sourceEvidenceId: null }
      checkFields(fields)
      const next = `FR-${String(nextRecordNo++).padStart(4, '0')}`
      const n: FinanceRecord = { id: nextId++, recordCode: next, ...fields, farmName: '', sourceReference: '', state: 'DRAFT', version: 1, createdAt: clock, createdBy: PM_NAME, history: [], replacementOf: code }
      apply(n, fields)
      log(n, 'Tạo nháp thay thế', undefined, `Thay ${code}`)
      records.push(n)
      r.replacementRecordId = n.id
      return structuredClone(n)
    },

    currentReport(): CashReport { return structuredClone(withExpiry(reports[reports.length - 1])) },
    async getReport(id: number) {
      const r = reports.find((x) => x.id === id)
      if (!r) throw new Error('Kết quả báo cáo không còn khả dụng.')
      return structuredClone(withExpiry(r))
    },
    async runReport(c: ReportCriteria) {
      const problem = validateCriteria(c)
      if (problem) throw new Error(problem)
      clock = addMinutes(clock, 5)
      return structuredClone(makeReport(c))
    },
    async exportXlsx(id: number) {
      const r = reports.find((x) => x.id === id)
      if (!r || isReportExpired({ expiresAt: r.expiresAt, expired: r.expired }, clock)) throw new Error('Kết quả báo cáo đã hết hạn. Hãy chạy lại báo cáo.')
      return { fileName: `dong-tien-nen-tang-${r.code}.xlsx`, sheets: ['Tổng hợp', 'Chi tiết'] }
    },
    expireReport(id: number) { const r = reports.find((x) => x.id === id); if (r) r.expired = true },

    async listNotices(kind: NoticeKind) { return structuredClone(notices.filter((x) => x.kind === kind).sort((a, b) => b.createdTime.localeCompare(a.createdTime))) },
    async markNoticeRead(id: number) { const x = notices.find((n) => n.id === id); if (x && !x.readTime) x.readTime = clock; return structuredClone(x) },
    async markAllNoticesRead(kind: NoticeKind) { let c = 0; notices.forEach((x) => { if (x.kind === kind && !x.readTime) { x.readTime = clock; c += 1 } }); return c },

    async reset() { receipts = structuredClone(seed.receipts); records = structuredClone(seed.records); notices = structuredClone(seed.notices); clock = DEMO_NOW; nextRecordNo = 109; nextId = 200; reports = []; reportSeq = 0; makeReport(DEFAULT_CRITERIA) },
  }
}
export type FinanceDemoStore = ReturnType<typeof createFinanceDemoStore>
export const financeDemoStore = createFinanceDemoStore()
export type { RecordState }
