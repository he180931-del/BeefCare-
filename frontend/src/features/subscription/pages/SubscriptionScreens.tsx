import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReviewState } from '../../../app/fixtureSession'
import { expandLocalTable, isStressGenerated } from '../../../app/localStressData'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Badge, Button, Field, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, InlineMessage, LoadingState, WorkSection } from '../../../components/workspace'
import {
  DEMO_NOW, DEMO_TODAY, addYears, daysRemaining, formatDateTime, loadActivePaymentId, loadPlans, loadReturnTarget, loadSelectedFarmId, money, reconcileExpiredPaymentState, renewalDate, saveActivePaymentId, saveOrders, savePaymentIntents, saveReturnTarget, saveSelectedFarmId, RECEIVING_ACCOUNT,
  type FarmSubscription, type PaymentIntent, type PaymentStatus, type PriceVersion, type SubscriptionStatus, type TermYears,
} from '../subscriptionStore'

const terms: TermYears[] = [1, 2, 3]
const statusLabel: Record<SubscriptionStatus | PaymentStatus, string> = { ACTIVE: 'Đang hoạt động', PENDING_PAYMENT: 'Chờ thanh toán', EXPIRED: 'Hết hạn', SUSPENDED: 'Tạm ngừng', NONE: 'Chưa có kỳ', PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán' }
const periodStatusLabel: Record<string, string> = { CURRENT: 'Đang hiệu lực', FUTURE: 'Kỳ tiếp theo', PAST: 'Đã kết thúc' }
const statusTone = (status: SubscriptionStatus | PaymentStatus) => status === 'ACTIVE' || status === 'PAID' ? 'ok' as const : status === 'SUSPENDED' || status === 'EXPIRED' ? 'err' as const : 'warn' as const

function allowed(role: ScreenRole) { return role === 'owner' }
function daysText(value?: string) { const days = daysRemaining(value); return days === null ? '—' : days < 0 ? 'Đã hết hạn' : `${days} ngày` }
function currentPlan(plans: PriceVersion[]) {
  const now = new Date(DEMO_NOW).getTime()
  const effective = plans
    .filter((plan) => new Date(plan.effectiveAt).getTime() <= now)
    .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.effectiveFrom.localeCompare(a.effectiveFrom))
  return effective[0] ?? plans[0]
}
function countdown(expiresAt: string, now: number) {
  const expiry = new Date(expiresAt.replace(' ', 'T')).getTime(); const remaining = expiry - now
  if (!Number.isFinite(remaining) || remaining <= 0) return '00:00:00'
  const seconds = Math.floor(remaining / 1000); const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const rest = seconds % 60
  return [hours, minutes, rest].map((value) => String(value).padStart(2, '0')).join(':')
}

function isoDate(value?: string) {
  if (!value) return ''
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : value.slice(0, 10)
}

