import { loadOrders, loadPaymentIntents, type FarmSubscription } from '../subscription/subscriptionStore'
import { loadServicePeriods } from '../platform-service/platformServiceStore'
import { accountMembers, permissionRows } from '../account/data/accountFixtures'
import { loadLocalStressConfig } from '../../app/localStressData'

export type SupportCategory = 'ACCOUNT_ACCESS' | 'PAYMENT' | 'FARM_SERVICE' | 'SYSTEM_USAGE' | 'OTHER'
export type SupportScope = 'FARM' | 'ACCOUNT'
export type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
export type SupportPriority = 'Low' | 'Normal' | 'High'

export interface SupportTicket {
  id: string
  code: string
  requesterId: string
  requesterName: string
  requesterEmail: string
  subject: string
  description: string
  category: SupportCategory
  scope: SupportScope
  farmId?: string
  farmName?: string
  priority: SupportPriority
  status: SupportStatus
  createdAt: string
  updatedAt: string
  /** Demo-only SLA metadata; the backend contract will own this later. */
  slaDueAt?: string
  firstResponseAt?: string
  attachments?: SupportAttachment[]
  acknowledgedResolutionVersion?: number
  acknowledgedAt?: string
}

export interface SupportAttachment {
  [key: string]: unknown
  id: string
  name: string
  ext: string
  size: number
  addedAt: string
}

export interface SupportMessage {
  id: string
  ticketId: string
  visibility: 'PUBLIC' | 'INTERNAL'
  authorType: 'OWNER' | 'CS'
  authorName: string
  createdAt: string
  content: string
  attachments?: SupportAttachment[]
}

export interface SupportAssignment {
  id: string
  ticketId: string
  assigneeId?: string
  assigneeName?: string
  assignedAt?: string
}

export interface SupportResolution {
  id: string
  ticketId: string
  version: number
  csName: string
  createdAt: string
  text: string
}

export interface SupportAuditEntry {
  id: string
  ticketId: string
  requestId?: string
  action: string
  at: string
  actor: string
  fromStatus?: SupportStatus
  toStatus?: SupportStatus
  reason?: string
  resolutionVersion?: number
}

export type InternalRequestStatus = 'OPEN' | 'DONE' | 'CANCELLED'
export type InternalRequestRole = 'pm' | 'sa'
export type InternalRequestOutcome = 'PERFORMED' | 'UNABLE' | 'OUTSIDE_DOMAIN'

export interface SupportInternalRequest {
  id: string
  code: string
  ticketId: string
  targetRole: InternalRequestRole
  recipientId: string
  recipientName: string
  question: string
  contextLinks: string[]
  status: InternalRequestStatus
  createdAt: string
  createdBy: string
  updatedAt?: string
  resultOutcome?: InternalRequestOutcome
  resultText?: string
  resultReference?: string
}

export const SUPPORT_KEYS = {
  tickets: 'support.tickets',
  messages: 'support.messages',
  assignments: 'support.assignments',
  resolutions: 'support.resolutions',
  audit: 'support.audit',
  internalRequests: 'support.internalRequests',
  selection: 'support.selection',
  stressSeed: 'support.stressSeed',
} as const

export const DEMO_OWNER_ID = 'owner-demo'
export const DEMO_OWNER_EMAIL = 'owner@beefcare.local'

const SUPPORT_SCHEMA = 'v2'

function supportAccountKey() {
  if (typeof window === 'undefined') return DEMO_OWNER_EMAIL
  try {
    const raw = JSON.parse(window.localStorage.getItem('beefcare-ui-demo') || '{}') as { account?: Record<string, unknown> }
    const signIn = raw.account?.['SCR-02']
    if (signIn && typeof signIn === 'object' && typeof (signIn as Record<string, unknown>).email === 'string') return (signIn as Record<string, string>).email
  } catch { /* use demo account */ }
  return DEMO_OWNER_EMAIL
}

export function currentSupportEmail() { return supportAccountKey() }

/**
 * Support is currently a localStorage preview. Keep one account/farm-scoped
 * namespace so changing the active demo user cannot leak tickets or notes.
 * Records retain farmId so the eventual API can split them per farm without a
 * UI migration. `all-farms` is the explicit farm scope for this Owner/CS demo
 * queue; individual ticket rows still carry their farmId for filtering.
 */
function supportKey(key: string) {
  return `${key}:${SUPPORT_SCHEMA}:${encodeURIComponent(supportAccountKey())}:all-farms`
}

function accountValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { return (JSON.parse(window.localStorage.getItem('beefcare-ui-demo') || '{}').account?.[key] as T) ?? fallback } catch { return fallback }
}

export function availableCommittedDomainResults(role: InternalRequestRole) {
  if (role === 'pm') {
    const paidPayments = loadPaymentIntents().filter((intent) => intent.status === 'PAID').map((intent) => intent.code)
    const servicePeriods = loadServicePeriods().filter((period) => period.sourcePaymentId).flatMap((period) => [period.id, period.sourcePaymentId, period.sourcePaymentCode]).filter((value): value is string => Boolean(value))
    return [...new Set([...paidPayments, ...servicePeriods])]
  }
  const members = accountValue<Array<{ email?: string; status?: string }>>('members', accountMembers).filter((item) => item.email && item.status !== 'Ngừng hoạt động').map((item) => `ACCOUNT:${item.email}`)
  const permissions = permissionRows.map((item) => `PERMISSION:${item.area}`)
  return [...new Set([...members, ...permissions])]
}

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}

const write = <T,>(key: string, value: T) => {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}

