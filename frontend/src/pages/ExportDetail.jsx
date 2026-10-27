import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { Badge, Button, Foot, Info, Note, Table, Td, Th, PaymentTable } from '../components/ui'
import { useModalParam } from '../components/Modal'
import { dmy, kg, money } from '../data/format'
import { herdExitApi } from '../api/herdExitApi'
import { useQuery } from '../hooks/useApi'
import { Box, DocRow, TH } from './export/parts'
import CancelModal from './export/CancelModal'
import CollectModal from './export/CollectModal'
import DeathView from './export/DeathView'

const STATUS_TONE = { 'Đã xuất': 'ok', 'Đã hủy': 'err', 'Chờ xác nhận': 'warn' }

export default function ExportDetail() {
  const { id } = useParams()
  const { data: r, loading, refetch } = useQuery(() => herdExitApi.get(id), [id])
  const [m, openModal, closeModal] = useModalParam()

  if (!r) {
    return (
      <Layout title="Chi tiết phiếu xuất">
        {loading ? <p className="m-0 text-xs text-muted">Đang tải…</p> : (
          <p>Không tìm thấy phiếu {id}. <Link to="/herd-exit" className="text-brand">Về danh sách</Link></p>
        )}
      </Layout>
    )
  }
  if (r.detail?.death) return <DeathView row={r} />

  const d = r.detail
  const collected = d ? d.payments.reduce((s, p) => s + p.amount, 0) : (r.total ?? 0) - (r.due ?? 0)
  const owed = r.due ?? 0
  const tone = STATUS_TONE[r.status]
  const isSold = r.status === 'Đã xuất'

  return (
    <Layout title={`Chi tiết phiếu xuất – ${r.status}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold">Phiếu xuất {r.id}</h1>
          <div className="mt-1"><Badge tone={tone} className={tone ? '!border-0' : undefined}>{r.status}</Badge></div>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={() => window.print()}>In phiếu</Button>
          <Button disabled={!isSold} onClick={() => openModal('cancel')}>Hủy phiếu</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_354px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Box title="Thông tin phiếu" gap="gap-[14px]">
            <Info
              items={[
                ['Ngày xuất', dmy(r.date)],
                ['Loại xuất', r.type],
                ['Số giấy kiểm dịch vận chuyển', d?.quarantine || '—'],
                [r.type === 'Bán' ? 'Người mua' : 'Lý do', d?.buyer || r.who],
                ['Liên hệ', d?.phone || '—'],
                ['Biển số xe', d?.plate || '—'],
                ['Người lập & xác nhận', d?.by || '—'],
                ['Ghi chú', d?.note || r.sub],
                ...(r.status === 'Đã hủy' ? [['Lý do hủy', r.cancelReason || '—']] : []),
              ]}
            />
          </Box>

          <Box title="Bò trong phiếu" sub={`${r.count} con${r.weight ? ` · ${r.weight}` : ''}`} gap="gap-3">
            <Table>
              <thead>
                <tr>
                  <Th className={TH}>Mã bò</Th><Th className={TH}>Thẻ tai</Th><Th className={TH}>Giống · giới tính</Th><Th className={TH}>Cân xuất</Th>
                  <Th className={TH}>Chuồng cuối</Th><Th className={TH}>Trạng thái</Th><Th className={TH}>Thành tiền</Th>
                </tr>
              </thead>
              <tbody>
                {d ? d.cows.map((c) => (
                  <tr key={c.code}>
                    <Td className={`${TH} !py-3 font-medium`}>{c.code}</Td><Td className={`${TH} !py-3`}>{c.tag}</Td>
                    <Td className={`${TH} !py-3`}>{c.breed}</Td><Td className={`${TH} !py-3`}>{kg(c.weight)}</Td>
                    <Td className={`${TH} !py-3`}>{c.barn}</Td>
                    <Td className={`${TH} !py-3`}><Badge tone="ok" className="!border-0">Đã xuất</Badge></Td>
                    <Td className={`${TH} !py-3`}>{money(c.amount)}</Td>
                  </tr>
                )) : (
                  <tr><Td colSpan={7} className="text-center text-muted">Chưa có dữ liệu chi tiết từng con của phiếu này</Td></tr>
                )}
              </tbody>
              {d && (
                <tfoot>
                  <tr className="font-semibold"><Td className={TH}>{r.count} con</Td><Td className={TH} /><Td className={TH} /><Td className={TH}>{r.weight}</Td><Td className={TH} /><Td className={TH} /><Td className={TH}>{money(d.cowsTotal)}</Td></tr>
                </tfoot>
              )}
            </Table>
            <Note>Bò đã xuất chỉ còn xem, hồ sơ giữ toàn bộ lịch sử. Hủy phiếu đưa cả {r.count} con về ACTIVE (GBR-26).</Note>
          </Box>

          <Box title="Chứng từ đính kèm" gap="gap-[10px]">
            {d ? d.docs.map((doc) => <DocRow key={doc.name} ext={doc.ext} name={doc.name} />) : <span className="text-[11px] text-muted">Chưa có chứng từ</span>}
          </Box>
        </div>

        <div className="flex flex-col gap-[18px]">
          {r.total != null && (
            <Box title="Thanh toán" gap="gap-3">
              <Info
                cols={2}
                items={[
                  ['Tiền bò', `${money(d ? d.cowsTotal : r.total)} đ`],
                  ['Khấu trừ', `${money(d?.deduction || 0)} đ`],
                  ['Tổng phải thu', `${money(r.total)} đ`],
                  ['Đã thu', `${money(collected)} đ`],
                  ['Còn phải thu', `${money(owed)} đ`, owed > 0],
                ]}
              />
              {d && <PaymentTable payments={d.payments} />}
              {isSold && owed > 0 && <Button block onClick={() => openModal('collect')}>Ghi nhận thu tiền</Button>}
            </Box>
          )}
          <Box title="Lịch sử phiếu" gap="gap-2">
            <div className="flex flex-col gap-2 text-xs">
              {(d?.history || [`${dmy(r.date)} · Phiếu ở trạng thái ${r.status}`]).map((h) => <span key={h}>{h}</span>)}
            </div>
          </Box>
        </div>
      </div>

      <Foot>Chủ trại in phiếu, ghi nhận thu tiền (khi còn phải thu) và hủy phiếu đã xuất; Quản lý chỉ xem.</Foot>

      {m === 'cancel' && <CancelModal row={r} onClose={closeModal} onCancelled={() => { refetch(); closeModal() }} />}
      {m === 'collect' && <CollectModal row={r} onClose={closeModal} onSaved={refetch} />}
    </Layout>
  )
}
