import type { AccountSummary, AuditEntry, NotificationView, PlatformAccessOperation, PlatformRole } from '../types'

export interface AccessHistoryRecord {
  id: number
  accountId: number
  operation: PlatformAccessOperation
  role: PlatformRole
  reason: string
  by: string
  at: string
}

/** Bản ghi audit thô: có thể chứa khóa ngoài danh sách cho phép; store lọc khi trả ra. */
export type RawAuditEntry = Omit<AuditEntry, 'details'> & { details: Record<string, unknown> }
export type StoredNotification = NotificationView & { targetAssigned: boolean }

export interface PlatformAdminSeed {
  currentUserId: number
  /** Ngày "hôm nay" của mock (yyyy-mm-dd): khớp frame 18/10/2026. */
  today: string
  accounts: AccountSummary[]
  history: AccessHistoryRecord[]
  audit: RawAuditEntry[]
  notifications: StoredNotification[]
}

const account = (a: Partial<AccountSummary> & Pick<AccountSummary, 'id' | 'email' | 'fullName'>): AccountSummary => ({
  phone: null,
  accountStatus: 'ACTIVE',
  platformRole: null,
  platformAccessStatus: null,
  platformAccessVersion: 1,
  ownerRegistrationCompleted: false,
  version: 1,
  emailVerified: true,
  signInProvider: 'GOOGLE',
  createdAt: '2025-06-02T09:00:00',
  ownerRegisteredAt: null,
  lastSignInAt: '2026-10-17T16:30:00',
  farmCount: 0,
  farmRoleSummary: '',
  ownedFarms: [],
  ...a,
})

const ACCOUNTS: AccountSummary[] = [
  account({
    id: 1, email: 'hung.nv@gmail.com', fullName: 'Nguyễn Văn Hùng', phone: '0912345678', version: 3, ownerRegistrationCompleted: true,
    createdAt: '2024-03-12T09:20:00', ownerRegisteredAt: '2024-03-12T09:20:00', lastSignInAt: '2026-10-18T07:12:00',
    farmCount: 3, farmRoleSummary: 'Chủ trại', ownedFarms: ['Trại bò Yên Bài – Ba Vì', 'Trại Tản Lĩnh', 'Trại Suối Hai'],
  }),
  account({ id: 2, email: 'ha.pt@beefcare.vn', fullName: 'Phạm Thu Hà', platformRole: 'CS', platformAccessStatus: 'ACTIVE', platformAccessVersion: 2, createdAt: '2025-01-15T08:00:00', lastSignInAt: '2026-10-18T07:40:00' }),
  account({ id: 3, email: 'quan.dm@beefcare.vn', fullName: 'Đỗ Minh Quân', platformRole: 'PM', platformAccessStatus: 'ACTIVE', platformAccessVersion: 2, createdAt: '2025-01-15T08:10:00', lastSignInAt: '2026-10-18T06:55:00' }),
  account({ id: 4, email: 'nam.vh@beefcare.vn', fullName: 'Vũ Hoàng Nam', platformRole: 'SA', platformAccessStatus: 'ACTIVE', platformAccessVersion: 1, createdAt: '2025-01-10T08:00:00', lastSignInAt: '2026-10-18T07:58:00' }),
  account({
    id: 5, email: 'mai.lt@gmail.com', fullName: 'Lê Thị Mai', createdAt: '2025-08-20T14:05:00', lastSignInAt: '2026-10-17T18:20:00',
    farmCount: 1, farmRoleSummary: 'Kỹ thuật viên',
  }),
  account({
    id: 6, email: 'tai.hv@gmail.com', fullName: 'Hồ Văn Tài', accountStatus: 'SUSPENDED', version: 4, signInProvider: 'PASSWORD', ownerRegistrationCompleted: true,
    createdAt: '2024-03-12T10:30:00', ownerRegisteredAt: '2024-03-12T10:30:00', lastSignInAt: '2026-10-17T09:48:00',
    farmCount: 1, farmRoleSummary: 'Chủ trại', ownedFarms: ['Trại Hồ Tài – Sóc Sơn (đang tạm ngưng dịch vụ)'],
  }),
  account({ id: 7, email: 'khang.nm@beefcare.vn', fullName: 'Ngô Minh Khang', createdAt: '2026-10-15T13:00:00', lastSignInAt: '2026-10-17T16:30:00' }),
  account({
    id: 8, email: 'hoa.tt@gmail.com', fullName: 'Trần Thị Hoa', ownerRegistrationCompleted: true, createdAt: '2025-04-09T10:00:00', ownerRegisteredAt: '2025-04-09T10:00:00',
    lastSignInAt: '2026-10-18T06:20:00', farmCount: 1, farmRoleSummary: 'Chủ trại', ownedFarms: ['Trại Thị Hoa – Gia Lâm'],
  }),
  account({ id: 9, email: 'bao.lq@gmail.com', fullName: 'Lý Quốc Bảo', emailVerified: false, createdAt: '2026-10-16T21:10:00', lastSignInAt: null }),
  account({ id: 10, email: 'loc.tv@beefcare.vn', fullName: 'Trịnh Văn Lộc', platformRole: 'CS', platformAccessStatus: 'REVOKED', platformAccessVersion: 3, createdAt: '2025-05-02T08:00:00', lastSignInAt: '2026-10-09T17:00:00' }),
]

