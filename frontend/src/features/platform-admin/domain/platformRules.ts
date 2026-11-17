import { DEFAULT_FARM_TIME_ZONE, addCalendarDays, businessDate, businessDateTime, parseBusinessTime } from '../../../api/farmTimeZone'
import type {
  AccountChange, AccountDetail, AccountFilters, AccountListItem, AccountRecord, AccountStatusAction, AuditActionOption, AuditFilters, AuditRow, AuditTargetType, FarmRole,
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

export const toYmd = businessDate
const ymdParts = (ymd: string) => ymd.split('-').map(Number) as [number, number, number]
export const addDaysYmd = addCalendarDays
const calendarDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
export const addMonthsYmd = (ymd: string, months: number) => { const [y, m, d] = ymdParts(ymd); return calendarDate(y, m - 1 + months, d) }

const platformParts = (iso: string) =>
  Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: DEFAULT_FARM_TIME_ZONE, hourCycle: 'h23', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(parseBusinessTime(iso))).map((p) => [p.type, p.value]))
/** Màn hình nền tảng hiện giờ Asia/Ho_Chi_Minh (Table III-1), không theo múi giờ của máy. */
export const formatPlatformDate = (iso: string) => { const p = platformParts(iso); return `${p.day}/${p.month}/${p.year}` }
export const formatPlatformDateTime = (iso: string) => { const p = platformParts(iso); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` }
export const formatDate = formatPlatformDate
export const formatDateTime = formatPlatformDateTime
export const formatShortDateTime = (iso: string) => {
  const p = platformParts(iso)
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`
}

/** Thời gian thông báo: "n phút trước", giờ trong ngày, "Hôm qua", rồi ngày. */
export function formatNoticeTime(iso: string, now: Date) {
  const d = new Date(parseBusinessTime(iso))
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  const today = businessDate(now)
  const day = businessDate(d)
  if (day >= today) return businessDateTime(d).slice(11, 16)
  if (day === addCalendarDays(today, -1)) return 'Hôm qua'
  return formatDate(iso)
}

export const noticeActionLabel = (category: string) =>
  category === 'REQUEST_ASSIGNED' || category === 'REQUEST_REMINDER' ? 'Mở yêu cầu' : 'Xem'

// ---------- Audit (UC-FE17-01, SCR-51, D34) ----------

/** Danh mục audit trung tâm (cùng thứ tự A3): mã công khai, loại đích, nhãn tiếng Việt. */
const AUDIT_CATALOGUE: ReadonlyArray<readonly [string, AuditTargetType, string]> = [
  ['ACCOUNT_SUSPENDED', 'ACCOUNT', 'Tạm ngưng tài khoản'],
  ['ACCOUNT_RESTORED', 'ACCOUNT', 'Khôi phục tài khoản'],
  ['PLATFORM_ACCESS_GRANTED', 'PLATFORM_ACCESS', 'Cấp quyền nền tảng'],
  ['PLATFORM_ACCESS_CHANGED', 'PLATFORM_ACCESS', 'Đổi quyền nền tảng'],
  ['PLATFORM_ACCESS_REVOKED', 'PLATFORM_ACCESS', 'Thu hồi quyền nền tảng'],
  ['PLATFORM_ACCESS_RESTORED', 'PLATFORM_ACCESS', 'Khôi phục quyền nền tảng'],
  ['MEMBERSHIP_JOINED', 'MEMBERSHIP', 'Tham gia trang trại'],
  ['MEMBERSHIP_ROLE_CHANGED', 'MEMBERSHIP', 'Đổi vai trò thành viên'],
  ['MEMBERSHIP_DEACTIVATED', 'MEMBERSHIP', 'Ngừng thành viên'],
  ['MEMBERSHIP_REACTIVATED', 'MEMBERSHIP', 'Kích hoạt lại thành viên'],
  ['FARM_REGISTERED', 'FARM', 'Đăng ký trang trại'],
  ['FARM_SERVICE_SUSPENDED', 'FARM', 'Tạm ngưng dịch vụ trại'],
  ['FARM_SERVICE_RESTORED', 'FARM', 'Khôi phục dịch vụ trại'],
  ['FARM_SERVICE_STATUS_CHANGED', 'FARM', 'Cập nhật trạng thái dịch vụ (tự động)'],
  ['PAYMENT_CONFIRMED', 'PAYMENT', 'Xác nhận thanh toán'],
  ['EVIDENCE_REVIEWED', 'PAYMENT', 'Duyệt chứng từ thanh toán'],
  ['FINANCE_RECORD_POSTED', 'FINANCE_RECORD', 'Ghi sổ thu chi'],
  ['FINANCE_RECORD_VOIDED', 'FINANCE_RECORD', 'Hủy bản ghi thu chi'],
  ['TICKET_CREATED', 'TICKET', 'Tạo yêu cầu hỗ trợ'],
  ['TICKET_ASSIGNED', 'TICKET', 'Nhận xử lý yêu cầu'],
  ['TICKET_HANDED_OVER', 'TICKET', 'Chuyển giao yêu cầu'],
  ['TICKET_RELEASED', 'TICKET', 'Trả yêu cầu về hàng chờ'],
  ['TICKET_WAITING_CUSTOMER', 'TICKET', 'Chờ khách hàng phản hồi'],
  ['TICKET_RESOLVED', 'TICKET', 'Giải quyết yêu cầu'],
  ['TICKET_ACKNOWLEDGED', 'TICKET', 'Chủ trại xác nhận kết quả'],
  ['TICKET_CLOSED', 'TICKET', 'Đóng yêu cầu hỗ trợ'],
  ['TICKET_REOPENED', 'TICKET', 'Mở lại yêu cầu'],
  ['INTERNAL_REQUEST_CREATED', 'INTERNAL_REQUEST', 'Tạo yêu cầu nội bộ'],
  ['INTERNAL_REQUEST_UPDATED', 'INTERNAL_REQUEST', 'Cập nhật yêu cầu nội bộ'],
  ['INTERNAL_REQUEST_COMPLETED', 'INTERNAL_REQUEST', 'Hoàn tất yêu cầu nội bộ'],
]

