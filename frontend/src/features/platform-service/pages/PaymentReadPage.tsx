import { useEffect, useRef, useState, type DependencyList } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, Info, LoadingBlock, Metric, Note, PageHeader, Pagination, Segmented, Table, Td, Th, inputCls } from '../../../components/ui'
import EvidenceActions, { type ActionDraft } from '../components/EvidenceActions'
import SePayLookup from '../components/SePayLookup'
import { useQuery } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { useSession } from '../../authorization'
import { CONFIRMATION_SOURCE_TEXT, MATCH_TEXT, REVIEW_TEXT, platformPaymentReadApi as api, reasonText, type EvidenceReadFilters, type EvidenceRow, type PaymentRead, type PaymentReadFilters, type ReadPage } from '../api/platformPaymentReadApi'
import { fmtDate, fmtEndDate, fmtSeconds, fmtVnd } from '../domain/dates'
import { PAYMENT_STATE_LABEL } from '../domain/reconciliation'

const TITLE = 'Thanh toán & đối soát'
type Tab = 'evidence' | 'requests'
const EVIDENCE: EvidenceReadFilters = { status: 'ALL', bankFrom: '', bankTo: '', page: 0 }
const PAYMENTS: PaymentReadFilters = { q: '', state: '', page: 0 }
/** PlatformEvidenceHistory.action: PM decisions plus the documented event codes (never raw audit action names). */
const HISTORY_LABEL: Record<string, string> = {
  ACCEPT: 'Chấp nhận', HOLD: 'Tạm giữ', REJECT: 'Từ chối', LOCK: 'Khóa hoàn trả', UNLOCK: 'Mở khóa hoàn trả', RETURN_VERIFIED: 'Xác minh hoàn trả',
  EVIDENCE_RECEIVED: 'Tiếp nhận chứng từ', EVIDENCE_AUTO_ACCEPTED: 'Tự động chấp nhận',
  EVIDENCE_LOCK_RETURN: 'Khóa hoàn trả', EVIDENCE_RETURN_UNLOCK: 'Mở khóa hoàn trả', EVIDENCE_RETURN_RECORDED: 'Ghi nhận hoàn trả',
}
const invalidRange = (f: EvidenceReadFilters) => !!(f.bankFrom && f.bankTo && f.bankFrom > f.bankTo)
const validPage = (p: unknown) => Number.isInteger(p) && Number(p) >= 0 && Number(p) <= 107374182
const validDate = (d: unknown) => typeof d === 'string' && (d === '' || /^\d{4}-\d{2}-\d{2}$/.test(d))
const idOf = (raw: string | null) => raw && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : null
const paymentLink = (id: number) => `/nen-tang/thanh-toan?paymentId=${id}&origin=payments`

function stored(key: string) {
  try {
    const s = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (s && ['evidence', 'requests'].includes(s.tab) && ['ALL', 'TO_REVIEW', 'HOLD', 'REJECTED', 'ACCEPTED', 'LOCKED'].includes(s.evidence?.status)
      && validDate(s.evidence.bankFrom) && validDate(s.evidence.bankTo) && validPage(s.evidence.page) && !invalidRange(s.evidence)
      && typeof s.payments?.q === 'string' && s.payments.q.length <= 100 && ['', 'PENDING', 'PAID', 'EXPIRED'].includes(s.payments.state) && validPage(s.payments.page)) {
      return s as { tab: Tab; evidence: EvidenceReadFilters; payments: PaymentReadFilters }
    }
  } catch { /* Session preferences are optional; business data always comes from the API. */ }
  return { tab: 'evidence' as Tab, evidence: EVIDENCE, payments: PAYMENTS }
}

/** Keep the previous page while a refresh is in flight; discard responses after unmount/filter changes. */
function useReadPage<T>(load: () => Promise<ReadPage<T>>, deps: DependencyList) {
  const [result, setResult] = useState<{ data: ReadPage<T> | null; loading: boolean; error: unknown; query: unknown }>({ data: null, loading: true, error: null, query: deps[0] })
  useEffect(() => {
    let active = true
    const query = deps[0]
    setResult((old) => ({ ...old, loading: true, error: null, query }))
    load().then((data) => active && setResult({ data, loading: false, error: null, query }), (error: unknown) => active && setResult({ data: null, loading: false, error, query }))
    return () => { active = false }
  }, deps)
  return { ...result, loading: result.loading || result.query !== deps[0] }
}

