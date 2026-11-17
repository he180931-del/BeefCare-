import { addCalendarDays, businessDate, parseBusinessTime } from '../../../api/farmTimeZone'
import type { AccessHistoryItem, AccountRecord, AuditDetail, NotificationView, PlatformAccessOperation, PlatformRole } from '../types'

/** Một dòng A11 kèm tài khoản của nó (D33). */
export type AccessHistoryRecord = AccessHistoryItem & { accountId: number }

const change = (
  id: number, accountId: number, action: PlatformAccessOperation, before: [PlatformRole, 'ACTIVE' | 'REVOKED'] | null,
  after: [PlatformRole, 'ACTIVE' | 'REVOKED'], reason: string, by: { name: string; email: string } | null, at: string,
): AccessHistoryRecord => ({
  id, accountId, action, roleBefore: before?.[0] ?? null, statusBefore: before?.[1] ?? null, roleAfter: after[0], statusAfter: after[1],
  reason, byName: by?.name ?? null, byEmail: by?.email ?? null, at,
})
const BY_NAM = { name: 'Vũ Hoàng Nam', email: 'nam.vh@beefcare.vn' }

/**
 * Bản ghi audit thô như trong DB: `details` có thể chứa khóa ngoài danh sách cho phép (lý do, nội dung ticket…); store
 * chỉ trả trường được phép (GBR-86, D34), giống A2. `actorEmail` chỉ dùng để tìm, không hiện.
 */
export type RawAuditEntry = Omit<AuditDetail, 'before' | 'after'> & { actorEmail: string | null; details: Record<string, unknown> }
export type StoredNotification = NotificationView & { targetAssigned: boolean }

export interface PlatformAdminSeed {
  currentUserId: number
  /** Ngày "hôm nay" của mock (yyyy-mm-dd): khớp frame 18/10/2026. */
  today: string
  accounts: AccountRecord[]
  history: AccessHistoryRecord[]
  audit: RawAuditEntry[]
  notifications: StoredNotification[]
}

// Thời điểm của tài khoản ghi kèm +07:00: SCR-16 hiện giờ Asia/Ho_Chi_Minh (Table III-1) dù máy chạy ở múi giờ nào.
const account = (a: Partial<AccountRecord> & Pick<AccountRecord, 'id' | 'email' | 'fullName'>): AccountRecord => ({
  accountStatus: 'ACTIVE',
  platformRole: null,
  platformAccessStatus: null,
  platformAccessVersion: 1,
  ownerRegistrationCompleted: false,
  ownerRegistrationCompletedAt: null,
  version: 1,
  emailVerified: true,
  signInMethods: ['GOOGLE'],
  createdAt: '2025-06-02T09:00:00+07:00',
  lastSignInAt: '2026-10-17T16:30:00+07:00',
  farmCount: 0,
  farmRoles: [],
  ownedFarms: [],
  ...a,
})

