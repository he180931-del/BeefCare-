import { useState } from 'react'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { Button, ErrorBlock, KV, LoadingBlock, Note } from '../../../components/ui'
import { useSession } from '../../authorization'
import { ChangePasswordDialog } from '../components/ChangePasswordDialog'
import { Avatar } from '../components/ProfileParts'
import { useAccountProfile } from '../components/useAccountProfile'
import { roleAtFarm } from '../domain/profileRules'

/** Tài khoản của Kỹ thuật viên trên điện thoại (không có frame): thông tin cơ bản, đổi mật khẩu và đăng xuất. */
export default function TechnicianAccountPage() {
  const session = useSession()
  const { identity, data, loading, error, refetch } = useAccountProfile()
  const [m, openModal, closeModal] = useModalParam()
  const [notice, setNotice] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
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
        <section className="flex flex-col gap-3 rounded-md border border-edge bg-white p-4 text-[13px]">
          <KV k="Thư điện tử">{data.email}</KV>
          <KV k="Điện thoại">{data.phone || '—'}</KV>
          <KV k="Trang trại">{identity.farmName ?? '—'}</KV>
          <KV k="Vai trò">Kỹ thuật viên</KV>
        </section>
      )}
      <div className="flex flex-col gap-2">
        {data && <Button block onClick={() => openModal('doi-mat-khau')}><Icon name="lock" size={16} />{data.passwordSignInEnabled ? 'Đổi mật khẩu' : 'Thêm mật khẩu'}</Button>}
        <Button block variant="danger" onClick={signOut} disabled={signingOut || !session}><Icon name="logout" size={16} />Đăng xuất</Button>
      </div>
      {m === 'doi-mat-khau' && data && <ChangePasswordDialog identity={identity} profile={data} onClose={closeModal} onChanged={(message) => { setNotice(message); closeModal(); void refetch() }} />}
    </TechnicianLayout>
  )
}
