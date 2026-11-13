import type { ReactNode, SelectHTMLAttributes } from 'react'
import { BackendError } from '../../../api/backendClient'
import { Icon } from '../../../components/Icon'

/** Ô nhập của trang thường theo Figma (cao 36px, bo 4, viền xám); hộp thoại và trang thiết lập dùng `inputCls` (44px). */
export const pageInputCls = 'h-9 w-full rounded border border-edge bg-white px-2.5 text-[13px] text-[#212121] outline-none focus:border-brand disabled:bg-chip disabled:text-muted'

export function PageSelect({ children, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select className={`${pageInputCls} cursor-pointer appearance-none pr-8`} {...props}>{children}</select>
      <Icon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  )
}

export const FieldError = ({ children }: { children?: string }) => children ? <span role="alert" className="text-xs text-err-fg">{children}</span> : null

/** Thanh bước dạng viên thuốc: "✓ 1 · Hồ sơ" · "2 · Trang trại" · "3 · Gói dịch vụ". */
export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Hồ sơ', 'Trang trại', 'Gói dịch vụ']
  return (
    <ol aria-label="Các bước đăng ký" className="m-0 flex list-none flex-wrap gap-2 p-0 text-xs">
      {steps.map((step, index) => {
        const number = index + 1
        const style = number === current ? 'border-brand bg-brand font-semibold text-white' : number < current ? 'border-field bg-field text-ink' : 'border-field bg-white text-ink'
        return <li key={step} aria-current={number === current ? 'step' : undefined} className={`rounded-full border px-3.5 py-1.5 ${style}`}>{number < current ? '✓ ' : ''}{number} · {step}</li>
      })}
    </ol>
  )
}

export function FormErrors({ errors }: { errors: Record<string, string | undefined> }) {
  const messages = Object.values(errors).filter((message): message is string => Boolean(message))
  if (!messages.length) return null
  return <ul role="alert" className="m-0 list-disc rounded-lg bg-err-bg py-3 pl-8 pr-4 text-sm text-err-fg">{messages.map((message) => <li key={message}>{message}</li>)}</ul>
}

export function roleLabel(role: string) {
  return ({ OWNER: 'Chủ trại', MANAGER: 'Quản lý', TECHNICIAN: 'Kỹ thuật viên' } as Record<string, string>)[role] ?? role
}

export function serviceLabel(status: string) {
  return ({ ACTIVE: 'Đang hoạt động', PENDING_PAYMENT: 'Chờ thanh toán', EXPIRED: 'Đã hết hạn', SUSPENDED: 'Tạm ngưng' } as Record<string, string>)[status] ?? status
}

export function inviteStatusLabel(status: string) {
  return ({ PENDING: 'Đang chờ', ACCEPTED: 'Đã chấp nhận', EXPIRED: 'Hết hạn', CANCELLED: 'Đã hủy' } as Record<string, string>)[status] ?? status
}

const MISSING = 'Chưa có dữ liệu từ máy chủ'
const ZONE = 'Asia/Ho_Chi_Minh'

