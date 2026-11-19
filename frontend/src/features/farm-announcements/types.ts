export type AnnouncementRole = 'OWNER' | 'MANAGER' | 'TECHNICIAN'
export type AnnouncementState = 'DRAFT' | 'PUBLISHED'

export interface Member { id: number; name: string; role: AnnouncementRole; active: boolean }

/** Người đang xem, lấy từ phiên đăng nhập. Mock tìm thành viên theo tên, không khớp thì lấy theo vai trò. */
export interface Viewer { name: string; role: AnnouncementRole }

/** `memberIds` không có trong DraftRequest của OpenAPI (chỉ có recipientRoles); cần bổ sung khi nối backend. */
export interface AudienceSelection { allManagers: boolean; allTechnicians: boolean; memberIds: number[] }

export interface DraftCommand { id?: number; title: string; body: string; audience: AudienceSelection; expectedVersion?: number }
export interface CorrectionCommand { title: string; body: string; reason: string; expectedVersion: number }

export interface VersionView {
  id: number
  versionNo: number
  title: string
  body: string
  publishedTime: string
  correctionReason: string | null
  unread: boolean
}

export interface DeliveryView {
  recipientId: number
  name: string
  role: AnnouncementRole
  status: 'DELIVERED' | 'READ'
  readTime: string | null
}

export interface AnnouncementView {
  id: number
  state: AnnouncementState
  authorName: string
  authorRole: AnnouncementRole
  draftTitle: string
  draftBody: string
  /** Tiêu đề và nội dung hiện hành: phiên bản mới nhất, hoặc bản nháp. */
  title: string
  body: string
  /** Khóa lạc quan: số bản nháp đã lưu, sau khi đăng là số phiên bản hiện hành. */
  version: number
  versions: VersionView[]
  audience: AudienceSelection
  audienceLabel: string
  recipientCount: number
  /** Chỉ tác giả của thông báo đã đăng mới thấy. */
  deliveries: DeliveryView[] | null
  publishedTime: string | null
  farmName: string
  relatedLink: { label: string; to: string } | null
  unread: boolean
  readTime: string | null
  isAuthor: boolean
  canCorrect: boolean
}

export interface AnnouncementSummary {
  id: number
  title: string
  state: AnnouncementState
  authorName: string
  authorRole: AnnouncementRole
  versionNo: number
  publishedTime: string | null
  publishedLabel: string
  recipientCount: number
  unread: boolean
  isAuthor: boolean
  isReceived: boolean
}

export interface MemberOptions { members: Member[]; managerCount: number; technicianCount: number }
export interface PublishPreview { announcement: AnnouncementView; recipients: Member[] }
export interface PublishResult { announcement: AnnouncementView; recipientCount: number }
export interface ReadResult { recipientId: number; readTime: string }

export interface RecipientRecord { recipientId: number; memberId: number; readVersion: number | null; readTime: string | null }
export interface VersionRecord { id: number; versionNo: number; title: string; body: string; publishedTime: string; correctionReason: string | null }
export interface AnnouncementRecord {
  id: number
  state: AnnouncementState
  authorId: number
  title: string
  body: string
  audience: AudienceSelection
  version: number
  versions: VersionRecord[]
  recipients: RecipientRecord[]
  relatedLink?: { label: string; to: string }
}
export interface AnnouncementsSeed { farmName: string; members: Member[]; announcements: AnnouncementRecord[] }
