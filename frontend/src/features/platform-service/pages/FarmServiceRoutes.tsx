import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { Button, Card, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Metric, Note, PageHeader, FilterSelect, Table, Td, Th, inputCls } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { platformServiceApi } from '../api/platformServiceApi'
import ServiceChangeDialog from '../components/ServiceChangeDialog'
import { ServiceBadge, downloadCsv, usePmAccess } from '../components/common'
import type { ServiceStatus } from '../types'
import { fmtDate } from '../domain/dates'
import { STATUS_LABEL } from '../domain/servicePeriods'

const TITLE = 'Dịch vụ trang trại'

export default function FarmServiceRoutes() {
  const canAct = usePmAccess()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ServiceStatus | ''>('')
  const [tick, setTick] = useState(0)
  const [targetId, setTargetId] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [m, openModal, closeModal] = useModalParam()
  const filters = useMemo(() => ({ q, status }), [q, status])
  const { data, loading, error, refetch } = useQuery(() => platformServiceApi.listFarms(filters), [filters, tick])

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được danh sách trại.')} onRetry={refetch} /></Layout>

  const { items, tiles, total } = data
  const mode = m === 'restore' ? 'restore' : m === 'suspend' ? 'suspend' : null
  const target = mode ? items.find((f) => f.farmId === targetId) ?? items.find((f) => f.suspended === (mode === 'restore')) : undefined
  const pct = tiles.total ? Math.round((tiles.active / tiles.total) * 100) : 0

  const exportList = () => downloadCsv('dich-vu-trang-trai.csv', [['Trang trại', 'Chủ trại', 'Gmail', 'Dịch vụ', 'Hết kỳ', 'Tạm ngừng', 'Quy mô'], ...items.map((f) => [f.farmName, f.ownerName, f.ownerEmail, STATUS_LABEL[f.serviceStatus], fmtDate(f.coverageEnd), f.suspended ? `Có · từ ${fmtDate(f.suspendedSince)}` : 'Không', `${f.herdSize} con`])])

  return (
    <Layout title={TITLE}>
      <PageHeader title={TITLE} sub="Tổng quan trạng thái dịch vụ của các trại – PM không truy cập dữ liệu chăm sóc bò của trại">
        <Button onClick={exportList}><Icon name="table-export" size={16} />Xuất danh sách</Button>
      </PageHeader>
      {message ? <Note tone="ok">{message}</Note> : null}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Tổng số trại" value={String(tiles.total)} note={`${tiles.active} đang hoạt động · ${pct}%`} />
        <Metric label="Chờ thanh toán" value={String(tiles.pending)} note="Chưa có kỳ dịch vụ" warn />
        <Metric label="Hết hạn" value={String(tiles.expired)} note="Cần gia hạn" />
        <Metric label="Tạm ngừng" value={String(tiles.suspended)} note="Do PM tạm ngừng" />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input aria-label="Tìm trại" className={`${inputCls} w-[320px] max-w-full`} placeholder="Tên trại, Gmail chủ trại…" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterSelect aria-label="Trạng thái dịch vụ" value={status} onChange={(e) => setStatus(e.target.value as ServiceStatus | '')}>
          <option value="">Trạng thái dịch vụ: Tất cả</option>
          {(Object.keys(STATUS_LABEL) as ServiceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </FilterSelect>
      </div>
      <Card>
        {items.length === 0 ? (
          <EmptyBlock title="Không có trại phù hợp" sub="Thử đổi từ khóa hoặc bộ lọc trạng thái." />
        ) : (
          <Table wide>
            <thead>
              <tr><Th>Trang trại</Th><Th>Dịch vụ</Th><Th>Hết kỳ</Th><Th>Tạm ngừng</Th><Th>Quy mô</Th><Th>{' '}</Th></tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.farmId} className={f.suspended ? 'bg-page' : ''}>
                  <Td><div className="font-medium text-ink">{f.farmName}</div><div className="text-[11px] text-muted">Chủ trại {f.ownerName}</div></Td>
                  <Td><ServiceBadge status={f.serviceStatus} /></Td>
                  <Td>{fmtDate(f.coverageEnd)}</Td>
                  <Td>{f.suspended ? `Có · từ ${fmtDate(f.suspendedSince).slice(0, 5)}` : 'Không'}</Td>
                  <Td>{f.herdSize} con</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {f.suspended ? (
                        <Button variant="primary" size="sm" disabled={!canAct} onClick={() => { setTargetId(f.farmId); openModal('restore') }}><Icon name="refresh" size={16} />Khôi phục</Button>
                      ) : (
                        <Button size="sm" disabled={!canAct} onClick={() => { setTargetId(f.farmId); openModal('suspend') }}>Tạm ngừng</Button>
                      )}
                      <Link className="text-[12px] font-semibold text-brand" to="/nen-tang/goi-dang-ky">Xem gói</Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="px-4 py-3 text-[12px] text-muted">Hiển thị {items.length} / {total} trại</div>
      </Card>
      <div className="mt-4">
        <Note tone="info">Tạm ngừng và khôi phục tách biệt với thanh toán: trại tạm ngừng vẫn giữ kỳ dịch vụ đã mua, và thanh toán không tự gỡ tạm ngừng.</Note>
      </div>
      <Foot>Dịch vụ trang trại (PM). Thẻ số liệu tóm tắt trạng thái dịch vụ toàn nền tảng; bảng liệt kê từng trại với ngày hết kỳ, tình trạng tạm ngừng và quy mô đàn. Nút cuối dòng mở hộp thoại tạm ngừng hoặc khôi phục.</Foot>
      {mode && target ? (
        <ServiceChangeDialog
          key={`${mode}-${target.farmId}`}
          farm={target}
          mode={mode}
          onClose={closeModal}
          onDone={(msg) => { setMessage(msg); setTick((t) => t + 1); closeModal() }}
        />
      ) : null}
    </Layout>
  )
}
