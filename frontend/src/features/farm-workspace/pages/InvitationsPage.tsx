import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Field, inputCls, Note, PageHeader, Table, Td, Th } from '../../../components/ui'
import Modal, { ModalFooter } from '../../../components/Modal'
import { backendFarmId, backendMode } from '../../../api/backendTransport'
import { useQuery } from '../../../hooks/useApi'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { ROLE_PERMISSION_ROWS, type InvitationStatus, type InviteMemberInput } from '../types'
import { validateInvite, type FormErrors } from '../validation'
import { farmWorkspaceError, FormErrors as ErrorSummary, formatDateTime, inviteStatusLabel, roleLabel } from '../components/WorkspaceUi'

const STATUSES: Array<{ value: InvitationStatus; label: string }> = [
  { value: 'PENDING', label: 'Đang chờ' }, { value: 'ACCEPTED', label: 'Đã chấp nhận' }, { value: 'EXPIRED', label: 'Đã hết hạn' }, { value: 'CANCELLED', label: 'Đã hủy' },
]

export default function InvitationsPage() {
  const navigate = useNavigate()
  const params = useParams<{ farmId: string }>()
  const [search, setSearch] = useSearchParams()
  const rawId = params.farmId ?? search.get('farmId') ?? backendFarmId
  const farmId = Number(rawId) > 0 ? Number(rawId) : Number(backendFarmId)
  const query = useQuery(async () => {
    const [farm, invitations] = await Promise.all([farmWorkspaceApi.getFarm(farmId), farmWorkspaceApi.listInvitations(farmId)])
    return { farm, invitations }
  }, [farmId])
  const selectedStatus = (search.get('status') as InvitationStatus | null) ?? 'PENDING'
  const rows = useMemo(() => (query.data?.invitations ?? []).filter((item) => item.status === selectedStatus), [query.data, selectedStatus])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [validityDays, setValidityDays] = useState<3 | 7 | 14>(7)
  const [errors, setErrors] = useState<FormErrors<InviteMemberInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyInvitation, setBusyInvitation] = useState<number | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null)
  const owner = query.data?.farm.role === 'OWNER'
  const inviteOpen = search.get('m') === 'invite'
  const clearInviteModal = () => { const next = new URLSearchParams(search); next.delete('m'); setSearch(next); setEmail(''); setRole(''); setValidityDays(7); setErrors({}); setError(null) }
  const chooseStatus = (status: InvitationStatus) => { const next = new URLSearchParams(search); next.set('status', status); next.delete('m'); setSearch(next) }
  const submitInvite = async (event: FormEvent) => {
    event.preventDefault()
    const input = { email, role, validityDays } as Partial<InviteMemberInput>
    const nextErrors = validateInvite(input)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true); setError(null)
    try { await farmWorkspaceApi.inviteMember(farmId, input as InviteMemberInput); await query.refetch(); setNotice('Đã tạo lời mời.'); clearInviteModal() }
    catch (reason) { setError(farmWorkspaceError(reason, 'Không thể gửi lời mời.')) }
    finally { setSaving(false) }
  }
  const actionInvitation = async (id: number, action: 'resend' | 'cancel') => {
    setBusyInvitation(id); setError(null); setNotice(null)
    try {
      if (action === 'resend') await farmWorkspaceApi.resendInvitation(farmId, id)
      else await farmWorkspaceApi.cancelInvitation(farmId, id)
      await query.refetch(); setNotice(action === 'resend' ? 'Đã gửi lại lời mời.' : 'Đã hủy lời mời.')
    } catch (reason) { setError(farmWorkspaceError(reason, 'Không thể cập nhật lời mời.')) }
    finally { setBusyInvitation(null); setConfirmCancelId(null) }
  }
  const counts = useMemo(() => Object.fromEntries(STATUSES.map(({ value }) => [value, query.data?.invitations.filter((item) => item.status === value).length ?? 0])) as Record<InvitationStatus, number>, [query.data])
  return <Layout title="Lời mời thành viên" user={owner ? 'owner' : 'manager'}>
    <PageHeader title="Lời mời thành viên" sub={query.data?.farm.name ?? 'Xem trạng thái lời mời tham gia trang trại.'}>
      <Button onClick={() => navigate(`/thanh-vien?farmId=${farmId}`)}>Thành viên & vai trò</Button>
      {owner && <Button variant="primary" onClick={() => { const next = new URLSearchParams(search); next.set('m', 'invite'); setSearch(next) }} disabled={query.data?.farm.serviceStatus !== 'ACTIVE'}>+ Mời thành viên</Button>}
    </PageHeader>
    {backendMode === 'local' && <Note tone="info">Dữ liệu mô phỏng. Email không được gửi thật.</Note>}
    {error && !inviteOpen && <Note tone="err">{error}</Note>}{notice && <Note tone="ok">{notice}</Note>}
    {query.loading && !query.data && <Note>Đang tải lời mời…</Note>}
    {Boolean(query.error) && <Note tone="err">Không tải được lời mời hoặc tài khoản không có quyền quản lý lời mời.</Note>}
    {query.data && <>
      {!owner && <Note>Danh sách lời mời chỉ dành cho Chủ trại.</Note>}
      <nav aria-label="Lọc trạng thái lời mời" className="flex flex-wrap gap-2 border-b border-rule">{STATUSES.map(({ value, label }) => <button key={value} type="button" onClick={() => chooseStatus(value)} className={`border-b-2 px-3 py-2.5 text-xs ${selectedStatus === value ? 'border-brand font-semibold text-brand-dark' : 'border-transparent text-muted'}`}>{label} ({counts[value]})</button>)}</nav>
      {confirmCancelId && <Note tone="warn"><div className="flex flex-wrap items-center justify-between gap-3"><span>Hủy lời mời này? Liên kết cũ sẽ không còn hiệu lực.</span><span className="flex gap-2"><Button small onClick={() => setConfirmCancelId(null)}>Giữ lời mời</Button><Button small variant="danger" disabled={busyInvitation === confirmCancelId} onClick={() => actionInvitation(confirmCancelId, 'cancel')}>Xác nhận hủy</Button></span></div></Note>}
      <Table><thead><tr><Th>Người nhận</Th><Th>Vai trò</Th><Th>Gửi gần nhất</Th><Th>Hết hạn</Th><Th>Trạng thái</Th>{owner && <Th>Thao tác</Th>}</tr></thead><tbody>
        {rows.map((item) => <tr key={item.id}><Td><strong className="block">{item.email}</strong><span className="text-subtle">{item.accountHint === 'HAS_ACCOUNT' ? 'Đã có tài khoản' : item.accountHint === 'NO_ACCOUNT' ? 'Chưa có tài khoản' : 'Thông tin tài khoản chưa có từ máy chủ'}</span></Td><Td>{roleLabel(item.role)}</Td><Td>{formatDateTime(item.lastSentAt)}</Td><Td>{formatDateTime(item.expiresAt)}</Td><Td><Badge tone={item.status === 'PENDING' ? 'warn' : item.status === 'ACCEPTED' ? 'ok' : 'outline'}>{inviteStatusLabel(item.status)}</Badge></Td>{owner && <Td>{item.status === 'PENDING' && <div className="flex flex-wrap gap-1.5">{query.data?.farm.serviceStatus === 'ACTIVE' && <Button small disabled={busyInvitation === item.id} onClick={() => actionInvitation(item.id, 'resend')}>Gửi lại</Button>}<Button small variant="danger" disabled={busyInvitation === item.id} onClick={() => setConfirmCancelId(item.id)}>Hủy</Button></div>}</Td>}</tr>)}
        {!rows.length && <tr><Td colSpan={owner ? 6 : 5} className="py-8 text-center text-subtle">Chưa có lời mời ở trạng thái này.</Td></tr>}
      </tbody></Table>
    </>}
    {inviteOpen && <Modal title="Mời thành viên" sub={query.data?.farm.name} onClose={clearInviteModal} width={640}>
      {error && <Note tone="err">{error}</Note>}
      <form onSubmit={submitInvite} className="flex flex-col gap-4">
        <Field label="Email người nhận *" id="invite-email"><input id="invite-email" type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputCls} /></Field>
        <fieldset className="m-0 border-0 p-0"><legend className="mb-2 text-xs font-medium">Vai trò *</legend><div className="flex flex-wrap gap-5"><label className="flex items-center gap-2 text-xs"><input type="radio" name="invite-role" checked={role === 'MANAGER'} onChange={() => setRole('MANAGER')} />Quản lý</label><label className="flex items-center gap-2 text-xs"><input type="radio" name="invite-role" checked={role === 'TECHNICIAN'} onChange={() => setRole('TECHNICIAN')} />Kỹ thuật viên</label></div></fieldset>
        {role && <Card title={`Quyền ${roleLabel(role).toLowerCase()}`}><div className="max-h-48 overflow-y-auto text-xs">{ROLE_PERMISSION_ROWS.map((row) => <div key={row.area} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-rule py-2"><span>{row.area}</span><span>{role === 'MANAGER' ? row.MANAGER : row.TECHNICIAN}</span></div>)}</div></Card>}
        <Field label="Thời hạn lời mời" id="invite-validity"><select id="invite-validity" value={validityDays} onChange={(event) => setValidityDays(Number(event.target.value) as 3 | 7 | 14)} className={inputCls}><option value={3}>3 ngày</option><option value={7}>7 ngày (mặc định)</option><option value={14}>14 ngày</option></select></Field>
        <ErrorSummary errors={errors as Record<string, string | undefined>} />
        <ModalFooter compact><Button onClick={clearInviteModal}>Hủy</Button><Button type="submit" variant="primary" size="lg" disabled={saving || !owner || query.data?.farm.serviceStatus !== 'ACTIVE'}>{saving ? 'Đang gửi…' : 'Gửi lời mời'}</Button></ModalFooter>
      </form>
    </Modal>}
  </Layout>
}
