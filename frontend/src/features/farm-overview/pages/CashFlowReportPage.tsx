import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { roleInFarm, useSession } from '../../../app/session/sessionContext'
import { userFacingError } from '../../../shared/api/userFacingError'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { Badge, Button, DateInput, EmptyBlock, ErrorBlock, Field, Foot, LoadingBlock, PageHeader, Panel, Select } from '../../../shared/ui'
import { cashFlowReportApi, type CashFlowFilters, type CashFlowItem, type CashFlowSource, type FarmCashFlowView } from '../api/cashFlowReportApi'

const PAGE_SIZE = 20
const SOURCE_OPTIONS: Array<[CashFlowSource, string]> = [
  ['HERD_EXIT', 'Xuất đàn'],
  ['HERD_ENTRY', 'Nhập đàn'],
  ['FEED_RECEIPT', 'Nhập thức ăn'],
  ['SUBSCRIPTION', 'Gói dịch vụ'],
]
const SOURCE_LABEL: Record<CashFlowSource, string> = {
  HERD_EXIT: 'Thu xuất đàn',
  HERD_ENTRY: 'Chi nhập đàn',
  FEED_RECEIPT: 'Chi nhập thức ăn',
  SUBSCRIPTION: 'Chi gói dịch vụ',
}

function initialFilters(): CashFlowFilters {
  const to = businessDate()
  return { from: `${to.slice(0, 7)}-01`, to, source: '', direction: '', page: 0, size: PAGE_SIZE }
}