function SubscriptionHeader({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return <PageHeader title={title} sub={sub} badge={<span className="text-xs font-semibold text-subtle">Quản lý trang trại</span>}>{children}</PageHeader>
}

function FarmSummary({ farm }: { farm: FarmSubscription }) {
  const renewal = renewalDate(farm.confirmedEnd)
  return <dl className="m-0 grid gap-x-8 gap-y-4 border-y border-rule py-5 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-subtle">Trạng thái dịch vụ</dt><dd className="m-0 mt-1"><Badge tone={statusTone(farm.status)}>{statusLabel[farm.status]}</Badge></dd></div><div><dt className="text-xs text-subtle">Kỳ hiện tại</dt><dd className="m-0 mt-1 text-sm font-semibold">{farm.currentStart && farm.currentEnd ? `${farm.currentStart} → ${farm.currentEnd}` : '—'}</dd></div><div><dt className="text-xs text-subtle">Còn lại</dt><dd className="m-0 mt-1 text-sm font-semibold">{daysText(farm.currentEnd)}</dd></div><div><dt className="text-xs text-subtle">Ngày mở gia hạn</dt><dd className="m-0 mt-1 text-sm font-semibold">{renewal ?? '—'}</dd></div><div><dt className="text-xs text-subtle">Ngày xác nhận cuối</dt><dd className="m-0 mt-1 text-sm font-semibold">{farm.confirmedEnd ?? '—'}</dd></div><div><dt className="text-xs text-subtle">Tạm ngừng</dt><dd className="m-0 mt-1 text-sm font-semibold">{farm.suspendedSince ? `Có · ${farm.suspendedSince}` : 'Không'}</dd></div><div><dt className="text-xs text-subtle">Yêu cầu đang chờ</dt><dd className="m-0 mt-1 text-sm font-semibold">{farm.pendingRequestCode ?? '—'}</dd></div><div><dt className="text-xs text-subtle">Kỳ tương lai</dt><dd className="m-0 mt-1 text-sm font-semibold">{farm.periods.filter((period) => period.status === 'FUTURE').length || '—'}</dd></div></dl>
}

function Subscription86({ state, readOnly }: { state: ReviewState; readOnly: boolean }) {
  const navigate = useNavigate()
  const initial = useMemo(() => reconcileExpiredPaymentState(), [])
  const [farms, setFarms] = useState(() => initial.farms)
  const [plans, setPlans] = useState(() => loadPlans())
  const [intents] = useState(() => initial.intents)
  const [selectedId, setSelectedId] = useState(() => loadSelectedFarmId())
  const farm = farms.find((entry) => entry.id === selectedId) ?? farms[0]
  const plan = currentPlan(plans)
  const pending = intents.find((intent) => intent.farmId === farm?.id && intent.status === 'PENDING')
  const displayFarm = pending && !farm.pendingRequestCode ? { ...farm, pendingRequestCode: pending.code } : farm
  const renewal = renewalDate(farm?.confirmedEnd)
  const inRenewalWindow = !farm?.confirmedEnd || !renewal || DEMO_TODAY >= renewal
  const canPay = !readOnly && farm && farm.status !== 'SUSPENDED' && (farm.status !== 'ACTIVE' || inRenewalWindow)
  if (state === 'loading') return <LoadingState label="Đang tải gói dịch vụ của trại…" rows={6} />
  if (state === 'error') return <InlineMessage tone="err" title="Không thể tải gói dịch vụ">Thử lại để không tạo yêu cầu thanh toán trên dữ liệu chưa đồng bộ.</InlineMessage>
  if (state === 'empty' || !farm) return <EmptyState title="Chưa có trang trại thuộc tài khoản" description="Chọn trang trại sau khi hoàn tất đăng ký hoặc mở lời mời." />
  const openPayment = (intent: PaymentIntent) => { saveActivePaymentId(intent.id); saveReturnTarget('/ui/scr-86'); navigate('/ui/scr-88') }
  const startPayment = () => { saveSelectedFarmId(farm.id); saveReturnTarget('/ui/scr-86'); navigate('/ui/scr-87') }
  const switchFarm = (value: string) => { setSelectedId(value); saveSelectedFarmId(value); setFarms((current) => [...current]) }
  return <div className="min-w-0"><SubscriptionHeader title="Gói dịch vụ của trại" sub="Chủ trại theo dõi kỳ dịch vụ, giá hiệu lực và yêu cầu thanh toán của từng trang trại."><div className="flex flex-wrap items-center gap-2"><Button onClick={() => navigate('/ui/scr-89')}>Lịch sử thanh toán</Button><Button variant="primary" disabled={!canPay} onClick={startPayment}>{farm.status === 'PENDING_PAYMENT' ? 'Thanh toán để kích hoạt' : 'Gia hạn dịch vụ'}</Button></div></SubscriptionHeader><WorkSection title="Trang trại"><Field label="Trang trại"><select className={`${inputCls} max-w-md`} value={farm.id} onChange={(event) => switchFarm(event.target.value)} disabled={readOnly}>{farms.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field>{farm.status === 'SUSPENDED' && <InlineMessage tone="warn" className="mt-4">Dịch vụ đang tạm ngừng; không thể tạo yêu cầu thanh toán mới.<span className="ml-2"><Button small onClick={() => navigate(`/ui/scr-94?category=FARM_SERVICE&farmId=${encodeURIComponent(farm.id)}`)}>Gửi yêu cầu hỗ trợ</Button></span></InlineMessage>}{farm.status === 'ACTIVE' && !inRenewalWindow && <InlineMessage tone="info" className="mt-4">Gia hạn chỉ mở từ {renewal}; thao tác hiện đang bị khóa.</InlineMessage>}</WorkSection><WorkSection title="Tóm tắt dịch vụ"><FarmSummary farm={displayFarm} /></WorkSection><WorkSection title="Danh sách giá hiệu lực" description={`Phiên bản ${plan?.version ?? '—'} · hiệu lực từ ${plan?.effectiveFrom ?? '—'}`}><div className="grid gap-4 border-y border-rule py-4 md:grid-cols-3">{terms.map((term) => <div key={term} className="border-l-2 border-field pl-4 first:border-brand"><p className="m-0 text-xs text-subtle">{term} năm</p><p className="m-0 mt-2 text-xl font-bold text-ink">{plan ? money(plan.prices[term]) : 'Chưa có bảng giá'}</p>{plan ? <Button small className="mt-3" disabled={!canPay} onClick={startPayment}>Chọn kỳ hạn</Button> : <Button small className="mt-3" onClick={() => setPlans(loadPlans())}>Thử lại giá</Button>}</div>)}</div></WorkSection>{pending && <WorkSection title="Yêu cầu thanh toán đang chờ"><InlineMessage tone="warn" title={pending.code}>Yêu cầu {pending.termYears} năm · hết hạn {formatDateTime(pending.expiresAt)}<span className="ml-2"><Button small onClick={() => openPayment(pending)}>Mở hướng dẫn</Button></span></InlineMessage></WorkSection>}<WorkSection title="Các kỳ đã mua"><Table wide scroll><thead><tr><Th>Kỳ</Th><Th>Mã thanh toán</Th><Th>Kỳ hạn</Th><Th>Số tiền</Th><Th>Trạng thái</Th></tr></thead><tbody>{farm.periods.length ? farm.periods.map((period) => <tr key={period.id}><Td>{period.start} → {period.end}</Td><Td>{period.paymentCode}</Td><Td>{period.termYears} năm</Td><Td>{money(period.amount)}</Td><Td><Badge tone={period.status === 'CURRENT' ? 'ok' : 'outline'}>{periodStatusLabel[period.status] ?? period.status}</Badge></Td></tr>) : <tr><Td colSpan={5}>Chưa có kỳ dịch vụ.</Td></tr>}</tbody></Table></WorkSection></div>
}

function Subscription87({ state, readOnly }: { state: ReviewState; readOnly: boolean }) {
  const navigate = useNavigate()
  const initial = useMemo(() => reconcileExpiredPaymentState(), [])
  const [farms, setFarms] = useState(() => initial.farms)
  const [plans, setPlans] = useState(() => loadPlans())
  const [intents, setIntents] = useState(() => initial.intents)
  const [farmId] = useState(() => loadSelectedFarmId())
  const [term, setTerm] = useState<TermYears | null>(null)
  const [error, setError] = useState('')
  const farm = farms.find((entry) => entry.id === farmId) ?? farms[0]
  const plan = currentPlan(plans)
  const sourceReturn = loadReturnTarget()
  const originReturn = sourceReturn === '/ui/scr-10' || sourceReturn === '/ui/scr-86' ? sourceReturn : '/ui/scr-86'
  const existing = intents.find((intent) => intent.farmId === farm?.id && intent.status === 'PENDING')
  const renewal = renewalDate(farm?.confirmedEnd)
  const outsideWindow = farm?.status === 'ACTIVE' && renewal && DEMO_TODAY < renewal
  const start = farm?.confirmedEnd ?? DEMO_TODAY
  const estimate = term ? { start, end: addYears(start, term) } : undefined
  if (state === 'loading') return <LoadingState label="Đang tải lựa chọn kỳ hạn…" rows={5} />
  if (state === 'error') return <InlineMessage tone="err" title="Không thể tải đăng ký">Kiểm tra giá và kỳ dịch vụ trước khi thử lại.</InlineMessage>
  if (state === 'empty' || !farm) return <EmptyState title="Chưa có trang trại để đăng ký" description="Quay lại chọn trang trại trước khi tạo yêu cầu thanh toán." actionLabel="Về gói dịch vụ" onAction={() => navigate('/ui/scr-86')} />
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!term) { setError('Chọn một kỳ hạn 1, 2 hoặc 3 năm.'); return }
    if (farm.status === 'SUSPENDED') { setError('Không thể tạo yêu cầu khi dịch vụ đang tạm ngừng.'); return }
    if (outsideWindow) { setError(`Gia hạn chỉ mở từ ${renewal}.`); return }
    const reconciled = reconcileExpiredPaymentState()
    setIntents(reconciled.intents); setFarms(reconciled.farms)
    const freshFarm = reconciled.farms.find((entry) => entry.id === farm.id) ?? farm
    const existingFresh = reconciled.intents.find((intent) => intent.farmId === freshFarm.id && intent.status === 'PENDING')
    if (existingFresh) { setError(`Đã có yêu cầu ${existingFresh.code} còn hiệu lực. Mở lại yêu cầu đó thay vì tạo trùng.`); return }
    const latestPlan = currentPlan(loadPlans())
    if (!latestPlan) { setError('Chưa có bảng giá hiệu lực; thử lại sau.'); return }
    if (!plan || latestPlan.version !== plan.version) { setPlans(loadPlans()); setError('Bảng giá vừa thay đổi; kiểm tra lại số tiền trước khi tạo yêu cầu.'); return }
    const now = Date.now(); const id = `intent-${now}`; const code = `PAY-${String(now).slice(-6)}`; const created = new Date(now).toISOString(); const expires = new Date(now + 86400000).toISOString(); const next: PaymentIntent = { id, code, farmId: freshFarm.id, farmName: freshFarm.name, termYears: term, amount: latestPlan.prices[term], priceVersion: latestPlan.version, status: 'PENDING', createdAt: created, expiresAt: expires, sourceReturn: originReturn, firstPayment: freshFarm.status === 'PENDING_PAYMENT', transferContent: `BEEFCARE ${code}`, receivingBank: RECEIVING_ACCOUNT.bank, receivingAccountNumber: RECEIVING_ACCOUNT.accountNumber, receivingAccountName: RECEIVING_ACCOUNT.accountName }
    const nextIntents = [...reconciled.intents, next]; const nextFarms = reconciled.farms.map((entry) => entry.id === freshFarm.id ? { ...entry, pendingRequestCode: code } : entry); if (!savePaymentIntents(nextIntents) || !saveOrders(nextFarms)) { setError('Không thể tạo yêu cầu thanh toán; chưa ghi nhận yêu cầu nào.'); return } if (!saveActivePaymentId(id) || !saveReturnTarget(next.sourceReturn) || !saveSelectedFarmId(freshFarm.id)) { setError('Đã ghi nhận yêu cầu nhưng không mở được trang tiếp theo; hãy mở lại từ lịch sử.'); return } setIntents(nextIntents); setFarms(nextFarms); navigate('/ui/scr-88')
  }
  const later = () => navigate(originReturn)
  return <div className="min-w-0"><SubscriptionHeader title="Chọn kỳ hạn và xem lại đăng ký" sub="Yêu cầu thanh toán một lần bằng chuyển khoản; không tự động gia hạn." /><WorkSection title="Trạng thái trang trại"><dl className="m-0 grid gap-4 border-y border-rule py-4 sm:grid-cols-2"><div><dt className="text-xs text-subtle">Trang trại</dt><dd className="m-0 mt-1 font-semibold">{farm.name}</dd></div><div><dt className="text-xs text-subtle">Trạng thái hiện tại</dt><dd className="m-0 mt-1"><Badge tone={statusTone(farm.status)}>{statusLabel[farm.status]}</Badge>{farm.currentStart && farm.currentEnd && <span className="ml-2 text-xs text-subtle">{farm.currentStart} → {farm.currentEnd}</span>}</dd></div></dl></WorkSection><form onSubmit={submit}><WorkSection title="Kỳ hạn *" description="Không có lựa chọn mặc định."><div className="grid gap-4 border-y border-rule py-4 md:grid-cols-3">{terms.map((value) => <button key={value} type="button" disabled={readOnly} onClick={() => setTerm(value)} className={`border p-5 text-left ${term === value ? 'border-brand bg-ok-bg' : 'border-field bg-white'}`}><span className="block text-xs text-subtle">Kỳ hạn</span><strong className="mt-1 block text-lg">{value} năm</strong><span className="mt-2 block text-sm font-semibold">{plan ? money(plan.prices[value]) : 'Chưa có bảng giá'}</span></button>)}</div></WorkSection><WorkSection title="Điều khoản gói" description="Đọc trước khi tạo yêu cầu."><dl className="m-0 grid gap-3 border-y border-rule py-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-subtle">Chức năng</dt><dd className="m-0 mt-1 text-sm">Giống nhau cho mọi kỳ hạn</dd></div><div><dt className="text-xs text-subtle">Thanh toán</dt><dd className="m-0 mt-1 text-sm">Một lần · chuyển khoản</dd></div><div><dt className="text-xs text-subtle">Tự động gia hạn</dt><dd className="m-0 mt-1 text-sm">Không</dd></div><div><dt className="text-xs text-subtle">Hiệu lực yêu cầu</dt><dd className="m-0 mt-1 text-sm">24 giờ</dd></div></dl></WorkSection><WorkSection title="Xem lại"><dl className="m-0 grid gap-4 border-y border-rule py-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-subtle">Trang trại</dt><dd className="m-0 mt-1 font-semibold">{farm.name}</dd></div><div><dt className="text-xs text-subtle">Kỳ hạn</dt><dd className="m-0 mt-1 font-semibold">{term ? `${term} năm` : 'Chưa chọn'}</dd></div><div><dt className="text-xs text-subtle">Tổng tiền</dt><dd className="m-0 mt-1 font-semibold">{term && plan ? money(plan.prices[term]) : '—'}</dd></div><div><dt className="text-xs text-subtle">Kỳ dự kiến</dt><dd className="m-0 mt-1 font-semibold">{estimate ? `${estimate.start} → ${estimate.end}` : '—'}{estimate && <span className="block text-[11px] font-normal text-subtle">Ước tính</span>}</dd></div><div><dt className="text-xs text-subtle">Bảng giá</dt><dd className="m-0 mt-1 font-semibold">{plan ? `${plan.version} · ${plan.effectiveFrom}` : 'Chưa có bảng giá'}</dd></div></dl></WorkSection>{error && <InlineMessage tone="err" title="Chưa thể tạo yêu cầu">{error}</InlineMessage>}{existing && <InlineMessage tone="warn" className="mt-4" title={`${existing.code} đang chờ`}>Yêu cầu còn hiệu lực. <Button small onClick={() => { saveActivePaymentId(existing.id); saveReturnTarget('/ui/scr-87'); navigate('/ui/scr-88') }}>Mở yêu cầu đang chờ</Button></InlineMessage>}{!readOnly && <div className="flex flex-wrap justify-end gap-2 border-t border-rule pt-4"><Button type="button" onClick={() => navigate(originReturn)}>Quay lại</Button><Button type="button" onClick={later}>Để sau</Button><Button type="submit" variant="primary" disabled={Boolean(existing)}>Tạo yêu cầu thanh toán</Button></div>}</form></div>
}