function readSupport<T>(key: string, fallback: T): T {
  const namespaced = read<T | null>(supportKey(key), null)
  if (namespaced !== null) return namespaced
  // Migrate the previous flat demo keys once, without losing the user's work.
  const legacy = supportAccountKey() === DEMO_OWNER_EMAIL ? read<T | null>(key, null) : null
  if (legacy !== null) { write(supportKey(key), legacy); return legacy }
  return fallback
}

function writeSupport<T>(key: string, value: T) { return write(supportKey(key), value) }

function iso(value: string) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : value
}

const farms = () => loadOrders()
const farmName = (farmId?: string) => farms().find((farm) => farm.id === farmId)?.name

const defaultTickets: SupportTicket[] = [
  { id: 'ticket-204', code: 'TK-0204', requesterId: DEMO_OWNER_ID, requesterName: 'Nguyễn Văn Hùng', requesterEmail: DEMO_OWNER_EMAIL, subject: 'Không nhận được mã QR', description: 'Mã QR chưa hiển thị sau khi xác nhận.', category: 'SYSTEM_USAGE', scope: 'FARM', farmId: 'farm-ba-vi', farmName: 'Trại bò Ba Vì', priority: 'Normal', status: 'IN_PROGRESS', createdAt: '2026-11-02T02:15:00.000Z', updatedAt: '2026-11-03T03:15:00.000Z', slaDueAt: '2026-11-03T10:15:00.000Z', firstResponseAt: '2026-11-03T03:15:00.000Z' },
  { id: 'ticket-198', code: 'TK-0198', requesterId: DEMO_OWNER_ID, requesterName: 'Nguyễn Văn Hùng', requesterEmail: DEMO_OWNER_EMAIL, subject: 'Đã thanh toán nhưng chưa cập nhật', description: 'Khoản thanh toán cần được kiểm tra.', category: 'PAYMENT', scope: 'FARM', farmId: 'farm-moc-chau', farmName: 'Trại vệ tinh Mộc Châu', priority: 'Normal', status: 'RESOLVED', createdAt: '2026-10-28T03:00:00.000Z', updatedAt: '2026-11-02T08:00:00.000Z', slaDueAt: '2026-11-03T08:00:00.000Z', firstResponseAt: '2026-10-28T05:00:00.000Z' },
  { id: 'ticket-171', code: 'TK-0171', requesterId: DEMO_OWNER_ID, requesterName: 'Nguyễn Văn Hùng', requesterEmail: DEMO_OWNER_EMAIL, subject: 'Cập nhật thông tin tài khoản', description: 'Cần thay đổi email nhận thông báo.', category: 'ACCOUNT_ACCESS', scope: 'ACCOUNT', priority: 'Normal', status: 'CLOSED', createdAt: '2026-10-10T02:00:00.000Z', updatedAt: '2026-10-15T09:00:00.000Z', slaDueAt: '2026-10-16T09:00:00.000Z', firstResponseAt: '2026-10-10T05:00:00.000Z', acknowledgedResolutionVersion: 1 },
  { id: 'ticket-other', code: 'TK-0099', requesterId: 'owner-other', requesterName: 'Hoàng Thu Hà', requesterEmail: 'other@beefcare.local', subject: 'Yêu cầu của trang trại khác', description: 'Không hiển thị cho Chủ trại hiện tại.', category: 'OTHER', scope: 'ACCOUNT', priority: 'Normal', status: 'OPEN', createdAt: '2026-10-01T02:00:00.000Z', updatedAt: '2026-10-01T03:00:00.000Z', slaDueAt: '2026-10-02T03:00:00.000Z' },
]

const defaultMessages: SupportMessage[] = [
  { id: 'message-204-1', ticketId: 'ticket-204', visibility: 'PUBLIC', authorType: 'OWNER', authorName: 'Bạn', createdAt: '2026-11-02T02:15:00.000Z', content: 'Mã QR chưa hiển thị sau khi xác nhận.' },
  { id: 'message-204-2', ticketId: 'ticket-204', visibility: 'PUBLIC', authorType: 'CS', authorName: 'CS Linh', createdAt: '2026-11-03T03:15:00.000Z', content: 'Đội hỗ trợ đang kiểm tra phiên phát hành thẻ.' },
  { id: 'message-198-1', ticketId: 'ticket-198', visibility: 'PUBLIC', authorType: 'OWNER', authorName: 'Bạn', createdAt: '2026-10-28T03:00:00.000Z', content: 'Khoản thanh toán cần được kiểm tra.' },
  { id: 'message-171-1', ticketId: 'ticket-171', visibility: 'PUBLIC', authorType: 'CS', authorName: 'CS Mai', createdAt: '2026-10-15T09:00:00.000Z', content: 'Đã cập nhật email nhận thông báo.' },
]

const defaultAssignments: SupportAssignment[] = [
  { id: 'assignment-204', ticketId: 'ticket-204', assigneeId: 'cs-linh', assigneeName: 'CS Linh', assignedAt: '2026-11-02T04:00:00.000Z' },
  { id: 'assignment-198', ticketId: 'ticket-198', assigneeId: 'cs-linh', assigneeName: 'CS Linh', assignedAt: '2026-10-28T05:00:00.000Z' },
  { id: 'assignment-171', ticketId: 'ticket-171', assigneeId: 'cs-mai', assigneeName: 'CS Mai', assignedAt: '2026-10-10T05:00:00.000Z' },
]

const defaultResolutions: SupportResolution[] = [
  { id: 'resolution-198-v1', ticketId: 'ticket-198', version: 1, csName: 'CS Mai', createdAt: '2026-11-02T08:00:00.000Z', text: 'Đã đối soát thanh toán và cập nhật trạng thái cho trang trại.' },
  { id: 'resolution-171-v1', ticketId: 'ticket-171', version: 1, csName: 'CS Mai', createdAt: '2026-10-15T09:00:00.000Z', text: 'Đã cập nhật email nhận thông báo.' },
]