/** A3 của chế độ mô phỏng; chế độ backend đọc từ máy chủ. */
export const AUDIT_ACTIONS: ReadonlyArray<AuditActionOption> = AUDIT_CATALOGUE.map(([code, targetType]) => ({ code, targetType }))
/** Mã lạ (máy chủ thêm sau) vẫn hiện nguyên mã thay vì biến mất. */
export const auditActionLabel = (code: string) => AUDIT_CATALOGUE.find(([c]) => c === code)?.[2] ?? code

export const AUDIT_TARGET_TYPES: ReadonlyArray<{ value: AuditTargetType; label: string }> = [
  { value: 'ACCOUNT', label: 'Tài khoản' },
  { value: 'PLATFORM_ACCESS', label: 'Quyền nền tảng' },
  { value: 'MEMBERSHIP', label: 'Thành viên' },
  { value: 'FARM', label: 'Trang trại' },
  { value: 'PAYMENT', label: 'Thanh toán' },
  { value: 'FINANCE_RECORD', label: 'Bản ghi thu chi' },
  { value: 'TICKET', label: 'Ticket' },
  { value: 'INTERNAL_REQUEST', label: 'Yêu cầu nội bộ' },
]
export const AUDIT_TARGET_TYPE_VALUES = AUDIT_TARGET_TYPES.map((t) => t.value)
export const targetTypeLabel = (type: AuditTargetType) => AUDIT_TARGET_TYPES.find((t) => t.value === type)?.label ?? type

/** Vai trò của người thực hiện (nền tảng hoặc trong trại); rỗng với mục ghi trước D34. */
export const auditRoleLabel = (role: string | null) =>
  !role ? '' : (ROLE_LABEL as Record<string, string>)[role] ?? (FARM_ROLE_LABEL as Record<string, string>)[role] ?? role

/** Các trường trước / sau được phép hiện (GBR-86, D34), theo thứ tự hiển thị. */
const AUDIT_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['role', 'Vai trò'],
  ['status', 'Trạng thái'],
  ['assignee', 'Người phụ trách'],
  ['name', 'Tên trang trại'],
  ['decision', 'Quyết định'],
  ['amountVnd', 'Số tiền'],
  ['termYears', 'Số năm'],
  ['periodStart', 'Bắt đầu thời hạn'],
  ['periodEnd', 'Kết thúc thời hạn'],
  ['receiptCode', 'Mã biên nhận'],
]
export const AUDIT_FIELD_KEYS = AUDIT_FIELDS.map(([key]) => key)

export interface AuditChangeRow { field: string; label: string; before: string; after: string }

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const auditValue = (field: string, value: string | undefined) => {
  if (!value) return '—'
  if (field === 'amountVnd' && /^\d+$/.test(value)) return `${Number(value).toLocaleString('vi-VN')} ₫`
  return ISO_TIME.test(value) ? formatPlatformDateTime(value) : value
}

