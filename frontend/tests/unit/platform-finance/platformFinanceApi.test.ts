import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFinanceApi } from '../../../src/features/platform-finance/api/financeApi'
import { createFinanceDemoStore } from '../../../src/features/platform-finance/data/financeDemoStore'
import { formatVnd, validateRecordFields } from '../../../src/features/platform-finance/domain/financeRules'
import type { RecordFields } from '../../../src/features/platform-finance/types'

const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() })
const make = () => {
  const store = createFinanceDemoStore()
  return { store, api: createFinanceApi({ mode: 'local', farmId: 1, transport: transport(), store }) }
}
const fields = (over: Partial<RecordFields> = {}): RecordFields => ({
  type: 'EXPENSE', category: 'Hạ tầng máy chủ', amountVnd: 500000, occurredOn: '2026-10-17', scope: 'GENERAL', farmId: null,
  documentNumber: 'HD-1', description: 'Thử', sourceType: 'MANUAL', sourceEvidenceId: null, ...over,
})
const ALL = { dateFrom: '2026-10-01', dateTo: '2026-10-18', farmId: null, sourceFilter: 'BOTH' as const }

describe('quy tắc nhập khoản (SRS 21.3)', () => {
  it('số tiền phải là số nguyên đồng lớn hơn 0 (MSG-FE21-09)', () => {
    expect(validateRecordFields(fields({ amountVnd: 0 })).amountVnd).toBe('Số tiền phải là số nguyên đồng lớn hơn 0.')
    expect(validateRecordFields(fields({ amountVnd: 10.5 })).amountVnd).toBeTruthy()
    expect(validateRecordFields(fields())).toEqual({})
  })
  it('danh mục phải hợp với loại (MSG-FE21-10) và trại bắt buộc khi gắn với trại', () => {
    expect(validateRecordFields(fields({ type: 'INCOME' })).category).toContain('không dùng được cho')
    expect(validateRecordFields(fields({ scope: 'FARM' })).farmId).toBeTruthy()
    expect(validateRecordFields(fields({ occurredOn: '2026-12-01' })).occurredOn).toBeTruthy()
  })
  it('định dạng tiền kiểu Việt Nam', () => expect(formatVnd(1200000)).toBe('1.200.000'))
})