const defaultAudit: SupportAuditEntry[] = defaultTickets.map((ticket) => ({ id: `audit-${ticket.id}-created`, ticketId: ticket.id, action: 'CREATED', at: ticket.createdAt, actor: 'Bạn', toStatus: ticket.status === 'IN_PROGRESS' ? 'OPEN' : ticket.status }))
const defaultInternalRequests: SupportInternalRequest[] = [
  { id: 'internal-204-1', code: 'IR-051', ticketId: 'ticket-204', targetRole: 'pm', recipientId: 'pm-quang', recipientName: 'PM Quang', question: 'Kiểm tra phiên phát hành mã QR cho yêu cầu TK-0204.', contextLinks: ['TK-0204', 'farm-ba-vi'], status: 'OPEN', createdAt: '2026-11-03T04:00:00.000Z', createdBy: 'CS Linh' },
  { id: 'internal-198-1', code: 'IR-047', ticketId: 'ticket-198', targetRole: 'pm', recipientId: 'pm-quang', recipientName: 'PM Quang', question: 'Đối soát lại thanh toán của yêu cầu TK-0198.', contextLinks: ['TK-0198', 'farm-moc-chau'], status: 'DONE', createdAt: '2026-11-01T04:00:00.000Z', createdBy: 'CS Mai', updatedAt: '2026-11-02T07:00:00.000Z', resultOutcome: 'PERFORMED', resultText: 'Đã xác nhận giao dịch và cập nhật kỳ dịch vụ.', resultReference: 'PAY-771' },
]

function ensureSupportStressData() {
  const config = loadLocalStressConfig()
  if (!config.enabled || typeof window === 'undefined') return
  const seeded = readSupport<boolean>(SUPPORT_KEYS.stressSeed, false)
  if (seeded) return

  const sourceTickets = readSupport<SupportTicket[] | null>(SUPPORT_KEYS.tickets, null) ?? defaultTickets
  const sourceMessages = readSupport<SupportMessage[] | null>(SUPPORT_KEYS.messages, null) ?? defaultMessages
  const sourceAssignments = readSupport<SupportAssignment[] | null>(SUPPORT_KEYS.assignments, null) ?? defaultAssignments
  const sourceResolutions = readSupport<SupportResolution[] | null>(SUPPORT_KEYS.resolutions, null) ?? defaultResolutions
  const sourceAudit = readSupport<SupportAuditEntry[] | null>(SUPPORT_KEYS.audit, null) ?? defaultAudit
  const sourceRequests = readSupport<SupportInternalRequest[] | null>(SUPPORT_KEYS.internalRequests, null) ?? defaultInternalRequests
  const target = config.rowsPerTable
  const tickets = [...sourceTickets]
  const messages = [...sourceMessages]
  const assignments = [...sourceAssignments]
  const resolutions = [...sourceResolutions]
  const audit = [...sourceAudit]
  const internalRequests = [...sourceRequests]
  const statuses: SupportStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']
  const categories: SupportCategory[] = ['SYSTEM_USAGE', 'PAYMENT', 'FARM_SERVICE', 'ACCOUNT_ACCESS', 'OTHER']
  const priorities: SupportPriority[] = ['Normal', 'High', 'Low']
  const farmRows = farms()

  for (let index = tickets.length; index < target; index += 1) {
    const number = index + 201
    const id = `ticket-stress-${String(number).padStart(4, '0')}`
    const status = statuses[index % statuses.length]
    const category = categories[index % categories.length]
    const priority = priorities[index % priorities.length]
    const farm = farmRows[index % Math.max(farmRows.length, 1)]
    const createdAt = new Date(Date.UTC(2026, 9, 1) + index * 3_600_000).toISOString()
    const updatedAt = new Date(new Date(createdAt).getTime() + (index % 48 + 1) * 3_600_000).toISOString()
    const ticket: SupportTicket = {
      id,
      code: `TK-${String(number).padStart(4, '0')}`,
      requesterId: DEMO_OWNER_ID,
      requesterName: 'Nguyễn Văn Hùng',
      requesterEmail: DEMO_OWNER_EMAIL,
      subject: `${['Cần hỗ trợ mã QR', 'Đối soát thanh toán', 'Cập nhật dịch vụ trại', 'Phân quyền thành viên', 'Hướng dẫn sử dụng'][index % 5]} · ${number}`,
      description: `Yêu cầu mô phỏng số ${number} dùng để kiểm tra danh sách, bộ lọc và luồng xử lý hỗ trợ.`,
      category,
      scope: category === 'ACCOUNT_ACCESS' ? 'ACCOUNT' : 'FARM',
      farmId: category === 'ACCOUNT_ACCESS' ? undefined : farm?.id,
      farmName: category === 'ACCOUNT_ACCESS' ? undefined : farm?.name,
      priority,
      status,
      createdAt,
      updatedAt,
      slaDueAt: new Date(new Date(createdAt).getTime() + 24 * 3_600_000).toISOString(),
      firstResponseAt: status === 'OPEN' ? undefined : new Date(new Date(createdAt).getTime() + 2 * 3_600_000).toISOString(),
      acknowledgedResolutionVersion: status === 'CLOSED' ? 1 : undefined,
    }
    tickets.push(ticket)
    messages.push({ id: `message-${id}-1`, ticketId: id, visibility: 'PUBLIC', authorType: 'OWNER', authorName: 'Bạn', createdAt, content: ticket.description })
    if (status !== 'OPEN') {
      messages.push({ id: `message-${id}-2`, ticketId: id, visibility: 'PUBLIC', authorType: 'CS', authorName: index % 2 ? 'CS Linh' : 'CS Mai', createdAt: ticket.firstResponseAt || updatedAt, content: 'Đã tiếp nhận và đang xử lý yêu cầu.' })
    }
    assignments.push({ id: `assignment-${id}`, ticketId: id, assigneeId: status === 'OPEN' ? undefined : index % 2 ? 'cs-linh' : 'cs-mai', assigneeName: status === 'OPEN' ? undefined : index % 2 ? 'CS Linh' : 'CS Mai', assignedAt: status === 'OPEN' ? undefined : ticket.firstResponseAt })
    if (status === 'RESOLVED' || status === 'CLOSED') {
      resolutions.push({ id: `resolution-${id}-v1`, ticketId: id, version: 1, csName: index % 2 ? 'CS Linh' : 'CS Mai', createdAt: updatedAt, text: 'Đã kiểm tra dữ liệu và hoàn tất phương án xử lý cho yêu cầu mô phỏng.' })
    }
    audit.push({ id: `audit-${id}-created`, ticketId: id, action: 'CREATED', at: createdAt, actor: 'Bạn', toStatus: 'OPEN' })
  }

  for (let index = internalRequests.length; index < target; index += 1) {
    const ticket = tickets.find((item) => item.status === 'IN_PROGRESS' || item.status === 'WAITING_CUSTOMER') ?? tickets[index % tickets.length]
    const done = index % 3 !== 0
    internalRequests.push({
      id: `internal-stress-${String(index + 1).padStart(4, '0')}`,
      code: `IR-${String(index + 51).padStart(3, '0')}`,
      ticketId: ticket.id,
      targetRole: index % 2 ? 'pm' : 'sa',
      recipientId: index % 2 ? 'pm-quang' : 'sa-minh',
      recipientName: index % 2 ? 'PM Quang' : 'SA Minh',
      question: `Kiểm tra dữ liệu liên quan đến ${ticket.code}.`,
      contextLinks: [ticket.code, ticket.farmId || 'ACCOUNT'],
      status: done ? 'DONE' : 'OPEN',
      createdAt: ticket.createdAt,
      createdBy: index % 2 ? 'CS Linh' : 'CS Mai',
      updatedAt: done ? ticket.updatedAt : undefined,
      resultOutcome: done ? 'UNABLE' : undefined,
      resultText: done ? 'Đã rà soát và phản hồi cho nhân viên hỗ trợ.' : undefined,
    })
  }

  writeSupport(SUPPORT_KEYS.tickets, tickets)
  writeSupport(SUPPORT_KEYS.messages, messages)
  writeSupport(SUPPORT_KEYS.assignments, assignments)
  writeSupport(SUPPORT_KEYS.resolutions, resolutions)
  writeSupport(SUPPORT_KEYS.audit, audit)
  writeSupport(SUPPORT_KEYS.internalRequests, internalRequests)
  writeSupport(SUPPORT_KEYS.stressSeed, true)
}

