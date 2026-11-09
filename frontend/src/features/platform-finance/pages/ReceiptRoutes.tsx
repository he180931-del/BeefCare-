import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import Modal, { ModalButton, ModalFooter, useModalParam } from '../../../components/Modal'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Foot, DateInput, FilterSelect, Info, LoadingBlock, Metric, Note, PageHeader, Pagination, SearchInput, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { financeApi } from '../api/financeApi'
import { PAYMENT_ROUTE, REPORT_BASE, RoField } from '../components/common'
import { formatDate, formatDateTime, formatShort, formatVnd } from '../domain/financeRules'
import type { Receipt } from '../types'

const TITLE = 'Biên nhận gói'
const confirmText = (r: Receipt) => `${r.confirmedAt.slice(11, 16)} ${formatDate(r.confirmedAt.slice(0, 10))} · ${r.confirmedBy === 'SEPAY' ? 'SePay tự xác nhận' : 'chấp nhận thủ công'}`

/** SCR-70: biên nhận gói chỉ đọc, truy vết về thanh toán và chứng từ nguồn. */
export default function ReceiptRoutes() {
  const navigate = useNavigate()
  const [m, open, close] = useModalParam()
  const [search, setSearch] = useState('')
  const [farmId, setFarmId] = useState<number | ''>('')
  const [from, setFrom] = useState('2026-10-01')
  const [to, setTo] = useState('2026-10-19')
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<Receipt | null>(null)
  const farms = useQuery(() => financeApi.listFarms(), [])
  const { data, loading, error, refetch } = useQuery(() => financeApi.listReceipts({ search, farmId, from, to, page }), [search, farmId, from, to, page])
  const selectedCode = picked?.code ?? data?.rows[0]?.code ?? null
  const { data: selectedDetail } = useQuery(() => selectedCode ? financeApi.getReceipt(selectedCode) : Promise.resolve(null), [selectedCode])

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được biên nhận.')} onRetry={refetch} /></Layout>

  const current = selectedDetail ?? ((picked && data.rows.find((r) => r.code === picked.code)) || data.rows[0] || null)
  const reset = () => { setSearch(''); setFarmId(''); setPage(1) }
  const month = Number(to.slice(5, 7))

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub="Biên nhận chỉ đọc, sinh từ thanh toán đã chấp nhận – không sửa, không xóa">
          <Button onClick={() => navigate(REPORT_BASE)}><Icon name="report-analytics" size={16} /> Mở báo cáo dòng tiền</Button>
        </PageHeader>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[260px] max-w-full"><SearchInput aria-label="Tìm biên nhận" placeholder="Mã biên nhận / thanh toán…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></div>
          <div className="w-[200px] max-w-full">
            <FilterSelect aria-label="Trang trại" value={String(farmId)} onChange={(e) => { setFarmId(e.target.value ? Number(e.target.value) : ''); setPage(1) }}>
              <option value="">Trang trại: Tất cả</option>
              {(farms.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </FilterSelect>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-muted">
            Ngày ngân hàng
            <div className="w-[150px]"><DateInput id="rc-from" value={from} onChange={(v) => { setFrom(v); setPage(1) }} /></div>–
            <div className="w-[150px]"><DateInput id="rc-to" value={to} onChange={(v) => { setTo(v); setPage(1) }} /></div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label={`Biên nhận tháng ${month}`} value={String(data.total)} note={`tính đến ${formatDate(to)}`} />
          <Metric label={`Tổng thu tháng ${month}`} value={`${formatVnd(data.totalAmount)} đ`} note="theo thời điểm ngân hàng ghi nhận" />
          <Metric label="Múi giờ tính" value="Giờ Việt Nam" note="Asia/Ho_Chi_Minh" />
        </div>
        {data.total === 0 ? (
          <Card><EmptyBlock title="Không có biên nhận phù hợp" sub="Thử xóa bộ lọc để xem dữ liệu được phép." action={<Button onClick={reset}><Icon name="filter-off" size={16} /> Xóa bộ lọc</Button>} /></Card>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_436px]">
            <Card title="Danh sách biên nhận">
              <Table stack={false}>
                <thead><tr><Th>Biên nhận</Th><Th>Trang trại</Th><Th>Thời hạn</Th><Th>Số tiền</Th><Th>Ngân hàng ghi</Th></tr></thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.code} className={r.code === current?.code ? 'bg-[#eef4ef]' : ''}>
                      <Td><button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-brand" onClick={() => { setPicked(r); open('xem') }}>{r.code}</button></Td>
                      <Td><button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left text-[12px] text-ink" onClick={() => setPicked(r)}>{r.farmName}</button></Td>
                      <Td>{r.termYears} năm</Td>
                      <Td>{formatVnd(r.amountVnd)}</Td>
                      <Td>{formatShort(r.bankPaidAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={data.page} pageCount={data.pageCount} onChange={setPage} summary={`Hiển thị ${data.rows.length} / ${data.total} biên nhận`} />
            </Card>
            {current && <ReceiptDetail receipt={current} onTrace={() => navigate(PAYMENT_ROUTE)} />}
          </div>
        )}
        <Foot>Biên nhận gói (PM, chỉ xem). Mỗi biên nhận sinh tự động khi một thanh toán được chấp nhận; chọn dòng để xem chi tiết và truy vết về thanh toán, chứng từ ngân hàng nguồn.</Foot>
      </div>
      {m === 'xem' && current && (
        <Modal title={`Biên nhận ${current.code} · Chỉ đọc`} width={640} onClose={close}>
          <div className="flex flex-col gap-3">
            <RoField label="Trại / Thanh toán" value={`${current.farmName} · ${current.paymentCode} · Đã thanh toán`} />
            <RoField label="Giá / thời hạn / số tiền" value={`${current.priceVersion} · ${current.termYears} năm · ${formatVnd(current.amountVnd)} VND`} />
            <RoField label="Chứng từ nguồn" value={`${current.evidenceCode} · ${current.evidenceLabel}`} />
            <div className="grid gap-3 sm:grid-cols-2">
              <RoField label="Ngân hàng / nhận lần đầu" value={`${formatDateTime(current.bankPaidAt)} / ${current.bankFirstSeenAt.slice(11, 19)}`} />
              <RoField label="Hệ thống xác nhận" value={formatDateTime(current.confirmedAt)} />
            </div>
            <RoField label="Kỳ mua bất biến" value={`${formatDate(current.periodStart)} – ${formatDate(current.periodEnd)}`} />
            <Note tone="info">Không có sửa, Hủy bỏ hay xuất biên nhận riêng. Xuất tài chính từ báo cáo bản chốt.</Note>
          </div>
          <ModalFooter>
            <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Về biên nhận</ModalButton>
            <ModalButton variant="primary" onClick={() => navigate(PAYMENT_ROUTE)}>Mở chứng từ nguồn</ModalButton>
          </ModalFooter>
        </Modal>
      )}
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
        <Note tone="info">Chứng từ chưa khớp, trùng hoặc chưa được chấp nhận không phải doanh thu và không tạo biên nhận.</Note>
      </div>
    </Card>
  )
}
