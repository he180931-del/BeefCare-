import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { Button, Card, Docs, Foot, Info, Note, PageHeader, StatusBadge, Table, Td, Th } from '../components/ui'
import { useModalParam } from '../components/Modal'
import { herdEntryApi } from '../api/herdEntryApi'
import { useMutation, useQuery } from '../hooks/useApi'
import { TODAY } from '../data/importsData'
import { dm, dmy, kg, money } from '../data/format'
import PayModal from './import/PayModal'
import CancelModal from './import/CancelModal'

const TH = 'px-1! first:pl-3! last:pr-3!'

const nowHM = () => new Date().toTimeString().slice(0, 5)

export default function ImportDetail() {
  const { id } = useParams()
  const [m, openModal, closeModal] = useModalParam()
  const query = useQuery(() => herdEntryApi.get(id), [id])
  const { mutate: updateEntry } = useMutation(({ recordId, patch }) => herdEntryApi.update(recordId, patch))
  const r = query.data

  if (!r && query.loading) {
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

  const d = r.detail
  const paid = d ? d.payments.reduce((s, p) => s + p.amount, 0) : r.total != null ? r.total - (r.debt || 0) : 0
  const canPay = Boolean(d) && r.debt > 0 && r.status === 'Đã nhập'
  const canCancel = r.status === 'Đã nhập'

  // Ghi thay đổi qua API, rồi tải lại phiếu và đóng modal.
  const savePayment = async (p) => {
    await updateEntry({
      recordId: r.id,
      patch: {
        debt: Math.max(r.debt - p.amount, 0),
        detail: {
          ...d,
          payments: [...d.payments, { date: p.date, by: p.by, method: p.method, ref: p.ref, amount: p.amount }],
          history: [...d.history, `${dm(TODAY)} ${nowHM()} · ${p.by} ghi nhận thanh toán ${money(p.amount)} đ`],
        },
      },
    })
    await query.refetch()
    closeModal()
  }

  const cancelRecord = async (reason) => {
    await updateEntry({
      recordId: r.id,
      patch: {
        status: 'Đã hủy',
        cancelReason: reason,
        source: `${r.source} · Hủy: ${reason}`,
        detail: d && { ...d, history: [...d.history, `${dm(TODAY)} ${nowHM()} · T. Q. Long hủy phiếu: ${reason}`] },
      },
    })
    await query.refetch()
    closeModal()
  }

  return (
    <Layout title={`Chi tiết phiếu nhập – ${r.status}`} user="manager">
      <div className="contents leading-[normal]">
        <PageHeader title={`Phiếu nhập ${r.id}`} badge={<StatusBadge status={r.status} />}>
          <Button onClick={() => window.print()}>In phiếu</Button>
          <Button disabled={!canCancel} onClick={() => openModal('cancel')}>Hủy phiếu</Button>
        </PageHeader>

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
                    <Th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {d ? d.cows.map((c) => (
                    <tr key={c.code}>
                      <Td className={`${TH} font-medium`}>{c.code}</Td>
                      <Td className={TH}>{c.tag}</Td>
                      <Td className={TH}>{c.breed}</Td>
                      <Td className={`${TH} whitespace-nowrap`}>{kg(c.weight)}</Td>
                      <Td className={TH}>{c.barn}</Td>
                      <Td className={TH}>{c.current}</Td>
                      <Td className={TH}>{money(c.amount)}</Td>
                      <Td className={TH} />
                    </tr>
                  )) : (
                    <tr>
                      <Td colSpan={8} className="text-center text-muted">Chưa có dữ liệu chi tiết từng con của phiếu này</Td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <Td className={TH}>{r.count} con</Td><Td className={TH} /><Td className={TH} />
                    <Td className={`${TH} whitespace-nowrap`}>{kg(r.weight)}</Td>
                    <Td className={TH} /><Td className={TH} />
                    <Td className={TH}>{d ? money(d.cowsTotal) : ''}</Td>
                    <Td className={TH} />
                  </tr>
                </tfoot>
              </Table>
              <p className="m-0 text-[11px] text-muted">
                Danh sách bò của phiếu đã nhập không sửa được. Sửa từng con tại Hồ sơ bò › Sửa bản ghi nhập đàn; hủy cả phiếu chỉ khi chưa con nào có sự kiện khác.
              </p>
            </Card>

            <Card title="Chứng từ đính kèm">
              {d ? <Docs docs={d.docs} /> : <span className="text-[11px] text-muted">Chưa có chứng từ</span>}
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
                      {d.payments.map((p) => (
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
                {canPay && r.debt > 0 && (
                  <Button block className="rounded-[4px] text-[13px] font-semibold" onClick={() => openModal('pay')}>
                    Ghi nhận thanh toán
                  </Button>
                )}
              </Card>
            )}
            <Card title="Lịch sử phiếu">
              <div className="flex flex-col gap-2 text-xs">
                {(d?.history || [`${dmy(r.date)} · Phiếu được ${r.status === 'Đã hủy' ? 'hủy' : 'lưu'}`]).map((h) => <span key={h}>{h}</span>)}
              </div>
            </Card>
          </div>
        </div>

        <Foot>Phiếu ĐÃ NHẬP chỉ xem; thanh toán có danh sách khoản đã ghi (ngày, phương thức, số tiền, tham chiếu, người ghi); khoản bị hủy hiện gạch ngang.</Foot>
      </div>

      {m === 'pay' && canPay && <PayModal record={r} onSave={savePayment} onClose={closeModal} />}
      {m === 'cancel' && canCancel && <CancelModal record={r} onConfirm={cancelRecord} onClose={closeModal} />}
    </Layout>
  )
}