function EvidencePanel({ id, refresh, onDone, onStale }: { id: number; refresh: number; onDone: (message: string) => void; onStale: (message: string) => void }) {
  const result = useQuery(() => Promise.all([api.evidenceDetail(id), api.candidates(id)]), [id, refresh])
  // What the PM was typing when the evidence changed meanwhile (MSG-COM-05); restored into the reloaded form.
  const draft = useRef<ActionDraft | null>(null)
  if (result.loading && !result.data) return <LoadingBlock />
  if (result.error || !result.data) return <ErrorBlock message={userFacingError(result.error, 'Không tải được chứng từ.')} onRetry={result.refetch} />
  const [e, candidates] = result.data
  const r = e.summary
  return <section aria-label="Chi tiết chứng từ">
    <Card title="Chi tiết chứng từ" actions={<Badge tone="outline">{REVIEW_TEXT[r.reviewStatus]}</Badge>}>
      <Info cols={2} items={[
        ['Nhà cung cấp', r.provider], ['Môi trường', r.environment], ['Namespace tài khoản', r.accountNamespace],
        ['Mã giao dịch', e.transactionId], ['Ngân hàng', e.bank ?? '—'], ['Tài khoản nhận', e.receivingAccount ?? '—'],
        ['Kiểm tra tài khoản nhận', r.receivingAccountMatches === null ? 'Chưa xác định' : r.receivingAccountMatches ? 'Khớp ✓' : 'Không khớp ✗'],
        ['Số tiền', fmtVnd(r.amount)], ['Chiều chuyển khoản', r.direction === 'IN' ? 'Tiền vào' : r.direction === 'OUT' ? 'Tiền ra' : '—'],
        ['Nội dung chuyển khoản', r.content ?? '—'], ['Mã trích được', e.quoteRef ?? '—'], ['Tham chiếu ngân hàng', e.referenceCode ?? '—'],
        ['Ngân hàng ghi nhận', fmtSeconds(r.bankPaidAt)], ['Hệ thống nhận lần đầu', fmtSeconds(e.firstReceivedAt)],
        ['Kết quả khớp', MATCH_TEXT[r.matchResult]], ['Lý do đã ghi nhận', reasonText(r.reviewReason) ?? '—'],
      ]} />
      {r.paymentId && <Link className="mt-3 inline-flex font-semibold text-brand underline" to={paymentLink(r.paymentId)}>Xem thanh toán {r.paymentCode}</Link>}
    </Card>
    <div className="mt-4"><Card title="Lịch sử xử lý">
      {e.history.length === 0 ? <p className="text-sm text-muted">Chưa có lịch sử xử lý.</p> : <Table stack={false}>
        <caption className="sr-only">Lịch sử xử lý</caption><thead><tr><Th>Sự kiện / Thời điểm</Th><Th>Người xử lý</Th><Th>Lý do / Tham chiếu</Th></tr></thead>
        <tbody>{e.history.map((h) => <tr key={`${h.source}-${h.id}`}><Td>{HISTORY_LABEL[h.action] ?? 'Xử lý chứng từ'}<div>{fmtSeconds(h.at)}</div></Td><Td>{h.pmName ?? 'Hệ thống'}</Td>
          <Td>{h.reason ? reasonText(h.reason) : h.reference || h.result || h.returnDate ? null : '—'}
            {h.reference && <div>Tham chiếu: {h.reference}</div>}{h.result && <div>Kết quả: {h.result}</div>}
            {h.returnDate && <div>Ngày hoàn trả: {fmtDate(h.returnDate)}</div>}</Td></tr>)}</tbody></Table>}
    </Card></div>
    {/* The form restarts on each new version: a saved change starts empty, a stale reload keeps the PM's draft. */}
    <EvidenceActions key={`${r.id}-${r.version}`} detail={e} candidates={candidates} draft={draft.current} paymentHref={paymentLink}
      onDone={(message) => { draft.current = null; onDone(message) }} onStale={(message, kept) => { draft.current = kept; onStale(message) }} />
  </section>
}

