import type {
  AccountChange, AccountDetail, AccountFilters, AccountListItem, AccountRecord, AccountStatusAction, AuditDetails, AuditEntry, AuditFilters, AuditTargetType, FarmRole,
  PageResult, PlatformAccessChange, PlatformAccessOperation, PlatformAccessStatus, PlatformRole,
} from '../types'

export const REASON_MAX = 500
export const PLATFORM_ROLES: readonly PlatformRole[] = ['CS', 'PM', 'SA']
export const ROLE_LABEL: Record<PlatformRole, string> = {
  CS: 'Nhân viên hỗ trợ (CS)',
  PM: 'Quản lý nền tảng (PM)',
  SA: 'Quản trị hệ thống (SA)',
}

export type PlatformAdminErrorCode =
  | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'STALE' | 'LAST_SA' | 'NO_CHANGE' | 'UNVERIFIED' | 'SUSPENDED_ACCOUNT' | 'NOT_ASSIGNED'

export class PlatformAdminError extends Error {
  code: PlatformAdminErrorCode
  constructor(code: PlatformAdminErrorCode, message: string) {
    super(message)
    this.name = 'PlatformAdminError'
    this.code = code
  }
}

export const MSG = {
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  stale: 'Bản ghi này đã được thay đổi. Vui lòng tải lại và kiểm tra trước khi thử lại.',
  /** MSG-FE03-18. */
  noAccount: 'Chưa có tài khoản BeefCare cho email này. Người đó cần đăng nhập một lần trước khi được cấp quyền.',
  noLongerAssigned: 'Yêu cầu này không còn được giao cho bạn.',
  reasonRequired: 'Lý do là bắt buộc.',
  /** Table III-1 (D32, D33): lý do tạm ngưng / khôi phục và lý do đổi quyền nền tảng. */
  reasonRule: 'Lý do cần từ 5 đến 500 ký tự, trong đó ít nhất 5 ký tự không phải khoảng trắng.',
  /** MSG-FE03-17 (spec FE-03 mục 8). */
  lastSa: 'Phải luôn còn ít nhất một System Admin đang hoạt động, và bạn không thể tạm ngưng tài khoản của chính mình.',
  /** Ghi chú cố định "Last SA notice" của popup quyền nền tảng (SCR-16, MSG-FE03-17). */
  lastSaNotice: 'Phải luôn còn ít nhất một System Admin đang hoạt động: không thể thu hồi hay đổi vai trò của System Admin đang hoạt động cuối cùng.',
  /** D33 Q4: SA không đổi / thu hồi quyền của chính mình (SRS: thu hồi bởi một System Admin khác). */
  ownAccess: 'Bạn không thể thay đổi quyền nền tảng của chính mình.',
  /** MSG-COM-08. */
  gone: 'Mục đã chọn không còn khả dụng. Vui lòng chọn mục khác.',
}

/** MSG-FE03-22 (D33 Q3). */
export const accountSuspendedMessage = (email: string) =>
  `Tài khoản ${email} đang tạm ngưng. Hãy khôi phục tài khoản trước khi cấp, đổi hoặc khôi phục quyền.`

/** MSG-FE03-20: {value} là `role` (vai trò) hoặc `status` (trạng thái). */
export const noChangeMessage = (target: string, value: string) =>
  `Không có thay đổi: ${target} đã ở ${value === 'role' ? 'vai trò' : 'trạng thái'} này.`

const noChange = (target: string, value: 'role' | 'status') => new PlatformAdminError('NO_CHANGE', noChangeMessage(target, value))

/** Lý do của SCR-16 (D32, D33): bỏ khoảng trắng đầu cuối, 5–500 ký tự, ít nhất 5 ký tự không phải khoảng trắng. */
export function validateReason(reason: string): string | null {
  const text = reason.trim()
  if (!text) return MSG.reasonRequired
  if (text.length > REASON_MAX || text.replace(/\s/g, '').length < 5) return MSG.reasonRule
  return null
}

/** `actions` của A10 (D32), dùng cho bản mô phỏng: máy chủ tính cùng quy tắc. */
export function statusActions(a: Pick<AccountRecord, 'id' | 'accountStatus'>, actorId: number): AccountStatusAction[] {
  if (a.accountStatus === 'SUSPENDED') return ['RESTORE']
  return a.id === actorId ? [] : ['SUSPEND']
}