export function loadSupportTickets() {
  ensureSupportStressData()
  const stored = readSupport<SupportTicket[] | null>(SUPPORT_KEYS.tickets, null)
  const tickets = stored ?? defaultTickets
  if (!stored) writeSupport(SUPPORT_KEYS.tickets, tickets)
  return tickets.map((ticket) => ({ ...ticket, requesterName: ticket.requesterName ?? (ticket.requesterEmail === DEMO_OWNER_EMAIL ? 'Nguyễn Văn Hùng' : ticket.requesterEmail), createdAt: iso(ticket.createdAt), updatedAt: iso(ticket.updatedAt), farmName: ticket.farmName ?? farmName(ticket.farmId) }))
}
export function saveSupportTickets(value: SupportTicket[]) { if (!writeSupport(SUPPORT_KEYS.tickets, value)) throw new Error('Không thể lưu yêu cầu hỗ trợ. Hãy thử lại.'); return true }
export function loadSupportMessages() {
  ensureSupportStressData()
  const stored = readSupport<SupportMessage[] | null>(SUPPORT_KEYS.messages, null)
  const messages = stored ?? defaultMessages
  if (!stored) writeSupport(SUPPORT_KEYS.messages, messages)
  return messages.map((message) => ({ ...message, createdAt: iso(message.createdAt) }))
}
export function saveSupportMessages(value: SupportMessage[]) { if (!writeSupport(SUPPORT_KEYS.messages, value)) throw new Error('Không thể lưu trao đổi hỗ trợ. Hãy thử lại.'); return true }
export function loadSupportAssignments() { ensureSupportStressData(); const stored = readSupport<SupportAssignment[] | null>(SUPPORT_KEYS.assignments, null); const value = stored ?? defaultAssignments; if (!stored) writeSupport(SUPPORT_KEYS.assignments, value); return value }
export function saveSupportAssignments(value: SupportAssignment[]) { if (!writeSupport(SUPPORT_KEYS.assignments, value)) throw new Error('Không thể lưu phân công hỗ trợ. Hãy thử lại.'); return true }
export function loadSupportResolutions() { ensureSupportStressData(); const stored = readSupport<SupportResolution[] | null>(SUPPORT_KEYS.resolutions, null); const value = stored ?? defaultResolutions; if (!stored) writeSupport(SUPPORT_KEYS.resolutions, value); return value.map((resolution) => ({ ...resolution, createdAt: iso(resolution.createdAt) })) }
export function saveSupportResolutions(value: SupportResolution[]) { if (!writeSupport(SUPPORT_KEYS.resolutions, value)) throw new Error('Không thể lưu kết quả xử lý. Hãy thử lại.'); return true }
export function loadSupportAudit() { ensureSupportStressData(); const stored = readSupport<SupportAuditEntry[] | null>(SUPPORT_KEYS.audit, null); const value = stored ?? defaultAudit; if (!stored) writeSupport(SUPPORT_KEYS.audit, value); return value.map((entry) => ({ ...entry, at: iso(entry.at) })) }
export function saveSupportAudit(value: SupportAuditEntry[]) { if (!writeSupport(SUPPORT_KEYS.audit, value)) throw new Error('Không thể lưu lịch sử hỗ trợ. Hãy thử lại.'); return true }
export function loadSupportInternalRequests() { ensureSupportStressData(); const stored = readSupport<SupportInternalRequest[] | null>(SUPPORT_KEYS.internalRequests, null); const value = stored ?? defaultInternalRequests; if (!stored) writeSupport(SUPPORT_KEYS.internalRequests, value); return value.map((request) => ({ ...request, createdAt: iso(request.createdAt), updatedAt: request.updatedAt ? iso(request.updatedAt) : undefined })) }
export function saveSupportInternalRequests(value: SupportInternalRequest[]) { if (!writeSupport(SUPPORT_KEYS.internalRequests, value)) throw new Error('Không thể lưu yêu cầu nội bộ. Hãy thử lại.'); return true }
export function loadSupportSelection() { return readSupport<string | null>(SUPPORT_KEYS.selection, null) }
export function saveSupportSelection(ticketId: string) { return writeSupport(SUPPORT_KEYS.selection, ticketId) }