function progressFor(payment: PaymentIntent) {
  return [{ step: 'Tạo yêu cầu', time: payment.createdAt, status: 'Hoàn tất' }, { step: 'Ngân hàng nhận giao dịch', time: payment.receivedAt ?? '—', status: payment.receivedAt ? 'Hoàn tất' : 'Đang chờ' }, { step: 'Xác nhận và cấp kỳ', time: payment.confirmedAt ?? '—', status: payment.confirmedAt ? `Hoàn tất · ${payment.periodStart ?? ''} → ${payment.periodEnd ?? ''}` : 'Chưa hoàn tất' }]
}

function Subscription88({ state, readOnly }: { state: ReviewState; readOnly: boolean }) {
  const navigate = useNavigate()
  const initial = useMemo(() => reconcileExpiredPaymentState(), [])
  const [intents, setIntents] = useState(() => initial.intents)
  const [paymentId] = useState(() => loadActivePaymentId())
  const [notice, setNotice] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  const payment = intents.find((intent) => intent.id === paymentId) ?? intents.find((intent) => intent.status === 'PENDING')
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  if (state === 'loading') return <LoadingState label="Đang tải hướng dẫn chuyển khoản…" rows={7} />
  if (state === 'error') return <InlineMessage tone="err" title="Không thể tải yêu cầu thanh toán">Không thay đổi trạng thái yêu cầu khi chưa lấy được dữ liệu.</InlineMessage>
  if (state === 'empty' || !payment) return <EmptyState title="Chưa có yêu cầu thanh toán" description="Mở gói dịch vụ để tạo yêu cầu mới." actionLabel="Về gói dịch vụ" onAction={() => navigate('/ui/scr-86')} />
  const refresh = () => {
    if (readOnly) return
    const reconciled = reconcileExpiredPaymentState(); setIntents(reconciled.intents)
    const refreshed = reconciled.intents.find((intent) => intent.id === payment.id)
    setNotice(refreshed?.status === 'EXPIRED' ? 'Yêu cầu đã hết hạn; mã yêu cầu chờ đã được xóa và VietQR được ẩn.' : 'Chưa lấy được trạng thái ngân hàng mới; yêu cầu thanh toán vẫn được giữ nguyên.')
  }
  const copy = async (value: string) => { try { await navigator.clipboard?.writeText(value); setNotice('Đã sao chép thông tin chuyển khoản.') } catch { setNotice('Không thể sao chép tự động; hãy chọn và sao chép nội dung.') } }
  const close = () => { const returnTarget = loadReturnTarget(); const allowedTargets = ['/ui/scr-86', '/ui/scr-87', '/ui/scr-89']; const source = allowedTargets.includes(payment.sourceReturn) ? payment.sourceReturn : '/ui/scr-86'; navigate(allowedTargets.includes(returnTarget) ? returnTarget : source) }
  const qrImage = (payment as PaymentIntent & { qrImage?: string }).qrImage
  const history = () => { saveReturnTarget('/ui/scr-88'); navigate('/ui/scr-89') }
  return <div className="min-w-0"><SubscriptionHeader title="Hướng dẫn chuyển khoản" sub={`${payment.code} · ${payment.termYears} năm · ${payment.farmName}`}><div className="flex flex-wrap gap-2"><Button onClick={history}>Xem lịch sử</Button><Button onClick={close}>Đóng hướng dẫn</Button></div></SubscriptionHeader><WorkSection title={`${payment.code} · ${payment.termYears} năm · ${payment.farmName}`}><div className="flex flex-wrap items-center gap-3"><Badge tone={statusTone(payment.status)}>{statusLabel[payment.status]}</Badge><span className="text-sm text-subtle">Hết hạn: {formatDateTime(payment.expiresAt)}</span><span className="text-sm text-subtle">Còn lại: {payment.status === 'PENDING' ? countdown(payment.expiresAt, clock) : '—'}</span></div>{payment.status !== 'EXPIRED' ? <div className="mt-5 grid gap-5 border-y border-rule py-5 md:grid-cols-[minmax(0,1fr)]">{qrImage ? <img src={qrImage} alt="VietQR" className="max-h-48 w-auto object-contain" /> : <p className="m-0 text-sm text-subtle">VietQR chưa khả dụng; dùng thông tin chuyển khoản bên cạnh để thanh toán.</p>}<dl className="m-0 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-subtle">Ngân hàng nhận</dt><dd className="m-0 mt-1 font-semibold">{payment.receivingBank} <Button small onClick={() => copy(payment.receivingBank)}>Sao chép</Button></dd></div><div><dt className="text-xs text-subtle">Số tài khoản</dt><dd className="m-0 mt-1 font-semibold">{payment.receivingAccountNumber} <Button small onClick={() => copy(payment.receivingAccountNumber)}>Sao chép</Button></dd></div><div><dt className="text-xs text-subtle">Chủ tài khoản</dt><dd className="m-0 mt-1 font-semibold">{payment.receivingAccountName} <Button small onClick={() => copy(payment.receivingAccountName)}>Sao chép</Button></dd></div><div><dt className="text-xs text-subtle">Số tiền</dt><dd className="m-0 mt-1 font-semibold">{money(payment.amount)} <Button small onClick={() => copy(String(payment.amount))}>Sao chép</Button></dd></div><div className="sm:col-span-2"><dt className="text-xs text-subtle">Nội dung chuyển khoản</dt><dd className="m-0 mt-1 font-semibold">{payment.transferContent} <Button small onClick={() => copy(payment.transferContent)}>Sao chép</Button></dd></div></dl></div> : <InlineMessage tone="err" className="mt-4">Yêu cầu đã hết hạn. VietQR và hướng dẫn chuyển khoản đã được ẩn.</InlineMessage>}</WorkSection><WorkSection title="Tiến độ"><Table><thead><tr><Th>Bước</Th><Th>Thời điểm</Th><Th>Trạng thái</Th></tr></thead><tbody>{progressFor(payment).map((row) => <tr key={row.step}><Td>{row.step}</Td><Td>{row.time}</Td><Td>{row.status}</Td></tr>)}</tbody></Table></WorkSection>{notice && <InlineMessage tone="info" className="mt-4">{notice}</InlineMessage>}<div className="flex flex-wrap justify-end gap-2 border-t border-rule pt-4">{!readOnly && <Button onClick={refresh}>Kiểm tra lại</Button>}{payment.status === 'PAID' && <Button variant="primary" onClick={() => navigate(payment.firstPayment ? '/ui/scr-77' : '/ui/scr-86')}>{payment.firstPayment ? 'Vào trang trại' : 'Về gói dịch vụ'}</Button>}<Button onClick={history}>Xem lịch sử</Button><Button onClick={close}>Đóng hướng dẫn</Button></div></div>
}

