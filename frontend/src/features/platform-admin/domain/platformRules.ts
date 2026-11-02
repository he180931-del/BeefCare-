import type {
  AccountChange, AccountFilters, AccountSummary, AuditDetails, AuditEntry, AuditFilters, AuditTargetType, PageResult,
  PlatformAccessChange, PlatformAccessOperation, PlatformAccessStatus, PlatformRole,
} from '../types'

export const REASON_MAX = 500
export const PLATFORM_ROLES: readonly PlatformRole[] = ['CS', 'PM', 'SA']
export const ROLE_LABEL: Record<PlatformRole, string> = {
  CS: 'Customer Support (CS)',
  PM: 'Platform Manager (PM)',
  SA: 'System Admin (SA)',
}

export type PlatformAdminErrorCode =
  | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'STALE' | 'LAST_SA' | 'NO_CHANGE' | 'UNVERIFIED' | 'INVALID_STATE' | 'NOT_ASSIGNED'

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
  lastSa: 'Phải còn ít nhất một System Admin đang hoạt động, và bạn không thể tạm khóa tài khoản của chính mình.',
  noAccount: 'Không có tài khoản BeefCare nào cho email này. Người đó cần đăng nhập một lần trước khi được cấp quyền.',
  unverified: 'Email của tài khoản chưa được xác minh nên chưa thể cấp quyền nền tảng.',
  noLongerAssigned: 'Yêu cầu này không còn được giao cho bạn.',
  reasonRequired: 'Lý do là bắt buộc.',
}

const noChange = (target: string, value: string) => new PlatformAdminError('NO_CHANGE', `Không có thay đổi: ${target} đã ở ${value} này.`)

export function validateReason(reason: string): string | null {
  const text = reason.trim()
  if (!text) return MSG.reasonRequired
  if (text.length > REASON_MAX) return `Lý do tối đa ${REASON_MAX} ký tự.`
  return null
}

// ---------- Tài khoản và quyền nền tảng ----------

export const hasActiveAccess = (a: AccountSummary) => a.platformRole !== null && a.platformAccessStatus === 'ACTIVE'
export const hasRevokedAccess = (a: AccountSummary) => a.platformRole !== null && a.platformAccessStatus === 'REVOKED'
export const isActiveSa = (a: AccountSummary) => a.platformRole === 'SA' && a.platformAccessStatus === 'ACTIVE' && a.accountStatus === 'ACTIVE'

export function isLastActiveSa(accounts: AccountSummary[], id: number) {
  const target = accounts.find((a) => a.id === id)
  return !!target && isActiveSa(target) && !accounts.some((a) => a.id !== id && isActiveSa(a))
}

/** Hành động hộp thoại cấp quyền được phép theo trạng thái hiện tại (UC-FE03-09). */
export function availableOperations(a: AccountSummary): PlatformAccessOperation[] {
  if (a.platformRole === null) return ['GRANT']
  return a.platformAccessStatus === 'ACTIVE' ? ['CHANGE', 'REVOKE'] : ['RESTORE']
}

export const OPERATION_LABEL: Record<PlatformAccessOperation, string> = {
  GRANT: 'Cấp quyền',
  CHANGE: 'Đổi vai trò',
  REVOKE: 'Thu hồi quyền',
  RESTORE: 'Khôi phục quyền',
}

export function accessButtonLabel(operation: PlatformAccessOperation, role: PlatformRole | undefined, current: PlatformRole | null) {
  switch (operation) {
    case 'GRANT': return `Cấp quyền ${role ?? ''}`.trim()
    case 'CHANGE': return `Đổi sang ${role ?? ''}`.trim()
    case 'REVOKE': return `Thu hồi quyền ${current ?? ''}`.trim()
    case 'RESTORE': return `Khôi phục quyền ${current ?? ''}`.trim()
  }
}

export const accessText = (role: PlatformRole | null, status: PlatformAccessStatus | null) =>
  role ? `role: ${role} · ${status === 'ACTIVE' ? 'đang hoạt động' : 'đã thu hồi'}` : 'role: —'

