import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Note } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { useQuery } from '../../../hooks/useApi'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { ROLE_PERMISSION_ROWS } from '../types'
import { farmWorkspaceError, roleLabel, formatDateTime } from '../components/WorkspaceUi'

export default function AcceptInvitationPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const query = useQuery(async () => {
    if (!token) throw new Error('Liên kết lời mời không hợp lệ.')
    const [profile, invitation] = await Promise.all([farmWorkspaceApi.getProfile(), farmWorkspaceApi.previewInvitation(token)])
    return { profile, invitation }
  }, [token])
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const invite = query.data?.invitation
  const profile = query.data?.profile
  const emailMatches = Boolean(invite && profile && invite.email.toLowerCase() === profile.email.toLowerCase())
  const invalid = Boolean(query.error || (invite && invite.status !== 'PENDING'))
  const accept = async () => {
    setSaving(true); setError(null); setNotice(null)
    try { await farmWorkspaceApi.acceptInvitation(token); setNotice('Đã tham gia trang trại. Chọn trang trại để tiếp tục.'); setTimeout(() => navigate('/chon-trai', { replace: true }), 700) }
    catch (reason) { setError(farmWorkspaceError(reason, 'Không thể chấp nhận lời mời.')) }
    finally { setSaving(false) }
  }
  return <main className="grid min-h-screen place-items-center bg-page px-4 py-8 text-ink"><section className="w-full max-w-[760px] rounded-2xl border border-field bg-white p-6 shadow-sm sm:p-10">
    <a href="/" className="text-sm font-bold text-brand no-underline">BeefCare</a>
    <h1 className="mb-0 mt-5 text-2xl font-bold">Chấp nhận lời mời</h1>
    <p className="mb-6 mt-2 text-sm text-subtle">Xem thông tin và quyền của bạn trước khi tham gia trang trại.</p>
    {backendMode === 'local' && <Note tone="info">Bản mô phỏng dùng liên kết thử nghiệm, không tạo tài khoản thật.</Note>}
    {query.loading && <Note>Đang kiểm tra lời mời…</Note>}
    {invalid && <Card title="Lời mời không còn hiệu lực"><p className="m-0 text-sm text-subtle">Không thể mở thông tin lời mời. Liên kết có thể đã hết hạn, bị hủy, đã được sử dụng hoặc email đăng nhập không khớp.</p><div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => navigate('/')}>Về trang chủ</Button><Button onClick={() => navigate('/ho-tro')}>Liên hệ BeefCare</Button></div></Card>}
    {invite && !invalid && <div className="mt-5 flex flex-col gap-5">
      {emailMatches ? <><Card title="Thông tin lời mời" actions={<Badge tone="warn">Đang chờ</Badge>}>
        <dl className="m-0 grid gap-4 sm:grid-cols-2 text-sm"><div><dt className="text-xs text-faint">Trang trại</dt><dd className="m-0 mt-1 font-semibold">{invite.farmName}</dd></div><div><dt className="text-xs text-faint">Vai trò</dt><dd className="m-0 mt-1 font-semibold">{roleLabel(invite.role)}</dd></div><div><dt className="text-xs text-faint">Người mời</dt><dd className="m-0 mt-1">{invite.invitedBy ?? 'Máy chủ chưa cung cấp thông tin'}</dd></div><div><dt className="text-xs text-faint">Gửi lúc</dt><dd className="m-0 mt-1">{formatDateTime(invite.invitedAt)}</dd></div><div><dt className="text-xs text-faint">Hết hạn</dt><dd className="m-0 mt-1">{formatDateTime(invite.expiresAt)}</dd></div><div><dt className="text-xs text-faint">Email được mời / đang đăng nhập</dt><dd className="m-0 mt-1">{invite.email} · {profile?.email}</dd></div></dl>
      </Card><Card title={`Quyền của ${roleLabel(invite.role).toLowerCase()}`}><div className="max-h-72 overflow-y-auto text-xs">{ROLE_PERMISSION_ROWS.map((row) => <div key={row.area} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-rule py-2"><span>{row.area}</span><span>{invite.role === 'MANAGER' ? row.MANAGER : row.TECHNICIAN}</span></div>)}</div></Card>
      </> : <Note tone="err">Tài khoản đang đăng nhập ({profile?.email}) không trùng email được mời. Hãy đăng nhập bằng {invite.email}. Thông tin trại đã được ẩn.</Note>}
      {notice && <Note tone="ok">{notice}</Note>}{error && <Note tone="err">{error}</Note>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-rule pt-4"><Button onClick={() => navigate('/chon-trai')}>Để sau</Button><Button variant="primary" disabled={!emailMatches || saving} onClick={accept}>{saving ? 'Đang tham gia…' : 'Chấp nhận và vào trại'}</Button></div>
    </div>}
  </section></main>
}