const ACCOUNTS: AccountRecord[] = [
  account({
    id: 1, email: 'hung.nv@gmail.com', fullName: 'Nguyễn Văn Hùng', version: 3, ownerRegistrationCompleted: true,
    createdAt: '2024-03-12T09:20:00+07:00', ownerRegistrationCompletedAt: '2024-03-12T09:20:00+07:00', lastSignInAt: '2026-10-18T07:12:00+07:00',
    farmCount: 3, farmRoles: ['OWNER'], ownedFarms: ['Trại bò Yên Bài – Ba Vì', 'Trại Tản Lĩnh', 'Trại Suối Hai'],
  }),
  account({ id: 2, email: 'ha.pt@beefcare.vn', fullName: 'Phạm Thu Hà', platformRole: 'CS', platformAccessStatus: 'ACTIVE', platformAccessVersion: 2, createdAt: '2025-01-15T08:00:00+07:00', lastSignInAt: '2026-10-18T07:40:00+07:00' }),
  account({ id: 3, email: 'quan.dm@beefcare.vn', fullName: 'Đỗ Minh Quân', platformRole: 'PM', platformAccessStatus: 'ACTIVE', platformAccessVersion: 2, createdAt: '2025-01-15T08:10:00+07:00', lastSignInAt: '2026-10-18T06:55:00+07:00' }),
  account({ id: 4, email: 'nam.vh@beefcare.vn', fullName: 'Vũ Hoàng Nam', platformRole: 'SA', platformAccessStatus: 'ACTIVE', platformAccessVersion: 1, createdAt: '2025-01-10T08:00:00+07:00', lastSignInAt: '2026-10-18T07:58:00+07:00' }),
  account({
    id: 5, email: 'mai.lt@gmail.com', fullName: 'Lê Thị Mai', createdAt: '2025-08-20T14:05:00+07:00', lastSignInAt: '2026-10-17T18:20:00+07:00',
    farmCount: 1, farmRoles: ['TECHNICIAN'],
  }),
  account({
    id: 6, email: 'tai.hv@gmail.com', fullName: 'Hồ Văn Tài', accountStatus: 'SUSPENDED', version: 4, signInMethods: ['PASSWORD'], ownerRegistrationCompleted: true,
    createdAt: '2024-03-12T10:30:00+07:00', ownerRegistrationCompletedAt: '2024-03-12T10:30:00+07:00', lastSignInAt: '2026-10-17T09:48:00+07:00',
    farmCount: 1, farmRoles: ['OWNER'], ownedFarms: ['Trại Hồ Tài – Sóc Sơn (đang tạm ngưng dịch vụ)'],
  }),
  account({ id: 7, email: 'khang.nm@beefcare.vn', fullName: 'Ngô Minh Khang', createdAt: '2026-10-15T13:00:00+07:00', lastSignInAt: '2026-10-17T16:30:00+07:00' }),
  account({
    id: 8, email: 'hoa.tt@gmail.com', fullName: 'Trần Thị Hoa', ownerRegistrationCompleted: true, createdAt: '2025-04-09T10:00:00+07:00', ownerRegistrationCompletedAt: '2025-04-09T10:00:00+07:00',
    lastSignInAt: '2026-10-18T06:20:00+07:00', farmCount: 1, farmRoles: ['OWNER'], ownedFarms: ['Trại Thị Hoa – Gia Lâm'],
  }),
  account({ id: 9, email: 'bao.lq@gmail.com', fullName: 'Lý Quốc Bảo', emailVerified: false, createdAt: '2026-10-16T21:10:00+07:00', lastSignInAt: null }),
  account({ id: 10, email: 'loc.tv@beefcare.vn', fullName: 'Trịnh Văn Lộc', platformRole: 'CS', platformAccessStatus: 'REVOKED', platformAccessVersion: 3, createdAt: '2025-05-02T08:00:00+07:00', lastSignInAt: '2026-10-09T17:00:00+07:00' }),
]

const HISTORY: AccessHistoryRecord[] = [
  change(1, 4, 'GRANT', null, ['SA', 'ACTIVE'], 'Quản trị viên đầu tiên khi triển khai', null, '2025-01-10T08:00:00+07:00'),
  change(2, 2, 'GRANT', null, ['CS', 'ACTIVE'], 'Bổ sung nhân sự hỗ trợ khách hàng', BY_NAM, '2025-01-15T08:05:00+07:00'),
  change(3, 2, 'REVOKE', ['CS', 'ACTIVE'], ['CS', 'REVOKED'], 'Nghỉ phép dài ngày', BY_NAM, '2026-06-01T09:00:00+07:00'),
  change(4, 2, 'RESTORE', ['CS', 'REVOKED'], ['CS', 'ACTIVE'], 'Quay lại làm việc', BY_NAM, '2026-07-01T09:00:00+07:00'),
  change(5, 3, 'GRANT', null, ['CS', 'ACTIVE'], 'Hỗ trợ khách hàng ca sáng', BY_NAM, '2025-01-15T08:15:00+07:00'),
  change(6, 3, 'CHANGE', ['CS', 'ACTIVE'], ['PM', 'ACTIVE'], 'Phụ trách đối soát thanh toán', BY_NAM, '2025-09-01T10:00:00+07:00'),
  change(7, 10, 'GRANT', null, ['CS', 'ACTIVE'], 'Hỗ trợ mùa cao điểm', BY_NAM, '2025-05-02T08:10:00+07:00'),
  change(8, 10, 'REVOKE', ['CS', 'ACTIVE'], ['CS', 'REVOKED'], 'Kết thúc hợp đồng thời vụ', BY_NAM, '2026-10-10T09:15:00+07:00'),
]

const NAM = { id: 4, name: 'Vũ Hoàng Nam', initials: 'VN', role: 'SA', email: 'nam.vh@beefcare.vn' }
const QUAN = { id: 3, name: 'Đỗ Minh Quân', initials: 'ĐQ', role: 'PM', email: 'quan.dm@beefcare.vn' }
const HUNG = { id: 1, name: 'Nguyễn Văn Hùng', initials: 'NH', role: 'OWNER', email: 'hung.nv@gmail.com' }

