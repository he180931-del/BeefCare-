// Tên trường theo DTO trong openapi.json (AccountListItem, AccountDetail, AccountChange, PlatformAccessRequest, AuditRow, AuditDetail, NotificationView).
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
  /**
   * Lệnh quyền nền tảng SA đang xem được dùng (D33): GRANT (chưa có quyền), CHANGE / REVOKE (quyền ACTIVE), RESTORE
   * (quyền REVOKED); tài khoản bị tạm ngưng hoặc chưa xác minh chỉ còn REVOKE; tài khoản của chính mình rỗng.
   */
  accessActions: PlatformAccessOperation[]
}

/** Tài khoản trong dữ liệu mô phỏng: A10 trừ `actions` / `accessActions`, vốn tính theo SA đang xem lúc đọc. */
export type AccountRecord = Omit<AccountDetail, 'actions' | 'accessActions'>

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
  /** '' tất cả, NONE không có vai trò ACTIVE (gồm cả vai trò đã thu hồi), CS / PM / SA vai trò đó đang ACTIVE (D31). */
  platformRole?: '' | 'NONE' | PlatformRole
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

/** A11 (D33): một dòng lịch sử vai trò, mới nhất trước. Lần cấp đầu không có vai trò / trạng thái trước. */
export interface AccessHistoryItem {
  id: number
  action: PlatformAccessOperation
  roleBefore: PlatformRole | null
  statusBefore: PlatformAccessStatus | null
  roleAfter: PlatformRole
  statusAfter: PlatformAccessStatus
  reason: string
  /** null với dòng chép từ audit cũ không có người làm. */
  byName: string | null
  byEmail: string | null
  at: string
}

export type AuditTargetType = 'ACCOUNT' | 'PLATFORM_ACCESS' | 'MEMBERSHIP' | 'FARM' | 'PAYMENT' | 'FINANCE_RECORD' | 'TICKET' | 'INTERNAL_REQUEST'

/** Người thực hiện của một mục audit (A1/A2, D34); `null` ở chỗ dùng nghĩa là "Hệ thống". `role` rỗng với mục ghi trước D34. */
export interface AuditActor { id: number; name: string; initials: string; role: string | null }

/** Một dòng SCR-51 (A1). `action` là mã công khai, `targetLabel` là tên hiển thị hoặc định danh đã che. */
export interface AuditRow {
  id: number
  time: string
  actor: AuditActor | null
  action: string
  targetType: AuditTargetType
  targetLabel: string
}

/** Chi tiết (A2): chỉ giá trị trước / sau trong danh sách cho phép (GBR-86); thiếu một bên hiện "—". */
export interface AuditDetail extends AuditRow {
  farm: { id: number; name: string } | null
  targetId: number
  before: Record<string, string>
  after: Record<string, string>
  /** Rỗng với mục ghi trước D34. */
  correlationId: string | null
}

/** A3: mã hành động của bộ lọc Hành động. */
export interface AuditActionOption { code: string; targetType: AuditTargetType }

export interface AuditFilters {
  /** yyyy-mm-dd, cả hai đầu đều tính, tối đa 12 tháng (R-17-05). */
  from: string
  to: string
  /** Tên hoặc email (một phần), hoặc "Hệ thống" / "System". */
  actor?: string
  action?: string
  targetType?: '' | AuditTargetType
  /** Mặc định mới nhất trước (R-17-06). */
  dir?: 'asc' | 'desc'
  /** Trang bắt đầu từ 1 trên màn hình. */
  page?: number
  size?: number
}

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