describe('khoản thu chi: nháp, ghi sổ, hủy bỏ', () => {
  let ctx: ReturnType<typeof make>
  beforeEach(() => { ctx = make() })

  it('đếm đúng 24 khoản và các tab 2 / 20 / 2', async () => {
    const page = await ctx.api.listRecords({})
    expect(page.total).toBe(24)
    expect(page.counts).toEqual({ ALL: 24, DRAFT: 2, POSTED: 20, VOID: 2 })
    expect(page.rows[0].recordCode).toBe('FR-0104')
  })
  it('tạo nháp, sửa, ghi sổ; khoản đã ghi sổ không sửa được', async () => {
    const draft = await ctx.api.createDraft(fields())
    expect(draft.state).toBe('DRAFT')
    const saved = await ctx.api.saveDraft(draft.recordCode, fields({ amountVnd: 700000 }), draft.version)
    expect(saved.version).toBeGreaterThan(draft.version)
    const posted = await ctx.api.post(draft.recordCode, saved.version)
    expect(posted.state).toBe('POSTED')
    expect(posted.postedBy).toBe('Đỗ Minh Quân')
    await expect(ctx.api.saveDraft(draft.recordCode, fields(), posted.version)).rejects.toThrow('Chỉ khoản nháp')
  })
  it('từ chối phiên bản cũ (MSG-COM-05)', async () => {
    const draft = await ctx.api.createDraft(fields())
    await ctx.api.saveDraft(draft.recordCode, fields({ amountVnd: 600000 }), draft.version)
    await expect(ctx.api.post(draft.recordCode, draft.version)).rejects.toThrow('đã được thay đổi')
  })
  it('hủy bỏ cần lý do, giữ khoản gốc, rồi tạo nháp thay thế liên kết', async () => {
    const before = await ctx.api.getRecord('FR-0101')
    await expect(ctx.api.voidRecord('FR-0101', before.record.version, '  ')).rejects.toThrow('Lý do')
    const voided = await ctx.api.voidRecord('FR-0101', before.record.version, 'Ghi nhầm')
    expect(voided.state).toBe('VOID')
    expect(voided.voidReason).toBe('Ghi nhầm')
    await expect(ctx.api.voidRecord('FR-0101', voided.version, 'Lần hai')).rejects.toThrow('Chỉ khoản đã ghi sổ')
    const replacement = await ctx.api.createReplacement('FR-0101', voided.version, { amountVnd: 1400000, description: 'Thay thế' })
    expect(replacement.state).toBe('DRAFT')
    expect(replacement.replacementOf).toBe('FR-0101')
    expect(replacement.amountVnd).toBe(1400000)
  })
  it('bỏ nháp xóa khỏi danh sách; không bỏ được khoản đã ghi sổ', async () => {
    await ctx.api.discard('FR-0108', (await ctx.api.getRecord('FR-0108')).record.version)
    expect((await ctx.api.listRecords({})).total).toBe(23)
    await expect(ctx.api.discard('FR-0101', 1)).rejects.toThrow('Chỉ khoản nháp')
  })
  it('giao dịch ngân hàng đã là biên nhận gói bị từ chối làm thu khác (GBR-84)', async () => {
    const choices = await ctx.api.listBankTransactions()
    const claimed = choices.find((c) => c.claimedBy)!
    expect(claimed.claimedBy).toContain('BCF7K2Q9')
    const bad = fields({ type: 'INCOME', category: 'Đào tạo tại trại', amountVnd: 1200000, sourceType: 'BANK', sourceEvidenceId: claimed.transactionId })
    await expect(ctx.api.createDraft(bad)).rejects.toThrow('đã được ghi nhận là')
    const free = choices.find((c) => !c.claimedBy)!
    const ok = await ctx.api.createDraft({ ...bad, amountVnd: free.amount, sourceEvidenceId: free.transactionId })
    expect(ok.sourceReference).toBe(free.sourceReference)
  })
  it('hủy bỏ khoản ghi sổ giải phóng nguồn ngân hàng', async () => {
    const free = (await ctx.api.listBankTransactions()).find((c) => !c.claimedBy)!
    const f = fields({ type: 'INCOME', category: 'Đào tạo tại trại', amountVnd: free.amount, sourceType: 'BANK', sourceEvidenceId: free.transactionId })
    const d = await ctx.api.createDraft(f)
    const p = await ctx.api.post(d.recordCode, d.version)
    expect((await ctx.api.listBankTransactions()).find((c) => c.transactionId === free.transactionId)?.claimedBy).toContain(p.recordCode)
    await ctx.api.voidRecord(p.recordCode, p.version, 'Nhầm')
    expect((await ctx.api.listBankTransactions()).find((c) => c.transactionId === free.transactionId)?.claimedBy).toBeUndefined()
  })
})

describe('báo cáo dòng tiền (GBR-85)', () => {
  let ctx: ReturnType<typeof make>
  beforeEach(() => { ctx = make() })

  it('bản chốt đầu khớp frame: thu 100.140.000, chi 6.550.000, ròng 93.590.000', async () => {
    const r = await ctx.api.currentReport()
    expect(r.code).toBe('SNAP-20261019-001')
    expect(r.summary).toMatchObject({ subscriptionReceipts: 98640000, otherIncome: 1500000, totalIncome: 100140000, totalExpense: 6550000, netCashFlow: 93590000 })
    const total = r.summary.scopes.at(-1)!
    expect(total).toMatchObject({ subscriptionReceipts: 98640000, otherIncome: 1500000, expense: 6550000 })
    expect(r.summary.scopes[0].farmName).toBe('Chung nền tảng')
  })
  it('lọc một trại bỏ khoản chung nền tảng', async () => {
    const r = await ctx.api.runReport({ ...ALL, farmId: 1 })
    expect(r.summary.totalExpense).toBe(0)
    expect(r.summary.netCashFlow).toBe(1200000)
    expect(r.summary.scopes.some((s) => s.scope === 'GENERAL')).toBe(false)
  })
  it('chỉ tính biên nhận hoặc chỉ khoản thủ công theo bộ lọc nguồn', async () => {
    expect((await ctx.api.runReport({ ...ALL, sourceFilter: 'RECEIPTS' })).summary.otherIncome).toBe(0)
    expect((await ctx.api.runReport({ ...ALL, sourceFilter: 'MANUAL' })).summary.subscriptionReceipts).toBe(0)
  })
  it('ghi sổ khoản mới chỉ đổi bản chốt mới; bản cũ giữ nguyên số', async () => {
    const first = await ctx.api.currentReport()
    const rec = await ctx.api.getRecord('FR-0108')
    await ctx.api.post('FR-0108', rec.record.version)
    expect((await ctx.api.getReport(first.id)).summary.totalExpense).toBe(6550000)
    const second = await ctx.api.runReport(ALL)
    expect(second.code).toBe('SNAP-20261019-002')
    expect(second.summary.totalExpense).toBe(9250000)
  })
  it('kỳ không có giao dịch cho tổng bằng 0 và vẫn xuất được', async () => {
    const r = await ctx.api.runReport({ ...ALL, dateFrom: '2024-01-01', dateTo: '2024-01-02' })
    expect(r.lines).toHaveLength(0)
    expect(r.summary.netCashFlow).toBe(0)
    expect((await ctx.api.exportXlsx(r.id)).fileName).toMatch(/\.xlsx$/)
  })
  it('kỳ dài hơn 24 tháng bị từ chối; bản chốt hết hạn không xuất được', async () => {
    await expect(ctx.api.runReport({ ...ALL, dateFrom: '2024-01-01' })).rejects.toThrow('24 tháng')
    const r = await ctx.api.currentReport()
    ctx.store.expireReport(r.id)
    await expect(ctx.api.exportXlsx(r.id)).rejects.toThrow('hết hạn')
  })
})