/** dd/mm/yyyy HH:mm theo múi giờ mặc định của trại (GBR-66). */
export function formatDateTime(value?: string | null, timeZone = ZONE) {
  if (!value) return MISSING
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return MISSING
  const parts = Object.fromEntries(new Intl.DateTimeFormat('vi-VN', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
}

/** D25: lưu thành công xác nhận ý định gửi mail, chưa xác nhận email đã tới. */
export function invitationNotice(invitation: { email: string; expiresAt: string }, resend = false, timeZone?: string) {
  return `${resend ? 'Đã cập nhật' : 'Đã tạo'} lời mời tới ${invitation.email}. Hệ thống đang gửi email. Hết hạn lúc ${formatDateTime(invitation.expiresAt, timeZone)}.`
}

/** dd/mm/yyyy. */
export function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { timeZone: ZONE, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

/** A service period ends at an exclusive instant; show its last covered day, as SCR-57 does (`fmtEndDay`). */
export function lastServiceDay(end: string) {
  const ms = Date.parse(end)
  return Number.isNaN(ms) ? formatDate(end) : formatDate(new Date(ms - 1).toISOString())
}

/** mm/yyyy (cột "Tham gia" của SCR-13) theo múi giờ trại (Table III-1, D29). */
export function formatMonth(value?: string | null, timeZone = ZONE) {
  if (!value) return MISSING
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return MISSING
  const parts = Object.fromEntries(new Intl.DateTimeFormat('vi-VN', { timeZone, month: '2-digit', year: 'numeric' }).formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.month}/${parts.year}`
}

export const initialsOf = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase() || '?'

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-edge text-xs font-semibold text-white">{initialsOf(name)}</span>
}

const fieldLabels: Record<string, string> = {
  name: 'Tên trại', province: 'Tỉnh/thành', commune: 'Xã/phường', detailedAddress: 'Địa chỉ chi tiết',
  contactPerson: 'Người liên hệ', contactPhone: 'Điện thoại liên hệ', registrationCertificateInfo: 'Thông tin giấy chứng nhận',
  expectedHerdSize: 'Quy mô đàn dự kiến', timeZone: 'Múi giờ', morningShiftStart: 'Giờ bắt đầu ca sáng', operatingNotes: 'Ghi chú vận hành',
}

function validationFieldMessage(field: string | undefined, message: string | undefined) {
  const label = fieldLabels[field ?? ''] ?? 'Trường dữ liệu'
  const value = (message ?? '').toLowerCase()
  if (field === 'contactPhone' && (value.includes('must match') || value.includes('pattern') || value.includes('phone'))) return `${label}: Nhập số điện thoại Việt Nam hợp lệ.`
  if (value.includes('must not be blank') || value.includes('must not be null') || value === 'required') return `${label}: Đây là trường bắt buộc.`
  if (value.includes('must match') || value.includes('invalid') || value.includes('validation') || /\b(must|should|required|valid|well-formed|between|positive|null|blank)\b/.test(value)) return `${label}: Dữ liệu không hợp lệ.`
  if (value.includes('size must be') || value.includes('length')) return `${label}: Độ dài dữ liệu không hợp lệ.`
  return `${label}: ${message ?? 'Dữ liệu không hợp lệ.'}`
}

/** MSG-FE03-08 carries the invitation's current status (UC-FE03-03 E2); INVALID means the link no longer identifies one. */
function invalidInvitationMessage(status: unknown) {
  const value = typeof status === 'string' ? status.toUpperCase() : ''
  const label = value === 'INVALID' ? 'Liên kết không hợp lệ' : value ? inviteStatusLabel(value) : ''
  return label ? `Lời mời không còn hiệu lực (${label}).` : 'Lời mời đã hết hạn, bị hủy hoặc đã được sử dụng.'
}

export function farmWorkspaceError(error: unknown, fallback: string) {
  if (error instanceof BackendError) {
    const code = error.code?.toUpperCase()
    const known: Record<string, string> = {
      'MSG-COM-05': 'Dữ liệu đã thay đổi ở phiên khác. Tải lại trang rồi thử lại.',
      'MSG-COM-06': 'Vui lòng điền đủ các trường bắt buộc.',
      'MSG-COM-07': 'Ngày hiệu lực không hợp lệ.',
      'MSG-COM-10': 'Email hoặc số điện thoại không hợp lệ.',
      'MSG-FE02-02': 'Vui lòng hoàn tất hồ sơ Chủ trại trước khi đăng ký trại.',
      'MSG-FE02-03': 'Trang trại chưa thể sử dụng dịch vụ. Chủ trại cần kiểm tra gói dịch vụ.',
      'MSG-FE02-04': 'Chủ trại quản lý gói dịch vụ; thành viên chưa thể vào trang trại này.',
      'MSG-FE03-02': 'Email này đã là thành viên đang hoạt động.',
      'MSG-FE03-03': 'Đã có lời mời đang chờ cho email này.',
      'MSG-FE03-04': 'Mời thành viên, đổi vai trò và kích hoạt lại cần trại đang hoạt động (ACTIVE).',
      'MSG-FE03-08': invalidInvitationMessage(error.params.status),
      'MSG-FE03-09': 'Email đăng nhập không trùng với email được mời. Thông tin trang trại đã được ẩn.',
      'MSG-FE03-20': 'Thành viên đã có vai trò hoặc trạng thái này.',
      'MSG-FE03-21': 'Email này là thành viên đã ngưng. Kích hoạt lại thay vì gửi lời mời mới.',
    }
    if (code && known[code]) return known[code]
    const fieldErrors = [...error.fieldErrors, ...error.violations.map((item) => ({ field: item.field ?? item.propertyPath, message: item.message }))]
    if (fieldErrors.length) return fieldErrors.map((item) => validationFieldMessage(item.field, item.message)).join('; ')
    if (error.status === 401) return 'Phiên đăng nhập hết hạn. Đăng nhập lại rồi thử lại.'
    if (error.status === 403) return 'Tài khoản không có quyền thực hiện thao tác này hoặc dịch vụ trang trại chưa hoạt động.'
    if (error.status === 404) return 'Không tìm thấy dữ liệu. Tải lại danh sách rồi thử lại.'
    if (error.status === 409) return 'Dữ liệu vừa được cập nhật ở nơi khác. Tải lại trang rồi thử lại.'
    if (error.status >= 500) return 'Máy chủ chưa xử lý được yêu cầu. Dữ liệu chưa được xác nhận đã lưu.'
    if (error.message && !/^error\.|^http\s*\d+$/i.test(error.message)) return error.message
    return fallback
  }
  return error instanceof Error && error.message ? error.message : fallback
}

export function Banner({ children }: { children: ReactNode }) {
  return <div role="status" className="rounded-lg bg-[#e8f2fa] px-3 py-2 text-xs text-[#296194]">{children}</div>
}

/** MSG-FE02-03: the Owner opened a farm that is not ACTIVE from Select Farm (UC-FE02-02 AF1 / AF2). */
export function InactiveFarmBanner({ farmName, status }: { farmName: string; status: string }) {
  return <Banner>{farmName} đang ở trạng thái {serviceLabel(status)}. Chỉ dùng được thông tin trại, gói dịch vụ và hỗ trợ.</Banner>
}

/** True when the page was opened from a card of Select Farm (`from=chon-trai`) for a farm that is not ACTIVE. */
export const openedInactiveFromFarmSelect = (params: URLSearchParams, status: string) => params.get('from') === 'chon-trai' && status !== 'ACTIVE'