/** MSG-FE03-16. */
export const accountStatusDone = (email: string, status: AccountDetail['accountStatus']) =>
  `Tài khoản ${email} hiện là ${status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng'}.`

// ---------- Tài khoản và quyền nền tảng ----------

export const hasActiveAccess = (a: AccountListItem) => a.platformRole !== null && a.platformAccessStatus === 'ACTIVE'
export const hasRevokedAccess = (a: AccountListItem) => a.platformRole !== null && a.platformAccessStatus === 'REVOKED'
export const isActiveSa = (a: AccountListItem) => a.platformRole === 'SA' && a.platformAccessStatus === 'ACTIVE' && a.accountStatus === 'ACTIVE'

export function isLastActiveSa(accounts: AccountListItem[], id: number) {
  const target = accounts.find((a) => a.id === id)
  return !!target && isActiveSa(target) && !accounts.some((a) => a.id !== id && isActiveSa(a))
}

/**
 * `accessActions` của A10 (D33 Q6), dùng cho bản mô phỏng: máy chủ tính cùng quy tắc. Không có gì trên tài khoản của chính
 * SA; theo quyền đang lưu GRANT / CHANGE + REVOKE / RESTORE; tài khoản bị tạm ngưng hoặc chưa xác minh chỉ còn REVOKE.
 */
export function accessActionsOf(a: AccountRecord, actorId: number): PlatformAccessOperation[] {
  if (a.id === actorId) return []
  const usable = a.accountStatus === 'ACTIVE' && a.emailVerified
  if (hasActiveAccess(a)) return usable ? ['CHANGE', 'REVOKE'] : ['REVOKE']
  if (!usable) return []
  return a.platformRole === null ? ['GRANT'] : ['RESTORE']
}

/** Vì sao popup không có thao tác nào (D33): tài khoản của chính mình, bị tạm ngưng hoặc chưa xác minh. */
export function noAccessActionReason(a: AccountDetail): string | null {
  if (a.accessActions.length) return null
  if (a.accountStatus === 'SUSPENDED') return accountSuspendedMessage(a.email)
  if (!a.emailVerified) return MSG.noAccount
  return MSG.ownAccess
}

export const OPERATION_LABEL: Record<PlatformAccessOperation, string> = {
  GRANT: 'Cấp quyền',
  CHANGE: 'Đổi vai trò',
  REVOKE: 'Thu hồi quyền',
  RESTORE: 'Khôi phục quyền',
}

/** Nhãn nút xác nhận theo hành động (SCR-16 popup, ví dụ "Cấp quyền CS"). */
export function accessButtonLabel(operation: PlatformAccessOperation, role: PlatformRole | undefined, current: PlatformRole | null) {
  switch (operation) {
    case 'GRANT': return `Cấp quyền ${role ?? ''}`.trim()
    case 'CHANGE': return `Đổi sang ${role ?? ''}`.trim()
    case 'REVOKE': return `Thu hồi quyền ${current ?? ''}`.trim()
    case 'RESTORE': return `Khôi phục quyền ${current ?? ''}`.trim()
  }
}

const DONE_VERB: Record<PlatformAccessOperation, string> = { GRANT: 'cấp', CHANGE: 'đổi', REVOKE: 'thu hồi', RESTORE: 'khôi phục' }

/** MSG-FE03-19: "Quyền {role} của {email} đã được {action}." */
export const accessDoneMessage = (role: PlatformRole, email: string, operation: PlatformAccessOperation) =>
  `Quyền ${role} của ${email} đã được ${DONE_VERB[operation]}.`

export const accessText = (role: PlatformRole | null, status: PlatformAccessStatus | null) =>
  role ? `role: ${role} · ${status === 'ACTIVE' ? 'đang hoạt động' : 'đã thu hồi'}` : 'role: —'

/**
 * Kiểm tra lệnh quyền nền tảng theo thứ tự của máy chủ (D33): dữ liệu → tài khoản của chính mình (FORBIDDEN) → tài khoản
 * bị tạm ngưng trừ thu hồi (MSG-FE03-22) → email chưa xác minh trừ thu hồi (MSG-FE03-18) → trạng thái (MSG-FE03-20 khi giá
 * trị đã có hiệu lực, STALE khi quyền đã đổi) → version (STALE) → SA cuối cùng (MSG-FE03-17). Trả quyền mới.
 */
