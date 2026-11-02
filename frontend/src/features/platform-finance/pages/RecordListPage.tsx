import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Button, Card, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, LoadingBlock, PageHeader, Pagination, Segmented, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useDemoState } from '../../../hooks/useDemoState'
import { useQuery } from '../../../hooks/useApi'
import { financeApi } from '../api/financeApi'
import { FINANCE_BASE, FlashNote, StateBadge, useFlash } from '../components/common'
import { RecordDialogs } from '../components/RecordDialogs'
import { formatDate, formatSigned, signedAmount } from '../domain/financeRules'
import type { RecordFilters, RecordState } from '../types'

const TITLE = 'Thu chi khác'

/** SCR-71: danh sách khoản thu chi thủ công của nền tảng. */
export default function RecordListPage() {
  const navigate = useNavigate()
  const demo = useDemoState()
  const [params, setParams] = useSearchParams()
  const [flash] = useFlash()
  const [filters, setFilters] = useState<RecordFilters>({ page: 1 })
  const [reloadKey, setReloadKey] = useState(0)
  const farms = useQuery(() => financeApi.listFarms(), [])
  const cats = useQuery(() => financeApi.listCategories(), [])
  const { data, loading, error, refetch } = useQuery(() => financeApi.listRecords(filters), [filters, reloadKey])
  const patch = (p: RecordFilters) => setFilters((f) => ({ ...f, ...p, page: 1 }))

  if (demo === 'loi-tai' || error) {
    return (
      <Layout title={TITLE}>
        <ErrorBlock message={demo === 'loi-tai' ? 'Không thể lấy danh sách lúc này. Không có thay đổi nào được xác nhận; thử lại để nhận trạng thái hiện tại.' : userFacingError(error, 'Chưa tải được dữ liệu.')} onRetry={() => { if (demo) navigate(FINANCE_BASE); else refetch() }} />
      </Layout>
    )
  }
  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (!data) return null

  const openRow = (code: string, state: RecordState) => {
    if (state === 'DRAFT') return navigate(`${FINANCE_BASE}/${code}`)
    const next = new URLSearchParams(params)
    next.set('m', 'xem'); next.set('ma', code)
    setParams(next)
  }
  const categories = [...(cats.data?.income ?? []), ...(cats.data?.expense ?? [])]
  const filtered = Boolean(filters.type || filters.category || filters.scope || filters.from || filters.to)
  const c = data.counts

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub="Khoản thu, chi của nền tảng ngoài gói đăng ký: Nháp → Ghi sổ → Hủy bỏ (có lý do)">
          <Button variant="primary" onClick={() => navigate(`${FINANCE_BASE}/moi`)}><Icon name="circle-plus" size={16} /> Thêm khoản</Button>
        </PageHeader>
        <FlashNote flash={flash} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[190px]"><FilterSelect aria-label="Danh mục" value={filters.category ?? ''} onChange={(e) => patch({ category: e.target.value })}><option value="">Danh mục: Tất cả</option>{categories.map((x) => <option key={x}>{x}</option>)}</FilterSelect></div>
          <div className="flex items-center gap-2 text-[12px] text-muted">Ngày phát sinh<div className="w-[150px]"><DateInput id="fr-from" value={filters.from ?? ''} onChange={(v) => patch({ from: v })} /></div>–<div className="w-[150px]"><DateInput id="fr-to" value={filters.to ?? ''} onChange={(v) => patch({ to: v })} /></div></div>
          <div className="w-[170px]"><FilterSelect aria-label="Loại" value={filters.type ?? ''} onChange={(e) => patch({ type: e.target.value as RecordFilters['type'] })}><option value="">Loại: Thu &amp; chi</option><option value="INCOME">Loại: Thu</option><option value="EXPENSE">Loại: Chi</option></FilterSelect></div>
          <div className="w-[190px]"><FilterSelect aria-label="Phạm vi" value={filters.scope ?? ''} onChange={(e) => patch({ scope: e.target.value })}><option value="">Phạm vi: Tất cả</option><option value="GENERAL">Chung nền tảng</option>{(farms.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</FilterSelect></div>
        </div>
        <div>
          <Segmented value={filters.state || 'ALL'} onChange={(v) => setFilters((f) => ({ ...f, state: v === 'ALL' ? '' : (v as RecordState), page: 1 }))} options={[
            { value: 'ALL', label: `Tất cả ${c.ALL}` }, { value: 'DRAFT', label: `Nháp ${c.DRAFT}` }, { value: 'POSTED', label: `Đã ghi sổ ${c.POSTED}` }, { value: 'VOID', label: `Đã hủy bỏ ${c.VOID}` },
          ]} />
        </div>
        <Card>
          {data.total === 0 ? (
            <EmptyBlock title="Không có kết quả phù hợp" sub="Giữ bộ lọc đang chọn. Thử xóa bộ lọc để xem dữ liệu được phép; không hiển thị số hoặc bản ghi giả." action={filtered || filters.state ? <Button variant="primary" onClick={() => setFilters({ page: 1 })}><Icon name="filter-off" size={16} /> Xóa bộ lọc</Button> : undefined} />
          ) : (
            <>
              <Table scroll>
                <thead><tr><Th>Mã</Th><Th>Ngày phát sinh</Th><Th>Loại</Th><Th>Danh mục</Th><Th>Diễn giải</Th><Th>Phạm vi</Th><Th>Số tiền</Th><Th>Trạng thái</Th></tr></thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.recordCode} className={r.state === 'VOID' ? 'opacity-60' : ''}>
                      <Td><button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-brand" onClick={() => openRow(r.recordCode, r.state)}>{r.recordCode}</button></Td>
                      <Td>{formatDate(r.occurredOn)}</Td>
                      <Td>{r.type === 'INCOME' ? 'Thu' : 'Chi'}</Td>
                      <Td>{r.category}</Td>
                      <Td>{r.description}</Td>
                      <Td>{r.scope === 'GENERAL' ? 'Chung' : r.farmName}</Td>
                      <Td><span className={`font-semibold ${r.state === 'VOID' ? 'text-muted' : r.type === 'INCOME' ? 'text-ok-fg' : 'text-err-fg'}`}>{formatSigned(signedAmount(r))}</span></Td>
                      <Td><StateBadge state={r.state} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={data.page} pageCount={data.pageCount} onChange={(p) => setFilters((f) => ({ ...f, page: p }))} summary={`Hiển thị ${data.rows.length} / ${data.total} khoản`} />
            </>
          )}
        </Card>
        <Card title="Thao tác theo trạng thái">
          <div className="grid gap-3 md:grid-cols-3">
            {([['DRAFT', 'Sửa, bỏ nháp hoặc ghi sổ'], ['POSTED', 'Chỉ đọc; có thể hủy bỏ kèm lý do'], ['VOID', 'Giữ lịch sử, không khôi phục']] as const).map(([s, t]) => (
              <div key={s} className="flex flex-col items-start gap-2 rounded-md bg-page p-3"><StateBadge state={s} /><span className="text-[12px] text-ink">{t}</span></div>
            ))}
          </div>
        </Card>
        <Foot>Thu chi khác của nền tảng (PM). Đây là tài chính nền tảng cơ bản, không phải kế toán trại. Khoản đã hủy bỏ hiển thị mờ; chọn mã khoản để mở hồ sơ và thao tác theo trạng thái.</Foot>
      </div>
      <RecordDialogs code={params.get('ma')} onChanged={() => setReloadKey((k) => k + 1)} />
      {demo === 'loi-tai-hop-thoai' && (
        <Modal title="Chưa tải được dữ liệu" width={640} onClose={() => navigate(FINANCE_BASE)}>
          <p className="m-0 text-[12px] text-warn-fg">Không thể lấy danh sách/chi tiết lúc này. Không có thay đổi nào được xác nhận; thử lại để nhận trạng thái hiện tại.</p>
          <ModalFooter><ModalButton variant="primary" onClick={() => navigate(FINANCE_BASE)}><Icon name="refresh" size={16} /> Thử lại</ModalButton></ModalFooter>
        </Modal>
      )}
    </Layout>
  )
}
