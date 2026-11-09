import { DOMAIN_RESULTS_SEED, IR_SEED, NOTIFICATIONS_SEED, STAFF_SEED, TICKETS_SEED } from './supportMock'
import {
  SupportError, closeConditions, filterQueue, isAssignedTo, isClaimable, latestResolution, nowIso, openIrOf, queueCounts, required, toRow, ROLE_LABEL,
} from '../domain/supportRules'
import type {
  Actor, CompleteCommand, ContextRef, DomainResult, InternalView, QueueFilters, QueuePage, StaffMember, SupportNotification, TargetRole, Ticket,
  TicketCategory, TicketPriority,
} from '../types'

const CLOSED_MSG = 'Ticket đã đóng và chỉ đọc. Hãy tạo ticket mới nếu cần hỗ trợ thêm.'
const NOT_ASSIGNED_MSG = 'Chỉ CS đang phụ trách mới được thay đổi ticket này.'
const CHANGED_MSG = 'Bản ghi đã được thay đổi. Hãy tải lại và kiểm tra trước khi thử lại.'
const GONE_MSG = 'Mục đã chọn không còn khả dụng. Hãy chọn mục khác.'
const NO_IR_ACCESS_MSG = 'Yêu cầu này không còn được giao cho bạn.'

export function createSupportDemoStore(seed = { tickets: TICKETS_SEED, irs: IR_SEED, notifications: NOTIFICATIONS_SEED, staff: STAFF_SEED, domain: DOMAIN_RESULTS_SEED }) {
  let tickets = structuredClone(seed.tickets)
  let irs = structuredClone(seed.irs)
  let notifications = structuredClone(seed.notifications)
  let staff = structuredClone(seed.staff)
  let domain = structuredClone(seed.domain)
  let msgSeq = 10000
  let notifSeq = 100

  const view = (t: Ticket): Ticket => structuredClone({ ...t, internalRequests: irs.filter((r) => r.ticketCode === t.code) })
  const findTicket = (code: string) => {
    const t = tickets.find((x) => x.code === code)
    if (!t) throw new SupportError('NOT_FOUND', `Không tìm thấy ticket ${code}.`)
    return t
  }
  const touch = (t: Ticket, actor: Actor, text: string) => {
    t.version += 1
    t.updatedAt = nowIso()
    t.history.push({ at: t.updatedAt, actor: actor.name, text })
  }
  /** Điều kiện chung cho thao tác của CS phụ trách (GBR-77). */
  function guard(t: Ticket, actor: Actor, expectedVersion?: number) {
    if (t.status === 'CLOSED') throw new SupportError('CONFLICT', CLOSED_MSG)
    if (!isAssignedTo(t, actor)) throw new SupportError('FORBIDDEN', NOT_ASSIGNED_MSG)
    if (expectedVersion !== undefined && expectedVersion !== t.version) throw new SupportError('CONFLICT', CHANGED_MSG)
  }
  const addMessage = (t: Ticket, actor: Actor, visibility: 'PUBLIC' | 'INTERNAL', text: string) =>
    t.messages.push({ id: ++msgSeq, visibility, author: actor.name, authorRole: 'CS', text, at: nowIso() })
  const notifyCs = (title: string, body: string, ticketCode: string, actionLabel: string) =>
    notifications.unshift({ id: ++notifSeq, title, body, at: 'Vừa xong', read: false, actionLabel, ticketCode })
  const staffById = (id: number, role: StaffMember['role']) => staff.find((s) => s.id === id && s.role === role)
  const irOf = (code: string) => {
    const r = irs.find((x) => x.code === code)
    if (!r) throw new SupportError('NOT_FOUND', `Không tìm thấy yêu cầu nội bộ ${code}.`)
    return r
  }
  const irHistory = (r: InternalView, actor: Actor, text: string) => {
    r.version += 1
    r.history.push({ at: nowIso(), actor: actor.name, text })
  }

  return {
    async listQueue(actor: Actor, filters: QueueFilters = {}): Promise<QueuePage> {
      const matched = filterQueue(tickets.map(view), filters, actor.id)
      const size = filters.size ?? 6
      const pageCount = Math.max(1, Math.ceil(matched.length / size))
      const page = Math.min(Math.max(filters.page ?? 1, 1), pageCount)
      return { items: matched.slice((page - 1) * size, page * size).map(toRow), total: matched.length, page, size, counts: queueCounts(tickets.map(view), actor.id) }
    },
    async listFarms() { return [...new Map(tickets.map((t) => [t.farmId, { id: t.farmId, name: t.farmName }])).values()].sort((a, b) => a.name.localeCompare(b.name)) },
    async listCs() { return structuredClone(staff.filter((s) => s.role === 'CS')) },
    async listRecipients(role: TargetRole) { return structuredClone(staff.filter((s) => s.role === role && s.available)) },
    async getTicket(_actor: Actor, code: string) { return view(findTicket(code)) },

    async claim(actor: Actor, code: string, cmd: { reason?: string; expectedVersion?: number }) {
      const t = findTicket(code)
      if (t.status === 'CLOSED') throw new SupportError('CONFLICT', CLOSED_MSG)
      if (!isClaimable(t)) throw new SupportError('CONFLICT', 'Ticket đã có CS khác nhận. Danh sách sẽ được làm mới.')
      if (cmd.expectedVersion !== undefined && cmd.expectedVersion !== t.version) throw new SupportError('CONFLICT', CHANGED_MSG)
      const takeover = t.assignedCsId !== null
      const reason = takeover ? required(cmd.reason, 'Lý do nhận', 1000) : ''
      t.assignedCsId = actor.id
      t.assignedCs = actor.name
      t.assignedAvailable = true
      const from = t.status
      if (t.status === 'OPEN') t.status = 'IN_PROGRESS'
      touch(t, actor, takeover ? `Nhận lại ticket (giữ nguyên ${from}). Lý do: ${reason}` : 'Nhận ticket: Mới mở → Đang xử lý.')
      return view(t)
    },
    async handOver(actor: Actor, code: string, cmd: { toCsId: number; reason: string; expectedVersion?: number }) {
      const t = findTicket(code)
      guard(t, actor, cmd.expectedVersion)
      const reason = required(cmd.reason, 'Lý do chuyển giao', 1000)
      const to = staffById(cmd.toCsId, 'CS')
      if (!to || !to.available || to.id === actor.id) throw new SupportError('CONFLICT', GONE_MSG)
      t.assignedCsId = to.id
      t.assignedCs = to.name
      touch(t, actor, `Chuyển giao cho ${to.name}. Lý do: ${reason}`)
      return view(t)
    },
    async reply(actor: Actor, code: string, cmd: { text: string; expectedVersion?: number }) {
      const t = findTicket(code)
      guard(t, actor, cmd.expectedVersion)
      addMessage(t, actor, 'PUBLIC', required(cmd.text, 'Nội dung trả lời', 3000))
      touch(t, actor, 'Trả lời công khai.')
      return view(t)
    },
    async addNote(actor: Actor, code: string, cmd: { text: string; expectedVersion?: number }) {
      const t = findTicket(code)
      guard(t, actor, cmd.expectedVersion)
      addMessage(t, actor, 'INTERNAL', required(cmd.text, 'Ghi chú mới', 3000))
      touch(t, actor, 'Thêm ghi chú nội bộ.')
      return view(t)
    },
    async askCustomer(actor: Actor, code: string, cmd: { question: string; expectedVersion?: number }) {
      const t = findTicket(code)
      guard(t, actor, cmd.expectedVersion)
      if (t.status !== 'OPEN' && t.status !== 'IN_PROGRESS') throw new SupportError('CONFLICT', CHANGED_MSG)
      addMessage(t, actor, 'PUBLIC', required(cmd.question, 'Nội dung gửi công khai', 3000))
      t.status = 'WAITING_CUSTOMER'
      touch(t, actor, 'Đang xử lý → Chờ khách phản hồi.')
      return view(t)
    },
    async returnToQueue(actor: Actor, code: string, cmd: { reason: string; expectedVersion?: number }) {
      const t = findTicket(code)
      guard(t, actor, cmd.expectedVersion)
      const reason = required(cmd.reason, 'Lý do', 1000)
      t.assignedCsId = null
      t.assignedCs = null
      t.assignedAvailable = true
      touch(t, actor, `Trả về hàng đợi (giữ nguyên trạng thái). Lý do: ${reason}`)
      return view(t)
    },
    async classify(actor: Actor, code: string, cmd: { category?: TicketCategory; priority?: TicketPriority; expectedVersion?: number }) {
      const t = findTicket(code)
      guard(t, actor, cmd.expectedVersion)
      if (cmd.category) t.category = cmd.category
      if (cmd.priority) t.priority = cmd.priority
      touch(t, actor, 'Cập nhật phân loại / ưu tiên.')
      return view(t)
    },
    async resolve(actor: Actor, code: string, cmd: { content: string; expectedVersion?: number }) {
      const t = findTicket(code)
      guard(t, actor, cmd.expectedVersion)
      if (!['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER'].includes(t.status)) throw new SupportError('CONFLICT', CHANGED_MSG)
      const open = openIrOf(view(t))
      if (open) throw new SupportError('CONFLICT', `Yêu cầu nội bộ ${open.code} vẫn đang mở. Ticket chưa thể ghi kết quả hoặc đóng.`)
      const content = required(cmd.content, 'Kết quả công khai', 3000)
      const version = t.resolutions.length + 1
      t.resolutions.forEach((r) => { r.acknowledged = false })
      t.resolutions.push({ id: version, version, content, resolvedBy: actor.name, resolvedAt: nowIso(), acknowledged: false, reviewed: false })
      addMessage(t, actor, 'PUBLIC', `Kết quả giải quyết phiên bản ${version}: ${content}`)
      t.status = 'RESOLVED'
      touch(t, actor, `Ghi kết quả giải quyết phiên bản ${version}: Đã giải quyết.`)
      return view(t)
    },
    async close(actor: Actor, code: string, cmd: { reviewed: boolean; note?: string; expectedVersion?: number }) {
      const t = findTicket(code)
      guard(t, actor, cmd.expectedVersion)
      const cond = closeConditions(view(t))
      if (!cond.resolved.ok) throw new SupportError('CONFLICT', CHANGED_MSG)
      if (!cond.noOpenIr.ok) throw new SupportError('CONFLICT', `Yêu cầu nội bộ ${cond.noOpenIr.code} vẫn đang mở. Ticket chưa thể ghi kết quả hoặc đóng.`)
      if (!cond.acknowledged.ok) throw new SupportError('CONFLICT', `Chủ trại chưa xác nhận kết quả phiên bản ${cond.acknowledged.version}.`)
      if (!cmd.reviewed) throw new SupportError('VALIDATION', 'Hãy tick xác nhận để tiếp tục.')
      const note = (cmd.note ?? '').trim()
      if (note.length > 500) throw new SupportError('VALIDATION', 'Ghi chú đóng tối đa 500 ký tự.')
      const res = latestResolution(t)
      res.reviewed = true
      t.status = 'CLOSED'
      touch(t, actor, `Đóng ticket (kết quả phiên bản ${res.version}, đã xem xác nhận của Chủ trại).${note ? ` Ghi chú: ${note}` : ''}`)
      return view(t)
    },

    async createInternal(actor: Actor, code: string, cmd: { targetRole: TargetRole; recipientId: number; question: string; context?: ContextRef[] }) {
      const t = findTicket(code)
      guard(t, actor)
      if (t.status !== 'IN_PROGRESS' && t.status !== 'WAITING_CUSTOMER') throw new SupportError('CONFLICT', CHANGED_MSG)
      const dup = openIrOf(view(t), cmd.targetRole)
      if (dup) throw new SupportError('CONFLICT', `Ticket đã có yêu cầu nội bộ đang mở cho ${ROLE_LABEL[cmd.targetRole]} (${dup.code}).`)
      const to = staffById(cmd.recipientId, cmd.targetRole)
      if (!to || !to.available) throw new SupportError('CONFLICT', GONE_MSG)
      const question = required(cmd.question, 'Câu hỏi / lý do', 2000)
      const n = Math.max(...irs.map((r) => r.id)) + 1
      const created = nowIso()
      const r: InternalView = {
        id: n, code: `IR-${String(n).padStart(3, '0')}`, title: question.slice(0, 60), ticketId: t.id, ticketCode: t.code, farmId: t.farmId, farmName: t.farmName,
        targetRole: cmd.targetRole, recipientId: to.id, recipient: to.name, fromId: actor.id, from: actor.name, createdAt: created, question,
        context: cmd.context ?? [], status: 'OPEN', version: 1, history: [{ at: created, actor: actor.name, text: `Tạo yêu cầu gửi ${to.name} (${cmd.targetRole}).` }],
      }
      irs.push(r)
      touch(t, actor, `Tạo yêu cầu nội bộ ${r.code} gửi ${to.name}.`)
      return structuredClone(r)
    },
    async manageInternal(actor: Actor, code: string, irCode: string, cmd: { action: 'REASSIGN' | 'CANCEL'; recipientId?: number; reason: string }) {
      const t = findTicket(code)
      guard(t, actor)
      const r = irOf(irCode)
      if (r.ticketCode !== t.code || r.status !== 'OPEN') throw new SupportError('CONFLICT', CHANGED_MSG)
      const reason = required(cmd.reason, 'Lý do', 1000)
      if (cmd.action === 'CANCEL') {
        r.status = 'CANCELLED'
        irHistory(r, actor, `Hủy yêu cầu. Lý do: ${reason}`)
      } else {
        const to = cmd.recipientId ? staffById(cmd.recipientId, r.targetRole) : undefined
        if (!to || !to.available || to.id === r.recipientId) throw new SupportError('CONFLICT', GONE_MSG)
        r.recipientId = to.id
        r.recipient = to.name
        irHistory(r, actor, `Đổi người nhận sang ${to.name}. Lý do: ${reason}`)
      }
      touch(t, actor, `${cmd.action === 'CANCEL' ? 'Hủy' : 'Đổi người nhận'} yêu cầu nội bộ ${r.code}.`)
      return structuredClone(r)
    },

    async listNotifications() { return structuredClone(notifications) },
    async markNotificationRead(id: number) { notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) },
    async markAllNotificationsRead() { notifications = notifications.map((n) => ({ ...n, read: true })) },

    async listAssigned(actor: Actor) {
      return structuredClone(irs.filter((r) => r.recipientId === actor.id && r.targetRole === actor.role).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    },
    async getAssigned(actor: Actor, code: string) {
      const r = irOf(code)
      if (r.recipientId !== actor.id || r.targetRole !== actor.role) throw new SupportError('FORBIDDEN', NO_IR_ACCESS_MSG)
      return structuredClone(r)
    },
    async listDomainResults(actor: Actor, code: string): Promise<DomainResult[]> {
      const r = irOf(code)
      if (r.recipientId !== actor.id) throw new SupportError('FORBIDDEN', NO_IR_ACCESS_MSG)
      return structuredClone(domain[code] ?? [])
    },
    async completeInternal(actor: Actor, code: string, cmd: CompleteCommand) {
      const r = irOf(code)
      if (r.recipientId !== actor.id || r.targetRole !== actor.role) throw new SupportError('FORBIDDEN', NO_IR_ACCESS_MSG)
      if (r.status !== 'OPEN') throw new SupportError('CONFLICT', r.status === 'DONE' ? 'Yêu cầu đã hoàn thành, chỉ đọc.' : 'Yêu cầu đã bị hủy, chỉ đọc.')
      if (cmd.expectedVersion !== r.version) throw new SupportError('CONFLICT', CHANGED_MSG)
      if (!cmd.outcome) throw new SupportError('VALIDATION', 'Kết quả là bắt buộc.')
      const result = required(cmd.result, 'Nội dung kết quả', 2000)
      if (cmd.outcome === 'PERFORMED' && !(domain[code] ?? []).some((d) => d.id === cmd.domainResultAuditId)) {
        throw new SupportError('VALIDATION', 'Đã thực hiện cần chọn kết quả đã lưu hợp lệ trong miền xử lý.')
      }
      if (cmd.simulateSaveFailure) throw new SupportError('SAVE_FAILED_AFTER_DOMAIN', 'Không lưu được Hoàn thành. Kết quả miền đã được lưu, hãy thử lại với cùng tham chiếu.')
      r.status = 'DONE'
      r.outcome = cmd.outcome
      r.result = result
      r.domainResultAuditId = cmd.outcome === 'PERFORMED' ? cmd.domainResultAuditId : undefined
      r.completedAt = nowIso()
      r.completedBy = actor.name
      irHistory(r, actor, 'Gửi kết quả và hoàn thành.')
      notifyCs(`${actor.role} ${actor.name} đã trả kết quả ${r.code}`, result.slice(0, 80), r.ticketCode, `Xem ${r.ticketCode}`)
      return structuredClone(r)
    },

    async reset() {
      tickets = structuredClone(seed.tickets)
      irs = structuredClone(seed.irs)
      notifications = structuredClone(seed.notifications)
      staff = structuredClone(seed.staff)
      domain = structuredClone(seed.domain)
    },
  }
}
export type SupportDemoStore = ReturnType<typeof createSupportDemoStore>
export const supportDemoStore = createSupportDemoStore()
