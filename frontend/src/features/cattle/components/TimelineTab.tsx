import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, ErrorBlock, Icon, LoadingBlock, Modal, Note } from '../../../shared/ui'
import { cattleError } from '../api/cattleError'
import { useCattleTimelineQuery } from '../hooks/useCattleQueries'
import { canRecordCare } from '../../authorization'
import { useSession } from '../../../app/session/sessionContext'
import { CARE_CATEGORIES, TIMELINE_FILTERS } from '../api/cattleTimeline'
import { Chip, Panel, Seg } from './parts'
import TimelineCorrectionDialog, { hasTimelineCorrection } from './TimelineCorrectionDialog'
import type { CattleViewModel as CowSeed } from '../types'
import type { CattleEvent } from '../types'

/** MSG-FE16-01 */
export const TIMELINE_DENIED = 'Vai trò của bạn không được xem chi tiết sự kiện này.'

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

/** SCR-50 #3: "THÁNG 10 2026". */
export const monthLabel = (at: string): string => {
  const [y, m] = at.slice(0, 7).split('-')
  return `THÁNG ${Number(m)} ${y}`
}

/** R-16-04: excluded / voided records and the originals of corrected records are hidden until "Hiện chỉnh sửa" is on. */
export const isCorrectionView = (e: CattleEvent) => e.status === 'EXCLUDED' || e.status === 'VOIDED' || e.status === 'REVISION'

/** Sự kiện có thuộc chip đang chọn không; "care" gom các nhóm chăm sóc (D79). */
const inChip = (e: CattleEvent, cat: string) => cat === 'all' || (cat === 'care' ? CARE_CATEGORIES.has(e.cat) : e.cat === cat)

/**
 * D79: chip mặc định là "Chăm sóc" khi bò có sự kiện chăm sóc đang hiển thị; bò chỉ có sự kiện nhập đàn, phân chuồng…
 * thì mặc định "Tất cả" để không mở ra một trang trống.
 */
export const defaultTimelineChip = (events: CattleEvent[], showCorrections: boolean): string =>
  events.some((e) => CARE_CATEGORIES.has(e.cat) && (showCorrections || !isCorrectionView(e))) ? 'care' : 'all'

/** SCR-50 #8 rút gọn cho dòng thu gọn: "01/10". */
const shortDate = (at: string) => (/^\d{4}-\d{2}-\d{2}/.test(at) ? `${at.slice(8, 10)}/${at.slice(5, 7)}` : '')

/** Events of the chosen chip, newest occurrence first (R-16-02, Q3), grouped by month. */
export function timelineGroups(events: CattleEvent[], cat: string, showCorrections: boolean): Array<{ label: string; items: CattleEvent[] }> {
  const groups: Array<{ label: string; items: CattleEvent[] }> = []
  events
    .filter((e) => inChip(e, cat) && (showCorrections || !isCorrectionView(e)))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .forEach((e) => {
      const label = monthLabel(e.at)
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.items.push(e)
      else groups.push({ label, items: [e] })
    })
  return groups
}

/**
 * SCR-50 Timeline tab (UC-FE16-01): read-only (R-16-01). "Xem chi tiết" opens the source record in its profile tab
 * or voucher (R-16-06); "Sửa / Hủy" is offered to the Manager on care / reproduction records while "Hiện chỉnh sửa"
 * is on, and saves the change through the source command (R-16-07).
 */
