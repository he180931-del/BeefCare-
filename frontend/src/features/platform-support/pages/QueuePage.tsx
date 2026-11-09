import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Button, Card, ErrorBlock, EmptyBlock, FilterSelect, Foot, LoadingBlock, Metric, Note, PageHeader, Pagination, Segmented, SearchInput, Table, Td, Th } from '../../../components/ui'
import { useDemoState } from '../../../hooks/useDemoState'
import { useQuery } from '../../../hooks/useApi'
import { supportApi } from '../api/supportApi'
import { Avatar, PriorityBadge, StatusBadge, errText, useActor, useFlash } from '../components/common'
import { ReasonDialog } from '../components/ReasonDialog'
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL, SupportError } from '../domain/supportRules'
import type { QueueFilters, QueueTab, TicketCategory, TicketPriority } from '../types'

const TITLE = 'Hàng đợi hỗ trợ'
const PAGE_SIZE = 50

export default function QueuePage({ initialTab = 'all' }: { initialTab?: QueueTab }) {
  const me = useActor()
  const navigate = useNavigate()
  const demo = useDemoState()
  const [filters, setFilters] = useState<QueueFilters>({ tab: initialTab, page: 1, size: PAGE_SIZE })
  const [m, , closeModal] = useModalParam()
  const [params] = useSearchParams()
  const claimCode = params.get('t')
  const [flash, showFlash] = useFlash()
  const { data, loading, error, refetch } = useQuery(() => supportApi.listQueue(me, filters), [filters, me])
  const { data: farms } = useQuery(() => supportApi.listFarms(), [])
  const { data: target } = useQuery(() => (m === 'nhan-lai' && claimCode ? supportApi.getTicket(me, claimCode) : Promise.resolve(null)), [m, claimCode, me])
  const patch = (next: Partial<QueueFilters>) => setFilters((f) => ({ ...f, page: 1, ...next }))

  if (demo === 'load-error') return <Layout title={TITLE}><ErrorBlock message="Không tải được hàng đợi hỗ trợ." onRetry={refetch} /></Layout>
  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={errText(error, 'Không tải được hàng đợi hỗ trợ.')} onRetry={refetch} /></Layout>

  const claim = async (code: string, expectedVersion: number, reason?: string) => {
    try {
      await supportApi.claim(me, code, { reason, expectedVersion })
      navigate(`/nen-tang/ho-tro/${code}`, { state: { flash: `Bạn đang phụ trách ${code}.` } })
    } catch (e) {
      showFlash(errText(e), 'err')
      void refetch()
    }
  }
  const { counts } = data
  const pageCount = Math.max(1, Math.ceil(data.total / data.size))
  const unavailable = data.items.find((t) => t.assignedCsId !== null && !t.assignedAvailable)
  const tabs: Array<{ value: QueueTab; label: string }> = [
    { value: 'all', label: `Tất cả ${counts.all}` }, { value: 'unassigned', label: `Chưa nhận ${counts.unassigned}` },
    { value: 'mine', label: `Của tôi ${counts.mine}` }, { value: 'waiting', label: `Chờ khách ${counts.waiting}` },
    { value: 'resolved', label: `Đã giải quyết ${counts.resolved}` },
  ]

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub="Mọi nhân viên hỗ trợ đều xem được toàn bộ hàng đợi; chỉ nhân viên đang phụ trách mới thao tác trên yêu cầu. Nhân viên hỗ trợ không vào được dữ liệu vận hành trại." />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Chưa có người nhận" value={counts.unassigned} note={`${counts.unassignedHigh} ưu tiên cao`} warn />
          <Metric label="Yêu cầu của tôi" value={counts.mine} note={`${me.name} đang phụ trách`} />
          <Metric label="Chờ khách phản hồi" value={counts.waiting} note="Tự nhắc sau 48 giờ" />
          <Metric label="Đã giải quyết – chờ xác nhận" value={counts.resolved} note="Chủ trại xác nhận để đóng" />
        </div>
        <div className="flex flex-wrap gap-3">
          <SearchInput className="w-[300px] max-w-full" aria-label="Tìm kiếm" placeholder="Tìm tên khách hoặc mã yêu cầu…" value={filters.q ?? ''} onChange={(e) => patch({ q: e.target.value })} />
          <FilterSelect aria-label="Trang trại" value={filters.farm ?? 'all'} onChange={(e) => patch({ farm: e.target.value })}>
            <option value="all">Trang trại: Tất cả</option>
            {(farms ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </FilterSelect>
          <FilterSelect aria-label="Nhân viên hỗ trợ phụ trách" value={filters.assignment ?? 'all'} onChange={(e) => patch({ assignment: e.target.value })}>
            <option value="all">Người phụ trách: Tất cả</option>
            <option value="unassigned">Chưa có người nhận</option>
            <option value="unavailable">Người phụ trách không khả dụng</option>
          </FilterSelect>
          <FilterSelect aria-label="Danh mục" value={filters.category ?? 'all'} onChange={(e) => patch({ category: e.target.value })}>
            <option value="all">Danh mục: Tất cả</option>
            {(Object.keys(CATEGORY_LABEL) as TicketCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </FilterSelect>
          <FilterSelect aria-label="Ưu tiên" value={filters.priority ?? 'all'} onChange={(e) => patch({ priority: e.target.value })}>
            <option value="all">Ưu tiên: Tất cả</option>
            {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </FilterSelect>
        </div>
        <div><Segmented options={tabs} value={filters.tab ?? 'all'} onChange={(v) => patch({ tab: v as QueueTab })} /></div>
        <Card>
          {data.items.length === 0 || demo === 'empty' ? (
            <EmptyBlock title="Không có yêu cầu phù hợp" sub="Thử đổi bộ lọc hoặc tab khác." />
          ) : (
            <Table wide>
              <thead>
                <tr><Th>Yêu cầu</Th><Th>Tiêu đề · người gửi</Th><Th>Danh mục</Th><Th>Ưu tiên</Th><Th>Trạng thái</Th><Th>Phụ trách</Th><Th><span className="sr-only">Thao tác</span></Th></tr>
              </thead>
              <tbody>
                {data.items.map((t) => {
                  const lost = t.assignedCsId !== null && !t.assignedAvailable
                  return (
                    <tr key={t.code}>
                      <Td className="whitespace-nowrap font-semibold text-brand"><Link to={`/nen-tang/ho-tro/${t.code}`}>{t.code}</Link></Td>
                      <Td><div className="font-medium text-ink">{t.subject}</div><div className="text-[11px] text-muted">{t.requester} · {t.farmName}</div></Td>
                      <Td>{CATEGORY_LABEL[t.category]}</Td>
                      <Td><PriorityBadge priority={t.priority} /></Td>
                      <Td><StatusBadge status={t.status} /></Td>
                      <Td>
                        {t.assignedCs === null && <span className="text-warn-fg">Chưa nhận</span>}
                        {t.assignedCs !== null && (
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1.5"><Avatar name={t.assignedCs} /> {t.assignedCs}</span>
                            {lost && <span className="text-[11px] text-err-fg">Không khả dụng</span>}
                          </div>
                        )}
                      </Td>
                      <Td>
                        {t.assignedCsId === null && <Button variant="primary" size="sm" onClick={() => void claim(t.code, t.version)}>Nhận</Button>}
                        {lost && <Button size="sm" onClick={() => navigate(`?m=nhan-lai&t=${t.code}`)}>Nhận lại</Button>}
                        {t.assignedCsId !== null && !lost && <Button size="sm" onClick={() => navigate(`/nen-tang/ho-tro/${t.code}`)}>Mở</Button>}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
          <Pagination page={data.page} pageCount={pageCount} onChange={(page) => setFilters((f) => ({ ...f, page }))} summary={`Hiển thị ${data.items.length} / ${data.total} yêu cầu · chưa xử lý trước, rồi theo ưu tiên và thời gian tạo`} />
        </Card>
        {unavailable && (
          <Note tone="warn">{unavailable.code} có nhân viên hỗ trợ phụ trách không còn khả dụng: nhân viên đủ quyền có thể "Nhận lại" và giữ nguyên trạng thái {STATUS_LABEL[unavailable.status]}. Khi chưa phụ trách, chỉ xem được yêu cầu.</Note>
        )}
        <Foot>Hàng đợi hỗ trợ của nhân viên hỗ trợ. Thẻ số liệu và tab lọc nhanh theo tình trạng; nút "Nhận" chỉ hiện ở yêu cầu chưa có người phụ trách, "Mở" vào màn xử lý yêu cầu. Cột Phụ trách báo đỏ khi người phụ trách cũ không còn khả dụng.</Foot>
      </div>
      {m === 'nhan-lai' && (
        <ReasonDialog
          title="Nhận yêu cầu chưa có nhân viên hỗ trợ khả dụng" label="Lý do nhận *" placeholder="Tiếp nhận lại để xem xác nhận mới nhất của Chủ trại" submitLabel="Xác nhận nhận yêu cầu"
          readOnly={{ label: 'Yêu cầu / trạng thái hiện tại', value: target ? `${target.code} · ${STATUS_LABEL[target.status]} · nhân viên hỗ trợ cũ không khả dụng` : (claimCode ?? '') }}
          note="Nhận chỉ thay người phụ trách, giữ nguyên trạng thái hiện tại. Không ghi đè một nhân viên hỗ trợ vẫn đang phụ trách hợp lệ."
          onSubmit={async (reason) => {
            if (!target) throw new SupportError('NOT_FOUND', 'Không tìm thấy yêu cầu cần nhận lại.')
            await supportApi.claim(me, target.code, { reason, expectedVersion: target.version })
            navigate(`/nen-tang/ho-tro/${target.code}`, { state: { flash: `Bạn đang phụ trách ${target.code}.` } })
          }}
          onClose={closeModal}
        />
      )}
      {flash}
    </Layout>
  )
}
