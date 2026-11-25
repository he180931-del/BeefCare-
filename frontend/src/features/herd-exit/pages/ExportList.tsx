import { Link, useNavigate } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Button, DateInput, FilterSelect, Foot, Icon, Metric, Note, PageHeader, Segmented, Table, Td, Th } from '../../../shared/ui'
import { dm, dmy, money } from '../../../shared/lib/format'
import { userFacingError } from '../../../shared/api/userFacingError'
import { ExitStatusBadge, TH, cx, useIsOwner } from '../components/parts'
import { useExitList, type ExitSort } from '../hooks/useExitList'
import { useRouteNotice } from '../hooks/useRouteNotice'
import { exitWeightLabel } from '../domain/exitDisplay'
import type { ExitType } from '../types'

const EXIT_TYPES: ExitType[] = ['Bán', 'Loại thải', 'Chết / mất', 'Khác']
const LOAD_ERROR = 'Không tải được danh sách phiếu xuất. Vui lòng thử lại.'
// Last column stays pinned on the right so the action is visible at 1280 px without horizontal scrolling.
const STICKY = 'sticky right-0 bg-white shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]'

function SortHeader({ label, sortKey, sort, onSort, className }: { label: string; sortKey: ExitSort['key']; sort: ExitSort; onSort: (key: ExitSort['key']) => void; className?: string }) {
  const active = sort.key === sortKey
  return (
    <Th className={cx(TH, className)} aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="cursor-pointer whitespace-nowrap font-semibold" onClick={() => onSort(sortKey)} aria-label={`Sắp xếp theo ${label.toLowerCase()}`}>
        {label} {active ? (sort.descending ? '▼' : '▲') : '↕'}
      </button>
    </Th>
  )
}