/** Kiểm tra và tính trạng thái mới của một lệnh đổi quyền nền tảng; ném PlatformAdminError nếu vi phạm quy tắc. */
export function planAccessChange(accounts: AccountSummary[], target: AccountSummary, req: PlatformAccessChange) {
  if (!target.emailVerified) throw new PlatformAdminError('UNVERIFIED', MSG.unverified)
  if (req.expectedVersion !== target.platformAccessVersion) throw new PlatformAdminError('STALE', MSG.stale)
  const reasonError = validateReason(req.reason)
  if (reasonError) throw new PlatformAdminError('VALIDATION', reasonError)
  const active = hasActiveAccess(target)
  const revoked = hasRevokedAccess(target)
  const lastSa = target.platformRole === 'SA' && isLastActiveSa(accounts, target.id)
  const name = target.fullName
  const needRole = () => {
    if (!req.role) throw new PlatformAdminError('VALIDATION', 'Vai trò là bắt buộc.')
    return req.role
  }
  switch (req.operation) {
    case 'GRANT': {
      const role = needRole()
      if (active) {
        if (target.platformRole === role) throw noChange(name, 'vai trò')
        throw new PlatformAdminError('INVALID_STATE', 'Mỗi người chỉ có tối đa một vai trò nền tảng đang hoạt động. Hãy dùng "Đổi vai trò".')
      }
      if (revoked) throw new PlatformAdminError('INVALID_STATE', `Quyền nền tảng của ${name} đã bị thu hồi. Hãy khôi phục quyền.`)
      return { role, status: 'ACTIVE' as const }
    }
    case 'CHANGE': {
      if (!active) throw new PlatformAdminError('INVALID_STATE', `${name} chưa có vai trò nền tảng đang hoạt động.`)
      const role = needRole()
      if (role === target.platformRole) throw noChange(name, 'vai trò')
      if (lastSa) throw new PlatformAdminError('LAST_SA', MSG.lastSa)
      return { role, status: 'ACTIVE' as const }
    }
    case 'REVOKE': {
      if (revoked) throw noChange(name, 'trạng thái')
      if (!active) throw new PlatformAdminError('INVALID_STATE', `${name} chưa có vai trò nền tảng.`)
      if (lastSa) throw new PlatformAdminError('LAST_SA', MSG.lastSa)
      return { role: target.platformRole as PlatformRole, status: 'REVOKED' as const }
    }
    case 'RESTORE': {
      if (active) throw noChange(name, 'trạng thái')
      if (!revoked) throw new PlatformAdminError('INVALID_STATE', `${name} chưa từng có vai trò nền tảng để khôi phục.`)
      return { role: target.platformRole as PlatformRole, status: 'ACTIVE' as const }
    }
  }
}

/** Kiểm tra tạm khóa hoặc mở khóa tài khoản (UC-FE03-08). */
export function checkAccountChange(accounts: AccountSummary[], target: AccountSummary, actorId: number, req: AccountChange, op: 'suspend' | 'restore') {
  if (req.expectedVersion !== target.version) throw new PlatformAdminError('STALE', MSG.stale)
  const reasonError = validateReason(req.reason)
  if (reasonError) throw new PlatformAdminError('VALIDATION', reasonError)
  if (op === 'suspend') {
    if (target.accountStatus === 'SUSPENDED') throw noChange(target.email, 'trạng thái')
    if (target.id === actorId || isLastActiveSa(accounts, target.id)) throw new PlatformAdminError('LAST_SA', MSG.lastSa)
  } else if (target.accountStatus === 'ACTIVE') {
    throw noChange(target.email, 'trạng thái')
  }
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export function filterAccounts(accounts: AccountSummary[], { q = '', status = '', platformRole = '' }: AccountFilters) {
  const needle = fold(q.trim())
  return accounts.filter((a) => {
    if (needle && !fold(`${a.fullName} ${a.email}`).includes(needle)) return false
    if (status && a.accountStatus !== status) return false
    if (platformRole === 'NONE') return a.platformRole === null
    if (platformRole === 'STAFF') return a.platformRole !== null
    if (platformRole) return a.platformRole === platformRole
    return true
  })
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

export const farmsJoinedText = (a: AccountSummary) => (a.farmCount === 0 ? '0' : `${a.farmCount} (${a.farmRoleSummary})`)

export const verificationText = (a: AccountSummary) =>
  !a.emailVerified ? 'Email chưa xác minh' : a.signInProvider === 'GOOGLE' ? 'Google đã xác minh' : 'Email đã xác minh'

// ---------- Ngày giờ ----------

const pad = (n: number) => String(n).padStart(2, '0')
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ymdParts = (ymd: string) => ymd.split('-').map(Number) as [number, number, number]
export const addDaysYmd = (ymd: string, days: number) => { const [y, m, d] = ymdParts(ymd); return toYmd(new Date(y, m - 1, d + days)) }
export const addMonthsYmd = (ymd: string, months: number) => { const [y, m, d] = ymdParts(ymd); return toYmd(new Date(y, m - 1 + months, d)) }

export const formatDate = (iso: string) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` }
export const formatDateTime = (iso: string) => { const d = new Date(iso); return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
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
  { code: 'TICKET_CLOSED', label: 'Đóng ticket' },
]
export const auditActionLabel = (code: string) => AUDIT_ACTIONS.find((a) => a.code === code)?.label ?? code

export const AUDIT_TARGET_TYPES: ReadonlyArray<{ value: AuditTargetType; label: string }> = [
  { value: 'ACCOUNT', label: 'User' },
  { value: 'PLATFORM_ACCESS', label: 'Platform access' },
  { value: 'MEMBERSHIP', label: 'Membership' },
  { value: 'FARM', label: 'Farm' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'FINANCE_RECORD', label: 'Finance record' },
  { value: 'TICKET', label: 'Ticket' },
  { value: 'INTERNAL_REQUEST', label: 'Internal request' },
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
