import { userFacingError } from '../../../shared/api/userFacingError'
import { Badge, Button, EmptyBlock, ErrorBlock, Foot, Icon, LoadingBlock, Modal, ModalFooter, Note, PageHeader, Pagination, Segmented, Table, Td, Th } from '../../../shared/ui'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { InviteDialog } from '../components/InviteDialog'
import { formatDateTime, inviteStatusLabel, roleLabel } from '../components/WorkspaceUi'
import { useInvitationsPage, INVITATION_STATUSES, invitationTone } from '../hooks/useInvitationsPage'
import type { InvitationStatus } from '../types'

/** SCR-14 / D26: one bounded server page, whole-farm counts, no polling or writes on read. */
export default function InvitationsPage() {
  const { navigate, farmId, m, openModal, closeModal, owner, selectedStatus, dir, page, data, loadError, error, notice, setNotice, busy, confirmCancel, confirmError, refresh, changeList, openCancel, closeCancel, run } = useInvitationsPage()

  if (!owner) return <Layout title="Lời mời thành viên"><ErrorBlock variant="panel" message="Bạn không có quyền xem lời mời của trại này." /></Layout>
  if (loadError) return <Layout title="Lời mời thành viên"><ErrorBlock variant="panel" message={userFacingError(loadError, 'Không thể tải danh sách lời mời. Vui lòng thử lại.')} onRetry={refresh} /></Layout>
  if (!data) return <Layout title="Lời mời thành viên"><LoadingBlock variant="panel" /></Layout>
  const { farm, invitations } = data
  const farmActive = farm.serviceStatus === 'ACTIVE'
  const pageCount = Math.max(1, Math.ceil(invitations.total / invitations.size))
  return (
    <Layout title="Lời mời thành viên">
      <PageHeader title="Lời mời thành viên">
        <Button size="bento" onClick={() => navigate(`/thanh-vien?farmId=${farmId}`)}>Thành viên & vai trò</Button>
        <Button size="bento" onClick={refresh} disabled={busy !== null}>Làm mới</Button>
        <Button variant="primary" size="bento" onClick={() => openModal('invite')} disabled={!farmActive || busy !== null}><Icon name="user-plus" size={16} className="mr-1.5" />Mời thành viên</Button>
      </PageHeader>
      {error && <Note tone="err">{error}</Note>}{notice && <Note tone="ok">{notice}</Note>}
      {!farmActive && <Note>Dịch vụ trại hiện không hoạt động. Bạn vẫn có thể xem và hủy lời mời đang chờ.</Note>}
      <div><Segmented className="w-full [&>button]:min-h-11 [&>button]:flex-1 [&>button]:whitespace-normal [&>button]:px-2" value={selectedStatus} onChange={status => changeList(status as InvitationStatus, dir)} options={INVITATION_STATUSES.map(status => ({ value: status, label: `${inviteStatusLabel(status)} (${invitations.counts[status]})`, disabled: busy !== null }))} /></div>
      {/* The empty state stays outside the table: phones stack table cells as labelled cards (Table III-1). */}
      {invitations.items.length === 0 ? (
        <EmptyBlock variant="panel" title="Không có bản ghi phù hợp với bộ lọc." action={<Button size="bento" onClick={() => { changeList('PENDING', 'desc'); refresh() }}>Xóa bộ lọc</Button>} />
      ) : <Table variant="panel">
        <thead><tr><Th>Người nhận</Th><Th>Vai trò</Th><Th aria-sort={dir === 'desc' ? 'descending' : 'ascending'}><button type="button" disabled={busy !== null} className="inline-flex min-h-6 cursor-pointer items-center gap-1" onClick={() => changeList(selectedStatus, dir === 'desc' ? 'asc' : 'desc')}>Gửi lần cuối <span aria-hidden="true">{dir === 'desc' ? '↓' : '↑'}</span></button></Th><Th>Hết hạn</Th><Th>Trạng thái</Th><Th>Thao tác</Th></tr></thead>
        <tbody>
          {invitations.items.map(item => (
            <tr key={item.id}>
              <Td><div className="min-w-0 text-right @min-[640px]:text-left"><strong className="block text-xs font-medium">{item.email}</strong><span className="text-[11px] text-muted">{item.accountHint === 'HAS_ACCOUNT' ? 'Đã có tài khoản' : item.accountHint === 'NO_ACCOUNT' ? 'Chưa có tài khoản' : 'Chưa có thông tin tài khoản'}</span></div></Td>
              <Td>{roleLabel(item.role)}</Td><Td>{formatDateTime(item.lastSentAt, farm.timeZone)}</Td><Td>{formatDateTime(item.expiresAt, farm.timeZone)}</Td>
              <Td><Badge tone={invitationTone(item.status)}>{inviteStatusLabel(item.status)}</Badge></Td>
              <Td>{item.status === 'PENDING' && <span className="inline-flex flex-wrap items-center"><Button variant="link" size="sm" className="min-h-11 @min-[640px]:min-h-8" disabled={busy !== null || !farmActive} onClick={() => run(item, 'resend')}>Gửi lại</Button>·<Button variant="link" size="sm" className="min-h-11 @min-[640px]:min-h-8" disabled={busy !== null} onClick={() => openCancel(item)}>Hủy</Button></span>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>}
      <Pagination page={page + 1} pageCount={pageCount} onChange={next => { if (busy === null) changeList(selectedStatus, dir, next - 1) }} summary={invitations.total ? `Hiển thị ${page * invitations.size + 1}–${Math.min((page + 1) * invitations.size, invitations.total)} trong ${invitations.total} lời mời` : '0 lời mời'} />
      <Foot>Chỉ lời mời đang chờ, chưa hết hạn mới được gửi lại hoặc hủy. Cập nhật lúc {formatDateTime(invitations.asOf, farm.timeZone)}.</Foot>
      {confirmCancel && (
        // MSG-FE03-06 is a confirmation dialog (SRS V.2, D27): centred whichever row was chosen; it keeps the version seen when opened.
        <Modal title="Hủy lời mời" width={560} onClose={closeCancel}>
          <p className="m-0 text-sm text-ink">Hủy lời mời gửi {confirmCancel.email}? Link sẽ không còn tác dụng.</p>
          {confirmError && <Note tone="err">{confirmError}</Note>}
          <ModalFooter>
            <Button size="lg" disabled={busy !== null} onClick={closeCancel}>Quay lại</Button>
            <Button size="lg" variant="danger" disabled={busy !== null} onClick={() => run(confirmCancel, 'cancel')}>{busy !== null ? 'Đang hủy…' : 'Hủy lời mời'}</Button>
          </ModalFooter>
        </Modal>
      )}
      {m === 'invite' && <InviteDialog farmId={farmId} farmName={farm.name} timeZone={farm.timeZone} active={farmActive} onClose={closeModal} onSent={message => { setNotice(message); closeModal(); refresh() }} />}
    </Layout>
  )
}
