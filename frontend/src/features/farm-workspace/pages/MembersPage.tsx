import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Button, Card, ErrorBlock, Foot, LoadingBlock, Note, PageHeader, Pagination, Segmented } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { InviteDialog } from '../components/InviteDialog'
import { MemberChangeDialog } from '../components/MemberChangeDialog'
import { MemberTable } from '../components/MemberTable'
import { PermissionTable } from '../components/PermissionChecklist'
import { useFarmId } from '../components/useFarmId'
import { compareMembers } from '../domain/members'
import type { FarmRole, MemberAction, Membership } from '../types'

type Tab = 'ALL' | 'MANAGER' | 'TECHNICIAN' | 'INACTIVE'
type Direction = 'asc' | 'desc'
interface Preferences { tab: Tab; dir: Direction }
const PAGE_SIZE = 20
const DEFAULTS: Preferences = { tab: 'ALL', dir: 'asc' }
const TITLE = 'Thành viên & vai trò'

/** Tab and name order are kept per account and farm while the session lasts (Table III-1, D29). */
function readPreferences(key: string, owner: boolean): Preferences {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? '{}')
    const tabs: Tab[] = owner ? ['ALL', 'MANAGER', 'TECHNICIAN', 'INACTIVE'] : ['ALL', 'MANAGER', 'TECHNICIAN']
    return { tab: tabs.includes(saved?.tab) ? saved.tab : 'ALL', dir: saved?.dir === 'desc' ? 'desc' : 'asc' }
  } catch { return DEFAULTS }
}

/** D29 Q3: Managers / Technicians show ACTIVE members of that role; Inactive shows INACTIVE members of both roles. */
const inTab = (tab: Tab) => (member: Membership) =>
  tab === 'ALL' ? true : tab === 'INACTIVE' ? member.status === 'INACTIVE' : member.status === 'ACTIVE' && member.role === tab

/**
 * SCR-13 / UC-FE03-05 (D29): the Owner sees every member and the actions available now, in every service status; a
 * Manager sees the ACTIVE members read-only. Rows, counts and actions come from A1; the page only filters, orders by
 * name and splits into pages of 20.
 */
