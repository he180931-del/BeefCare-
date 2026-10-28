import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, Foot, PageHeader, Segmented, StatusBadge, Table, Td, Th, Tile, inputCls } from '../../../components/ui'
import { useStore } from '../../../data/store'
import { dmy, money } from '../../../data/format'

const TABS = [
  { value: 'Tất cả', match: () => true },
  { value: 'Nháp', match: (r) => r.status === 'Nháp' },
  { value: 'Chờ xác nhận', match: (r) => r.status === 'Chờ xác nhận' },
  { value: 'Đã xuất', match: (r) => r.status === 'Đã xuất' },
  { value: 'Đã hủy / bác', match: (r) => r.status === 'Đã hủy' || r.status === 'Đã bác' },
]

export default function ExportList() {
  const { exports } = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState('Tất cả')
  const [type, setType] = useState('')

  const current = TABS.find((t) => t.value === tab)
  const rows = exports.filter((r) => current.match(r) && (!type || r.type === type))
  const done = exports.filter((r) => r.status === 'Đã xuất')
  const owed = done.filter((r) => r.due > 0)
  const pending = exports.filter((r) => r.status === 'Chờ xác nhận')
  const byType = (t) => done.filter((r) => r.type === t).reduce((s, r) => s + r.count, 0)

  const action = (r) => {
    if (r.status === 'Nháp') return ['Tiếp tục', '/herd-exit/new']
    if (r.status === 'Chờ xác nhận') return ['Xem & xác nhận', `/herd-exit/${r.id}`]
    return ['Xem', `/herd-exit/${r.id}`]
  }

  return (
    <Layout title="Phiếu xuất – Danh sách">
      <PageHeader title="Xuất đàn" sub="Chủ trại lập và xác nhận phiếu xuất · bò trong phiếu chuyển ĐÃ XUẤT khi xác nhận.">
        <Button variant="primary" onClick={() => nav('/herd-exit/new')}>+ Tạo phiếu xuất</Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({ value: t.value, label: `${t.value} (${exports.filter(t.match).length})` }))}
        />
        <div className="flex-1" />
        <select className={`${inputCls} !w-[170px]`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Loại xuất: Tất cả</option>
          <option>Bán</option><option>Loại thải</option><option>Chết / mất</option><option>Khác</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Con đã xuất" value={done.reduce((s, r) => s + r.count, 0)} note={`Bán ${byType('Bán')} · Loại thải ${byType('Loại thải')} · Chết ${byType('Chết / mất')}`} />
        <Tile label="Doanh thu bán bò" value={`${money(done.reduce((s, r) => s + (r.total || 0), 0))} đ`} note={`${done.length} phiếu đã xuất`} />
        <Tile warn label="Còn phải thu" value={`${money(owed.reduce((s, r) => s + r.due, 0))} đ`} note={owed.length ? `${owed.length} phiếu · ${owed[0].id}` : 'Không còn nợ'} />
        <Tile label="Chờ chủ trại xác nhận" value={pending.length} note="Đề xuất từ ca sức khỏe" />
      </div>

      <div className="rounded-md border border-edge bg-white p-2">
        <Table wide>
          <thead>
            <tr>
              <Th>Mã phiếu</Th><Th>Ngày xuất</Th><Th>Loại xuất</Th><Th>Người mua / lý do</Th><Th>Số con</Th>
              <Th>Tổng cân</Th><Th>Tổng tiền (đ)</Th><Th>Còn phải thu (đ)</Th><Th>Trạng thái</Th><Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const [label, to] = action(r)
              return (
                <tr key={r.id}>
                  <Td className="font-medium">{r.id}</Td>
                  <Td>{dmy(r.date)}</Td>
                  <Td>{r.type}</Td>
                  <Td>{r.who}<br />{r.sub}</Td>
                  <Td>{r.count}</Td>
                  <Td>{r.weight || '—'}</Td>
                  <Td>{r.total == null ? '—' : money(r.total)}</Td>
                  <Td>{r.due == null ? '—' : money(r.due)}{r.dueNote && <><br />{r.dueNote}</>}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td><Button variant="link" small onClick={() => nav(to)}>{label}</Button></Td>
                </tr>
              )
            })}
            {!rows.length && <tr><Td colSpan={10} className="text-center text-muted">Không có phiếu xuất</Td></tr>}
          </tbody>
        </Table>
      </div>

      <Foot>
        Ca sức khỏe đóng với kết quả Chết / Mất tích tự tạo phiếu CHỜ XÁC NHẬN cho Chủ trại; bò vẫn ACTIVE đến khi xác nhận.
        Hủy phiếu đã xuất đưa toàn bộ bò trong phiếu về ACTIVE. Quản lý chỉ xem.
      </Foot>
    </Layout>
  )
}
