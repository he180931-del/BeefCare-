import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import logo from '../../../assets/logo.png'

export const fieldClass = 'mt-1.5 block h-12 w-full rounded-xl border border-field bg-white px-3.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:bg-page'
export const primaryButtonClass = 'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-wait disabled:opacity-60'
export const secondaryButtonClass = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-field bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:bg-page focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60'

export function AuthShell({ title, description, children, footer, alert }: {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
  alert?: ReactNode
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f3f7f2] px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-40 size-[26rem] rounded-full bg-[#d8eadc]/70 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -right-28 size-[30rem] rounded-full bg-[#e3efe3] blur-3xl" />
      <section className="relative grid w-full max-w-[980px] overflow-hidden rounded-[28px] border border-[#e3ebe3] bg-white shadow-[0_24px_80px_rgba(11,86,60,0.10)] md:grid-cols-[0.88fr_1.12fr]">
        <aside className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-[#0b563c] p-10 text-white md:flex">
          <div aria-hidden="true" className="absolute -bottom-32 -left-16 size-80 rounded-full border-[46px] border-white/5" />
          <div aria-hidden="true" className="absolute -right-28 top-20 size-72 rounded-full border-[38px] border-white/5" />
          <Brand light />
          <div className="relative max-w-sm pb-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90">
              <span className="size-2 rounded-full bg-[#a8d5a8]" />
              Quản lý chăn nuôi tập trung
            </div>
            <p className="text-3xl font-bold leading-tight tracking-tight">Chăm đàn bò tốt hơn, mỗi ngày.</p>
            <p className="mt-4 text-sm leading-6 text-white/75">Hồ sơ, lịch chăm sóc và hoạt động trang trại được kết nối trên một nền tảng dễ dùng.</p>
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-white/15 pt-5 text-xs text-white/80">
              <span>Hồ sơ từng con</span><span>Nhắc việc kịp thời</span><span>Dữ liệu riêng tư</span>
            </div>
          </div>
          <span className="relative text-xs text-white/55">BeefCare · Quản lý trang trại bò thịt</span>
        </aside>
        <div className="flex min-h-[620px] flex-col justify-center px-6 py-8 sm:px-12 md:px-14">
          <div className="mb-8 md:hidden"><Brand /></div>
          <div className="mx-auto w-full max-w-[420px]">
            <div className="mb-7">
              <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-subtle">{description}</p>
            </div>
            {alert}
            {children}
            {footer && <div className="mt-6 border-t border-rule pt-5 text-center text-sm text-subtle">{footer}</div>}
          </div>
        </div>
      </section>
      <span className="relative mt-5 text-center text-xs text-subtle">© BeefCare · Hệ thống quản lý trang trại</span>
    </main>
  )
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 text-base font-bold ${light ? 'text-white' : 'text-ink'}`}>
      <img src={logo} alt="" className="size-10 rounded-xl object-cover" />
      <span>BeefCare</span>
    </div>
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
}) {
  return (
    <label htmlFor={id} className="block text-[13px] font-semibold text-ink">
      {label}
      <input id={id} className={`${fieldClass} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      {error && <span id={`${id}-error`} className="mt-1 block text-xs font-normal text-red-700">{error}</span>}
    </label>
  )
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' | 'success' }) {
  const style = tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : tone === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-[#d6e7dd] bg-[#f3f8f4] text-ink'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`mb-5 rounded-xl border px-4 py-3 text-sm leading-5 ${style}`}>{children}</div>
}

export function Form({ onSubmit, children }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode }) {
  return <form className="space-y-4" onSubmit={onSubmit} noValidate>{children}</form>
}
