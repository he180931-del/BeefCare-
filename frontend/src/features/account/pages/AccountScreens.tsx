import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ReviewState } from '../../../app/fixtureSession'
import { useFixtureSession } from '../../../app/fixtureSession'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Badge, Button, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { ActionDialog, EmptyState, FilterBar, FixtureNotice, InlineMessage, LoadingState, SummaryStrip, WorkSection } from '../../../components/workspace'
import { AccountForm } from '../components/AccountForm'
import { accountFields, accountMembers, farmRows, invitationRows, permissionRows, serviceFarmRows } from '../data/accountFixtures'
import { loadOrders, saveSelectedFarmId } from '../../subscription/subscriptionStore'

const actionById: Record<string, string> = {
  'SCR-02': 'Đăng nhập', 'SCR-03': 'Tạo tài khoản', 'SCR-05': 'Gửi liên kết đặt lại', 'SCR-06': 'Lưu mật khẩu',
  'SCR-07': 'Hoàn tất và đăng ký trang trại', 'SCR-09': 'Lưu mật khẩu', 'SCR-11': 'Tạo trang trại và tiếp tục',
  'SCR-14': 'Tạm ngừng dịch vụ', 'SCR-16': 'Gửi lời mời', 'SCR-18': 'Lưu thay đổi',
}

const ACCOUNT_DEMO_KEY = 'beefcare-ui-demo'
function saveAccountDemo(scope: string, values: Record<string, string | boolean> = {}) {
  if (typeof window === 'undefined') return
  try {
    const current = JSON.parse(window.localStorage.getItem(ACCOUNT_DEMO_KEY) || '{}') as Record<string, unknown>
    window.localStorage.setItem(ACCOUNT_DEMO_KEY, JSON.stringify({ ...current, account: { ...(typeof current.account === 'object' && current.account ? current.account : {}), [scope]: values } }))
  } catch { /* storage is best effort */ }
}
function saveAccountValue(scope: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    const current = JSON.parse(window.localStorage.getItem(ACCOUNT_DEMO_KEY) || '{}') as Record<string, unknown>
    const account = typeof current.account === 'object' && current.account ? current.account as Record<string, unknown> : {}
    window.localStorage.setItem(ACCOUNT_DEMO_KEY, JSON.stringify({ ...current, account: { ...account, [scope]: value } }))
  } catch { /* demo storage is best effort */ }
}
function loadAccountDemo(scope: string): Record<string, string | boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCOUNT_DEMO_KEY) || '{}') as { account?: Record<string, Record<string, string | boolean>> }
    return parsed.account?.[scope] ?? {}
  } catch { return {} }
}
function fieldsFor(screenId: string) {
  const saved = loadAccountDemo(screenId)
  return (accountFields[screenId] ?? []).map((field) => ({ ...field, value: typeof saved[field.label] === 'string' ? saved[field.label] as string : field.value }))
}
function demoRows<T>(scope: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCOUNT_DEMO_KEY) || '{}') as { account?: Record<string, unknown> }
    return Array.isArray(parsed.account?.[scope]) ? parsed.account?.[scope] as T[] : fallback
  } catch { return fallback }
}
function signInTarget() {
  const requested = loadAccountDemo('requested-return').path
  if (typeof requested === 'string' && requested.startsWith('/ui/')) return requested
  const auth = loadAccountDemo('SCR-02')
  if (auth.role === 'cs') return '/ui/scr-96'
  if (auth.role === 'pm') return '/ui/scr-13'
  if (auth.role === 'sa') return '/ui/scr-20'
  const onboarding = loadAccountDemo('SCR-07')
  if (!onboarding.completed) return '/ui/scr-07'
  const farm = loadAccountDemo('SCR-11')
  if (!farm.completed) return '/ui/scr-11'
  const saved = loadAccountDemo('farm-selection')
  if (saved.role === 'Kỹ thuật viên') return '/ui/scr-104'
  if (saved.farm) return '/ui/scr-77'
  return '/ui/scr-10'
}

function useCooldown(scope: string, seconds = 60) {
  const storedUntil = Number(loadAccountDemo(scope).until || 0)
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((storedUntil - Date.now()) / 1000)))
  useEffect(() => {
    if (remaining <= 0) return
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((Number(loadAccountDemo(scope).until || 0) - Date.now()) / 1000))), 1000)
    return () => window.clearInterval(timer)
  }, [remaining, scope])
  const start = () => { const until = Date.now() + seconds * 1000; saveAccountDemo(scope, { until: String(until) }); setRemaining(seconds) }
  return { remaining, start }
}

function Page({ screen, readOnly, sub, actions, children, narrow = false }: {
  screen: ScreenDefinition; readOnly: boolean; sub: string; actions?: ReactNode; children: ReactNode; narrow?: boolean
}) {
  if (narrow) return <div className="grid min-h-screen w-full bg-white lg:grid-cols-[minmax(360px,520px)_minmax(0,1fr)]">
    <aside className="relative hidden overflow-hidden bg-side px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between">
      <div><p className="m-0 text-xl font-bold">BeefCare</p><p className="mb-0 mt-3 max-w-xs text-sm leading-6 text-[#d7ebdf]">Ghi nhận ngay tại chuồng. Theo dõi rõ cả vòng đời đàn bò.</p></div>
      <div className="mt-6 hidden md:block"><div className="rounded-lg bg-white/10 p-4"><p className="m-0 text-xs font-semibold text-[#d7ebdf]">HÔM NAY TẠI TRẠI</p><p className="mb-0 mt-2 text-3xl font-bold">184 con</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><span>6 việc đến hạn</span><span>3 chuồng cần xem</span><span>12 hồ sơ mới</span><span>98% dữ liệu đủ</span></div></div><p className="mb-0 mt-5 text-xs leading-5 text-[#d7ebdf]">Dùng tốt trên điện thoại và máy tính bảng, không cần cài ứng dụng.</p></div>
    </aside>
    <section className="flex min-w-0 items-center bg-page px-5 py-7 sm:px-10 lg:px-14"><div className="mx-auto flex w-full max-w-[620px] flex-col gap-6"><div className="mb-1 text-xl font-bold text-brand lg:hidden">BeefCare</div><PageHeader title={screen.viTitle} sub={sub} badge={readOnly ? <span className="text-xs font-semibold text-subtle">Chỉ xem</span> : <FixtureNotice />}>{actions}</PageHeader>{children}</div></section>
  </div>
  return <div className="flex w-full flex-col gap-6"><PageHeader title={screen.viTitle} sub={sub} badge={readOnly ? <span className="text-xs font-semibold text-subtle">Chỉ xem</span> : <FixtureNotice />}>{actions}</PageHeader>{children}</div>
}

function InfoList({ items }: { items: Array<[string, ReactNode]> }) {
  return <dl className="m-0 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-subtle">{label}</dt><dd className="m-0 mt-1 text-sm font-semibold text-ink">{value}</dd></div>)}</dl>
}

function PermissionsTable({ compact = false }: { compact?: boolean }) {
  return <Table wide scroll><thead><tr><Th>Phạm vi quyền</Th><Th>Chủ trại</Th><Th>Quản lý</Th><Th>Kỹ thuật viên</Th></tr></thead><tbody>{permissionRows.slice(0, compact ? 3 : undefined).map((row) => <tr key={row.area}><Td><strong>{row.area}</strong></Td><Td>{row.owner}</Td><Td>{row.manager}</Td><Td>{row.technician}</Td></tr>)}</tbody></Table>
}

