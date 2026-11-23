import type { ReactNode } from 'react'
import { Button, Field, Icon, inputCls } from '../../../shared/ui'
import { initials } from '../domain/profileRules'
import type { AccountProfile, ProfileErrors } from '../types'

export const Avatar = ({ name, size = 56 }: { name: string; size?: number }) => (
  <span aria-hidden="true" style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-brand-dark text-base font-semibold text-white">{initials(name)}</span>
)

const methods = (profile: AccountProfile) => (profile.signInMethods.length ? profile.signInMethods.map((method) => method === 'GOOGLE' ? 'Google' : method === 'PASSWORD' ? 'Email - mật khẩu' : method).join('   ·   ') : [profile.googleSignInLinked && 'Google', profile.passwordSignInEnabled && 'Email - mật khẩu'].filter(Boolean).join('   ·  ')) || '—'

const Err = ({ children }: { children?: string }) => children ? <span className="text-xs text-err-fg">{children}</span> : null

/** Khu vực "Hồ sơ cá nhân" (SCR-08). Họ tên và điện thoại ở biểu mẫu `profile-form`; nút lưu nằm ở tiêu đề trang. */
export function ProfileCard({ profile, headline, values, onChange, errors, onSubmit, onPassword, banner, saving = false }: {
  profile: AccountProfile
  headline: string
  values: { fullName: string; phone: string }
  onChange: (values: { fullName: string; phone: string }) => void
  errors: ProfileErrors
  onSubmit: (event: React.FormEvent) => void
  onPassword: () => void
  banner?: ReactNode
  saving?: boolean
}) {
  return (
    <div className="w-full max-w-none">
      <div data-testid="profile-bento-grid" className="grid gap-4 @min-[560px]:grid-cols-[1.2fr_0.9fr]">
          <section data-testid="profile-bento-identity" className="flex min-h-[150px] items-center rounded-2xl border border-field bg-[#edf5f0] p-5 text-ink">
            <div className="flex items-center gap-4">
              <Avatar name={profile.fullName} size={64} />
              <div className="min-w-0">
                <div className="truncate text-lg font-bold">{profile.fullName}</div>
                <div className="mt-1 text-sm text-muted">{headline}</div>
              </div>
            </div>
          </section>

          <section data-testid="profile-bento-status" className="min-h-[150px] rounded-2xl border border-field bg-white p-5">
            <h3 className="m-0 text-base font-bold text-brand-dark">Trạng thái tài khoản</h3>
            <div className="mt-5 flex items-center gap-2 font-semibold text-ok-fg">
              <span aria-hidden="true">✓</span>
              <span>Email {profile.emailVerified ? 'đã xác minh' : 'chưa xác minh'}</span>
            </div>
            <p className="mb-0 mt-3 truncate text-sm text-muted">{profile.email}</p>
          </section>

          <section data-testid="profile-bento-personal" className="rounded-2xl border border-field bg-white p-5">
            <h3 className="mb-4 mt-0 text-base font-bold text-brand-dark">Thông tin cá nhân</h3>
            {banner}
            <form id="profile-form" onSubmit={onSubmit} noValidate>
              <div className="flex flex-col gap-4">
                <Field label="Họ và tên *" id="profile-name"><input id="profile-name" autoComplete="name" maxLength={100} value={values.fullName} onChange={(event) => onChange({ ...values, fullName: event.target.value })} className={inputCls} aria-invalid={Boolean(errors.fullName)} /><Err>{errors.fullName}</Err></Field>
                <Field label="Điện thoại liên hệ" id="profile-phone"><input id="profile-phone" type="tel" autoComplete="tel" value={values.phone} onChange={(event) => onChange({ ...values, phone: event.target.value })} className={inputCls} aria-invalid={Boolean(errors.phone)} /><Err>{errors.phone}</Err></Field>
              </div>
              <div className="mt-5 flex justify-end border-t border-field pt-4">
                <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>
              </div>
            </form>
          </section>

          <section data-testid="profile-bento-security" className="rounded-2xl border border-field bg-white p-5">
            <h3 className="m-0 text-base font-bold text-brand-dark">Bảo mật</h3>
            <p className="mb-0 mt-5 text-xs font-semibold text-muted">Đăng nhập bằng</p>
            <p className="mb-0 mt-2 text-sm font-semibold text-brand-dark">{methods(profile)}</p>
            <div className="mt-5">
              <Button size="bento" onClick={onPassword}><Icon name="lock" size={16} />{profile.passwordSignInEnabled ? 'Đổi mật khẩu' : 'Thêm mật khẩu'}</Button>
            </div>
          </section>
      </div>
    </div>
  )
}