function PaymentDetail({ id }: { id: number | null }) {
  const result = useQuery(async () => {
    if (id === null) throw new Error('Mã thanh toán không hợp lệ.')
    return api.payment(id)
  }, [id])
  const p = result.data
  return <Layout title={TITLE}>
    <PageHeader title="Chi tiết thanh toán"><Button onClick={result.refetch}>Làm mới</Button></PageHeader>
    <section aria-label="Chi tiết thanh toán">
      {result.loading && !p ? <LoadingBlock /> : result.error || !p ? <ErrorBlock message={userFacingError(result.error, 'Không tải được thanh toán.')} onRetry={result.refetch} /> :
        <Card title={p.quoteRef} sub={p.farmName}><Info cols={2} items={[
          ['Trạng thái', PAYMENT_STATE_LABEL[p.state]], ['Kỳ hạn', `${p.termYears} năm`], ['Số tiền', fmtVnd(p.amount)], ['Phiên bản giá', `v${p.priceVersionId}`],
          ['Tạo lúc', fmtSeconds(p.requestedAt)], ['Hết hạn lúc', fmtSeconds(p.expiresAt)], ['Người tạo yêu cầu', p.requestedByEmail ?? '—'],
          ['Ngân hàng ghi nhận', fmtSeconds(p.bankPaidAt)], ['Hệ thống nhận giao dịch', fmtSeconds(p.receivedAt)], ['Xác nhận lúc', fmtSeconds(p.confirmedAt)],
          ['Nguồn xác nhận', p.confirmationSource === null ? '—' : CONFIRMATION_SOURCE_TEXT[p.confirmationSource] ?? p.confirmationSource], ['Biên lai', p.receiptCode ?? '—'],
          ['Kỳ đã mua', p.purchasedStart && p.purchasedEnd ? `${fmtDate(p.purchasedStart)} → ${fmtEndDate(p.purchasedEnd)}` : '—'],
        ]} />{p.evidenceId && <Link className="mt-4 inline-flex text-brand underline" to={`/nen-tang/thanh-toan?evidenceId=${p.evidenceId}`}>Xem chứng từ ngân hàng</Link>}</Card>}
    </section>
    <Link className="mt-4 inline-flex font-semibold text-brand underline" to="/nen-tang/thanh-toan">Quay lại danh sách thanh toán</Link>
  </Layout>
}

function EvidenceList({ filters, refresh, selected, choose, preview, changePage, clampPage, reload }: {
  filters: EvidenceReadFilters; refresh: number; selected: number | null; choose: (id: number) => void; preview: (id: number) => void
  changePage: (p: number) => void; clampPage: (p: number) => void; reload: () => void
}) {
  const { data, loading, error } = useReadPage(() => api.evidence(filters), [filters, refresh])
  useEffect(() => {
    if (data && data.page > 0 && data.page >= Math.max(1, Math.ceil(data.total / 20))) clampPage(Math.max(0, Math.ceil(data.total / 20) - 1))
  }, [data])
  if (error) return <ErrorBlock message={userFacingError(error, 'Không tải được chứng từ.')} onRetry={reload} />
  if (!data) return <LoadingBlock />
  return <div aria-busy={loading}>
    <Card>{data.items.length === 0 ? <EmptyBlock title="Không có chứng từ phù hợp" action={<Button onClick={() => changePage(-1)}>Xóa bộ lọc</Button>} /> :
      <Table stack={false}><caption className="sr-only">Chứng từ ngân hàng</caption>
        <thead><tr><Th>Giao dịch</Th><Th>Số tiền / Nội dung</Th><Th>Ngân hàng ghi nhận</Th><Th>Trạng thái / Kết quả khớp</Th></tr></thead>
        <tbody>{data.items.map((e) => <tr key={e.id} className={selected === e.id ? 'bg-[#eef4ef]' : ''}>
          <Td><button type="button" className="font-semibold text-brand underline" aria-current={selected === e.id ? 'true' : undefined} onClick={() => choose(e.id)}>{e.maskedTransactionId}</button></Td>
          <Td>{fmtVnd(e.amount)}<div>{e.content ?? '—'}</div></Td><Td>{fmtSeconds(e.bankPaidAt)}</Td><Td><Badge tone="outline">{REVIEW_TEXT[e.reviewStatus]}</Badge><div>{MATCH_TEXT[e.matchResult]}</div></Td>
        </tr>)}</tbody></Table>}
    </Card>
    {data.total > 0 && <div className="mt-3"><Pagination page={data.page + 1} pageCount={Math.ceil(data.total / 20)} onChange={(p) => changePage(p - 1)} summary={`${data.total} chứng từ`} /></div>}
    {/* Auto-open only after the current page arrives; explicit source links are retained by the parent. */}
    <AutoSelect rows={loading ? [] : data.items} selected={selected} choose={preview} />
  </div>
}

function AutoSelect({ rows, selected, choose }: { rows: EvidenceRow[]; selected: number | null; choose: (id: number) => void }) {
  useEffect(() => { if (selected === null && rows[0]) choose(rows[0].id) }, [rows, selected])
  return null
}