export function planAccessChange(accounts: AccountRecord[], target: AccountRecord, actorId: number, req: PlatformAccessChange) {
  const needsRole = req.operation === 'GRANT' || req.operation === 'CHANGE'
  if (needsRole && !req.role) throw new PlatformAdminError('VALIDATION', 'Vai trò là bắt buộc.')
  const reasonError = validateReason(req.reason)
  if (reasonError) throw new PlatformAdminError('VALIDATION', reasonError)
  if (target.id === actorId) throw new PlatformAdminError('FORBIDDEN', MSG.ownAccess)
  const revoke = req.operation === 'REVOKE'
  if (!revoke && target.accountStatus === 'SUSPENDED') throw new PlatformAdminError('SUSPENDED_ACCOUNT', accountSuspendedMessage(target.email))
  if (!revoke && !target.emailVerified) throw new PlatformAdminError('UNVERIFIED', MSG.noAccount)
  const active = hasActiveAccess(target)
  const revoked = hasRevokedAccess(target)
  const stale = () => new PlatformAdminError('STALE', MSG.stale)
  switch (req.operation) {
    case 'GRANT':
      if (active && target.platformRole === req.role) throw noChange(target.email, 'role')
      if (target.platformRole !== null) throw stale()
      break
    case 'CHANGE':
      if (!active) throw stale()
      if (target.platformRole === req.role) throw noChange(target.email, 'role')
      break
    case 'REVOKE':
      if (revoked) throw noChange(target.email, 'status')
      if (!active) throw stale()
      break
    case 'RESTORE':
      if (active) throw noChange(target.email, 'status')
      if (!revoked) throw stale()
      break
  }
  if ((target.platformAccessVersion ?? 0) !== (req.expectedVersion ?? 0)) throw stale()
  const losesSa = active && target.platformRole === 'SA' && (revoke || (req.operation === 'CHANGE' && req.role !== 'SA'))
  if (losesSa && isLastActiveSa(accounts, target.id)) throw new PlatformAdminError('LAST_SA', MSG.lastSa)
  if (req.operation === 'REVOKE') return { role: target.platformRole as PlatformRole, status: 'REVOKED' as const }
  if (req.operation === 'RESTORE') return { role: target.platformRole as PlatformRole, status: 'ACTIVE' as const }
  return { role: req.role as PlatformRole, status: 'ACTIVE' as const }
}

/**
 * Kiểm tra tạm ngưng hoặc khôi phục tài khoản (UC-FE03-08) theo thứ tự của máy chủ (D32): lý do → tài khoản của chính
 * mình (MSG-FE03-17) → đã ở trạng thái yêu cầu (MSG-FE03-20, kể cả version cũ) → version (MSG-COM-05) → SA cuối cùng.
 */
export function checkAccountChange(accounts: AccountRecord[], target: AccountRecord, actorId: number, req: AccountChange, op: 'suspend' | 'restore') {
  const reasonError = validateReason(req.reason)
  if (reasonError) throw new PlatformAdminError('VALIDATION', reasonError)
  if (op === 'suspend' && target.id === actorId) throw new PlatformAdminError('LAST_SA', MSG.lastSa)
  if (target.accountStatus === (op === 'suspend' ? 'SUSPENDED' : 'ACTIVE')) throw noChange(target.email, 'status')
  if (req.expectedVersion !== target.version) throw new PlatformAdminError('STALE', MSG.stale)
  if (op === 'suspend' && isLastActiveSa(accounts, target.id)) throw new PlatformAdminError('LAST_SA', MSG.lastSa)
}


const nameOrder = new Intl.Collator('vi', { sensitivity: 'accent' })

/** Thứ tự cột Người dùng như A9 (D31): tên tiếng Việt, không phân biệt hoa thường; chưa có tên theo email; rồi email, id. */
export function compareAccounts(a: AccountListItem, b: AccountListItem): number {
  const name = (row: AccountListItem) => row.fullName.trim() || row.email
  return nameOrder.compare(name(a), name(b)) || nameOrder.compare(a.email, b.email) || a.id - b.id
}

/**
 * Lọc như A9 (D31): `q` khớp tên hoặc email (bỏ khoảng trắng đầu cuối, không phân biệt hoa thường, giữ dấu); vai trò
 * CS / PM / SA là vai trò đang ACTIVE; NONE là không có vai trò ACTIVE (gồm vai trò đã thu hồi).
 */
