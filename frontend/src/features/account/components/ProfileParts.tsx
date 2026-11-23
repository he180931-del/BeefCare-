import type { ReactNode } from 'react'
import { Badge, Button, Card, Field, Icon, inputCls, Table, Td, Th } from '../../../shared/ui'
import { FARM_ROLE_LABEL, initials } from '../domain/profileRules'
import type { AccountProfile, FarmPermissions, ProfileErrors } from '../types'

export const Avatar = ({ name, size = 56 }: { name: string; size?: number }) => (
  <span aria-hidden="true" style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-edge text-base font-semibold text-white">{initials(name)}</span>
)

const methods = (profile: AccountProfile) => (profile.signInMethods.length ? profile.signInMethods.map((method) => method === 'GOOGLE' ? 'Google' : method === 'PASSWORD' ? 'Email - mật khẩu' : method).join('   ·   ') : [profile.googleSignInLinked && 'Google', profile.passwordSignInEnabled && 'Email - mật khẩu'].filter(Boolean).join('   ·  ')) || '—'

const Err = ({ children }: { children?: string }) => children ? <span className="text-xs text-err-fg">{children}</span> : null

/** Thẻ "Hồ sơ cá nhân" (SCR-08). Họ tên và điện thoại ở biểu mẫu `profile-form`; nút "Lưu hồ sơ" nằm ở đầu trang. */
export function ProfileCard({ profile, headline, values, onChange, errors, onSubmit, onPassword, banner }: {
  profile: AccountProfile
  headline: string
  values: { fullName: string; phone: string }
  onChange: (values: { fullName: string; phone: string }) => void
  errors: ProfileErrors
  onSubmit: (event: React.FormEvent) => void
  onPassword: () => void
  banner?: ReactNode
}) {
  return (
    <div className="w-full max-w-none">
       <Card title="Hồ sơ cá nhân">
        <div className="flex flex-col gap-6 pt-1">
          <div className="flex items-center gap-4 pb-2">
            <Avatar name={profile.fullName} />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[#212121]">{profile.fullName}</div>
              <div className="mt-1 text-xs text-muted">{headline}</div>
            </div>
          </div>
          {banner}
          <form id="profile-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field label="Email" id="profile-email">
                <div
                  id="profile-email"
                  className={`${inputCls} flex items-center gap-1 bg-chip`}
                >
                  <span className="truncate text-muted">{profile.email}</span>
                  <span
                    className={
                      profile.emailVerified
                        ? 'shrink-0 font-semibold text-green-600'
                        : 'shrink-0 font-semibold text-red-600'
                    }
                  >
                    · {profile.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}
                  </span>
                </div>
              </Field>
              <Field label="Phương thức đăng nhập" id="profile-methods">
                <div className={inputCls}>
                  <span className="truncate text-muted">{methods(profile)}</span>
                </div>
              </Field>
              <Field label="Họ và tên *" id="profile-name"><input id="profile-name" autoComplete="name" maxLength={100} value={values.fullName} onChange={(event) => onChange({ ...values, fullName: event.target.value })} className={inputCls} aria-invalid={Boolean(errors.fullName)} /><Err>{errors.fullName}</Err></Field>
              <Field label="Điện thoại liên hệ" id="profile-phone"><input id="profile-phone" type="tel" autoComplete="tel" value={values.phone} onChange={(event) => onChange({ ...values, phone: event.target.value })} className={inputCls} aria-invalid={Boolean(errors.phone)} /><Err>{errors.phone}</Err></Field>
            </div>
          </form>
          <div className="pt-2"><Button onClick={onPassword}><Icon name="lock" size={16} />{profile.passwordSignInEnabled ? 'Đổi mật khẩu' : 'Thêm mật khẩu'}</Button></div>
        </div>
      </Card>
    </div>
  )
}
