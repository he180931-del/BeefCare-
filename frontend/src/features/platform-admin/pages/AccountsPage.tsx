import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import { Button, Card, EmptyBlock, ErrorBlock, FilterSelect, Foot, LoadingBlock, PageHeader, Pagination, SearchInput, Table, Td, Th } from '../../../shared/ui'
import { useQuery } from '../../../shared/hooks/useQuery'
import { useDemoState } from '../../../hooks/useDemoState'
import { useSession } from '../../authorization'
import { platformAdminApi } from '../api/platformAdminApi'
import AccountDetailPanel from '../components/AccountDetailPanel'
import { AccountStatusBadge, PersonCell, SaPage, Toast, restPathId, searchWithoutModal, wideScreen } from '../components/common'
import { farmsJoinedText, platformRoleText, revokedRoleNote } from '../domain/platformRules'
import type { AccountFilters, AccountListItem, SortDir } from '../types'

const PAGE_SIZE = 20
const TITLE = 'Tài khoản người dùng'

type Filters = { q: string; status: NonNullable<AccountFilters['status']>; role: '' | 'NONE' | 'CS' | 'PM' | 'SA'; dir: SortDir }
const DEFAULTS: Filters = { q: '', status: '', role: '', dir: 'asc' }

/** Bộ lọc và chiều sắp xếp được giữ theo tài khoản SA trong phiên (Table III-1, D31). */
function readFilters(key: string): Filters {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? '{}')
    return {
      q: typeof saved?.q === 'string' ? saved.q : '',
      status: saved?.status === 'ACTIVE' || saved?.status === 'SUSPENDED' ? saved.status : '',
      role: ['NONE', 'CS', 'PM', 'SA'].includes(saved?.role) ? saved.role : '',
      dir: saved?.dir === 'desc' ? 'desc' : 'asc',
    }
  } catch { return DEFAULTS }
}

const displayName = (a: AccountListItem) => a.fullName.trim() || 'Chưa có tên'

/**
 * SCR-16 / UC-FE03-07 (D31): SA tìm, lọc theo trạng thái và vai trò nền tảng đang ACTIVE, sắp xếp theo tên; mỗi trang
 * 20 dòng từ A9. Khung phải đọc chi tiết bằng A10 theo id trên URL (mở link thẳng hoặc tải lại vẫn đúng tài khoản).
 */
