export type FarmRole = 'OWNER' | 'MANAGER' | 'TECHNICIAN'
export type MemberStatus = 'ACTIVE' | 'INACTIVE'
export type FarmServiceStatus = 'ACTIVE' | 'PENDING_PAYMENT' | 'EXPIRED' | 'SUSPENDED'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'
export type ExpectedHerdSize = 'UNDER_50' | '50_149' | '150_300' | 'OVER_300'
export type MemberAction = 'CHANGE_ROLE' | 'DEACTIVATE' | 'REACTIVATE'

export interface FarmRoleSummary {
  farmId: number
  farmName: string
  role: FarmRole
  permissions: string[]
}

export interface FarmWorkspaceProfile {
  id: number
  email: string
  fullName: string
  phone: string
  emailVerified: boolean
  passwordSignInEnabled: boolean
  googleSignInLinked: boolean
  ownerRegistrationCompleted: boolean
  /** True when terms were accepted during the account flow, before Owner completion. */
  termsAccepted?: boolean
  platformRole: string | null
  farms: FarmRoleSummary[]
}

export interface CompleteOwnerProfileInput { fullName: string; phone: string; termsAccepted: boolean }
export interface UpdateProfileInput { fullName: string; phone: string }

export interface FarmSummary {
  id: number
  name: string
  role: FarmRole
  serviceStatus: FarmServiceStatus
  version: number
  province?: string
  commune?: string
  detailedAddress?: string
  activeCattleCount?: number | null
  serviceUntil?: string | null
  renewalOpensAt?: string | null
  ownerEmail?: string
}

export interface FarmDetails extends FarmSummary {
  contactPerson: string
  contactPhone: string
  registrationCertificateInfo: string
  expectedHerdSize: ExpectedHerdSize | ''
  timeZone: string
  morningShiftStart: string
  operatingNotes: string
  mainBreedIds: number[]
  mainBreedCodes: string[]
  suspendedAt?: string | null
  daysRemaining?: number | null
  ownerName?: string
}

export interface FarmRegistrationInput {
  name: string
  province: string
  commune: string
  detailedAddress?: string
  contactPerson?: string
  contactPhone?: string
  registrationCertificateInfo?: string
  expectedHerdSize: ExpectedHerdSize
  mainBreedCodes?: string[]
}

export interface FarmInfoInput extends Omit<FarmRegistrationInput, 'mainBreedCodes' | 'expectedHerdSize'> {
  timeZone: string
  morningShiftStart: string
  operatingNotes: string
  mainBreedIds: number[]
  expectedVersion: number
}

export interface Membership {
  id: number
  userId: number
  fullName: string
  email: string
  role: FarmRole
  status: MemberStatus
  effectiveDate: string
  reason: string
  version: number
  joinedAt: string
}

export interface Invitation {
  id: number
  email: string
  role: Exclude<FarmRole, 'OWNER'>
  status: InvitationStatus
  createdAt: string
  lastSentAt: string
  expiresAt: string
  validityDays: 3 | 7 | 14
  version: number
  accountHint?: 'HAS_ACCOUNT' | 'NO_ACCOUNT'
}

export interface InvitationPreview {
  farmName: string
  email: string
  role: Exclude<FarmRole, 'OWNER'>
  invitedAt: string
  expiresAt: string
  status: InvitationStatus
  invitedBy?: string
  farmId?: number
}

export interface InviteMemberInput { email: string; role: Exclude<FarmRole, 'OWNER'>; validityDays: 3 | 7 | 14 }
export interface ChangeMemberInput { action: MemberAction; role?: Exclude<FarmRole, 'OWNER'>; effectiveDate: string; reason: string }

export interface RolePermissionRow {
  area: string
  OWNER: string
  MANAGER: string
  TECHNICIAN: string
}

export const ROLE_PERMISSION_ROWS: readonly RolePermissionRow[] = [
  { area: 'Hồ sơ bò và mã QR', OWNER: 'Quản lý, gồm mục đích nuôi', MANAGER: 'Quản lý, trừ mục đích nuôi', TECHNICIAN: 'Xem' },
  { area: 'Chuồng và chuyển chuồng', OWNER: 'Quản lý', MANAGER: 'Quản lý', TECHNICIAN: 'Xem' },
  { area: 'Phiếu nhập đàn, thanh toán, đăng ký bê', OWNER: 'Quản lý', MANAGER: 'Quản lý', TECHNICIAN: '—' },
  { area: 'Tăng trưởng và thể trạng', OWNER: 'Xem', MANAGER: 'Ghi, đính chính', TECHNICIAN: 'Xem' },
  { area: 'Tiêm phòng', OWNER: 'Xem', MANAGER: 'Lập kế hoạch, ghi, đính chính', TECHNICIAN: 'Xem' },
  { area: 'Sức khỏe và điều trị', OWNER: 'Xem', MANAGER: 'Ghi, đính chính', TECHNICIAN: 'Xem' },
  { area: 'Sinh sản', OWNER: 'Xem', MANAGER: 'Ghi, đính chính', TECHNICIAN: 'Xem' },
  { area: 'Danh mục và tham số', OWNER: 'Mục đích nuôi, tham số; xem danh mục', MANAGER: 'Quản lý', TECHNICIAN: 'Xem danh mục' },
  { area: 'Thông báo trang trại', OWNER: 'Gửi cho Quản lý và Kỹ thuật viên', MANAGER: 'Gửi cho Kỹ thuật viên', TECHNICIAN: 'Xem thông báo nhận được' },
  { area: 'Nhắc việc', OWNER: 'Xem', MANAGER: 'Xem tất cả', TECHNICIAN: 'Xem theo vai trò' },
  { area: 'Tổng quan và báo cáo', OWNER: 'Xem', MANAGER: 'Xem', TECHNICIAN: '—' },
  { area: 'Thành viên và quyền', OWNER: 'Quản lý', MANAGER: 'Xem danh sách', TECHNICIAN: '—' },
  { area: 'Phiếu xuất đàn và thu tiền', OWNER: 'Ghi, xác nhận, từ chối, hủy', MANAGER: 'Xem phiếu', TECHNICIAN: '—' },
  { area: 'Thức ăn, phiếu nhập, khẩu phần', OWNER: 'Quản lý', MANAGER: 'Quản lý', TECHNICIAN: 'Xem khẩu phần' },
  { area: 'Nhật ký cho ăn', OWNER: 'Xem', MANAGER: 'Ghi, đính chính', TECHNICIAN: 'Xem' },
  { area: 'Gói dịch vụ và thanh toán', OWNER: 'Quản lý', MANAGER: '—', TECHNICIAN: '—' },
  { area: 'Thông tin trang trại', OWNER: 'Quản lý', MANAGER: '—', TECHNICIAN: '—' },
]
