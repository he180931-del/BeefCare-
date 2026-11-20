import { BackendError } from '../../../shared/api/backendClient'
import { asRecord, asRows } from '../../../shared/api/parse'
import { activeFarmId } from '../../../app/session/currentFarm'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import type { AnnouncementsDemoStore } from '../data/announcementsDemoStore'
import { allowedRecipientRoles, AnnouncementError, audienceLabel, MESSAGES } from '../domain/announcementRules'
import { formatDayMonth, formatDayMonthTime } from '../domain/format'
import type {
  AnnouncementRole, AnnouncementSummary, AnnouncementView, CorrectionCommand, DraftCommand, Member, MemberOptions,
  PublishPreview, PublishResult, ReadResult, Viewer,
} from '../types'
import { demo } from '../../../demo/demoModules'
import { lazyObject } from '../../../shared/lib/lazyObject'

const roles = ['OWNER', 'MANAGER', 'TECHNICIAN'] as const satisfies readonly AnnouncementRole[]
const validRole = (value: unknown): AnnouncementRole => {
  if (typeof value === 'string' && roles.includes(value as AnnouncementRole)) return value as AnnouncementRole
  throw new Error('Dữ liệu máy chủ không có vai trò thông báo hợp lệ.')
}

function requiredNumber(row: Record<string, unknown>, field: string): number {
  const value = row[field]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  throw new Error(`Dữ liệu máy chủ thiếu ${field} của thông báo.`)
}

function requiredText(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  if (typeof value === 'string') return value
  throw new Error(`Dữ liệu máy chủ thiếu ${field} của thông báo.`)
}

