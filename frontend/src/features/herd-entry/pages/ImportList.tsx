import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, Foot, PageHeader, Segmented, Select, StatusBadge, Table, Td, Th, Tile, inputCls } from '../../../components/ui'
import { herdEntryApi } from '../api/index'
import { useQuery } from '../../../hooks/useApi'
import { OLDER, SOURCE_FILTERS } from '../data/importsData'
import { dmy, dm, kg, money } from '../../../data/format'
import type { HerdEntry } from '../../../types'

const TH = 'px-1! first:pl-3! last:pr-3!'
const TABS = ['Tất cả', 'Nháp', 'Đã nhập', 'Đã hủy']
const TAB_OLDER = { 'Tất cả': OLDER.total, Nháp: OLDER.drafts, 'Đã nhập': OLDER.done, 'Đã hủy': OLDER.cancelled }
const DEFAULT_FROM = '2026-07-01'
const DEFAULT_TO = '2026-10-22'

export default function ImportList() {
  const { data, loading, error } = useQuery<HerdEntry[]>(() => herdEntryApi.list(), [])
  const imports = data ?? []
  const ready = Boolean(data)
  const shown = (v: string | number) => (ready ? v : '—')
  const nav = useNavigate()
  const [tab, setTab] = useState('Tất cả')
  const [type, setType] = useState('')
  const [source, setSource] = useState('')
  const [from, setFrom] = useState(DEFAULT_FROM)
  const [to, setTo] = useState(DEFAULT_TO)
  const [dateOpen, setDateOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)

  const count = (t: string) => (t === 'Tất cả' ? imports.length : imports.filter((r) => r.status === t).length) + (TAB_OLDER[t as keyof typeof TAB_OLDER] ?? 0)
  const rows = imports.filter(
    (r) =>
      (tab === 'Tất cả' || r.status === tab) &&
      (!type || r.type === type) &&
      (!source || (r.source ?? '').includes(source)) &&
      (r.date ?? '') >= from &&
      (r.date ?? '') <= to,
  )
  const done = imports.filter((r) => r.status === 'Đã nhập')
  const bought = done.filter((r) => r.type === 'Mua ngoài')
  const calf = done.filter((r) => r.type !== 'Mua ngoài')
  const owed = done.filter((r) => (r.debt ?? 0) > 0)
  const sum = (list: HerdEntry[], f: (row: HerdEntry) => number) => list.reduce((s, r) => s + f(r), 0)
  const drafts = imports.filter((r) => r.status === 'Nháp').length
  const totalRows = imports.length + OLDER.total

  const applyDate = () => {
    setFrom(draftFrom)
    setTo(draftTo)
    setDateOpen(false)
  }

  return (
    <Layout title="Phiếu nhập – Danh sách" user="manager">
      <div className="contents leading-[normal]">
        <PageHeader title="Nhập đàn" sub="Mỗi lần nhận bò vào trại lập 1 phiếu nhập; mỗi con được tạo mã nội bộ cố định và thẻ QR khi lưu.">
          <Button onClick={() => nav('/herd-entry/new?kind=calf')}>Bê chờ xác nhận (2)</Button>
          <Button variant="primary" onClick={() => nav('/herd-entry/new')}>+ Tạo phiếu nhập</Button>
        </PageHeader>

        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t, label: `${t} (${count(t)})` }))} />
          <div className="flex-1" />
          <div className="relative w-[200px]">
            <button
              type="button"
              onClick={() => {
                setDraftFrom(from)
                setDraftTo(to)
                setDateOpen(!dateOpen)
              }}
              className={`${inputCls} flex w-[200px] cursor-pointer items-center gap-1.5 text-left`}
            >
              <span className="min-w-0 flex-1">{`${dmy(from)} – ${dmy(to)}`}</span>
              <span className="text-[10px] text-muted">▾</span>
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
          <Select className="w-[200px]" value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại nhập">
            <option value="">Loại nhập: Tất cả</option>
            <option value="Mua ngoài">Mua ngoài</option>
            <option value="Bê sinh tại trại">Bê sinh tại trại</option>
          </Select>
          <Select className="w-[200px]" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Nguồn">
            <option value="">Nguồn: Tất cả</option>
            {SOURCE_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            label={`Phiếu đã nhập (từ ${dm(from)})`}
            value={shown(OLDER.done + done.length)}
            note={`${drafts} phiếu nháp chưa lưu`}
          />
          <Tile
            label="Số con đã nhập"
            value={shown(OLDER.cows + sum(done, (r) => r.count ?? 0))}
            note={`Mua ngoài ${OLDER.buyCows + sum(bought, (r) => r.count ?? 0)} · Bê sinh tại trại ${OLDER.calfCows + sum(calf, (r) => r.count ?? 0)}`}
          />
          <Tile label="Tiền mua bò" value={shown(`${money(OLDER.buyMoney + sum(bought, (r) => r.total ?? 0))} đ`)} note="Gồm phí vận chuyển" />
          <Tile
            label="Còn nợ nguồn bán"
            value={shown(`${money(sum(owed, (r) => r.debt ?? 0))} đ`)}
            note={owed.length ? `${owed.length} phiếu · ${owed[0].id}` : 'Không còn nợ'}
          />
        </div>

        <div className="rounded-md border border-edge bg-white p-2">
          <Table wide>
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
                <Th className={TH} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className={`${TH} font-medium`}>{r.id}</Td>
                  <Td className={TH}>{dmy(r.date)}</Td>
                  <Td className={TH}>{r.type}</Td>
                  <Td className={TH}>{r.source}</Td>
                  <Td className={TH}>{r.count}</Td>
                  <Td className={`${TH} whitespace-nowrap`}>{kg(r.weight)}</Td>
                  <Td className={TH}>{r.total == null ? '—' : money(r.total)}</Td>
                  <Td className={TH}>{r.debt == null ? '—' : money(r.debt)}</Td>
                  <Td className={TH}><StatusBadge status={r.status} /></Td>
                  <Td className={TH}>
                    <Button variant="link" small onClick={() => nav(r.status === 'Nháp' ? `/herd-entry/new?id=${encodeURIComponent(r.id)}${r.type === 'Bê sinh tại trại' ? '&kind=calf' : ''}` : `/herd-entry/${r.id}`)}>
                      {r.status === 'Nháp' ? 'Tiếp tục' : 'Xem'}
                    </Button>
                  </Td>
                  <Td className={TH} />
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <Td colSpan={11} className="text-center text-muted">{loading ? 'Đang tải phiếu nhập…' : error ? String(error) : 'Không có phiếu nhập'}</Td>
                </tr>
              )}
            </tbody>
          </Table>
          <div className="flex items-center p-3 text-[11px] text-muted">
            Hiển thị {rows.length} / {totalRows} phiếu
            <div className="flex-1" />
            <span className="text-xs font-semibold text-brand-dark">‹ Trước &nbsp;&nbsp;&nbsp; Sau ›</span>
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
