import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { AttachmentList, Badge, Button, Foot, Icon, Info, Note, Table, Td, Th } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { dmy, kg, money } from '../../../shared/lib/format'
import { Box, ExitStatusBadge, TH, useIsOwner } from '../components/parts'
import CancelModal from '../components/CancelModal'
import CollectModal from '../components/CollectModal'
import DeathView from '../components/DeathView'
import { PaymentTable } from '../components/PaymentTable'
import type { ExitDetail, ExitPayment } from '../types'
import { useExitDetail } from '../hooks/useExitDetail'
import { exitCattleStatus } from '../domain/exitCattleStatus'
import { exitPaymentTotals } from '../domain/exitPaymentTotals'
import { exitPaymentVoidEnabled, voidExitPayment } from '../api'
import { VoidVoucherPaymentModal } from '../../../shared/ui/VoidVoucherPaymentModal'

export default function ExportDetail() {
  const { id } = useParams()
  const recordId = id ?? ''
  const [m, openModal, closeModal] = useModalParam()
  const isOwner = useIsOwner()
  const { record: r, loading, refetch, reload, documentError, links, canCancel, viewDocument } = useExitDetail(recordId)
  const [reloadRevision, setReloadRevision] = useState(0)
  const [paymentToVoid, setPaymentToVoid] = useState<ExitPayment | null>(null)
  const [paymentNotice, setPaymentNotice] = useState('')
  const closePaymentVoid = () => { setPaymentToVoid(null); closeModal() }
  const reloadRecord = async () => { await reload(); closeModal(); setReloadRevision((value) => value + 1) }

  if (!r) {
    return (
      <Layout title="Chi tiết phiếu xuất">
        {loading ? <p className="m-0 text-xs text-muted">Đang tải…</p> : (
          <p>Không tìm thấy phiếu {id}. <Link to="/herd-exit" className="text-brand">Về danh sách</Link></p>
        )}
      </Layout>
    )
  }
  if (r.detail?.death) return <DeathView key={`${r.id}-${reloadRevision}`} row={r} onReload={reloadRecord} />

  const d: ExitDetail = { cows: [], payments: [], docs: [], history: [], ...r.detail }
  const { collected, outstanding: owed } = exitPaymentTotals(r)
  const isSold = r.status === 'Đã xuất'
  const paymentActions = exitPaymentVoidEnabled && isOwner && isSold

  return (
    <Layout title={`Chi tiết phiếu xuất – ${r.status}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-[22px] font-bold">Phiếu xuất {r.id}</h1>
          <ExitStatusBadge status={r.status} />
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={() => window.print()}><Icon name="printer" />In phiếu</Button>
          {isOwner && <Button disabled={!canCancel} onClick={() => openModal('cancel')}><Icon name="circle-x" />Hủy phiếu</Button>}
        </div>
      </div>

      {paymentNotice && <Note tone="ok">{paymentNotice}</Note>}
      <div className="grid grid-cols-1 items-start gap-4 @min-[880px]:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] @min-[1024px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] @min-[1024px]:gap-6">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Box title="Thông tin phiếu" gap="gap-[14px]">
            <Info
              items={[
                ['Ngày xuất', dmy(r.date)],
                ['Loại xuất', r.type],
                ['Số giấy kiểm dịch vận chuyển', d?.quarantine || '—'],
                [r.type === 'Bán' || r.type === 'Loại thải' ? 'Người mua' : 'Lý do', d?.buyer || r.who],
                ['Liên hệ', d?.buyerPhone || d?.phone || '—'],
                ['Biển số xe', d?.plate || '—'],
                ['Người lập & xác nhận', d?.by || '—'],
                ['Ghi chú', d?.note || r.sub],
                ...(r.status === 'Đã hủy' ? [['Lý do hủy', r.cancelReason || '—']] : []),
              ]}
            />
          </Box>

          <Box title="Bò trong phiếu" sub={`${r.count} con${r.weight ? ` · ${r.weight}` : ''}`} gap="gap-3">
            <Table scroll>
              <thead>
                <tr>
                  <Th className={TH}>Mã bò</Th><Th className={TH}>Thẻ tai</Th><Th className={TH}>Giống · giới tính</Th><Th className={TH}>Cân xuất</Th>
                  <Th className={TH}>Chuồng cuối</Th><Th className={TH}>Trạng thái</Th><Th className={TH}>Thành tiền</Th>
                </tr>
              </thead>
              <tbody>
                {(d.cows ?? []).map((c) => {
                  const cattleStatus = exitCattleStatus(c.current, r.status)
                  return (
                    <tr key={c.code}>
                      <Td className={`${TH} !py-3 font-medium`}>{c.code}</Td><Td className={`${TH} !py-3`}>{c.tag}</Td>
                      <Td className={`${TH} !py-3`}>{c.breed}</Td><Td className={`${TH} !py-3`}>{kg(c.weight)}</Td>
                      <Td className={`${TH} !py-3`}>{c.barn}</Td>
                      <Td className={`${TH} !py-3`}>{cattleStatus === 'ACTIVE' ? <Badge tone="ok" icon="circle-check">Đang nuôi</Badge> : cattleStatus === 'EXITED' ? <ExitStatusBadge status="Đã xuất" /> : '—'}</Td>
                      <Td className={`${TH} !py-3`}>{money(c.amount)}</Td>
                    </tr>
                  )
                })}
                {!(d.cows ?? []).length && (
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
            {documentError && <Note tone="err">{documentError}</Note>}
            {(d.docs ?? []).length ? <AttachmentList items={(d.docs ?? []).map((doc, index) => ({ key: `saved:${index}`, name: doc.name, extension: doc.ext }))} onView={(key) => { const index = Number(key.split(':')[1]); if (Number.isInteger(index)) void viewDocument(index) }} /> : <span className="text-[11px] text-muted">Chưa có chứng từ</span>}
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
              <PaymentTable payments={d.payments ?? []} onVoid={paymentActions ? payment => { setPaymentToVoid(payment); openModal('void-payment') } : undefined} />
              {isOwner && isSold && owed > 0 && <Button block onClick={() => openModal('collect')}><Icon name="cash" />Ghi nhận thu tiền</Button>}
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

      {m === 'cancel' && canCancel && <CancelModal row={r} onReload={reloadRecord} onClose={closeModal} onCancelled={() => { void refetch(); closeModal() }} />}
      {m === 'collect' && isOwner && isSold && owed > 0 && <CollectModal row={r} onReload={reloadRecord} onClose={closeModal} onSaved={refetch} />}
      {m === 'void-payment' && paymentActions && paymentToVoid && <VoidVoucherPaymentModal key={`${r.id}:${paymentToVoid.id}`} payment={paymentToVoid} onVoid={voidExitPayment} onClose={closePaymentVoid} onReload={async () => { await reload(); closePaymentVoid() }} onSuccess={async payment => { setPaymentNotice(`Đã hủy khoản thanh toán ${money(payment.amount)} đ.`); closePaymentVoid(); await refetch() }} />}
    </Layout>
  )
}