function nextCode(tickets: SupportTicket[]) {
  const max = Math.max(0, ...tickets.map((ticket) => Number(ticket.code.match(/(\d+)$/)?.[1] ?? 0) || 0))
  return `TK-${String(max + 1).padStart(4, '0')}`
}

export function createSupportTicket(input: Pick<SupportTicket, 'category' | 'scope' | 'farmId' | 'subject' | 'description' | 'attachments'>) {
  const now = new Date().toISOString(); const tickets = loadSupportTickets(); const id = `ticket-${Date.now()}`; const farm = farms().find((entry) => entry.id === input.farmId); if (input.scope === 'FARM' && (!input.farmId || !farm)) throw new Error(`Trang trại không thuộc ${DEMO_OWNER_EMAIL}.`); const ticket: SupportTicket = { id, code: nextCode(tickets), requesterId: DEMO_OWNER_ID, requesterName: 'Nguyễn Văn Hùng', requesterEmail: DEMO_OWNER_EMAIL, subject: input.subject, description: input.description, category: input.category, scope: input.scope, farmId: input.scope === 'FARM' ? input.farmId : undefined, farmName: input.scope === 'FARM' ? farm?.name : undefined, priority: 'Normal', status: 'OPEN', createdAt: now, updatedAt: now, slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), attachments: input.attachments }
  const nextTickets = [...tickets, ticket]; const nextMessages = [...loadSupportMessages(), { id: `message-${id}-1`, ticketId: id, visibility: 'PUBLIC' as const, authorType: 'OWNER' as const, authorName: 'Bạn', createdAt: now, content: input.description, attachments: input.attachments }];
  if (!saveSupportTickets(nextTickets) || !saveSupportMessages(nextMessages) || !saveSupportAssignments([...loadSupportAssignments(), { id: `assignment-${id}`, ticketId: id }]) || !saveSupportAudit([...loadSupportAudit(), { id: `audit-${id}-created`, ticketId: id, action: 'CREATED', at: now, actor: 'Bạn', toStatus: 'OPEN' }])) throw new Error('Không thể tạo yêu cầu hỗ trợ. Vui lòng thử lại.'); saveSupportSelection(id); return ticket
}

export function addSupportReply(ticketId: string, content: string) {
  const tickets = loadSupportTickets(); const ticket = tickets.find((entry) => entry.id === ticketId); if (!ticket || ticket.status === 'CLOSED') throw new Error('Yêu cầu đã đóng hoặc không tồn tại.')
  const now = new Date().toISOString(); saveSupportMessages([...loadSupportMessages(), { id: `message-${Date.now()}`, ticketId, visibility: 'PUBLIC', authorType: 'OWNER', authorName: 'Bạn', createdAt: now, content }]); const nextStatus = ticket.status === 'WAITING_CUSTOMER' ? 'IN_PROGRESS' as const : ticket.status; const next = tickets.map((entry) => entry.id === ticketId ? { ...entry, updatedAt: now, status: nextStatus } : entry); saveSupportTickets(next); saveSupportAudit([...loadSupportAudit(), { id: `audit-${Date.now()}`, ticketId, action: 'OWNER_REPLY', at: now, actor: 'Bạn', fromStatus: ticket.status, toStatus: nextStatus }])
}

export function addSupportCsReply(ticketId: string, content: string, csName: string) {
  const tickets = loadSupportTickets(); const ticket = tickets.find((entry) => entry.id === ticketId); const assignment = loadSupportAssignments().find((entry) => entry.ticketId === ticketId)
  if (!ticket || ticket.status === 'CLOSED' || ticket.status === 'RESOLVED' || assignment?.assigneeName !== csName) throw new Error('Bạn chỉ có thể trả lời yêu cầu đang được mình phụ trách và chưa đóng hoặc ghi kết quả.')
  const now = new Date().toISOString(); const nextStatus = ticket.status === 'WAITING_CUSTOMER' ? 'IN_PROGRESS' as const : ticket.status
  saveSupportMessages([...loadSupportMessages(), { id: `message-${Date.now()}`, ticketId, visibility: 'PUBLIC', authorType: 'CS', authorName: csName, createdAt: now, content }])
  saveSupportTickets(tickets.map((entry) => entry.id === ticketId ? { ...entry, status: nextStatus, updatedAt: now, firstResponseAt: entry.firstResponseAt ?? now } : entry))
  supportAudit(ticketId, 'CS_PUBLIC_REPLY', csName, { fromStatus: ticket.status, toStatus: nextStatus })
}

