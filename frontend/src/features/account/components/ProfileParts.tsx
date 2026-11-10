import type { ReactNode } from 'react'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Card, Field, inputCls, Table, Td, Th } from '../../../components/ui'
import { FARM_ROLE_LABEL, initials } from '../domain/profileRules'
import type { AccountProfile, FarmPermissions, ProfileErrors } from '../types'

export const Avatar = ({ name, size = 56 }: { name: string; size?: number }) => (
  <span aria-hidden="true" style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-edge text-base font-semibold text-white">{initials(name)}</span>
)

const methods = (profile: AccountProfile) => (profile.signInMethods.length ? profile.signInMethods.map((method) => method === 'GOOGLE' ? 'Google' : method === 'PASSWORD' ? 'Thư điện tử & mật khẩu' : method).join(' · ') : [profile.googleSignInLinked && 'Google', profile.passwordSignInEnabled && 'Thư điện tử & mật khẩu'].filter(Boolean).join(' · ')) || '—'

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
      <div><Button onClick={onPassword}><Icon name="lock" size={16} />{profile.passwordSignInEnabled ? 'Đổi mật khẩu' : 'Thêm mật khẩu'}</Button></div>
    </Card>
  )
}

/** Thẻ "Quyền của tôi trong trại này": bảng chỉ đọc theo vai trò hiện tại (GBR-06). */
const PERMISSION_LABEL: Record<string, string> = {
  CATTLE_PROFILE_QR: 'Hồ sơ bò & thẻ QR', PENS_AND_MOVES: 'Chuồng trại & chuyển chuồng', HERD_ENTRY_AND_PAYMENTS: 'Nhập đàn, thanh toán & xác nhận bê',
  GROWTH_BCS: 'Cân nặng & thể trạng', VACCINATION: 'Tiêm phòng', HEALTH_AND_TREATMENT: 'Sức khỏe & điều trị', REPRODUCTION: 'Sinh sản',
  CATALOGUES_AND_PARAMETERS: 'Danh mục & tham số trại', FARM_ANNOUNCEMENTS: 'Thông báo trại', REMINDERS: 'Nhắc việc', DASHBOARD_AND_REPORTS: 'Tổng quan & báo cáo',
  MEMBERS_ROLES: 'Thành viên & vai trò', HERD_EXIT_AND_COLLECTIONS: 'Xuất đàn & thu tiền', FEED_STOCK_AND_CATALOGUE: 'Kho thức ăn, phiếu nhập, khẩu phần & danh mục',
  FEEDING_LOG: 'Nhật ký cho ăn', SUBSCRIPTION_AND_PAYMENT: 'Gói dịch vụ & thanh toán', FARM_INFORMATION: 'Thông tin trại',
}
const PERMISSION_VALUE = { FULL: 'Có', RESTRICTED: 'Chỉ xem', NO: 'Không' } as const

export function PermissionsCard({ permissions, loading, error }: { permissions: FarmPermissions | null; loading: boolean; error: unknown }) {
  const role = permissions?.role
  return (
    <Card title="Quyền của tôi trong trại này" actions={role && <span className="inline-flex rounded-full bg-[#454545] px-2.5 py-0.5 text-[11px] font-medium text-white">{FARM_ROLE_LABEL[role]}</span>}>
      <Table stack={false}>
        <thead><tr><Th>Quyền</Th><Th>Trạng thái</Th></tr></thead>
        <tbody>
          {loading && <tr><Td colSpan={2}>Đang tải quyền…</Td></tr>}
          {Boolean(error) && <tr><Td colSpan={2}>Không tải được quyền của bạn trong trại này.</Td></tr>}
          {permissions?.permissions.map((permission) => (
            <tr key={permission.area}><Td className="font-medium">{PERMISSION_LABEL[permission.area] ?? permission.area}</Td><Td><Badge tone={permission.value === 'NO' ? 'outline' : undefined}>{PERMISSION_VALUE[permission.value]}</Badge></Td></tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}