/** Một dòng mỗi trường có ở trước hoặc sau; bên thiếu hiện "—" (ví dụ SRS "vai trò: — → CS · ACTIVE"). */
export function auditChanges(before: Record<string, string>, after: Record<string, string>): AuditChangeRow[] {
  const known = AUDIT_FIELDS.filter(([key]) => key in before || key in after)
  const extra = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !AUDIT_FIELD_KEYS.includes(key))
  return [...known, ...extra.map((key) => [key, key] as const)].map(([field, label]) => ({
    field, label, before: auditValue(field, before[field]), after: auditValue(field, after[field]),
  }))
}

/** Chế độ mô phỏng: như máy chủ, chỉ giữ trường cho phép và giá trị đơn (GBR-86); nội dung ticket, chứng từ, bí mật bị bỏ. */
export function allowedAuditChange(details: Record<string, unknown> | null | undefined) {
  const pick = (side: unknown) => {
    const out: Record<string, string> = {}
    if (!side || typeof side !== 'object') return out
    for (const key of AUDIT_FIELD_KEYS) {
      const value = (side as Record<string, unknown>)[key]
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = String(value)
    }
    return out
  }
  return { before: pick(details?.before), after: pick(details?.after) }
}

/** Gợi ý cố định cạnh ô Khoảng thời gian (R-17-05). */
export const AUDIT_RANGE_HINT = 'Tối đa 12 tháng'

/** "7 ngày gần nhất" gồm cả hôm nay (D34): từ hôm nay − 6 đến hôm nay. */
export const defaultAuditRange = (todayYmd: string) => ({ from: addDaysYmd(todayYmd, -6), to: todayYmd })

/** Cộng tháng như máy chủ (LocalDate.plusMonths): 29/02 + 12 tháng = 28/02. */
const plusMonthsClamped = (ymd: string, months: number) => {
  const [y, m, d] = ymdParts(ymd)
  const last = new Date(Date.UTC(y, m + months, 0)).getUTCDate()
  return calendarDate(y, m - 1 + months, Math.min(d, last))
}

/** MSG-COM-06 / MSG-COM-11 / MSG-COM-10, cùng thứ tự kiểm của máy chủ. */
export function validateAuditRange({ from, to }: { from: string; to: string }): string | null {
  if (!from || !to) return 'Vui lòng nhập Khoảng thời gian.'
  if (from > to) return 'Ngày bắt đầu không được sau ngày kết thúc.'
  if (to > plusMonthsClamped(from, 12)) return 'Khoảng thời gian không hợp lệ.'
  return null
}

const SYSTEM_ACTOR_WORDS = ['hệ thống', 'system']

/** Ô Người thực hiện: tên / email (một phần) hoặc "Hệ thống" / "System" (chỉ hành động hệ thống). */
export function auditActorQuery(text = ''): { actor?: string; system?: true } {
  const value = text.trim()
  if (!value) return {}
  return SYSTEM_ACTOR_WORDS.includes(value.toLocaleLowerCase('vi')) ? { system: true } : { actor: value }
}

/** Ngày theo giờ Asia/Ho_Chi_Minh của một thời điểm (yyyy-mm-dd). */
export const platformDay = (iso: string) => { const p = platformParts(iso); return `${p.year}-${p.month}-${p.day}` }

/** Chế độ mô phỏng: lọc như A1 (ngày nền tảng, cả hai đầu; người thực hiện; hành động; loại đích; thứ tự). */
export function filterAudit<T extends AuditRow & { actorEmail: string | null }>(entries: T[], filters: AuditFilters): T[] {
  const { from, to, action = '', targetType = '', dir = 'desc' } = filters
  const who = auditActorQuery(filters.actor)
  const needle = who.actor?.toLocaleLowerCase('vi') ?? ''
  const rows = entries.filter((e) => {
    const day = platformDay(e.time)
    if (day < from || day > to) return false
    if (action && e.action !== action) return false
    if (targetType && e.targetType !== targetType) return false
    if (who.system) return e.actor === null
    if (needle) return !!e.actor && (e.actor.name.toLocaleLowerCase('vi').includes(needle) || (e.actorEmail ?? '').toLocaleLowerCase('vi').includes(needle))
    return true
  })
  const order = (a: T, b: T) => new Date(a.time).getTime() - new Date(b.time).getTime() || a.id - b.id
  return rows.sort((a, b) => (dir === 'asc' ? order(a, b) : order(b, a)))
}
