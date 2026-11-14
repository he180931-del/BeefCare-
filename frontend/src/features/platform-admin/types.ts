// Tên trường theo DTO trong openapi.json (AccountListItem, AccountDetail, AccountChange, PlatformAccessRequest, AuditEntry, NotificationView).
// Các trường đánh dấu "giao diện" chưa có trong DTO: màn hình cần nhưng OpenAPI chưa trả về.

export type AccountStatus = 'ACTIVE' | 'SUSPENDED'
export type PlatformRole = 'CS' | 'PM' | 'SA'
export type PlatformAccessStatus = 'ACTIVE' | 'REVOKED'
export type PlatformAccessOperation = 'GRANT' | 'CHANGE' | 'REVOKE' | 'RESTORE'
export type SignInMethod = 'GOOGLE' | 'PASSWORD'
export type FarmRole = 'OWNER' | 'MANAGER' | 'TECHNICIAN'

/**
 * A9 – một dòng SCR-16 (D31). `platformRole` / `platformAccessStatus` là quyền đang lưu: vai trò đã thu hồi vẫn được
 * trả về (REVOKED) để UC9 khôi phục; cột "Vai trò nền tảng" chỉ coi vai trò ACTIVE là có vai trò.
 */
export interface AccountListItem {
  id: number
  email: string
  fullName: string
  accountStatus: AccountStatus
  platformRole: PlatformRole | null
  platformAccessStatus: PlatformAccessStatus | null
  emailVerified: boolean
  /** Số membership ACTIVE. */
  farmCount: number
  /** Vai trò của các membership ACTIVE, theo thứ tự Chủ trại → Quản lý → Kỹ thuật viên. */
  farmRoles: FarmRole[]
}

/** Lệnh đổi trạng thái SA đang xem được dùng (D32): SUSPEND cho tài khoản ACTIVE không phải của chính mình, RESTORE cho SUSPENDED. */
export type AccountStatusAction = 'SUSPEND' | 'RESTORE'

/** A10 – chi tiết tài khoản (D31); không có SĐT, mật khẩu hay dữ liệu vận hành trại (GBR-11). */
export interface AccountDetail extends AccountListItem {
  /** null khi chưa từng có quyền nền tảng. */
  platformAccessVersion: number | null
  signInMethods: SignInMethod[]
  createdAt: string
  lastSignInAt: string | null
  ownerRegistrationCompleted: boolean
  ownerRegistrationCompletedAt: string | null
  ownedFarms: string[]
  version: number
  /** Do máy chủ tính theo SA đang xem (D32); nút Tạm ngưng / Khôi phục chỉ hiện khi có trong danh sách. */
  actions: AccountStatusAction[]
}

/** Tài khoản trong dữ liệu mô phỏng: A10 trừ `actions`, vốn tính theo SA đang xem lúc đọc. */
export type AccountRecord = Omit<AccountDetail, 'actions'>

/** DTO AccountChange (A12, D32): giao diện giữ `expectedVersion`, adapter gửi thành `version`. */
export interface AccountChange { reason: string; expectedVersion: number }

/** DTO PlatformAccessRequest: `version` được gửi là `platformAccessVersion` của account (null khi chưa có quyền). */
export interface PlatformAccessChange {
  operation: PlatformAccessOperation
  role?: PlatformRole
  reason: string
  expectedVersion: number | null
}

export type SortDir = 'asc' | 'desc'

export interface AccountFilters {
  q?: string
  status?: '' | AccountStatus
  /**
   * '' tất cả, NONE không có vai trò ACTIVE (gồm cả vai trò đã thu hồi), CS / PM / SA vai trò đó đang ACTIVE (D31).
   * STAFF (mọi người từng có vai trò, kể cả đã thu hồi) chỉ dùng cho trang "Quyền nhân sự" bản mô phỏng (FE-03 Q5).
   */
  platformRole?: '' | 'NONE' | 'STAFF' | PlatformRole
  /** Chiều sắp xếp theo tên (cột Người dùng); mặc định A→Z. */
  dir?: SortDir
  /** Trang bắt đầu từ 1 ở giao diện. */
  page?: number
  size?: number
}

export interface PageResult<T> {
  content: T[]
  totalElements: number
  totalPages: number
  /** Số trang bắt đầu từ 0 như `page` của A9 (AccountPage). */
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