export function filterAccounts<T extends AccountListItem>(accounts: T[], { q = '', status = '', platformRole = '', dir = 'asc' }: AccountFilters): T[] {
  const needle = q.trim().toLocaleLowerCase('vi')
  return accounts
    .filter((a) => {
      if (needle && !a.fullName.toLocaleLowerCase('vi').includes(needle) && !a.email.toLocaleLowerCase('vi').includes(needle)) return false
      if (status && a.accountStatus !== status) return false
      if (platformRole === 'NONE') return !hasActiveAccess(a)
      if (platformRole) return hasActiveAccess(a) && a.platformRole === platformRole
      return true
    })
    .sort((a, b) => (dir === 'desc' ? compareAccounts(b, a) : compareAccounts(a, b)))
}

export function paginate<T>(rows: T[], page: number, size: number): PageResult<T> {
  const current = Math.max(1, page)
  return {
    content: rows.slice((current - 1) * size, current * size),
    totalElements: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / size)),
    number: current - 1,
    size,
  }
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

export const FARM_ROLE_LABEL: Record<FarmRole, string> = { OWNER: 'Chủ trại', MANAGER: 'Quản lý', TECHNICIAN: 'Kỹ thuật viên' }

/** Cột "Trại tham gia" (D31): số membership ACTIVE và các vai trò, ví dụ "3 (Chủ trại, Quản lý)". */
export const farmsJoinedText = (a: Pick<AccountListItem, 'farmCount' | 'farmRoles'>) =>
  a.farmCount === 0 ? '0' : `${a.farmCount} (${a.farmRoles.map((role) => FARM_ROLE_LABEL[role]).join(', ')})`

/** Cột "Vai trò nền tảng" (D31): chỉ vai trò ACTIVE; vai trò đã thu hồi hiện thành "Không có" kèm chú thích. */
export const platformRoleText = (a: AccountListItem) => (hasActiveAccess(a) ? a.platformRole as PlatformRole : 'Không có')
export const revokedRoleNote = (a: AccountListItem) => (hasRevokedAccess(a) ? `${a.platformRole} đã thu hồi` : null)

/** Email và xác minh (D31): Google xác nhận email, hoặc đã bấm link xác minh; tài khoản đăng ký mật khẩu chưa bấm link vẫn hiện. */
export const verificationText = (a: Pick<AccountDetail, 'emailVerified' | 'signInMethods'>) =>
  !a.emailVerified ? 'Chưa xác minh' : a.signInMethods.includes('GOOGLE') ? 'Đã xác minh (Google)' : 'Đã xác minh (email)'

// ---------- Ngày giờ ----------

const pad = (n: number) => String(n).padStart(2, '0')
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ymdParts = (ymd: string) => ymd.split('-').map(Number) as [number, number, number]
export const addDaysYmd = (ymd: string, days: number) => { const [y, m, d] = ymdParts(ymd); return toYmd(new Date(y, m - 1, d + days)) }
export const addMonthsYmd = (ymd: string, months: number) => { const [y, m, d] = ymdParts(ymd); return toYmd(new Date(y, m - 1 + months, d)) }