export default function ExportList() {
  const nav = useNavigate()
  const isOwner = useIsOwner()
  const [notice] = useRouteNotice()
  const list = useExitList(isOwner)
  const { result, loading, error, retry, tab, setTab, tabs, period, setPeriod, periodError, presets, preset, choosePreset, type, setType, sort, toggleSort, rows, action } = list
  const tiles = result?.tiles
  const byType = tiles ? EXIT_TYPES.filter((item) => tiles.cattleExitedByType[item] > 0).map((item) => `${item === 'Chết / mất' ? 'Chết' : item} ${tiles.cattleExitedByType[item]}`).join(' · ') : ''

  return (
    <Layout title="Phiếu xuất – Danh sách">
      <PageHeader title="Xuất đàn" sub="Chủ trại lập và xác nhận phiếu xuất · bò trong phiếu chuyển ĐÃ XUẤT khi xác nhận.">
        {isOwner && <Button variant="primary" onClick={() => nav('/herd-exit/new')}><Icon name="circle-plus" />Tạo phiếu xuất</Button>}
      </PageHeader>

      {notice && <Note tone="ok">{notice}</Note>}

      <div className="flex flex-wrap items-start gap-2.5">
        <Segmented value={tab} onChange={setTab} options={tabs.map((t) => ({ value: t.value, label: `${t.value} (${t.count})` }))} />
        <div className="flex-1" />
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect className="w-[170px]" value={preset} onChange={(e) => choosePreset(e.target.value)} aria-label="Kỳ nhanh">
              {preset === 'custom' && <option value="custom">Tùy chọn</option>}
              {presets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </FilterSelect>
            <DateInput className="w-[150px]" label="Từ ngày" value={period.from} onChange={(from) => setPeriod({ ...period, from })} />
            <span className="text-xs text-muted">–</span>
            <DateInput className="w-[150px]" label="Đến ngày" value={period.to} onChange={(to) => setPeriod({ ...period, to })} />
          </div>
          {periodError && <span role="alert" className="text-[11px] text-err-fg">{periodError}</span>}
        </div>
        <FilterSelect className="w-[170px]" value={type} onChange={(e) => setType(e.target.value as ExitType | '')} aria-label="Loại xuất">
          <option value="">Loại xuất: Tất cả</option>
          {EXIT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
        </FilterSelect>
      </div>

      {/* Bento (Figma Tab 16 ④b): số liệu do máy chủ tính theo kỳ và loại đang chọn (SCR-41 #5–#8). */}
      <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <Metric surface="panel" tone="emphasis" label={`Con đã xuất (${dm(period.from)} – ${dm(period.to)})`} value={tiles?.cattleExited ?? '—'} note={byType || 'Chưa có con nào xuất trong kỳ'} />
        <Metric compact surface="panel" tone={(tiles?.salesRevenue ?? 0) > 0 ? 'ok' : 'default'} label="Doanh thu bán bò" value={`${money(tiles?.salesRevenue)} đ`} note="Phiếu Bán, Loại thải đã xuất" />
        <Metric compact surface="panel" tone={(tiles?.toCollect ?? 0) > 0 ? 'warn' : 'default'} warn={(tiles?.toCollect ?? 0) > 0} label="Còn phải thu" value={`${money(tiles?.toCollect)} đ`} note={tiles?.vouchersToCollect ? `${tiles.vouchersToCollect} phiếu` : 'Không còn nợ'} />
        <Metric compact surface="panel" tone={(tiles?.awaitingOwner ?? 0) > 0 ? 'err' : 'default'} label="Chờ chủ trại xác nhận" value={tiles?.awaitingOwner ?? '—'} note="Đề xuất từ ca sức khỏe" />
      </div>

      <div className="min-w-0 rounded-2xl border border-field bg-white p-2">
        <Table scroll>
          <thead>
            <tr>
              <SortHeader label="Mã phiếu" sortKey="id" sort={sort} onSort={toggleSort} className="min-w-[108px]" />
              <SortHeader label="Ngày xuất" sortKey="date" sort={sort} onSort={toggleSort} className="min-w-[88px]" />
              <Th className={cx(TH, 'min-w-[64px]')}>Loại xuất</Th>
              <Th className={cx(TH, 'min-w-[150px]')}>Người mua / lý do</Th>
              <Th className={cx(TH, 'min-w-[48px]')}>Số con</Th>
              <Th className={cx(TH, 'min-w-[64px]')}>Tổng cân</Th>
              <Th className={cx(TH, 'min-w-[80px]')}>Tổng tiền (đ)</Th>
              <Th className={cx(TH, 'min-w-[80px]')}>Còn phải thu (đ)</Th>
              <Th className={cx(TH, 'min-w-[112px]')}>Trạng thái</Th>
              <Th className={cx(TH, STICKY)}><span className="sr-only">Thao tác</span></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const [label, to] = action(r)
              const closed = r.status === 'Đã hủy' || r.status === 'Đã bác'
              const closeReason = String(r.reason || r.cancelReason || '')
              return (
                <tr key={r.id}>
                  <Td className={cx(TH, 'whitespace-nowrap font-medium')}><Link to={to} className="text-brand hover:underline">{r.id}</Link></Td>
                  <Td className={cx(TH, 'whitespace-nowrap')}>{dmy(r.date)}</Td>
                  <Td className={cx(TH, 'whitespace-nowrap')}>{r.type}</Td>
                  <Td className={TH}>
                    <div>{r.who || '—'}</div>
                    {r.sub && <div className="text-[11px] text-muted">{r.sub}</div>}
                    {(r.pens ?? []).length > 0 && <div className="text-[11px] text-muted">Chuồng {(r.pens ?? []).join(', ')}</div>}
                  </Td>
                  <Td className={TH}>{r.count}</Td>
                  <Td className={cx(TH, 'whitespace-nowrap')}>{exitWeightLabel(r)}</Td>
                  <Td className={cx(TH, 'whitespace-nowrap')}>{r.total == null ? '—' : money(r.total)}</Td>
                  <Td className={cx(TH, 'whitespace-nowrap')}>{r.due == null ? '—' : money(r.due)}{r.dueNote && <><br />{r.dueNote}</>}</Td>
                  <Td className={TH}>
                    <ExitStatusBadge status={r.status} />
                    {closed && closeReason && <div className="mt-1 max-w-[160px] truncate text-[11px] text-muted" title={closeReason}>{closeReason}</div>}
                  </Td>
                  <Td className={cx(TH, STICKY)}><Button variant="link" small onClick={() => nav(to)}>{label}</Button></Td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <Td colSpan={10} className="text-center text-muted">
                  {loading ? 'Đang tải…' : error ? (
                    <span role="alert" className="inline-flex flex-wrap items-center justify-center gap-2 text-err-fg">
                      {userFacingError(error, LOAD_ERROR)}
                      <Button small onClick={() => { void retry() }}>Thử lại</Button>
                    </span>
                  ) : 'Không có phiếu xuất trong kỳ'}
                </Td>
              </tr>
            )}
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
