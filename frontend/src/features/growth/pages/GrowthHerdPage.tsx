import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  activateTableRow, activateTableRowByKey, Badge, ErrorBlock, Foot, Icon, interactiveRowClass, LoadingBlock, PageHeader, Pagination, Panel,
  SearchInput, Select, Table, Td, Th,
} from '../../../shared/ui'
import { cx } from '../../../shared/ui/cx'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useDemoState } from '../../../demo/demoModules'
import { fmtDate, fmtDec, fmtKg } from '../domain/growthFormat'
import { BASIS_LABEL, STATUS_LABEL } from '../domain/growthLabels'
import { useGrowthHerd } from '../hooks/useGrowthUseCase'
import type { GrowthFilters, GrowthHerdRow, GrowthHerdStatus, GrowthWindow } from '../types'

const TITLE = 'Tăng trưởng & BCS'

const StatusBadge = ({ status }: { status: GrowthHerdStatus }) =>
  status === 'NORMAL' ? <Badge tone="ok" icon="circle-check">{STATUS_LABEL[status]}</Badge>
  : status === 'OVERDUE' ? <Badge tone="warn" icon="alert-triangle">{STATUS_LABEL[status]}</Badge>
  : <Badge tone={status === 'LOW_BCS' ? 'err' : 'warn'}>{STATUS_LABEL[status]}</Badge>

/** Vạch đầu dòng cùng màu với huy hiệu tình trạng: đỏ BCS thấp, vàng quá hạn cân / ADG thấp, không tô khi bình thường. */
const STATUS_EDGE: Record<GrowthHerdStatus, string> = {
  LOW_BCS: 'border-l-[#cc6b5c]', LOW_ADG: 'border-l-[#d6a34d]', OVERDUE: 'border-l-[#d6a34d]', NORMAL: 'border-l-transparent',
}

/**
 * Màn theo dõi tăng trưởng cấp đàn (SCR-23, D72) theo Bento như Sức khỏe / Sinh sản: hàng 3 khối (cần cân lại – nổi bật,
 * cần chú ý – chỉ tô màu khi có bò BCS / ADG thấp, đang nuôi), rồi một khối gồm bộ lọc và bảng. Chỉ xem; ghi cân ở hồ sơ bò.
 */
