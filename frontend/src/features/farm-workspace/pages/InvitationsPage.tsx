import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, ErrorBlock, Foot, LoadingBlock, Note, PageHeader, Pagination, Segmented, Table, Td, Th } from '../../../components/ui'
import { useSession } from '../../authorization'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { InviteDialog } from '../components/InviteDialog'
import { useFarmId } from '../components/useFarmId'
import { farmWorkspaceError, formatDateTime, invitationNotice, inviteStatusLabel, roleLabel } from '../components/WorkspaceUi'
import { useRequestKey } from '../hooks/useRequestKey'
import type { FarmDetails, Invitation, InvitationPage, InvitationStatus } from '../types'

const STATUSES: InvitationStatus[] = ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']
const tone = (status: InvitationStatus) => status === 'PENDING' ? 'warn' : status === 'ACCEPTED' ? 'ok' : status === 'EXPIRED' ? 'err' : undefined
interface Preferences { status: InvitationStatus; dir: 'asc' | 'desc' }
const DEFAULTS: Preferences = { status: 'PENDING', dir: 'desc' }
function readPreferences(key: string): Preferences {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? '{}')
    return { status: STATUSES.includes(saved?.status) ? saved.status : 'PENDING', dir: saved?.dir === 'asc' ? 'asc' : 'desc' }
  } catch { return DEFAULTS }
}
type ListResult = { key: string; data?: { farm: FarmDetails; invitations: InvitationPage }; error?: unknown }

