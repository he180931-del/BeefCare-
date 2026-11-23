import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { AttachmentList, Badge, Button, Card, Foot, Icon, Info, Note, PageHeader, Table, Td, Th } from '../../../shared/ui'
import { EntryStatusBadge } from '../components/parts'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { dmy, kg, money } from '../../../shared/lib/format'
import PayModal from '../components/PayModal'
import CancelModal from '../components/CancelModal'
import type { EntryCattleDetail, EntryLineCommandResult, EntryPayment } from '../types'
import EntryLineModal from '../components/EntryLineModal'
import { entryHistoryDemoEnabled, entryLineCorrectionEnabled, entryPaymentVoidEnabled, voidEntryPayment } from '../api'
import EntryHistoryDemoModal from '../components/EntryHistoryDemoModal'
import { isFarmBornEntry } from '../domain/entryLineCorrection'
import { useSession } from '../../../app/session/sessionContext'
import { useEntryDetail } from '../hooks/useEntryDetail'
import { herdEntryError } from '../api/herdEntryError'
import { isVersionConflict } from '../../../shared/api/snapshotVersion'
import { entryPaymentTotals } from '../domain/entryPaymentTotals'
import { VoucherPaymentTable } from '../../../shared/ui/VoucherPaymentTable'
import { VoidVoucherPaymentModal } from '../../../shared/ui/VoidVoucherPaymentModal'

const TH = 'px-1! first:pl-3! last:pr-3!'

