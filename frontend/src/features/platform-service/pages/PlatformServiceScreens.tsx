import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Badge, Button, Field, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, FixtureNotice, InlineMessage, LoadingState, SummaryStrip, WorkSection } from '../../../components/workspace'
import { DEMO_NOW, addYears, loadOrders, loadPayments, renewalDate, saveOrders, savePaymentIntents, savePayments, type PaymentIntent, type PaymentRecord } from '../../subscription/subscriptionStore'
import {
  loadPaymentIntents, loadPriceVersions, loadReconciliations, loadServicePeriods, loadReconciliationSelection, money, savePriceVersions, savePublishedPrice, saveReconciliations, saveReconciliationSelection, saveServicePeriods,
  type PaymentReconciliation, type PriceVersionRecord, type ReconciliationStatus, type ServicePeriod,
} from '../platformServiceStore'
import { previewServiceCoverage, type ServiceCoveragePreviewRow } from '../data/platformServicePreviewData'

const PM_ONLY: ScreenRole[] = ['pm']
const statusTone = (value: string) => value === 'EFFECTIVE' || value === 'CURRENT' || value === 'ACCEPTED' || value === 'PAID' || value === 'ACTIVE' ? 'ok' as const : value === 'REJECTED' || value === 'SUSPENDED' || value === 'SUPERSEDED' || value === 'WITHDRAWN' ? 'err' as const : 'warn' as const
const statusText: Record<string, string> = { CURRENT: 'Đang hiệu lực', FUTURE: 'Sắp hiệu lực', PAST: 'Đã kết thúc', NONE: 'Chưa có kỳ', ACTIVE: 'Đang hoạt động', PENDING_PAYMENT: 'Chờ thanh toán', EXPIRED: 'Hết hạn', SUSPENDED: 'Tạm ngừng', PENDING: 'Chờ đối soát', ACCEPTED: 'Đã chấp nhận', HOLD: 'Giữ xử lý', REJECTED: 'Từ chối', SCHEDULED: 'Đã lên lịch', EFFECTIVE: 'Đang áp dụng', SUPERSEDED: 'Đã thay thế', WITHDRAWN: 'Đã rút', PAID: 'Đã thanh toán' }
const directionText: Record<string, string> = { INBOUND: 'Tiền vào', OUTBOUND: 'Tiền ra' }
const matchText: Record<string, string> = { MATCHED: 'Khớp', UNMATCHED: 'Chưa khớp', PARTIAL: 'Khớp một phần' }
const auditActionText: Record<string, string> = { ACCEPTED: 'Chấp nhận', HOLD: 'Giữ xử lý', REJECTED: 'Từ chối', LOCKED: 'Khóa', UNLOCKED: 'Mở khóa', RETURN_RECORDED: 'Ghi nhận hoàn tiền' }

function dateText(value?: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed)
}
function displayStatus(value?: string) { return value ? statusText[value] ?? value : '—' }
function displayActor(value?: string) { return value === 'PM demo' ? 'Quản lý nền tảng' : value ?? '—' }
function displaySource(value?: string) { return value?.replace(/subscription/gi, 'giá dịch vụ') ?? '—' }
function dateOnly(value?: string) { return value?.slice(0, 10) ?? '' }
function localToIso(value: string) { return value ? new Date(`${value}:00+07:00`).toISOString() : '' }
function isoToLocal(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)).replace(' ', 'T')
}
function versionNumber(version?: string) { return Number(version?.replace(/^v/, '') || 0) }
function effectiveVersion(versions: PriceVersionRecord[]) {
  const active = versions.filter((version) => version.status === 'EFFECTIVE' || version.status === 'SCHEDULED')
  const now = new Date(DEMO_NOW).getTime()
  return active.filter((version) => new Date(version.effectiveAt).getTime() <= now).sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))[0] ?? active[0]
}

function PlatformHeader({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) {
  return <PageHeader title={title} sub={sub} badge={<FixtureNotice />}>{actions}</PageHeader>
}

function FarmCoverage({ periods }: { periods: ServicePeriod[] }): ServiceCoveragePreviewRow[] {
  const farms = loadOrders()
  const owners: Record<string, string> = { 'farm-ba-vi': 'Nguyễn Văn Hùng', 'farm-moc-chau': 'Hoàng Thu Hà', 'farm-yen-bai': 'Chưa gán' }
  return farms.map((farm) => {
    const farmPeriods = periods.filter((period) => period.farmId === farm.id)
    const current = farmPeriods.find((period) => period.status === 'CURRENT')
    const future = farmPeriods.find((period) => period.status === 'FUTURE')
    const selected = current ?? future
    const latest = [...farmPeriods].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))[0]
    return { farm, owner: owners[farm.id] ?? 'Chưa gán', code: `SUB-${farm.id.toUpperCase()}`, current, future, selected, latest, renewalOpen: renewalDate(farm.confirmedEnd), coverage: selected ? selected.status : 'NONE', periods: farmPeriods }
  })
}

