import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, Card, Docs, Foot, Info, Note, PageHeader, PaymentTable, StatusBadge, Table, Td, Th } from '../../../components/ui'
import { herdEntryApi, voidHerdEntry } from '../api/index.js'
import { useMutation, useQuery } from '../../../hooks/useApi'
import { dmy, kg, money } from '../../../data/format'

export default function ImportDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data: r, loading, error } = useQuery(() => herdEntryApi.get(id), [id])
  const { mutate: cancel, loading: cancelling } = useMutation(async (row) => {
    const cattleRows = row.detail?.cows?.map((cow) => ({ code: cow.code, barn: String(cow.barn || '').split(' ')[0] })) ?? []
    return voidHerdEntry(row.id, cattleRows)
  })

  if (loading) return <Layout title="Chi tiết phiếu nhập" user="manager"><p className="text-xs text-muted">Đang tải phiếu {id}…</p></Layout>
  if (error && !String(error.message).startsWith('Not found:')) return <Layout title="Chi tiết phiếu nhập" user="manager"><p className="text-xs text-err-fg">Không tải được phiếu: {error.message}</p></Layout>

  if (!r) {
    return (
      <Layout title="Chi tiết phiếu nhập" user="manager">
        <p>Không tìm thấy phiếu {id}. <Link to="/herd-entry" className="text-brand">Về danh sách</Link></p>
      </Layout>
    )
  }

  const d = r.detail
  const paid = d ? d.payments.reduce((s, p) => s + p.amount, 0) : r.total != null ? r.total - (r.debt || 0) : 0

  return (
    <Layout title={`Chi tiết phiếu nhập – ${r.status}`} user="manager">
      <PageHeader title={`Phiếu nhập ${r.id}`} badge={<StatusBadge status={r.status} />}>
        <Button onClick={() => window.print()}>In phiếu</Button>
        <Button disabled={cancelling || r.status === 'Đã hủy'} onClick={async () => { await cancel(r); nav('/herd-entry') }}>Hủy phiếu</Button>
        <Button onClick={() => nav('/herd-entry')}>← Danh sách</Button>
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
            <Table>
              <thead>
                <tr><Th>Mã bò</Th><Th>Thẻ tai</Th><Th>Giống · giới tính</Th><Th>Cân nhập</Th><Th>Chuồng nhận</Th><Th>Hiện tại</Th><Th>Thành tiền</Th></tr>
              </thead>
              <tbody>
                {d ? d.cows.map((c) => (
                  <tr key={c.code}>
                    <Td className="font-medium">{c.code}</Td><Td>{c.tag}</Td><Td>{c.breed}</Td><Td>{kg(c.weight)}</Td>
                    <Td>{c.barn}</Td><Td>{c.current}</Td><Td>{money(c.amount)}</Td>
                  </tr>
                )) : (
                  <tr><Td colSpan={7} className="text-center text-muted">Chưa có dữ liệu chi tiết từng con của phiếu này</Td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="font-semibold"><Td>{r.count} con</Td><Td /><Td /><Td>{kg(r.weight)}</Td><Td /><Td /><Td>{d ? money(d.cowsTotal) : ''}</Td></tr>
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
              {d && <PaymentTable payments={d.payments} />}
              {r.debt === 0 && <Note tone="ok">Đã thanh toán đủ – "Ghi nhận thanh toán" chỉ hiện khi còn nợ.</Note>}
              {r.debt > 0 && <Button block>Ghi nhận thanh toán</Button>}
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
    </Layout>
  )
}
