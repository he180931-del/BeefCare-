import { useEffect, useState } from 'react'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { activateTableRow, activateTableRowByKey, Button, Card, DateInput, ErrorBlock, FilterSelect, Icon, interactiveRowClass, LoadingBlock, Metric, Modal, ModalButton, ModalFooter, Note, PageHeader, Pagination, SearchInput, Table, Td, Th } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { financeError } from '../api/financeError'
import { BackendError } from '../../../shared/api/backendClient'
import { useFinanceCurrentReport, useFinanceFarms, usePlatformFinanceUseCases } from '../hooks/usePlatformFinanceUseCases'
import { FilterField, FlashNote, RoField, useFlash } from '../components/common'
import { buildWorkbookPreview, byCategory, byFarm, CumulativeChart, DonutChart, dailyFlows, getPageCount, IncomeExpenseChart, paginateReportRows, RankBars, REPORT_DETAIL_PAGE_SIZE, REPORT_SCOPE_PAGE_SIZE, ScopeTable, sumBy, WorkbookPreview } from '../components/ReportParts'
import { categoryLabel, formatDate, formatDateTime, formatMoney, formatVnd } from '../domain/financeRules'
import { validateCriteria } from '../validation/financeValidation'
import type { CashReport, ReportCriteria, ReportLine, ScopeTotals, SourceFilter } from '../types'

const TITLE = 'Báo cáo dòng tiền nền tảng'
const lineKind = (l: ReportLine) => (l.sourceType === 'RECEIPT' ? 'Biên nhận gói' : 'Khoản thu chi')
type LineFilter = { q: string; direction: '' | 'IN' | 'OUT'; category: string }
const NO_FILTER: LineFilter = { q: '', direction: '', category: '' }
const matchLine = (l: ReportLine, f: LineFilter) => (!f.direction || l.direction === f.direction) && (!f.category || l.category === f.category) && (!f.q.trim() || `${l.code} ${l.reference} ${categoryLabel(l.category)}`.toLowerCase().includes(f.q.trim().toLowerCase()))
const SOURCE_LABEL: Record<SourceFilter, string> = { BOTH: 'Biên nhận + thủ công', RECEIPTS: 'Chỉ biên nhận gói', MANUAL: 'Chỉ khoản thủ công' }
const scopeLabel = (c: ReportCriteria, farmName: string) => `${c.dateFrom.slice(8, 10)}/${c.dateFrom.slice(5, 7)}–${formatDate(c.dateTo)} · ${farmName} · Asia/Ho_Chi_Minh · VND`
const emptyReport = (criteria: ReportCriteria): CashReport => ({
  id: 0, code: 'CHƯA-CÓ-BẢN-CHỐT', expired: false, criteria: { ...criteria }, generatedAt: `${criteria.dateTo}T00:00:00`, expiresAt: `${criteria.dateTo}T23:59:59`,
  summary: { subscriptionReceipts: 0, otherIncome: 0, totalIncome: 0, totalExpense: 0, netCashFlow: 0, scopes: [], dailyIncome: [], note: 'Chưa có bản chốt. Chạy báo cáo để tạo kết quả.' }, lines: [],
})

