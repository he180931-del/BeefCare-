import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../../assets/logo.png'
import farm from '../../../assets/farm.png'
import wave from '../../../assets/wave.png'
import { Icon } from '../../../components/Icon'

export const fieldClass = 'mt-2 block h-[53px] w-full rounded-xl border border-field bg-white px-4 text-[15px] text-ink outline-none transition placeholder:text-[#9aa79e] focus:border-brand focus:ring-2 focus:ring-brand/10 read-only:bg-chip disabled:bg-page'
export const primaryButtonClass = 'inline-flex h-[54px] w-full items-center justify-center rounded-[14px] bg-brand-dark px-5 text-[15px] font-bold text-white transition hover:bg-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-wait disabled:opacity-60'
export const googleButtonClass = 'relative inline-flex h-[54px] w-full items-center justify-center rounded-[14px] bg-brand px-5 text-[15px] font-bold text-white transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-80'
export const secondaryButtonClass = 'inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] border border-field bg-white px-5 text-[15px] font-bold text-brand-dark transition hover:border-brand hover:bg-page focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60'

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`flex items-center gap-3 font-bold ${light ? 'text-[22px] text-white' : 'text-xl text-brand-dark'}`}>
      <img src={logo} alt="" className={`rounded-[11px] object-cover ${light ? 'size-[42px]' : 'size-9'}`} />
      <span>BeefCare</span>
    </div>
  )
}

/** Khung đăng nhập/đăng ký: cột thương hiệu 520px bên trái, biểu mẫu 620px bên phải (Figma "Đăng nhập · Redesign"). */
export function AuthShell({ title, description, eyebrow, children, footer, alert }: {
  title: string
  description: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  alert?: ReactNode
}) {
  return (
    <main className="flex min-h-screen bg-page text-ink">
      <aside className="relative hidden w-[520px] shrink-0 flex-col overflow-hidden bg-side text-white lg:flex">
        <div className="px-7 pt-7"><Brand light /></div>
        <h2 className="m-0 mt-[52px] px-7 text-[30px] font-bold leading-[1.25]">Mỗi con bò một hồ sơ —<br />ghi ngay tại chuồng.</h2>
        <p className="m-0 mt-4 px-7 text-[15px] text-[#d7ebdf]">Gọn việc mỗi ngày. Rõ dữ liệu cả vòng đời đàn bò.</p>
        <img src={farm} alt="" className="mt-auto w-full" />
        <p className="m-0 px-7 pb-7 pt-3 text-sm text-[#d7ebdf]">Thiết kế cho công việc thực tế tại trại.</p>
      </aside>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <img src={wave} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full object-cover" />
        <div className="relative flex min-h-screen flex-col px-5 py-6 sm:px-12 lg:px-14">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-subtle no-underline hover:text-brand"><Icon name="arrow-left" size={14} />Trang chủ</Link>
          <div className="mx-auto flex w-full max-w-[620px] flex-1 flex-col justify-center py-8">
            <div className="mb-8 lg:hidden"><Brand /></div>
            <h1 className="m-0 text-[32px] font-bold leading-tight text-ink">{title}</h1>
            <p className="m-0 mt-3 text-sm leading-6 text-subtle">{description}</p>
            {eyebrow && <span className="mb-4 mt-7 block text-[11px] font-bold uppercase tracking-wider text-brand">{eyebrow}</span>}
            {!eyebrow && <div className="h-7" />}
            {alert}
            {children}
            {footer && <div className="mt-6 text-center text-[13px] text-subtle">{footer}</div>}
          </div>
        </div>
      </div>
    </main>
  )
}

export function FormField({ label, id, error, ...props }: {
  label: string
  id: string
  error?: string
  type?: string
  value?: string
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  autoComplete?: string
  maxLength?: number
  readOnly?: boolean
  required?: boolean
  disabled?: boolean
  placeholder?: string
  invalid?: boolean
}) {
  const { invalid, ...inputProps } = props
  return (
    <label htmlFor={id} className="block text-sm font-bold text-ink">
      {label}
      <input id={id} className={`${fieldClass} font-normal ${error || invalid ? '!border-[#b54843] focus:ring-red-100' : ''}`} aria-invalid={Boolean(error) || Boolean(invalid)} aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />
      {error && <span id={`${id}-error`} className="mt-1 block text-xs font-normal text-[#b54843]">{error}</span>}
    </label>
  )
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' | 'success' }) {
  const style = tone === 'error' ? 'bg-[#fff0ee] text-[#b54843]' : tone === 'success' ? 'bg-ok-bg text-ok-fg' : 'bg-[#eef4ef] text-ink'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`mb-5 rounded-xl px-4 py-3 text-[13px] font-semibold leading-5 ${style}`}>{children}</div>
}

/** Ô nền be (#fff3d9) cho trạng thái cần chú ý: liên kết hết hạn, tài khoản tạm ngưng. */
export function NoticePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="rounded-2xl border border-[#f0d69c] bg-[#fff3d9] px-5 py-4">
      <p className="m-0 text-base font-bold text-ink">{title}</p>
      <p className="m-0 mt-1.5 text-[13px] leading-5 text-subtle">{children}</p>
    </div>
  )
}

export function Form({ onSubmit, children }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode }) {
  return <form className="space-y-4" onSubmit={onSubmit} noValidate>{children}</form>
}