function PaymentDetail({ payment }: { payment: PaymentIntent }) {
  return <WorkSection title="Chi tiết thanh toán"><dl className="m-0 grid gap-4 border-y border-rule py-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-subtle">Mã</dt><dd className="m-0 mt-1 font-semibold">{payment.code}</dd></div><div><dt className="text-xs text-subtle">Trạng thái</dt><dd className="m-0 mt-1"><Badge tone={statusTone(payment.status)}>{statusLabel[payment.status]}</Badge></dd></div><div><dt className="text-xs text-subtle">Trang trại</dt><dd className="m-0 mt-1 font-semibold">{payment.farmName}</dd></div><div><dt className="text-xs text-subtle">Bảng giá</dt><dd className="m-0 mt-1 font-semibold">{payment.priceVersion}</dd></div><div><dt className="text-xs text-subtle">Kỳ hạn</dt><dd className="m-0 mt-1 font-semibold">{payment.termYears} năm</dd></div><div><dt className="text-xs text-subtle">Số tiền</dt><dd className="m-0 mt-1 font-semibold">{money(payment.amount)}</dd></div><div><dt className="text-xs text-subtle">Ngân hàng trả lúc</dt><dd className="m-0 mt-1">{formatDateTime(payment.bankPaidAt)}</dd></div><div><dt className="text-xs text-subtle">Nhận lúc</dt><dd className="m-0 mt-1">{formatDateTime(payment.receivedAt)}</dd></div><div><dt className="text-xs text-subtle">Xác nhận lúc</dt><dd className="m-0 mt-1">{formatDateTime(payment.confirmedAt)}</dd></div><div><dt className="text-xs text-subtle">Kỳ đã mua</dt><dd className="m-0 mt-1">{payment.periodStart && payment.periodEnd ? `${payment.periodStart} → ${payment.periodEnd}` : '—'}</dd></div></dl></WorkSection>
}

