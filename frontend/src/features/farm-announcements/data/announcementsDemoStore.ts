import { ANNOUNCEMENTS_SEED } from './announcementsMock'
import { formatDayMonth, formatDayMonthTime } from '../domain/format'
import {
  allowedRecipientRoles, AnnouncementError, assertText, audienceLabel, canWrite, MESSAGES, resolveRecipients,
} from '../domain/announcementRules'
import type {
  AnnouncementRecord, AnnouncementsSeed, AnnouncementSummary, AnnouncementView, CorrectionCommand, DraftCommand, Member, MemberOptions,
  PublishPreview, PublishResult, ReadResult, Viewer,
} from '../types'

const max = (values: number[]) => values.reduce((m, v) => Math.max(m, v), 0)

export function createAnnouncementsDemoStore(seed: AnnouncementsSeed = ANNOUNCEMENTS_SEED, options: { now?: () => Date } = {}) {
  let state = structuredClone(seed)
  const clock = () => (options.now ? options.now() : new Date()).toISOString()

  /** Tìm thành viên theo tên và vai trò; không khớp thì lấy thành viên đầu tiên cùng vai trò. */
  const identify = (viewer: Viewer): Member => {
    const found = state.members.find((m) => m.active && m.role === viewer.role && m.name === viewer.name)
      ?? state.members.find((m) => m.active && m.role === viewer.role)
    if (!found) throw new AnnouncementError('FORBIDDEN', MESSAGES.forbidden)
    return found
  }
  const find = (id: number) => {
    const record = state.announcements.find((a) => a.id === id)
    if (!record) throw new AnnouncementError('NOT_FOUND', MESSAGES.notFound)
    return record
  }
  const current = (r: AnnouncementRecord) => r.versions[r.versions.length - 1]
  const isVisible = (r: AnnouncementRecord, me: Member) =>
    r.authorId === me.id || (r.state === 'PUBLISHED' && r.recipients.some((x) => x.memberId === me.id))
  const requireAuthor = (r: AnnouncementRecord, me: Member) => { if (r.authorId !== me.id) throw new AnnouncementError('FORBIDDEN', MESSAGES.forbidden) }
  const requireWriter = (me: Member) => { if (!canWrite(me.role)) throw new AnnouncementError('FORBIDDEN', MESSAGES.forbidden) }
  const requireVersion = (r: AnnouncementRecord, expected: number | undefined) => {
    if (expected !== undefined && r.version !== expected) throw new AnnouncementError('CONFLICT', MESSAGES.conflict)
  }
  const authorOf = (r: AnnouncementRecord) => state.members.find((m) => m.id === r.authorId)!

  function summary(r: AnnouncementRecord, me: Member): AnnouncementSummary {
    const cur = current(r)
    const rcpt = r.recipients.find((x) => x.memberId === me.id)
    const isAuthor = r.authorId === me.id
    const unread = Boolean(rcpt && cur && rcpt.readVersion !== cur.versionNo)
    const authorSeesUnread = isAuthor && Boolean(cur) && r.recipients.some((x) => x.readVersion !== cur.versionNo)
    return {
      id: r.id,
      title: cur?.title ?? r.title,
      state: r.state,
      authorName: authorOf(r).name,
      authorRole: authorOf(r).role,
      versionNo: cur?.versionNo ?? 0,
      publishedTime: cur?.publishedTime ?? null,
      publishedLabel: !cur ? 'Bản nháp' : unread || authorSeesUnread ? formatDayMonthTime(cur.publishedTime) : formatDayMonth(cur.publishedTime),
      recipientCount: r.recipients.length,
      unread,
      isAuthor,
      isReceived: Boolean(rcpt) && r.state === 'PUBLISHED',
    }
  }

  function view(r: AnnouncementRecord, me: Member): AnnouncementView {
    const cur = current(r)
    const rcpt = r.recipients.find((x) => x.memberId === me.id)
    const isAuthor = r.authorId === me.id
    const unread = Boolean(rcpt && cur && rcpt.readVersion !== cur.versionNo)
    const author = authorOf(r)
    return {
      id: r.id,
      state: r.state,
      authorName: author.name,
      authorRole: author.role,
      draftTitle: r.title,
      draftBody: r.body,
      title: cur?.title ?? r.title,
      body: cur?.body ?? r.body,
      version: r.version,
      versions: r.versions.map((v) => ({
        id: v.id, versionNo: v.versionNo, title: v.title, body: v.body, publishedTime: v.publishedTime, correctionReason: v.correctionReason,
        unread: unread && v.versionNo === cur.versionNo,
      })),
      audience: r.audience,
      audienceLabel: audienceLabel(r.audience),
      recipientCount: r.recipients.length,
      deliveries: isAuthor && r.state === 'PUBLISHED'
        ? r.recipients.map((x) => {
            const member = state.members.find((m) => m.id === x.memberId)!
            return { recipientId: x.recipientId, name: member.name, role: member.role, status: x.readVersion === cur.versionNo ? 'READ' as const : 'DELIVERED' as const, readTime: x.readVersion === cur.versionNo ? x.readTime : null }
          })
        : null,
      publishedTime: cur?.publishedTime ?? null,
      farmName: state.farmName,
      relatedLink: r.relatedLink ?? null,
      unread,
      readTime: rcpt && !unread ? rcpt.readTime : null,
      isAuthor,
      canCorrect: isAuthor && r.state === 'PUBLISHED',
    }
  }

  return {
    async listMembers(viewer: Viewer): Promise<MemberOptions> {
      const me = identify(viewer)
      const roles = allowedRecipientRoles(me.role)
      const active = state.members.filter((m) => m.active && m.id !== me.id)
      return structuredClone({
        members: active.filter((m) => roles.includes(m.role)),
        managerCount: state.members.filter((m) => m.active && m.role === 'MANAGER').length,
        technicianCount: state.members.filter((m) => m.active && m.role === 'TECHNICIAN').length,
      })
    },

    async list(viewer: Viewer): Promise<AnnouncementSummary[]> {
      const me = identify(viewer)
      return state.announcements
        .filter((r) => isVisible(r, me))
        .map((r) => summary(r, me))
        .sort((a, b) => (b.publishedTime ?? '9').localeCompare(a.publishedTime ?? '9') || b.id - a.id)
    },

    async get(id: number, viewer: Viewer): Promise<AnnouncementView> {
      const me = identify(viewer)
      const r = find(id)
      if (!isVisible(r, me)) throw new AnnouncementError('FORBIDDEN', MESSAGES.forbidden)
      return structuredClone(view(r, me))
    },

    async saveDraft(viewer: Viewer, command: DraftCommand): Promise<AnnouncementView> {
      const me = identify(viewer)
      requireWriter(me)
      assertText({ title: command.title })
      if (command.body.length > 5000) assertText({ body: command.body })
      if (resolveRecipients(state.members, command.audience, me).invalid) throw new AnnouncementError('NOT_ALLOWED', MESSAGES.notAllowed)

      let r: AnnouncementRecord
      if (command.id !== undefined) {
        r = find(command.id)
        requireAuthor(r, me)
        if (r.state !== 'DRAFT') throw new AnnouncementError('CONFLICT', MESSAGES.conflict)
        requireVersion(r, command.expectedVersion)
        r.version += 1
      } else {
        r = { id: max(state.announcements.map((a) => a.id)) + 1, state: 'DRAFT', authorId: me.id, title: '', body: '', audience: command.audience, version: 1, versions: [], recipients: [] }
        state.announcements.push(r)
      }
      r.title = command.title.trim()
      r.body = command.body
      r.audience = structuredClone(command.audience)
      return structuredClone(view(r, me))
    },

    async previewPublish(viewer: Viewer, id: number): Promise<PublishPreview> {
      const me = identify(viewer)
      const r = find(id)
      requireAuthor(r, me)
      if (r.state !== 'DRAFT') throw new AnnouncementError('CONFLICT', MESSAGES.conflict)
      return structuredClone({ announcement: view(r, me), recipients: resolveRecipients(state.members, r.audience, me).recipients })
    },

    async publish(viewer: Viewer, id: number, expectedVersion: number): Promise<PublishResult> {
      const me = identify(viewer)
      const r = find(id)
      requireAuthor(r, me)
      if (r.state !== 'DRAFT') throw new AnnouncementError('CONFLICT', MESSAGES.conflict)
      requireVersion(r, expectedVersion)
      assertText({ title: r.title, body: r.body })
      const { recipients, invalid } = resolveRecipients(state.members, r.audience, me)
      if (invalid) throw new AnnouncementError('NOT_ALLOWED', MESSAGES.notAllowed)
      if (recipients.length === 0) throw new AnnouncementError('NO_RECIPIENT', MESSAGES.noRecipient)

      let recipientId = max(state.announcements.flatMap((a) => a.recipients.map((x) => x.recipientId)))
      r.versions = [{ id: max(state.announcements.flatMap((a) => a.versions.map((v) => v.id))) + 1, versionNo: 1, title: r.title, body: r.body, publishedTime: clock(), correctionReason: null }]
      r.recipients = recipients.map((m) => ({ recipientId: ++recipientId, memberId: m.id, readVersion: null, readTime: null }))
      r.state = 'PUBLISHED'
      r.version = 1
      return structuredClone({ announcement: view(r, me), recipientCount: recipients.length })
    },

    async correct(viewer: Viewer, id: number, command: CorrectionCommand): Promise<AnnouncementView> {
      const me = identify(viewer)
      const r = find(id)
      requireAuthor(r, me)
      if (r.state !== 'PUBLISHED') throw new AnnouncementError('FORBIDDEN', MESSAGES.forbidden)
      requireVersion(r, command.expectedVersion)
      assertText({ title: command.title, body: command.body, reason: command.reason })

      const versionNo = current(r).versionNo + 1
      r.versions.push({
        id: max(state.announcements.flatMap((a) => a.versions.map((v) => v.id))) + 1, versionNo, title: command.title.trim(), body: command.body,
        publishedTime: clock(), correctionReason: command.reason.trim(),
      })
      // Gửi lại cho người nhận ban đầu còn hoạt động; người đã nghỉ thì loại khỏi bản chụp.
      r.recipients = r.recipients
        .filter((x) => state.members.find((m) => m.id === x.memberId)?.active)
        .map((x) => ({ ...x, readVersion: null, readTime: null }))
      r.version = versionNo
      return structuredClone(view(r, me))
    },

    async markRead(viewer: Viewer, id: number): Promise<ReadResult | null> {
      const me = identify(viewer)
      const r = find(id)
      if (!isVisible(r, me)) throw new AnnouncementError('FORBIDDEN', MESSAGES.forbidden)
      const rcpt = r.recipients.find((x) => x.memberId === me.id)
      if (!rcpt || r.state !== 'PUBLISHED') return null
      const versionNo = current(r).versionNo
      if (rcpt.readVersion !== versionNo) { rcpt.readVersion = versionNo; rcpt.readTime = clock() }
      return { recipientId: rcpt.recipientId, readTime: rcpt.readTime! }
    },

    async deactivateMember(memberId: number) {
      // Chỉ phục vụ test và demo: thành viên rời trại sau khi thông báo đã đăng.
      const member = state.members.find((m) => m.id === memberId)
      if (member) member.active = false
    },

    async reset() { state = structuredClone(seed) },
  }
}
export type AnnouncementsDemoStore = ReturnType<typeof createAnnouncementsDemoStore>
export const announcementsDemoStore = createAnnouncementsDemoStore()
