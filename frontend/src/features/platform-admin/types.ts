// Tên trường theo DTO trong openapi.json (AccountSummary, AccountChange, PlatformAccessRequest, AuditEntry, NotificationView).
// Các trường đánh dấu "giao diện" chưa có trong DTO: màn hình cần nhưng OpenAPI chưa trả về.

export type AccountStatus = 'ACTIVE' | 'SUSPENDED'
export type PlatformRole = 'CS' | 'PM' | 'SA'
export type PlatformAccessStatus = 'ACTIVE' | 'REVOKED'
export type PlatformAccessOperation = 'GRANT' | 'CHANGE' | 'REVOKE' | 'RESTORE'
export type SignInProvider = 'GOOGLE' | 'PASSWORD'

export interface AccountSummary {
  id: number
  email: string
  fullName: string
  phone: string | null
  accountStatus: AccountStatus
  platformRole: PlatformRole | null
  platformAccessStatus: PlatformAccessStatus | null
  platformAccessVersion: number
  ownerRegistrationCompleted: boolean
  version: number
  // giao diện (SCR-16)
  emailVerified: boolean
  signInProvider: SignInProvider
  createdAt: string
  ownerRegisteredAt: string | null
  lastSignInAt: string | null
  farmCount: number
  farmRoleSummary: string
  ownedFarms: string[]
}

/** DTO AccountChange: `version` được gửi là `expectedVersion` của account. */
export interface AccountChange { reason: string; expectedVersion: number }

/** DTO PlatformAccessRequest: `version` được gửi là `platformAccessVersion` của account. */
export interface PlatformAccessChange {
  operation: PlatformAccessOperation
  role?: PlatformRole
  reason: string
  expectedVersion: number
}

export interface AccountFilters {
  q?: string
  status?: '' | AccountStatus
  /** '' tất cả, NONE chưa có vai trò, STAFF bất kỳ vai trò nền tảng, hoặc một vai trò (OpenAPI chưa có tham số này: lọc phía client). */
  platformRole?: '' | 'NONE' | 'STAFF' | PlatformRole
  page?: number
  size?: number
}

export interface PageResult<T> {
  content: T[]
  totalElements: number
  totalPages: number
  /** Số trang bắt đầu từ 0 như PageAccountSummary. */
  number: number
  size: number
}

/** DTO AuditItem: lịch sử vai trò của một tài khoản. */
export interface AuditItem { id: number; action: string; at: string; details: string }

export type AuditTargetType = 'ACCOUNT' | 'PLATFORM_ACCESS' | 'MEMBERSHIP' | 'FARM' | 'PAYMENT' | 'FINANCE_RECORD' | 'TICKET' | 'INTERNAL_REQUEST'

/** Chỉ các khóa trong danh sách cho phép (GBR-86) mới tới được giao diện. */
export interface AuditDetails { before: string; after: string; correlationId: string; scope: string }

export interface AuditEntry {
  id: number
  loggedAt: string
  actorEmail: string | null
  actorName: string | null
  farmName: string | null
  action: string
  targetType: AuditTargetType
  targetId: number | null
  details: AuditDetails
  // giao diện
  actorId: number | null
  actorRole: string | null
  targetLabel: string
  targetRef: string
}

export interface AuditFilters {
  from: string
  to: string
  action?: string
  targetType?: '' | AuditTargetType
  /** '' tất cả, 'SYSTEM' hoặc id tài khoản. */
  actorId?: string
  page?: number
  size?: number
}

export interface AuditActorOption { value: string; label: string }

export interface NotificationView {
  id: number
  category: string
  title: string
  summary: string
  targetType: string
  targetId: number
  createdTime: string
  readTime: string | null
  // giao diện
  targetCode: string
}

export interface NotificationOpenResult { path: string }
