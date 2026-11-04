import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Badge, Button, Field, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, FixtureNotice, InlineMessage, LoadingState, WorkSection } from '../../../components/workspace'
import { loadNotifications, markAllNotificationsRead, markNotificationRead, mergeNotifications, openNotification, type Notice, type NoticeKind, type ReminderDomain } from '../notificationStore'
import { DEMO_OWNER_EMAIL, DEMO_OWNER_ID, loadSupportAssignments, loadSupportInternalRequests, loadSupportTickets } from '../../support/supportStore'
import { loadOrders, loadSelectedFarmId } from '../../subscription/subscriptionStore'
const roleLabel = (role: ScreenRole) => ({ guest: 'Khách', owner: 'Chủ trại', manager: 'Quản lý', technician: 'Kỹ thuật viên', cs: 'Chăm sóc khách hàng', pm: 'Quản lý nền tảng', sa: 'Quản trị hệ thống' }[role] || role)
const domainLabel: Record<ReminderDomain, string> = { VACCINATION: 'Tiêm phòng', CALVING: 'Sinh bê', BREEDING: 'Phối giống', PREGNANCY_CHECK: 'Khám thai', PEN_MOVE: 'Chuyển chuồng / giai đoạn sinh trưởng', WEIGHING: 'Cân nặng / thể trạng', DRAFT_CALVES: 'Bê chờ đăng ký', HERD_EXIT: 'Xuất đàn / hoàn tất', FEED: 'Thức ăn', DEATH_LOSS: 'Chết / thất lạc', FINISHING_WEIGHT: 'Cân chốt' }
const noticeTypeLabel: Record<string, string> = { ASSIGNED: 'Được giao xử lý', INTERNAL_REQUEST: 'Yêu cầu nội bộ', OWNER_TICKET: 'Yêu cầu hỗ trợ', FARM: 'Trang trại', SUPPORT: 'Hỗ trợ' }
const reconciliationLabel: Record<string, string> = {
  EVIDENCE_MISMATCH: 'Sai lệch bằng chứng',
  EVIDENCE_EXPIRED_REQUEST: 'Bằng chứng của yêu cầu đã hết hạn',
  EVIDENCE_WITHOUT_REQUEST: 'Bằng chứng chưa gắn yêu cầu',
  RETURN_REFERENCE_PENDING: 'Thiếu mã tham chiếu hoàn tiền',
  DAILY_AUTO_CONFIRMATION: 'Xác nhận tự động hằng ngày',
}
const friendlyCopy = (value?: string) => (value || '—')
  .replace(/Lịch vaccine/gi, 'Lịch tiêm phòng')
  .replace(/route IM/gi, 'tiêm bắp')
  .replace(/cơ sở TENTATIVE/gi, 'dữ liệu dự kiến')
  .replace(/Thai kỳ v\d+/gi, 'Hồ sơ thai kỳ')
  .replace(/\bv\d+\b/gi, '')
  .replace(/\s+·/g, ' ·')
  .replace(/\s{2,}/g, ' ')
  .trim()