export default function ImportDetail() {
  const { id } = useParams()
  const recordId = id ?? ''
  const [m, openModal, closeModal] = useModalParam()
  const [params, setParams] = useSearchParams()
  const role = useSession()?.role
  const [lineResult, setLineResult] = useState<EntryLineCommandResult | null>(null)
  const [demoHistoryLine, setDemoHistoryLine] = useState<EntryCattleDetail | null>(null)
  const [paymentToVoid, setPaymentToVoid] = useState<EntryPayment | null>(null)
  const [paymentNotice, setPaymentNotice] = useState('')
  const paymentRole = role === 'OWNER' || role === 'MANAGER'
  const closePaymentVoid = () => { setPaymentToVoid(null); closeModal() }
  const detailQuery = useEntryDetail(recordId)
  const { record: r, detail: d, loading, paymentError, voidError, documentError, canPay, canCancel, savePayment, cancelRecord, viewDocument } = detailQuery

  if (!r && loading) {
    return (
      <Layout title="Chi tiết phiếu nhập" user="manager">
        <p className="m-0 text-xs text-muted">Đang tải phiếu nhập…</p>
      </Layout>
    )
  }

  if (!r) {
    return (
      <Layout title="Chi tiết phiếu nhập" user="manager">
        <p>Không tìm thấy phiếu {id}. <Link to="/herd-entry" className="text-brand">Về danh sách</Link></p>
      </Layout>
    )
  }

  const { paid, outstanding } = entryPaymentTotals(r)
  const paymentActions = entryPaymentVoidEnabled && paymentRole && r.status === 'Đã nhập'
  const lineActions = entryLineCorrectionEnabled && (role === 'OWNER' || role === 'MANAGER') && r.status === 'Đã nhập'
  const historyActions = !entryLineCorrectionEnabled && entryHistoryDemoEnabled && paymentRole && r.status === 'Đã nhập' && !isFarmBornEntry(r)
  const selectedLine = lineActions ? d.cows?.find(line => line.lineStatus === 'VALID' && line.entryId != null && String(line.entryId) === params.get('entry')) : undefined
  const lineModal = (name?: 'line' | 'cancel', entryId?: number) => {
    const next = new URLSearchParams(params)
    next.delete('entry')
    if (name) next.set('m', name); else next.delete('m')
    if (entryId != null) next.set('entry', String(entryId))
    setParams(next)
  }

  return (
    <Layout title={`Chi tiết phiếu nhập – ${r.status}`} user="manager">
      <div className="contents leading-[normal]">
        <PageHeader title={<span className="inline-flex flex-wrap items-center gap-3">{`Phiếu nhập ${r.id}`}<EntryStatusBadge status={r.status} /></span>}>
          <Button onClick={() => window.print()}><Icon name="printer" />In phiếu</Button>
          <Button disabled={!canCancel} onClick={() => openModal('cancel')}><Icon name="circle-x" />Hủy phiếu</Button>
        </PageHeader>
        {Boolean(paymentError || voidError) && !isVersionConflict(paymentError || voidError) && !m && <Note tone="err">{herdEntryError(paymentError || voidError)}</Note>}
        {documentError && <Note tone="err">{documentError}</Note>}
        {lineResult?.notice && <Note tone="ok">{lineResult.notice.message}</Note>}
        {lineResult?.overpaidNotice && <Note tone="warn">{lineResult.overpaidNotice.message}</Note>}
        {paymentNotice && <Note tone="ok">{paymentNotice}</Note>}

        <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="flex min-w-0 flex-col gap-[18px]">
            <Card title="Thông tin phiếu">
              <Info
                items={[
                  ['Ngày nhập trại', dmy(r.date)],
                  ['Loại nhập', r.type],
                  ['Số giấy kiểm dịch', d?.quarantine || '—'],
                  ['Nguồn / chủ bò cũ', d?.sourceName || r.source],
                  ['Liên hệ', d?.phone || '—'],
                  ['Biển số xe', d?.plate || '—'],
                  ['Người lập / lưu', d?.by || '—'],
                  ['Ghi chú', d?.note || '—'],
                ]}
              />
            </Card>

            <Card title="Bò trong phiếu" sub={`${r.count} con · ${kg(r.weight)}`}>
              <Table stack={false} scroll>
                <thead>
                  <tr>
                    <Th className={`${TH} w-[90px]`}>Mã bò</Th>
                    <Th className={`${TH} w-[65px]`}>Thẻ tai</Th>
                    <Th className={`${TH} w-[120px]`}>Giống · giới tính</Th>
                    <Th className={`${TH} w-[65px]`}>Cân nhập</Th>
                    <Th className={`${TH} w-[100px]`}>Chuồng nhận</Th>
                    <Th className={`${TH} w-[90px]`}>Hiện tại</Th>
                    <Th className={`${TH} w-[90px]`}>Thành tiền</Th>
                    {(lineActions || historyActions) && <Th className={TH}>Thao tác</Th>}
                  </tr>
                </thead>
                <tbody>
                  {(d.cows ?? []).map((c) => (
                    <tr key={c.entryId ?? c.code} className={c.lineStatus === 'VOID' ? 'opacity-60' : undefined}>
                      <Td className={`${TH} font-medium`}>{c.code}{c.lineStatus === 'VOID' && <Badge>Đã hủy</Badge>}</Td>
                      <Td className={TH}>{c.tag}</Td>
                      <Td className={TH}>{c.breed}</Td>
                      <Td className={`${TH} whitespace-nowrap`}>{kg(c.weight)}</Td>
                      <Td className={TH}>{c.barn}</Td>
                      <Td className={TH}>{c.current}</Td>
                      <Td className={`${TH} whitespace-nowrap`}>{money(c.amount)}</Td>
                      {historyActions && <Td className={TH}><Button variant="link" onClick={() => setDemoHistoryLine(c)}>Sửa lịch sử</Button></Td>}
                      {lineActions && <Td className={TH}>{c.lineStatus === 'VALID' && c.entryId != null && <Button onClick={() => lineModal('line', c.entryId)}>Sửa / Hủy</Button>}</Td>}
                    </tr>
                  ))}
                  {!(d.cows ?? []).length && (
                    <tr>
                      <Td colSpan={lineActions || historyActions ? 8 : 7} className="text-center text-muted">Chưa có dữ liệu chi tiết từng con của phiếu này</Td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <Td className={TH}>{r.count} con</Td><Td className={TH} /><Td className={TH} />
                    <Td className={`${TH} whitespace-nowrap`}>{kg(r.weight)}</Td>
                    <Td className={TH} /><Td className={TH} />
                    <Td className={TH}>{d ? money(d.cowsTotal) : ''}</Td>
                    {lineActions && <Td className={TH} />}
                  </tr>
                </tfoot>
              </Table>
              <p className="m-0 text-[11px] text-muted">
                Danh sách bò của phiếu đã nhập không thêm hoặc bớt được. Sửa hoặc hủy từng con bằng nút Sửa / Hủy ở mỗi dòng. Hủy cả phiếu chỉ khi chưa con nào có sự kiện khác.
              </p>
            </Card>

            <Card title="Chứng từ đính kèm">
              {d ? <AttachmentList items={(d.docs ?? []).map((doc, index) => ({ key: `saved:${index}`, name: doc.name, extension: doc.ext }))} onView={(key) => { const index = Number(key.split(':')[1]); if (Number.isInteger(index)) void viewDocument(index) }} /> : <span className="text-[11px] text-muted">Chưa có chứng từ</span>}
            </Card>
          </div>

          <div className="flex flex-col gap-[18px]">
            {r.total != null && (
              <Card title="Thanh toán">
                <Info
                  cols={2}
                  items={[
                    ['Tiền bò', d ? `${money(d.cowsTotal)} đ` : '—'],
                    ['Phí vận chuyển', d ? `${money(d.freight)} đ` : '—'],
                    ['Tổng phải trả', `${money(r.total)} đ`],
                    ['Đã thanh toán', `${money(paid)} đ`],
                    ['Còn nợ nguồn bán', `${money(outstanding)} đ`],
                  ]}
                />
                <VoucherPaymentTable payments={d.payments ?? []} onVoid={paymentActions ? payment => { setPaymentToVoid(payment); openModal('void-payment') } : undefined} />
                {r.status === 'Đã hủy' && <Note>Phiếu đã hủy: {r.cancelReason}</Note>}
                {r.status !== 'Đã hủy' && outstanding === 0 && <Note tone="ok">Đã thanh toán đủ – "Ghi nhận thanh toán" chỉ hiện khi còn nợ.</Note>}
                {canPay && paymentRole && outstanding > 0 && (
                  <Button block className="rounded-[4px] text-[13px] font-semibold" onClick={() => openModal('pay')}>
                    Ghi nhận thanh toán
                  </Button>
                )}
              </Card>
            )}
            <Card title="Lịch sử phiếu">
              <div className="flex flex-col gap-2 text-xs">
                {(d?.history || [`${dmy(r.date)} · Phiếu được ${r.status === 'Đã hủy' ? 'hủy' : 'lưu'}`]).map((h, index) => <span key={`${index}:${h}`}>{h}</span>)}
              </div>
            </Card>
          </div>
        </div>

        <Foot>Sửa / hủy bản ghi nhập cần lý do; thanh toán có danh sách khoản đã ghi (ngày, phương thức, số tiền, tham chiếu, người ghi); khoản bị hủy hiện gạch ngang.</Foot>
      </div>

      {m === 'pay' && canPay && paymentRole && <PayModal record={r} saving={detailQuery.paymentSaving} error={paymentError} onReload={async () => { await detailQuery.reload(); closeModal() }} onSave={async (value) => { await savePayment(value); closeModal() }} onClose={closeModal} />}
      {m === 'void-payment' && paymentActions && paymentToVoid && <VoidVoucherPaymentModal key={`${r.id}:${paymentToVoid.id}`} payment={paymentToVoid} onVoid={voidEntryPayment} onClose={closePaymentVoid} onReload={async () => { await detailQuery.reload(); closePaymentVoid() }} onSuccess={async payment => { setPaymentNotice(`Đã hủy khoản thanh toán ${money(payment.amount)} đ.`); closePaymentVoid(); await detailQuery.refetch() }} />}
      {m === 'cancel' && canCancel && <CancelModal record={r} saving={detailQuery.voidSaving} error={voidError} onReload={async () => { await detailQuery.reload(); closeModal() }} onConfirm={async (reason) => { await cancelRecord(reason); closeModal() }} onClose={closeModal} />}
      {m === 'line' && selectedLine && <EntryLineModal key={`${r.id}:${selectedLine.entryId}`} record={r} line={selectedLine} onClose={() => lineModal()} onVoidVoucher={() => lineModal('cancel')} onReload={async () => { await detailQuery.reload(); lineModal() }} onSuccess={async result => { setLineResult(result); lineModal(); await detailQuery.refetch() }} />}
      {historyActions && demoHistoryLine && <EntryHistoryDemoModal record={r} line={demoHistoryLine} onClose={() => setDemoHistoryLine(null)} onSaved={async () => {
        setDemoHistoryLine(null); setLineResult({ notice: { code: 'MSG-FE06-06', params: {}, message: 'Đã sửa khai báo lịch sử.' }, overpaidNotice: null }); await detailQuery.refetch()
      }} />}
    </Layout>
  )
}
