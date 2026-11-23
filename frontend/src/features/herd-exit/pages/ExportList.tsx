import { useNavigate } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Button, FilterSelect, Foot, Icon, Metric, PageHeader, Segmented, Table, Td, Th } from '../../../shared/ui'
import { dmy, money } from '../../../shared/lib/format'
import { ExitStatusBadge, TH, cx, useIsOwner } from '../components/parts'
import { useExitList } from '../hooks/useExitList'

const COLS = [
  ['Mã phiếu', 'min-w-[116px]'], ['Ngày xuất', 'min-w-[86px]'], ['Loại xuất', 'min-w-[78px]'], ['Người mua / lý do', 'min-w-[220px]'],
  ['Số con', 'min-w-[56px]'], ['Tổng cân', 'min-w-[78px]'], ['Tổng tiền (đ)', 'min-w-[100px]'], ['Còn phải thu (đ)', 'min-w-[100px]'], ['Trạng thái', 'min-w-[108px]'],
]

export default function ExportList() {
  const nav = useNavigate()
  const isOwner = useIsOwner()
  const list = useExitList(isOwner)
  const { data: herdExits, loading, error, tab, setTab, range, setRange, type, setType, rows, tabs, ranges, summary, action } = list

  return (
    <Layout title="Phiếu xuất – Danh sách">
      <PageHeader title="Xuất đàn" sub="Chủ trại lập và xác nhận phiếu xuất · bò trong phiếu chuyển ĐÃ XUẤT khi xác nhận.">
        {isOwner && <Button variant="primary" onClick={() => nav('/herd-exit/new')}><Icon name="circle-plus" />Tạo phiếu xuất</Button>}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={tabs.map((t) => ({ value: t.value, label: `${t.value} (${herdExits.filter(t.match).length})` }))}
        />
        <div className="flex-1" />
        <FilterSelect className="w-[220px]" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Khoảng ngày">
          {ranges.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </FilterSelect>
        <FilterSelect className="w-[170px]" value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại xuất">
          <option value="">Loại xuất: Tất cả</option>
          <option>Bán</option><option>Loại thải</option><option>Chết / mất</option><option>Khác</option>
        </FilterSelect>
      </div>

      {/* Bento (Figma Tab 16 ④b): khối nổi bật là số con đã xuất; doanh thu xanh nhạt, còn phải thu vàng, chờ xác nhận đỏ
          nhạt — chỉ khi có số liệu. */}
      <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <Metric surface="panel" tone="emphasis" label="Con đã xuất (từ 01/07)" value={summary.doneCount} note={`Bán ${summary.byType['Bán']} · Loại thải ${summary.byType['Loại thải']} · Chết ${summary.byType['Chết / mất']}`} />
        <Metric compact surface="panel" tone={summary.revenue > 0 ? 'ok' : 'default'} label="Doanh thu bán bò" value={`${money(summary.revenue)} đ`} note={`${summary.doneVoucherCount} phiếu đã xuất`} />
        <Metric compact surface="panel" tone={summary.owed > 0 ? 'warn' : 'default'} warn={summary.owed > 0} label="Còn phải thu" value={`${money(summary.owed)} đ`} note={summary.owedCount ? `${summary.owedCount} phiếu · ${summary.firstOwedId}` : 'Không còn nợ'} />
        <Metric compact surface="panel" tone={summary.pendingCount > 0 ? 'err' : 'default'} label="Chờ chủ trại xác nhận" value={summary.pendingCount} note="Đề xuất từ ca sức khỏe" />
      </div>

      <div className="min-w-0 rounded-2xl border border-field bg-white p-2">
        <Table scroll>
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
                  <Td className={cx(TH, 'whitespace-nowrap font-medium')}>{r.id}</Td>
                  <Td className={cx(TH, 'whitespace-nowrap')}>{dmy(r.date)}</Td>
                  <Td className={cx(TH, 'whitespace-nowrap')}>{r.type}</Td>
                  <Td className={TH}>{r.who}<br />{r.sub}</Td>
                  <Td className={TH}>{r.count}</Td>
                  <Td className={cx(TH, 'whitespace-nowrap')}>{r.weight || '—'}</Td>
                  <Td className={cx(TH, 'whitespace-nowrap')}>{r.total == null ? '—' : money(r.total)}</Td>
                  <Td className={cx(TH, 'whitespace-nowrap')}>{r.due == null ? '—' : money(r.due)}{r.dueNote && <><br />{r.dueNote}</>}</Td>
                  <Td className={TH}><ExitStatusBadge status={r.status} /></Td>
                  <Td className={TH}><Button variant="link" small onClick={() => nav(to)}>{label}</Button></Td>
                </tr>
              )
            })}
            {!rows.length && <tr><Td colSpan={10} className="text-center text-muted">{loading ? 'Đang tải…' : error ? String(error) : 'Không có phiếu xuất'}</Td></tr>}
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
