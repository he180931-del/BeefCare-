import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Button, EmptyBlock, ErrorBlock, Foot, Icon, LoadingBlock, PageHeader, Pagination, Segmented } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useDemoState } from '../../../demo/demoModules'
import { LoadErrorDialog, SubmittedDialog } from '../components/ListDialogs'
import { TicketFilterBar } from '../components/TicketFilterBar'
import { TicketTable } from '../components/TicketTable'
import { TICKET_TABS } from '../domain/ticketRules'
import type { TicketFilters, TicketTab } from '../types'
import { useSupportSubmittedTicket, useSupportTickets } from '../hooks/useSupportUseCase'

const TITLE = 'Yêu cầu hỗ trợ của tôi'
const PAGE_SIZE = 50
const INITIAL: TicketFilters = { tab: 'ALL', q: '', category: '', from: '', to: '', page: 1, size: PAGE_SIZE }

/** SCR-64: danh sách ticket của tôi. `?demo=loi` dựng lại frame lỗi tải dữ liệu. */
export default function TicketListPage() {
  const navigate = useNavigate()
  const demo = useDemoState()
  const [params] = useSearchParams()
  const [m, , closeModal] = useModalParam()
  const [filters, setFilters] = useState<TicketFilters>(INITIAL)
  const [errorDismissed, setErrorDismissed] = useState(false)
  const patch = (p: Partial<TicketFilters>) => setFilters((f) => ({ ...f, page: 1, ...p }))

  const { data, loading, error, refetch } = useSupportTickets(filters, demo)

  const submittedId = m === 'da-gui' ? Number(params.get('ticket')) : 0
  const submitted = useSupportSubmittedTicket(submittedId)

  const filtered = !!(filters.q || filters.category || filters.from || filters.to)
  const goNew = () => navigate('/ho-tro/moi')
  const header = (
    <PageHeader title="Yêu cầu của tôi">
      <Button variant="primary" size="bento" onClick={goNew}>
        <Icon name="send" size={16} /> Gửi yêu cầu mới
      </Button>
    </PageHeader>
  )

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock variant="panel" /></Layout>
  if (error || !data) {
    const retry = () => {
      setErrorDismissed(false)
      refetch()
    }
    return (
      <Layout title={TITLE}>
        <div className="flex flex-col gap-4">
          {header}
          <ErrorBlock variant="panel" message={userFacingError(error, 'Không thể tải danh sách yêu cầu lúc này.')} onRetry={retry} />
          {!errorDismissed && <LoadErrorDialog message="Không thể tải danh sách yêu cầu lúc này." onRetry={retry} onClose={() => setErrorDismissed(true)} />}
        </div>
      </Layout>
    )
  }

  const tabs = TICKET_TABS.map((t) => ({ value: t.value, label: `${t.label} (${data.counts[t.value]})` }))
  const pageCount = Math.max(1, Math.ceil(data.total / data.size))

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        {header}
        <TicketFilterBar filters={filters} onChange={patch} />
        <Segmented className="w-full [&>button]:min-h-11 [&>button]:flex-1 [&>button]:whitespace-normal [&>button]:px-2" options={tabs} value={filters.tab ?? 'ALL'} onChange={(tab) => patch({ tab: tab as TicketTab })} />
        {data.items.length === 0 ? (
          <EmptyBlock variant="panel"
            title="Không có yêu cầu phù hợp"
            sub={filtered || filters.tab !== 'ALL' ? 'Bộ lọc hiện tại không có phiếu phù hợp.' : 'Bạn chưa gửi yêu cầu hỗ trợ nào.'}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {(filtered || filters.tab !== 'ALL') && (
                  <Button size="bento" onClick={() => setFilters(INITIAL)}>
                    <Icon name="filter-off" size={16} /> Xóa bộ lọc
                  </Button>
                )}
                <Button variant="primary" size="bento" onClick={goNew}>
                  <Icon name="circle-plus" size={16} /> Tạo yêu cầu mới
                </Button>
              </div>
            }
          />
        ) : (
          <TicketTable items={data.items} />
        )}
        {pageCount > 1 && <Pagination page={data.page} pageCount={pageCount} onChange={(page) => setFilters((f) => ({ ...f, page }))} summary={`${data.total} yêu cầu`} />}
        <Foot>Lọc phiếu theo trạng thái; mỗi dòng cho biết mã phiếu, chủ đề, danh mục, trại, trạng thái và lần cập nhật gần nhất.</Foot>
      </div>
      {m === 'da-gui' && submitted.data && (
        <SubmittedDialog ticket={submitted.data} onClose={closeModal} onList={closeModal} onView={() => navigate(`/ho-tro/${submitted.data!.id}`)} />
      )}
    </Layout>
  )
}