const noticeTitle = (row: Notice) => row.kind === 'RECONCILIATION' ? reconciliationLabel[row.type] || row.title : row.title
const noticeBody = (row: Notice) => row.kind === 'RECONCILIATION' ? 'Cần kiểm tra chứng từ và yêu cầu liên quan.' : friendlyCopy(row.body)
const recipientFor: Partial<Record<ScreenRole, string>> = { cs: 'cs-linh', pm: 'pm-quang', sa: 'sa-lan' }
function supportNoticeRows(role: ScreenRole): Notice[] { const recipientId = recipientFor[role]; if (!recipientId) return []; if (role === 'cs') return loadSupportTickets().flatMap((ticket) => { const assignment = loadSupportAssignments().find((entry) => entry.ticketId === ticket.id); if (assignment?.assigneeId !== recipientId) return []; return [{ id: `support-${ticket.id}-${assignment.assignedAt || 'unassigned'}-${recipientId}`, kind: 'SUPPORT' as const, type: 'ASSIGNED', title: ticket.subject, body: ticket.description, status: 'UNREAD' as const, createdAt: ticket.updatedAt, roles: ['cs'] as ScreenRole[], recipientId, recipientAccountId: recipientId, assignmentRevision: assignment.assignedAt || 'unassigned', sourceRoute: `/ui/scr-97?ticket=${encodeURIComponent(ticket.id)}`, sourceId: ticket.id, farmId: ticket.farmId }] }); return loadSupportInternalRequests().filter((request) => request.status === 'OPEN' && request.targetRole === role && request.recipientId === recipientId).map((request) => { const ticket = loadSupportTickets().find((entry) => entry.id === request.ticketId); return { id: `request-${request.id}-${request.updatedAt || request.createdAt}-${recipientId}`, kind: 'SUPPORT' as const, type: 'INTERNAL_REQUEST', title: request.code, body: request.question, status: 'UNREAD' as const, createdAt: request.createdAt, roles: [role] as ScreenRole[], recipientId, recipientAccountId: recipientId, assignmentRevision: request.updatedAt || request.createdAt, sourceRoute: `/ui/scr-99?request=${encodeURIComponent(request.id)}`, sourceId: request.id, farmId: ticket?.farmId } }) }
function ownerSupportNoticeRows(): Notice[] { const currentFarmId = loadSelectedFarmId(); return loadSupportTickets().filter((ticket) => ticket.farmId === currentFarmId && (ticket.requesterId === DEMO_OWNER_ID || ticket.requesterEmail === DEMO_OWNER_EMAIL)).map((ticket) => ({ id: `owner-support-${ticket.id}`, kind: 'SUPPORT' as const, type: 'OWNER_TICKET', title: ticket.subject, body: ticket.description, status: 'UNREAD' as const, createdAt: ticket.updatedAt, roles: ['owner'] as ScreenRole[], farmId: ticket.farmId, sourceRoute: `/ui/scr-95?ticket=${encodeURIComponent(ticket.id)}`, sourceId: ticket.id })) }
function ownerFarmId(row: Notice) { return row.farmId === 'farm-demo' ? 'farm-ba-vi' : row.farmId }
function ownerSourceAvailable(row: Notice) {
  const currentFarmId = loadSelectedFarmId(); const farms = loadOrders()
  if (row.kind === 'FARM') return Boolean(ownerFarmId(row) && farms.some((farm) => farm.id === ownerFarmId(row) && farm.id === currentFarmId))
  if (row.kind === 'SUPPORT' && row.sourceId) { const ticket = loadSupportTickets().find((item) => item.id === row.sourceId); return Boolean(ticket && ticket.requesterId === DEMO_OWNER_ID && ticket.requesterEmail === DEMO_OWNER_EMAIL && ticket.farmId === currentFarmId) }
  return false
}
function typedSourceAvailable(row: Notice) {
  if (!row.sourceId) return false
  // Seed reminders represent valid fixture records even when their source has
  // not yet been created in localStorage. Route access still re-checks role.
  if (row.id.startsWith('rem-')) return true
  const root = (() => { try { return JSON.parse(window.localStorage.getItem('beefcare-ui-demo') || '{}') as { account?: Record<string, unknown> } } catch { return {} as { account?: Record<string, unknown> } } })()
  const account = root.account || {}; const sourceKeys = Object.keys(account).filter((key) => /vacc|health|repro|pregnancy|calv|entry|exit|feed|draft|weight|measure|reminder/i.test(key)); const source = sourceKeys.flatMap((key) => Array.isArray(account[key]) ? account[key] as unknown[] : []).find((item) => { const raw = item as Record<string, unknown>; const matches = String(raw.id || raw.code || '') === row.sourceId || JSON.stringify(raw).includes(row.sourceId as string); return matches && !['VOIDED', 'EXCLUDED', 'INACTIVE', 'CANCELLED'].includes(String(raw.status || '')) })
  const cows = Array.isArray(account['cattle-preview']) ? account['cattle-preview'] as Array<Record<string, unknown>> : []; const cow = row.cattleCode ? cows.find((item) => item.code === row.cattleCode && item.status !== 'EXITED' && item.status !== 'VOIDED') : undefined
  if (source) return true
  if (!cow) return false
  if (row.domain === 'WEIGHING') return Number(cow.weight) > 0
  if (row.domain === 'FINISHING_WEIGHT') return cow.purpose === 'Vỗ béo' && Number(cow.weight) > 0
  if (row.domain === 'CALVING' || row.domain === 'BREEDING' || row.domain === 'PREGNANCY_CHECK') return Boolean(cow.repro)
  if (row.domain === 'PEN_MOVE') return Boolean(cow.barn)
  if (row.domain === 'VACCINATION') return Boolean((cow.events as unknown[] | undefined)?.some((event) => JSON.stringify(event).toLowerCase().includes('vaccine')))
  return false
}
function visible(screen: ScreenDefinition, role: ScreenRole, rows: Notice[]) { if (screen.id === 'SCR-73') return rows.filter((row) => row.kind === 'REMINDER' && row.roles.includes(role)); if (screen.id === 'SCR-74') return role === 'owner' ? rows.filter((row) => (row.kind === 'FARM' || row.kind === 'SUPPORT') && row.roles.includes('owner') && !row.assignedTo && ownerSourceAvailable(row)) : []; if (screen.id === 'SCR-75') { const recipientId = recipientFor[role]; return recipientId ? rows.filter((row) => row.kind === 'SUPPORT' && row.roles.includes(role) && row.recipientId === recipientId) : [] } return role === 'pm' ? rows.filter((row) => row.kind === 'RECONCILIATION' && row.roles.includes(role)) : [] }
function sourceStillAvailable(screen: ScreenDefinition, role: ScreenRole, row: Notice) { if (!row.roles.includes(role) || !row.sourceRoute) return false; if (screen.id === 'SCR-73') return typedSourceAvailable(row); if (screen.id === 'SCR-74') return role === 'owner' && !row.assignedTo && ownerSourceAvailable(row); if (screen.id === 'SCR-75') return Boolean(row.recipientId && row.recipientId === recipientFor[role]); if (screen.id === 'SCR-76') return role === 'pm' && row.kind === 'RECONCILIATION' && Boolean(row.sourceId); return false }
function permittedReminderRoute(row: Notice, role: ScreenRole) {
  // Technicians can inspect cattle profiles but must not be sent to owner/manager
  // action surfaces from a reminder deep-link.
  if (role === 'technician' && ['/ui/scr-25', '/ui/scr-37', '/ui/scr-63', '/ui/scr-71', '/ui/scr-110', '/ui/scr-113'].some((route) => row.sourceRoute.startsWith(route))) {
    return row.cattleCode ? `/ui/scr-27?code=${encodeURIComponent(row.cattleCode)}` : '/ui/scr-73'
  }
  return row.sourceRoute
}
function hcmDay(date = new Date()) { return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) }
function hcmDayPlus(days: number) { const base = new Date(`${hcmDay()}T00:00:00+07:00`); base.setUTCDate(base.getUTCDate() + days); return hcmDay(base) }
function reminderBucket(row: Notice) { const due = row.dueAt || ''; const todayText = hcmDay(); const endText = hcmDayPlus(7); if (due && due < todayText) return 'OVERDUE'; if (due === todayText) return 'TODAY'; if (!due || due > endText) return 'OUTSIDE'; return 'UPCOMING' }
export function NotificationScreen({ screen, role, state }: { screen: ScreenDefinition; role: ScreenRole; state: ReviewState }) {
  const navigate = useNavigate(); const [rows, setRows] = useState(loadNotifications); const [query, setQuery] = useState(''); const [tab, setTab] = useState('ALL'); const [domain, setDomain] = useState<ReminderDomain | 'ALL'>('ALL'); const [feedback, setFeedback] = useState<string | null>(null); const kind: NoticeKind = screen.id === 'SCR-73' ? 'REMINDER' : screen.id === 'SCR-74' ? 'FARM' : screen.id === 'SCR-75' ? 'SUPPORT' : 'RECONCILIATION'; const farmId = loadSelectedFarmId(); const allowed = screen.roles.includes(role); const dynamicRows = screen.id === 'SCR-75' ? supportNoticeRows(role) : screen.id === 'SCR-74' ? ownerSupportNoticeRows() : []; useEffect(() => { if (dynamicRows.length) setRows(mergeNotifications(dynamicRows)) }, [screen.id, role])
  const rowsForView = useMemo(() => [...rows, ...dynamicRows.filter((row) => !rows.some((existing) => existing.id === row.id))], [rows, dynamicRows]); const visibleRows = useMemo(() => visible(screen, role, rowsForView).filter((row) => { const rowFarm = row.farmId === 'farm-demo' ? 'farm-ba-vi' : row.farmId; return !rowFarm || rowFarm === farmId }), [screen, role, rowsForView, farmId]); const filtered = useMemo(() => visibleRows.filter((row) => (!query || `${row.title} ${row.body} ${row.type} ${row.sourceId || ''}`.toLowerCase().includes(query.toLowerCase())) && (screen.id !== 'SCR-73' || domain === 'ALL' || row.domain === domain) && (screen.id !== 'SCR-74' || tab === 'ALL' || (tab === 'SUBSCRIPTION' && row.kind === 'FARM') || (tab === 'SUPPORT' && row.kind === 'SUPPORT')) && (screen.id === 'SCR-74' || tab === 'ALL' || (tab === 'UNREAD' && row.status === 'UNREAD') || (tab === 'READ' && row.status === 'READ') || (tab === 'OVERDUE' && reminderBucket(row) === 'OVERDUE') || (tab === 'TODAY' && reminderBucket(row) === 'TODAY') || (tab === 'UPCOMING' && reminderBucket(row) === 'UPCOMING'))), [visibleRows, query, tab, domain, screen.id])
  if (!allowed) return <InlineMessage tone="err" title="Không có quyền">Màn hình này chỉ dành cho {screen.roles.map(roleLabel).join(', ')}.</InlineMessage>
  if (state === 'loading') return <LoadingState label="Đang tải thông báo…" />
  if (state === 'error') return <InlineMessage tone="err">Không thể tải thông báo.</InlineMessage>
  const recipientId = recipientFor[role]; const markOne = (id: string) => { if (state === 'read-only') return; setRows(markNotificationRead(id, role, farmId, recipientId)) }; const markAll = () => { if (state === 'read-only') return; setRows(markAllNotificationsRead(role, screen.id === 'SCR-74' ? undefined : kind, screen.id === 'SCR-74', farmId, recipientId)) }; const open = (row: Notice) => { if (!sourceStillAvailable(screen, role, row)) { setFeedback('Thông báo không còn khả dụng hoặc không thuộc quyền của bạn.'); setRows(loadNotifications()); return } if (screen.id === 'SCR-75') { const assignedRecipientId = recipientFor[role]; const stale = role === 'cs' ? !loadSupportAssignments().some((entry) => entry.ticketId === row.sourceId && entry.assigneeId === assignedRecipientId && (!row.assignmentRevision || entry.assignedAt === row.assignmentRevision)) : (row.id.startsWith('request-') ? !loadSupportInternalRequests().some((request) => request.id === row.sourceId && request.status === 'OPEN' && request.targetRole === role && request.recipientId === assignedRecipientId) : false); if (stale) { setFeedback('Công việc đã được phân công lại; tải lại danh sách.'); setRows(loadNotifications()); return } } const destination = screen.id === 'SCR-73' ? permittedReminderRoute(row, role) : row.sourceRoute; if (row.id.startsWith('support-') || row.id.startsWith('request-')) { if (state !== 'read-only') setRows(markNotificationRead(row.id, role, farmId, recipientId)); navigate(destination); return } if (!openNotification(row.id, role, farmId, state !== 'read-only', recipientId)) { setFeedback('Thông báo không còn khả dụng hoặc không thuộc quyền của bạn.'); setRows(loadNotifications()); return } navigate(destination) }
  const counts = screen.id === 'SCR-73' ? { OVERDUE: visibleRows.filter((row) => reminderBucket(row) === 'OVERDUE').length, TODAY: visibleRows.filter((row) => reminderBucket(row) === 'TODAY').length, UPCOMING: visibleRows.filter((row) => reminderBucket(row) === 'UPCOMING').length } : undefined; const farmCounts = { subscription: visibleRows.filter((row) => row.kind === 'FARM' && row.status === 'UNREAD').length, support: visibleRows.filter((row) => row.kind === 'SUPPORT' && row.status === 'UNREAD').length }
  if (screen.id === 'SCR-76' && state === 'empty') return <div className="flex w-full flex-col gap-6"><PageHeader title={screen.viTitle} sub={`Vai trò ${roleLabel(role)} · các thông tin liên quan đến trại`} badge={<FixtureNotice />} /><EmptyState title="Chưa có thông báo đối soát" description="Chưa có sai lệch chứng từ hoặc yêu cầu thanh toán cần PM xử lý trong khoảng đã chọn." actionLabel="Đặt lại bộ lọc" onAction={() => { setQuery(''); setTab('ALL') }} /></div>
  if (screen.id === 'SCR-76' && !filtered.length) return <div className="flex w-full flex-col gap-6"><PageHeader title={screen.viTitle} sub={`Vai trò ${roleLabel(role)} · các thông tin liên quan đến trại`} badge={<FixtureNotice />} /><EmptyState title="Chưa có thông báo đối soát" description="Chưa có sai lệch chứng từ hoặc yêu cầu thanh toán cần PM xử lý trong khoảng đã chọn." actionLabel="Đặt lại bộ lọc" onAction={() => { setQuery(''); setTab('ALL') }} /></div>
  const description = screen.id === 'SCR-76'
    ? 'Đối soát sai lệch chứng từ, yêu cầu quá hạn, thiếu yêu cầu, thiếu tham chiếu hoàn tiền và xác nhận tự động hằng ngày.'
    : screen.id === 'SCR-73'
      ? 'Đọc thông báo không làm hoàn tất nhắc việc; trạng thái chỉ phản ánh thông báo đã được mở.'
      : 'Hệ thống kiểm tra lại quyền truy cập và phân công trước khi mở nguồn.'
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader title={screen.viTitle} sub={`Vai trò ${roleLabel(role)} · các thông tin liên quan đến trại`} badge={<FixtureNotice />}>
        <Button small disabled={state === 'read-only'} onClick={markAll}>Đánh dấu tất cả đã đọc</Button>
      </PageHeader>
      {feedback && <InlineMessage tone="warn" title="Không thể mở thông báo">{feedback}</InlineMessage>}
      <FilterBar>
        <Field label="Tìm thông báo"><input className={inputCls} value={query} onChange={(event) => setQuery(event.target.value)} /></Field>
        {screen.id === 'SCR-73' && <Field label="Loại nhắc việc"><select className={inputCls} value={domain} onChange={(event) => setDomain(event.target.value as ReminderDomain | 'ALL')}><option value="ALL">Tất cả loại</option>{Object.entries(domainLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Nhóm thông báo">
          {(screen.id === 'SCR-73' ? [['ALL', 'Tất cả'], ['OVERDUE', `Quá hạn (${counts?.OVERDUE || 0})`], ['TODAY', `Hôm nay (${counts?.TODAY || 0})`], ['UPCOMING', `7 ngày tới (${counts?.UPCOMING || 0})`]] : screen.id === 'SCR-74' ? [['ALL', `Tất cả (${visibleRows.length})`], ['SUBSCRIPTION', `Gói dịch vụ & thanh toán (${farmCounts.subscription})`], ['SUPPORT', `Hỗ trợ (${farmCounts.support})`]] : [['ALL', 'Tất cả'], ['UNREAD', 'Chưa đọc'], ['READ', 'Đã đọc']]).map(([value, label]) => <Button key={value} small variant={tab === value ? 'primary' : 'default'} onClick={() => setTab(value)}>{label}</Button>)}
        </div>
      </FilterBar>
      <WorkSection title={`${filtered.length} thông báo`} description={description}>
        <Table wide scroll>
          <thead><tr><Th>Thời điểm / hạn</Th><Th>Loại</Th><Th>Nội dung</Th><Th>Cơ sở / bằng chứng</Th><Th>Trạng thái</Th><Th /></tr></thead>
          <tbody>
            {filtered.map((row: Notice) => <tr key={row.id}><Td>{row.dueAt || row.createdAt.slice(0, 10)}</Td><Td>{row.domain ? domainLabel[row.domain] : row.kind === 'RECONCILIATION' ? 'Đối soát' : noticeTypeLabel[row.type] || 'Thông báo'}</Td><Td><strong>{noticeTitle(row)}</strong><br /><span className="text-xs text-subtle">{noticeBody(row)}{row.cattleCode ? ` · ${row.cattleCode} · ${row.cattleBreed || ''} · chuồng ${row.pen || '—'}` : ''}</span></Td><Td>{friendlyCopy(row.basis || row.evidenceRef)}{row.tentative && <><br /><Badge tone="warn">Tạm tính</Badge></>}</Td><Td><Badge tone={row.status === 'UNREAD' ? 'warn' : 'ok'}>{row.status === 'UNREAD' ? 'Chưa đọc' : 'Đã đọc'}</Badge></Td><Td className="whitespace-nowrap"><Button small onClick={() => open(row)}>Mở nguồn</Button>{row.status === 'UNREAD' && <Button small disabled={state === 'read-only'} onClick={() => markOne(row.id)}>Đã đọc</Button>}</Td></tr>)}
            {!filtered.length && <tr><Td colSpan={6}><EmptyState title="Không có thông báo" description="Khi có sự kiện phù hợp, thông báo sẽ xuất hiện ở đây." /></Td></tr>}
          </tbody>
        </Table>
      </WorkSection>
      {state === 'read-only' && <InlineMessage tone="info">Chỉ đọc: thao tác đánh dấu đã đọc bị khóa.</InlineMessage>}
    </div>
  )
}
