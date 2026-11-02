import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Button, Card, ErrorBlock, Foot, LoadingBlock, Note, PageHeader, Segmented } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { InviteDialog } from '../components/InviteDialog'
import { MemberChangeDialog } from '../components/MemberChangeDialog'
import { MemberTable } from '../components/MemberTable'
import { PermissionChecklist } from '../components/PermissionChecklist'
import { useFarmId } from '../components/useFarmId'
import type { ChangeMemberInput } from '../types'

type Filter = 'ALL' | 'MANAGER' | 'TECHNICIAN' | 'INACTIVE'

/** SCR-13: Chủ trại quản lý thành viên; Quản lý chỉ xem danh sách (không thao tác, lời mời, tab ngừng hoạt động). */
export default function MembersPage() {
  const navigate = useNavigate()
  const session = useSession()
  const farmId = useFarmId()
  const [search, setSearch] = useSearchParams()
  const [m, openModal, closeModal] = useModalParam()
  const query = useQuery(async () => {
    const [farm, members] = await Promise.all([farmWorkspaceApi.getFarm(farmId), farmWorkspaceApi.listMembers(farmId)])
    return { farm, members }
  }, [farmId])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [permissionRole, setPermissionRole] = useState<'MANAGER' | 'TECHNICIAN'>('MANAGER')
  const [notice, setNotice] = useState<string | null>(null)
  const farm = query.data?.farm
  const owner = (session?.role ?? farm?.role) === 'OWNER'
  const farmActive = farm?.serviceStatus === 'ACTIVE'
  const members = useMemo(() => (query.data?.members ?? []).filter((member) => owner || member.status === 'ACTIVE'), [query.data, owner])
  const counts = useMemo(() => ({
    ALL: members.length, MANAGER: members.filter((member) => member.role === 'MANAGER').length,
    TECHNICIAN: members.filter((member) => member.role === 'TECHNICIAN').length, INACTIVE: members.filter((member) => member.status === 'INACTIVE').length,
  }), [members])
  const visible = members.filter((member) => filter === 'ALL' ? true : filter === 'INACTIVE' ? member.status === 'INACTIVE' : member.role === filter)

  const selected = m === 'doi-vai-tro' ? members.find((member) => member.id === Number(search.get('id'))) : undefined
  const openChange = (id: number, action: ChangeMemberInput['action']) => { const next = new URLSearchParams(search); next.set('m', 'doi-vai-tro'); next.set('id', String(id)); next.set('a', action); setSearch(next) }
  const closeChange = () => { const next = new URLSearchParams(search); ['m', 'id', 'a'].forEach((key) => next.delete(key)); setSearch(next) }
  const done = (message: string) => { setNotice(message); closeChange(); void query.refetch() }

  if (query.loading && !query.data) return <Layout title="Thành viên & quyền"><LoadingBlock /></Layout>
  if (query.error || !query.data) return <Layout title="Thành viên & quyền"><ErrorBlock message={userFacingError(query.error, 'Không tải được thành viên hoặc bạn không có quyền xem trang này.')} onRetry={query.refetch} /></Layout>

  return (
    <Layout title="Thành viên & quyền">
      <PageHeader title="Thành viên & vai trò">
        {owner && <>
          <Button onClick={() => navigate(`/loi-moi?farmId=${farmId}`)}>Lời mời</Button>
          <Button variant="primary" onClick={() => openModal('invite')} disabled={!farmActive}><Icon name="user-plus" size={16} className="mr-1.5" />Mời thành viên</Button>
        </>}
      </PageHeader>
      {notice && <Note tone="ok">{notice}</Note>}
      {!owner && <Note>Chế độ xem chỉ đọc. Chỉ Chủ trại được gửi lời mời hoặc thay đổi vai trò, trạng thái thành viên.</Note>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_376px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div><Segmented value={filter} onChange={(value) => setFilter(value as Filter)} options={[
            { value: 'ALL', label: `Tất cả (${counts.ALL})` }, { value: 'MANAGER', label: `Quản lý (${counts.MANAGER})` },
            { value: 'TECHNICIAN', label: `Kỹ thuật viên (${counts.TECHNICIAN})` }, ...(owner ? [{ value: 'INACTIVE', label: `Ngừng hoạt động (${counts.INACTIVE})` }] : []),
          ]} /></div>
          <MemberTable members={visible} owner={owner} farmActive={farmActive} onChange={(member, action) => openChange(member.id, action)} />
        </div>
        <Card title="Quyền theo vai trò">
          <Segmented value={permissionRole} onChange={(value) => setPermissionRole(value as 'MANAGER' | 'TECHNICIAN')} options={[{ value: 'MANAGER', label: 'Quản lý' }, { value: 'TECHNICIAN', label: 'Kỹ thuật viên' }]} />
          <PermissionChecklist role={permissionRole} />
        </Card>
      </div>
      <Foot>Owner quản lý lời mời và vai trò; Manager chỉ xem. Bộ lọc tách người theo vai trò/trạng thái, còn bảng cho biết tên, Thư điện tử, ngày tham gia và thao tác được phép.</Foot>
      {m === 'invite' && owner && <InviteDialog farmId={farmId} farmName={farm?.name} active={farmActive} onClose={closeModal} onSent={(message) => { setNotice(message); closeModal(); void query.refetch() }} />}
      {selected && owner && <MemberChangeDialog farmId={farmId} member={selected} initialAction={(search.get('a') as ChangeMemberInput['action'] | null) ?? undefined} active={farmActive} onClose={closeChange} onDone={done} />}
    </Layout>
  )
}
