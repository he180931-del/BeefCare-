import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Foot, Note } from '../../../components/ui'
import { useSession } from '../../authorization'
import { TIMELINE_FILTERS } from '../../../api/cattleTimeline'
import { Chip, Panel, Seg } from './parts'
import type { CowSeed } from '../../../data/cowsData'
import type { CattleEvent } from '../../../types'

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

/** SCR-50 #3: "THÁNG 10 2026". */
export const monthLabel = (at: string): string => {
  const [y, m] = at.slice(0, 7).split('-')
  return `THÁNG ${Number(m)} ${y}`
}

/** R-16-04: excluded / voided records and the originals of corrected records are hidden until "Hiện chỉnh sửa" is on. */
export const isCorrectionView = (e: CattleEvent) => e.status === 'EXCLUDED' || e.status === 'VOIDED' || e.status === 'REVISION'

/** Events of the chosen chip, newest occurrence first (R-16-02, Q3), grouped by month. */
export function timelineGroups(events: CattleEvent[], cat: string, showCorrections: boolean): Array<{ label: string; items: CattleEvent[] }> {
  const groups: Array<{ label: string; items: CattleEvent[] }> = []
  events
    .filter((e) => (cat === 'all' || e.cat === cat) && (showCorrections || !isCorrectionView(e)))
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
 * is on, and opens the source tab whose popup saves the change (R-16-07).
 */
export default function TimelineTab({ cow }: { cow: CowSeed }) {
  const nav = useNavigate()
  const role = useSession()?.role
  const [cat, setCat] = useState('all')
  const [showCorrections, setShowCorrections] = useState(false)
  const [denied, setDenied] = useState('')
  const groups = timelineGroups(cow.events, cat, showCorrections)
  // The backend's canCorrect already applies the role and herd status (A1); local demo events fall back to the role.
  const mayCorrect = (e: CattleEvent) => !!e.correctable && !!e.tab && (e.accessFromBackend ? true : role === 'MANAGER' && cow.status === 'ACTIVE')
  const correctLink = (e: CattleEvent) => `/cattle/${code}?tab=${e.tab}&m=correct${e.sourceId != null ? `&r=${e.sourceId}` : ''}`
  const code = encodeURIComponent(cow.code)

  const openSource = (e: CattleEvent) => {
    setDenied('')
    if (e.openDenied) return setDenied('Bạn không có quyền xem chi tiết này.')
    if (e.voucher) return nav(e.voucher.kind === 'entry' ? `/herd-entry/${encodeURIComponent(e.voucher.code)}` : `/herd-exit/${encodeURIComponent(e.voucher.code)}`)
    if (e.cat === 'entryExit') return setDenied('Bạn không có quyền xem chi tiết này.')
    if (e.tab === undefined) return setDenied('Bạn không có quyền xem chi tiết này.')
    nav(e.tab ? `/cattle/${code}?tab=${e.tab}` : `/cattle/${code}`)
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Seg options={TIMELINE_FILTERS} value={cat} onChange={setCat} />
        <Checkbox checked={showCorrections} onChange={(e) => setShowCorrections(e.target.checked)} aria-label="Hiện chỉnh sửa">
          <span className="text-xs font-medium text-ink">Hiện chỉnh sửa</span>
        </Checkbox>
      </div>
      {denied && <Note tone="warn">{denied}</Note>}
      <Panel gap="gap-2.5" pad="p-4">
        {groups.length === 0 && <p className="m-0 text-xs text-muted">Chưa có sự kiện</p>}
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-2.5">
            <div className="text-[11px] font-semibold text-brand">{g.label}</div>
            {g.items.map((e) => {
              const muted = isCorrectionView(e)
              return (
                <div key={e.id} className={cx('flex gap-3.5 py-2', muted && 'opacity-60')}>
                  <span className={cx('mt-[2px] size-3 shrink-0 rounded-full', muted ? 'bg-[#bdbdbd]' : 'bg-brand')} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cx('text-sm font-semibold text-[#212121]', (e.status === 'VOIDED' || e.status === 'EXCLUDED') && 'line-through')}>{e.title}</span>
                      {e.basis && <Chip tone="info">{e.basis}</Chip>}
                      {e.marker ? <Chip tone={e.status === 'CORRECTED' ? 'warn' : 'grey'}>{e.marker}</Chip> : !e.basis && e.badge?.label && <Chip tone={e.badge.tone}>{e.badge.label}</Chip>}
                    </div>
                    {e.detail && <p className="m-0 text-[12px] text-[#212121]">{e.detail}</p>}
                    {e.reason && <p className="m-0 text-[12px] text-muted">Lý do: {e.reason}</p>}
                    <p className="m-0 text-[11px] text-muted">{e.meta}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {e.status !== 'REVISION' && (e.voucher || e.tab !== undefined || e.cat === 'entryExit') && (
                      <Button variant="link" small onClick={() => openSource(e)}>Xem chi tiết</Button>
                    )}
                    {showCorrections && mayCorrect(e) && (
                      <Button variant="link" small onClick={() => nav(correctLink(e))}>Sửa / Hủy</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </Panel>
      <Foot>Dòng thời gian chỉ đọc, gộp mọi sự kiện đã ghi của bò theo thời điểm xảy ra; lịch tiêm, mũi sắp tới và nhắc việc không nằm ở đây. Sửa hoặc hủy một bản ghi tại tab của bản ghi đó.</Foot>
    </>
  )
}
