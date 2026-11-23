import { useState, type ReactNode } from 'react'
import { Icon } from '../../../shared/ui'
import type { AuthClient } from '../types'
import { FormField, googleButtonClass } from './AuthShell'
import { googleAuthorizationUrl } from '../googleOAuth'

export function PasswordField({ label, id, value, onChange, error, autoComplete, placeholder, maxLength = 128, invalid }: {
  label: string; id: string; value: string; onChange: (value: string) => void; error?: string; autoComplete?: string
  placeholder?: string; maxLength?: number; invalid?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <FormField id={id} label={label} className="pr-14!" type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} error={error} invalid={invalid} autoComplete={autoComplete} placeholder={placeholder} maxLength={maxLength} required />
      <button type="button" className="absolute right-1 top-[33px] grid size-11 place-items-center rounded-lg text-subtle hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/20" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible((shown) => !shown)}>
        <Icon name="eye" size={18} />
      </button>
    </div>
  )
}

export function GoogleButton({ client, label }: { client: AuthClient; label: string }) {
  const glyph = <span aria-hidden="true" className="absolute left-5 text-xl font-bold">G</span>
  if (client.mode === 'mock') return <button type="button" disabled className={googleButtonClass} title="Google OAuth chỉ khả dụng khi nối máy chủ">{glyph}{label}</button>
  return <a href={googleAuthorizationUrl()} className={`${googleButtonClass} no-underline`}>{glyph}{label}</a>
}

export function Divider({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-3 py-1 text-[11px] font-bold uppercase tracking-wider text-subtle"><span className="h-px flex-1 bg-field" />{children}<span className="h-px flex-1 bg-field" /></div>
}