export default function GrowthHerdPage() {
  const navigate = useNavigate()
  const demo = useDemoState()
  const [q, setQ] = useState('')
  const [penCode, setPen] = useState('')
  const [herdGroup, setGroup] = useState('')
  const [lifeStage, setStage] = useState('')
  const [windowDays, setWindow] = useState<GrowthWindow>(90)
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const filters: GrowthFilters = { q, penCode, herdGroup, lifeStage, windowDays, dir, page }
  const { options, herd } = useGrowthHerd(filters, demo)
  const { data, loading, error, refetch } = herd
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu tăng trưởng.')} onRetry={refetch} /></Layout>

  const { tiles, rows, total, size } = data
  const first = total === 0 ? 0 : (data.page - 1) * size + 1
  const attention = tiles.lowBcs + tiles.lowAdg > 0
  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-5 leading-[normal]">
        <PageHeader title={TITLE} sub="Theo dõi cân nặng và thể trạng của đàn · nhấn một dòng để ghi cân trong hồ sơ bò" />
        <section aria-label="Chỉ số tăng trưởng" className="@container">
          {/* Bento một hàng 5 + 4 + 3 từ 1.024 px (như Sức khỏe); một cột trên điện thoại theo thứ tự đọc. */}
          <div className="grid gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-12">
            <Panel tone="emphasis" className="justify-between gap-3 @min-[640px]:col-span-2 @min-[1024px]:col-span-5">
              <div className="flex flex-col gap-1">
                <p className="m-0 text-xs text-side-text">Cần cân lại</p>
                <p className="m-0 flex items-baseline gap-3"><span className="text-[40px] font-bold leading-none">{tiles.overdue}</span>
                  <span className="text-xs text-side-text">bò quá chu kỳ cân 30 ngày</span></p>
              </div>
              <p className="m-0 rounded-xl bg-white/8 px-4 py-3 text-[13px] text-white"><strong>{tiles.weighings30}</strong> lượt cân trong 30 ngày qua</p>
            </Panel>
            <Panel tone={attention ? 'err' : 'ok'} className="gap-3 @min-[1024px]:col-span-4">
              <p className="m-0 flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon name={attention ? 'alert-triangle' : 'circle-check'} size={18} className={attention ? 'text-err-fg' : 'text-ok-fg'} />
                {attention ? 'Cần chú ý' : 'Thể trạng ổn'}
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
                <AttentionLine value={tiles.lowBcs} text="bò BCS < 2,5 (lần đo gần nhất)" tone="err" />
                <AttentionLine value={tiles.lowAdg} text={`bò ADG thấp hơn trung bình chuồng (${windowDays} ngày)`} tone="warn" />
              </ul>
            </Panel>
            <Panel className="justify-between gap-1 @min-[1024px]:col-span-3">
              <p className="m-0 text-xs text-label">Đang nuôi</p>
              <p className="m-0 text-[32px] font-bold leading-none text-ink">{data.activeCount}</p>
              <p className="m-0 text-[11px] text-label">ADG tính theo kỳ {windowDays} ngày</p>
            </Panel>
          </div>
        </section>

        <Panel className="gap-0 overflow-hidden p-0!">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-rule px-4 py-4 @min-[1024px]:px-6">
            <SearchInput className="w-full sm:w-[240px]" aria-label="Tìm mã hiển thị, số tai" placeholder="Tìm mã hiển thị, số tai" value={q} onChange={(e) => change(setQ)(e.target.value)} />
            <Select className="w-full sm:w-[180px]" aria-label="Chuồng" value={penCode} onChange={(e) => change(setPen)(e.target.value)}>
              <option value="">Chuồng: Tất cả</option>
              {options.data?.pens.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </Select>
            <Select className="w-full sm:w-[180px]" aria-label="Nhóm đàn" value={herdGroup} onChange={(e) => change(setGroup)(e.target.value)}>
              <option value="">Nhóm đàn: Tất cả</option>
              {options.data?.herdGroups.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </Select>
            <Select className="w-full sm:w-[180px]" aria-label="Giai đoạn" value={lifeStage} onChange={(e) => change(setStage)(e.target.value)}>
              <option value="">Giai đoạn: Tất cả</option>
              {options.data?.lifeStages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Select className="w-full sm:w-[170px]" aria-label="Kỳ ADG" value={String(windowDays)} onChange={(e) => change(setWindow)(Number(e.target.value) as GrowthWindow)}>
              {[30, 90, 180].map((d) => <option key={d} value={d}>Kỳ ADG: {d} ngày</option>)}
            </Select>
          </div>
          {rows.length === 0 ? (
            // Trống nằm ngay trong khối danh sách, không lồng khung viền thứ hai.
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <p className="m-0 text-sm font-semibold text-ink">Không có bò phù hợp</p>
              <p className="m-0 text-xs text-muted">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
            </div>
          ) : (
            <>
              <Table wide bordered={false}>
                <thead>
                  <tr>
                    <Th>Bò</Th><Th>Cân gần nhất</Th>
                    <Th><button type="button" className="font-semibold" onClick={() => change(setDir)(dir === 'desc' ? 'asc' : 'desc')}>Ngày cân {dir === 'desc' ? '↓' : '↑'}</button></Th>
                    <Th>ADG {windowDays} ngày</Th><Th>BCS</Th><Th>Tình trạng</Th><Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => <Row key={r.code} r={r} onOpen={() => navigate(`/cattle/${r.code}?tab=growth`)} />)}
                </tbody>
              </Table>
              <div className="border-t border-rule px-4 py-3">
                <Pagination page={data.page} pageCount={Math.max(1, Math.ceil(total / size))} onChange={setPage} summary={`Hiển thị ${first}–${first + rows.length - 1} / ${total} con`} />
              </div>
            </>
          )}
        </Panel>
        <Foot>"—" ở ADG: chưa đủ 2 lần cân hợp lệ trong kỳ.</Foot>
      </div>
    </Layout>
  )
}

/** Dòng trong khối cần chú ý; số 0 tô xám. */
function AttentionLine({ value, text, tone }: { value: number; text: string; tone: 'err' | 'warn' }): ReactNode {
  return (
    <li className="flex items-center gap-2 border-t border-black/5 pt-2 first:border-t-0 first:pt-0">
      <strong className={cx('min-w-7 text-xl', value === 0 ? 'text-muted' : tone === 'err' ? 'text-err-fg' : 'text-warn-fg')}>{value}</strong>
      <span className={cx('flex-1', value === 0 ? 'text-muted' : 'text-ink')}>{text}</span>
    </li>
  )
}

function Row({ r, onOpen }: { r: GrowthHerdRow; onOpen: () => void }) {
  return (
    // Cả dòng mở tab Tăng trưởng & BCS của bò: nhận focus bằng Tab, Enter/Space như nhấn chuột (Bento §3).
    <tr tabIndex={0} aria-label={`Mở hồ sơ ${r.code}`} className={interactiveRowClass}
      onClick={(event) => activateTableRow(event, onOpen)} onKeyDown={(event) => activateTableRowByKey(event, onOpen)}>
      <Td className={cx('border-l-4', STATUS_EDGE[r.status])}>
        <span className="font-medium">{r.name ? `${r.code} · ${r.name}` : r.code}</span>
        <span className="block text-[11px] text-muted">{[r.breed, r.sex, r.penName].filter(Boolean).join(' · ')}</span>
      </Td>
      <Td className="whitespace-nowrap">{r.latestWeightKg === undefined ? '—' : `${fmtKg(r.latestWeightKg)} kg · ${BASIS_LABEL[r.latestBasis!]}`}</Td>
      <Td className="whitespace-nowrap">{r.weighedAt ? fmtDate(r.weighedAt) : '—'}</Td>
      <Td className="whitespace-nowrap">{r.adg === undefined ? '—' : `${fmtDec(r.adg, 2)} kg/ngày`}</Td>
      <Td>{r.bcs === undefined ? '—' : fmtDec(r.bcs)}</Td>
      <Td><StatusBadge status={r.status} /></Td>
      <Td><Icon name="chevron-right" size={14} /></Td>
    </tr>
  )
}