export default function TimelineTab({ cow }: { cow: CowSeed }) {
  const nav = useNavigate()
  const role = useSession()?.role
  const [chosen, setChosen] = useState<string>()
  const [showCorrections, setShowCorrections] = useState(false)
  const [denied, setDenied] = useState('')
  const [selected, setSelected] = useState<CattleEvent | null>(null)
  const [editing, setEditing] = useState<CattleEvent | null>(null)
  // D79: mỗi sự kiện một dòng; mở từng dòng, hoặc mở tất cả. "Hiện chỉnh sửa" là lúc soát lý do nên mở sẵn.
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set())
  const [expandAll, setExpandAll] = useState(false)
  const query = useCattleTimelineQuery(cow, showCorrections)
  const { cattleId, events } = query
  const cat = chosen ?? defaultTimelineChip(events, showCorrections)
  const groups = timelineGroups(events, cat, showCorrections)
  const isOpen = (id: string) => expandAll || showCorrections || openIds.has(id)
  const toggle = (id: string) => setOpenIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const code = encodeURIComponent(cow.code)
  // R-16-07, D41: Chủ trại và Quản lý sửa / hủy từ dòng thời gian.
  const mayCorrect = (e: CattleEvent) => canRecordCare(role) && cow.status === 'ACTIVE' &&
    e.correctable && !e.openDenied && e.tab && e.sourceId != null &&
    (cattleId == null || (e.accessFromBackend && (e.tab === 'growth' || hasTimelineCorrection(e))))
  const sourceLink = (e: CattleEvent, edit = false) => {
    const params = new URLSearchParams({ tab: e.tab ?? '' })
    if (e.sourceId != null) params.set('r', String(e.sourceId))
    if (e.sourceType) params.set('type', e.sourceType)
    if (e.healthCaseId != null) params.set('case', String(e.healthCaseId))
    if (edit) {
      params.set('m', 'correct')
      params.set('from', 'timeline')
    }
    return `${role === 'TECHNICIAN' ? '/kt/dan-bo' : '/cattle'}/${code}?${params}`
  }

  const openSource = (e: CattleEvent) => {
    setDenied('')
    if (e.openDenied) return setDenied(TIMELINE_DENIED)
    if (e.voucher) return nav(e.voucher.kind === 'entry' ? `/herd-entry/${encodeURIComponent(e.voucher.code)}` : `/herd-exit/${encodeURIComponent(e.voucher.code)}`)
    if (e.cat === 'entryExit') return setDenied(TIMELINE_DENIED)
    if (e.tab === undefined) return setDenied(TIMELINE_DENIED)
    if (e.sourceId != null && ['growth', 'vaccine', 'health', 'repro'].includes(e.tab)) return nav(sourceLink(e))
    setSelected(e)
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Seg scroll options={TIMELINE_FILTERS} value={cat} onChange={setChosen} />
        <div className="flex flex-wrap items-center gap-4">
          {!showCorrections && groups.length > 0 && (
            <Button variant="link" small aria-pressed={expandAll} onClick={() => setExpandAll((v) => !v)}>
              {expandAll ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </Button>
          )}
          <Checkbox checked={showCorrections} onChange={(e) => setShowCorrections(e.target.checked)} aria-label="Hiện chỉnh sửa">
            <span className="text-xs font-medium text-ink">Hiện chỉnh sửa</span>
          </Checkbox>
        </div>
      </div>
      {denied && <Note tone="warn">{denied}</Note>}
      {cattleId != null && query.error ? <ErrorBlock message={cattleError(query.error, 'Không tải được dòng thời gian.')} onRetry={query.refetch} /> :
      <Panel gap="gap-2.5" pad="p-4">
        {cattleId != null && query.loading && <LoadingBlock />}
        {groups.length === 0 && (cattleId == null || !query.loading) && <p className="m-0 text-xs text-muted">Chưa có sự kiện</p>}
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <div className="text-[11px] font-semibold text-brand">{g.label}</div>
            <ul className="m-0 flex list-none flex-col divide-y divide-edge p-0">
              {g.items.map((e) => {
                const muted = isCorrectionView(e)
                const open = isOpen(e.id)
                const hasMore = Boolean(e.detail || e.reason || e.meta)
                return (
                  <li key={e.id} className={cx('flex gap-3 py-2', muted && 'opacity-60')}>
                    <span className={cx('mt-[5px] size-2.5 shrink-0 rounded-full', muted ? 'bg-[#bdbdbd]' : 'bg-brand')} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          aria-expanded={hasMore ? open : undefined}
                          disabled={!hasMore || showCorrections || expandAll}
                          onClick={() => toggle(e.id)}
                          className={cx('flex min-w-0 items-center gap-1 text-left text-sm font-semibold text-[#212121] enabled:cursor-pointer', (e.status === 'VOIDED' || e.status === 'EXCLUDED') && 'line-through')}
                        >
                          {e.title}
                          {hasMore && !showCorrections && !expandAll && <Icon name="chevron-down" size={12} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />}
                        </button>
                        {e.basis && <Chip tone="info">{e.basis}</Chip>}
                        {e.marker ? <Chip tone={e.status === 'CORRECTED' ? 'warn' : 'grey'}>{e.marker}</Chip> : !e.basis && e.badge?.label && <Chip tone={e.badge.tone}>{e.badge.label}</Chip>}
                        {!open && <span className="text-[11px] text-muted">{shortDate(e.at)}</span>}
                      </div>
                      {open && e.detail && <p className="m-0 text-[12px] text-[#212121]">{e.detail}</p>}
                      {open && e.reason && <p className="m-0 text-[12px] text-muted">Lý do: {e.reason}</p>}
                      {open && <p className="m-0 text-[11px] text-muted">{e.meta}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {e.status !== 'REVISION' && (e.voucher || e.tab !== undefined || e.cat === 'entryExit') && (
                        <Button variant="link" small onClick={() => openSource(e)}>Xem chi tiết</Button>
                      )}
                      {showCorrections && mayCorrect(e) && (
                        <Button variant="link" small onClick={() => {
                          if (cattleId != null && hasTimelineCorrection(e)) setEditing(e)
                          else nav(sourceLink(e, true))
                        }}>Sửa / Hủy</Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </Panel>}
      {selected && (
        <Modal title="Chi tiết sự kiện" onClose={() => setSelected(null)}>
          <h3 className="m-0 text-sm font-semibold">{selected.title}</h3>
          {selected.marker && <Chip>{selected.marker}</Chip>}
          {selected.basis && <Chip>{selected.basis}</Chip>}
          {selected.detail && <p>{selected.detail}</p>}
          {selected.reason && <p>Lý do: {selected.reason}</p>}
          <p className="text-muted">{selected.meta}</p>
        </Modal>
      )}
      {editing && hasTimelineCorrection(editing) && (
        <TimelineCorrectionDialog event={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); query.refetch() }} />
      )}
    </>
  )
}