const HISTORY: AccessHistoryRecord[] = [
  { id: 1, accountId: 4, operation: 'GRANT', role: 'SA', reason: 'Quản trị viên đầu tiên khi triển khai', by: 'Hệ thống', at: '2025-01-10T08:00:00' },
  { id: 2, accountId: 2, operation: 'GRANT', role: 'CS', reason: 'Bổ sung nhân sự hỗ trợ khách hàng', by: 'Vũ Hoàng Nam', at: '2025-01-15T08:05:00' },
  { id: 3, accountId: 2, operation: 'REVOKE', role: 'CS', reason: 'Nghỉ phép dài ngày', by: 'Vũ Hoàng Nam', at: '2026-06-01T09:00:00' },
  { id: 4, accountId: 2, operation: 'RESTORE', role: 'CS', reason: 'Quay lại làm việc', by: 'Vũ Hoàng Nam', at: '2026-07-01T09:00:00' },
  { id: 5, accountId: 3, operation: 'GRANT', role: 'PM', reason: 'Phụ trách đối soát thanh toán', by: 'Vũ Hoàng Nam', at: '2025-01-15T08:15:00' },
  { id: 6, accountId: 3, operation: 'CHANGE', role: 'PM', reason: 'Chuyển từ CS sang PM', by: 'Vũ Hoàng Nam', at: '2025-09-01T10:00:00' },
  { id: 7, accountId: 10, operation: 'GRANT', role: 'CS', reason: 'Hỗ trợ mùa cao điểm', by: 'Vũ Hoàng Nam', at: '2025-05-02T08:10:00' },
  { id: 8, accountId: 10, operation: 'REVOKE', role: 'CS', reason: 'Kết thúc hợp đồng thời vụ', by: 'Vũ Hoàng Nam', at: '2026-10-10T09:15:00' },
]

const NAM = { id: 4, name: 'Vũ Hoàng Nam', email: 'nam.vh@beefcare.vn', role: 'SA' }
const QUAN = { id: 3, name: 'Đỗ Minh Quân', email: 'quan.dm@beefcare.vn', role: 'PM' }
const HUNG = { id: 1, name: 'Nguyễn Văn Hùng', email: 'hung.nv@gmail.com', role: 'Chủ trại' }

type Actor = typeof NAM | null
const audit = (
  id: number, loggedAt: string, actor: Actor, action: string, targetType: RawAuditEntry['targetType'], targetId: number,
  targetLabel: string, targetRef: string, details: Record<string, unknown>, farmName: string | null = null,
): RawAuditEntry => ({
  id, loggedAt, actorId: actor?.id ?? null, actorEmail: actor?.email ?? null, actorName: actor?.name ?? null, actorRole: actor?.role ?? null,
  farmName, action, targetType, targetId, targetLabel, targetRef, details,
})