function optionalTime(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function deliveryStatus(value: unknown): 'DELIVERED' | 'READ' {
  if (value === 'DELIVERED' || value === 'READ') return value
  throw new Error('Dữ liệu máy chủ có trạng thái nhận thông báo không hợp lệ.')
}

function backendError(error: unknown): never {
  if (!(error instanceof BackendError)) throw error

  const code = error.code?.toUpperCase() ?? ''
  if (code === 'MSG-FE07-02') throw new AnnouncementError('NOT_ALLOWED', MESSAGES.notAllowed, 'audience')
  if (code === 'MSG-FE07-05') throw new AnnouncementError('NO_RECIPIENT', MESSAGES.noRecipient)
  if (code === 'MSG-COM-05' || error.status === 409) throw new AnnouncementError('CONFLICT', MESSAGES.conflict)
  if (code === 'MSG-COM-01' || error.status === 403) throw new AnnouncementError('FORBIDDEN', MESSAGES.forbidden)
  if (code === 'MSG-COM-08' || error.status === 404) throw new AnnouncementError('NOT_FOUND', MESSAGES.notFound)

  const violations = [...error.fieldErrors, ...error.violations.map((item) => ({ field: item.field ?? item.propertyPath ?? '', message: item.message ?? '' }))]
  const invalid = violations.find((item) => ['title', 'body', 'reason', 'recipientRoles', 'recipientMemberIds'].includes(item.field))
  if (code === 'MSG-COM-06' || invalid) {
    const field = ['recipientRoles', 'recipientMemberIds'].includes(invalid?.field ?? '') ? 'audience' : invalid?.field
    if (field === 'title' || field === 'body' || field === 'reason' || field === 'audience') {
      throw new AnnouncementError('VALIDATION', invalid?.message || 'Kiểm tra lại các trường bắt buộc.', field)
    }
    throw new AnnouncementError('VALIDATION', 'Kiểm tra lại các trường bắt buộc.')
  }

  throw error
}

function mapVersion(value: unknown) {
  const row = asRecord(value)
  return {
    id: requiredNumber(row, 'id'),
    versionNo: requiredNumber(row, 'versionNo'),
    title: requiredText(row, 'title'),
    body: requiredText(row, 'body'),
    publishedTime: requiredText(row, 'publishedTime'),
    correctionReason: typeof row.correctionReason === 'string' ? row.correctionReason : null,
    unread: row.unread === true,
  }
}

function mapMember(value: unknown): Member {
  const row = asRecord(value)
  return {
    id: requiredNumber(row, 'id'),
    name: requiredText(row, 'name'),
    role: validRole(row.role),
    active: row.active === true,
  }
}

function mapAnnouncement(value: unknown): AnnouncementView {
  const row = asRecord(value)
  const state = row.state
  if (state !== 'DRAFT' && state !== 'PUBLISHED') throw new Error('Dữ liệu máy chủ có trạng thái thông báo không hợp lệ.')
  if (!Array.isArray(row.versions) || !Array.isArray(row.recipientRoles)) throw new Error('Dữ liệu máy chủ thiếu lịch sử hoặc đối tượng thông báo.')

  if (!Array.isArray(row.recipientMemberIds) || row.recipientMemberIds.some((id) => typeof id !== 'number' || !Number.isFinite(id))) {
    throw new Error('Dữ liệu máy chủ thiếu danh sách thành viên được chọn riêng.')
  }
  const recipientRoles = row.recipientRoles.map(validRole)
  const audience = {
    allManagers: recipientRoles.includes('MANAGER'),
    allTechnicians: recipientRoles.includes('TECHNICIAN'),
    memberIds: row.recipientMemberIds as number[],
  }
  const deliveries = row.deliveries === null
    ? null
    : Array.isArray(row.deliveries)
      ? asRows(row.deliveries).map((delivery) => {
          return {
            recipientId: requiredNumber(delivery, 'recipientId'),
            name: requiredText(delivery, 'name'),
            role: validRole(delivery.role),
            status: deliveryStatus(delivery.status),
            readTime: optionalTime(delivery.readTime),
          }
        })
      : (() => { throw new Error('Dữ liệu máy chủ thiếu trạng thái gửi thông báo.'); })()

  return {
    id: requiredNumber(row, 'id'),
    state,
    authorName: requiredText(row, 'authorName'),
    authorRole: validRole(row.authorRole),
    draftTitle: typeof row.draftTitle === 'string' ? row.draftTitle : '',
    draftBody: typeof row.draftBody === 'string' ? row.draftBody : '',
    title: typeof row.title === 'string' ? row.title : '',
    body: typeof row.body === 'string' ? row.body : '',
    version: requiredNumber(row, 'version'),
    versions: row.versions.map(mapVersion),
    audience,
    audienceLabel: audienceLabel(audience),
    recipientCount: requiredNumber(row, 'recipientCount'),
    deliveries,
    publishedTime: optionalTime(row.publishedTime),
    farmName: requiredText(row, 'farmName'),
    relatedLink: null,
    unread: row.unread === true,
    readTime: optionalTime(row.readTime),
    myDeliveryId: typeof row.myDeliveryId === 'number' ? row.myDeliveryId : null,
    isAuthor: row.isAuthor === true,
    isReceived: row.isReceived === true,
    canCorrect: row.canCorrect === true,
  }
}

function summaryOf(announcement: AnnouncementView): AnnouncementSummary {
  const publishedTime = announcement.publishedTime
  const currentVersion = announcement.versions[0]?.versionNo ?? 0
  const authorHasUnread = announcement.deliveries?.some((delivery) => delivery.status === 'DELIVERED') ?? false
  return {
    id: announcement.id,
    latestVersionId: announcement.versions[0]?.id ?? null,
    title: announcement.title,
    state: announcement.state,
    authorName: announcement.authorName,
    authorRole: announcement.authorRole,
    versionNo: currentVersion,
    publishedTime,
    publishedLabel: publishedTime ? (announcement.unread || authorHasUnread ? formatDayMonthTime(publishedTime) : formatDayMonth(publishedTime)) : 'Bản nháp',
    recipientCount: announcement.recipientCount,
    unread: announcement.unread,
    isAuthor: announcement.isAuthor,
    isReceived: announcement.isReceived,
  }
}

function newKey(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('Trình duyệt không hỗ trợ khóa an toàn cho thao tác này.')
  return globalThis.crypto.randomUUID()
}

export function createAnnouncementsApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number | null; transport: BackendTransport; store: AnnouncementsDemoStore }) {
  const base = transport.farmPath(farmId, '/announcements')
  const pendingKeys = new Map<string, string>()

  const call = async <T>(run: () => Promise<T>): Promise<T> => {
    try { return await run() } catch (error) { return backendError(error) }
  }

  const command = async (path: string, body: unknown, method: string) => {
    const fingerprint = `${method}:${path}:${JSON.stringify(body ?? null)}`
    const key = pendingKeys.get(fingerprint) ?? newKey()
    pendingKeys.set(fingerprint, key)
    return call(async () => {
      const response = await transport.command(path, body, { method, key })
      pendingKeys.delete(fingerprint)
      return response
    })
  }

  const loadViews = async () => asRows(await transport.get(base)).map(mapAnnouncement)

  return {
    async list(viewer: Viewer): Promise<AnnouncementSummary[]> {
      if (mode === 'backend') return call(async () => (await loadViews()).map(summaryOf))
      return store.list(viewer)
    },

    async listUnread(viewer: Viewer, limit = 3): Promise<AnnouncementSummary[]> {
      if (mode === 'backend') return call(async () => (await loadViews()).map(summaryOf).filter((announcement) => announcement.isReceived && announcement.unread).slice(0, limit))
      return (await store.list(viewer)).filter((announcement) => announcement.isReceived && announcement.unread).slice(0, limit)
    },

    async get(id: number, viewer: Viewer): Promise<AnnouncementView> {
      if (mode === 'backend') {
        return call(async () => {
          const item = (await loadViews()).find((announcement) => announcement.id === id)
          if (!item) throw new AnnouncementError('NOT_FOUND', MESSAGES.notFound)
          return item
        })
      }
      return store.get(id, viewer)
    },

    async listMembers(viewer: Viewer): Promise<MemberOptions> {
      if (mode === 'backend') {
        return call(async () => {
          // This FE-07 endpoint returns only active, farm-scoped recipients permitted for the current author's role.
          const members = asRows(await transport.get(`${base}/recipients`)).map(mapMember)
            .filter((member) => member.active)
            .filter((member) => allowedRecipientRoles(viewer.role).includes(member.role))
          return {
            members,
            managerCount: members.filter((member) => member.role === 'MANAGER').length,
            technicianCount: members.filter((member) => member.role === 'TECHNICIAN').length,
          }
        })
      }
      return store.listMembers(viewer)
    },

    async saveDraft(viewer: Viewer, draft: DraftCommand): Promise<AnnouncementView> {
      if (mode === 'backend') {
        const body = {
          title: draft.title,
          body: draft.body,
          recipientRoles: [draft.audience.allManagers && 'MANAGER', draft.audience.allTechnicians && 'TECHNICIAN'].filter((role): role is string => Boolean(role)),
          recipientMemberIds: [...new Set(draft.audience.memberIds)],
          ...(draft.id === undefined ? {} : { expectedVersion: draft.expectedVersion }),
        }
        const path = draft.id === undefined ? `${base}/drafts` : `${base}/${draft.id}/draft`
        const response = await command(path, body, draft.id === undefined ? 'POST' : 'PUT')
        return mapAnnouncement(response)
      }
      return store.saveDraft(viewer, draft)
    },

    async previewPublish(viewer: Viewer, id: number): Promise<PublishPreview> {
      if (mode === 'backend') {
        return call(async () => {
          const row = asRecord(await transport.get(`${base}/${id}/preview`))
          return {
            announcement: mapAnnouncement(row.announcement),
            recipients: asRows(row.recipients).map(mapMember),
          }
        })
      }
      return store.previewPublish(viewer, id)
    },

    async publish(viewer: Viewer, id: number, expectedVersion: number): Promise<PublishResult> {
      if (mode === 'backend') {
        const announcement = mapAnnouncement(await command(`${base}/${id}/publish`, { expectedVersion }, 'POST'))
        return { announcement, recipientCount: announcement.recipientCount }
      }
      return store.publish(viewer, id, expectedVersion)
    },

    async correct(viewer: Viewer, id: number, correction: CorrectionCommand): Promise<AnnouncementView> {
      if (mode === 'backend') {
        return mapAnnouncement(await command(`${base}/${id}/corrections`, {
          title: correction.title,
          body: correction.body,
          reason: correction.reason,
          expectedVersion: correction.expectedVersion,
        }, 'POST'))
      }
      return store.correct(viewer, id, correction)
    },

    async markRead(viewer: Viewer, id: number): Promise<ReadResult | null> {
      if (mode === 'backend') {
        return call(async () => {
          const announcement = (await loadViews()).find((item) => item.id === id)
          if (!announcement?.myDeliveryId) return null
          const row = asRecord(await command(`${base}/recipients/${announcement.myDeliveryId}/read`, undefined, 'POST'))
          return { recipientId: requiredNumber(row, 'recipientId'), readTime: requiredText(row, 'readTime') }
        })
      }
      return store.markRead(viewer, id)
    },
  }
}

export type AnnouncementsApi = ReturnType<typeof createAnnouncementsApi>
export const announcementsApi = createAnnouncementsApi({ mode: backendMode, farmId: activeFarmId, transport: backendTransport, store: lazyObject(() => demo.announcements.announcementsDemoStore) })
