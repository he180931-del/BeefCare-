import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Foot, LoadingBlock, Note } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { RoleSummary } from '../components/PermissionChecklist'
import SetupLayout from '../components/SetupLayout'
import { farmWorkspaceError, formatDateTime, inviteStatusLabel, roleLabel } from '../components/WorkspaceUi'
import type { InvitationPreview } from '../types'

const SUPPORT_EMAIL = 'tuanpqhe181869@fpt.edu.vn'
const Fact = ({ label, children }: { label: string; children: ReactNode }) => <div><dt className="text-[11px] text-subtle">{label}</dt><dd className="m-0 mt-0.5 text-[13px] font-medium text-ink">{children}</dd></div>
const Panel = ({ title, badge, children }: { title: string; badge: ReactNode; children: ReactNode }) => (
  <section className="flex flex-col gap-4 rounded-2xl border border-field bg-white p-6">
    <div className="flex items-center justify-between gap-3"><h1 className="m-0 text-sm font-semibold text-ink">{title}</h1>{badge}</div>
    {children}
  </section>
)

/** SCR-15 (UC-FE03-04): người được mời xem trại, vai trò, quyền rồi chấp nhận; liên kết sai hoặc hết hạn hiện trạng thái "không còn hiệu lực". */
export default function AcceptInvitationPage() {
  const navigate = useNavigate()
  const session = useSession()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const query = useQuery(async () => {
    const [profile, invitation] = await Promise.all([farmWorkspaceApi.getProfile(), token ? farmWorkspaceApi.previewInvitation(token).catch(() => null) : null])
    return { profile, invitation }
  }, [token])
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const invite: InvitationPreview | null | undefined = query.data?.invitation
  const signedIn = session?.email ?? query.data?.profile.email ?? ''
  const matches = Boolean(invite && signedIn.toLowerCase() === invite.email.toLowerCase())
  const accept = async () => {
    if (!invite) return
    setSaving(true); setError(null)
    try {
      await farmWorkspaceApi.acceptInvitation(token, signedIn)
      setNotice(`Bạn đã tham gia ${invite.farmName} với vai trò ${roleLabel(invite.role)}.`)
      window.setTimeout(() => navigate(invite.role === 'TECHNICIAN' ? '/kt' : '/tong-quan', { replace: true }), 700)
    } catch (reason) { setError(farmWorkspaceError(reason, 'Không thể chấp nhận lời mời.')) }
    finally { setSaving(false) }
  }
  const shell = (children: ReactNode, foot: string) => (
    <SetupLayout narrow eyebrow="Trước khi tham gia" heading="Xem rõ trại và vai trò trước khi vào." lines={['Xem người mời, quyền và Thư điện tử đăng nhập. Tư cách thành viên chỉ được tạo khi bạn chấp nhận.', 'Thư điện tử đăng nhập phải trùng Thư điện tử được mời.']}>
      {children}<Foot>{foot}</Foot>
    </SetupLayout>
  )

  if (query.loading && !query.data) return shell(<LoadingBlock />, 'Đang kiểm tra lời mời…')
  if (!invite || invite.status !== 'PENDING') {
    return shell(
      <Panel title="Lời mời không còn hiệu lực" badge={<Badge tone="err">{invite ? (invite.status === 'EXPIRED' ? 'Đã hết hạn' : inviteStatusLabel(invite.status)) : 'Liên kết không hợp lệ'}</Badge>}>
        {invite && <dl className="m-0 grid gap-3 sm:grid-cols-2"><Fact label="Trang trại">{invite.farmName}</Fact><Fact label="Vai trò">{roleLabel(invite.role)}</Fact><Fact label="Hết hạn lúc">{formatDateTime(invite.expiresAt)}</Fact><Fact label="Thư điện tử được mời">{invite.email}</Fact></dl>}
        <p className="m-0 text-xs text-subtle">Lời mời này không còn dùng được. Chưa có tư cách thành viên nào được tạo; hãy liên hệ Chủ trại để được mời lại.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="lg" onClick={() => navigate('/')}><Icon name="arrow-left" size={16} className="mr-1.5" />Về trang chủ</Button>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex h-[46px] items-center gap-1.5 rounded-xl border border-brand bg-brand px-4 text-sm font-semibold text-white no-underline"><Icon name="send" size={16} />Gửi yêu cầu hỗ trợ</a>
        </div>
      </Panel>,
      'Thẻ nêu trạng thái và thời điểm hết hạn; khi liên kết không còn hiệu lực, chưa tạo tư cách thành viên và cần liên hệ chủ trại.',
    )
  }
  return shell(
    <Panel title="Lời mời tham gia trang trại" badge={<Badge tone="warn">Chờ bạn chấp nhận</Badge>}>
      {matches ? (
        <>
          <dl className="m-0 grid gap-3 sm:grid-cols-2">
            <Fact label="Trang trại">{invite.farmName}</Fact><Fact label="Vai trò">{roleLabel(invite.role)}</Fact>
            <Fact label="Mời bởi">{invite.invitedBy ?? 'Máy chủ chưa cung cấp thông tin'}</Fact><Fact label="Gửi lúc">{formatDateTime(invite.invitedAt)}</Fact>
            <Fact label="Thư điện tử được mời">{invite.email}</Fact><Fact label="Hết hạn">{formatDateTime(invite.expiresAt)}</Fact>
            <Fact label="Thư điện tử đang đăng nhập">{signedIn}</Fact>
          </dl>
          <div className="flex flex-col gap-2"><span className="text-xs font-medium text-ink">Quyền của vai trò</span><RoleSummary role={invite.role} /></div>
        </>
      ) : (
        <Note tone="err">Lời mời này được gửi tới thư điện tử khác ({signedIn} không trùng thư điện tử được mời). Hãy đăng nhập bằng thư điện tử được mời để chấp nhận; thông tin trang trại được ẩn.</Note>
      )}
      {notice && <Note tone="ok">{notice}</Note>}{error && <Note tone="err">{error}</Note>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="lg" onClick={() => navigate('/chon-trai')}>Từ chối sau</Button>
        {!matches && session && <Button size="lg" onClick={() => void session.logout()}>Đăng xuất để đổi tài khoản</Button>}
        <Button size="lg" variant="primary" disabled={!matches || saving} onClick={accept}>{saving ? 'Đang tham gia…' : 'Chấp nhận & vào trại'}</Button>
      </div>
    </Panel>,
    'Kiểm tra trại, vai trò, người mời, quyền và thời hạn. Thư điện tử đăng nhập phải trùng Thư điện tử nhận lời mời; chọn để sau sẽ giữ lời mời đang chờ.',
  )
}