function Subscription90({ state }: { state: ReviewState }) {
  const navigate = useNavigate()
  const [periods] = useState(() => loadServicePeriods())
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [serviceStatus, setServiceStatus] = useState('ALL')
  const [suspension, setSuspension] = useState<'ALL' | 'SUSPENDED' | 'NOT_SUSPENDED'>('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<'farm' | 'end'>('farm')
  const [selectedId, setSelectedId] = useState<string>()
  const baseRows = useMemo(() => FarmCoverage({ periods }), [periods])
  const rows = useMemo(() => previewServiceCoverage(baseRows).filter((row) => {
    const term = `${row.code} ${row.farm.name} ${row.owner} ${row.selected?.planVersion ?? ''} ${statusText[row.farm.status] ?? row.farm.status} ${row.farm.confirmedEnd ?? ''} ${row.renewalOpen ?? ''} ${row.latest?.paymentCode ?? ''}`.toLowerCase()
    const start = row.current?.start ?? row.future?.start
    const end = row.current?.end ?? row.future?.end
    return (!query || term.includes(query.toLowerCase())) && (status === 'ALL' || row.coverage === status) && (serviceStatus === 'ALL' || row.farm.status === serviceStatus) && (suspension === 'ALL' || (suspension === 'SUSPENDED' ? Boolean(row.farm.suspendedSince) : !row.farm.suspendedSince)) && (!from || (end ?? '') >= from) && (!to || (start ?? '') <= to)
  }).sort((a, b) => sort === 'farm' ? a.farm.name.localeCompare(b.farm.name) : (b.selected?.end ?? '').localeCompare(a.selected?.end ?? '')), [baseRows, query, status, serviceStatus, suspension, from, to, sort])
  if (state === 'loading') return <LoadingState label="Đang tải sổ đăng ký dịch vụ…" rows={7} />
  if (state === 'error') return <InlineMessage tone="err" title="Không thể tải sổ đăng ký">Không đọc được kỳ dịch vụ; hãy thử lại để tránh xem nhầm thời hạn.</InlineMessage>
  if (state === 'empty') return <EmptyState title="Chưa có dữ liệu dịch vụ" description="Không có trang trại hoặc kỳ dịch vụ để hiển thị." />
  const selected = baseRows.find((row) => row.farm.id === selectedId) ?? baseRows[0]
  const openSource = (period: ServicePeriod) => {
    // A service period links to a payment request. Evidence has a separate id,
    // so let SCR-91 resolve it from the stable payment link.
    saveReconciliationSelection({ paymentId: period.sourcePaymentId, evidenceId: undefined })
    navigate('/ui/scr-91')
  }
  return <div className="min-w-0"><PlatformHeader title="Quản lý đăng ký dịch vụ" sub="Quản lý nền tảng theo dõi thời hạn dịch vụ và nguồn thanh toán của từng trang trại." /><WorkSection title="Bộ lọc thời hạn"><FilterBar actions={<Button onClick={() => { setQuery(''); setStatus('ALL'); setServiceStatus('ALL'); setSuspension('ALL'); setFrom(''); setTo(''); setSort('farm') }}>Đặt lại</Button>}><input className={`${inputCls} min-w-52 flex-1`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm trại, mã đăng ký, trạng thái hoặc mã thanh toán" aria-label="Tìm đăng ký dịch vụ" /><select className={`${inputCls} w-44`} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Trạng thái thời hạn"><option value="ALL">Tất cả</option><option value="CURRENT">Đang hiệu lực</option><option value="FUTURE">Sắp hiệu lực</option><option value="NONE">Chưa có kỳ</option></select><select className={`${inputCls} w-44`} value={serviceStatus} onChange={(event) => setServiceStatus(event.target.value)} aria-label="Trạng thái dịch vụ"><option value="ALL">Tất cả dịch vụ</option><option value="ACTIVE">Đang hoạt động</option><option value="PENDING_PAYMENT">Chờ thanh toán</option><option value="SUSPENDED">Tạm ngừng</option><option value="EXPIRED">Hết hạn</option></select><select className={`${inputCls} w-40`} value={suspension} onChange={(event) => setSuspension(event.target.value as 'ALL' | 'SUSPENDED' | 'NOT_SUSPENDED')} aria-label="Bộ lọc tạm ngừng"><option value="ALL">Tất cả tạm ngừng</option><option value="SUSPENDED">Đang tạm ngừng</option><option value="NOT_SUSPENDED">Không tạm ngừng</option></select><Field label="Thời hạn từ"><input className={inputCls} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="Thời hạn đến"><input className={inputCls} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field><select className={`${inputCls} w-40`} value={sort} onChange={(event) => setSort(event.target.value as 'farm' | 'end')} aria-label="Sắp xếp"><option value="farm">Tên trại</option><option value="end">Ngày hết hạn</option></select></FilterBar>{rows.length === 0 ? <EmptyState compact title="Không có trang trại phù hợp" description="Đổi trạng thái hoặc khoảng thời hạn để xem lại." /> : <Table wide scroll><thead><tr><Th>Mã đăng ký</Th><Th>Trang trại</Th><Th>Chủ trại</Th><Th>Dịch vụ</Th><Th>Gói / phiên bản</Th><Th>Đã xác nhận đến</Th><Th>Mở gia hạn</Th><Th>Mua gần nhất</Th><Th>Thời hạn</Th><Th /></tr></thead><tbody>{rows.map((row) => { const generated = Boolean(row.__stressGenerated); return <tr key={row.farm.id} className={selected?.farm.id === row.farm.id ? 'bg-page' : undefined}><Td>{row.code}</Td><Td><strong>{row.farm.name}</strong></Td><Td>{row.owner}</Td><Td>{statusText[row.farm.status] ?? row.farm.status}</Td><Td>{row.selected?.planVersion ?? '—'}</Td><Td>{row.farm.confirmedEnd ?? '—'}</Td><Td>{row.renewalOpen ?? '—'}</Td><Td>{row.latest?.paymentCode ? `${row.latest.paymentCode} · ${dateText(row.latest.confirmedAt)}` : '—'}</Td><Td><Badge tone={statusTone(row.coverage)}>{statusText[row.coverage]}</Badge></Td><Td><Button small disabled={generated} onClick={() => setSelectedId(row.farm.id)}>{generated ? 'Mô phỏng' : 'Chi tiết'}</Button></Td></tr> })}</tbody></Table>}</WorkSection>{selected && <WorkSection title={`Chi tiết ${selected.farm.name}`} actions={<Button onClick={() => navigate('/ui/scr-91')}>Mở đối soát</Button>}><dl className="m-0 grid gap-4 border-y border-rule py-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-subtle">Trạng thái dịch vụ</dt><dd className="m-0 mt-1">{statusText[selected.farm.status] ?? selected.farm.status}</dd></div><div><dt className="text-xs text-subtle">Mã đăng ký</dt><dd className="m-0 mt-1">{selected.code}</dd></div><div><dt className="text-xs text-subtle">Xác nhận đến</dt><dd className="m-0 mt-1">{selected.farm.confirmedEnd ?? '—'}</dd></div><div><dt className="text-xs text-subtle">Mở gia hạn</dt><dd className="m-0 mt-1">{selected.renewalOpen ?? '—'}</dd></div></dl><Table wide scroll><thead><tr><Th>Kỳ</Th><Th>Gói</Th><Th>Giá</Th><Th>Nguồn thanh toán</Th><Th>Xác nhận</Th></tr></thead><tbody>{selected.periods.length ? selected.periods.map((period) => <tr key={period.id}><Td>{period.start} → {period.end}</Td><Td>{period.planVersion}</Td><Td>{money(period.amount)}</Td><Td>{period.sourcePaymentCode ?? '—'}{period.sourcePaymentId && <Button small className="ml-2" onClick={() => openSource(period)}>Mở chứng từ/thanh toán</Button>}</Td><Td>{dateText(period.confirmedAt)}</Td></tr>) : <tr><Td colSpan={5}>Chưa có kỳ đã mua.</Td></tr>}</tbody></Table></WorkSection>}</div>
}

function Reconciliation91({ state, readOnly }: { state: ReviewState; readOnly: boolean }) {
  const [records, setRecords] = useState(() => loadReconciliations())
  const [intents, setIntents] = useState<PaymentIntent[]>(() => loadPaymentIntents())
  const [payments, setPayments] = useState<PaymentRecord[]>(() => loadPayments())
  const selection = useMemo(() => {
    const saved = loadReconciliationSelection()
    if (typeof window === 'undefined') return saved
    const params = new URLSearchParams(window.location.search)
    return { paymentId: params.get('paymentId') ?? saved.paymentId, evidenceId: params.get('evidenceId') ?? saved.evidenceId }
  }, [])
  const [tab, setTab] = useState<'evidence' | 'requests'>('evidence')
  const [status, setStatus] = useState<'ALL' | ReconciliationStatus | 'LOCKED'>('ALL')
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [candidateId, setCandidateId] = useState('')
  const [reason, setReason] = useState('')
  const [evidenceRefs, setEvidenceRefs] = useState('')
  const [lockReason, setLockReason] = useState('')
  const [returnReference, setReturnReference] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [returnResult, setReturnResult] = useState('')
  const [error, setError] = useState('')
  const visible = records.filter((record) => (!query || `${record.bankReference} ${record.farmName} ${record.transferContent}`.toLowerCase().includes(query.toLowerCase())) && (status === 'ALL' || (status === 'LOCKED' ? record.locked : record.status === status)) && (!from || dateOnly(record.bankPaidAt ?? record.receivedAt) >= from) && (!to || dateOnly(record.bankPaidAt ?? record.receivedAt) <= to))
  const selected = visible.find((record) => record.id === selectedId) ?? visible.find((record) => record.paymentIntentId === selection.paymentId || record.bankReference === selection.evidenceId || record.id === selection.evidenceId) ?? visible[0]
  const candidates = intents.filter((intent) => intent.farmId === selected?.farmId)
  const totals = { pending: records.filter((record) => record.status === 'PENDING').length, hold: records.filter((record) => record.status === 'HOLD').length, accepted: records.filter((record) => record.status === 'ACCEPTED').length, rejected: records.filter((record) => record.status === 'REJECTED').length, locked: records.filter((record) => record.locked).length }
  useEffect(() => { if (selected) { setSelectedId(selected.id); setCandidateId(selected.candidatePaymentId ?? selection.paymentId ?? ''); setReason(selected.decisionReason ?? ''); setEvidenceRefs(selected.evidenceRefs.join(', ')); setReturnReference(selected.returnReference ?? ''); setReturnDate(selected.returnDate ? dateOnly(selected.returnDate) : ''); setReturnResult(selected.returnResult ?? '') } }, [selected?.id])
  if (state === 'loading') return <LoadingState label="Đang tải hàng đợi đối soát…" rows={7} />
  if (state === 'error') return <InlineMessage tone="err" title="Không thể tải đối soát">Bằng chứng và quyết định chưa sẵn sàng.</InlineMessage>
  if (state === 'empty') return <EmptyState title="Hàng đợi trống" description="Chưa có giao dịch hoặc bằng chứng cần PM xử lý." />
  const setSelected = (record: PaymentReconciliation) => { setSelectedId(record.id); setCandidateId(record.candidatePaymentId ?? ''); setReason(record.decisionReason ?? ''); setEvidenceRefs(record.evidenceRefs.join(', ')); setReturnReference(record.returnReference ?? ''); setReturnDate(record.returnDate ? dateOnly(record.returnDate) : ''); setReturnResult(record.returnResult ?? ''); setError('') }
  const decide = (decision: ReconciliationStatus) => {
    if (!selected || selected.locked || selected.decidedAt || readOnly) return
    const refs = evidenceRefs.split(',').map((value) => value.trim()).filter(Boolean)
    if (decision === 'ACCEPTED' && (!candidateId || refs.length === 0)) { setError('Chấp nhận cần chọn yêu cầu thanh toán và ít nhất một mã chứng từ.'); return }
    if (!reason.trim()) { setError('Mọi quyết định chấp nhận, giữ xử lý hoặc từ chối đều cần nhập lý do.'); return }
    if (decision === 'ACCEPTED' && selected.direction !== 'INBOUND') { setError('Chỉ giao dịch tiền vào mới được chấp nhận.'); return }
    const candidate = intents.find((intent) => intent.id === candidateId)
    const linkedPayment = payments.find((payment) => payment.paymentIntentId === candidateId)
    const amountMatches = Boolean(candidate && Math.abs(candidate.amount - selected.amount) < 0.01)
    const accountMatches = Boolean(candidate && (selected.receivingAccountNumber ?? selected.receivingAccount).includes(candidate.receivingAccountNumber))
    const allocationAvailable = Boolean(candidate && candidate.status === 'PENDING' && !linkedPayment)
    const bankPaidAt = selected.bankPaidAt
    const withinWindow = Boolean(candidate && bankPaidAt && new Date(bankPaidAt).getTime() >= new Date(candidate.createdAt).getTime() && new Date(bankPaidAt).getTime() < new Date(candidate.expiresAt).getTime())
    if (decision === 'ACCEPTED' && (!amountMatches || !accountMatches || !allocationAvailable || !withinWindow)) {
      const problems = [
        !amountMatches && 'số tiền không khớp',
        !accountMatches && 'tài khoản nhận không khớp',
        !withinWindow && 'thời điểm chuyển tiền nằm ngoài thời hạn yêu cầu',
        !allocationAvailable && 'yêu cầu thanh toán đã được sử dụng',
      ].filter(Boolean)
      setError(`Không thể chấp nhận vì ${problems.join('; ')}.`)
      return
    }
    const now = new Date(DEMO_NOW).toISOString(); const terminal = decision === 'ACCEPTED'; const next = records.map((record) => record.id === selected.id ? { ...record, status: decision, locked: terminal, candidatePaymentId: candidateId || undefined, evidenceRefs: refs, matchResult: decision === 'ACCEPTED' ? 'MATCHED' : record.matchResult, decisionReason: reason.trim() || undefined, decidedAt: terminal ? now : undefined, decidedBy: terminal ? 'Quản lý nền tảng' : undefined, history: [...record.history, { at: now, action: decision, actor: 'Quản lý nền tảng', reason: reason.trim() || undefined, evidenceRefs: refs }] } : record)
    if (!saveReconciliations(next)) { setError('Không thể lưu quyết định đối soát. Vui lòng thử lại.'); return }
    setRecords(next); setError('')
    if (decision !== 'ACCEPTED' || !candidate) return
    const nextIntent: PaymentIntent = { ...candidate, status: 'PAID', bankPaidAt: candidate.bankPaidAt ?? selected.bankPaidAt, receivedAt: candidate.receivedAt ?? selected.receivedAt, confirmedAt: now }
    const nextIntents = intents.map((intent) => intent.id === candidate.id ? nextIntent : intent)
    if (!savePaymentIntents(nextIntents)) { setError('Không thể cập nhật yêu cầu thanh toán; chưa tạo kỳ dịch vụ.'); return }
    setIntents(nextIntents)
    const nextPayment: PaymentRecord = { id: `payment-${candidate.id}`, paymentIntentId: candidate.id, code: candidate.code, farmId: candidate.farmId, amount: candidate.amount, bankPaidAt: nextIntent.bankPaidAt ?? selected.receivedAt, receivedAt: nextIntent.receivedAt ?? selected.receivedAt, confirmedAt: now, status: 'CONFIRMED' }
    const nextPayments = [...payments.filter((payment) => payment.paymentIntentId !== candidate.id), nextPayment]
    if (!savePayments(nextPayments)) { setError('Không thể lưu bản ghi thanh toán; chưa tạo kỳ dịch vụ.'); return }
    setPayments(nextPayments)
    const farms = loadOrders(); const farm = farms.find((entry) => entry.id === candidate.farmId); if (!farm) return
    const allPeriods = loadServicePeriods().filter((period) => period.id !== `period-${candidate.id}`); const current = allPeriods.find((period) => period.farmId === farm.id && period.status === 'CURRENT'); const start = current?.end && current.end > dateOnly(now) ? current.end : dateOnly(now); const end = addYears(start, candidate.termYears); const purchased = { id: `period-${candidate.id}`, farmId: farm.id, start, end, termYears: candidate.termYears, amount: candidate.amount, paymentCode: candidate.code, status: current && current.end > dateOnly(now) ? 'FUTURE' as const : 'CURRENT' as const, confirmedAt: now, farmName: farm.name, planVersion: candidate.priceVersion, sourcePaymentId: candidate.id, sourcePaymentCode: candidate.code }
    const servicePeriods = [...allPeriods, purchased]
    const earlyRenewal = purchased.status === 'FUTURE'
    const nextOrders = farms.map((entry) => entry.id === farm.id ? { ...entry, status: earlyRenewal || entry.status === 'SUSPENDED' ? entry.status : 'ACTIVE', currentStart: earlyRenewal ? entry.currentStart : start, currentEnd: earlyRenewal ? entry.currentEnd : end, confirmedEnd: earlyRenewal ? entry.confirmedEnd : end, pendingRequestCode: undefined, periods: [...entry.periods.filter((period) => period.id !== purchased.id), purchased] } : entry)
    if (!saveServicePeriods(servicePeriods) || !saveOrders(nextOrders)) { setError('Không thể lưu kỳ dịch vụ hoặc trạng thái trang trại. Vui lòng thử lại.'); return }
  }
  const toggleLock = () => {
    if (!selected || readOnly || lockReason.trim().length < 5) { setError('Khóa hoặc mở khóa cần lý do tối thiểu 5 ký tự.'); return }
    const now = new Date(DEMO_NOW).toISOString(); const action = selected.locked ? 'UNLOCKED' : 'LOCKED'; const next = records.map((record) => record.id === selected.id ? { ...record, locked: !record.locked, history: [...record.history, { at: now, action, actor: 'Quản lý nền tảng', reason: lockReason.trim() }] } : record); if (!saveReconciliations(next)) { setError('Không thể cập nhật trạng thái khóa. Vui lòng thử lại.'); return } setRecords(next); setLockReason(''); setError('')
  }
  const recordReturn = () => {
    if (!selected || readOnly || (selected.status !== 'HOLD' && selected.status !== 'REJECTED') || !returnReference.trim() || !returnDate || !returnResult.trim()) { setError('Chỉ ghi nhận hoàn tiền cho giao dịch đang giữ xử lý hoặc đã từ chối; cần mã giao dịch ngân hàng, ngày hoàn và kết quả.'); return }
    const now = new Date(DEMO_NOW).toISOString(); const returnedAt = new Date(`${returnDate}T00:00:00+07:00`).toISOString(); const next = records.map((record) => record.id === selected.id ? { ...record, returnReference: returnReference.trim(), returnDate: returnedAt, returnResult: returnResult.trim(), history: [...record.history, { at: now, action: 'RETURN_RECORDED', actor: 'Quản lý nền tảng', reason: returnResult.trim(), evidenceRefs: [returnReference.trim()] }] } : record); if (!saveReconciliations(next)) { setError('Không thể lưu thông tin hoàn tiền. Vui lòng thử lại.'); return } setRecords(next); setError('')
  }
  return <div className="min-w-0"><PlatformHeader title="Thanh toán và đối soát" sub="Quản lý nền tảng đối chiếu chứng từ với yêu cầu thanh toán và lưu lịch sử xử lý." /><SummaryStrip items={[{ label: 'Chờ xử lý', value: totals.pending }, { label: 'Giữ xử lý', value: totals.hold }, { label: 'Đã chấp nhận', value: totals.accepted }, { label: 'Từ chối', value: totals.rejected }, { label: 'Đã khóa', value: totals.locked }]} /><WorkSection title="Hàng đợi"><div className="mb-4 flex flex-wrap gap-2 border-b border-rule pb-3"><Button variant={tab === 'evidence' ? 'primary' : 'default'} onClick={() => setTab('evidence')}>Chứng từ</Button><Button variant={tab === 'requests' ? 'primary' : 'default'} onClick={() => setTab('requests')}>Yêu cầu thanh toán</Button></div><FilterBar><input className={`${inputCls} min-w-52 flex-1`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã giao dịch / trang trại / nội dung chuyển khoản" aria-label="Tìm đối soát" /><select className={`${inputCls} w-40`} value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | ReconciliationStatus | 'LOCKED')} aria-label="Lọc trạng thái"><option value="ALL">Tất cả</option><option value="PENDING">Chờ đối soát</option><option value="HOLD">Giữ xử lý</option><option value="ACCEPTED">Đã chấp nhận</option><option value="REJECTED">Từ chối</option><option value="LOCKED">Đã khóa</option></select><Field label="Ngày ngân hàng từ"><input className={inputCls} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="Đến ngày"><input className={inputCls} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field></FilterBar>{tab === 'requests' ? <Table wide scroll><thead><tr><Th>Mã</Th><Th>Trang trại</Th><Th>Số tiền</Th><Th>Trạng thái</Th><Th>Hết hạn</Th><Th>Ngân hàng</Th></tr></thead><tbody>{intents.filter((intent) => !query || `${intent.code} ${intent.farmName}`.toLowerCase().includes(query.toLowerCase())).map((intent) => { const payment = payments.find((record) => record.paymentIntentId === intent.id); return <tr key={intent.id}><Td>{intent.code}</Td><Td>{intent.farmName}</Td><Td>{money(intent.amount)}</Td><Td><Badge tone={statusTone(intent.status)}>{displayStatus(intent.status)}</Badge></Td><Td>{dateText(intent.expiresAt)}</Td><Td>{payment ? `${dateText(payment.receivedAt)}` : 'Chưa nhận'}</Td></tr> })}</tbody></Table> : visible.length === 0 ? <EmptyState compact title="Không có bằng chứng phù hợp" description="Đổi bộ lọc để xem lại hàng đợi." /> : <Table wide scroll><thead><tr><Th>Mã giao dịch ngân hàng</Th><Th>Trang trại</Th><Th>Số tiền</Th><Th>Nhận lúc</Th><Th>Chứng từ</Th><Th>Trạng thái</Th><Th /></tr></thead><tbody>{visible.map((record) => <tr key={record.id} className={selected?.id === record.id ? 'bg-page' : undefined}><Td>{record.bankReference}</Td><Td>{record.farmName}</Td><Td>{money(record.amount)}</Td><Td>{dateText(record.receivedAt)}</Td><Td>{record.evidenceRefs.join(', ') || '—'}</Td><Td><Badge tone={statusTone(record.status)}>{statusText[record.status]}</Badge></Td><Td><Button small onClick={() => { setSelected(record); saveReconciliationSelection({ paymentId: record.paymentIntentId, evidenceId: record.bankReference }) }}>Mở</Button></Td></tr>)}</tbody></Table>}</WorkSection>{selected && tab === 'evidence' && <WorkSection title={`Xử lý ${selected.bankReference}`} actions={<Button disabled={readOnly || selected.status === 'ACCEPTED'} onClick={toggleLock}>{selected.locked ? 'Mở khóa' : 'Khóa'}</Button>}><dl className="m-0 grid gap-4 border-y border-rule py-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-subtle">Trạng thái</dt><dd className="m-0 mt-1"><Badge tone={statusTone(selected.status)}>{statusText[selected.status]}</Badge></dd></div><div><dt className="text-xs text-subtle">Ngân hàng/nhà cung cấp</dt><dd className="m-0 mt-1">{selected.provider}</dd></div><div><dt className="text-xs text-subtle">Môi trường</dt><dd className="m-0 mt-1">{selected.environment}</dd></div><div><dt className="text-xs text-subtle">Phạm vi hệ thống</dt><dd className="m-0 mt-1">{selected.namespace}</dd></div><div><dt className="text-xs text-subtle">Chiều giao dịch</dt><dd className="m-0 mt-1">{directionText[selected.direction] ?? selected.direction}</dd></div><div><dt className="text-xs text-subtle">Tài khoản nhận</dt><dd className="m-0 mt-1">{selected.receivingAccount}</dd></div><div><dt className="text-xs text-subtle">Nội dung chuyển khoản</dt><dd className="m-0 mt-1">{selected.transferContent}</dd></div><div><dt className="text-xs text-subtle">Kết quả đối chiếu</dt><dd className="m-0 mt-1">{matchText[selected.matchResult] ?? selected.matchResult}</dd></div><div><dt className="text-xs text-subtle">Trang trại</dt><dd className="m-0 mt-1">{selected.farmName}</dd></div><div><dt className="text-xs text-subtle">Ngân hàng trả lúc</dt><dd className="m-0 mt-1">{dateText(selected.bankPaidAt)}</dd></div><div><dt className="text-xs text-subtle">Nhận lúc</dt><dd className="m-0 mt-1">{dateText(selected.receivedAt)}</dd></div><div><dt className="text-xs text-subtle">Khóa</dt><dd className="m-0 mt-1">{selected.locked ? 'Đã khóa' : 'Đang mở'}</dd></div></dl><div className="grid gap-4 md:grid-cols-2"><Field label="Giao dịch ứng viên"><div className="grid gap-2">{candidates.length ? candidates.map((intent) => <label key={intent.id} className="flex items-center gap-2 text-sm"><input type="radio" name="candidate-payment" disabled={readOnly || selected.locked || Boolean(selected.decidedAt)} checked={candidateId === intent.id} onChange={() => setCandidateId(intent.id)} />{intent.code} · {money(intent.amount)} · {displayStatus(intent.status)}</label>) : <span className="text-xs text-subtle">Không có yêu cầu thanh toán cùng trang trại.</span>}</div></Field><Field label="Mã chứng từ (phân tách bằng dấu phẩy)"><input className={inputCls} value={evidenceRefs} disabled={readOnly || selected.locked || Boolean(selected.decidedAt)} onChange={(event) => setEvidenceRefs(event.target.value)} /></Field><Field label="Lý do quyết định *"><textarea className={`${inputCls} min-h-24`} value={reason} disabled={readOnly || selected.locked || Boolean(selected.decidedAt)} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></Field><Field label="Lý do khóa/mở khóa *"><input className={inputCls} value={lockReason} disabled={readOnly} onChange={(event) => setLockReason(event.target.value)} maxLength={500} /></Field><Field label="Mã giao dịch hoàn tiền"><input className={inputCls} value={returnReference} disabled={readOnly || (selected.status !== 'HOLD' && selected.status !== 'REJECTED') || Boolean(selected.returnReference)} onChange={(event) => setReturnReference(event.target.value)} /></Field><Field label="Ngày hoàn tiền"><input className={inputCls} type="date" value={returnDate} disabled={readOnly || (selected.status !== 'HOLD' && selected.status !== 'REJECTED') || Boolean(selected.returnReference)} onChange={(event) => setReturnDate(event.target.value)} /></Field><Field label="Kết quả hoàn tiền"><input className={inputCls} value={returnResult} disabled={readOnly || (selected.status !== 'HOLD' && selected.status !== 'REJECTED') || Boolean(selected.returnReference)} onChange={(event) => setReturnResult(event.target.value)} /></Field></div>{error && <InlineMessage tone="err" className="mt-4" title="Chưa thể quyết định">{error}</InlineMessage>}<div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-rule pt-4"><Button variant="primary" disabled={readOnly || selected.locked || Boolean(selected.decidedAt)} onClick={() => decide('ACCEPTED')}>Chấp nhận</Button><Button disabled={readOnly || selected.locked || Boolean(selected.decidedAt)} onClick={() => decide('HOLD')}>Giữ xử lý</Button><Button variant="danger" disabled={readOnly || selected.locked || Boolean(selected.decidedAt)} onClick={() => decide('REJECTED')}>Từ chối</Button>{(selected.status === 'HOLD' || selected.status === 'REJECTED') && <Button disabled={readOnly || Boolean(selected.returnReference)} onClick={recordReturn}>Ghi nhận hoàn tiền</Button>}</div><h3 className="mt-6 mb-2 text-sm font-semibold">Lịch sử xử lý</h3><Table><thead><tr><Th>Thời điểm</Th><Th>Hành động</Th><Th>Người xử lý</Th><Th>Lý do / chứng từ</Th></tr></thead><tbody>{selected.history.map((entry, index) => <tr key={`${entry.at}-${index}`}><Td>{dateText(entry.at)}</Td><Td>{auditActionText[entry.action] ?? entry.action}</Td><Td>{entry.actor}</Td><Td>{entry.reason ?? '—'}{entry.evidenceRefs?.length ? ` · ${entry.evidenceRefs.join(', ')}` : ''}</Td></tr>)}</tbody></Table></WorkSection>}</div>
}

function Subscription92({ state, readOnly }: { state: ReviewState; readOnly: boolean }) {
  const [versions, setVersions] = useState(() => loadPriceVersions())
  const current = effectiveVersion(versions)
  const [mode, setMode] = useState<'NOW' | 'SCHEDULED'>(current?.effectiveMode ?? 'NOW')
  const [effectiveAt, setEffectiveAt] = useState(isoToLocal(current?.effectiveAt))
  const [prices, setPrices] = useState<Record<1 | 2 | 3, string>>({ 1: String(current?.prices[1] ?? ''), 2: String(current?.prices[2] ?? ''), 3: String(current?.prices[3] ?? '') })
  const [terms, setTerms] = useState(current?.terms ?? '')
  const [sourceNote, setSourceNote] = useState(displaySource(current?.sourceNote) === '—' ? '' : displaySource(current?.sourceNote))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [withdrawId, setWithdrawId] = useState('')
  const [withdrawReason, setWithdrawReason] = useState('')
  if (state === 'loading') return <LoadingState label="Đang tải bảng giá phiên bản…" rows={7} />
  if (state === 'error') return <InlineMessage tone="err" title="Không thể tải bảng giá">Không đọc được phiên bản hiện hành.</InlineMessage>
  if (state === 'empty' || !current) return <EmptyState title="Chưa có bảng giá" description="Tạo phiên bản đầu tiên để dịch vụ có giá hiệu lực." />
  const publish = (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice('')
    const latest = effectiveVersion(loadPriceVersions())
    if (latest?.version !== current.version) { setError('Bảng giá đã thay đổi ở phiên làm việc khác; hãy tải lại trước khi công bố.'); return }
    const parsed = [prices[1], prices[2], prices[3]].map(Number)
    if (parsed.some((value) => !Number.isInteger(value) || value < 1000 || value > 1000000000)) { setError('Mỗi giá 1/2/3 năm phải là số nguyên từ 1.000 đến 1.000.000.000 VND.'); return }
    if (!terms.trim() || terms.length > 500 || !sourceNote.trim() || sourceNote.length > 500) { setError('Điều khoản và nguồn/ghi chú là bắt buộc, tối đa 500 ký tự.'); return }
    const isoEffective = mode === 'NOW' ? new Date().toISOString() : localToIso(effectiveAt)
    if (!isoEffective || Number.isNaN(new Date(isoEffective).getTime()) || (mode === 'SCHEDULED' && new Date(isoEffective).getTime() <= new Date(DEMO_NOW).getTime())) { setError('Ngày giờ hiệu lực HCM phải hợp lệ và nằm trong tương lai khi chọn lên lịch.'); return }
    if (versions.some((version) => version.effectiveAt === isoEffective && version.status !== 'SUPERSEDED' && version.status !== 'WITHDRAWN')) { setError('Đã có phiên bản cùng thời điểm hiệu lực; chọn thời điểm khác.'); return }
    const next: PriceVersionRecord = { id: `price-${Date.now()}`, version: `v${Math.max(...versions.map((version) => versionNumber(version.version))) + 1}`, packageName: current.packageName, terms: terms.trim(), effectiveMode: mode, sourceNote: sourceNote.trim(), status: mode === 'NOW' ? 'EFFECTIVE' : 'SCHEDULED', publishedAt: new Date().toISOString(), effectiveFrom: isoEffective.slice(0, 10), effectiveAt: isoEffective, publishedBy: 'Quản lý nền tảng', prices: { 1: parsed[0], 2: parsed[1], 3: parsed[2] } }
    if (!savePublishedPrice(next)) { setError('Không thể lưu phiên bản bảng giá; chưa có thay đổi nào được ghi.'); return }
    setVersions(loadPriceVersions()); setNotice(`Đã công bố ${next.version}; phiên bản cũ vẫn được giữ trong lịch sử.`)
  }
  const withdraw = () => {
    if (readOnly || !withdrawId || withdrawReason.trim().length < 10) { setError('Chọn phiên bản và nhập lý do rút tối thiểu 10 ký tự.'); return }
    const target = versions.find((version) => version.id === withdrawId)
    if (!target || target.status !== 'SCHEDULED') { setError('Chỉ được rút phiên bản đã lên lịch.'); return }
    const now = new Date().toISOString(); const next = versions.map((version) => version.id === withdrawId ? { ...version, status: 'WITHDRAWN' as const, withdrawnAt: now, withdrawnReason: withdrawReason.trim() } : version); if (!savePriceVersions(next)) { setError('Không thể rút phiên bản bảng giá; chưa có thay đổi nào được ghi.'); return } setVersions(loadPriceVersions()); setWithdrawReason(''); setWithdrawId(''); setError(''); setNotice('Đã rút phiên bản dự kiến áp dụng và giữ lại toàn bộ lịch sử thay đổi.')
  }
  return <div className="min-w-0"><PlatformHeader title="Bảng giá gói dịch vụ" sub="Quản lý nền tảng công bố bảng giá, giữ lịch sử thay đổi và kiểm soát xung đột." /><WorkSection title="Phiên bản hiện hành"><dl className="m-0 grid gap-4 border-y border-rule py-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-subtle">Phiên bản</dt><dd className="m-0 mt-1 font-semibold">{current.version}</dd></div><div><dt className="text-xs text-subtle">Hiệu lực</dt><dd className="m-0 mt-1">{dateText(current.effectiveAt)}</dd></div><div><dt className="text-xs text-subtle">Người công bố</dt><dd className="m-0 mt-1">{displayActor(current.publishedBy)}</dd></div><div><dt className="text-xs text-subtle">Thời điểm công bố</dt><dd className="m-0 mt-1">{dateText(current.publishedAt)}</dd></div><div><dt className="text-xs text-subtle">Giá 1 năm</dt><dd className="m-0 mt-1">{money(current.prices[1])}</dd></div><div><dt className="text-xs text-subtle">Giá 2 năm</dt><dd className="m-0 mt-1">{money(current.prices[2])}</dd></div><div><dt className="text-xs text-subtle">Giá 3 năm</dt><dd className="m-0 mt-1">{money(current.prices[3])}</dd></div><div><dt className="text-xs text-subtle">Trạng thái</dt><dd className="m-0 mt-1"><Badge tone={statusTone(current.status)}>{statusText[current.status]}</Badge></dd></div></dl></WorkSection><form onSubmit={publish}><WorkSection title="Công bố phiên bản mới"><div className="grid gap-4 md:grid-cols-3"><Field label="Hiệu lực"><select className={inputCls} value={mode} onChange={(event) => setMode(event.target.value as 'NOW' | 'SCHEDULED')} disabled={readOnly}><option value="NOW">Áp dụng ngay</option><option value="SCHEDULED">Lên lịch</option></select></Field><Field label="Ngày giờ HCM"><input className={inputCls} type="datetime-local" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} disabled={readOnly || mode === 'NOW'} /></Field><Field label="Nguồn / ghi chú *"><input className={inputCls} value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} maxLength={500} disabled={readOnly} /></Field></div><div className="grid gap-4 border-y border-rule py-4 md:grid-cols-3">{([1, 2, 3] as const).map((term) => <Field key={term} label={`Giá ${term} năm (VND) *`}><input className={inputCls} type="number" min={1000} max={1000000000} step={1000} value={prices[term]} onChange={(event) => setPrices((currentPrices) => ({ ...currentPrices, [term]: event.target.value }))} disabled={readOnly} /></Field>)}</div><Field label="Điều khoản gói *"><textarea className={`${inputCls} min-h-28`} value={terms} onChange={(event) => setTerms(event.target.value)} maxLength={500} disabled={readOnly} /></Field>{error && <InlineMessage tone="err" className="mt-4" title="Chưa thể lưu">{error}</InlineMessage>}{notice && <InlineMessage tone="ok" className="mt-4">{notice}</InlineMessage>}{!readOnly && <div className="flex justify-end border-t border-rule pt-4"><Button type="submit" variant="primary">Công bố phiên bản</Button></div>}</WorkSection></form><WorkSection title="Lịch sử phiên bản"><Table wide scroll><thead><tr><Th>Phiên bản</Th><Th>Hiệu lực</Th><Th>Người công bố</Th><Th>Thời điểm công bố</Th><Th>Giá 1/2/3 năm</Th><Th>Ghi chú nguồn</Th><Th>Trạng thái</Th><Th>Rút</Th></tr></thead><tbody>{versions.map((version) => <tr key={version.id}><Td>{version.version}</Td><Td>{dateText(version.effectiveAt)}</Td><Td>{displayActor(version.publishedBy)}</Td><Td>{dateText(version.publishedAt)}</Td><Td>{money(version.prices[1])} · {money(version.prices[2])} · {money(version.prices[3])}</Td><Td>{displaySource(version.sourceNote)}</Td><Td><Badge tone={statusTone(version.status)}>{statusText[version.status]}</Badge>{version.withdrawnReason && <span className="block text-[11px] text-subtle">{version.withdrawnReason}</span>}</Td><Td>{version.status === 'SCHEDULED' && <Button small disabled={readOnly} onClick={() => setWithdrawId(version.id)}>Chọn rút</Button>}</Td></tr>)}</tbody></Table>{withdrawId && <div className="mt-4 grid gap-3 border-t border-rule pt-4 md:grid-cols-[minmax(0,1fr)_auto]"><Field label="Lý do rút phiên bản *"><input className={inputCls} value={withdrawReason} onChange={(event) => setWithdrawReason(event.target.value)} maxLength={500} disabled={readOnly} /></Field><Button variant="danger" disabled={readOnly} onClick={withdraw}>Xác nhận rút</Button></div>}</WorkSection></div>
}

export function PlatformServiceScreen({ screen, state, role }: { screen: ScreenDefinition; state: ReviewState; role: ScreenRole }) {
  if (!PM_ONLY.includes(role)) return <InlineMessage tone="err" title="Bạn không có quyền truy cập">Màn hình dịch vụ nền tảng và bảng giá chỉ dành cho PM.</InlineMessage>
  if (screen.id === 'SCR-90') return <Subscription90 state={state} />
  if (screen.id === 'SCR-91') return <Reconciliation91 state={state} readOnly={state === 'read-only'} />
  return <Subscription92 state={state} readOnly={state === 'read-only'} />
}