function addMonths(date: string, months: number) {
  const [year, month, day] = date.split('-').map(Number)
  const monthStart = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate()
  return `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

function periodError(from: string, to: string, today: string) {
  if (!from || !to) return 'Vui lòng chọn đầy đủ Từ ngày và Đến ngày.'
  if (from > to) return 'Từ ngày phải trước hoặc trùng Đến ngày.'
  if (to > today) return 'Đến ngày không được ở tương lai theo giờ Việt Nam.'
  if (addMonths(from, 24) < to) return 'Kỳ báo cáo tối đa 24 tháng.'
  return ''
}

function formatVnd(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(value)
}

function formatDate(value: string) {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
}

function methodLabel(value: string | null) {
  if (value === 'CASH') return 'Tiền mặt'
  if (value === 'BANK_TRANSFER') return 'Chuyển khoản'
  return '—'
}

function sourceLink(item: CashFlowItem, farmId: number | null) {
  const id = encodeURIComponent(String(item.documentId))
  switch (item.source) {
    case 'HERD_EXIT': return `/herd-exit/${id}`
    case 'HERD_ENTRY': return `/herd-entry/${id}`
    case 'FEED_RECEIPT': return `/thuc-an/phieu-nhap/${id}`
    case 'SUBSCRIPTION': return `/goi-dich-vu/lich-su/${id}?farm=${encodeURIComponent(String(farmId ?? ''))}`
  }
}

function SourceRow({ item, farmId }: { item: CashFlowItem; farmId: number | null }) {
  const title = SOURCE_LABEL[item.source]
  const code = item.documentCode ?? '—'
  return (
    <>
      <td className="px-3 py-3 text-sm text-ink">{formatDate(item.cashDate)}</td>
      <td className="px-3 py-3 text-sm text-ink"><div className="flex flex-wrap items-center gap-2"><Badge>{item.direction === 'IN' ? 'Thu' : 'Chi'}</Badge><span>{title}</span></div></td>
      <td className="px-3 py-3 text-sm text-ink">{code}</td>
      <td className="px-3 py-3 text-sm text-muted">{methodLabel(item.method)}</td>
      <td className="px-3 py-3 text-right text-sm font-semibold text-ink">{formatVnd(item.amountVnd)}</td>
      <td className="px-3 py-3 text-right"><Link aria-label={`Xem chứng từ ${code}`} to={sourceLink(item, farmId)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand no-underline hover:bg-page">Xem chứng từ</Link></td>
    </>
  )
}

function Summary({ report }: { report: FarmCashFlowView }) {
  const netPositive = report.netCashFlow >= 0
  return (
    <section aria-label="Tổng quan dòng tiền" className="grid gap-3 @min-[640px]:grid-cols-3">
      <Panel title="Tổng thu" tone="ok" className="gap-2"><p className="m-0 text-2xl font-bold">{formatVnd(report.totalIncome)}</p><p className="m-0 text-xs text-muted">Các khoản đã ghi nhận</p></Panel>
      <Panel title="Tổng chi" tone="warn" className="gap-2"><p className="m-0 text-2xl font-bold">{formatVnd(report.totalExpense)}</p><p className="m-0 text-xs text-muted">Các khoản đã ghi nhận</p></Panel>
      <Panel title="Dòng tiền ròng" tone={netPositive ? 'emphasis' : 'err'} className="gap-2"><p className="m-0 text-2xl font-bold">{formatVnd(report.netCashFlow)}</p><p className="m-0 text-xs">{netPositive ? 'Thu nhiều hơn hoặc bằng chi' : 'Chi nhiều hơn thu'}</p></Panel>
    </section>
  )
}

export default function CashFlowReportPage() {
  const session = useSession()
  const today = businessDate()
  const [draft, setDraft] = useState<CashFlowFilters>(initialFilters)
  const [applied, setApplied] = useState<CashFlowFilters>(draft)
  const [filterError, setFilterError] = useState('')
  const [report, setReport] = useState<FarmCashFlowView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [retry, setRetry] = useState(0)
  const owner = session != null && roleInFarm(session, session.farmId) === 'OWNER'

  useEffect(() => {
    let current = true
    setLoading(true)
    setError(null)
    setReport(null)
    void cashFlowReportApi.getReport(applied).then((value) => {
      if (current) setReport(value)
    }).catch((reason: unknown) => {
      if (current) setError(reason)
    }).finally(() => {
      if (current) setLoading(false)
    })
    return () => { current = false }
  }, [applied, retry])

  const updateDraft = (patch: Partial<CashFlowFilters>) => setDraft((current) => ({ ...current, ...patch }))
  const apply = () => {
    const issue = periodError(draft.from, draft.to, today)
    setFilterError(issue)
    if (!issue) setApplied({ ...draft, page: 0, size: PAGE_SIZE })
  }
  const page = (nextPage: number) => setApplied((current) => ({ ...current, page: nextPage }))
  const previousEnabled = applied.page > 0
  const nextEnabled = Boolean(report && (applied.page + 1) * applied.size < report.totalElements)
  const totalPages = report ? Math.max(1, Math.ceil(report.totalElements / applied.size)) : 1

  return (
    <Layout title="Báo cáo thu chi">
      <div className="@container flex min-w-0 flex-col gap-4">
        <PageHeader title="Báo cáo thu chi" sub={`Dòng tiền của ${session?.farmName ?? 'trại đang chọn'}. Kỳ nghiệp vụ theo giờ Việt Nam.`} />

        <Panel title="Kỳ và bộ lọc" sub="Bộ lọc chỉ áp dụng khi bạn bấm Xem báo cáo.">
          <div className="grid gap-3 @min-[760px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] @min-[1024px]:items-end">
            <Field label="Từ ngày" id="cash-flow-from"><DateInput id="cash-flow-from" label="Từ ngày" value={draft.from} onChange={(from) => updateDraft({ from })} /></Field>
            <Field label="Đến ngày" id="cash-flow-to"><DateInput id="cash-flow-to" label="Đến ngày" value={draft.to} onChange={(to) => updateDraft({ to })} /></Field>
            <Field label="Nguồn" id="cash-flow-source">
              <Select id="cash-flow-source" value={draft.source} onChange={(event) => updateDraft({ source: event.target.value as CashFlowSource | '' })}>
                <option value="">Tất cả nguồn</option>
                {SOURCE_OPTIONS.filter(([source]) => source !== 'SUBSCRIPTION' || owner).map(([source, label]) => <option key={source} value={source}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Chiều" id="cash-flow-direction">
              <Select id="cash-flow-direction" value={draft.direction} onChange={(event) => updateDraft({ direction: event.target.value as CashFlowFilters['direction'] })}>
                <option value="">Thu / Chi / Tất cả</option>
                <option value="IN">Thu</option>
                <option value="OUT">Chi</option>
              </Select>
            </Field>
            <Button variant="primary" className="min-h-11" onClick={apply}>Xem báo cáo</Button>
          </div>
          {filterError && <p role="alert" className="m-0 text-sm text-err-fg">{filterError}</p>}
          <div className="flex flex-wrap items-center gap-2 border-t border-field pt-3 text-xs" aria-live="polite">
            <span className="font-semibold text-ink">Đang áp dụng:</span>
            <Badge>{applied.from} – {applied.to}</Badge>
            <Badge>{applied.source ? SOURCE_OPTIONS.find(([source]) => source === applied.source)?.[1] : 'Tất cả nguồn'}</Badge>
            <Badge>{applied.direction === 'IN' ? 'Thu' : applied.direction === 'OUT' ? 'Chi' : 'Tất cả chiều'}</Badge>
            {JSON.stringify(draft) !== JSON.stringify(applied) && <span className="text-warn-fg">Bộ lọc đang soạn chưa áp dụng.</span>}
          </div>
        </Panel>

        {loading && <LoadingBlock />}
        {Boolean(error) && <ErrorBlock message={userFacingError(error, 'Không tải được báo cáo thu chi.')} onRetry={() => setRetry((value) => value + 1)} />}
        {report && !error && <>
          <Summary report={report} />
          <Panel title="Chi tiết thu chi" sub={`${report.totalElements.toLocaleString('vi-VN')} khoản trong kỳ lọc`}>
            {report.items.length === 0 ? <EmptyBlock title="Không có khoản phù hợp trong kỳ đã chọn." sub="Thử thay đổi ngày hoặc bộ lọc nguồn và chiều." /> : <>
              <div className="hidden overflow-x-auto @min-[760px]:block">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Chi tiết các khoản thu chi</caption>
                  <thead><tr className="border-b border-field text-[11px] font-semibold text-muted"><th className="px-3 py-2">Ngày</th><th className="px-3 py-2">Khoản</th><th className="px-3 py-2">Chứng từ</th><th className="px-3 py-2">Hình thức</th><th className="px-3 py-2 text-right">Số tiền</th><th className="px-3 py-2 text-right">Mở</th></tr></thead>
                  <tbody>{report.items.map((item) => <tr key={item.id} className="border-b border-field last:border-b-0"><SourceRow item={item} farmId={session?.farmId ?? null} /></tr>)}</tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 @min-[760px]:hidden">
                {report.items.map((item) => <article key={item.id} className="rounded-xl border border-field bg-page p-3">
                  <div className="flex items-start justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Badge>{item.direction === 'IN' ? 'Thu' : 'Chi'}</Badge><strong className="text-sm">{SOURCE_LABEL[item.source]}</strong></div><time className="shrink-0 text-xs text-muted">{formatDate(item.cashDate)}</time></div>
                  <dl className="my-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted">Chứng từ</dt><dd className="m-0 font-semibold text-ink">{item.documentCode ?? '—'}</dd></div><div><dt className="text-muted">Hình thức</dt><dd className="m-0 text-ink">{methodLabel(item.method)}</dd></div><div className="col-span-2"><dt className="text-muted">Số tiền</dt><dd className="m-0 font-bold text-ink">{formatVnd(item.amountVnd)}</dd></div></dl>
                  <Link aria-label={`Xem chứng từ ${item.documentCode ?? '—'}`} to={sourceLink(item, session?.farmId ?? null)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand no-underline hover:bg-white">Xem chứng từ</Link>
                </article>)}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-field pt-3">
                <span className="text-xs text-muted">Trang {applied.page + 1} / {totalPages}</span>
                <div className="flex gap-2"><Button size="sm" disabled={!previousEnabled} onClick={() => page(applied.page - 1)}>Trang trước</Button><Button size="sm" disabled={!nextEnabled} onClick={() => page(applied.page + 1)}>Trang sau</Button></div>
              </div>
            </>}
          </Panel>
        </>}

        <Panel title="Đối chiếu chứng từ" sub="Mở các nghiệp vụ nguồn để ghi nhận, xem công nợ hoặc đối chiếu chi phí thức ăn đã sử dụng.">
          <nav aria-label="Nguồn đối chiếu" className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link className="rounded-lg border border-field px-3 py-2 text-brand no-underline hover:bg-page" to="/herd-entry">Nhập đàn</Link>
            <Link className="rounded-lg border border-field px-3 py-2 text-brand no-underline hover:bg-page" to="/herd-exit">Xuất đàn</Link>
            <Link className="rounded-lg border border-field px-3 py-2 text-brand no-underline hover:bg-page" to="/thuc-an/phieu-nhap">Phiếu nhập thức ăn</Link>
            <Link className="rounded-lg border border-field px-3 py-2 text-brand no-underline hover:bg-page" to="/thuc-an/bao-cao">Báo cáo tiêu thụ thức ăn</Link>
            {owner && <Link className="rounded-lg border border-field px-3 py-2 text-brand no-underline hover:bg-page" to={`/goi-dich-vu/lich-su?farm=${encodeURIComponent(String(session?.farmId ?? ''))}`}>Lịch sử thanh toán gói</Link>}
          </nav>
        </Panel>
        <Foot>Chỉ tính khoản thu chi đã ghi nhận. Khoản hủy, nháp, công nợ và giá vốn thức ăn đã dùng không tự tạo dòng tiền.</Foot>
      </div>
    </Layout>
  )
}