function AccountsContent() {
  const demo = useDemoState()
  const navigate = useNavigate()
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const selectedId = restPathId(useParams()['*'])
  const storageKey = `beefcare:platform-accounts:${session?.email ?? ''}`
  // Ô tìm kiếm trên thanh trên gửi ?q= tới trang này: dùng làm nội dung tìm kiếm, thay cho bộ lọc đã nhớ.
  const qParam = params.get('q')
  const [filters, setFilters] = useState<Filters>(() => ({ ...readFilters(storageKey), ...(qParam != null ? { q: qParam } : {}) }))
  useEffect(() => { if (qParam != null) setFilters((current) => ({ ...current, q: qParam })) }, [qParam])
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(filters)) } catch { /* Bộ lọc chỉ là tiện ích khi trình duyệt không cho lưu. */ }
  }, [storageKey, filters])

  const list = useQuery(
    () => (demo === 'load-error'
      ? Promise.reject(new Error('Không tải được danh sách tài khoản.'))
      : platformAdminApi.listAccounts({ q: filters.q, status: filters.status, platformRole: filters.role, dir: filters.dir, page, size: PAGE_SIZE })),
    [filters.q, filters.status, filters.role, filters.dir, page, demo],
  )
  const rows = useMemo(() => list.data?.content ?? [], [list.data])
  // Không có id trên URL: chọn dòng đầu của trang như Figma.
  const detailId = selectedId ?? rows[0]?.id ?? null
  const detail = useQuery(() => (detailId ? platformAdminApi.getAccount(detailId) : Promise.resolve(null)), [detailId])
  // Không bao giờ hiện chi tiết của tài khoản khác trong lúc tài khoản mới đang tải.
  const account = detail.data && detail.data.id === detailId ? detail.data : null
  // Dưới xl khung chi tiết nằm dưới danh sách: khi SA chọn một dòng và tài khoản đã tải xong thì cuộn tới (như SCR-51).
  const detailBox = useRef<HTMLDivElement>(null)
  const revealed = useRef<number | null>(null)
  useEffect(() => {
    if (selectedId == null || account?.id !== selectedId || revealed.current === selectedId) return
    revealed.current = selectedId
    if (!wideScreen()) detailBox.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [selectedId, account?.id])

  const choose = (next: Partial<Filters>) => { setFilters((current) => ({ ...current, ...next })); setPage(1) }
  const clearFilters = () => {
    choose(DEFAULTS)
    if (params.has('q')) { const next = new URLSearchParams(params); next.delete('q'); setParams(next, { replace: true }) }
  }
  const refresh = () => { list.refetch(); if (detailId) detail.refetch() }
  const select = (a: AccountListItem) => navigate({ pathname: `/nen-tang/tai-khoan/${a.id}`, search: searchWithoutModal(params) })

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={TITLE} sub="Tài khoản toàn cục của người dùng BeefCare (Google hoặc email và mật khẩu). Tạm ngưng tài khoản tách biệt với trạng thái dịch vụ của trại.">
        <Button onClick={refresh} disabled={list.loading}>Làm mới</Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-[300px] max-w-full">
          <SearchInput value={filters.q} maxLength={100} placeholder="Tên, email…" aria-label="Tìm tài khoản theo tên hoặc email" onChange={(e) => choose({ q: e.target.value })} />
        </div>
        <FilterSelect size="lg" className="w-[210px] max-w-full" aria-label="Lọc theo trạng thái" value={filters.status} onChange={(e) => choose({ status: e.target.value as Filters['status'] })}>
          <option value="">Trạng thái: Tất cả</option>
          <option value="ACTIVE">Trạng thái: Đang hoạt động</option>
          <option value="SUSPENDED">Trạng thái: Tạm ngưng</option>
        </FilterSelect>
        <FilterSelect size="lg" className="w-[230px] max-w-full" aria-label="Lọc theo vai trò nền tảng" value={filters.role} onChange={(e) => choose({ role: e.target.value as Filters['role'] })}>
          <option value="">Vai trò nền tảng: Tất cả</option>
          <option value="NONE">Vai trò nền tảng: Không có</option>
          <option value="CS">Vai trò nền tảng: Nhân viên hỗ trợ (CS)</option>
          <option value="PM">Vai trò nền tảng: Quản lý nền tảng (PM)</option>
          <option value="SA">Vai trò nền tảng: Quản trị hệ thống (SA)</option>
        </FilterSelect>
      </div>

      {list.loading && !list.data && <LoadingBlock />}
      {list.error != null && <ErrorBlock message={userFacingError(list.error, 'Không tải được danh sách tài khoản.')} onRetry={list.refetch} />}
      {list.data && list.error == null && rows.length === 0 && (
        <EmptyBlock title="Không có bản ghi phù hợp với bộ lọc." action={<Button onClick={clearFilters}>Xóa bộ lọc</Button>} />
      )}
      {list.data && list.error == null && rows.length > 0 && (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_396px]">
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th aria-sort={filters.dir === 'asc' ? 'ascending' : 'descending'}>
                    <button type="button" className="inline-flex min-h-6 cursor-pointer items-center gap-1" onClick={() => choose({ dir: filters.dir === 'asc' ? 'desc' : 'asc' })}>
                      Người dùng <span aria-hidden="true">{filters.dir === 'asc' ? '↑' : '↓'}</span>
                    </button>
                  </Th>
                  <Th>Vai trò nền tảng</Th><Th>Trại tham gia</Th><Th>Trạng thái</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const active = a.id === detailId
                  const revoked = revokedRoleNote(a)
                  return (
                    <tr key={a.id} onClick={() => select(a)} className={`cursor-pointer ${active ? 'bg-[#eef4ef]' : ''}`}>
                      <Td>
                        <button type="button" aria-current={active ? 'true' : undefined} onClick={(e) => { e.stopPropagation(); select(a) }} className="min-w-0 max-w-full text-left">
                          <PersonCell name={displayName(a)} sub={a.email} />
                        </button>
                      </Td>
                      <Td>
                        {platformRoleText(a)}
                        {revoked && <span className="block text-[11px] text-muted">{revoked}</span>}
                      </Td>
                      <Td>{farmsJoinedText(a)}</Td>
                      <Td><AccountStatusBadge status={a.accountStatus} /></Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={list.data.totalPages} onChange={setPage} summary={`Hiển thị ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + rows.length} trong ${list.data.totalElements} tài khoản`} />
          </Card>
          <div ref={detailBox} className="min-w-0 scroll-mt-4">
            {account ? (
              <AccountDetailPanel
                key={account.id}
                account={account}
                onReload={refresh}
                onChanged={(message) => { setToast(message); refresh() }}
              />
            ) : detail.error != null ? (
              <ErrorBlock message={userFacingError(detail.error, 'Không tải được tài khoản.')} onRetry={detail.refetch} />
            ) : <LoadingBlock />}
          </div>
        </div>
      )}
      <Foot>Tài khoản người dùng (quản trị hệ thống). Chọn một dòng để xem chi tiết tài khoản; tạm ngưng hoặc khôi phục bắt buộc nhập lý do và được ghi vào lịch sử kiểm toán. Tạm ngưng tài khoản không đổi trạng thái dịch vụ của trại.</Foot>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}

export default function AccountsPage() {
  return <SaPage title={TITLE}><AccountsContent /></SaPage>
}