function Subscription89({ state, readOnly }: { state: ReviewState; readOnly: boolean }) {
  const navigate = useNavigate()
  const initial = useMemo(() => reconcileExpiredPaymentState(), [])
  const [intents] = useState(() => initial.intents)
  const selectedFarmId = loadSelectedFarmId()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<'createdAt' | 'expiresAt'>('createdAt')
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const displayIntents = useMemo(() => expandLocalTable('subscription-payment-history', intents.filter((payment) => payment.farmId === selectedFarmId)), [intents, selectedFarmId])
  const visible = useMemo(() => displayIntents.filter((payment) => (!query || `${payment.code} ${payment.farmName}`.toLowerCase().includes(query.toLowerCase())) && (status === 'ALL' || payment.status === status) && (!from || isoDate(payment.createdAt) >= from) && (!to || isoDate(payment.createdAt) <= to)).sort((a, b) => b[sort].localeCompare(a[sort])), [displayIntents, query, status, from, to, sort])
  if (state === 'loading') return <LoadingState label="Đang tải lịch sử thanh toán…" rows={6} />
  if (state === 'error') return <InlineMessage tone="err" title="Không thể tải lịch sử thanh toán">Thử lại để không mất trạng thái yêu cầu.</InlineMessage>
  const selected = visible.find((payment) => payment.id === selectedId)
  const reopen = (payment: PaymentIntent) => { saveActivePaymentId(payment.id); saveReturnTarget('/ui/scr-89'); navigate('/ui/scr-88') }
  const resetFilters = () => { setQuery(''); setStatus('ALL'); setFrom(''); setTo(''); setSort('createdAt') }
  return <div className="min-w-0"><SubscriptionHeader title="Lịch sử và chi tiết thanh toán" sub="Tra cứu yêu cầu, kết quả đối soát và kỳ đã cấp."><Button onClick={() => navigate('/ui/scr-86')}>Về gói dịch vụ</Button></SubscriptionHeader><WorkSection title="Lịch sử"><FilterBar actions={<Button onClick={resetFilters}>Đặt lại bộ lọc</Button>}><input className={`${inputCls} min-w-52 flex-1`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã thanh toán" aria-label="Tìm mã thanh toán" /><select className={`${inputCls} w-36`} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Trạng thái"><option value="ALL">Tất cả</option><option value="PENDING">Chờ thanh toán</option><option value="PAID">Đã thanh toán</option><option value="EXPIRED">Hết hạn</option></select><Field label="Từ ngày"><input className={inputCls} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="Đến ngày"><input className={inputCls} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field><select className={`${inputCls} w-44`} value={sort} onChange={(event) => setSort(event.target.value as 'createdAt' | 'expiresAt')} aria-label="Sắp xếp"><option value="createdAt">Mới tạo trước</option><option value="expiresAt">Hết hạn gần trước</option></select></FilterBar>{state === 'empty' || visible.length === 0 ? <EmptyState compact title="Chưa có thanh toán phù hợp" description="Không có yêu cầu thuộc trang trại hoặc bộ lọc hiện tại." actionLabel="Đặt lại bộ lọc" onAction={resetFilters} /> : <Table wide scroll><thead><tr><Th>Mã</Th><Th>Trang trại</Th><Th>Kỳ hạn</Th><Th>Số tiền</Th><Th>Tạo lúc</Th><Th>Hết hạn</Th><Th>Trạng thái</Th><Th>Xác nhận · kỳ</Th><Th /></tr></thead><tbody>{visible.map((payment) => <tr key={payment.id}><Td><strong>{payment.code}</strong></Td><Td>{payment.farmName}</Td><Td>{payment.termYears} năm</Td><Td>{money(payment.amount)}</Td><Td>{formatDateTime(payment.createdAt)}</Td><Td>{formatDateTime(payment.expiresAt)}</Td><Td><Badge tone={statusTone(payment.status)}>{statusLabel[payment.status]}</Badge></Td><Td>{payment.confirmedAt ? `${formatDateTime(payment.confirmedAt)} · ${payment.periodStart} → ${payment.periodEnd}` : '—'}</Td><Td>{payment.status === 'PENDING' && !isStressGenerated(payment) ? <Button small disabled={readOnly} onClick={() => reopen(payment)}>Mở lại</Button> : <Button small onClick={() => setSelectedId(payment.id)}>Xem</Button>}</Td></tr>)}</tbody></Table>}{selected && <PaymentDetail payment={selected} />}</WorkSection></div>
}

export function SubscriptionScreen({ screen, state, role }: { screen: ScreenDefinition; state: ReviewState; role: ScreenRole }) {
  if (!allowed(role)) return <InlineMessage tone="err" title="Bạn không có quyền truy cập">Gói dịch vụ và thanh toán chỉ dành cho Chủ trại.</InlineMessage>
  const readOnly = state === 'read-only'
  if (screen.id === 'SCR-86') return <Subscription86 state={state} readOnly={readOnly} />
  if (screen.id === 'SCR-87') return <Subscription87 state={state} readOnly={readOnly} />
  if (screen.id === 'SCR-88') return <Subscription88 state={state} readOnly={readOnly} />
  return <Subscription89 state={state} readOnly={readOnly} />
}
