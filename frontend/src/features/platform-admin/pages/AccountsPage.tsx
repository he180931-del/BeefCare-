import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Card, EmptyBlock, ErrorBlock, FilterSelect, Foot, LoadingBlock, PageHeader, Pagination, SearchInput, Table, Td, Th } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useDemoState } from '../../../hooks/useDemoState'
import { platformAdminApi } from '../api/platformAdminApi'
import AccountDetailPanel from '../components/AccountDetailPanel'
import { AccountStatusBadge, PersonCell, SaPage, Toast, restPathId, searchWithoutModal } from '../components/common'
import { farmsJoinedText } from '../domain/platformRules'
import type { AccountFilters, AccountSummary } from '../types'

const PAGE_SIZE = 8
const TITLE = 'Tài khoản người dùng'

function AccountsContent() {
  const demo = useDemoState()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const selectedId = restPathId(useParams()['*'])
  // Ô tìm kiếm trên thanh trên gửi ?q= tới trang này: dùng làm nội dung tìm kiếm ban đầu.
  const qParam = params.get('q') ?? ''
  const [q, setQ] = useState(qParam)
  useEffect(() => { setQ(qParam) }, [qParam])
  const [status, setStatus] = useState<NonNullable<AccountFilters['status']>>('')
  const [role, setRole] = useState<NonNullable<AccountFilters['platformRole']>>('')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  const { data, loading, error, refetch } = useQuery(
    () => (demo === 'load-error'
      ? Promise.reject(new Error('Không tải được danh sách tài khoản.'))
      : platformAdminApi.listAccounts({ q, status, platformRole: role, page, size: PAGE_SIZE })),
    [q, status, role, page, demo],
  )

  const select = (a: AccountSummary) =>
    navigate({ pathname: `/nen-tang/tai-khoan/${a.id}`, search: searchWithoutModal(params) })
  const selected = data ? (data.content.find((a) => a.id === selectedId) ?? data.content[0]) : undefined
  const filterChange = (apply: () => void) => { apply(); setPage(1) }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={TITLE} sub="Tài khoản toàn cục đăng nhập bằng Google. Tạm khóa tài khoản tách biệt với trạng thái dịch vụ trại." />
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-[300px] max-w-full">
          <SearchInput value={q} placeholder="Tên, Gmail…" aria-label="Tìm tài khoản theo tên hoặc Gmail" onChange={(e) => filterChange(() => setQ(e.target.value))} />
        </div>
        <FilterSelect className="w-[210px] max-w-full" aria-label="Lọc theo trạng thái" value={status} onChange={(e) => filterChange(() => setStatus(e.target.value as typeof status))}>
          <option value="">Trạng thái: Tất cả</option>
          <option value="ACTIVE">Trạng thái: Đang hoạt động</option>
          <option value="SUSPENDED">Trạng thái: Tạm khóa</option>
        </FilterSelect>
        <FilterSelect className="w-[230px] max-w-full" aria-label="Lọc theo vai trò nền tảng" value={role} onChange={(e) => filterChange(() => setRole(e.target.value as typeof role))}>
          <option value="">Vai trò nền tảng: Tất cả</option>
          <option value="NONE">Vai trò nền tảng: Chưa có</option>
          <option value="CS">Vai trò nền tảng: CS</option>
          <option value="PM">Vai trò nền tảng: PM</option>
          <option value="SA">Vai trò nền tảng: SA</option>
        </FilterSelect>
      </div>

      {loading && !data && <LoadingBlock />}
      {error != null && <ErrorBlock message={userFacingError(error, 'Không tải được danh sách tài khoản.')} onRetry={refetch} />}
      {data && !error && data.content.length === 0 && <EmptyBlock title="Không có tài khoản phù hợp" sub="Thử đổi từ khóa hoặc bỏ bớt bộ lọc." />}
      {data && !error && selected && (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_396px]">
          <Card>
            <Table>
              <thead>
                <tr><Th>Người dùng</Th><Th>Vai trò nền tảng</Th><Th>Trại tham gia</Th><Th>Trạng thái</Th></tr>
              </thead>
              <tbody>
                {data.content.map((a) => {
                  const active = a.id === selected.id
                  return (
                    <tr key={a.id} onClick={() => select(a)} className={`cursor-pointer ${active ? 'bg-[#eef4ef]' : ''}`}>
                      <Td>
                        <button type="button" aria-current={active ? 'true' : undefined} onClick={(e) => { e.stopPropagation(); select(a) }} className="min-w-0 max-w-full text-left">
                          <PersonCell name={a.fullName} sub={a.email} />
                        </button>
                      </Td>
                      <Td>{a.platformRole ? `${a.platformRole}${a.platformAccessStatus === 'REVOKED' ? ' (đã thu hồi)' : ''}` : '—'}</Td>
                      <Td>{farmsJoinedText(a)}</Td>
                      <Td><AccountStatusBadge status={a.accountStatus} /></Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={data.totalPages} onChange={setPage} summary={`Hiển thị ${data.content.length} / ${data.totalElements} tài khoản`} />
          </Card>
          <AccountDetailPanel
            key={selected.id}
            account={selected}
            onReload={refetch}
            onChanged={(message) => { setToast(message); refetch() }}
          />
        </div>
      )}
      <Foot>Tài khoản người dùng (SA). Chọn một dòng để xem chi tiết ở khung phải; tạm khóa hoặc mở khóa bắt buộc nhập lý do và được ghi audit. Tạm khóa tài khoản không đổi trạng thái dịch vụ của trại.</Foot>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}

export default function AccountsPage() {
  return <SaPage title={TITLE}><AccountsContent /></SaPage>
}
