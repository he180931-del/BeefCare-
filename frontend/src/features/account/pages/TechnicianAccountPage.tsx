import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { Button, ErrorBlock, Field, KV, LoadingBlock, Note, inputCls } from '../../../components/ui'
import { useSession } from '../../authorization'
import { ChangePasswordDialog } from '../components/ChangePasswordDialog'
import { Avatar } from '../components/ProfileParts'
import { useAccountProfile, useProfileForm } from '../components/useAccountProfile'
import { roleAtFarm } from '../domain/profileRules'

/** Tài khoản của Kỹ thuật viên trên điện thoại (không có frame): thông tin cơ bản, đổi mật khẩu và đăng xuất. */
export default function TechnicianAccountPage() {
  const session = useSession()
  const { identity, data, loading, error, refetch } = useAccountProfile()
  const [m, openModal, closeModal] = useModalParam()
  const [search] = useSearchParams()
  const { pathname } = useLocation()
  const [notice, setNotice] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const form = useProfileForm(data, identity, async (_saved, message) => { setNotice(message); await refetch() })
  const signOut = async () => { setSigningOut(true); try { await session?.logout() } finally { setSigningOut(false) } }

  return (
    <TechnicianLayout title="Tài khoản">
      {notice && <Note tone="ok">{notice}</Note>}
      {loading && !data && <LoadingBlock />}
      {Boolean(error) && !data && <ErrorBlock message={userFacingError(error, 'Không tải được tài khoản.')} onRetry={refetch} />}
      <section className="flex items-center gap-3 rounded-md border border-edge bg-white p-4">
        <Avatar name={identity.fullName} />
        <div className="min-w-0"><div className="text-base font-semibold text-[#212121]">{identity.fullName}</div><div className="text-xs text-muted">{roleAtFarm(identity.role, identity.farmName)}</div></div>
      </section>
      {data && (
        <form onSubmit={form.submit} noValidate className="flex flex-col gap-3 rounded-md border border-edge bg-white p-4 text-[13px]">
          <Field label="Thư điện tử đăng nhập" id="technician-email"><input id="technician-email" readOnly value={data.email} className={`${inputCls} bg-chip text-muted`} /></Field>
          <Field label="Họ và tên *" id="technician-name"><input id="technician-name" autoComplete="name" maxLength={100} value={form.values.fullName} onChange={(event) => form.setValues({ ...form.values, fullName: event.target.value })} className={inputCls} />{form.errors.fullName && <span className="text-xs text-err-fg">{form.errors.fullName}</span>}</Field>
          <Field label="Điện thoại liên hệ" id="technician-phone"><input id="technician-phone" type="tel" autoComplete="tel" value={form.values.phone} onChange={(event) => form.setValues({ ...form.values, phone: event.target.value })} className={inputCls} />{form.errors.phone && <span className="text-xs text-err-fg">{form.errors.phone}</span>}</Field>
          <KV k="Trang trại">{identity.farmName ?? '—'}</KV>
          <KV k="Vai trò">Kỹ thuật viên</KV>
          {form.error && <Note tone="err">{form.error}</Note>}
          <Button type="submit" disabled={form.saving}>{form.saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</Button>
        </form>
      )}
      <div className="flex flex-col gap-2">
        {data && <Button block onClick={() => openModal('doi-mat-khau')}><Icon name="lock" size={16} />{data.passwordSignInEnabled ? 'Đổi mật khẩu' : 'Thêm mật khẩu'}</Button>}
        <Button block variant="danger" onClick={signOut} disabled={signingOut || !session}><Icon name="logout" size={16} />Đăng xuất</Button>
      </div>
      {m === 'doi-mat-khau' && data && <ChangePasswordDialog identity={identity} profile={data} returnTo={pathname} googleReauthenticated={search.get('googleReauthenticated') === 'true'} onClose={closeModal} onChanged={(message) => { setNotice(message); closeModal(); void refetch() }} />}
    </TechnicianLayout>
  )
}
