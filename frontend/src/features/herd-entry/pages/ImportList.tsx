import { businessDate } from '../../../shared/lib/date/farmTime'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Button, FilterSelect, Foot, Icon, inputCls, Metric, PageHeader, Segmented, Table, Td, Th } from '../../../shared/ui'
import { EntryStatusBadge } from '../components/parts'
import { dm, dmy, kg, money } from '../../../shared/lib/format'
import { herdEntryError } from '../api/herdEntryError'
import { useEntryList } from '../hooks/useEntryList'
import { previousQuarterStart } from '../domain/entryDateFilters'
import { DEFAULT_ENTRY_SORT, entryPage, sortEntryRows, type EntrySort, type EntrySortField } from '../domain/entryListPaging'
import type { HerdEntry } from '../types'

const TH = 'px-1! first:pl-3! last:pr-3!'
const TABS = ['Tất cả', 'Nháp', 'Đã nhập', 'Đã hủy']
// Keep the initial filter aligned with the actual current date.  The previous
// fixed 2026-10-22 end date made a newly posted voucher disappear from the
// list when the entry date was today (and made it look as if saving failed).
const DEFAULT_TO = businessDate()
const DEFAULT_FROM = previousQuarterStart(DEFAULT_TO)

const subLine = (text: string, title?: string) => <span className="block max-w-[220px] truncate text-[11px] text-muted" title={title ?? text}>{text}</span>

/** SCR-23 #14: seller + quarantine certificate, or the dams of the farm-born calves. */
function sourceCell(row: HerdEntry): ReactNode {
  if (row.type === 'Bê sinh tại trại') return row.damCodes?.length ? `Mẹ: ${row.damCodes.join(', ')}` : '—'
  return <>{row.source || '—'}{row.quarantine && subLine(`GKD ${row.quarantine}`)}</>
}

