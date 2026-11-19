import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, ErrorBlock, Foot, LoadingBlock, Note, PageHeader, Segmented, Table, Td, Th } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { InviteDialog } from '../components/InviteDialog'
import { useFarmId } from '../components/useFarmId'
import { farmWorkspaceError, formatDate, formatDateTime, inviteStatusLabel, roleLabel } from '../components/WorkspaceUi'
import type { InvitationStatus } from '../types'

const STATUSES: InvitationStatus[] = ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']
const tone = (status: InvitationStatus) => status === 'PENDING' ? 'warn' : status === 'ACCEPTED' ? 'ok' : status === 'EXPIRED' ? 'err' : undefined

/** SCR-14: Chủ trại xem lời mời theo trạng thái, gửi lại hoặc hủy lời mời đang chờ. */
export default function InvitationsPage() {
  const navigate = useNavigate()
  const session = useSession()
  const farmId = useFarmId()
  const [search, setSearch] = useSearchParams()
  const [m, openModal, closeModal] = useModalParam()
  const query = useQuery(async () => {
    const [farm, invitations] = await Promise.all([farmWorkspaceApi.getFarm(farmId), farmWorkspaceApi.listInvitations(farmId)])
    return { farm, invitations }
  }, [farmId])
  const selectedStatus = (STATUSES.find((status) => status === search.get('status')) ?? 'PENDING') as InvitationStatus
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<{ id: number; email: string } | null>(null)
  const owner = (session?.role ?? query.data?.farm.role) === 'OWNER'
  const farmActive = query.data?.farm.serviceStatus === 'ACTIVE'
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((status) => [status, query.data?.invitations.filter((item) => item.status === status).length ?? 0])) as Record<InvitationStatus, number>, [query.data])
  const rows = (query.data?.invitations ?? []).filter((item) => item.status === selectedStatus)
  const chooseStatus = (status: string) => { const next = new URLSearchParams(search); next.set('status', status); next.delete('m'); setSearch(next) }

  const run = async (id: number, action: 'resend' | 'cancel') => {
    setBusy(id); setError(null); setNotice(null)
    try {
      const result = action === 'resend' ? await farmWorkspaceApi.resendInvitation(farmId, id) : await farmWorkspaceApi.cancelInvitation(farmId, id)
      await query.refetch()
      setNotice(action === 'resend' ? `Đã gửi lại lời mời tới ${result.email}. Hạn mới: ${formatDate(result.expiresAt)}.` : 'Đã hủy lời mời.')
    } catch (reason) { setError(farmWorkspaceError(reason, 'Không thể cập nhật lời mời.')) }
    finally { setBusy(null); setConfirmCancel(null) }
  }

  if (query.loading && !query.data) return <Layout title="Lời mời thành viên"><LoadingBlock /></Layout>
  if (query.error || !query.data) return <Layout title="Lời mời thành viên"><ErrorBlock message={userFacingError(query.error, 'Không tải được lời mời hoặc tài khoản không có quyền quản lý lời mời.')} onRetry={query.refetch} /></Layout>
  return (
    <Layout title="Lời mời thành viên">
      <PageHeader title="Lời mời thành viên">
        <Button onClick={() => navigate(`/thanh-vien?farmId=${farmId}`)}>Thành viên & vai trò</Button>
        {owner && <Button variant="primary" onClick={() => openModal('invite')} disabled={!farmActive}><Icon name="user-plus" size={16} className="mr-1.5" />Mời thành viên</Button>}
      </PageHeader>
      {error && <Note tone="err">{error}</Note>}{notice && <Note tone="ok">{notice}</Note>}
      {!owner && <Note>Danh sách lời mời chỉ dành cho Chủ trại.</Note>}
      <div><Segmented value={selectedStatus} onChange={chooseStatus} options={STATUSES.map((status) => ({ value: status, label: `${inviteStatusLabel(status)} (${counts[status]})` }))} /></div>
      {confirmCancel && (
        <Note tone="warn"><div className="flex flex-wrap items-center justify-between gap-3"><span>Hủy lời mời cho {confirmCancel.email}? Liên kết sẽ không còn dùng được.</span><span className="flex gap-2"><Button small onClick={() => setConfirmCancel(null)}>Giữ lời mời</Button><Button small variant="danger" disabled={busy === confirmCancel.id} onClick={() => run(confirmCancel.id, 'cancel')}>Xác nhận hủy</Button></span></div></Note>
      )}
      <Table>
        <thead><tr><Th>Người nhận</Th><Th>Vai trò</Th><Th>Gửi lần cuối</Th><Th>Hết hạn</Th><Th>Trạng thái</Th>{owner && <Th>Thao tác</Th>}</tr></thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <Td><strong className="block text-xs font-medium">{item.email}</strong><span className="text-[11px] text-muted">{item.accountHint === 'HAS_ACCOUNT' ? 'Đã có tài khoản' : item.accountHint === 'NO_ACCOUNT' ? 'Chưa có tài khoản' : 'Thông tin tài khoản chưa có từ máy chủ'}</span></Td>
              <Td>{roleLabel(item.role)}</Td><Td>{formatDateTime(item.lastSentAt)}</Td><Td>{formatDateTime(item.expiresAt)}</Td>
              <Td><Badge tone={tone(item.status)}>{inviteStatusLabel(item.status)}</Badge></Td>
              {owner && <Td>{item.status === 'PENDING' && <span className="inline-flex flex-wrap items-center"><Button variant="link" size="sm" disabled={busy === item.id || !farmActive} onClick={() => run(item.id, 'resend')}>Gửi lại</Button>·<Button variant="link" size="sm" disabled={busy === item.id} onClick={() => setConfirmCancel({ id: item.id, email: item.email })}>Hủy</Button></span>}</Td>}
            </tr>
          ))}
          {!rows.length && <tr><Td colSpan={owner ? 6 : 5} className="py-8 text-center text-subtle">Chưa có lời mời ở trạng thái này.</Td></tr>}
        </tbody>
      </Table>
      <Foot>Lọc theo đang chờ, đã chấp nhận, hết hạn hoặc đã hủy. Chỉ lời mời đang chờ mới được gửi lại hoặc hủy.</Foot>
      {m === 'invite' && owner && <InviteDialog farmId={farmId} farmName={query.data.farm.name} active={farmActive} onClose={closeModal} onSent={(message) => { setNotice(message); closeModal(); void query.refetch() }} />}
    </Layout>
  )
}