export function confirmSupportResolution(ticketId: string, expectedVersion: number) {
  const tickets = loadSupportTickets(); const ticket = tickets.find((entry) => entry.id === ticketId); const resolution = loadSupportResolutions().filter((entry) => entry.ticketId === ticketId).sort((a, b) => b.version - a.version)[0]; if (!ticket || ticket.status !== 'RESOLVED' || !resolution || resolution.version !== expectedVersion) throw new Error('Kết quả đã thay đổi; tải lại trước khi xác nhận.')
  if (ticket.acknowledgedResolutionVersion === expectedVersion) return
  const now = new Date().toISOString(); const next = tickets.map((entry) => entry.id === ticketId ? { ...entry, status: 'RESOLVED' as const, acknowledgedResolutionVersion: expectedVersion, acknowledgedAt: now, updatedAt: now } : entry); saveSupportTickets(next); saveSupportMessages([...loadSupportMessages(), { id: `message-${Date.now()}`, ticketId, visibility: 'PUBLIC', authorType: 'OWNER', authorName: 'Bạn', createdAt: now, content: `Đã xác nhận kết quả xử lý v${expectedVersion}.` }]); saveSupportAudit([...loadSupportAudit(), { id: `audit-${Date.now()}`, ticketId, action: 'CONFIRMED_RESOLUTION', at: now, actor: 'Bạn', fromStatus: 'RESOLVED', toStatus: 'RESOLVED', resolutionVersion: expectedVersion }])
}

export function reopenSupportTicket(ticketId: string, reason: string, expectedVersion: number) {
  const tickets = loadSupportTickets(); const ticket = tickets.find((entry) => entry.id === ticketId); const resolution = loadSupportResolutions().filter((entry) => entry.ticketId === ticketId).sort((a, b) => b.version - a.version)[0]; if (!ticket || ticket.status !== 'RESOLVED' || !resolution || resolution.version !== expectedVersion) throw new Error('Kết quả đã thay đổi; tải lại trước khi mở lại.')
  const now = new Date().toISOString(); saveSupportTickets(tickets.map((entry) => entry.id === ticketId ? { ...entry, status: 'OPEN' as const, acknowledgedResolutionVersion: undefined, acknowledgedAt: undefined, updatedAt: now } : entry)); saveSupportMessages([...loadSupportMessages(), { id: `message-${Date.now()}`, ticketId, visibility: 'PUBLIC', authorType: 'OWNER', authorName: 'Bạn', createdAt: now, content: `Yêu cầu mở lại v${expectedVersion}: ${reason}` }]); saveSupportAudit([...loadSupportAudit(), { id: `audit-${Date.now()}`, ticketId, action: 'REOPENED', at: now, actor: 'Bạn', fromStatus: 'RESOLVED', toStatus: 'OPEN', reason, resolutionVersion: expectedVersion }])
}

export function supportFarms(): FarmSubscription[] { return farms() }

export const availableSupportCs = [{ id: 'cs-linh', name: 'CS Linh' }, { id: 'cs-mai', name: 'CS Mai' }, { id: 'cs-huy', name: 'CS Huy' }]
export const availableInternalRecipients = { pm: [{ id: 'pm-quang', name: 'PM Quang' }, { id: 'pm-anh', name: 'PM Anh' }], sa: [{ id: 'sa-lan', name: 'SA Lan' }, { id: 'sa-minh', name: 'SA Minh' }] }

function validInternalContext(role: InternalRequestRole, links: string[]) {
  return links.every((link) => role === 'pm'
    ? /^(farm-|PAY-|SERVICE-|FIN-)/.test(link)
    : /^(ACCOUNT:|PERMISSION:)/.test(link))
}

function supportAudit(ticketId: string, action: string, actor: string, extra: Partial<SupportAuditEntry> = {}) { saveSupportAudit([...loadSupportAudit(), { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ticketId, action, at: new Date().toISOString(), actor, ...extra }]) }

export function claimSupportTicket(ticketId: string, csId: string, csName: string) {
  const tickets = loadSupportTickets(); const ticket = tickets.find((entry) => entry.id === ticketId); const assignments = loadSupportAssignments(); const current = assignments.find((entry) => entry.ticketId === ticketId); if (!ticket || ticket.status === 'CLOSED' || (current?.assigneeId && current.assigneeId !== csId && current.assigneeId !== 'cs-unavailable')) throw new Error('Yêu cầu vừa được nhân viên hỗ trợ khác tiếp nhận.')
  const now = new Date().toISOString(); saveSupportAssignments(assignments.some((entry) => entry.ticketId === ticketId) ? assignments.map((entry) => entry.ticketId === ticketId ? { ...entry, assigneeId: csId, assigneeName: csName, assignedAt: now } : entry) : [...assignments, { id: `assignment-${ticketId}`, ticketId, assigneeId: csId, assigneeName: csName, assignedAt: now }]); saveSupportTickets(tickets.map((entry) => entry.id === ticketId ? { ...entry, status: entry.status === 'WAITING_CUSTOMER' ? entry.status : 'IN_PROGRESS' as const, updatedAt: now } : entry)); supportAudit(ticketId, 'CLAIMED', csName, { toStatus: ticket.status === 'WAITING_CUSTOMER' ? ticket.status : 'IN_PROGRESS' })
}

