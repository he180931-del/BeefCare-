import { DEFAULTS, PAGE_SIZE, useMembersPage, type MemberTab } from '../hooks/useMembersPage'
import { userFacingError } from '../../../shared/api/userFacingError'
import { Button, Card, EmptyBlock, ErrorBlock, Foot, Icon, LoadingBlock, Note, PageHeader, Pagination, Segmented } from '../../../shared/ui'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { InviteDialog } from '../components/InviteDialog'
import { MemberChangeDialog } from '../components/MemberChangeDialog'
import { MemberTable } from '../components/MemberTable'
import { PermissionTable } from '../components/PermissionChecklist'
import type { MemberAction } from '../types'

const TITLE = 'Thành viên & vai trò'

/**
 * SCR-13 / UC-FE03-05 (D29): the Owner sees every member and the actions available now, in every service status; a
 * Manager sees the ACTIVE members read-only. Rows, counts and actions come from A1; the page only filters, orders by
 * name and splits into pages of 20.
 */
export default function MembersPage() {
  const { navigate, farmId, m, openModal, closeModal, owner, query, list, current, choose, pageRows, rows, shownPage, pageCount, setPage, search, selected, openChange, closeChange, refresh, done, stale, notice, failure, setNotice } = useMembersPage()

  if (query.error) return <Layout title={TITLE}><ErrorBlock variant="panel" message={userFacingError(query.error, 'Không tải được danh sách thành viên. Vui lòng thử lại.')} onRetry={query.refetch} /></Layout>
  if (!list) return <Layout title={TITLE}><LoadingBlock variant="panel" /></Layout>
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
        <Button size="bento" onClick={refresh} disabled={query.loading}>Làm mới</Button>
        {owner && <>
          <Button size="bento" onClick={() => navigate(`/loi-moi?farmId=${farmId}`)}>Lời mời</Button>
          <Button variant="primary" size="bento" onClick={() => openModal('invite')} disabled={!farmActive}><Icon name="user-plus" size={16} className="mr-1.5" />Mời thành viên</Button>
        </>}
      </PageHeader>
      {failure && <Note tone="err">{failure}</Note>}
      {notice && <Note tone="ok">{notice}</Note>}
      {owner && !farmActive && <Note>Dịch vụ trại hiện không hoạt động. Bạn vẫn có thể xem và ngưng thành viên; mời, đổi vai trò và kích hoạt lại cần trại đang hoạt động (ACTIVE).</Note>}
      {!owner && <Note>Chế độ xem chỉ đọc. Chỉ Chủ trại được gửi lời mời hoặc thay đổi vai trò, trạng thái thành viên.</Note>}
      <div className="grid grid-cols-4 items-start gap-4 @min-[640px]:grid-cols-8 @min-[1024px]:grid-cols-12 @min-[1024px]:gap-6">
        <div className="col-span-full min-w-0 @min-[880px]:col-span-5 @min-[1024px]:col-span-8 flex flex-col gap-4">
          <Segmented className="w-full [&>button]:min-h-11 [&>button]:flex-1 [&>button]:whitespace-normal [&>button]:px-2" value={current.tab} onChange={(value) => choose({ tab: value as MemberTab })} options={tabs} />
          <MemberTable
            members={pageRows} owner={owner} timeZone={list.timeZone} dir={current.dir}
            onSort={() => choose({ dir: current.dir === 'asc' ? 'desc' : 'asc' })}
            onChange={(member, action) => openChange(member.id, action)}
            empty={<EmptyBlock variant="panel" title="Không có bản ghi phù hợp với bộ lọc." action={<Button size="bento" onClick={() => choose(DEFAULTS)}>Xóa bộ lọc</Button>} />}
          />
          <Pagination page={shownPage} pageCount={pageCount} onChange={setPage}
            summary={rows.length ? `Hiển thị ${(shownPage - 1) * PAGE_SIZE + 1}–${Math.min(shownPage * PAGE_SIZE, rows.length)} trong ${rows.length} thành viên` : '0 thành viên'} />
        </div>
        <div className="col-span-full min-w-0 @min-[880px]:col-span-3 @min-[1024px]:col-span-4"><Card variant="panel" title="Quyền theo vai trò"><PermissionTable /></Card></div>
      </div>
      <Foot>Mỗi vai trò có bộ quyền cố định, không cấp quyền riêng cho từng người (GBR-06). Thay đổi vai trò hoặc trạng thái áp dụng từ thao tác kế tiếp của thành viên.</Foot>
      {m === 'invite' && owner && <InviteDialog farmId={farmId} farmName={list.farmName} timeZone={list.timeZone} active={farmActive} onClose={closeModal} onSent={(message) => { setNotice(message); closeModal(); query.refetch() }} />}
      {selected && owner && <MemberChangeDialog farmId={farmId} farmName={list.farmName} timeZone={list.timeZone} member={selected} initialAction={(search.get('a') as MemberAction | null) ?? undefined} active={farmActive} onClose={closeChange} onDone={done} onStale={stale} />}
    </Layout>
  )
}