type Actor = typeof NAM | null
// Thời điểm ghi kèm +07:00: SCR-51 hiện giờ Asia/Ho_Chi_Minh (Table III-1) dù máy chạy ở múi giờ nào.
const audit = (
  id: number, time: string, actor: Actor, action: string, targetType: RawAuditEntry['targetType'], targetId: number,
  targetLabel: string, details: Record<string, unknown>, correlationId: string | null, farm: RawAuditEntry['farm'] = null,
): RawAuditEntry => ({
  id, time, actor: actor && { id: actor.id, name: actor.name, initials: actor.initials, role: actor.role }, actorEmail: actor?.email ?? null,
  action, targetType, targetId, targetLabel, farm, correlationId, details,
})

const AUDIT: RawAuditEntry[] = [
  audit(1, '2026-10-18T08:02:00+07:00', NAM, 'PLATFORM_ACCESS_GRANTED', 'PLATFORM_ACCESS', 7, 'Ngô Minh Khang', { before: {}, after: { role: 'CS', status: 'ACTIVE' } }, 'req-7f21-aa90'),
  audit(2, '2026-10-18T07:31:00+07:00', null, 'PAYMENT_CONFIRMED', 'PAYMENT', 5012, 'BCA9K2Q8',
    { after: { amountVnd: 1200000, termYears: 1, receiptCode: 'RC-5012' }, providerTxnId: 'FT26291', transferContent: 'BCA9K2Q8 chuyen khoan' }, 'req-31b0-77d2'),
  audit(3, '2026-10-17T16:40:00+07:00', QUAN, 'FARM_SERVICE_RESTORED', 'FARM', 12, 'Trại Mai Pha',
    { before: { status: 'SUSPENDED' }, after: { status: 'ACTIVE' }, reason: 'Đã xác minh lại giấy tờ' }, 'req-52c9-1e04', { id: 12, name: 'Trại Mai Pha' }),
  audit(4, '2026-10-17T10:12:00+07:00', NAM, 'ACCOUNT_SUSPENDED', 'ACCOUNT', 6, 'Hồ Văn Tài', { before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED' } }, 'req-9a10-c3e1'),
  audit(5, '2026-10-16T14:05:00+07:00', HUNG, 'MEMBERSHIP_ROLE_CHANGED', 'MEMBERSHIP', 31, 'Trần Quốc Long · Trại bò Yên Bài – Ba Vì',
    { before: { role: 'TECHNICIAN', status: 'ACTIVE' }, after: { role: 'MANAGER', status: 'ACTIVE' } }, 'req-0d44-5be2', { id: 2, name: 'Trại bò Yên Bài – Ba Vì' }),
  audit(6, '2026-10-10T09:15:00+07:00', NAM, 'PLATFORM_ACCESS_REVOKED', 'PLATFORM_ACCESS', 10, 'Trịnh Văn Lộc', { before: { role: 'CS', status: 'ACTIVE' }, after: { role: 'CS', status: 'REVOKED' } }, 'req-6c18-2d77'),
  audit(7, '2026-10-05T14:20:00+07:00', QUAN, 'FINANCE_RECORD_POSTED', 'FINANCE_RECORD', 88, 'FR-0042', { before: { status: 'DRAFT' }, after: { status: 'POSTED' } }, 'req-18aa-90f3'),
  // Khóa ticketBody nằm ngoài danh sách cho phép: không bao giờ được hiển thị. Mục ghi trước D34 không có mã truy vết.
  audit(8, '2026-10-03T11:00:00+07:00', null, 'TICKET_CLOSED', 'TICKET', 1031, 'TK-1031',
    { before: { status: 'RESOLVED' }, after: { status: 'CLOSED', ticketBody: 'Nội dung ticket riêng tư của chủ trại' }, ticketBody: 'Nội dung ticket riêng tư của chủ trại' }, null),
]

export function createPlatformAdminSeed(now: Date = new Date()): PlatformAdminSeed {
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()
  const yesterday = (hour: number, minute: number) => {
    const day = addCalendarDays(businessDate(now), -1)
    const time = [hour, minute].map((value) => String(value).padStart(2, '0')).join(':')
    return new Date(parseBusinessTime(`${day}T${time}`)).toISOString()
  }
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
