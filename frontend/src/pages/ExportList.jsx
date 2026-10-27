import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { Badge, Button, Foot, PageHeader, Segmented, Select, Table, Td, Th, Tile } from '../components/ui'
import { dmy, money } from '../data/format'
import { herdExitApi } from '../api/herdExitApi'
import { useQuery } from '../hooks/useApi'
import { TH, cx } from './export/parts'

const TABS = [
  { value: 'Tất cả', match: () => true },
  { value: 'Nháp', match: (r) => r.status === 'Nháp' },
  { value: 'Chờ xác nhận', match: (r) => r.status === 'Chờ xác nhận' },
  { value: 'Đã xuất', match: (r) => r.status === 'Đã xuất' },
  { value: 'Đã hủy / bác', match: (r) => r.status === 'Đã hủy' || r.status === 'Đã bác' },
]
// Khoảng ngày: 'all' = từ 01/07; 'oct' = từ 01/10 (lọc hàng theo ngày xuất).
const RANGES = [
  { value: 'all', label: '01/07/2026 – 22/10/2026', from: '2026-07-01' },
  { value: 'oct', label: '01/10/2026 – 22/10/2026', from: '2026-10-01' },
]
const TONE = { 'Chờ xác nhận': 'warn', 'Đã xuất': 'ok', 'Đã hủy': 'err' }

const StatusTag = ({ status }) => {
  const tone = TONE[status]
  return <Badge tone={tone} className={tone ? '!border-0' : undefined}>{status}</Badge>
}

const COLS = [
  ['Mã phiếu', 'w-[116px]'], ['Ngày xuất', 'w-[86px]'], ['Loại xuất', 'w-[78px]'], ['Người mua / lý do', 'w-[220px]'],
  ['Số con', 'w-[56px]'], ['Tổng cân', 'w-[78px]'], ['Tổng tiền (đ)', 'w-[100px]'], ['Còn phải thu (đ)', 'w-[100px]'], ['Trạng thái', 'w-[108px]'],
]

export default function ExportList() {
  const { data, loading } = useQuery(() => herdExitApi.list(), [])
  const herdExits = data ?? []
  const nav = useNavigate()
  const [tab, setTab] = useState('Tất cả')
  const [range, setRange] = useState('all')
  const [type, setType] = useState('')

  const current = TABS.find((t) => t.value === tab)
  const from = RANGES.find((r) => r.value === range).from
  const rows = herdExits.filter((r) => current.match(r) && (!type || r.type === type) && r.date >= from)
  const done = herdExits.filter((r) => r.status === 'Đã xuất')
  const owed = done.filter((r) => r.due > 0)
  const pending = herdExits.filter((r) => r.status === 'Chờ xác nhận')
  const byType = (t) => done.filter((r) => r.type === t).reduce((s, r) => s + r.count, 0)

  const action = (r) => {
    if (r.status === 'Nháp') return ['Tiếp tục', '/herd-exit/new']
    if (r.status === 'Chờ xác nhận') return ['Xem & xác nhận', `/herd-exit/${r.id}`]
    return ['Xem', `/herd-exit/${r.id}`]
  }

  return (
    <Layout title="Phiếu xuất – Danh sách">
      <PageHeader title="Xuất đàn" sub="Chủ trại lập và xác nhận phiếu xuất · bò trong phiếu chuyển ĐÃ XUẤT khi xác nhận.">
        <Button variant="primary" className="!border-0" onClick={() => nav('/herd-exit/new')}>+ Tạo phiếu xuất</Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({ value: t.value, label: `${t.value} (${herdExits.filter(t.match).length})` }))}
        />
        <div className="flex-1" />
        <Select className="w-[220px]" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Khoảng ngày">
          {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
        <Select className="w-[170px]" value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại xuất">
          <option value="">Loại xuất: Tất cả</option>
          <option>Bán</option><option>Loại thải</option><option>Chết / mất</option><option>Khác</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Con đã xuất (từ 01/07)" value={done.reduce((s, r) => s + r.count, 0)} note={`Bán ${byType('Bán')} · Loại thải ${byType('Loại thải')} · Chết ${byType('Chết / mất')}`} />
        <Tile label="Doanh thu bán bò" value={`${money(done.reduce((s, r) => s + (r.total || 0), 0))} đ`} note={`${done.length} phiếu đã xuất`} />
        <Tile warn label="Còn phải thu" value={`${money(owed.reduce((s, r) => s + r.due, 0))} đ`} note={owed.length ? `${owed.length} phiếu · ${owed[0].id}` : 'Không còn nợ'} />
        <Tile label="Chờ chủ trại xác nhận" value={pending.length} note="Đề xuất từ ca sức khỏe" />
      </div>

      <div className="rounded-md border border-edge bg-white p-2">
        <Table wide>
          <thead>
            <tr>
              {COLS.map(([label, w]) => <Th key={label} className={cx(TH, w)}>{label}</Th>)}
              <Th className={TH} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const [label, to] = action(r)
              return (
                <tr key={r.id}>
                  <Td className={cx(TH, 'font-medium')}>{r.id}</Td>
                  <Td className={TH}>{dmy(r.date)}</Td>
                  <Td className={TH}>{r.type}</Td>
                  <Td className={TH}>{r.who}<br />{r.sub}</Td>
                  <Td className={TH}>{r.count}</Td>
                  <Td className={TH}>{r.weight || '—'}</Td>
                  <Td className={TH}>{r.total == null ? '—' : money(r.total)}</Td>
                  <Td className={TH}>{r.due == null ? '—' : money(r.due)}{r.dueNote && <><br />{r.dueNote}</>}</Td>
                  <Td className={TH}><StatusTag status={r.status} /></Td>
                  <Td className={TH}><Button variant="link" small onClick={() => nav(to)}>{label}</Button></Td>
                </tr>
              )
            })}
            {!rows.length && <tr><Td colSpan={10} className="text-center text-muted">{loading ? 'Đang tải…' : 'Không có phiếu xuất'}</Td></tr>}
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