/** SCR-14 / D26: one bounded server page, whole-farm counts, no polling or writes on read. */
export default function InvitationsPage() {
  const navigate = useNavigate()
  const session = useSession()
  const farmId = useFarmId()
  const [search, setSearch] = useSearchParams()
  const [m, openModal, closeModal] = useModalParam()
  const owner = session?.role === 'OWNER'
  const preferencesKey = `beefcare:invitation-filters:${session?.email ?? ''}:${farmId}`
  const saved = useMemo(() => readPreferences(preferencesKey), [preferencesKey])
  const selectedStatus = STATUSES.find(status => status === search.get('status')) ?? saved.status
  const dir = search.get('dir') === 'asc' ? 'asc' : search.get('dir') === 'desc' ? 'desc' : saved.dir
  const requestedPage = Number(search.get('page') ?? 0)
  const page = Number.isInteger(requestedPage) && requestedPage >= 0 && requestedPage <= 21474836 ? requestedPage : 0
  const [revision, setRevision] = useState(0)
  const refresh = () => setRevision(value => value + 1)
  const queryKey = `${preferencesKey}:${owner}:${selectedStatus}:${dir}:${page}:${revision}`
  const [result, setResult] = useState<ListResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<Invitation | null>(null)
  const requestKey = useRequestKey(`invitation-action:${farmId}`)

  useEffect(() => {
    if (!owner) return
    try { sessionStorage.setItem(preferencesKey, JSON.stringify({ status: selectedStatus, dir })) } catch { /* Preferences are optional when browser storage is unavailable. */ }
  }, [owner, preferencesKey, selectedStatus, dir])

  useEffect(() => {
    if (!owner) return
    let current = true
    Promise.all([
      farmWorkspaceApi.getFarm(farmId),
      farmWorkspaceApi.listInvitations(farmId, { status: selectedStatus, page, size: 20, sort: 'lastSentAt', dir }),
    ]).then(([farm, invitations]) => {
      if (current) setResult({ key: queryKey, data: { farm, invitations } })
    }, error => { if (current) setResult({ key: queryKey, error }) })
    // A previous filter/farm response must never replace the current page or its observed versions.
    return () => { current = false }
  }, [queryKey, owner, farmId, selectedStatus, page, dir])

  const data = result?.key === queryKey ? result.data : undefined
  const loadError = result?.key === queryKey ? result.error : undefined
  const changeList = (status: InvitationStatus, direction: 'asc' | 'desc', nextPage = 0) => {
    const next = new URLSearchParams(search)
    next.set('status', status); next.set('dir', direction); next.set('page', String(nextPage)); next.delete('m')
    setConfirmCancel(null); setError(null); setNotice(null); setSearch(next)
  }
  useEffect(() => {
    if (!data || page === 0) return
    const last = Math.max(0, Math.ceil(data.invitations.total / data.invitations.size) - 1)
    if (page > last) {
      const next = new URLSearchParams(search); next.set('page', String(last)); setSearch(next, { replace: true })
    }
  }, [data, page, search, setSearch])

  const run = async (observed: Invitation, action: 'resend' | 'cancel') => {
    if (busy !== null || !data) return
    setBusy(observed.id); setError(null); setNotice(null)
    try {
      const options = { expectedVersion: observed.version, idempotencyKey: requestKey.keyFor({ id: observed.id, action, version: observed.version }) }
      const updated = action === 'resend'
        ? await farmWorkspaceApi.resendInvitation(farmId, observed.id, options)
        : await farmWorkspaceApi.cancelInvitation(farmId, observed.id, options)
      requestKey.clear()
      setNotice(action === 'resend' ? invitationNotice(updated, true, data.farm.timeZone) : 'Đã hủy lời mời.')
      refresh()
    } catch (reason) { setError(farmWorkspaceError(reason, 'Không thể cập nhật lời mời.')) }
    finally { setBusy(null); setConfirmCancel(null) }
  }

  if (!owner) return <Layout title="Lời mời thành viên"><ErrorBlock message="Bạn không có quyền xem lời mời của trại này." /></Layout>
  if (loadError) return <Layout title="Lời mời thành viên"><ErrorBlock message={userFacingError(loadError, 'Không thể tải danh sách lời mời. Vui lòng thử lại.')} onRetry={refresh} /></Layout>
  if (!data) return <Layout title="Lời mời thành viên"><LoadingBlock /></Layout>
  const { farm, invitations } = data
  const farmActive = farm.serviceStatus === 'ACTIVE'
  const pageCount = Math.max(1, Math.ceil(invitations.total / invitations.size))
  return (
    <Layout title="Lời mời thành viên">
      <PageHeader title="Lời mời thành viên">
        <Button onClick={() => navigate(`/thanh-vien?farmId=${farmId}`)}>Thành viên & vai trò</Button>
        <Button onClick={refresh} disabled={busy !== null}>Làm mới</Button>
        <Button variant="primary" onClick={() => openModal('invite')} disabled={!farmActive || busy !== null}><Icon name="user-plus" size={16} className="mr-1.5" />Mời thành viên</Button>
      </PageHeader>
      {error && <Note tone="err">{error}</Note>}{notice && <Note tone="ok">{notice}</Note>}
      {!farmActive && <Note>Dịch vụ trại hiện không hoạt động. Bạn vẫn có thể xem và hủy lời mời đang chờ.</Note>}
      <div><Segmented value={selectedStatus} onChange={status => changeList(status as InvitationStatus, dir)} options={STATUSES.map(status => ({ value: status, label: `${inviteStatusLabel(status)} (${invitations.counts[status]})`, disabled: busy !== null }))} /></div>
      {confirmCancel && (
        <Note tone="warn"><div className="flex flex-wrap items-center justify-between gap-3"><span>Hủy lời mời cho {confirmCancel.email}? Liên kết sẽ không còn dùng được.</span><span className="flex gap-2"><Button small disabled={busy !== null} onClick={() => setConfirmCancel(null)}>Giữ lời mời</Button><Button small variant="danger" disabled={busy !== null} onClick={() => run(confirmCancel, 'cancel')}>Xác nhận hủy</Button></span></div></Note>
      )}
      <Table>
        <thead><tr><Th>Người nhận</Th><Th>Vai trò</Th><Th aria-sort={dir === 'desc' ? 'descending' : 'ascending'}><button type="button" disabled={busy !== null} className="inline-flex cursor-pointer items-center gap-1" onClick={() => changeList(selectedStatus, dir === 'desc' ? 'asc' : 'desc')}>Gửi lần cuối <span aria-hidden="true">{dir === 'desc' ? '↓' : '↑'}</span></button></Th><Th>Hết hạn</Th><Th>Trạng thái</Th><Th>Thao tác</Th></tr></thead>
        <tbody>
          {invitations.items.map(item => (
            <tr key={item.id}>
              <Td><strong className="block text-xs font-medium">{item.email}</strong><span className="text-[11px] text-muted">{item.accountHint === 'HAS_ACCOUNT' ? 'Đã có tài khoản' : item.accountHint === 'NO_ACCOUNT' ? 'Chưa có tài khoản' : 'Chưa có thông tin tài khoản'}</span></Td>
              <Td>{roleLabel(item.role)}</Td><Td>{formatDateTime(item.lastSentAt, farm.timeZone)}</Td><Td>{formatDateTime(item.expiresAt, farm.timeZone)}</Td>
              <Td><Badge tone={tone(item.status)}>{inviteStatusLabel(item.status)}</Badge></Td>
              <Td>{item.status === 'PENDING' && <span className="inline-flex flex-wrap items-center"><Button variant="link" size="sm" disabled={busy !== null || !farmActive} onClick={() => run(item, 'resend')}>Gửi lại</Button>·<Button variant="link" size="sm" disabled={busy !== null} onClick={() => setConfirmCancel(item)}>Hủy</Button></span>}</Td>
            </tr>
          ))}
          {!invitations.items.length && <tr><Td colSpan={6} className="py-8 text-center text-subtle"><p>Không có bản ghi phù hợp với bộ lọc.</p><Button onClick={() => { changeList('PENDING', 'desc'); refresh() }}>Xóa bộ lọc</Button></Td></tr>}
        </tbody>
      </Table>
      <Pagination page={page + 1} pageCount={pageCount} onChange={next => { if (busy === null) changeList(selectedStatus, dir, next - 1) }} summary={invitations.total ? `Hiển thị ${page * invitations.size + 1}–${Math.min((page + 1) * invitations.size, invitations.total)} trong ${invitations.total} lời mời` : '0 lời mời'} />
      <Foot>Chỉ lời mời đang chờ, chưa hết hạn mới được gửi lại hoặc hủy. Cập nhật lúc {formatDateTime(invitations.asOf, farm.timeZone)}.</Foot>
      {m === 'invite' && <InviteDialog farmId={farmId} farmName={farm.name} timeZone={farm.timeZone} active={farmActive} onClose={closeModal} onSent={message => { setNotice(message); closeModal(); refresh() }} />}
    </Layout>
  )
}
