import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { activateTableRow, activateTableRowByKey, Badge, Button, Card, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Icon, Info, interactiveRowClass, LoadingBlock, Metric, PageHeader, Pagination, SearchInput, Table, Td, Th } from '../../../shared/ui'
import { financeError } from '../api/financeError'
import { useFinanceFarms, useFinanceReceipt, useFinanceReceipts, usePlatformFinanceUseCases } from '../hooks/usePlatformFinanceUseCases'
import { FilterField, PAYMENT_ROUTE, REPORT_BASE } from '../components/common'
import { formatDate, formatShort, formatVnd } from '../domain/financeRules'
import type { Receipt } from '../types'

const TITLE = 'Biên nhận gói'
const confirmText = (r: Receipt) => `${r.confirmedAt.slice(11, 16)} ${formatDate(r.confirmedAt.slice(0, 10))} · ${r.confirmedBy === 'SEPAY' ? 'SePay tự xác nhận' : 'chấp nhận thủ công'}`

/** SCR-70: biên nhận gói chỉ đọc, truy vết về thanh toán và chứng từ nguồn. */
export default function ReceiptRoutes() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [farmId, setFarmId] = useState<number | ''>('')
  const useCases = usePlatformFinanceUseCases()
  const initialRange = useCases.defaultDateRange()
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<Receipt | null>(null)
  const farms = useFinanceFarms()
  const { data, loading, error, refetch } = useFinanceReceipts({ search, farmId, from, to, page })
  const selectedCode = picked?.code ?? data?.rows[0]?.code ?? null
  const { data: selectedDetail } = useFinanceReceipt(selectedCode)

  useEffect(() => {
    if (!data) return
    if (page > data.pageCount) {
      setPage(data.pageCount)
      setPicked(null)
      return
    }
    if (picked && !data.rows.some((row) => row.code === picked.code)) setPicked(null)
  }, [data, page, picked])

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={financeError(error, 'Không tải được biên nhận.')} onRetry={refetch} /></Layout>

  const current = selectedDetail && data.rows.some((row) => row.code === selectedDetail.code)
    ? selectedDetail
    : ((picked && data.rows.find((r) => r.code === picked.code)) || data.rows[0] || null)
  const changeFilter = (update: () => void) => { update(); setPage(1); setPicked(null) }
  const reset = () => { setSearch(''); setFarmId(''); setFrom(initialRange.from); setTo(initialRange.to); setPage(1); setPicked(null) }
  const month = Number(to.slice(5, 7))
  const openReceipt = (receipt: Receipt) => setPicked(receipt)

  const filterBar = (
    <div data-testid="receipt-filters" className="flex flex-wrap items-end gap-3">
      <FilterField label="Tìm kiếm" width={260}><SearchInput className="[&_input]:!h-[38px] [&_input]:!rounded-md [&_input]:!py-0 [&_input]:!text-xs" aria-label="Tìm biên nhận" placeholder="Mã biên nhận / thanh toán…" value={search} onChange={(e) => changeFilter(() => setSearch(e.target.value))} /></FilterField>
      <FilterField label="Trang trại" width={220}>
        <FilterSelect aria-label="Trang trại" value={String(farmId)} onChange={(e) => changeFilter(() => setFarmId(e.target.value ? Number(e.target.value) : ''))}>
          <option value="">Tất cả</option>
          {(farms.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </FilterSelect>
      </FilterField>
      <FilterField label="Từ ngày" width={160}><DateInput compact id="rc-from" value={from} onChange={(v) => changeFilter(() => setFrom(v))} /></FilterField>
      <FilterField label="Đến ngày" width={160}><DateInput compact id="rc-to" value={to} onChange={(v) => changeFilter(() => setTo(v))} /></FilterField>
    </div>
  )

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE}>
          <Button onClick={() => navigate(REPORT_BASE)}><Icon name="report-analytics" size={16} /> Mở báo cáo dòng tiền</Button>
        </PageHeader>
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label={`Biên nhận tháng ${month}`} value={String(data.total)} note={`tính đến ${formatDate(to)}`} />
          <Metric label={`Tổng thu tháng ${month}`} value={`${formatVnd(data.totalAmount)} đ`} note="theo thời điểm ngân hàng ghi nhận" />
          <Metric label="Múi giờ tính" value="Giờ Việt Nam" note="Asia/Ho_Chi_Minh" />
        </div>
        <Card>{filterBar}</Card>
        <div className={data.total > 0 ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_436px]' : ''}>
          <Card title="Danh sách biên nhận">
            {data.total === 0 ? (
              <EmptyBlock title="Không có biên nhận phù hợp" sub="Thử xóa bộ lọc để xem dữ liệu được phép." action={<Button onClick={reset}><Icon name="filter-off" size={16} /> Xóa bộ lọc</Button>} />
            ) : (
              <>
              <Table stack={false}>
                <thead><tr><Th>Biên nhận</Th><Th>Trang trại</Th><Th>Thời hạn</Th><Th>Số tiền</Th><Th>Ngân hàng ghi</Th></tr></thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr
                      key={r.code}
                      tabIndex={0}
                      aria-label={`Mở biên nhận ${r.code}`}
                      aria-selected={r.code === current?.code}
                      className={`${interactiveRowClass} ${r.code === current?.code ? 'bg-[#eef4ef]' : ''}`}
                      onClick={(event) => activateTableRow(event, () => openReceipt(r))}
                      onKeyDown={(event) => activateTableRowByKey(event, () => openReceipt(r))}
                    >
                      <Td><button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-brand" onClick={() => openReceipt(r)}>{r.code}</button></Td>
                      <Td><button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left text-[12px] text-ink" onClick={() => openReceipt(r)}>{r.farmName}</button></Td>
                      <Td>{r.termYears} năm</Td>
                      <Td>{formatVnd(r.amountVnd)}</Td>
                      <Td>{formatShort(r.bankPaidAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={data.page} pageCount={data.pageCount} onChange={(nextPage) => { setPage(nextPage); setPicked(null) }} summary={`Hiển thị ${data.rows.length} / ${data.total} biên nhận`} />
              </>
            )}
          </Card>
          {data.total > 0 && current && <ReceiptDetail receipt={current} onTrace={() => navigate(PAYMENT_ROUTE)} />}
        </div>
      </div>
    </Layout>
  )
}

function ReceiptDetail({ receipt: r, onTrace }: { receipt: Receipt; onTrace: () => void }) {
  return (
    <Card title={<span>{r.code} <span className="block text-[11px] font-normal text-muted">{r.farmName}</span></span>} actions={<Badge tone="outline">Chỉ đọc</Badge>}>
      <div className="flex flex-col gap-3">
        <Info cols={2} items={[
          ['Thanh toán', 'Đã thanh toán'],
          ['Mã thanh toán', r.paymentCode],
          ['Bảng giá', `${r.priceVersion} · ${r.termYears} năm`],
          ['Số tiền', `${formatVnd(r.amountVnd)} đ`],
          ['Ngân hàng ghi nhận', `${r.bankPaidAt.slice(11, 19)} ${formatDate(r.bankPaidAt.slice(0, 10))}`],
          ['Xác nhận', confirmText(r)],
          ['Kỳ đã mua', `${formatDate(r.periodStart)} → ${formatDate(r.periodEnd)}`],
          ['Chứng từ nguồn', r.evidenceCode],
        ]} />
        <Button block onClick={onTrace}>Mở thanh toán / chứng từ nguồn</Button>
      </div>
    </Card>
  )
}