/** SCR-73: báo cáo dòng tiền nền tảng chạy trên bản chốt, xuất XLSX đúng bản chốt đang xem. */
export default function CashReportRoutes() {
  const [m, open, close] = useModalParam()
  const [flash, setFlash] = useFlash()
  const useCases = usePlatformFinanceUseCases()
  const [criteria, setCriteria] = useState<ReportCriteria>(() => useCases.defaultReportCriteria())
  const [shown, setShown] = useState<CashReport | null>(null)
  const [focus, setFocus] = useState<ScopeTotals | null>(null)
  const [scopePage, setScopePage] = useState(1)
  const [farmPage, setFarmPage] = useState(1)
  const [draft, setDraft] = useState<LineFilter>(NO_FILTER)
  const [applied, setApplied] = useState<LineFilter>(NO_FILTER)
  const [line, setLine] = useState<ReportLine | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const farms = useFinanceFarms()
  const { data, loading, error, refetch } = useFinanceCurrentReport()

  const report = shown ?? data ?? emptyReport(criteria)
  const s = report.summary
  const setCrit = (p: Partial<ReportCriteria>) => setCriteria((c) => ({ ...c, ...p }))
  useEffect(() => {
    setScopePage(1)
  }, [report.id, report.criteria.dateFrom, report.criteria.dateTo, report.criteria.farmId, report.criteria.sourceFilter])
  useEffect(() => {
    setScopePage((page) => Math.min(page, getPageCount(s.scopes.filter((row) => row.scope !== 'PLATFORM'), REPORT_SCOPE_PAGE_SIZE)))
  }, [report.id, report.lines.length, s.scopes.length])

  const noSnapshot = error instanceof BackendError && (error.status === 404 || error.status === 410)
  if (loading && !data && !noSnapshot) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if ((error && !noSnapshot) || (!data && !noSnapshot)) return <Layout title={TITLE}><ErrorBlock message={financeError(error, 'Không tải được báo cáo.')} onRetry={refetch} /></Layout>

  const hasSnapshot = report.id > 0
  const expired = report.expired
  const farmLabel = report.criteria.farmId ? farms.data?.find((f) => f.id === report.criteria.farmId)?.name ?? 'Một trại' : 'Tất cả trại'

  const run = async () => {
    const problem = validateCriteria(criteria)
    if (problem) { setFormError(problem); return }
    setBusy(true); setFormError(null)
    try {
      const next = await useCases.runReport(criteria)
      setShown(next)
      setFlash({ tone: 'ok', text: `Đã làm mới báo cáo ${next.code} lúc ${formatDateTime(next.generatedAt)}.` })
      close()
    } catch (e) { setFormError(financeError(e, 'Không chạy được báo cáo.')) } finally { setBusy(false) }
  }
  const doExport = async () => {
    if (!hasSnapshot) return
    open('dang-tao')
    try {
      const file = await useCases.exportXlsx(report.id)
      if ('blob' in file) {
        const url = URL.createObjectURL(file.blob as Blob)
        const anchor = document.createElement('a')
        anchor.href = url; anchor.download = file.fileName; anchor.click()
        URL.revokeObjectURL(url)
      }
      close()
      setFlash({ tone: 'ok', text: `Tệp xuất ${file.fileName} đã sẵn sàng.` })
    } catch (e) {
      open(report.expired || (e instanceof Error && /hết hạn/.test(e.message)) ? 'het-han' : 'xuat-loi')
    }
  }
  const refreshAndClose = async () => { close(); await run() }
  const critText = scopeLabel(report.criteria, farmLabel)
  const snapshot = `${report.code} · ${formatDateTime(report.generatedAt)}`

  const days = dailyFlows(report.lines)
  const farmNet = focus ? focus.subscriptionReceipts + focus.otherIncome - focus.expense : 0
  const allFarmLines = focus ? report.lines.filter((l) => (focus.scope === 'FARM' ? l.farmName === focus.farmName : l.scope === 'GENERAL')) : []
  const farmCategories = [...new Set(allFarmLines.map((l) => l.category))]
  const farmLines = allFarmLines.filter((l) => matchLine(l, applied))
  const farmData = paginateReportRows(farmLines, farmPage, REPORT_DETAIL_PAGE_SIZE)
  const openFarm = (row: ScopeTotals) => { setFocus(row); setFarmPage(1); setDraft(NO_FILTER); setApplied(NO_FILTER); open('rieng-trai') }
  const lineAmount = (l: ReportLine) => <span className={l.direction === 'OUT' ? 'text-err-fg' : 'text-ok-fg'}>{l.direction === 'OUT' ? '−' : '+'}{formatVnd(l.amountVnd)}</span>

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE}>
          <Button onClick={() => open('xuat')} disabled={!hasSnapshot}><Icon name="table-export" size={16} /> Xuất báo cáo</Button>
        </PageHeader>
        <FlashNote flash={flash} />
        <div data-testid="report-filters" className="flex flex-wrap items-end gap-3 lg:flex-nowrap">
          <FilterField label="Từ ngày *" width={160}><DateInput compact id="rp-from" value={criteria.dateFrom} onChange={(v) => setCrit({ dateFrom: v })} /></FilterField>
          <FilterField label="Đến ngày *" width={160}><DateInput compact id="rp-to" value={criteria.dateTo} onChange={(v) => setCrit({ dateTo: v })} /></FilterField>
          <FilterField label="Trang trại" width={220}><FilterSelect aria-label="Trang trại" value={criteria.farmId ?? ''} onChange={(e) => setCrit({ farmId: e.target.value ? Number(e.target.value) : null })}><option value="">Tất cả</option>{(farms.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</FilterSelect></FilterField>
          <FilterField label="Nguồn" width={240}><FilterSelect aria-label="Nguồn" value={criteria.sourceFilter} onChange={(e) => setCrit({ sourceFilter: e.target.value as SourceFilter })}>{(Object.keys(SOURCE_LABEL) as SourceFilter[]).map((k) => <option key={k} value={k}>{SOURCE_LABEL[k]}</option>)}</FilterSelect></FilterField>
          <Button className="shrink-0" variant="primary" onClick={run} disabled={busy}><Icon name="refresh" size={16} /> Chạy báo cáo</Button>
        </div>
        {formError && <Note tone="err">{formError}</Note>}
        {expired && <div role="alert"><Note tone="warn">Kết quả báo cáo này đã hết hạn. Hãy chạy lại báo cáo.</Note></div>}
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Tổng thu" value={`${formatVnd(s.totalIncome)} đ`} note={`Gói ${formatVnd(s.subscriptionReceipts)} · thu khác ${formatVnd(s.otherIncome)}`} />
          <Metric label="Tổng chi" value={`${formatVnd(s.totalExpense)} đ`} note="Chỉ khoản đã ghi sổ" />
          <Metric label="Dòng tiền ròng" value={`${formatMoney(s.netCashFlow)} đ`} note="Không gồm nháp, hủy bỏ, chứng từ chưa khớp" />
        </div>
        {report.lines.length === 0 ? (
          <Card><Note tone="info">{hasSnapshot ? 'Không có giao dịch trong kỳ. Bộ lọc và thời điểm chốt được giữ; XLSX vẫn xuất được với số 0.' : s.note}</Note></Card>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Thu và chi theo ngày" sub="Triệu đồng · theo ngày dòng tiền"><IncomeExpenseChart days={days} /></Card>
              <Card title="Xu hướng dòng tiền ròng" sub="Cộng dồn thu trừ chi theo ngày"><CumulativeChart days={days} /></Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Cơ cấu thu" sub="Theo danh mục"><DonutChart items={sumBy(report.lines, 'IN', byCategory)} empty="Chưa có khoản thu." /></Card>
              <Card title="Chi theo danh mục"><DonutChart items={sumBy(report.lines, 'OUT', byCategory)} empty="Chưa có khoản chi." /></Card>
              <Card title="Thu theo trại"><RankBars items={sumBy(report.lines, 'IN', byFarm)} empty="Chưa có khoản thu." /></Card>
            </div>
          </>
        )}
        <ScopeTable scopes={s.scopes} page={scopePage} onPageChange={setScopePage} onFarm={openFarm} />
      </div>

      {m === 'rieng-trai' && focus && (
        <Modal title={`Giao dịch của ${focus.farmName}`} width={760} onClose={close}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              {([
                ['Tổng thu', focus.subscriptionReceipts + focus.otherIncome, 'text-ok-fg'],
                ['Tổng chi', focus.expense, 'text-err-fg'],
                ['Ròng', farmNet, farmNet < 0 ? 'text-err-fg' : 'text-ink'],
              ] as const).map(([label, value, tone]) => (
                <div key={label} className="rounded-lg border border-edge bg-white px-3 py-2">
                  <div className="text-[11px] text-muted">{label}</div>
                  <div className={`whitespace-nowrap text-[15px] font-semibold ${tone}`}>{label === 'Ròng' ? formatMoney(value) : formatVnd(value)} đ</div>
                </div>
              ))}
            </div>
            <form role="search" className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(draft); setFarmPage(1) }}>
              <SearchInput className="min-w-[180px] flex-1 [&_input]:!h-[38px] [&_input]:!rounded-md [&_input]:!py-0 [&_input]:!text-xs" aria-label="Tìm giao dịch" placeholder="Mã, nguồn, danh mục…" value={draft.q} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))} />
              <div className="w-[130px]"><FilterSelect aria-label="Loại giao dịch" value={draft.direction} onChange={(e) => setDraft((d) => ({ ...d, direction: e.target.value as LineFilter['direction'] }))}><option value="">Thu &amp; chi</option><option value="IN">Thu</option><option value="OUT">Chi</option></FilterSelect></div>
              <div className="w-[170px]"><FilterSelect aria-label="Danh mục giao dịch" value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}><option value="">Mọi danh mục</option>{farmCategories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</FilterSelect></div>
              <Button type="submit" variant="primary">Tìm</Button>
            </form>
            {farmLines.length === 0 ? <Note tone="info">{allFarmLines.length === 0 ? 'Trại này không có giao dịch trong bản chốt.' : 'Không có giao dịch khớp bộ lọc.'}</Note> : (
              <>
                <Table stack={false}>
                  <thead><tr><Th>Ngày</Th><Th>Loại</Th><Th>Mã</Th><Th>Danh mục</Th><Th>Số tiền</Th></tr></thead>
                  <tbody>{farmData.rows.map((l) => (
                    <tr key={l.code} tabIndex={0} aria-label={`Xem giao dịch ${l.code}`} className={interactiveRowClass} onClick={(event) => activateTableRow(event, () => setLine(l))} onKeyDown={(event) => activateTableRowByKey(event, () => setLine(l))}><Td>{formatDate(l.cashDate)}</Td><Td>{lineKind(l)}</Td><Td>{l.code}</Td><Td>{categoryLabel(l.category)}</Td><Td>{lineAmount(l)}</Td></tr>
                  ))}</tbody>
                </Table>
                {farmData.total > REPORT_DETAIL_PAGE_SIZE && <Pagination page={farmData.page} pageCount={farmData.pageCount} onChange={setFarmPage} summary={`Hiển thị ${(farmData.page - 1) * REPORT_DETAIL_PAGE_SIZE + 1}–${Math.min(farmData.page * REPORT_DETAIL_PAGE_SIZE, farmData.total)} / ${farmData.total} giao dịch`} />}
              </>
            )}
          </div>
          <ModalFooter><ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về báo cáo</ModalButton></ModalFooter>
        </Modal>
      )}
      {line && (
        <Modal title={`Chi tiết ${line.code}`} width={560} onClose={() => setLine(null)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <RoField label="Loại giao dịch" value={`${lineKind(line)} · ${line.direction === 'IN' ? 'Thu' : 'Chi'}`} />
            <RoField label="Số tiền" value={`${line.direction === 'OUT' ? '−' : '+'}${formatVnd(line.amountVnd)} đ`} />
            <RoField label="Ngày dòng tiền" value={formatDate(line.cashDate)} />
            <RoField label="Danh mục" value={categoryLabel(line.category)} />
            <RoField label="Phạm vi" value={line.scope === 'GENERAL' ? 'Chung nền tảng' : line.farmName} />
            <RoField label="Trạng thái" value={line.status} />
            <RoField label={line.sourceType === 'RECEIPT' ? 'Thanh toán / chứng từ nguồn' : 'Diễn giải / tham chiếu'} value={line.reference} />
            <RoField label="Phiên bản nguồn" value={line.sourceVersion == null ? '—' : `v${line.sourceVersion}`} />
          </div>
          <ModalFooter><ModalButton onClick={() => setLine(null)}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton></ModalFooter>
        </Modal>
      )}
      {m === 'xuat' && (
        <Modal title="Xem trước báo cáo" width={960} onClose={close}>
          <div className="flex flex-col gap-2">
            <WorkbookPreview sheets={buildWorkbookPreview(report, farmLabel, SOURCE_LABEL[report.criteria.sourceFilter])} />
          </div>
          <ModalFooter>
            <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>
            <ModalButton variant="primary" onClick={() => { void doExport() }}><Icon name="table-export" size={16} /> Tải xuống XLSX</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {m === 'dang-tao' && (
        <Modal title="Đang tạo tệp XLSX" width={640} onClose={close}>
          <Note tone="info">Đang xuất theo đúng bản chốt, bộ lọc và thời điểm bạn vừa xác nhận. Vui lòng chờ; nguồn tài chính không thay đổi.</Note>
          <ModalFooter><ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về báo cáo</ModalButton></ModalFooter>
        </Modal>
      )}
      {m === 'xuat-loi' && (
        <Modal title="Chưa xuất được báo cáo" width={640} onClose={close}>
          <Note tone="warn">Không có tệp hoàn chỉnh được tạo. Thử lại cùng bản chốt; nếu bản chốt không còn khả dụng, cần làm mới báo cáo trước.</Note>
          <ModalFooter>
            <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về báo cáo</ModalButton>
            <ModalButton variant="primary" onClick={() => { void doExport() }}><Icon name="refresh" size={16} /> Thử lại xuất</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {m === 'het-han' && (
        <Modal title="Kết quả báo cáo không còn khả dụng" width={640} onClose={close}>
          <Note tone="warn">Bản chốt đã hết hạn hoặc không còn truy xuất được. Làm mới để tạo kết quả mới; không xuất số live khác dưới thời điểm chốt cũ.</Note>
          <ModalFooter>
            <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về báo cáo</ModalButton>
            <ModalButton variant="primary" onClick={() => { void refreshAndClose() }}><Icon name="refresh" size={16} /> Làm mới báo cáo</ModalButton>
          </ModalFooter>
        </Modal>
      )}
    </Layout>
  )
}
