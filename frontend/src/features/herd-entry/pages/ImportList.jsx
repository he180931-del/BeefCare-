import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, Foot, PageHeader, Segmented, StatusBadge, Table, Th, Td, Tile, inputCls } from '../../../components/ui'
import { useStore } from '../../../data/store'
import { dmy, kg, money } from '../../../data/format'

const TABS = ['Tất cả', 'Nháp', 'Đã nhập', 'Đã hủy']

export default function ImportList() {
  const { imports } = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState('Tất cả')
  const [type, setType] = useState('')

  const count = (t) => (t === 'Tất cả' ? imports.length : imports.filter((r) => r.status === t).length)
  const rows = imports.filter((r) => (tab === 'Tất cả' || r.status === tab) && (!type || r.type === type))
  const done = imports.filter((r) => r.status === 'Đã nhập')
  const bought = done.filter((r) => r.type === 'Mua ngoài')
  const owed = done.filter((r) => r.debt > 0)
  const sum = (list, f) => list.reduce((s, r) => s + f(r), 0)

  return (
    <Layout title="Phiếu nhập – Danh sách" user="manager">
      <PageHeader title="Nhập đàn" sub="Mỗi lần nhận bò vào trại lập 1 phiếu nhập; mỗi con được tạo mã nội bộ cố định và thẻ QR khi lưu.">
        <Button>Bê chờ xác nhận (2)</Button>
        <Button variant="primary" onClick={() => nav('/herd-entry/new')}>+ Tạo phiếu nhập</Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t, label: `${t} (${count(t)})` }))} />
        <div className="flex-1" />
        <select className={`${inputCls} !w-[200px]`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Loại nhập: Tất cả</option>
          <option>Mua ngoài</option>
          <option>Bê sinh tại trại</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Phiếu đã nhập" value={done.length} note={`${count('Nháp')} phiếu nháp chưa lưu`} />
        <Tile
          label="Số con đã nhập"
          value={sum(done, (r) => r.count)}
          note={`Mua ngoài ${sum(bought, (r) => r.count)} · Bê sinh tại trại ${sum(done.filter((r) => r.type !== 'Mua ngoài'), (r) => r.count)}`}
        />
        <Tile label="Tiền mua bò" value={`${money(sum(bought, (r) => r.total))} đ`} note="Gồm phí vận chuyển" />
        <Tile
          label="Còn nợ nguồn bán"
          value={`${money(sum(owed, (r) => r.debt))} đ`}
          note={owed.length ? `${owed.length} phiếu · ${owed[0].id}` : 'Không còn nợ'}
        />
      </div>

      <div className="rounded-md border border-edge bg-white p-2">
        <Table wide>
          <thead>
            <tr>
              <Th>Mã phiếu</Th><Th>Ngày nhập</Th><Th>Loại nhập</Th><Th>Nguồn / bò mẹ</Th><Th>Số con</Th>
              <Th>Tổng cân</Th><Th>Tổng tiền (đ)</Th><Th>Còn nợ (đ)</Th><Th>Trạng thái</Th><Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium">{r.id}</Td>
                <Td>{dmy(r.date)}</Td>
                <Td>{r.type}</Td>
                <Td>{r.source}</Td>
                <Td>{r.count}</Td>
                <Td>{kg(r.weight)}</Td>
                <Td>{r.total == null ? '—' : money(r.total)}</Td>
                <Td>{r.debt == null ? '—' : money(r.debt)}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td>
                  <Button variant="link" small onClick={() => nav(r.status === 'Nháp' ? '/herd-entry/new' : `/herd-entry/${r.id}`)}>
                    {r.status === 'Nháp' ? 'Tiếp tục' : 'Xem'}
                  </Button>
                </Td>
              </tr>
            ))}
            {!rows.length && <tr><Td colSpan={10} className="text-center text-muted">Không có phiếu nhập</Td></tr>}
          </tbody>
        </Table>
        <div className="flex p-3 text-[11px] text-muted">
          Hiển thị {rows.length} / {imports.length} phiếu
          <div className="flex-1" />
          <b className="text-xs font-semibold text-brand-dark">‹ Trước &nbsp;&nbsp; Sau ›</b>
        </div>
      </div>

      <Foot>
        Phiếu NHÁP chưa tạo hồ sơ bò, chưa đổi chuồng và công nợ. Phiếu ĐÃ NHẬP: sửa từng con tại Hồ sơ bò › Sửa bản ghi nhập đàn;
        chỉ hủy cả phiếu khi chưa con nào có sự kiện khác (GBR-33).
      </Foot>
    </Layout>
  )
}
