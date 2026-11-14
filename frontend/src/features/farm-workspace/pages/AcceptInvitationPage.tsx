import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BackendError } from '../../../api/backendClient'
import { Icon } from '../../../components/Icon'
import { Badge, Button, ErrorBlock, Foot, LoadingBlock, Note } from '../../../components/ui'
import { CONTACT, INVITATION_PATH, rememberInvitationLink } from '../../authentication'
import { useSession } from '../../authorization'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { enterFarm } from '../components/enterFarm'
import { RoleSummary } from '../components/PermissionChecklist'
import SetupLayout from '../components/SetupLayout'
import { farmWorkspaceError, formatDateTime, inviteStatusLabel, roleLabel } from '../components/WorkspaceUi'
import type { InvitationPreview } from '../types'

const Fact = ({ label, children }: { label: string; children: ReactNode }) => <div><dt className="text-[11px] text-subtle">{label}</dt><dd className="m-0 mt-0.5 text-[13px] font-medium text-ink">{children}</dd></div>
const Panel = ({ title, badge, children }: { title: string; badge: ReactNode; children: ReactNode }) => (
  <section className="flex flex-col gap-4 rounded-2xl border border-field bg-white p-6">
    <div className="flex items-center justify-between gap-3"><h1 className="m-0 text-sm font-semibold text-ink">{title}</h1>{badge}</div>
    {children}
  </section>
)

/** Time the invitee sees MSG-FE03-10 before the farm home loads (the full reload clears page messages). */
export const JOINED_NOTICE_MS = 1000

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; invite: InvitationPreview }
  | { kind: 'invalid'; status: string; expiresAt?: string }
  | { kind: 'mismatch' }
  | { kind: 'inactive' }
  | { kind: 'error'; message: string }

/** A7/A8 errors that change what SCR-15 shows (UC-FE03-04 E1–E3); anything else stays a retryable failure. */
function stateFor(reason: unknown): View | null {
  if (!(reason instanceof BackendError)) return null
  const code = reason.code?.toUpperCase()
  if (code === 'MSG-FE03-08') {
    const status = typeof reason.params.status === 'string' ? reason.params.status.toUpperCase() : 'INVALID'
    return { kind: 'invalid', status, expiresAt: typeof reason.params.expiresAt === 'string' ? reason.params.expiresAt : undefined }
  }
  if (code === 'MSG-FE03-09') return { kind: 'mismatch' }
  if (code === 'MSG-FE03-04') return { kind: 'inactive' }
  return null
}

const invalidLabel = (status: string) => status === 'INVALID' ? 'Liên kết không hợp lệ' : inviteStatusLabel(status)