function Landing({ screen }: { screen: ScreenDefinition }) {
  const navigate = useNavigate()
  const features = [
    ['Hồ sơ riêng và thẻ QR','Mỗi con bò có một mã, một timeline và dữ liệu không trộn giữa các trang trại.'],
    ['Tăng trưởng và thể trạng','Theo dõi cân nặng, BCS và biến động theo chu kỳ thực tế.'],
    ['Tiêm phòng và sức khỏe','Lịch vaccine, ca bệnh, điều trị và thời gian ngừng thuốc cùng một nơi.'],
    ['Sinh sản và bê con','Theo dõi phối giống, thai kỳ, sinh bê và quan hệ bố mẹ.'],
    ['Nhắc việc và thông báo','Đưa việc đến hạn, quá hạn và thông báo vận hành về đúng người.'],
    ['Nhiều trại độc lập','Một tài khoản có thể tham gia nhiều trại với vai trò và dữ liệu tách biệt.'],
  ]
  return <Page screen={screen} readOnly={false} sub="Nền tảng vận hành trang trại bò thịt theo một dòng dữ liệu xuyên suốt." actions={<div className="flex items-center gap-4"><nav className="hidden items-center gap-4 text-xs font-semibold text-subtle xl:flex"><a href="#tinh-nang">Tính năng</a><a href="#cach-hoat-dong">Cách hoạt động</a><a href="#bang-gia">Bảng giá</a><a href="#hoi-dap">Hỏi đáp</a><a href="#lien-he">Liên hệ</a></nav><Button small variant="primary" onClick={() => navigate('/ui/scr-03')}>Đăng ký Chủ trại</Button></div>}>
    <section className="grid gap-9 border-y border-rule py-8 lg:grid-cols-[minmax(0,.86fr)_minmax(440px,1.14fr)] lg:items-center lg:py-12">
      <div><p className="m-0 text-sm font-semibold text-brand">Dành cho trại bò thịt 150–300 con</p><h2 className="mb-0 mt-3 max-w-3xl text-[34px] font-bold leading-[1.08] text-ink sm:text-[44px]">Nhìn rõ cả đàn.<br />Xử lý đúng việc.</h2><p className="mb-0 mt-4 max-w-xl text-base leading-7 text-subtle">Nhập đàn, chuồng, sức khỏe, sinh sản và chi phí cùng nằm trên một lịch sử dễ kiểm tra tại trại.</p><div className="mt-6 flex flex-wrap gap-3"><Button size="lg" variant="primary" onClick={() => { saveAccountDemo('SCR-03-google', { completed: true }); navigate('/ui/scr-07') }}>Dùng thử cho trang trại</Button><Button size="lg" onClick={() => document.querySelector('#tinh-nang')?.scrollIntoView({ behavior: 'smooth' })}>Xem cách hoạt động</Button></div><button type="button" className="mt-4 text-sm font-semibold text-brand" onClick={() => navigate('/ui/scr-02')}>Đã có tài khoản? Đăng nhập →</button></div>
      <div className="relative min-w-0 rounded-[18px] bg-[#e9f3ed] p-3 shadow-[0_22px_70px_rgba(16,78,55,.16)] sm:p-5"><div className="overflow-hidden rounded-xl bg-white"><div className="flex items-center justify-between border-b border-rule px-4 py-3"><div><p className="m-0 text-xs font-semibold text-brand">TRẠI BÒ BA VÌ</p><p className="mb-0 mt-0.5 text-base font-bold text-ink">Tổng quan vận hành</p></div><span className="rounded-md bg-ok-bg px-2 py-1 text-xs font-semibold text-ok-fg">Đang hoạt động</span></div><div className="grid grid-cols-3 gap-px bg-rule"><div className="bg-white p-3"><span className="text-[11px] text-subtle">Đàn hiện tại</span><strong className="mt-1 block text-xl text-ink">184</strong></div><div className="bg-white p-3"><span className="text-[11px] text-subtle">Việc hôm nay</span><strong className="mt-1 block text-xl text-ink">6</strong></div><div className="bg-white p-3"><span className="text-[11px] text-subtle">Cần chú ý</span><strong className="mt-1 block text-xl text-warn-fg">3</strong></div></div><div className="p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-sm text-ink">Công việc ưu tiên</strong><span className="text-xs text-brand">Xem tất cả</span></div>{[['Tiêm phòng lở mồm long móng','12 con · Chuồng A2','Hôm nay'],['Kiểm tra bò sắp sinh','3 con · Chuồng D','Ngày mai'],['Cân định kỳ','18 con · Chuồng B1','06/11']].map(([title,meta,date], index) => <div key={title} className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 py-3 ${index ? 'border-t border-rule' : ''}`}><span className="grid size-7 place-items-center rounded-md bg-brand-soft text-xs font-bold text-brand">{index + 1}</span><span className="min-w-0"><strong className="block truncate text-xs text-ink">{title}</strong><small className="text-[11px] text-subtle">{meta}</small></span><small className="text-[11px] font-semibold text-subtle">{date}</small></div>)}</div></div><div className="absolute -bottom-4 -left-2 hidden rounded-lg bg-side px-4 py-3 text-white shadow-lg sm:block"><strong className="block text-lg">98%</strong><span className="text-[11px] text-[#d7ebdf]">hồ sơ đủ dữ liệu</span></div></div>
    </section>
    <section className="grid grid-cols-2 gap-y-4 border-b border-rule py-6 text-center sm:grid-cols-4">{[['1','hồ sơ / con'],['8','nhóm sự kiện chăm sóc'],['7','vai trò vận hành'],['1–3 năm','thời hạn dịch vụ']].map(([value,label]) => <div key={label}><strong className="block text-2xl text-ink">{value}</strong><span className="text-xs text-subtle">{label}</span></div>)}</section>
    <WorkSection title="Tính năng cho toàn bộ vòng đời đàn bò" description="Dữ liệu được ghi một lần và dùng xuyên suốt vận hành." ><div id="tinh-nang" className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">{features.map(([title, body], index) => <article key={title} className="border-t-2 border-field pt-4"><span className="text-xs font-bold text-brand">0{index + 1}</span><h3 className="m-0 mt-2 text-base font-bold text-ink">{title}</h3><p className="mb-0 mt-2 text-sm leading-6 text-subtle">{body}</p></article>)}</div></WorkSection>
    <WorkSection title="Bốn bước để ghi nhận đúng" description="Từ tai bò đến lịch sử có thể kiểm tra lại."><ol id="cach-hoat-dong" className="grid list-none gap-6 p-0 md:grid-cols-4">{[['01','Quét thẻ tai QR'],['02','Mở đúng hồ sơ'],['03','Ghi sự kiện thực tế'],['04','Theo dõi và nhận nhắc việc']].map(([step,label]) => <li key={step} className="border-t border-rule pt-3"><strong className="text-brand">{step}</strong><span className="mt-2 block text-sm font-semibold text-ink">{label}</span></li>)}</ol></WorkSection>
    <WorkSection title="Bảng giá hiện hành" description="Tổng phí theo mỗi trang trại cho toàn bộ thời hạn."><div id="bang-gia" className="grid gap-6 md:grid-cols-3">{[['1 năm','1.200.000 đ','Phù hợp để bắt đầu'],['2 năm','2.160.000 đ','Tiết kiệm cho đội ổn định'],['3 năm','3.060.000 đ','Tối ưu kế hoạch dài hạn']].map(([period,price,note]) => <div key={period} className="border-t-2 border-brand pt-4"><p className="m-0 text-sm font-semibold text-subtle">{period}</p><p className="my-2 text-2xl font-bold text-ink">{price}</p><p className="m-0 text-sm text-subtle">{note}</p><Button small className="mt-4" onClick={() => { saveAccountDemo('plan', { period }); navigate('/ui/scr-03') }}>Chọn thời hạn</Button></div>)}</div></WorkSection>
    <WorkSection title="Câu hỏi thường gặp"><div id="hoi-dap" className="divide-y divide-rule border-y border-rule">{[['Quy mô nào phù hợp?','Thiết kế ưu tiên các trại bò thịt 150–300 con, vẫn có thể dùng cho quy mô khác.'],['Có cần cài ứng dụng không?','Không. BeefCare hoạt động trên trình duyệt máy tính và điện thoại.'],['Các thời hạn khác nhau thế nào?','Tính năng giống nhau; tổng phí và thời gian dịch vụ thay đổi theo kỳ 1, 2 hoặc 3 năm.'],['Thanh toán và kích hoạt ra sao?','Chủ trại gửi yêu cầu thanh toán, BeefCare xác nhận rồi kích hoạt kỳ dịch vụ.'],['Dữ liệu giữa các trại có tách biệt không?','Có. Thành viên chỉ thấy dữ liệu của trang trại và vai trò được cấp.']].map(([question, answer]) => <details key={question} className="py-4"><summary className="cursor-pointer text-sm font-semibold text-ink">{question}</summary><p className="mb-0 mt-2 text-sm text-subtle">{answer}</p></details>)}</div></WorkSection>
    <footer id="lien-he" className="flex flex-col justify-between gap-3 border-t border-rule py-6 text-sm sm:flex-row"><div><strong className="text-ink">Liên hệ BeefCare</strong><p className="m-0 mt-1 text-subtle">tuanpqhe181869@fpt.edu.vn · 0386 671 863</p></div><p className="m-0 text-subtle">© 2026 BeefCare</p></footer>
  </Page>
}

function AuthenticationForm({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  const resetEmail = String(loadAccountDemo('reset-email').email || '')
  const fields = fieldsFor(screen.id).map((field) => ((screen.id === 'SCR-05' && field.label === 'Email') || (screen.id === 'SCR-06' && field.label === 'Email của liên kết')) && resetEmail ? { ...field, value: resetEmail } : field)
  const [sent, setSent] = useState(() => Boolean(loadAccountDemo('SCR-05').sent))
  const [linkInvalid, setLinkInvalid] = useState(() => screen.id === 'SCR-06' && Boolean(loadAccountDemo('reset-link').invalid))
  const [message, setMessage] = useState<{ tone: 'err' | 'warn' | 'ok'; title: string; body: string } | null>(() => {
    const saved = loadAccountDemo('sign-in-message')
    return saved.success ? { tone: 'ok', title: 'Mật khẩu đã được thay đổi', body: 'Đăng nhập lại bằng mật khẩu mới. Các phiên cũ đã kết thúc.' } : null
  })
  const resend = useCooldown('SCR-05-resend')
  const resetLimit = loadAccountDemo('reset-resend-limit')
  const resetWindowStartedAt = Number(resetLimit.windowStartedAt || 0)
  const [resetCount, setResetCount] = useState(() => Date.now() - resetWindowStartedAt < 60 * 60 * 1000 ? Number(resetLimit.count || 0) : 0)
  const suspended = screen.id === 'SCR-02' && message?.title === 'Tài khoản đã bị tạm ngưng'
  const isSignInOrRegister = screen.id === 'SCR-02' || screen.id === 'SCR-03'
  const validateAuth = (values: Record<string, string | boolean>) => {
    const errors: Record<string, string> = {}
    const email = String(values.Email || '').trim().toLowerCase()
    const passwordLabel = screen.id === 'SCR-03' ? 'Mật khẩu' : 'Mật khẩu mới'
    const confirmationLabel = screen.id === 'SCR-03' ? 'Xác nhận mật khẩu' : 'Xác nhận mật khẩu mới'
    const password = String(values[passwordLabel] || '')
    if ((screen.id === 'SCR-03' || screen.id === 'SCR-06') && (password.length < 8 || password.length > 128)) errors[passwordLabel] = 'Mật khẩu cần từ 8 đến 128 ký tự.'
    if ((screen.id === 'SCR-03' || screen.id === 'SCR-06') && password.toLowerCase() === email) errors[passwordLabel] = 'Mật khẩu không được trùng với email.'
    if ((screen.id === 'SCR-03' || screen.id === 'SCR-06') && password !== String(values[confirmationLabel] || '')) errors[confirmationLabel] = 'Mật khẩu xác nhận chưa khớp.'
    return errors
  }
  const submit = (values: Record<string, string | boolean>) => {
    const email = String(values.Email || values['Email của liên kết'] || '').toLowerCase()
    if (screen.id === 'SCR-02') {
      saveAccountDemo('sign-in-message', {})
      if (email.startsWith('suspended')) { setMessage({ tone: 'err', title: 'Tài khoản đã bị tạm ngưng', body: `Tài khoản ${email} không thể đăng nhập. Liên hệ tuanpqhe181869@fpt.edu.vn hoặc 0386 671 863.` }); return }
      if (email.startsWith('locked')) { setMessage({ tone: 'warn', title: 'Đăng nhập bằng mật khẩu đang bị khóa', body: 'Có quá nhiều lần thử không thành công. Hãy thử lại sau 15 phút hoặc đặt lại mật khẩu.' }); return }
      if (email.startsWith('unverified')) { setMessage({ tone: 'warn', title: 'Email chưa được xác minh', body: 'Xác minh email trước khi đăng nhập bằng mật khẩu.' }); saveAccountDemo('verify-email', { email }); return }
      if (email.startsWith('wrong')) { setMessage({ tone: 'err', title: 'Không thể đăng nhập', body: 'Email hoặc mật khẩu chưa đúng.' }); return }
      saveAccountDemo(screen.id, values); navigate(signInTarget()); return
    }
    if (screen.id === 'SCR-03') {
      if (email === 'owner@beefcare.local') { setMessage({ tone: 'err', title: 'Email đã được sử dụng', body: 'Đăng nhập bằng tài khoản hiện có hoặc dùng một email khác.' }); return }
      saveAccountDemo(screen.id, values); saveAccountDemo('verify-email', { email }); navigate('/ui/scr-04'); return
    }
    if (screen.id === 'SCR-05') {
      if (resetCount >= 5) { setMessage({ tone: 'warn', title: 'Đã đạt giới hạn gửi', body: 'Bạn đã gửi 5 lần trong giờ này. Hãy thử lại khi cửa sổ giới hạn kết thúc.' }); return }
      const nextCount = resetCount + 1
      setResetCount(nextCount)
      saveAccountDemo('reset-resend-limit', { count: String(nextCount), windowStartedAt: String(resetCount ? resetWindowStartedAt : Date.now()) })
      saveAccountDemo('SCR-05', { ...values, sent: true }); saveAccountDemo('reset-email', { email }); setSent(true); resend.start(); return
    }
    saveAccountDemo(screen.id, values); saveAccountDemo('reset-link', { invalid: true }); saveAccountDemo('sign-in-message', { success: true }); navigate('/ui/scr-02')
  }
  return <Page screen={screen} readOnly={readOnly} narrow sub="Truy cập BeefCare bằng phương thức phù hợp với tài khoản của bạn.">
    {isSignInOrRegister && !suspended && <><Button block disabled={readOnly} onClick={() => { saveAccountDemo(`${screen.id}-google`, { completed: true }); navigate(screen.id === 'SCR-03' ? '/ui/scr-07' : signInTarget()) }}>Tiếp tục với Google</Button><div className="flex items-center gap-3 text-xs text-subtle"><span className="h-px flex-1 bg-rule" />hoặc dùng email<span className="h-px flex-1 bg-rule" /></div></>}
    {message && <InlineMessage tone={message.tone} title={message.title}>{message.body}{screen.id === 'SCR-02' && message.title.includes('xác minh') && <Button small variant="link" onClick={() => navigate('/ui/scr-04')}>Gửi lại email xác minh</Button>}</InlineMessage>}
    {screen.id === 'SCR-05' && <InlineMessage tone="info" title={sent ? 'Kiểm tra email của bạn' : 'Bảo vệ thông tin tài khoản'}>{sent ? 'Nếu địa chỉ có tài khoản mật khẩu đang hoạt động, BeefCare đã gửi liên kết đặt lại có hiệu lực 30 phút.' : 'Kết quả gửi luôn giống nhau dù email có tồn tại hay không.'}</InlineMessage>}
    {!linkInvalid && !suspended && <AccountForm fields={fields} actionLabel={actionById[screen.id]} readOnly={readOnly} validate={validateAuth} onSubmit={submit} primaryBlock />}
    {screen.id === 'SCR-02' && !suspended && <div className="flex flex-wrap justify-between gap-3 text-sm"><Button variant="link" onClick={() => navigate('/ui/scr-05')}>Quên mật khẩu?</Button><Button variant="link" onClick={() => navigate('/ui/scr-03')}>Chưa có tài khoản Chủ trại? Đăng ký</Button></div>}
    {suspended && <Button onClick={() => setMessage(null)}>Trở lại đăng nhập</Button>}
    {screen.id === 'SCR-03' && <><p className="m-0 text-xs leading-5 text-subtle">Khi tạo tài khoản, bạn xác nhận đồng ý với <a className="font-semibold text-brand" href="#terms">Điều khoản sử dụng</a> và <a className="font-semibold text-brand" href="#privacy">Chính sách dữ liệu</a>.</p><Button variant="link" onClick={() => navigate('/ui/scr-02')}>Đã có tài khoản? Đăng nhập</Button></>}
    {screen.id === 'SCR-05' && <><div className="flex flex-wrap items-center gap-3"><Button disabled={!sent || resend.remaining > 0 || resetCount >= 5} onClick={() => { const nextCount = resetCount + 1; setResetCount(nextCount); saveAccountDemo('reset-resend-limit', { count: String(nextCount), windowStartedAt: String(resetCount ? resetWindowStartedAt : Date.now()) }); resend.start() }}>{resetCount >= 5 ? 'Đã đạt giới hạn 5 lần / giờ' : resend.remaining > 0 ? `Gửi lại sau ${resend.remaining} giây` : 'Gửi lại liên kết'}</Button><Button variant="link" onClick={() => navigate('/ui/scr-02')}>Trở lại đăng nhập</Button>{sent && <Button variant="link" onClick={() => { saveAccountDemo('reset-link', { invalid: false }); navigate('/ui/scr-06') }}>Mở liên kết đặt lại</Button>}</div><p className="m-0 text-xs text-subtle">Đã gửi {resetCount}/5 lần trong giờ này.</p></>}
    {screen.id === 'SCR-06' && <><InlineMessage tone={linkInvalid ? 'err' : 'warn'} title={linkInvalid ? 'Liên kết không còn hiệu lực' : undefined}>{linkInvalid ? 'Liên kết đã hết hạn hoặc đã được sử dụng.' : 'Lưu mật khẩu mới sẽ kết thúc tất cả phiên đăng nhập hiện có.'}</InlineMessage>{linkInvalid ? <Button variant="primary" onClick={() => { saveAccountDemo('reset-email', { email: String(loadAccountDemo('reset-email').email || 'owner@beefcare.local') }); navigate('/ui/scr-05') }}>Gửi liên kết mới</Button> : <Button variant="link" onClick={() => { setLinkInvalid(true); saveAccountDemo('reset-link', { invalid: true }) }}>Kiểm tra liên kết hết hạn</Button>}</>}
  </Page>
}

function VerifyEmail({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  const cooldown = useCooldown('verify-resend')
  const savedWindow = loadAccountDemo('verify-resend')
  const windowStartedAt = Number(savedWindow.windowStartedAt || 0)
  const initialCount = Date.now() - windowStartedAt < 60 * 60 * 1000 ? Number(savedWindow.count || 0) : 0
  const [count, setCount] = useState(initialCount)
  const email = String(loadAccountDemo('verify-email').email || loadAccountDemo('SCR-03').Email || 'owner@beefcare.local')
  const expired = Boolean(loadAccountDemo('verify-link').invalid)
  const resend = () => { if (count >= 5) return; const next = count + 1; setCount(next); saveAccountDemo('verify-resend', { count: String(next), windowStartedAt: String(initialCount ? windowStartedAt : Date.now()) }); cooldown.start() }
  return <Page screen={screen} readOnly={readOnly} narrow sub="Hoàn tất xác minh trước khi tiếp tục hồ sơ Chủ trại."><InlineMessage tone={expired ? 'err' : 'info'} title={expired ? 'Liên kết không còn hiệu lực' : 'Email xác minh đã được gửi'}>{expired ? 'Liên kết đã hết hạn hoặc đã được sử dụng. Hãy gửi một liên kết mới.' : <>Mở liên kết được gửi tới <strong>{email}</strong>. Liên kết mới sẽ thay thế liên kết cũ.</>}</InlineMessage><div className="flex flex-wrap gap-3"><Button variant="primary" disabled={readOnly || cooldown.remaining > 0 || count >= 5} onClick={resend}>{count >= 5 ? 'Đã đạt giới hạn 5 lần / giờ' : cooldown.remaining > 0 ? `Gửi lại sau ${cooldown.remaining} giây` : 'Gửi lại email xác minh'}</Button><Button onClick={() => navigate('/ui/scr-02')}>Trở lại đăng nhập</Button></div><p className="m-0 text-xs text-subtle">Đã gửi {count}/5 lần trong giờ này.</p></Page>
}

function OnboardingForm({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  const step = screen.id === 'SCR-07' ? 'Bước 1 / 3 · Hồ sơ' : 'Bước 2 / 3 · Trang trại'
  const acceptedAtRegistration = Boolean(loadAccountDemo('SCR-03')['Tôi đồng ý với Điều khoản sử dụng và Chính sách dữ liệu'])
  const fields = fieldsFor(screen.id).filter((field) => screen.id !== 'SCR-07' || !acceptedAtRegistration || !field.label.startsWith('Tôi đồng ý'))
  return <Page screen={screen} readOnly={readOnly} sub={step}><ol className="grid list-none gap-3 border-y border-rule py-3 text-sm sm:grid-cols-3"><li className={screen.id === 'SCR-07' ? 'font-bold text-brand' : 'text-subtle'}>1 · Hồ sơ</li><li className={screen.id === 'SCR-11' ? 'font-bold text-brand' : 'text-subtle'}>{screen.id === 'SCR-11' ? '2' : '2'} · Trang trại</li><li className="text-subtle">3 · Gói dịch vụ</li></ol><AccountForm fields={fields} actionLabel={actionById[screen.id]} secondaryAction="Quay lại" onSecondary={() => navigate(screen.id === 'SCR-11' ? '/ui/scr-07' : '/ui/scr-02')} onSubmit={(values) => { saveAccountDemo(screen.id, { ...values, completed: true }); navigate(screen.id === 'SCR-07' ? '/ui/scr-11' : '/ui/scr-87') }} readOnly={readOnly} wide={screen.id === 'SCR-11'} /></Page>
}

function Profile({ screen, readOnly, role }: { screen: ScreenDefinition; readOnly: boolean; role?: ScreenRole }) {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  const platformRole = role === 'cs' || role === 'pm' || role === 'sa'
  const roleLabel = role === 'cs' ? 'Chăm sóc khách hàng (CS)' : role === 'pm' ? 'Quản lý nền tảng (PM)' : role === 'sa' ? 'Quản trị hệ thống (SA)' : role === 'manager' ? 'Quản lý' : role === 'technician' ? 'Kỹ thuật viên' : 'Chủ trại'
  return <Page screen={screen} readOnly={readOnly} sub={`Nguyễn Văn Hùng · ${roleLabel}`}><div className="border-y border-rule py-4"><InfoList items={[["Email đăng nhập",<span>owner@beefcare.local · <Badge tone="ok">Đã xác minh</Badge></span>],["Vai trò",roleLabel],[platformRole ? 'Phạm vi làm việc' : 'Trang trại hiện tại',platformRole ? 'Nền tảng BeefCare' : 'Trại bò Ba Vì']]} /></div><WorkSection title="Thông tin cá nhân"><AccountForm fields={fieldsFor('SCR-08')} actionLabel="Lưu hồ sơ" onSubmit={(values) => { saveAccountDemo('SCR-08', values); setSaved(true) }} readOnly={readOnly} /></WorkSection>{saved && <InlineMessage tone="ok" title="Đã lưu hồ sơ">Thông tin đã được lưu thành công.</InlineMessage>}<WorkSection title="Phương thức đăng nhập" actions={!readOnly && <Button small onClick={() => navigate('/ui/scr-09')}>Đổi mật khẩu</Button>}><InfoList items={[["Google",'Đã liên kết'],['Email và mật khẩu','Đã thiết lập']]} /></WorkSection>{platformRole ? <WorkSection title="Quyền nền tảng" description="Vai trò nền tảng không cấp quyền xem dữ liệu vận hành của trang trại."><InfoList items={[["Vai trò hiện tại",roleLabel],['Phạm vi',role === 'sa' ? 'Tài khoản, phân quyền và audit' : role === 'pm' ? 'Dịch vụ, đối soát và công việc nội bộ' : 'Yêu cầu hỗ trợ được phân công'],['Cấp bởi','admin@beefcare.local']]} /></WorkSection> : <WorkSection title="Quyền của tôi tại trang trại" description="Quyền được xác định theo vai trò, không chỉnh sửa tại hồ sơ cá nhân."><PermissionsTable /></WorkSection>}</Page>
}

function ChangePassword({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  const configured = loadAccountDemo('SCR-09').configured !== false
  const fields = fieldsFor(screen.id).filter((field) => configured || field.label !== 'Mật khẩu hiện tại')
  const validatePassword = (values: Record<string, string | boolean>) => { const errors: Record<string, string> = {}; const next = String(values['Mật khẩu mới'] || ''); if (next.length < 8 || next.length > 128) errors['Mật khẩu mới'] = 'Mật khẩu cần từ 8 đến 128 ký tự.'; if (next.toLowerCase() === 'owner@beefcare.local') errors['Mật khẩu mới'] = 'Mật khẩu không được trùng với email.'; if (next !== String(values['Xác nhận mật khẩu mới'] || '')) errors['Xác nhận mật khẩu mới'] = 'Mật khẩu xác nhận chưa khớp.'; return errors }
  return <Page screen={screen} readOnly={readOnly} narrow sub={configured ? 'Đổi mật khẩu cho owner@beefcare.local.' : 'Thiết lập mật khẩu cho owner@beefcare.local.'}>{!configured && <InlineMessage tone="info">Xác thực lại với Google trong 5 phút gần nhất trước khi thêm mật khẩu đầu tiên.</InlineMessage>}<AccountForm fields={fields} actionLabel={configured ? actionById[screen.id] : 'Thiết lập mật khẩu'} secondaryAction="Hủy" onSecondary={() => navigate('/ui/scr-08')} validate={validatePassword} onSubmit={(values) => { saveAccountDemo('SCR-09', { ...values, configured: true }); saveAccountDemo('sign-in-message', { success: true }); navigate('/ui/scr-08') }} readOnly={readOnly} /><InlineMessage tone="warn">Lưu mật khẩu sẽ kết thúc các phiên đăng nhập khác.</InlineMessage></Page>
}

function FarmSelect({ screen, readOnly, role, empty = false }: { screen: ScreenDefinition; readOnly: boolean; role?: ScreenRole; empty?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useFixtureSession()
  const owner = role === undefined || role === 'owner'
  const identity = role === 'technician' ? 'Lê Minh An · technician@beefcare.local' : role === 'manager' ? 'Trần Quốc Long · manager@beefcare.local' : 'Nguyễn Văn Hùng · owner@beefcare.local'
  const returnTo = typeof location.state === 'object' && location.state && 'returnTo' in location.state && typeof location.state.returnTo === 'string' && location.state.returnTo.startsWith('/ui/') && location.state.returnTo !== '/ui/scr-10'
    ? location.state.returnTo
    : undefined
  if (empty) return <Page screen={screen} readOnly={readOnly} sub={identity} narrow><EmptyState title="Tài khoản chưa thuộc trang trại nào" description={owner ? 'Chủ trại có thể đăng ký trang trại mới; người được mời cần mở đúng liên kết lời mời.' : 'Tài khoản chưa có trang trại được cấp quyền trong phạm vi này.'} actionLabel={owner ? 'Đăng ký trang trại' : undefined} onAction={owner ? () => navigate('/ui/scr-11') : undefined} /></Page>
  return <Page screen={screen} readOnly={readOnly} sub={identity} actions={<><Button variant="link" onClick={() => navigate('/ui/scr-02')}>Đăng xuất</Button>{owner && !readOnly && <Button variant="primary" onClick={() => navigate('/ui/scr-11')}>Đăng ký trang trại mới</Button>}</>}><WorkSection title="Trang trại của bạn" description="Trạng thái dịch vụ quyết định hành động có thể thực hiện."><Table wide scroll><thead><tr><Th>Trang trại</Th><Th>Vai trò của bạn</Th><Th>Dịch vụ</Th><Th>Quy mô đàn</Th><Th /></tr></thead><tbody>{farmRows.map((farm) => { const rowOwner = farm.role === 'Chủ trại'; const active = farm.statusCode === 'ACTIVE'; const blockedForMember = !rowOwner && !active; const action = active ? 'Vào trang trại' : farm.statusCode === 'PENDING_PAYMENT' ? 'Thanh toán để kích hoạt' : farm.statusCode === 'EXPIRED' ? 'Gia hạn' : 'Gửi yêu cầu hỗ trợ'; const destination = active ? (farm.role === 'Kỹ thuật viên' ? '/ui/scr-104' : returnTo ?? '/ui/scr-77') : farm.statusCode === 'SUSPENDED' ? '/ui/scr-94' : '/ui/scr-87'; return <tr key={farm.name}><Td><strong>{farm.name}</strong><span className="mt-1 block text-xs text-subtle">{farm.address}</span></Td><Td>{farm.role}</Td><Td><Badge tone={active ? 'ok' : farm.statusCode === 'SUSPENDED' ? 'err' : 'warn'}>{farm.status}</Badge><span className="mt-1 block text-xs text-subtle">{farm.service}</span></Td><Td>{farm.herd}</Td><Td><div className="flex flex-col items-start gap-1"><Button small disabled={readOnly || blockedForMember} onClick={() => { saveAccountDemo('farm-selection', { farm: farm.name, role: farm.role }); const selected = loadOrders().find((row) => row.name === farm.name); if (selected) saveSelectedFarmId(selected.id); const selectedRole = farm.role === 'Kỹ thuật viên' ? 'technician' : farm.role === 'Quản lý' ? 'manager' : 'owner'; session.dispatch({ type: 'set-role', role: selectedRole }); navigate(destination) }}>{action}</Button>{blockedForMember && <span className="text-xs text-subtle">Chủ trại quản lý gói dịch vụ</span>}</div></Td></tr> })}</tbody></Table></WorkSection></Page>
}

function FarmInformation({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  return <Page screen={screen} readOnly={readOnly} sub="Thông tin đăng ký, liên hệ và lịch vận hành của Trại bò Ba Vì."><WorkSection title="Thông tin trại và vận hành"><AccountForm fields={fieldsFor('SCR-12')} actionLabel="Lưu thay đổi" onSubmit={(values) => { saveAccountDemo('SCR-12', values); setSaved(true) }} readOnly={readOnly} wide /></WorkSection>{saved && <InlineMessage tone="ok" title="Đã lưu thông tin trại">Thông tin trang trại đã được lưu.</InlineMessage>}<WorkSection title="Tóm tắt dịch vụ" actions={<Button small onClick={() => navigate('/ui/scr-86')}>Xem gói dịch vụ</Button>}><SummaryStrip items={[{label:'Trạng thái',value:'Đang hoạt động',note:'Không tạm ngừng'},{label:'Kỳ hiện tại đến',value:'31/12/2027'},{label:'Mở gia hạn từ',value:'02/10/2027'},{label:'Còn lại',value:'423 ngày'}]} /><p className="mb-0 mt-4 text-xs text-subtle">Chủ trại: owner@beefcare.local</p></WorkSection></Page>
}

function ServiceOverview({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả')
  const [sortAsc, setSortAsc] = useState(true)
  const allRows = serviceFarmRows.map((row) => { const mutation = demoRows<{ farm: string; status: string }>('service-status', []).find((item) => item.farm === row.farm); return mutation ? { ...row, status: mutation.status, suspended: mutation.status === 'Tạm ngừng' ? 'Có · người dùng' : 'Không' } : row })
  const rows = allRows.filter((row) => (!search || `${row.farm} ${row.owner} ${row.email}`.toLowerCase().includes(search.toLowerCase())) && (statusFilter === 'Tất cả' || row.status === statusFilter)).sort((a, b) => sortAsc ? a.farm.localeCompare(b.farm, 'vi') : b.farm.localeCompare(a.farm, 'vi'))
  const count = (status: string) => allRows.filter((row) => row.status === status).length
  return <Page screen={screen} readOnly={readOnly} sub="PM theo dõi phạm vi dịch vụ; không hiển thị hồ sơ bò hoặc dữ liệu chăm sóc."><SummaryStrip items={[{label:'Tổng trang trại',value:String(allRows.length)},{label:'Đang hoạt động',value:`${count('Đang hoạt động')} · ${Math.round(count('Đang hoạt động') / allRows.length * 100)}%`},{label:'Chờ thanh toán',value:String(count('Chờ thanh toán'))},{label:'Đã hết hạn',value:String(count('Đã hết hạn'))},{label:'Tạm ngừng',value:String(count('Tạm ngừng'))}]} /><div className="flex flex-wrap gap-2">{['Tất cả','Đang hoạt động','Chờ thanh toán','Đã hết hạn','Tạm ngừng'].map((status) => <Button key={status} small variant={statusFilter === status ? 'primary' : undefined} onClick={() => setStatusFilter(status)}>{status}</Button>)}</div><WorkSection title="Danh sách dịch vụ"><FilterBar><input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputCls} min-w-64 flex-1`} aria-label="Tìm tên trại hoặc email Chủ trại" placeholder="Tìm tên trại hoặc email Chủ trại" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={`${inputCls} w-48`} aria-label="Trạng thái dịch vụ">{['Tất cả','Đang hoạt động','Chờ thanh toán','Đã hết hạn','Tạm ngừng'].map((status) => <option key={status}>{status}</option>)}</select></FilterBar><Table wide scroll><thead><tr><Th><button className="font-semibold" onClick={() => setSortAsc((current) => !current)}>Trang trại {sortAsc ? '↑' : '↓'}</button></Th><Th>Chủ trại</Th><Th>Dịch vụ</Th><Th>Ngày kết thúc phạm vi</Th><Th>Tạm ngừng</Th><Th>Quy mô đàn</Th><Th /></tr></thead><tbody>{rows.map((farm) => <tr key={farm.farm}><Td><strong>{farm.farm}</strong></Td><Td>{farm.owner}<span className="block text-xs text-subtle">{farm.email}</span></Td><Td><Badge tone={farm.status === 'Đang hoạt động' ? 'ok' : farm.status === 'Tạm ngừng' ? 'err' : 'warn'}>{farm.status}</Badge></Td><Td>{farm.coverage}</Td><Td>{farm.suspended}</Td><Td>{farm.herd} con</Td><Td><div className="flex flex-wrap gap-2"><Button small disabled={readOnly} onClick={() => { saveAccountDemo('selected-service', { farm: farm.farm, status: farm.status, herd: farm.herd, owner: farm.email, coverage: farm.coverage }); navigate('/ui/scr-14') }}>{farm.status === 'Tạm ngừng' ? 'Khôi phục' : 'Tạm ngừng'}</Button><Button small onClick={() => navigate('/ui/scr-90')}>Xem gói</Button></div></Td></tr>)}</tbody></Table>{rows.length === 0 && <EmptyState compact title="Không có trang trại phù hợp" description="Thử bỏ bớt bộ lọc hoặc tìm bằng email Chủ trại." />}</WorkSection></Page>
}

function ServiceChange({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  const selected = loadAccountDemo('selected-service')
  const nextStatus = selected.status === 'Tạm ngừng' ? 'Đang hoạt động' : 'Tạm ngừng'
  const actionLabel = nextStatus === 'Tạm ngừng' ? 'Tạm ngừng dịch vụ' : 'Khôi phục dịch vụ'
  const restoredStatus = selected.coverage && selected.coverage !== '—' ? 'Đang hoạt động' : 'Đã hết hạn'
  const [pendingValues, setPendingValues] = useState<Record<string, string | boolean> | null>(null)
  const confirmChange = () => {
    if (!pendingValues) return
    const current = demoRows<{ farm: string; status: string }>('service-status', []).filter((item) => item.farm !== String(selected.farm || 'Trại bò Ba Vì'))
    saveAccountValue('service-status', [...current, { farm: String(selected.farm || 'Trại bò Ba Vì'), status: nextStatus === 'Đang hoạt động' ? restoredStatus : nextStatus, reason: String(pendingValues['Lý do'] || '') }])
    setPendingValues(null)
    navigate('/ui/scr-13')
  }
  return <Page screen={screen} readOnly={readOnly} narrow sub={nextStatus === 'Tạm ngừng' ? 'Tạm ngừng nhận hồ sơ mới cho trang trại.' : 'Mở lại dịch vụ cho trang trại đã được chọn.'}><WorkSection title="Trang trại được chọn"><InfoList items={[["Trang trại",selected.farm || 'Trại bò Ba Vì'],["Chủ trại",selected.owner || 'owner@beefcare.local'],["Quy mô đàn",`${selected.herd || 328} con`],["Trạng thái hiện tại",<Badge tone={selected.status === 'Tạm ngừng' ? 'err' : 'ok'}>{selected.status || 'Đang hoạt động'}</Badge>],["Tạm ngừng từ",selected.status === 'Tạm ngừng' ? '28/10/2026 · PM BeefCare' : '—'],["Kỳ đã mua",`${selected.coverage || '31/12/2027'} · không thay đổi`],["Sau khi khôi phục",nextStatus === 'Đang hoạt động' ? restoredStatus : '—']]} /></WorkSection>{selected.status === 'Tạm ngừng' && <InlineMessage tone="info" title="Lý do tạm ngừng trước đó">Chờ bổ sung hồ sơ xác minh dịch vụ.</InlineMessage>}<InlineMessage tone="warn" title="Thời hạn đã mua không thay đổi">Tạm ngừng dịch vụ không cộng thêm ngày vào kỳ đã xác nhận.</InlineMessage><AccountForm fields={accountFields[screen.id]} actionLabel={actionLabel} secondaryAction="Hủy" onSecondary={() => navigate('/ui/scr-13')} onSubmit={(values) => setPendingValues(values)} readOnly={readOnly} /><ActionDialog open={Boolean(pendingValues)} title={actionLabel} description={`${actionLabel} cho ${String(selected.farm || 'trang trại này')}?`} confirmLabel="Xác nhận" confirmTone="danger" onCancel={() => setPendingValues(null)} onConfirm={confirmChange} /></Page>
}

function Members({ screen, state, role }: { screen: ScreenDefinition; state: ReviewState; role?: ScreenRole }) {
  const readOnly = state === 'read-only' || role === 'manager'
  const navigate = useNavigate()
  const [members, setMembers] = useState(() => demoRows('members', accountMembers))
  const [tab, setTab] = useState('Tất cả')
  const [query, setQuery] = useState('')
  const tabs = ['Tất cả', 'Quản lý', 'Kỹ thuật viên', ...(!readOnly ? ['Ngừng hoạt động'] : [])]
  const visible = members.filter((member) => (!query || `${member.name} ${member.email}`.toLowerCase().includes(query.toLowerCase())) && (tab === 'Tất cả' || tab === 'Quản lý' && member.role === 'Quản lý' || tab === 'Kỹ thuật viên' && member.role === 'Kỹ thuật viên' || tab === 'Ngừng hoạt động' && member.status === 'Ngừng hoạt động'))
  return <Page screen={screen} readOnly={readOnly} sub="Chủ trại quản lý thành viên; Quản lý chỉ xem danh sách và bảng quyền." actions={!readOnly && <><Button onClick={() => navigate('/ui/scr-17')}>Lời mời</Button><Button variant="primary" onClick={() => navigate('/ui/scr-16')}>Mời thành viên</Button></>}><WorkSection title="Danh sách thành viên"><div className="mb-4 flex flex-wrap gap-2 border-b border-rule pb-3">{tabs.map((item) => <Button key={item} small variant={tab === item ? 'primary' : undefined} onClick={() => setTab(item)}>{item} ({item === 'Tất cả' ? members.length : item === 'Ngừng hoạt động' ? members.filter((row) => row.status === 'Ngừng hoạt động').length : members.filter((row) => row.role === item).length})</Button>)}</div><FilterBar><input className={`${inputCls} min-w-64 flex-1`} aria-label="Tìm thành viên" placeholder="Tìm tên hoặc email" value={query} onChange={(event) => setQuery(event.target.value)} /></FilterBar>{visible.length ? <Table wide scroll><thead><tr><Th>Thành viên</Th><Th>Vai trò</Th><Th>Trạng thái</Th><Th>Tháng tham gia</Th><Th /></tr></thead><tbody>{visible.map((member) => <tr key={member.email}><Td><strong>{member.name}</strong><span className="block text-xs text-subtle">{member.email}</span></Td><Td>{member.role}</Td><Td><Badge tone={member.status === 'Đang hoạt động' ? 'ok' : 'warn'}>{member.status}</Badge></Td><Td>{member.joined}</Td><Td>{!readOnly && member.role !== 'Chủ trại' && <Button small onClick={() => { saveAccountDemo('selected-member', { email: member.email }); navigate('/ui/scr-18') }}>{member.status === 'Ngừng hoạt động' ? 'Kích hoạt lại' : 'Đổi vai trò · Ngừng'}</Button>}</Td></tr>)}</tbody></Table> : <EmptyState compact title="Không có thành viên phù hợp" description="Thử đổi tab hoặc xóa nội dung tìm kiếm." />}</WorkSection><WorkSection title="Quyền theo vai trò" description="Bảng quyền dùng để đối chiếu phạm vi thao tác của từng vai trò."><PermissionsTable /></WorkSection></Page>
}

function Invite({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  const [inviteRole, setInviteRole] = useState(() => String(loadAccountDemo('invite-role').role || 'Kỹ thuật viên'))
  const permissions = inviteRole === 'Quản lý'
    ? ['Xem và quản lý hồ sơ đàn bò, lịch chăm sóc và công việc của trại.', 'Xem danh sách thành viên; không mời hoặc thay đổi vai trò.', 'Không quản lý đăng ký dịch vụ hoặc thông tin thanh toán.']
    : ['Xem hồ sơ đàn bò và lịch sử chăm sóc.', 'Ghi nhận công việc theo quyền cố định của vai trò.', 'Không quản lý thành viên hoặc đăng ký dịch vụ.']
  const validateInvite = (values: Record<string, string | boolean>): Record<string, string> => { const email = String(values['Email người nhận'] || '').toLowerCase(); const duplicateMember = demoRows('members', accountMembers).some((member) => member.email.toLowerCase() === email); const duplicateInvite = demoRows('invitations', invitationRows).some((invite) => invite.email.toLowerCase() === email && invite.status === 'Đang chờ'); return duplicateMember ? { 'Email người nhận': 'Email này đã là thành viên của trang trại.' } : duplicateInvite ? { 'Email người nhận': 'Email này đã có lời mời đang chờ.' } : {} }
  return <Page screen={screen} readOnly={readOnly} narrow sub="Mời một Quản lý hoặc Kỹ thuật viên vào đúng trang trại."><AccountForm fields={fieldsFor(screen.id)} actionLabel={actionById[screen.id]} secondaryAction="Hủy" onSecondary={() => navigate('/ui/scr-15')} validate={validateInvite} onFieldChange={(label, value) => { if (label === 'Vai trò') { const nextRole = String(value); setInviteRole(nextRole); saveAccountDemo('invite-role', { role: nextRole }) } }} onSubmit={(values) => { const role = String(values['Vai trò'] || inviteRole); const row = { email: String(values['Email người nhận'] || 'new@example.vn'), hint: 'Người dùng', role, sent: 'Vừa gửi', expires: String(values['Hiệu lực lời mời'] || '7 ngày'), status: 'Đang chờ' }; saveAccountDemo('invite-role', { role }); saveAccountValue('invitations', [...demoRows('invitations', invitationRows), row]); navigate('/ui/scr-17') }} readOnly={readOnly} /><WorkSection title={`Quyền của ${inviteRole}`}><ul className="m-0 space-y-2 pl-5 text-sm text-ink">{permissions.map((permission) => <li key={permission}>{permission}</li>)}</ul></WorkSection></Page>
}

function Invitations({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState(() => demoRows('invitations', invitationRows))
  const [status, setStatus] = useState('Tất cả')
  const [pendingCancel, setPendingCancel] = useState<string | null>(null)
  const updateRow = (email: string, nextStatus: string) => { if (nextStatus === 'Đã hủy') { setPendingCancel(email); return }; const next = rows.map((row) => row.email === email ? { ...row, status: nextStatus, sent: nextStatus === 'Đang chờ' ? 'Vừa gửi lại' : row.sent } : row); setRows(next); saveAccountValue('invitations', next) }
  const confirmCancel = () => { if (!pendingCancel) return; const next = rows.map((row) => row.email === pendingCancel ? { ...row, status: 'Đã hủy' } : row); setRows(next); saveAccountValue('invitations', next); setPendingCancel(null) }
  const visible = rows.filter((row) => status === 'Tất cả' || row.status === status)
  return <Page screen={screen} readOnly={readOnly} sub="Theo dõi vòng đời lời mời và xử lý các lời mời đang chờ." actions={!readOnly && <Button variant="primary" onClick={() => navigate('/ui/scr-16')}>Mời thành viên</Button>}><WorkSection title="Lời mời"><FilterBar><select value={status} onChange={(event) => setStatus(event.target.value)} className={`${inputCls} w-48`} aria-label="Trạng thái lời mời"><option>Tất cả</option><option>Đang chờ</option><option>Đã chấp nhận</option><option>Đã hết hạn</option><option>Đã hủy</option></select></FilterBar>{visible.length ? <Table wide scroll><thead><tr><Th>Người nhận</Th><Th>Vai trò</Th><Th>Gửi gần nhất</Th><Th>Hết hạn lúc</Th><Th>Trạng thái</Th><Th /></tr></thead><tbody>{visible.map((row) => <tr key={row.email}><Td><strong>{row.email}</strong><span className="block text-xs text-subtle">{row.hint}</span></Td><Td>{row.role}</Td><Td>{row.sent}</Td><Td>{row.expires}</Td><Td><Badge tone={row.status === 'Đang chờ' ? 'warn' : row.status === 'Đã chấp nhận' ? 'ok' : undefined}>{row.status}</Badge></Td><Td>{!readOnly && row.status === 'Đang chờ' && <div className="flex gap-2"><Button small onClick={() => updateRow(row.email, 'Đang chờ')}>Gửi lại</Button><Button small onClick={() => updateRow(row.email, 'Đã hủy')}>Hủy</Button></div>}</Td></tr>)}</tbody></Table> : <EmptyState compact title="Không có lời mời ở trạng thái này" description="Đổi trạng thái lọc hoặc tạo lời mời mới." />}</WorkSection><ActionDialog open={Boolean(pendingCancel)} title="Hủy lời mời" description={`Hủy lời mời gửi tới ${pendingCancel || ''}?`} confirmLabel="Xác nhận hủy" confirmTone="danger" onCancel={() => setPendingCancel(null)} onConfirm={confirmCancel} /></Page>
}

function MemberChange({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  const selected = loadAccountDemo('selected-member')
  const selectedEmail = String(selected.email || 'manager@beefcare.local')
  const members = demoRows<typeof accountMembers[number]>('members', accountMembers)
  const target = members.find((member) => member.email === selectedEmail) || accountMembers.find((member) => member.email === selectedEmail) || accountMembers[0]
  const inactive = target.status === 'Ngừng hoạt động'
  const [action, setAction] = useState(inactive ? 'Kích hoạt lại' : 'Đổi vai trò')
  const [pendingValues, setPendingValues] = useState<Record<string, string | boolean> | null>(null)
  const fields = fieldsFor(screen.id).filter((field) => action === 'Đổi vai trò' || field.label !== 'Vai trò mới').map((field) => {
    if (field.label === 'Thành viên') return { ...field, value: `${target.name} · ${target.email}` }
    if (field.label === 'Hành động') return { ...field, options: inactive ? ['Kích hoạt lại'] : ['Đổi vai trò', 'Ngừng hoạt động'], value: action }
    return field
  })
  const validateChange = (values: Record<string, string | boolean>) => {
    const errors: Record<string, string> = {}
    const selectedAction = String(values['Hành động'] || action)
    if (selectedAction === 'Đổi vai trò' && String(values['Vai trò mới'] || '') === target.role) errors['Vai trò mới'] = 'Vai trò mới phải khác vai trò hiện tại.'
    if (String(values['Ngày hiệu lực'] || '') > new Date().toISOString().slice(0, 10)) errors['Ngày hiệu lực'] = 'Ngày hiệu lực không được ở tương lai.'
    return errors
  }
  const confirmChange = () => { if (!pendingValues) return; const selectedAction = String(pendingValues['Hành động'] || action); const role = String(pendingValues['Vai trò mới'] || target.role); const next = members.map((member) => member.email === selectedEmail ? { ...member, role: selectedAction === 'Đổi vai trò' ? role : member.role, status: selectedAction === 'Ngừng hoạt động' ? 'Ngừng hoạt động' : selectedAction === 'Kích hoạt lại' ? 'Đang hoạt động' : member.status } : member); saveAccountValue('members', next); saveAccountDemo('member-change', { ...pendingValues, email: selectedEmail }); setPendingValues(null); navigate('/ui/scr-15') }
  return <Page screen={screen} readOnly={readOnly} narrow sub={`Cập nhật quyền và trạng thái của ${target.name}.`}><InlineMessage tone="warn">Ngừng hoạt động sẽ chặn truy cập trang trại nhưng không xóa lịch sử đã ghi.</InlineMessage><AccountForm fields={fields} actionLabel={actionById[screen.id]} secondaryAction="Hủy" onSecondary={() => navigate('/ui/scr-15')} validate={validateChange} onFieldChange={(label, value) => { if (label === 'Hành động') setAction(String(value)) }} onSubmit={(values) => setPendingValues(values)} readOnly={readOnly} /><ActionDialog open={Boolean(pendingValues)} title="Xác nhận thay đổi thành viên" description={`${String(pendingValues?.['Hành động'] || action)} cho ${target.name} từ ${String(pendingValues?.['Ngày hiệu lực'] || 'hôm nay')}?`} confirmLabel="Xác nhận" confirmTone="danger" onCancel={() => setPendingValues(null)} onConfirm={confirmChange} /></Page>
}

function AcceptInvitation({ screen, readOnly }: { screen: ScreenDefinition; readOnly: boolean }) {
  const navigate = useNavigate()
  return <Page screen={screen} readOnly={readOnly} narrow sub="Kiểm tra đúng trang trại, vai trò và email trước khi chấp nhận."><div className="border-y border-rule py-4"><InfoList items={[["Trạng thái",<Badge tone="warn">Đang chờ</Badge>],['Trang trại','Trại bò Ba Vì'],['Vai trò','Kỹ thuật viên'],['Người mời','Nguyễn Văn Hùng'],['Gửi lúc','01/11/2026 09:15'],['Hết hạn lúc','08/11/2026 09:15'],['Email được mời','an.nguyen@example.vn'],['Email đăng nhập','an.nguyen@example.vn']]} /></div><WorkSection title="Quyền khi tham gia"><p className="m-0 text-sm leading-6 text-subtle">Xem hồ sơ bò, quét QR, xem lịch chăm sóc và ghi nhận các tác vụ được phân công; không quản lý thành viên hoặc dịch vụ.</p></WorkSection>{!readOnly && <div className="flex flex-wrap justify-end gap-2"><Button onClick={() => navigate('/ui/scr-10')}>Quyết định sau</Button><Button variant="primary" onClick={() => { saveAccountDemo('membership', { accepted: true, role: 'technician' }); navigate('/ui/scr-104') }}>Chấp nhận và vào trại</Button></div>}</Page>
}

export function AccountScreen({ screen, state, role }: { screen: ScreenDefinition; state: ReviewState; role?: ScreenRole }) {
  const navigate = useNavigate()
  if (state === 'loading') return <LoadingState label={`Đang tải ${screen.viTitle.toLowerCase()}…`} />
  if (state === 'error') return <InlineMessage tone="err" title={`Không thể tải ${screen.viTitle.toLowerCase()}.`}>Kiểm tra kết nối hoặc thử lại; dữ liệu đã nhập chưa được gửi.</InlineMessage>
  if (state === 'empty') {
    if (screen.id === 'SCR-10') return <FarmSelect screen={screen} readOnly={false} role={role} empty />
    if (screen.id === 'SCR-17') return <EmptyState title="Chưa có lời mời thành viên" description="Tạo lời mời cho Quản lý hoặc Kỹ thuật viên của trang trại." actionLabel="Mời thành viên" onAction={() => navigate('/ui/scr-16')} />
    return <EmptyState title={`Chưa có dữ liệu cho ${screen.viTitle.toLowerCase()}`} description="Chưa có bản ghi phù hợp. Thử thay đổi bộ lọc hoặc tạo bản ghi mới." />
  }
  const readOnly = state === 'read-only'

  switch (screen.id) {
    case 'SCR-01': return <Landing screen={screen} />
    case 'SCR-02': case 'SCR-03': case 'SCR-05': case 'SCR-06': return <AuthenticationForm screen={screen} readOnly={readOnly} />
    case 'SCR-04': return <VerifyEmail screen={screen} readOnly={readOnly} />
    case 'SCR-07': case 'SCR-11': return <OnboardingForm screen={screen} readOnly={readOnly} />
    case 'SCR-08': return <Profile screen={screen} readOnly={readOnly} role={role} />
    case 'SCR-09': return <ChangePassword screen={screen} readOnly={readOnly} />
    case 'SCR-10': return <FarmSelect screen={screen} readOnly={readOnly} role={role} />
    case 'SCR-12': return <FarmInformation screen={screen} readOnly={readOnly} />
    case 'SCR-13': return <ServiceOverview screen={screen} readOnly={readOnly} />
    case 'SCR-14': return <ServiceChange screen={screen} readOnly={readOnly} />
    case 'SCR-15': return <Members screen={screen} state={state} role={role} />
    case 'SCR-16': return <Invite screen={screen} readOnly={readOnly} />
    case 'SCR-17': return <Invitations screen={screen} readOnly={readOnly} />
    case 'SCR-18': return <MemberChange screen={screen} readOnly={readOnly} />
    case 'SCR-19': return <AcceptInvitation screen={screen} readOnly={readOnly} />
    default: return <InlineMessage tone="warn" title="Chưa có giao diện chuyên biệt">Màn hình này không thuộc nhóm tài khoản, trang trại hoặc thành viên.</InlineMessage>
  }
}
