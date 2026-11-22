import { Link, useParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { AttachmentList, Button, Card, Foot, Icon, Info, Note, PageHeader, Table, Td, Th } from '../../../shared/ui'
import { EntryStatusBadge } from '../components/parts'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { dmy, kg, money } from '../../../shared/lib/format'
import PayModal from '../components/PayModal'
import CancelModal from '../components/CancelModal'
import type { EntryPayment } from '../types'
import { useEntryDetail } from '../hooks/useEntryDetail'
import { herdEntryError } from '../api/herdEntryError'
import { isVersionConflict } from '../../../shared/api/snapshotVersion'

const TH = 'px-1! first:pl-3! last:pr-3!'

export default function ImportDetail() {
  const { id } = useParams()
  const recordId = id ?? ''
  const [m, openModal, closeModal] = useModalParam()
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

  const paid = d.payments?.reduce((s, payment) => s + payment.amount, 0) ?? (r.total != null ? r.total - (r.debt || 0) : 0)

  return (
    <Layout title={`Chi tiết phiếu nhập – ${r.status}`} user="manager">
      <div className="contents leading-[normal]">
        <PageHeader title={<span className="inline-flex flex-wrap items-center gap-3">{`Phiếu nhập ${r.id}`}<EntryStatusBadge status={r.status} /></span>}>
          <Button onClick={() => window.print()}><Icon name="printer" />In phiếu</Button>
          <Button disabled={!canCancel} onClick={() => openModal('cancel')}><Icon name="circle-x" />Hủy phiếu</Button>
        </PageHeader>
        {Boolean(paymentError || voidError) && !isVersionConflict(paymentError || voidError) && !m && <Note tone="err">{herdEntryError(paymentError || voidError)}</Note>}
        {documentError && <Note tone="err">{documentError}</Note>}

        <div className="grid grid-cols-1 items-start gap-4 @min-[880px]:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] @min-[1024px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] @min-[1024px]:gap-6">
          <div className="flex min-w-0 flex-col gap-[18px]">
            <Card variant="panel" title="Thông tin phiếu">
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

            <Card variant="panel" title="Bò trong phiếu" sub={`${r.count} con · ${kg(r.weight)}`}>
              <Table stack={false}>
                <thead>
                  <tr>
                    <Th className={`${TH} w-[90px]`}>Mã bò</Th>
                    <Th className={`${TH} w-[65px]`}>Thẻ tai</Th>
                    <Th className={`${TH} w-[120px]`}>Giống · giới tính</Th>
                    <Th className={`${TH} w-[65px]`}>Cân nhập</Th>
                    <Th className={`${TH} w-[100px]`}>Chuồng nhận</Th>
                    <Th className={`${TH} w-[90px]`}>Hiện tại</Th>
                    <Th className={`${TH} w-[90px]`}>Thành tiền</Th>
                  </tr>
                </thead>
                <tbody>
                  {(d.cows ?? []).map((c) => (
                    <tr key={c.code}>
                      <Td className={`${TH} font-medium`}>{c.code}</Td>
                      <Td className={TH}>{c.tag}</Td>
                      <Td className={TH}>{c.breed}</Td>
                      <Td className={`${TH} whitespace-nowrap`}>{kg(c.weight)}</Td>
                      <Td className={TH}>{c.barn}</Td>
                      <Td className={TH}>{c.current}</Td>
                      <Td className={`${TH} whitespace-nowrap`}>{money(c.amount)}</Td>
                    </tr>
                  ))}
                  {!(d.cows ?? []).length && (
                    <tr>
                      <Td colSpan={7} className="text-center text-muted">Chưa có dữ liệu chi tiết từng con của phiếu này</Td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <Td className={TH}>{r.count} con</Td><Td className={TH} /><Td className={TH} />
                    <Td className={`${TH} whitespace-nowrap`}>{kg(r.weight)}</Td>
                    <Td className={TH} /><Td className={TH} />
                    <Td className={TH}>{d ? money(d.cowsTotal) : ''}</Td>
                  </tr>
                </tfoot>
              </Table>
              <p className="m-0 text-[11px] text-muted">
                Danh sách bò của phiếu đã nhập không sửa được. Sửa từng con tại Hồ sơ bò › Sửa bản ghi nhập đàn; hủy cả phiếu chỉ khi chưa con nào có sự kiện khác.
              </p>
            </Card>

            <Card variant="panel" title="Chứng từ đính kèm">
              {d ? <AttachmentList items={(d.docs ?? []).map((doc, index) => ({ key: `saved:${index}`, name: doc.name, extension: doc.ext }))} onView={(key) => { const index = Number(key.split(':')[1]); if (Number.isInteger(index)) void viewDocument(index) }} /> : <span className="text-[11px] text-muted">Chưa có chứng từ</span>}
            </Card>
          </div>

          <div className="flex flex-col gap-[18px]">
            {r.total != null && (
              <Card variant="panel" title="Thanh toán">
                <Info
                  cols={2}
                  items={[
                    ['Tiền bò', d ? `${money(d.cowsTotal)} đ` : '—'],
                    ['Phí vận chuyển', d ? `${money(d.freight)} đ` : '—'],
                    ['Tổng phải trả', `${money(r.total)} đ`],
                    ['Đã thanh toán', `${money(paid)} đ`],
                    ['Còn nợ nguồn bán', `${money(r.debt || 0)} đ`],
                  ]}
                />
                {d && (
                  <Table stack={false}>
                    <thead>
                      <tr>
                        <Th className={`${TH} w-[85px]`}>Ngày · người ghi</Th>
                        <Th className={`${TH} w-[105px]`}>Phương thức · tham chiếu</Th>
                        <Th className={`${TH} w-[80px]`}>Số tiền (đ)</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d.payments ?? []).map((p) => (
                        <tr key={p.ref}>
                          <Td className={TH}>{p.date}<br />{p.by}</Td>
                          <Td className={TH}>{p.method}<br />{p.ref}</Td>
                          <Td className={TH}>{money(p.amount)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
                {r.status === 'Đã hủy' && <Note>Phiếu đã hủy: {r.cancelReason}</Note>}
                {r.status !== 'Đã hủy' && r.debt === 0 && <Note tone="ok">Đã thanh toán đủ – "Ghi nhận thanh toán" chỉ hiện khi còn nợ.</Note>}
                {canPay && (r.debt ?? 0) > 0 && (
                  <Button block className="rounded-[4px] text-[13px] font-semibold" onClick={() => openModal('pay')}>
                    Ghi nhận thanh toán
                  </Button>
                )}
              </Card>
            )}
            <Card variant="panel" title="Lịch sử phiếu">
              <div className="flex flex-col gap-2 text-xs">
                {(d?.history || [`${dmy(r.date)} · Phiếu được ${r.status === 'Đã hủy' ? 'hủy' : 'lưu'}`]).map((h) => <span key={h}>{h}</span>)}
              </div>
            </Card>
          </div>
        </div>

        <Foot>Phiếu ĐÃ NHẬP chỉ xem; thanh toán có danh sách khoản đã ghi (ngày, phương thức, số tiền, tham chiếu, người ghi); khoản bị hủy hiện gạch ngang.</Foot>
      </div>

      {m === 'pay' && canPay && <PayModal record={r} saving={detailQuery.paymentSaving} error={paymentError} onReload={async () => { await detailQuery.reload(); closeModal() }} onSave={async (value) => { await savePayment(value); closeModal() }} onClose={closeModal} />}
      {m === 'cancel' && canCancel && <CancelModal record={r} saving={detailQuery.voidSaving} error={voidError} onReload={async () => { await detailQuery.reload(); closeModal() }} onConfirm={async (reason) => { await cancelRecord(reason); closeModal() }} onClose={closeModal} />}
    </Layout>
  )
}
