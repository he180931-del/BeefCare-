import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, FilterSelect, Foot, Note, PageHeader, Segmented, Table, Td, Th, Tile, inputCls } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { EntryStatusBadge } from '../components/parts'
import { herdEntryApi, listPendingEntryCalves } from '../api/index'
import { useQuery } from '../../../hooks/useApi'
import { SOURCE_FILTERS } from '../data/importsData'
import { dmy, dm, kg, money } from '../../../data/format'
import type { HerdEntry } from '../../../types'
import { userFacingError } from '../../../api/userFacingError'

const TH = 'px-1! first:pl-3! last:pr-3!'
const TABS = ['Tất cả', 'Nháp', 'Đã nhập', 'Đã hủy']
// Keep the initial filter aligned with the actual current date.  The previous
// fixed 2026-10-22 end date made a newly posted voucher disappear from the
// list when the entry date was today (and made it look as if saving failed).
const localToday = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const DEFAULT_TO = localToday()
const DEFAULT_FROM = `${DEFAULT_TO.slice(0, 4)}-01-01`

export default function ImportList() {
  const [tab, setTab] = useState('Tất cả')
  const [type, setType] = useState('')
  const [source, setSource] = useState('')
  const [from, setFrom] = useState(DEFAULT_FROM)
  const [to, setTo] = useState(DEFAULT_TO)
  const { data, loading, error } = useQuery(() => herdEntryApi.listView({
    ...(type ? { type: type === 'Bê sinh tại trại' ? 'FARM_BORN' : 'PURCHASE' } : {}),
    from,
    to,
  }), [type, from, to])
  const { data: pending } = useQuery(() => listPendingEntryCalves(), [])
  const view = data
  const imports = view?.rows ?? []
  const tiles = view?.tiles ?? {}
  const counts = view?.counts ?? {}
  const ready = Boolean(view)
  const shown = (v: string | number) => (ready ? v : '—')
  const nav = useNavigate()
  const [dateOpen, setDateOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)

  const count = (t: string) => t === 'Tất cả' ? (counts.ALL ?? imports.length) : t === 'Nháp' ? (counts.DRAFT ?? 0) : t === 'Đã nhập' ? (counts.POSTED ?? 0) : (counts.VOIDED ?? 0)
  const rows = imports.filter(
    (r) =>
      (tab === 'Tất cả' || r.status === tab) &&
      (!type || r.type === type) &&
      (!source || (r.source ?? '').includes(source)) &&
      (r.date ?? '') >= from &&
      (r.date ?? '') <= to,
  )
  const totalRows = imports.length

  const applyDate = () => {
    setFrom(draftFrom)
    setTo(draftTo)
    setDateOpen(false)
  }

  return (
    <Layout title="Phiếu nhập – Danh sách" user="manager">
      <div className="contents leading-[normal]">
        {Boolean(error) && <Note tone="err">{userFacingError(error, 'Không thể tải danh sách phiếu nhập. Vui lòng thử lại.')}</Note>}
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
            {SOURCE_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
        </div>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label={`Phiếu đã nhập (từ ${dm(from)})`}
            value={shown(Number(tiles.postedVouchers ?? 0))}
            note={`${Number(tiles.draftVouchers ?? 0)} phiếu nháp chưa lưu`}
          />
          <Tile
            label="Số con đã nhập"
            value={shown(Number(tiles.cattleEntered ?? 0))}
            note={`Mua ngoài ${Number(tiles.cattlePurchased ?? 0)} · Bê sinh tại trại ${Number(tiles.cattleFarmBorn ?? 0)}`}
          />
          <Tile label="Tiền mua bò" value={shown(`${money(Number(tiles.purchaseAmount ?? 0))} đ`)} note="Gồm phí vận chuyển" />
          <Tile
            label="Còn nợ nguồn bán"
            value={shown(`${money(Number(tiles.owedToSellers ?? 0))} đ`)}
            note={Number(tiles.owedToSellers ?? 0) > 0 ? 'Theo dữ liệu backend' : 'Không còn nợ'}
          />
        </div>

        <div className="rounded-md border border-edge bg-white p-2">
          <Table scroll>
            <thead>
              <tr>
                <Th className={`${TH} w-[110px]`}>Mã phiếu</Th>
                <Th className={`${TH} w-[85px]`}>Ngày nhập</Th>
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
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className={`${TH} whitespace-nowrap font-medium`}>{r.id}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{dmy(r.date)}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{r.type}</Td>
                  <Td className={TH}>{r.source}</Td>
                  <Td className={TH}>{r.count}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{kg(r.weight)}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{r.total == null ? '—' : money(r.total)}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{r.debt == null ? '—' : money(r.debt)}</Td>
                  <Td className={TH}><EntryStatusBadge status={r.status} /></Td>
                  <Td className={TH}>
                    <Button variant="link" small onClick={() => nav(r.status === 'Nháp' ? `/herd-entry/new?id=${encodeURIComponent(r.id)}${r.type === 'Bê sinh tại trại' ? '&kind=calf' : ''}` : `/herd-entry/${r.id}`)}>
                      {r.status === 'Nháp' ? 'Tiếp tục' : 'Xem'}
                    </Button>
                  </Td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <Td colSpan={10} className="text-center text-muted">{loading ? 'Đang tải phiếu nhập…' : error ? String(error) : 'Không có phiếu nhập'}</Td>
                </tr>
              )}
            </tbody>
          </Table>
          <div className="flex items-center p-3 text-[11px] text-muted">
            Hiển thị {rows.length} / {Math.max(totalRows, count(tab))} phiếu
            <div className="flex-1" />
            <span className="flex items-center gap-3 text-xs font-semibold text-brand-dark"><span className="flex items-center"><Icon name="chevron-left" size={14} />Trước</span><span className="flex items-center">Sau<Icon name="chevron-right" size={14} /></span></span>
          </div>
        </div>

        <Foot>
          Phiếu NHÁP chưa tạo hồ sơ bò, chưa đổi chuồng và công nợ. Phiếu ĐÃ NHẬP: sửa từng con tại Hồ sơ bò › Sửa bản ghi nhập đàn;
          chỉ hủy cả phiếu khi chưa con nào có sự kiện khác (GBR-33).
        </Foot>
      </div>
    </Layout>
  )
}
