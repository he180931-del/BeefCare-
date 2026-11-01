import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BackendError } from '../../../api/backendClient'

export function StandaloneFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-page px-4 py-8 text-ink">
      <div className="w-full max-w-[880px] overflow-hidden rounded-2xl border border-field bg-white shadow-sm">
        <div className="border-b border-rule px-6 py-5 sm:px-10">
          <Link to="/" className="text-sm font-bold text-brand no-underline">BeefCare</Link>
          <h1 className="mb-0 mt-5 text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mb-0 mt-2 max-w-[650px] text-sm leading-6 text-subtle">{subtitle}</p>}
        </div>
        <div className="flex flex-col gap-5 px-6 py-6 sm:px-10 sm:py-8">{children}</div>
      </div>
    </main>
  )
}

export function OnboardingSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Hồ sơ', 'Trang trại', 'Gói dịch vụ']
  return (
    <ol aria-label="Các bước đăng ký" className="m-0 grid list-none grid-cols-3 gap-2 p-0">
      {steps.map((step, index) => {
        const number = index + 1
        const done = number < current
        return <li key={step} className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-semibold ${number === current ? 'border-brand text-brand-dark' : done ? 'border-ok-fg text-ok-fg' : 'border-rule text-faint'}`}>
          <span className={`grid size-6 shrink-0 place-items-center rounded-full ${number === current ? 'bg-brand text-white' : done ? 'bg-ok-bg text-ok-fg' : 'bg-chip'}`}>{done ? '✓' : number}</span>{step}
        </li>
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
  return ({ ACTIVE: 'Đang hoạt động', PENDING_PAYMENT: 'Chờ thanh toán', EXPIRED: 'Đã hết hạn', SUSPENDED: 'Đang tạm ngưng' } as Record<string, string>)[status] ?? status
}

export function inviteStatusLabel(status: string) {
  return ({ PENDING: 'Đang chờ', ACCEPTED: 'Đã chấp nhận', EXPIRED: 'Đã hết hạn', CANCELLED: 'Đã hủy' } as Record<string, string>)[status] ?? status
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu từ máy chủ'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa có dữ liệu từ máy chủ' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(date)
}

export function farmWorkspaceError(error: unknown, fallback: string) {
  if (error instanceof BackendError) {
    const code = error.code?.toUpperCase()
    const known: Record<string, string> = {
      'MSG-COM-05': 'Dữ liệu đã thay đổi ở phiên khác. Tải lại trang rồi thử lại.',
      'MSG-COM-06': 'Vui lòng điền đủ các trường bắt buộc.',
      'MSG-COM-07': 'Ngày hiệu lực không hợp lệ.',
      'MSG-COM-10': 'Email hoặc số điện thoại không hợp lệ.',
      'MSG-FE02-03': 'Trang trại chưa thể sử dụng dịch vụ. Chủ trại cần kiểm tra gói dịch vụ.',
      'MSG-FE02-04': 'Chủ trại quản lý gói dịch vụ; thành viên chưa thể vào trang trại này.',
      'MSG-FE03-02': 'Email này đã là thành viên đang hoạt động.',
      'MSG-FE03-03': 'Đã có lời mời đang chờ cho email này.',
      'MSG-FE03-04': 'Dịch vụ trang trại chưa hoạt động nên chưa thể gửi hoặc chấp nhận lời mời.',
      'MSG-FE03-08': 'Lời mời đã hết hạn, bị hủy hoặc đã được sử dụng.',
      'MSG-FE03-09': 'Email đăng nhập không trùng với email được mời. Thông tin trang trại đã được ẩn.',
      'MSG-FE03-20': 'Thành viên đã có vai trò hoặc trạng thái này.',
    }
    if (code && known[code]) return known[code]
    const fieldErrors = [...error.fieldErrors, ...error.violations.map((item) => ({ field: item.field ?? item.propertyPath, message: item.message }))]
    if (fieldErrors.length) return fieldErrors.map((item) => `${item.field ?? 'Trường dữ liệu'}: ${item.message ?? 'không hợp lệ'}`).join('; ')
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
