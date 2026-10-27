import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { Badge, Button, Card, Docs, Foot, Info, PageHeader, PaymentTable, StatusBadge, Table, Td, Th } from '../components/ui'
import { useStore } from '../data/store'
import { dmy, kg, money } from '../data/format'

export default function ExportDetail() {
  const { id } = useParams()
  const { exports, updateExport } = useStore()
  const nav = useNavigate()
  const r = exports.find((x) => x.id === id)

  if (!r) {
    return (
      <Layout title="Chi tiết phiếu xuất">
        <p>Không tìm thấy phiếu {id}. <Link to="/xuat" className="text-brand">Về danh sách</Link></p>
      </Layout>
    )
  }

  const d = r.detail
  const collected = d ? d.payments.reduce((s, p) => s + p.amount, 0) : r.total != null ? r.total - (r.due || 0) : 0
  const resolve = (status) => {
    updateExport(r.id, { status })
    nav('/xuat')
  }

  return (
    <Layout title={`Chi tiết phiếu xuất – ${r.status}`}>
      <PageHeader title={`Phiếu xuất ${r.id}`} badge={<StatusBadge status={r.status} />}>
        {r.status === 'Chờ xác nhận' && (
          <>
            <Button variant="primary" onClick={() => resolve('Đã xuất')}>Xác nhận xuất</Button>
            <Button onClick={() => resolve('Đã bác')}>Bác đề xuất</Button>
          </>
        )}
        <Button onClick={() => window.print()}>In phiếu</Button>
        <Button disabled={r.status !== 'Đã xuất'} onClick={() => resolve('Đã hủy')}>Hủy phiếu</Button>
        <Button onClick={() => nav('/xuat')}>← Danh sách</Button>
      </PageHeader>

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Card title="Thông tin phiếu">
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
              ]}
            />
          </Card>

          <Card title="Bò trong phiếu" sub={`${r.count} con${r.weight ? ` · ${r.weight}` : ''}`}>
            <Table>
              <thead>
                <tr><Th>Mã bò</Th><Th>Thẻ tai</Th><Th>Giống · giới tính</Th><Th>Cân xuất</Th><Th>Chuồng cuối</Th><Th>Trạng thái</Th><Th>Thành tiền</Th></tr>
              </thead>
              <tbody>
                {d ? d.cows.map((c) => (
                  <tr key={c.code}>
                    <Td className="font-medium">{c.code}</Td><Td>{c.tag}</Td><Td>{c.breed}</Td><Td>{kg(c.weight)}</Td>
                    <Td>{c.barn}</Td><Td><Badge tone="ok">Đã xuất</Badge></Td><Td>{money(c.amount)}</Td>
                  </tr>
                )) : (
                  <tr><Td colSpan={7} className="text-center text-muted">Chưa có dữ liệu chi tiết từng con của phiếu này</Td></tr>
                )}
              </tbody>
              {d && (
                <tfoot>
                  <tr className="font-semibold"><Td>{r.count} con</Td><Td /><Td /><Td>{r.weight}</Td><Td /><Td /><Td>{money(d.cowsTotal)}</Td></tr>
                </tfoot>
              )}
            </Table>
            <div className="rounded-md bg-chip px-3 py-2.5 text-xs">
              Bò đã xuất chỉ còn xem, hồ sơ giữ toàn bộ lịch sử. Hủy phiếu đưa cả {r.count} con về ACTIVE (GBR-26).
            </div>
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
                  ['Tiền bò', d ? `${money(d.cowsTotal)} đ` : `${money(r.total)} đ`],
                  ['Khấu trừ', `${money(d?.deduction || 0)} đ`],
                  ['Tổng phải thu', `${money(r.total)} đ`],
                  ['Đã thu', `${money(collected)} đ`],
                  ['Còn phải thu', `${money(r.due || 0)} đ`, r.due > 0],
                ]}
              />
              {d && <PaymentTable payments={d.payments} />}
              {r.status === 'Đã xuất' && r.due > 0 && <Button block>Ghi nhận thu tiền</Button>}
            </Card>
          )}
          <Card title="Lịch sử phiếu">
            <div className="flex flex-col gap-2 text-xs">
              {(d?.history || [`${dmy(r.date)} · Phiếu ở trạng thái ${r.status}`]).map((h) => <span key={h}>{h}</span>)}
            </div>
          </Card>
        </div>
      </div>

      <Foot>Chủ trại in phiếu, ghi nhận thu tiền (khi còn phải thu) và hủy phiếu đã xuất; Quản lý chỉ xem.</Foot>
    </Layout>
  )
}