export function handoverSupportTicket(ticketId: string, recipientId: string, recipientName: string, reason: string, actor: string) {
  const ticket = loadSupportTickets().find((entry) => entry.id === ticketId); const assignment = loadSupportAssignments().find((entry) => entry.ticketId === ticketId); if (!ticket || ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' || assignment?.assigneeName !== actor) throw new Error('Chỉ yêu cầu đang xử lý do bạn phụ trách mới có thể bàn giao.')
  const now = new Date().toISOString(); saveSupportAssignments(loadSupportAssignments().map((entry) => entry.ticketId === ticketId ? { ...entry, assigneeId: recipientId, assigneeName: recipientName, assignedAt: now } : entry)); saveSupportTickets(loadSupportTickets().map((entry) => entry.id === ticketId ? { ...entry, status: 'IN_PROGRESS' as const, updatedAt: now } : entry)); supportAudit(ticketId, 'HANDED_OVER', actor, { toStatus: 'IN_PROGRESS', reason })
}

export function setSupportStatus(ticketId: string, status: SupportStatus, actor: string, reason?: string) {
  const tickets = loadSupportTickets(); const ticket = tickets.find((entry) => entry.id === ticketId); if (!ticket) throw new Error('Không tìm thấy yêu cầu.'); if (ticket.status === 'RESOLVED' && status !== 'RESOLVED') throw new Error('Yêu cầu đã có kết quả chỉ được Chủ trại xác nhận hoặc mở lại.')
  const assignment = loadSupportAssignments().find((entry) => entry.ticketId === ticketId); if (assignment?.assigneeName !== actor) throw new Error('Chỉ nhân viên phụ trách mới được đổi trạng thái.'); const now = new Date().toISOString(); saveSupportTickets(tickets.map((entry) => entry.id === ticketId ? { ...entry, status, updatedAt: now } : entry)); if (status === 'OPEN') saveSupportAssignments(loadSupportAssignments().map((entry) => entry.ticketId === ticketId ? { ...entry, assigneeId: undefined, assigneeName: undefined, assignedAt: undefined } : entry)); supportAudit(ticketId, status === 'WAITING_CUSTOMER' ? 'ASK_CUSTOMER' : 'RETURN_QUEUE', actor, { fromStatus: ticket.status, toStatus: status, reason })
}

export function updateSupportTicket(ticketId: string, patch: Partial<Pick<SupportTicket, 'priority' | 'category'>>) { const tickets = loadSupportTickets(); const ticket = tickets.find((entry) => entry.id === ticketId); if (!ticket || ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') throw new Error('Yêu cầu đã có kết quả hoặc đã đóng chỉ được phép xem.'); saveSupportTickets(tickets.map((entry) => entry.id === ticketId ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry)) }

export function addSupportInternalNote(ticketId: string, content: string, authorName: string) { const ticket = loadSupportTickets().find((entry) => entry.id === ticketId); const assignment = loadSupportAssignments().find((entry) => entry.ticketId === ticketId); if (!ticket || !['IN_PROGRESS', 'WAITING_CUSTOMER'].includes(ticket.status) || assignment?.assigneeName !== authorName) throw new Error('Ghi chú nội bộ chỉ dành cho nhân viên phụ trách yêu cầu đang xử lý.'); const now = new Date().toISOString(); saveSupportMessages([...loadSupportMessages(), { id: `message-${Date.now()}`, ticketId, visibility: 'INTERNAL', authorType: 'CS', authorName, createdAt: now, content }]); supportAudit(ticketId, 'INTERNAL_NOTE', authorName) }
export function recordSupportResolution(ticketId: string, text: string, csName: string) { const tickets = loadSupportTickets(); const ticket = tickets.find((entry) => entry.id === ticketId); const assignment = loadSupportAssignments().find((entry) => entry.ticketId === ticketId); if (!ticket || ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' || assignment?.assigneeName !== csName) throw new Error('Chỉ nhân viên phụ trách mới có thể ghi kết quả cho yêu cầu đang xử lý.'); const openRequest = loadSupportInternalRequests().some((request) => request.ticketId === ticketId && request.status === 'OPEN'); if (openRequest) throw new Error('Hãy hoàn tất hoặc hủy các yêu cầu nội bộ đang mở trước khi ghi kết quả.'); const previous = loadSupportResolutions().filter((entry) => entry.ticketId === ticketId).sort((a, b) => b.version - a.version)[0]; const now = new Date().toISOString(); const resolution: SupportResolution = { id: `resolution-${ticketId}-v${(previous?.version ?? 0) + 1}`, ticketId, version: (previous?.version ?? 0) + 1, csName, createdAt: now, text }; saveSupportResolutions([...loadSupportResolutions(), resolution]); saveSupportTickets(tickets.map((entry) => entry.id === ticketId ? { ...entry, status: 'RESOLVED' as const, acknowledgedResolutionVersion: undefined, acknowledgedAt: undefined, updatedAt: now } : entry)); supportAudit(ticketId, 'RESOLUTION_RECORDED', csName, { fromStatus: ticket.status, toStatus: 'RESOLVED', resolutionVersion: resolution.version }); return resolution }

export function createSupportInternalRequest(input: Omit<SupportInternalRequest, 'id' | 'code' | 'status' | 'createdAt' | 'createdBy'>, actor: string) { const requests = loadSupportInternalRequests(); const ticket = loadSupportTickets().find((entry) => entry.id === input.ticketId); const assignment = loadSupportAssignments().find((entry) => entry.ticketId === input.ticketId); if (!ticket || !['IN_PROGRESS', 'WAITING_CUSTOMER'].includes(ticket.status) || assignment?.assigneeName !== actor) throw new Error('Chỉ có thể tạo yêu cầu nội bộ từ yêu cầu hỗ trợ đang được bạn xử lý.'); if (!input.question.trim() || input.question.trim().length > 2000) throw new Error('Nội dung câu hỏi là bắt buộc và tối đa 2.000 ký tự.'); if (!input.contextLinks.length || !validInternalContext(input.targetRole, input.contextLinks)) throw new Error(input.targetRole === 'pm' ? 'Quản lý nền tảng cần ít nhất một liên kết trang trại, thanh toán, dịch vụ hoặc tài chính.' : 'Quản trị hệ thống cần ít nhất một liên kết tài khoản hoặc phân quyền.'); if (requests.some((request) => request.ticketId === input.ticketId && request.targetRole === input.targetRole && request.status === 'OPEN')) throw new Error(`Đã có một yêu cầu nội bộ đang mở cho ${input.targetRole.toUpperCase()}.`); const now = new Date().toISOString(); const request: SupportInternalRequest = { ...input, question: input.question.trim(), contextLinks: input.contextLinks.map((link) => link.trim()).filter(Boolean), id: `internal-${Date.now()}`, code: `IR-${String(52 + requests.length).padStart(3, '0')}`, status: 'OPEN', createdAt: now, createdBy: actor }; if (!saveSupportInternalRequests([...requests, request])) throw new Error('Không thể tạo yêu cầu nội bộ. Vui lòng thử lại.'); supportAudit(input.ticketId, 'INTERNAL_REQUEST_CREATED', actor, { requestId: request.id }); return request }
export function changeSupportInternalRequest(id: string, recipientId: string, recipientName: string, reason: string, actor: string) { const requests = loadSupportInternalRequests(); const request = requests.find((entry) => entry.id === id); const ticket = request ? loadSupportTickets().find((entry) => entry.id === request.ticketId) : undefined; const assignment = request ? loadSupportAssignments().find((entry) => entry.ticketId === request.ticketId) : undefined; if (!request || request.status !== 'OPEN' || !ticket || !['IN_PROGRESS', 'WAITING_CUSTOMER'].includes(ticket.status) || assignment?.assigneeName !== actor) throw new Error('Chỉ nhân viên phụ trách mới được đổi người nhận của yêu cầu nội bộ đang mở.'); const now = new Date().toISOString(); saveSupportInternalRequests(requests.map((entry) => entry.id === id ? { ...entry, recipientId, recipientName, updatedAt: now } : entry)); supportAudit(request.ticketId, 'INTERNAL_REQUEST_REASSIGNED', actor, { reason, requestId: request.id }) }
export function cancelSupportInternalRequest(id: string, reason: string, actor: string) { const requests = loadSupportInternalRequests(); const request = requests.find((entry) => entry.id === id); const ticket = request ? loadSupportTickets().find((entry) => entry.id === request.ticketId) : undefined; const assignment = request ? loadSupportAssignments().find((entry) => entry.ticketId === request.ticketId) : undefined; if (!request || request.status !== 'OPEN' || !ticket || !['IN_PROGRESS', 'WAITING_CUSTOMER'].includes(ticket.status) || assignment?.assigneeName !== actor) throw new Error('Chỉ nhân viên phụ trách mới được hủy yêu cầu nội bộ đang mở.'); saveSupportInternalRequests(requests.map((entry) => entry.id === id ? { ...entry, status: 'CANCELLED' as const, updatedAt: new Date().toISOString() } : entry)); supportAudit(request.ticketId, 'INTERNAL_REQUEST_CANCELLED', actor, { reason, requestId: request.id }) }
export function completeSupportInternalRequest(id: string, outcome: SupportInternalRequest['resultOutcome'], resultText: string, resultReference: string, role: 'pm' | 'sa', actor: string) { const requests = loadSupportInternalRequests(); const request = requests.find((entry) => entry.id === id); if (!request || request.status !== 'OPEN' || request.targetRole !== role || request.recipientName !== actor) throw new Error('Yêu cầu không còn mở hoặc không thuộc phạm vi phụ trách của bạn.'); if (!outcome || !resultText.trim() || resultText.trim().length > 2000) throw new Error('Chọn kết quả và nhập nội dung xử lý, tối đa 2.000 ký tự.'); const reference = resultReference.trim(); if (outcome === 'PERFORMED' && !reference) throw new Error('Chọn bản ghi kết quả đã thực hiện.'); if (outcome === 'PERFORMED' && !availableCommittedDomainResults(role).includes(reference)) throw new Error('Bản ghi kết quả phải thuộc đúng phạm vi và đã được ghi nhận.'); saveSupportInternalRequests(requests.map((entry) => entry.id === id ? { ...entry, status: 'DONE' as const, updatedAt: new Date().toISOString(), resultOutcome: outcome, resultText: resultText.trim(), resultReference: outcome === 'PERFORMED' ? reference : undefined } : entry)); supportAudit(request.ticketId, 'INTERNAL_REQUEST_DONE', actor, { reason: resultText.trim(), requestId: request.id }) }

export function closeSupportTicket(ticketId: string, note: string, reviewed: boolean, actor: string) { const tickets = loadSupportTickets(); const ticket = tickets.find((entry) => entry.id === ticketId); const latest = loadSupportResolutions().filter((entry) => entry.ticketId === ticketId).sort((a, b) => b.version - a.version)[0]; const assignment = loadSupportAssignments().find((entry) => entry.ticketId === ticketId); const openRequest = loadSupportInternalRequests().some((request) => request.ticketId === ticketId && request.status === 'OPEN'); if (!ticket || ticket.status !== 'RESOLVED' || !latest || openRequest || ticket.acknowledgedResolutionVersion !== latest.version || !reviewed || note.length > 500 || assignment?.assigneeName !== actor) throw new Error('Chưa thể đóng: yêu cầu phải có kết quả, không còn yêu cầu nội bộ đang mở, Chủ trại đã xác nhận bản mới nhất và nhân viên phụ trách đã rà soát.'); const now = new Date().toISOString(); saveSupportTickets(tickets.map((entry) => entry.id === ticketId ? { ...entry, status: 'CLOSED' as const, updatedAt: now } : entry)); supportAudit(ticketId, 'CLOSED', actor, { fromStatus: 'RESOLVED', toStatus: 'CLOSED', reason: note || undefined, resolutionVersion: latest.version }) }