const AUDIT: RawAuditEntry[] = [
  audit(1, '2026-10-18T08:02:00', NAM, 'PLATFORM_ACCESS_GRANTED', 'ACCOUNT', 7, 'Ngô Minh Khang', 'c41e…09ab', { before: 'role: —', after: 'role: CS · đang hoạt động', correlationId: 'req-7f21-aa90', scope: 'CS' }),
  audit(2, '2026-10-18T07:31:00', null, 'PAYMENT_CONFIRMED', 'PAYMENT', 5012, 'BCA9K2Q8', 'pay…4410', { before: 'status: PENDING', after: 'status: CONFIRMED', correlationId: 'req-31b0-77d2' }),
  audit(3, '2026-10-17T16:40:00', QUAN, 'FARM_SERVICE_RESTORED', 'FARM', 12, 'Trại Mai Pha', 'frm…0012', { before: 'service: SUSPENDED', after: 'service: ACTIVE', correlationId: 'req-52c9-1e04' }, 'Trại Mai Pha'),
  audit(4, '2026-10-17T10:12:00', NAM, 'ACCOUNT_SUSPENDED', 'ACCOUNT', 6, 'Hồ Văn Tài', 'a77d…31c0', { before: 'status: ACTIVE', after: 'status: SUSPENDED', correlationId: 'req-9a10-c3e1' }),
  audit(5, '2026-10-16T14:05:00', HUNG, 'MEMBERSHIP_ROLE_CHANGED', 'MEMBERSHIP', 31, 'T. Q. Long', 'mbr…0031', { before: 'role: Kỹ thuật viên', after: 'role: Quản lý trại', correlationId: 'req-0d44-5be2' }, 'Trại bò Yên Bài – Ba Vì'),
  audit(6, '2026-10-10T09:15:00', NAM, 'PLATFORM_ACCESS_REVOKED', 'ACCOUNT', 10, 'Trịnh Văn Lộc', 'e5b2…77f4', { before: 'role: CS · đang hoạt động', after: 'role: CS · đã thu hồi', correlationId: 'req-6c18-2d77', scope: 'CS' }),
  audit(7, '2026-10-05T14:20:00', QUAN, 'FINANCE_RECORD_POSTED', 'FINANCE_RECORD', 88, 'TC-0042', 'fin…0088', { before: 'record: —', after: 'record: POSTED', correlationId: 'req-18aa-90f3' }),
  // Khóa ticketBody không nằm trong danh sách cho phép: không bao giờ được hiển thị.
  audit(8, '2026-10-03T11:00:00', null, 'TICKET_CLOSED', 'TICKET', 1031, 'TK-1031', 'tkt…1031', { before: 'status: RESOLVED', after: 'status: CLOSED', correlationId: 'req-44e0-bb12', ticketBody: 'Nội dung ticket riêng tư của chủ trại' }),
]

export function createPlatformAdminSeed(now: Date = new Date()): PlatformAdminSeed {
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()
  const yesterday = (h: number, min: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, h, min).toISOString()
  const notice = (n: Omit<StoredNotification, 'targetType' | 'readTime'> & { readTime?: string | null }): StoredNotification => ({
    targetType: 'INTERNAL_REQUEST', readTime: null, ...n,
  })
  return {
    currentUserId: 4,
    today: '2026-10-18',
    accounts: ACCOUNTS,
    history: HISTORY,
    audit: AUDIT,
    notifications: [
      notice({ id: 1, category: 'REQUEST_ASSIGNED', title: 'CS Phạm Thu Hà giao yêu cầu nội bộ IR-081 cho bạn', summary: 'TK-1025 · Đổi email đăng nhập Google của Chủ trại Trần Thị Hoa', targetId: 81, targetCode: 'IR-081', createdTime: minutesAgo(2), targetAssigned: true }),
      notice({ id: 2, category: 'REQUEST_INFO_ADDED', title: 'CS bổ sung bằng chứng xác minh cho IR-081', summary: '"Chủ trại xác nhận qua số điện thoại đã đăng ký"', targetId: 81, targetCode: 'IR-081', createdTime: minutesAgo(8), targetAssigned: true }),
      notice({ id: 3, category: 'REQUEST_CANCELLED', title: 'IR-076 đã được CS hủy – không cần xử lý', summary: 'Lý do: tài khoản đã tự khôi phục', targetId: 76, targetCode: 'IR-076', createdTime: minutesAgo(180), readTime: minutesAgo(170), targetAssigned: false }),
      notice({ id: 4, category: 'REQUEST_REMINDER', title: 'Nhắc: IR-078 chưa có kết quả sau 4 giờ', summary: 'TK-1019 · Kiểm tra trạng thái tài khoản bị khóa', targetId: 78, targetCode: 'IR-078', createdTime: yesterday(16, 20), readTime: yesterday(16, 40), targetAssigned: true }),
      notice({ id: 5, category: 'REQUEST_RESULT_RECEIVED', title: 'CS đã nhận kết quả IR-073 của bạn', summary: 'Yêu cầu chuyển sang Hoàn thành', targetId: 73, targetCode: 'IR-073', createdTime: yesterday(11, 5), readTime: yesterday(11, 30), targetAssigned: true }),
    ],
  }
}

export const PLATFORM_ADMIN_SEED = createPlatformAdminSeed()