export const formatDate = (iso: string) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` }
export const formatDateTime = (iso: string) => { const d = new Date(iso); return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
const PLATFORM_ZONE = 'Asia/Ho_Chi_Minh'
const platformParts = (iso: string) =>
  Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: PLATFORM_ZONE, hourCycle: 'h23', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
/** Màn hình nền tảng hiện giờ Asia/Ho_Chi_Minh (Table III-1), không theo múi giờ của máy. */
export const formatPlatformDate = (iso: string) => { const p = platformParts(iso); return `${p.day}/${p.month}/${p.year}` }
export const formatPlatformDateTime = (iso: string) => { const p = platformParts(iso); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` }
export const formatShortDateTime = (iso: string) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}` }

/** Thời gian thông báo: "n phút trước", giờ trong ngày, "Hôm qua", rồi ngày. */
export function formatNoticeTime(iso: string, now: Date) {
  const d = new Date(iso)
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (dayDiff <= 0) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (dayDiff === 1) return 'Hôm qua'
  return formatDate(iso)
}

export const noticeActionLabel = (category: string) =>
  category === 'REQUEST_ASSIGNED' || category === 'REQUEST_REMINDER' ? 'Mở yêu cầu' : 'Xem'

// ---------- Audit ----------

export const AUDIT_ACTIONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'ACCOUNT_SUSPENDED', label: 'Tạm khóa tài khoản' },
  { code: 'ACCOUNT_RESTORED', label: 'Mở khóa tài khoản' },
  { code: 'PLATFORM_ACCESS_GRANTED', label: 'Cấp quyền nền tảng' },
  { code: 'PLATFORM_ACCESS_CHANGED', label: 'Đổi quyền nền tảng' },
  { code: 'PLATFORM_ACCESS_REVOKED', label: 'Thu hồi quyền nền tảng' },
  { code: 'PLATFORM_ACCESS_RESTORED', label: 'Khôi phục quyền nền tảng' },
  { code: 'MEMBERSHIP_ROLE_CHANGED', label: 'Đổi quyền thành viên' },
  { code: 'FARM_SERVICE_RESTORED', label: 'Khôi phục dịch vụ trại' },
  { code: 'PAYMENT_CONFIRMED', label: 'Xác nhận thanh toán' },
  { code: 'FINANCE_RECORD_POSTED', label: 'Ghi sổ thu chi' },
  { code: 'TICKET_CLOSED', label: 'Đóng yêu cầu hỗ trợ' },
]
export const auditActionLabel = (code: string) => AUDIT_ACTIONS.find((a) => a.code === code)?.label ?? code

export const AUDIT_TARGET_TYPES: ReadonlyArray<{ value: AuditTargetType; label: string }> = [
  { value: 'ACCOUNT', label: 'Tài khoản' },
  { value: 'PLATFORM_ACCESS', label: 'Quyền nền tảng' },
  { value: 'MEMBERSHIP', label: 'Thành viên' },
  { value: 'FARM', label: 'Trang trại' },
  { value: 'PAYMENT', label: 'Thanh toán' },
  { value: 'FINANCE_RECORD', label: 'Sổ thu chi' },
  { value: 'TICKET', label: 'Yêu cầu hỗ trợ' },
  { value: 'INTERNAL_REQUEST', label: 'Yêu cầu nội bộ' },
]
export const targetTypeLabel = (type: AuditTargetType) => AUDIT_TARGET_TYPES.find((t) => t.value === type)?.label ?? type

const AUDIT_DETAIL_KEYS = ['before', 'after', 'correlationId', 'scope'] as const

/** GBR-86: chỉ giữ các khóa cho phép và giá trị chuỗi; thân ticket, bằng chứng ngân hàng, bí mật... bị loại. */
export function allowedAuditDetails(raw: Record<string, unknown> | null | undefined): AuditDetails {
  const out: AuditDetails = { before: '', after: '', correlationId: '', scope: '' }
  for (const key of AUDIT_DETAIL_KEYS) {
    const value = raw?.[key]
    if (typeof value === 'string') out[key] = value
  }
  return out
}

export const defaultAuditRange = (todayYmd: string) => ({ from: addDaysYmd(todayYmd, -7), to: todayYmd })

export function validateAuditRange({ from, to }: { from: string; to: string }): string | null {
  if (!from || !to) return 'Thời gian là bắt buộc.'
  if (to < from) return 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.'
  if (to > addMonthsYmd(from, 12)) return 'Khoảng thời gian tối đa là 12 tháng.'
  return null
}

export function filterAudit<T extends Omit<AuditEntry, 'details'>>(entries: T[], { from, to, action = '', targetType = '', actorId = '' }: AuditFilters) {
  return entries
    .filter((e) => {
      const day = toYmd(new Date(e.loggedAt))
      if (day < from || day > to) return false
      if (action && e.action !== action) return false
      if (targetType && e.targetType !== targetType) return false
      if (actorId === 'SYSTEM') return e.actorId === null
      if (actorId && String(e.actorId) !== actorId) return false
      return true
    })
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
}

export function auditToCsv(rows: AuditEntry[]) {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [['Thời điểm', 'Người thực hiện', 'Vai trò', 'Hành động', 'Mã hành động', 'Đối tượng']]
  for (const e of rows) {
    lines.push([formatDateTime(e.loggedAt), e.actorName ?? 'Hệ thống', e.actorRole ?? '', auditActionLabel(e.action), e.action, `${targetTypeLabel(e.targetType)} · ${e.targetLabel}`])
  }
  return lines.map((line) => line.map(cell).join(',')).join('\r\n')
}
