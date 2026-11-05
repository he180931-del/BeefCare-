import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Badge, Button, Field, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, InlineMessage, LoadingState, SummaryStrip, WorkSection } from '../../../components/workspace'
import { platformConfigFor, staffAccessRows, userAccountRows } from '../data/platformFixtures'
import { previewStaffAccess, previewUserAccounts } from '../data/platformPreviewData'
import { AUDIT_ACTIONS, AUDIT_TARGETS, loadAuditRecords } from '../auditStore'

const auditActionLabel: Record<string, string> = {
  ACCOUNT_SUSPENDED: 'Tạm ngừng tài khoản', ACCOUNT_REACTIVATED: 'Khôi phục tài khoản', PLATFORM_ACCESS_GRANTED: 'Cấp quyền nền tảng', PLATFORM_ACCESS_REVOKED: 'Thu hồi quyền nền tảng',
  MEMBERSHIP_ROLE_CHANGED: 'Đổi vai trò thành viên', MEMBERSHIP_SUSPENDED: 'Tạm ngừng thành viên', FARM_SERVICE_RESTORED: 'Khôi phục dịch vụ trang trại', FARM_SERVICE_SUSPENDED: 'Tạm ngừng dịch vụ trang trại',
  PAYMENT_CONFIRMED: 'Xác nhận thanh toán', PAYMENT_HOLD: 'Tạm giữ thanh toán', PAYMENT_REJECTED: 'Từ chối thanh toán', FINANCE_RECORD_POSTED: 'Ghi nhận giao dịch tài chính', FINANCE_RECORD_VOIDED: 'Hủy giao dịch tài chính',
  TICKET_ASSIGNED: 'Giao yêu cầu hỗ trợ', TICKET_CLOSED: 'Đóng yêu cầu hỗ trợ', INTERNAL_REQUEST_COMPLETED: 'Hoàn tất yêu cầu nội bộ',
}
const auditTargetLabel: Record<string, string> = { Account: 'Tài khoản', 'Platform access': 'Quyền nền tảng', Membership: 'Thành viên', Farm: 'Trang trại', Payment: 'Thanh toán', 'Finance record': 'Giao dịch tài chính', Ticket: 'Yêu cầu hỗ trợ', 'Internal request': 'Yêu cầu nội bộ' }
const auditActor = (value: string) => value === 'System' ? 'Hệ thống' : value
const auditValue = (value: string) => value.replace(/\bSUSPENDED\b/g, 'Tạm ngừng').replace(/\bACTIVE\b/g, 'Đang hoạt động').replace(/\bPENDING\b/g, 'Chờ xử lý').replace(/\bCONFIRMED\b/g, 'Đã xác nhận')

function Shell({ screen, readOnly, sub, actions, children }: { screen: ScreenDefinition; readOnly: boolean; sub: string; actions?: ReactNode; children: ReactNode }) {
  return <div className="flex flex-col gap-6"><PageHeader title={screen.viTitle} sub={sub} badge={readOnly ? <span className="text-xs font-semibold text-subtle">Chỉ xem</span> : <span className="text-xs font-semibold text-subtle">Quản trị nền tảng</span>}>{actions}</PageHeader>{children}</div>
}

const PLATFORM_ACCESS_KEY = 'beefcare-platform-access-demo'
function loadPlatformRows<T>(scope: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback
  try { const parsed = JSON.parse(window.localStorage.getItem(PLATFORM_ACCESS_KEY) || '{}') as Record<string, unknown>; return Array.isArray(parsed[scope]) ? parsed[scope] as T[] : fallback } catch { return fallback }
}
function savePlatformRows(scope: string, rows: unknown[]) {
  if (typeof window === 'undefined') return
  try { const parsed = JSON.parse(window.localStorage.getItem(PLATFORM_ACCESS_KEY) || '{}') as Record<string, unknown>; window.localStorage.setItem(PLATFORM_ACCESS_KEY, JSON.stringify({ ...parsed, [scope]: rows })) } catch { /* preview persistence is best effort */ }
}