export default function ImportList() {
  const [tab, setTabValue] = useState('Tất cả')
  const [type, setTypeValue] = useState('')
  const [source, setSourceValue] = useState('')
  const [from, setFrom] = useState(DEFAULT_FROM)
  const [to, setTo] = useState(DEFAULT_TO)
  const [sort, setSort] = useState<EntrySort>(DEFAULT_ENTRY_SORT)
  const [pageNumber, setPageNumber] = useState(1)
  // Changing a tab or a filter starts again from page 1.
  const setTab = (value: string) => { setTabValue(value); setPageNumber(1) }
  const setType = (value: string) => { setTypeValue(value); setPageNumber(1) }
  const setSource = (value: string) => { setSourceValue(value); setPageNumber(1) }
  const { rows, loading, error, refetch, summary, pendingCalves: pending, sellers } = useEntryList({ tab, type, source: source ? { id: source, name: '' } : undefined, from, to })
  const tiles = summary.tiles
  const counts = summary.counts
  const ready = summary.ready
  const shown = (v: string | number) => (ready ? v : '—')
  const nav = useNavigate()
  const [dateOpen, setDateOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)

  const paged = entryPage(sortEntryRows(rows, sort), pageNumber)
  const owedVouchers = Array.isArray(tiles.owedVouchers) ? tiles.owedVouchers.length : 0
  const changeSort = (field: EntrySortField) => {
    setSort(current => current.field === field ? { field, descending: !current.descending } : { field, descending: field === 'date' })
    setPageNumber(1)
  }
  const sortHeader = (field: EntrySortField, label: string, width: string) => (
    <Th className={`${TH} ${width}`} aria-sort={sort.field === field ? (sort.descending ? 'descending' : 'ascending') : undefined}>
      <button type="button" className="cursor-pointer whitespace-nowrap font-semibold hover:underline" onClick={() => changeSort(field)}>
        {label} <span aria-hidden="true">{sort.field === field ? (sort.descending ? '↓' : '↑') : '↕'}</span>
      </button>
    </Th>
  )

  const count = (t: string) => t === 'Tất cả' ? (counts.ALL ?? rows.length) : t === 'Nháp' ? (counts.DRAFT ?? 0) : t === 'Đã nhập' ? (counts.POSTED ?? 0) : (counts.VOIDED ?? 0)

  const applyDate = () => {
    setFrom(draftFrom)
    setTo(draftTo)
    setDateOpen(false)
    setPageNumber(1)
  }

  return (
    <Layout title="Phiếu nhập – Danh sách" user="manager">
      <div className="contents leading-[normal]">
        <PageHeader title="Nhập đàn" sub="Mỗi lần nhận bò vào trại lập 1 phiếu nhập; mỗi con được cấp mã bò và thẻ QR khi lưu.">
            <Button onClick={() => nav('/herd-entry/new?kind=calf', { state: { from: '/herd-entry' } })}>Bê chờ xác nhận ({pending?.length ?? 0})</Button>
            <Button variant="primary" onClick={() => nav('/herd-entry/new', { state: { from: '/herd-entry' } })}><Icon name="circle-plus" />Tạo phiếu nhập</Button>
        </PageHeader>

        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t, label: `${t} (${count(t)})` }))} />
          <div className="flex-1" />
          <div className="relative w-[240px]">
            <button
              type="button"
              onClick={() => {
                setDraftFrom(from)
                setDraftTo(to)
                setDateOpen(!dateOpen)
              }}
              className={`${inputCls} flex h-[38px] w-[240px] cursor-pointer items-center gap-1.5 whitespace-nowrap py-0 text-left text-xs`}
            >
              <span className="min-w-0 flex-1">{`${dmy(from)} – ${dmy(to)}`}</span>
              <Icon name="calendar-event" className="text-[#66756b]" />
            </button>
            {dateOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-10 flex w-[260px] flex-col gap-2.5 rounded-xl border border-field bg-white p-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                  Từ ngày
                  <input type="date" className={inputCls} value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                  Đến ngày
                  <input type="date" className={inputCls} value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
                </label>
                <Button variant="primary" block onClick={applyDate}>Áp dụng</Button>
              </div>
            )}
          </div>
          <FilterSelect className="w-[200px]" value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại nhập">
            <option value="">Loại nhập: Tất cả</option>
            <option value="Mua ngoài">Mua ngoài</option>
            <option value="Bê sinh tại trại">Bê sinh tại trại</option>
          </FilterSelect>
          <FilterSelect className="w-[200px]" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Nguồn">
            <option value="">Nguồn: Tất cả</option>
            {(sellers ?? []).map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
          </FilterSelect>
        </div>

        {/* Bento (Figma Tab 16 ②b): khối nổi bật là số phiếu đã nhập; số con xanh nhạt, công nợ vàng khi còn nợ. */}
        <div className="@container">
        <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <Metric
            surface="panel"
            tone="emphasis"
            label={`Phiếu đã nhập (từ ${dm(from)})`}
            value={shown(Number(tiles.postedVouchers ?? 0))}
            note={`${Number(tiles.draftVouchers ?? 0)} phiếu nháp chưa lưu`}
          />
          <Metric
            compact
            surface="panel"
            tone={Number(tiles.cattleEntered ?? 0) > 0 ? 'ok' : 'default'}
            label="Số con đã nhập"
            value={shown(Number(tiles.cattleEntered ?? 0))}
            note={`Mua ngoài ${Number(tiles.cattlePurchased ?? 0)} · Bê sinh tại trại ${Number(tiles.cattleFarmBorn ?? 0)}`}
          />
          <Metric compact surface="panel" label="Tiền mua bò" value={shown(`${money(Number(tiles.purchaseAmount ?? 0))} đ`)} note="Gồm phí vận chuyển" />
          <Metric
            compact
            surface="panel"
            tone={Number(tiles.owedToSellers ?? 0) > 0 ? 'warn' : 'default'}
            label="Còn nợ nguồn bán"
            value={shown(`${money(Number(tiles.owedToSellers ?? 0))} đ`)}
            note={Number(tiles.owedToSellers ?? 0) > 0 ? `${owedVouchers} phiếu còn nợ` : 'Không còn nợ'}
          />
        </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-field bg-white p-2">
          <Table scroll>
            <thead>
              <tr>
                {sortHeader('code', 'Mã phiếu', 'w-[110px]')}
                {sortHeader('date', 'Ngày nhập', 'w-[95px]')}
                <Th className={`${TH} w-[100px]`}>Loại nhập</Th>
                <Th className={`${TH} w-[220px]`}>Nguồn / bò mẹ</Th>
                <Th className={`${TH} w-[50px]`}>Số con</Th>
                <Th className={`${TH} w-[70px]`}>Tổng cân</Th>
                <Th className={`${TH} w-[100px]`}>Tổng tiền (đ)</Th>
                <Th className={`${TH} w-[85px]`}>Còn nợ (đ)</Th>
                <Th className={`${TH} w-[80px]`}>Trạng thái</Th>
                <Th className={`${TH} w-[60px]`} />
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((r) => (
                <tr key={r.id}>
                  <Td className={`${TH} whitespace-nowrap font-medium`}>{r.id}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{dmy(r.date)}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{r.type}</Td>
                  <Td className={TH}>{sourceCell(r)}</Td>
                  <Td className={TH}>{r.count}{Boolean(r.estimatedWeightCount) && subLine(`${r.estimatedWeightCount} con cân UT`)}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{kg(r.weight)}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{r.total == null ? '—' : money(r.total)}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{r.debt == null ? '—' : money(r.debt)}</Td>
                  <Td className={TH}><EntryStatusBadge status={r.status} />{r.status === 'Đã hủy' && r.cancelReason && subLine(r.cancelReason)}</Td>
                  <Td className={TH}>
                    <Button variant="link" small onClick={() => nav(r.status === 'Nháp' ? `/herd-entry/new?id=${encodeURIComponent(r.id)}${r.type === 'Bê sinh tại trại' ? '&kind=calf' : ''}` : `/herd-entry/${r.id}`)}>
                      {r.status === 'Nháp' ? 'Tiếp tục' : 'Xem'}
                    </Button>
                  </Td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <Td colSpan={10} className="text-center text-muted">
                    {loading ? 'Đang tải phiếu nhập…' : error ? (
                      <span className="inline-flex flex-wrap items-center justify-center gap-2">
                        {herdEntryError(error, 'Không thể tải danh sách phiếu nhập. Vui lòng thử lại.')}
                        <Button small onClick={() => { void refetch() }}>Thử lại</Button>
                      </span>
                    ) : 'Không có phiếu nhập'}
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
          <div className="flex items-center p-3 text-[11px] text-muted">
            {paged.total ? `Hiển thị ${paged.first}–${paged.last} / ${paged.total} phiếu` : 'Hiển thị 0 / 0 phiếu'}
            <div className="flex-1" />
            <nav aria-label="Phân trang phiếu nhập" className="flex items-center gap-3">
              <Button variant="link" small disabled={paged.page <= 1} onClick={() => setPageNumber(paged.page - 1)}><Icon name="chevron-left" size={14} />Trước</Button>
              <span className="text-xs">Trang {paged.page}/{paged.pageCount}</span>
              <Button variant="link" small disabled={paged.page >= paged.pageCount} onClick={() => setPageNumber(paged.page + 1)}>Sau<Icon name="chevron-right" size={14} /></Button>
            </nav>
          </div>
        </div>

        <Foot>
          Phiếu NHÁP chưa tạo hồ sơ bò, chưa đổi chuồng và công nợ. Phiếu ĐÃ NHẬP: mở chi tiết phiếu và dùng Sửa / Hủy ở từng dòng;
          chỉ hủy cả phiếu khi chưa con nào có sự kiện khác (GBR-33).
        </Foot>
      </div>
    </Layout>
  )
}
