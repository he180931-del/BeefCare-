import { toLocalIso } from '../domain/format'
import { MESSAGES, SupportError } from '../domain/supportError'
import { buildPage, latestResolution, validateCreate, validateReason, validateReply } from '../domain/ticketRules'
import type {
  AcknowledgeCommand,
  CreateTicketCommand,
  HistoryEntry,
  MessageKind,
  ReopenCommand,
  ReplyCommand,
  Ticket,
  TicketFilters,
} from '../types'
import { SUPPORT_DEMO_NOW, SUPPORT_SEED, type SupportSeed } from './supportMock'

/**
 * Store trong bộ nhớ áp dụng đúng luật ticket của Chủ trại (GBR-76..81).
 * Đồng hồ mặc định chạy từ SUPPORT_DEMO_NOW, mỗi thao tác tăng 1 phút để thứ tự thời gian ổn định.
 */
export function createSupportDemoStore(seed: SupportSeed = SUPPORT_SEED, options: { now?: () => Date } = {}) {
  let state = structuredClone(seed)
  let tick = 0
  const stamp = () => toLocalIso(options.now ? options.now() : new Date(new Date(SUPPORT_DEMO_NOW).getTime() + ++tick * 60_000))

  const find = (id: number): Ticket => {
    const t = state.tickets.find((x) => x.id === id)
    if (!t) throw new SupportError('NOT_FOUND', MESSAGES.notFound)
    if (t.requesterId !== state.ownerId) throw new SupportError('FORBIDDEN', MESSAGES.forbidden)
    return t
  }
  const notClosed = (t: Ticket) => {
    if (t.status === 'CLOSED') throw new SupportError('CLOSED', MESSAGES.closed)
  }
  const addMessage = (t: Ticket, kind: MessageKind, text: string, at: string) => {
    const message = { code: `MSG-${state.nextMessageNumber++}`, params: {}, text, kind, author: state.ownerName, authorRole: 'OWNER' as const, createdAt: at }
    t.messages.push(message)
    return message
  }
  const addHistory = (t: Ticket, entry: HistoryEntry) => {
    t.history.push(entry)
    t.status = entry.status
  }
  const touch = (t: Ticket, at: string) => {
    t.updatedAt = at
    t.version += 1
  }
  const messageId = (message: Ticket['messages'][number], index: number) => message.id ?? (Number(message.code.replace(/\D/g, '')) || index + 1)
  const messagePage = (t: Ticket, beforeId: number | null, size: number) => {
    const eligible = t.messages.filter((message, index) => beforeId == null || messageId(message, index) < beforeId)
    const rows = eligible.slice(-size)
    const hasMore = eligible.length > rows.length
    return {
      items: structuredClone(rows),
      nextBeforeId: hasMore && rows.length > 0 ? messageId(rows[0], t.messages.indexOf(rows[0])) : null,
      hasMore,
    }
  }
  const pagedTicket = (t: Ticket): Ticket => {
    const page = messagePage(t, null, 20)
    return structuredClone({ ...t, messages: page.items, messagesBeforeId: page.nextBeforeId, messagesHasMore: page.hasMore })
  }

  return {
    async listOwnedFarms() {
      return structuredClone(state.farms)
    },
    async listTickets(filters: TicketFilters = {}) {
      return structuredClone(buildPage(state.tickets.filter((t) => t.requesterId === state.ownerId), filters))
    },
    async getTicket(id: number) {
      return pagedTicket(find(id))
    },
    async getMessages(id: number, beforeId: number, size = 20) {
      return messagePage(find(id), beforeId, size)
    },
    async create(cmd: CreateTicketCommand) {
      const errors = validateCreate(cmd, state.farms.map((f) => f.id))
      if (Object.keys(errors).length > 0) throw new SupportError('VALIDATION', Object.values(errors)[0], errors)
      const at = stamp()
      const farm = cmd.scope === 'FARM' ? state.farms.find((f) => f.id === cmd.farmId)! : null
      const number = state.nextTicketNumber++
      const ticket: Ticket = {
        id: number,
        code: `TK-${number}`,
        subject: cmd.subject.trim(),
        category: cmd.category as Ticket['category'],
        priority: 'NORMAL',
        status: 'OPEN',
        scope: cmd.scope,
        farmId: farm?.id ?? null,
        farmName: farm?.name ?? null,
        requesterId: state.ownerId,
        requester: state.ownerName,
        assignedCsId: null,
        assignedCs: null,
        createdAt: at,
        updatedAt: at,
        version: 1,
        messages: [],
        resolutions: [],
        history: [{ at, event: 'CREATED', status: 'OPEN', actor: state.ownerName }],
      }
      addMessage(ticket, 'DESCRIPTION', cmd.description.trim(), at)
      state.tickets.push(ticket)
      return pagedTicket(ticket)
    },
    async reply(id: number, cmd: ReplyCommand) {
      const t = find(id)
      const invalid = validateReply(cmd.content)
      if (invalid) throw new SupportError('VALIDATION', invalid, { content: invalid })
      notClosed(t)
      const at = stamp()
      addMessage(t, 'REPLY', cmd.content.trim(), at)
      // Trả lời khi đang chờ chủ trại đưa phiếu về IN_PROGRESS; trả lời một phiếu RESOLVED không mở lại (GBR-78).
      if (t.status === 'WAITING_CUSTOMER') addHistory(t, { at, event: 'IN_PROGRESS', status: 'IN_PROGRESS', actor: state.ownerName })
      touch(t, at)
      return pagedTicket(t)
    },
    async acknowledge(id: number, cmd: AcknowledgeCommand) {
      const t = find(id)
      notClosed(t)
      if (t.status !== 'RESOLVED') throw new SupportError('STATE_CHANGED', MESSAGES.stateChanged)
      const latest = latestResolution(t)
      if (!latest || cmd.resolutionVersion !== latest.version) throw new SupportError('RESULT_CHANGED', MESSAGES.resultChanged)
      if (latest.acknowledged) return pagedTicket(t)
      const at = stamp()
      latest.acknowledged = true
      latest.acknowledgedAt = at
      latest.acknowledgmentComment = cmd.comment?.trim() || null
      addMessage(t, 'ACKNOWLEDGMENT', `Chủ trại đã xác nhận kết quả giải quyết phiên bản ${latest.version}.`, at)
      touch(t, at)
      return pagedTicket(t)
    },
    async reopen(id: number, cmd: ReopenCommand) {
      const t = find(id)
      const invalid = validateReason(cmd.reason)
      if (invalid) throw new SupportError('VALIDATION', invalid, { reason: invalid })
      notClosed(t)
      if (t.status !== 'RESOLVED' || cmd.expectedVersion !== t.version) throw new SupportError('STATE_CHANGED', MESSAGES.stateChanged)
      const at = stamp()
      const reason = cmd.reason.trim()
      addMessage(t, 'REOPEN', reason, at)
      for (const r of t.resolutions) {
        r.acknowledged = false
        r.acknowledgedAt = null
      }
      addHistory(t, { at, event: 'REOPENED', status: 'OPEN', actor: state.ownerName, reason })
      touch(t, at)
      return pagedTicket(t)
    },

    // ---- Mô phỏng phía CS (không thuộc API của Chủ trại): dùng cho test và để tái hiện "kết quả đã thay đổi" / "đã đóng" ----
    async simulateCsResolve(id: number, content: string) {
      const t = find(id)
      notClosed(t)
      const at = stamp()
      const version = (latestResolution(t)?.version ?? 0) + 1
      for (const r of t.resolutions) {
        r.acknowledged = false
        r.acknowledgedAt = null
      }
      t.resolutions.push({ id: state.nextResolutionId++, version, content, resolvedBy: t.assignedCs ?? 'Phạm Thu Hà', resolvedAt: at, acknowledged: false, acknowledgedAt: null, acknowledgmentComment: null, reviewed: false })
      addHistory(t, { at, event: 'RESOLVED', status: 'RESOLVED', actor: t.assignedCs ?? 'Phạm Thu Hà' })
      touch(t, at)
    },
    async simulateCsClose(id: number) {
      const t = find(id)
      if (t.status !== 'RESOLVED' || !latestResolution(t)?.acknowledged) throw new Error('Chỉ đóng được phiếu đã giải quyết và đã được Chủ trại xác nhận.')
      const at = stamp()
      addHistory(t, { at, event: 'CLOSED', status: 'CLOSED', actor: t.assignedCs ?? 'Phạm Thu Hà' })
      touch(t, at)
    },
    async reset() {
      state = structuredClone(seed)
      tick = 0
    },
  }
}
export type SupportDemoStore = ReturnType<typeof createSupportDemoStore>
export const supportDemoStore = createSupportDemoStore()