function UserAccounts({ screen, state }: { screen: ScreenDefinition; state: ReviewState }) {
  const navigate = useNavigate()
  const readOnly = state === 'read-only'
  const [storedRows, setStoredRows] = useState(() => loadPlatformRows('accounts', userAccountRows))
  const rows = previewUserAccounts(storedRows)
  const [selectedEmail, setSelectedEmail] = useState(storedRows[0]?.email || '')
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('Tất cả trạng thái'); const [platformRole, setPlatformRole] = useState('Tất cả vai trò'); const [reason, setReason] = useState(''); const [error, setError] = useState('')
  const visible = rows.filter((row) => (!query || `${row.name} ${row.email}`.toLowerCase().includes(query.toLowerCase())) && (status === 'Tất cả trạng thái' || row.status === status) && (platformRole === 'Tất cả vai trò' || row.platformRole === platformRole))
  const selected = rows.find((row) => row.email === selectedEmail) || visible[0]
  const selectedPreview = Boolean(selected?.__stressGenerated)
  const changeStatus = () => { if (!selected || selectedPreview) return; if (!reason.trim()) { setError('Nhập lý do trước khi thay đổi trạng thái tài khoản.'); return }; const next = storedRows.map((row) => row.email === selected.email ? { ...row, status: row.status === 'Đang hoạt động' ? 'Tạm ngừng' : 'Đang hoạt động' } : row); setStoredRows(next); savePlatformRows('accounts', next); setReason(''); setError('') }
  const openDetails = (email: string) => { setSelectedEmail(email); setError(''); window.setTimeout(() => document.getElementById('platform-account-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }
  return <Shell screen={screen} readOnly={readOnly} sub="SA tra cứu trạng thái tài khoản mà không xem mật khẩu, nội dung ticket hoặc dữ liệu vận hành trang trại."><SummaryStrip items={[{label:'Tổng tài khoản',value:String(rows.length)},{label:'Đang hoạt động',value:String(rows.filter((row) => row.status === 'Đang hoạt động').length)},{label:'Tạm ngừng',value:String(rows.filter((row) => row.status === 'Tạm ngừng').length)},{label:'Có vai trò nền tảng',value:String(rows.filter((row) => row.platformRole !== 'Không có').length)}]} /><WorkSection title="Danh sách tài khoản"><FilterBar><input aria-label="Tìm tài khoản" value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputCls} min-w-64 flex-1`} placeholder="Tìm họ tên hoặc email" /><select aria-label="Trạng thái tài khoản" value={status} onChange={(event) => setStatus(event.target.value)} className={`${inputCls} w-44`}><option>Tất cả trạng thái</option><option>Đang hoạt động</option><option>Tạm ngừng</option></select><select aria-label="Vai trò nền tảng" value={platformRole} onChange={(event) => setPlatformRole(event.target.value)} className={`${inputCls} w-44`}><option>Tất cả vai trò</option><option>Không có</option><option>CS</option><option>PM</option><option>SA</option></select></FilterBar>{visible.length ? <Table wide scroll><thead><tr><Th>Người dùng</Th><Th>Vai trò nền tảng</Th><Th>Trang trại tham gia</Th><Th>Trạng thái</Th><Th /></tr></thead><tbody>{visible.map((row) => <tr key={row.email}><Td><strong>{row.name}</strong><span className="block text-xs text-subtle">{row.email}</span></Td><Td>{row.platformRole}</Td><Td>{row.farms}</Td><Td><Badge tone={row.status === 'Đang hoạt động' ? 'ok' : 'err'}>{row.status}</Badge></Td><Td><Button small onClick={() => openDetails(row.email)}>Xem chi tiết</Button></Td></tr>)}</tbody></Table> : <EmptyState compact title="Không tìm thấy tài khoản" description="Thử email đầy đủ hoặc xóa bộ lọc." />}</WorkSection>{selected && <div id="platform-account-detail"><WorkSection title="Chi tiết tài khoản đang chọn" description={selectedPreview ? 'Dữ liệu thử để kiểm tra danh sách dài; chỉ xem và không lưu.' : 'Chỉ hiển thị trường quản trị được phép.'}>{selectedPreview && <InlineMessage tone="info" title="Dữ liệu thử · chỉ xem">Chọn một tài khoản thật để thay đổi trạng thái hoặc quyền nền tảng.</InlineMessage>}<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)]"><dl className="m-0 grid gap-4 sm:grid-cols-2">{[['Email và xác minh',`${selected.email} · ${selected.verified}`],['Tạo lúc',selected.createdAt],['Đăng nhập gần nhất',selected.lastSignIn],['Trang trại tham gia',selected.farms],['Trạng thái',selected.status],['Vai trò nền tảng',selected.platformRole]].map(([label,value]) => <div key={label}><dt className="text-xs text-subtle">{label}</dt><dd className="m-0 mt-1 text-sm font-semibold text-ink">{value}</dd></div>)}</dl>{!selectedPreview && <form onSubmit={(event) => { event.preventDefault(); changeStatus() }}><Field id="account-status-reason" label="Lý do *" hint="Bắt buộc khi thay đổi trạng thái; tối đa 500 ký tự."><textarea id="account-status-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className={`${inputCls} min-h-24`} disabled={readOnly} /></Field>{error && <p className="text-xs text-err-fg">{error}</p>}{!readOnly && <div className="mt-4 flex flex-wrap gap-2"><Button type="submit" variant={selected.status === 'Đang hoạt động' ? 'danger' : 'primary'}>{selected.status === 'Đang hoạt động' ? 'Tạm ngừng tài khoản' : 'Khôi phục tài khoản'}</Button><Button type="button" onClick={() => navigate('/ui/scr-21')}>Mở quyền nền tảng</Button></div>}</form>}</div></WorkSection></div>}</Shell>
}

function StaffAccess({ screen, state }: { screen: ScreenDefinition; state: ReviewState }) {
  const readOnly = state === 'read-only'
  const [storedRows, setStoredRows] = useState(() => loadPlatformRows('staff', staffAccessRows))
  const rows = previewStaffAccess(storedRows)
  const grantCandidates = userAccountRows.filter((account) => !storedRows.some((row) => row.email === account.email))
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('Tất cả vai trò')
  const [selectedEmail, setSelectedEmail] = useState(rows[0]?.email || grantCandidates[0]?.email || '')
  const [action, setAction] = useState<'Cấp' | 'Đổi' | 'Thu hồi' | 'Khôi phục'>(rows[0] ? (rows[0].status === 'Đã thu hồi' ? 'Khôi phục' : 'Đổi') : 'Cấp')
  const [role, setRole] = useState(rows[0]?.role || 'CS')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const selectedStaff = rows.find((row) => row.email === selectedEmail)
  const selectedAccount = userAccountRows.find((row) => row.email === selectedEmail)
  const selectedPreview = Boolean(selectedStaff?.__stressGenerated)
  const visible = rows.filter((row) => (!query || `${row.name} ${row.email}`.toLowerCase().includes(query.toLowerCase())) && (roleFilter === 'Tất cả vai trò' || row.role === roleFilter))

  const openGrant = () => {
    setAction('Cấp')
    setSelectedEmail(grantCandidates[0]?.email || storedRows[0]?.email || '')
    setRole('CS')
    setReason('')
    setError('')
  }
  const apply = () => {
    if (!selectedStaff && !selectedAccount) { setError('Chọn một tài khoản trước khi cập nhật quyền.'); return }
    if (!reason.trim()) { setError('Lý do là bắt buộc.'); return }
    const activeSa = storedRows.filter((row) => row.role === 'SA' && row.status === 'Đang hoạt động').length
    if (action === 'Thu hồi' && selectedStaff?.role === 'SA' && selectedStaff.status === 'Đang hoạt động' && activeSa <= 1) { setError('Không thể thu hồi SA hoạt động cuối cùng.'); return }
    const changedAt = new Date().toLocaleString('vi-VN')
    const next = selectedStaff
      ? storedRows.map((row) => row.email === selectedStaff.email ? { ...row, role: action === 'Đổi' || action === 'Cấp' ? role : row.role, status: action === 'Thu hồi' ? 'Đã thu hồi' : 'Đang hoạt động', changedAt, changedBy: 'admin@beefcare.local' } : row)
      : [...storedRows, { name: selectedAccount!.name, email: selectedAccount!.email, role, status: 'Đang hoạt động', changedAt, changedBy: 'admin@beefcare.local' }]
    setStoredRows(next)
    savePlatformRows('staff', next)
    setError('')
    setReason('')
  }

  return <Shell screen={screen} readOnly={readOnly} sub="SA cấp, đổi, thu hồi hoặc khôi phục vai trò CS, PM và SA." actions={!readOnly && <Button variant="primary" onClick={openGrant}>Cấp quyền nền tảng</Button>}>
    <InlineMessage tone="warn" title="SA hoạt động cuối cùng">Không thể thu hồi vai trò của SA hoạt động cuối cùng trên nền tảng.</InlineMessage>
    <WorkSection title="Nhân sự nền tảng"><FilterBar><input aria-label="Tìm nhân sự nền tảng" value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputCls} min-w-64 flex-1`} placeholder="Tìm tên hoặc email" /><select aria-label="Lọc vai trò" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={`${inputCls} w-40`}><option>Tất cả vai trò</option><option>CS</option><option>PM</option><option>SA</option></select></FilterBar><Table wide scroll><thead><tr><Th>Tài khoản</Th><Th>Vai trò</Th><Th>Trạng thái</Th><Th>Thay đổi gần nhất</Th><Th>Người thực hiện</Th><Th /></tr></thead><tbody>{visible.map((row) => <tr key={row.email}><Td><strong>{row.name}</strong><span className="block text-xs text-subtle">{row.email}</span></Td><Td>{row.role}</Td><Td><Badge tone={row.status === 'Đang hoạt động' ? 'ok' : 'warn'}>{row.status}</Badge></Td><Td>{row.changedAt}</Td><Td>{row.changedBy}</Td><Td><Button small onClick={() => { setSelectedEmail(row.email); setRole(row.role); setAction(row.status === 'Đã thu hồi' ? 'Khôi phục' : 'Đổi'); setError(''); window.setTimeout(() => document.getElementById('platform-staff-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }}>Xem chi tiết</Button></Td></tr>)}</tbody></Table></WorkSection>
    {(selectedStaff || selectedAccount) && <div id="platform-staff-detail">{selectedPreview ? <WorkSection title={`Chi tiết quyền · ${selectedEmail}`} description="Dữ liệu thử để kiểm tra danh sách dài; chỉ xem và không lưu."><InlineMessage tone="info" title="Dữ liệu thử · chỉ xem">Chọn một tài khoản thật để đổi hoặc thu hồi quyền nền tảng.</InlineMessage><dl className="m-0 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-subtle">Vai trò</dt><dd className="m-0 mt-1 font-semibold">{selectedStaff?.role}</dd></div><div><dt className="text-xs text-subtle">Trạng thái</dt><dd className="m-0 mt-1 font-semibold">{selectedStaff?.status}</dd></div><div><dt className="text-xs text-subtle">Thay đổi gần nhất</dt><dd className="m-0 mt-1 font-semibold">{selectedStaff?.changedAt}</dd></div></dl></WorkSection> : <>{!readOnly && <WorkSection title={`Cập nhật quyền · ${selectedEmail}`}><div className="grid max-w-3xl gap-4 md:grid-cols-2">{action === 'Cấp' && <Field label="Tài khoản *"><select className={inputCls} value={selectedEmail} onChange={(event) => setSelectedEmail(event.target.value)}>{grantCandidates.map((account) => <option key={account.email} value={account.email}>{account.name} · {account.email}</option>)}</select></Field>}<Field label="Hành động *"><select className={inputCls} value={action} onChange={(event) => setAction(event.target.value as typeof action)}><option>Cấp</option>{selectedStaff && <><option>Đổi</option><option>Thu hồi</option><option>Khôi phục</option></>}</select></Field>{(action === 'Cấp' || action === 'Đổi') && <Field label="Vai trò *"><select className={inputCls} value={role} onChange={(event) => setRole(event.target.value)}><option>CS</option><option>PM</option><option>SA</option></select></Field>}<Field label="Lý do *"><textarea className={`${inputCls} min-h-24`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></Field></div>{error && <InlineMessage tone="err" className="mt-4">{error}</InlineMessage>}<div className="mt-4"><Button variant="primary" onClick={apply}>Lưu thay đổi quyền</Button></div></WorkSection>}<WorkSection title="Lịch sử quyền" description={`Tài khoản được chọn: ${selectedEmail || '—'}`}><Table><thead><tr><Th>Thời gian</Th><Th>Hành động</Th><Th>Vai trò</Th><Th>Lý do</Th><Th>Thực hiện bởi</Th></tr></thead><tbody><tr><Td>02/08/2026 11:20</Td><Td>Thu hồi</Td><Td>SA</Td><Td>Điều chuyển công tác</Td><Td>admin@beefcare.local</Td></tr><tr><Td>10/01/2025 09:00</Td><Td>Cấp</Td><Td>SA</Td><Td>Phụ trách vận hành hệ thống</Td><Td>system</Td></tr></tbody></Table></WorkSection></>}</div>}
  </Shell>
}

function Audit({ screen, state, role, emptyOverride = false }: { screen: ScreenDefinition; state: ReviewState; role: Extract<ScreenRole, 'cs' | 'pm' | 'sa'>; emptyOverride?: boolean }) {
  const readOnly = state === 'read-only'
  const [from, setFrom] = useState('2026-10-28'); const [to, setTo] = useState('2026-11-03'); const [actor, setActor] = useState(''); const [action, setAction] = useState('ALL'); const [targetType, setTargetType] = useState('ALL'); const [sort, setSort] = useState<'desc' | 'asc'>('desc'); const [selectedId, setSelectedId] = useState<string | null>(null)
  const records = loadAuditRecords(); const invalidRange = from > to || (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) > 366 * 24 * 60 * 60 * 1000
  const rows = useMemo(() => records.filter((row) => { const day = row.at.slice(0, 10); return day >= from && day <= to && (!actor || `${row.actor} ${row.actorId || ''}`.toLowerCase().includes(actor.toLowerCase())) && (action === 'ALL' || row.action === action) && (targetType === 'ALL' || row.targetType === targetType) }).sort((a, b) => sort === 'desc' ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at)), [action, actor, from, records, sort, targetType, to])
  const selected = emptyOverride ? undefined : rows.find((row) => row.id === selectedId) || rows[0]
  const resetFilters = () => { setFrom('2026-10-28'); setTo('2026-11-03'); setActor(''); setAction('ALL'); setTargetType('ALL'); setSelectedId(null) }
  const exportRows = () => { const csvRows = [['Thời gian', 'Người thực hiện', 'Hành động', 'Loại đối tượng', 'Đối tượng', 'Mã tương quan'], ...rows.map((row) => [row.at, auditActor(row.actor), auditActionLabel[row.action] || row.action, auditTargetLabel[row.targetType] || row.targetType, row.target, row.correlationId])]; const csv = csvRows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'lich-su-kiem-tra.csv'; anchor.click(); URL.revokeObjectURL(url) }
  if (role !== 'sa') return <Shell screen={screen} readOnly sub="Lịch sử kiểm tra nền tảng chỉ dành cho Quản trị hệ thống."><InlineMessage tone="err" title="Không có quyền truy cập">Phiên hiện tại không có quyền Quản trị hệ thống.</InlineMessage></Shell>
  return <Shell screen={screen} readOnly={readOnly} sub="Tra cứu thay đổi quản trị theo khoảng thời gian, người thực hiện và loại đối tượng. Dữ liệu chăm sóc, nội dung hỗ trợ, chứng từ ngân hàng và thông tin bí mật không xuất hiện tại đây." actions={<><Button small onClick={() => window.print()}>In danh sách</Button><Button small onClick={exportRows} disabled={!rows.length}>Xuất kết quả lọc</Button></>}><WorkSection title="Bộ lọc lịch sử" description="Khoảng mặc định 7 ngày, tối đa 12 tháng; dữ liệu trong màn hình này chỉ để tra cứu."><FilterBar actions={<Button small onClick={resetFilters}>Đặt lại</Button>}><label className="text-xs font-semibold text-ink">Từ ngày *<input aria-label="Lịch sử từ ngày" className={`${inputCls} mt-1.5`} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="text-xs font-semibold text-ink">Đến ngày *<input aria-label="Lịch sử đến ngày" className={`${inputCls} mt-1.5`} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><input aria-label="Người thực hiện" className={`${inputCls} min-w-52`} placeholder="Tên, email hoặc Hệ thống" value={actor} onChange={(event) => setActor(event.target.value)} /><select aria-label="Hành động" className={`${inputCls} min-w-56`} value={action} onChange={(event) => setAction(event.target.value)}><option value="ALL">Tất cả hành động</option>{AUDIT_ACTIONS.map((item) => <option key={item} value={item}>{auditActionLabel[item] || item}</option>)}</select><select aria-label="Loại đối tượng" className={`${inputCls} min-w-48`} value={targetType} onChange={(event) => setTargetType(event.target.value)}><option value="ALL">Tất cả đối tượng</option>{AUDIT_TARGETS.map((item) => <option key={item} value={item}>{auditTargetLabel[item] || item}</option>)}</select><select aria-label="Thứ tự" className={`${inputCls} w-36`} value={sort} onChange={(event) => setSort(event.target.value as 'desc' | 'asc')}><option value="desc">Mới nhất trước</option><option value="asc">Cũ nhất trước</option></select></FilterBar>{invalidRange && <InlineMessage tone="err" title="Khoảng ngày không hợp lệ">Từ ngày không được sau đến ngày và khoảng tra cứu tối đa là 12 tháng.</InlineMessage>}</WorkSection><WorkSection title="Nhật ký mới nhất" description={`${rows.length} dòng sau bộ lọc · chỉ xem`}>
    {emptyOverride || invalidRange || !rows.length ? <EmptyState title={invalidRange ? 'Không thể truy vấn khoảng ngày này' : 'Chưa có bản ghi trong khoảng đã chọn'} description={invalidRange ? 'Thu hẹp khoảng thời gian xuống tối đa 12 tháng.' : 'Mở rộng khoảng thời gian hoặc xóa bộ lọc người thực hiện, hành động và đối tượng.'} actionLabel="Đặt lại 7 ngày gần nhất" onAction={resetFilters} /> : <Table wide scroll><thead><tr><Th>Thời gian</Th><Th>Người thực hiện</Th><Th>Hành động</Th><Th>Đối tượng</Th><Th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><Td>{new Date(row.at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</Td><Td><strong>{auditActor(row.actor)}</strong><span className="block text-xs text-subtle">{row.actorRole === 'System' ? 'Hệ thống' : row.actorRole}</span></Td><Td><strong>{auditActionLabel[row.action] || row.action}</strong></Td><Td>{auditTargetLabel[row.targetType] || row.targetType} · {row.target}</Td><Td><Button small onClick={() => setSelectedId(row.id)}>Xem chi tiết</Button></Td></tr>)}</tbody></Table>}
    </WorkSection>{selected && !emptyOverride && !invalidRange && <WorkSection title="Chi tiết thay đổi" description="Chỉ hiển thị hành động, người thực hiện, đối tượng và các giá trị quản trị được phép."><dl className="m-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[['Hành động', auditActionLabel[selected.action] || selected.action], ['Người thực hiện', `${auditActor(selected.actor)} · ${selected.actorRole === 'System' ? 'Hệ thống' : selected.actorRole}`], ['Đối tượng', `${auditTargetLabel[selected.targetType] || selected.targetType} · ${selected.target}`], ['ID đối tượng', selected.targetId || '—'], ['Trước thay đổi', auditValue(selected.before)], ['Sau thay đổi', auditValue(selected.after)], ['Mã tương quan', selected.correlationId], ['Thời gian', new Date(selected.at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })]].map(([label, value]) => <div key={label}><dt className="text-xs text-subtle">{label}</dt><dd className="m-0 mt-1 text-sm font-semibold text-ink">{value}</dd></div>)}</dl></WorkSection>}</Shell>
}

function GenericWorkbench({ screen, state, role }: { screen: ScreenDefinition; state: ReviewState; role: Extract<ScreenRole, 'cs' | 'pm' | 'sa'> }) {
  const config = platformConfigFor(screen.feature)
  const readOnly = state === 'read-only'
  return <Shell screen={screen} readOnly={readOnly} sub={config.intro} actions={!readOnly && <Button variant="primary">{config.primaryAction}</Button>}><SummaryStrip items={[{label:'Chờ xử lý',value:'12',note:'4 việc ưu tiên'},{label:'Đang phụ trách',value:role === 'cs' ? '8' : '6'},{label:'Hoàn tất hôm nay',value:'19'},{label:'Thời gian trung bình',value:'2,4 giờ'}]} /><WorkSection title="Hàng công việc"><FilterBar><input aria-label="Tìm kiếm" className={`${inputCls} min-w-64 flex-1`} placeholder={config.searchPlaceholder} /><select aria-label="Trạng thái" className={`${inputCls} w-48`}><option>Tất cả trạng thái</option><option>Chờ xử lý</option><option>Đang xử lý</option></select></FilterBar><Table><thead><tr><Th>Mã</Th><Th>Nội dung</Th><Th>Đối tượng</Th><Th>Giá trị</Th><Th>Trạng thái</Th><Th>Cập nhật</Th></tr></thead><tbody>{config.rows.map((row) => <tr key={row.code}><Td>{row.code}</Td><Td><strong>{row.subject}</strong></Td><Td>{row.owner}</Td><Td>{row.amount}</Td><Td>{row.status}</Td><Td>{row.updatedAt}</Td></tr>)}</tbody></Table></WorkSection></Shell>
}

export function PlatformScreen({ screen, state, role }: { screen: ScreenDefinition; state: ReviewState; role: Extract<ScreenRole, 'cs' | 'pm' | 'sa'> }) {
  if (state === 'loading') return <LoadingState label={`Đang tải ${screen.viTitle.toLowerCase()}…`} rows={6} />
  if (state === 'error') return <InlineMessage tone="err" title={`Không thể tải ${screen.viTitle.toLowerCase()}.`}>Bộ lọc hiện tại được giữ; kiểm tra kết nối và thử lại.</InlineMessage>
  if (state === 'empty') {
    if (screen.id === 'SCR-80') return <Audit screen={screen} state="success" role={role} emptyOverride />
    if (screen.id === 'SCR-20') return <EmptyState title="Không có tài khoản để hiển thị" description="Dữ liệu xem trước hiện chưa có tài khoản nền tảng." />
    if (screen.id === 'SCR-21') return <EmptyState title="Chưa có nhân sự nền tảng" description="Chưa có tài khoản nào được cấp vai trò CS, PM hoặc SA trong dữ liệu xem trước." />
    return <EmptyState title="Không có công việc để hiển thị" description="Dữ liệu xem trước hiện chưa có công việc nền tảng." />
  }
  if (screen.id === 'SCR-20') return <UserAccounts screen={screen} state={state} />
  if (screen.id === 'SCR-21') return <StaffAccess screen={screen} state={state} />
  if (screen.id === 'SCR-80') return <Audit screen={screen} state={state} role={role} />
  return <GenericWorkbench screen={screen} state={state} role={role} />
}