describe('biên nhận và thông báo', () => {
  it('37 biên nhận, tổng 98.640.000, lọc theo mã và trại', async () => {
    const { api } = make()
    const all = await api.listReceipts({})
    expect(all.total).toBe(37)
    expect(all.totalAmount).toBe(98640000)
    expect(all.rows[0].code).toBe('RC-26-0412')
    expect((await api.listReceipts({ search: 'BCF7K2Q9' })).total).toBe(1)
    expect((await api.listReceipts({ farmId: 2 })).rows[0].farmName).toBe('Trại Mai Pha')
  })
  it('đánh dấu đã đọc từng thông báo và tất cả', async () => {
    const { api } = make()
    expect((await api.listNotices('RECON')).filter((n) => !n.readTime)).toHaveLength(3)
    await api.markNoticeRead(1)
    expect((await api.listNotices('RECON')).filter((n) => !n.readTime)).toHaveLength(2)
    await api.markAllNoticesRead('RECON')
    expect((await api.listNotices('RECON')).filter((n) => !n.readTime)).toHaveLength(0)
    expect((await api.listNotices('SUPPORT')).filter((n) => !n.readTime)).toHaveLength(2)
  })
  it('chế độ backend gọi API thật và không đụng store', async () => {
    const store = createFinanceDemoStore()
    const spy = vi.spyOn(store, 'listRecords')
    const http = transport()
    const api = createFinanceApi({ mode: 'backend', farmId: 1, transport: http, store })
    await expect(api.listRecords({})).resolves.toMatchObject({ rows: [], total: 0 })
    expect(spy).not.toHaveBeenCalled()
    expect(http.get).toHaveBeenCalled()
  })

  it('thông báo nền tảng dùng notification API thật và lọc theo nhóm', async () => {
    const store = createFinanceDemoStore()
    const http = transport()
    http.get.mockImplementation(async (path: string) => path === '/api/notifications/mine' ? [{ id: 5, category: 'SUPPORT', targetType: 'INTERNAL_REQUEST', targetId: 77, title: 'IR-077', summary: 'Cần xử lý', createdTime: '2026-11-01T10:00:00Z', readTime: null }] : {})
    http.command.mockResolvedValue({ id: 5, category: 'SUPPORT', targetType: 'INTERNAL_REQUEST', targetId: 77, title: 'IR-077', summary: 'Cần xử lý', createdTime: '2026-11-01T10:00:00Z', readTime: '2026-11-01T10:01:00Z' })
    const api = createFinanceApi({ mode: 'backend', farmId: 1, transport: http, store })
    await expect(api.listNotices('SUPPORT')).resolves.toMatchObject([{ href: '/nen-tang/yeu-cau/77', kind: 'SUPPORT' }])
    await api.markNoticeRead(5)
    expect(http.command).toHaveBeenCalledWith('/api/notifications/5/read', undefined, { method: 'PUT' })
  })
})
