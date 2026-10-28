import { useState } from 'react'
import { Foot } from '../../components/ui'
import { Chip, Panel, Seg } from './parts'
import type { CowSeed } from '../../data/cowsData'
import type { CattleEvent } from '../../types'

const FILTERS = [
  ['all', 'Tất cả'],
  ['qr', 'Định danh & QR'],
  ['stage', 'Mục đích / Giai đoạn'],
  ['barn', 'Chuồng'],
  ['weight', 'Cân & BCS'],
  ['vaccine', 'Tiêm phòng'],
  ['health', 'Sức khỏe'],
  ['repro', 'Sinh sản'],
] as const

const monthLabel = (at: string): string => {
  const [y, m] = at.slice(0, 7).split('-')
  return `THÁNG ${Number(m)} / ${y}`
}

export default function TimelineTab({ cow }: { cow: CowSeed }) {
  const [cat, setCat] = useState('all')
  const events = [...cow.events]
    .filter((e) => cat === 'all' || e.cat === cat)
    .sort((a, b) => (a.at < b.at ? 1 : -1))

  const groups: Array<{ label: string; items: CattleEvent[] }> = []
  events.forEach((e) => {
    const label = monthLabel(e.at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(e)
    else groups.push({ label, items: [e] })
  })

  return (
    <>
      <div>
        <Seg options={FILTERS} value={cat} onChange={setCat} />
      </div>
      <Panel gap="gap-2.5" pad="p-4">
        {groups.length === 0 && <p className="m-0 text-xs text-muted">Chưa có sự kiện nào trong nhóm này.</p>}
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-2.5">
            <div className="text-[11px] font-semibold text-brand">{g.label}</div>
            {g.items.map((e) => (
              <div key={e.id} className="flex gap-3.5 py-2">
                <span className="mt-[2px] size-3 shrink-0 rounded-full bg-brand" />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#212121]">{e.title}</span>
                    <Chip tone={e.badge.tone}>{e.badge.label}</Chip>
                  </div>
                  <p className="m-0 text-[12px] text-[#212121]">{e.detail}</p>
                  <p className="m-0 text-[11px] text-muted">{e.meta}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </Panel>
      <Foot>Dòng thời gian gộp mọi sự kiện của bò theo thời điểm xảy ra; mỗi mục ghi rõ thời điểm ghi và người ghi.</Foot>
    </>
  )
}