export default function MembersPage() {
  const navigate = useNavigate()
  const session = useSession()
  const farmId = useFarmId()
  const [search, setSearch] = useSearchParams()
  const [m, openModal, closeModal] = useModalParam()
  // Outside a SessionProvider (route smoke, page tests) no role rule applies, as for RoleGate; A1 still decides the rows.
  const viewer: FarmRole = session?.role === 'MANAGER' || session?.role === 'TECHNICIAN' ? session.role : 'OWNER'
  const owner = viewer === 'OWNER'
  const preferencesKey = `beefcare:member-filters:${session?.email ?? ''}:${farmId}`
  const saved = useMemo(() => readPreferences(preferencesKey, owner), [preferencesKey, owner])
  const [preferences, setPreferences] = useState<Preferences & { key: string }>({ ...saved, key: preferencesKey })
  const current = preferences.key === preferencesKey ? preferences : { ...saved, key: preferencesKey }
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const query = useQuery(async () => ({ farmId, list: await farmWorkspaceApi.listMembers(farmId, viewer) }), [farmId, viewer])
  // A response for another farm must never be shown while the new farm loads.
  const list = query.data?.farmId === farmId ? query.data.list : undefined

  useEffect(() => {
    try { sessionStorage.setItem(preferencesKey, JSON.stringify({ tab: current.tab, dir: current.dir })) } catch { /* Preferences are optional when browser storage is unavailable. */ }
  }, [preferencesKey, current.tab, current.dir])

  const choose = (next: Partial<Preferences>) => { setPreferences({ ...current, ...next, key: preferencesKey }); setPage(1) }
  const rows = useMemo(() => (list?.items ?? []).filter(inTab(current.tab))
    .sort((a, b) => current.dir === 'asc' ? compareMembers(a, b) : compareMembers(b, a)), [list, current.tab, current.dir])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  // After a refresh the current page may no longer exist (members left the tab): show the last one that does.
  const shownPage = Math.min(page, pageCount)
  const pageRows = rows.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE)

  const selected = m === 'doi-vai-tro' ? list?.items.find((member) => member.id === Number(search.get('id'))) : undefined
  const openChange = (id: number, action: MemberAction) => { const next = new URLSearchParams(search); next.set('m', 'doi-vai-tro'); next.set('id', String(id)); next.set('a', action); setSearch(next) }
  const closeChange = () => { const next = new URLSearchParams(search); ['m', 'id', 'a'].forEach((key) => next.delete(key)); setSearch(next) }
  const refresh = () => { setNotice(null); query.refetch() }
  const done = (message: string) => { setNotice(message); closeChange(); query.refetch() }

  if (query.error) return <Layout title={TITLE}><ErrorBlock message={userFacingError(query.error, 'Không tải được danh sách thành viên. Vui lòng thử lại.')} onRetry={query.refetch} /></Layout>
  if (!list) return <Layout title={TITLE}><LoadingBlock /></Layout>
  const farmActive = list.serviceStatus === 'ACTIVE'
  const tabs = [
    { value: 'ALL', label: `Tất cả (${list.counts.all})` },
    { value: 'MANAGER', label: `Quản lý (${list.counts.managers})` },
    { value: 'TECHNICIAN', label: `Kỹ thuật viên (${list.counts.technicians})` },
    ...(owner ? [{ value: 'INACTIVE', label: `Đã ngưng (${list.counts.inactive ?? 0})` }] : []),
  ]

  return (
    <Layout title={TITLE}>
      <PageHeader title={TITLE}>
        <Button onClick={refresh} disabled={query.loading}>Làm mới</Button>
        {owner && <>
          <Button onClick={() => navigate(`/loi-moi?farmId=${farmId}`)}>Lời mời</Button>
          <Button variant="primary" onClick={() => openModal('invite')} disabled={!farmActive}><Icon name="user-plus" size={16} className="mr-1.5" />Mời thành viên</Button>
        </>}
      </PageHeader>
      {notice && <Note tone="ok">{notice}</Note>}
      {owner && !farmActive && <Note>Dịch vụ trại hiện không hoạt động. Bạn vẫn có thể xem và ngưng thành viên; mời, đổi vai trò và kích hoạt lại cần trại đang hoạt động (ACTIVE).</Note>}
      {!owner && <Note>Chế độ xem chỉ đọc. Chỉ Chủ trại được gửi lời mời hoặc thay đổi vai trò, trạng thái thành viên.</Note>}
      <div><Segmented value={current.tab} onChange={(value) => choose({ tab: value as Tab })} options={tabs} /></div>
      <MemberTable
        members={pageRows} owner={owner} timeZone={list.timeZone} dir={current.dir}
        onSort={() => choose({ dir: current.dir === 'asc' ? 'desc' : 'asc' })}
        onChange={(member, action) => openChange(member.id, action)}
        empty={<><p>Không có bản ghi phù hợp với bộ lọc.</p><Button onClick={() => choose(DEFAULTS)}>Xóa bộ lọc</Button></>}
      />
      <Pagination page={shownPage} pageCount={pageCount} onChange={setPage}
        summary={rows.length ? `Hiển thị ${(shownPage - 1) * PAGE_SIZE + 1}–${Math.min(shownPage * PAGE_SIZE, rows.length)} trong ${rows.length} thành viên` : '0 thành viên'} />
      <Card title="Quyền theo vai trò"><PermissionTable /></Card>
      <Foot>Mỗi vai trò có bộ quyền cố định, không cấp quyền riêng cho từng người (GBR-06). Thay đổi vai trò hoặc trạng thái áp dụng từ thao tác kế tiếp của thành viên.</Foot>
      {m === 'invite' && owner && <InviteDialog farmId={farmId} farmName={list.farmName} timeZone={list.timeZone} active={farmActive} onClose={closeModal} onSent={(message) => { setNotice(message); closeModal(); query.refetch() }} />}
      {selected && owner && <MemberChangeDialog farmId={farmId} member={selected} initialAction={(search.get('a') as MemberAction | null) ?? undefined} active={farmActive} onClose={closeChange} onDone={done} />}
    </Layout>
  )
}
