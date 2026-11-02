import type { ReactNode } from 'react'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Card, Field, inputCls, Table, Td, Th } from '../../../components/ui'
import { LEVEL_LABEL, permissionRowsFor } from '../../farm-workspace'
import { FARM_ROLE_LABEL, initials } from '../domain/profileRules'
import type { AccountProfile, ProfileErrors } from '../types'

export const Avatar = ({ name, size = 56 }: { name: string; size?: number }) => (
  <span aria-hidden="true" style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-edge text-base font-semibold text-white">{initials(name)}</span>
)

const methods = (profile: AccountProfile) => [profile.googleSignInLinked && 'Google', profile.passwordSignInEnabled && 'Thư điện tử & mật khẩu'].filter(Boolean).join(' · ') || '—'

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
    <Card title="Hồ sơ cá nhân">
      <div className="flex items-center gap-3">
        <Avatar name={profile.fullName} />
        <div><div className="text-base font-semibold text-[#212121]">{profile.fullName}</div><div className="text-xs text-muted">{headline}</div></div>
      </div>
      {banner}
      <form id="profile-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Thư điện tử đăng nhập" id="profile-email"><input id="profile-email" readOnly value={`${profile.email} · ${profile.emailVerified ? 'đã xác minh' : 'chưa xác minh'}`} className={`${inputCls} bg-chip text-muted`} /></Field>
          <Field label="Phương thức đăng nhập" id="profile-methods"><input id="profile-methods" readOnly value={methods(profile)} className={`${inputCls} bg-chip text-muted`} /></Field>
          <Field label="Họ và tên *" id="profile-name"><input id="profile-name" autoComplete="name" maxLength={100} value={values.fullName} onChange={(event) => onChange({ ...values, fullName: event.target.value })} className={inputCls} aria-invalid={Boolean(errors.fullName)} /><Err>{errors.fullName}</Err></Field>
          <Field label="Điện thoại liên hệ" id="profile-phone"><input id="profile-phone" type="tel" autoComplete="tel" value={values.phone} onChange={(event) => onChange({ ...values, phone: event.target.value })} className={inputCls} aria-invalid={Boolean(errors.phone)} /><Err>{errors.phone}</Err></Field>
        </div>
      </form>
      <div><Button onClick={onPassword}><Icon name="lock" size={16} className="mr-1.5" />{profile.passwordSignInEnabled ? 'Đổi mật khẩu' : 'Thêm mật khẩu'}</Button></div>
    </Card>
  )
}

/** Thẻ "Quyền của tôi trong trại này": bảng chỉ đọc theo vai trò hiện tại (GBR-06). */
export function PermissionsCard({ role }: { role: 'OWNER' | 'MANAGER' | 'TECHNICIAN' }) {
  return (
    <Card title="Quyền của tôi trong trại này" actions={<span className="inline-flex rounded-full bg-[#454545] px-2.5 py-0.5 text-[11px] font-medium text-white">{FARM_ROLE_LABEL[role]}</span>}>
      <Table stack={false}>
        <thead><tr><Th>Quyền</Th><Th>Trạng thái</Th></tr></thead>
        <tbody>
          {permissionRowsFor(role).map((row) => (
            <tr key={row.label}><Td className="font-medium">{row.label}</Td><Td><Badge tone={row.level === 'none' ? 'outline' : undefined}>{LEVEL_LABEL[row.level]}</Badge></Td></tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}