/** SCR-15 (UC-FE03-04, D28): the invited person reviews the farm and role, accepts, and enters the farm of the new role. */
export default function AcceptInvitationPage() {
  const navigate = useNavigate()
  const session = useSession()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const signedIn = session?.email ?? ''
  const [revision, setRevision] = useState(0)
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    setView({ kind: 'loading' }); setError(null)
    if (!token) { setView({ kind: 'invalid', status: 'INVALID' }); return }
    farmWorkspaceApi.previewInvitation(token, signedIn).then(
      (invite) => { if (current) setView({ kind: 'ready', invite }) },
      (reason) => { if (current) setView(stateFor(reason) ?? { kind: 'error', message: farmWorkspaceError(reason, 'Không tải được lời mời. Vui lòng thử lại.') }) },
    )
    return () => { current = false }
  }, [token, signedIn, revision])

  const open = async (farmId: number) => {
    try {
      const blocked = await enterFarm(farmId)
      if (blocked) { setError(blocked); setSaving(false) }
    } catch (reason) {
      setError(farmWorkspaceError(reason, 'Chưa vào được trang trại. Vui lòng thử lại.')); setSaving(false)
    }
  }

  const accept = async (invite: InvitationPreview) => {
    if (saving) return
    setSaving(true); setError(null)
    try {
      const joined = await farmWorkspaceApi.acceptInvitation(token, signedIn)
      // MSG-FE03-10, then open the farm home of the new role (SCR-48 / SCR-74).
      setNotice(`Bạn đã tham gia ${joined.farmName} với vai trò ${roleLabel(joined.role)}.`)
      setView({ kind: 'ready', invite: { ...invite, status: 'ACCEPTED', membershipId: joined.membershipId } })
      window.setTimeout(() => { void open(joined.farmId) }, JOINED_NOTICE_MS)
    } catch (reason) {
      const state = stateFor(reason)
      if (state) setView(state)
      else setError(farmWorkspaceError(reason, 'Không thể chấp nhận lời mời. Dữ liệu chưa được xác nhận đã lưu.'))
      setSaving(false)
    }
  }

  const switchAccount = () => {
    // Sign out to sign in with the invited e-mail; the link is reopened after that sign-in (D28).
    rememberInvitationLink(`${INVITATION_PATH}?token=${encodeURIComponent(token)}`)
    void session?.logout()
  }

  const shell = (children: ReactNode, foot: string) => (
    <SetupLayout narrow eyebrow="Trước khi tham gia" heading="Xem rõ trại và vai trò trước khi vào." lines={['Xem người mời, quyền và thư điện tử đăng nhập. Tư cách thành viên chỉ được tạo khi bạn chấp nhận.', 'Thư điện tử đăng nhập phải trùng thư điện tử được mời.']}>
      {children}<Foot>{foot}</Foot>
    </SetupLayout>
  )
  const contact = (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="lg" onClick={() => navigate('/')}><Icon name="arrow-left" size={16} className="mr-1.5" />Về trang chủ</Button>
      <a href={`mailto:${CONTACT.email}`} className="inline-flex h-[46px] items-center gap-1.5 rounded-xl border border-brand bg-brand px-4 text-sm font-semibold text-white no-underline"><Icon name="send" size={16} />Liên hệ BeefCare</a>
    </div>
  )

  if (view.kind === 'loading') return shell(<LoadingBlock />, 'Đang kiểm tra lời mời…')
  if (view.kind === 'error') return shell(<ErrorBlock message={view.message} onRetry={() => setRevision((value) => value + 1)} />, 'Chưa tải được lời mời; lời mời vẫn giữ nguyên trạng thái.')

  if (view.kind === 'invalid') {
    return shell(
      <Panel title="Lời mời không còn hiệu lực" badge={<Badge tone="err">{invalidLabel(view.status)}</Badge>}>
        {/* MSG-FE03-08 with the status and expiry time (SCR-15) */}
        <Note tone="err">Lời mời không còn hiệu lực ({invalidLabel(view.status)}).{view.expiresAt ? ` Hết hạn lúc ${formatDateTime(view.expiresAt)}.` : ''}</Note>
        <p className="m-0 text-xs text-subtle">Chưa có tư cách thành viên nào được tạo từ liên kết này; hãy liên hệ Chủ trại để được mời lại. Hỗ trợ: {CONTACT.email} · <a href={CONTACT.phoneHref}>{CONTACT.phone}</a></p>
        {contact}
      </Panel>,
      'Liên kết đã bị hủy, hết hạn, đã được sử dụng hoặc không đúng; liên kết không cấp quyền vào trại.',
    )
  }

  if (view.kind === 'mismatch') {
    return shell(
      <Panel title="Lời mời được gửi tới thư điện tử khác" badge={<Badge tone="err">Không khớp thư điện tử</Badge>}>
        {/* MSG-FE03-09; the farm details stay hidden (UC-FE03-04 E2) */}
        <Note tone="err">Lời mời này được gửi tới email khác. Hãy đăng nhập bằng email được mời để chấp nhận.</Note>
        <dl className="m-0 grid gap-3"><Fact label="Thư điện tử đang đăng nhập">{signedIn || '—'}</Fact></dl>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="lg" onClick={() => navigate('/')}>Về trang chủ</Button>
          {session && <Button size="lg" variant="primary" onClick={switchAccount}>Đăng xuất để đổi tài khoản</Button>}
        </div>
      </Panel>,
      'Thông tin trang trại chỉ hiện với tài khoản có thư điện tử được mời.',
    )
  }

  if (view.kind === 'inactive') {
    return shell(
      <Panel title="Trang trại chưa thể nhận thành viên" badge={<Badge tone="warn">Đang chờ</Badge>}>
        {/* MSG-FE03-04; the invitation stays PENDING (UC-FE03-04 E3) */}
        <Note tone="warn">Mời thành viên, đổi vai trò và kích hoạt lại cần trại đang hoạt động (ACTIVE).</Note>
        <p className="m-0 text-xs text-subtle">Lời mời vẫn đang chờ. Hãy mở lại liên kết khi dịch vụ của trang trại hoạt động trở lại, trước khi lời mời hết hạn.</p>
        <div className="flex flex-wrap justify-end gap-2"><Button size="lg" onClick={() => navigate('/chon-trai')}>Để sau</Button></div>
      </Panel>,
      'Chủ trại cần kích hoạt lại dịch vụ trước khi bạn tham gia.',
    )
  }

  const { invite } = view
  const zone = invite.timeZone
  if (invite.status === 'ACCEPTED') {
    return shell(
      <Panel title="Bạn đã tham gia trang trại" badge={<Badge tone="ok">Đã chấp nhận</Badge>}>
        {/* AF2: the existing membership is shown; nothing new is created */}
        {notice ? <Note tone="ok">{notice}</Note> : <Note tone="ok">Bạn đã là thành viên của {invite.farmName} với vai trò {roleLabel(invite.role)}.</Note>}
        <dl className="m-0 grid gap-3 sm:grid-cols-2"><Fact label="Trang trại">{invite.farmName}</Fact><Fact label="Vai trò">{roleLabel(invite.role)}</Fact></dl>
        {error && <Note tone="err">{error}</Note>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="lg" onClick={() => navigate('/')}>Về trang chủ</Button>
          <Button size="lg" variant="primary" disabled={saving && !error} onClick={() => { setSaving(true); setError(null); void open(invite.farmId) }}>{saving && !error ? 'Đang vào trại…' : 'Vào trại'}</Button>
        </div>
      </Panel>,
      'Liên kết đã được dùng để tham gia; mở lại chỉ hiện tư cách thành viên hiện có.',
    )
  }

  return shell(
    <Panel title="Lời mời tham gia trang trại" badge={<Badge tone="warn">Chờ bạn chấp nhận</Badge>}>
      <dl className="m-0 grid gap-3 sm:grid-cols-2">
        <Fact label="Trang trại">{invite.farmName}</Fact><Fact label="Vai trò">{roleLabel(invite.role)}</Fact>
        <Fact label="Mời bởi">{invite.invitedBy ?? '—'}</Fact><Fact label="Gửi lúc">{formatDateTime(invite.sentAt, zone)}</Fact>
        <Fact label="Thư điện tử được mời">{invite.email}</Fact><Fact label="Hết hạn">{formatDateTime(invite.expiresAt, zone)}</Fact>
        <Fact label="Thư điện tử đang đăng nhập">{signedIn || '—'}</Fact>
      </dl>
      <div className="flex flex-col gap-2"><span className="text-xs font-medium text-ink">Quyền của vai trò</span><RoleSummary role={invite.role} /></div>
      {error && <Note tone="err">{error}</Note>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="lg" disabled={saving} onClick={() => navigate('/chon-trai')}>Để sau</Button>
        <Button size="lg" variant="primary" disabled={saving} onClick={() => void accept(invite)}>{saving ? 'Đang tham gia…' : 'Chấp nhận & vào trại'}</Button>
      </div>
    </Panel>,
    'Kiểm tra trại, vai trò, người mời, quyền và thời hạn. Chọn để sau sẽ giữ lời mời đang chờ.',
  )
}