function PaymentList({ filters, refresh, changePage, reload }: { filters: PaymentReadFilters; refresh: number; changePage: (p: number) => void; reload: () => void }) {
  const { data, loading, error } = useReadPage<PaymentRead>(() => api.payments(filters), [filters, refresh])
  useEffect(() => { if (data && data.page > 0 && data.page >= Math.max(1, Math.ceil(data.total / 20))) changePage(Math.max(0, Math.ceil(data.total / 20) - 1)) }, [data])
  if (error) return <ErrorBlock message={userFacingError(error, 'Không tải được yêu cầu thanh toán.')} onRetry={reload} />
  if (!data) return <LoadingBlock />
  return <div aria-busy={loading}><Card>{data.items.length === 0 ? <EmptyBlock title="Không có yêu cầu thanh toán phù hợp" action={<Button onClick={() => changePage(-1)}>Xóa bộ lọc</Button>} /> :
    <Table stack={false}><caption className="sr-only">Yêu cầu thanh toán</caption><thead><tr><Th>Mã / Trại</Th><Th>Kỳ hạn / Số tiền</Th><Th>Tạo lúc / Hết hạn</Th><Th>Trạng thái</Th><Th>Chứng từ</Th></tr></thead>
      <tbody>{data.items.map((p) => <tr key={p.id}><Td><Link className="font-semibold text-brand underline" to={paymentLink(p.id)}>{p.quoteRef}</Link><div>{p.farmName}</div></Td>
        <Td>{p.termYears} năm<div>{fmtVnd(p.amount)}</div></Td><Td>{fmtSeconds(p.requestedAt)}<div>{fmtSeconds(p.expiresAt)}</div></Td><Td><Badge tone="outline">{PAYMENT_STATE_LABEL[p.state]}</Badge></Td>
        <Td>{p.evidenceId ? <Link className="text-brand underline" to={`/nen-tang/thanh-toan?evidenceId=${p.evidenceId}`}>Xem chứng từ</Link> : '—'}</Td></tr>)}</tbody></Table>}</Card>
    {data.total > 0 && <div className="mt-3"><Pagination page={data.page + 1} pageCount={Math.ceil(data.total / 20)} onChange={(p) => changePage(p - 1)} summary={`${data.total} yêu cầu`} /></div>}
  </div>
}

function Workbench({ account }: { account: string }) {
  const [params, setParams] = useSearchParams()
  const key = `beefcare:platform-payments:${account}`
  const [initial] = useState(() => stored(key))
  const [tab, setTab] = useState<Tab>(params.has('evidenceId') ? 'evidence' : initial.tab)
  const [controls, setControls] = useState(initial.evidence)
  const [evidence, setEvidence] = useState(initial.evidence)
  const [payments, setPayments] = useState(initial.payments)
  const [search, setSearch] = useState(initial.payments.q)
  const [selected, setSelected] = useState<number | null>(idOf(params.get('evidenceId')) ?? (params.has('evidenceId') ? -1 : null))
  const [refresh, setRefresh] = useState(0)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const tiles = useQuery(api.tiles, [refresh])
  const rangeError = invalidRange(controls)
  useEffect(() => { if (!rangeError) setEvidence(controls) }, [controls, rangeError])
  useEffect(() => {
    const timer = setTimeout(() => setPayments((old) => old.q === search ? old : { ...old, q: search, page: 0 }), 300)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify({ tab, evidence, payments })) } catch { /* Optional session preference. */ }
  }, [key, tab, evidence, payments])
  useEffect(() => {
    if (params.has('evidenceId')) { setTab('evidence'); setSelected(idOf(params.get('evidenceId')) ?? -1) }
  }, [params])
  const reload = () => setRefresh((v) => v + 1)
  const choose = (id: number) => { setSelected(id); setParams({ evidenceId: String(id) }, { replace: true }) }
  // UC6 commands: show the result once, then reload the evidence, the list and the global counts (no polling).
  const done = (text: string) => { setNotice({ tone: 'ok', text }); reload() }
  const stale = (text: string) => { setNotice({ tone: 'warn', text }); reload() }
  const open = (id: number) => { setTab('evidence'); choose(id); reload() }
  const changeEvidence = (patch: Partial<EvidenceReadFilters>) => {
    const next = { ...controls, page: 0, ...patch }
    setControls(next)
    if (!invalidRange(next)) { setSelected(null); setParams({}, { replace: true }) }
  }
  // A stored page beyond the last page is corrected without dropping an explicit ?evidenceId selection.
  const clampEvidencePage = (page: number) => { setControls((old) => ({ ...old, page })); setEvidence((old) => ({ ...old, page })) }
  const switchTab = (value: string) => { setTab(value as Tab); if (value === 'requests') setParams({}, { replace: true }) }
  return <Layout title={TITLE}>
    <PageHeader title={TITLE} sub="Yêu cầu thanh toán và chứng từ ngân hàng"><Button onClick={reload}>Làm mới</Button></PageHeader>
    {tiles.error ? <ErrorBlock message={userFacingError(tiles.error, 'Không tải được tổng hợp.')} onRetry={tiles.refetch} /> :
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Yêu cầu chờ thanh toán" value={tiles.data?.pendingRequests ?? '—'} note="Còn hiệu lực" />
        <Metric label="Chứng từ cần xem" value={tiles.data?.evidenceToReview ?? '—'} />
        <Metric label="Đang tạm giữ" value={tiles.data?.hold ?? '—'} /><Metric label="Khóa hoàn trả" value={tiles.data?.lockedForReturn ?? '—'} />
      </div>}
    {notice && (notice.tone === 'ok'
      ? <div role="status" aria-label="Kết quả thao tác" className="mb-4"><Note tone="ok">{notice.text}</Note></div>
      : <div role="alert" className="mb-4"><Note tone="warn">{notice.text}</Note></div>)}
    <div className="mb-4"><Segmented value={tab} onChange={switchTab} options={[{ value: 'evidence', label: 'Chứng từ ngân hàng' }, { value: 'requests', label: 'Yêu cầu thanh toán' }]} /></div>
    {tab === 'evidence' ? <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FilterSelect aria-label="Trạng thái xem xét" value={controls.status} onChange={(e) => changeEvidence({ status: e.target.value })}>
          <option value="ALL">Trạng thái: Tất cả</option>{['TO_REVIEW', 'HOLD', 'REJECTED', 'ACCEPTED', 'LOCKED'].map((s) => <option key={s} value={s}>{REVIEW_TEXT[s]}</option>)}
        </FilterSelect>
        <div className="w-[170px]"><label htmlFor="bank-from" className="text-xs text-muted">Ngày ngân hàng từ</label><DateInput id="bank-from" label="Ngày ngân hàng từ" value={controls.bankFrom} onChange={(bankFrom) => changeEvidence({ bankFrom })} /></div>
        <div className="w-[170px]"><label htmlFor="bank-to" className="text-xs text-muted">Ngày ngân hàng đến</label><DateInput id="bank-to" label="Ngày ngân hàng đến" value={controls.bankTo} onChange={(bankTo) => changeEvidence({ bankTo })} />
          {rangeError && <p role="alert" className="mt-1 text-xs text-err-fg">Ngày bắt đầu không được sau ngày kết thúc.</p>}</div>
      </div>
      <SePayLookup onDone={done} onOpen={open} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <EvidenceList filters={evidence} refresh={refresh} selected={selected} choose={choose} preview={setSelected} changePage={(page) => changeEvidence(page < 0 ? EVIDENCE : { page })} clampPage={clampEvidencePage} reload={reload} />
        {params.has('evidenceId') && idOf(params.get('evidenceId')) === null ? <p role="alert">Mã chứng từ không hợp lệ.</p> : selected && <EvidencePanel key={selected} id={selected} refresh={refresh} onDone={done} onStale={stale} />}
      </div>
    </> : <>
      <div className="mb-4 flex flex-wrap gap-3"><input className={`${inputCls} w-[280px] max-w-full`} maxLength={100} aria-label="Tìm mã thanh toán hoặc tên trại" placeholder="Mã thanh toán / tên trại…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <FilterSelect aria-label="Trạng thái thanh toán" value={payments.state} onChange={(e) => setPayments((old) => ({ ...old, state: e.target.value, page: 0 }))}>
          <option value="">Trạng thái: Tất cả</option>{['PENDING', 'PAID', 'EXPIRED'].map((s) => <option key={s} value={s}>{PAYMENT_STATE_LABEL[s as keyof typeof PAYMENT_STATE_LABEL]}</option>)}
        </FilterSelect></div>
      <PaymentList filters={payments} refresh={refresh} changePage={(page) => { if (page < 0) { setSearch(''); setPayments(PAYMENTS) } else setPayments((old) => ({ ...old, page })) }} reload={reload} />
    </>}
    <Foot>Chọn chứng từ để xem nguồn ngân hàng, yêu cầu liên quan, lịch sử và xử lý đối soát. Các số tổng hợp áp dụng toàn hệ thống.</Foot>
  </Layout>
}

export default function PaymentReadPage() {
  const [params] = useSearchParams()
  const session = useSession()
  return params.has('paymentId') ? <PaymentDetail key={params.get('paymentId')} id={idOf(params.get('paymentId'))} /> : <Workbench key={session?.email} account={session?.email ?? ''} />
}
