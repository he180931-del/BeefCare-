import { useState } from 'react'
import { Badge, Card, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { formatDate, formatDateTime } from '../domain/reproductionRules'
import type { CalvingRecord, ReproductionEvent, ReproductionEventType, ReproductionFemale } from '../types'
import { SOURCE_LABEL } from './reproductionFields'

export type TimelineRecord = { kind: 'event'; event: ReproductionEvent } | { kind: 'calving'; calving: CalvingRecord }

const TYPE_OPTIONS: Array<[ReproductionEventType | '', string]> = [
  ['', 'Loại: Tất cả'], ['ESTRUS', 'Loại: Động dục'], ['BREEDING', 'Loại: Phối giống'], ['PREGNANCY_CHECK', 'Loại: Khám thai'],
  ['PREGNANCY_UPDATE', 'Loại: Diễn biến thai'], ['CALVING', 'Loại: Sinh bê'],
]

export function EventBadge({ type }: { type: ReproductionEventType }) {
  if (type === 'ESTRUS') return <Badge tone="info" icon="flame">Động dục</Badge>
  if (type === 'BREEDING') return <Badge tone="ok">Phối giống</Badge>
  if (type === 'PREGNANCY_CHECK') return <Badge>Khám thai</Badge>
  if (type === 'PREGNANCY_UPDATE') return <Badge tone="warn">Diễn biến</Badge>
  return <Badge tone="ok">Sinh bê</Badge>
}

/** Default range of the frame: 1 January of the latest event's year up to that event. */
function autoRange(events: readonly ReproductionEvent[]): { from: string; to: string } {
  const latest = events.map((event) => event.occurredAt.slice(0, 10)).sort().at(-1) ?? ''
  return { from: latest ? `${latest.slice(0, 4)}-01-01` : '', to: latest }
}
const shortDate = (value: string) => (value ? `${value.slice(8, 10)}/${value.slice(5, 7)}` : '')

export default function ReproductionTimeline({ profile, canManage, onRevise }: {
  profile: ReproductionFemale
  canManage: boolean
  onRevise: (record: TimelineRecord, action: 'correct' | 'void') => void
}) {
  const [type, setType] = useState<ReproductionEventType | ''>('')
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [picker, setPicker] = useState(false)
  const auto = autoRange(profile.events)
  const range = custom ?? { from: auto.from, to: '' }
  const label = custom
    ? custom.from || custom.to ? `${custom.from ? `${shortDate(custom.from)}/${custom.from.slice(0, 4)}` : '…'} – ${custom.to ? `${shortDate(custom.to)}/${custom.to.slice(0, 4)}` : '…'}` : 'Tất cả thời gian'
    : `${shortDate(auto.from)} – ${formatDate(auto.to)}`
  const rows = profile.events
    .filter((event) => (!type || event.type === type)
      && (!range.from || event.occurredAt.slice(0, 10) >= range.from) && (!range.to || event.occurredAt.slice(0, 10) <= range.to))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  const open = (event: ReproductionEvent, action: 'correct' | 'void') => {
    const calving = event.type === 'CALVING' ? profile.calvings.find((item) => item.id === event.id) : undefined
    onRevise(calving ? { kind: 'calving', calving } : { kind: 'event', event }, action)
  }

  return (
    <Card
      title="Dòng thời gian sinh sản"
      sub={'Dòng đã sửa có nhãn "Đã sửa"; dòng đã hủy in xám'}
      actions={
        <div className="relative flex flex-wrap items-center gap-2.5">
          <Select aria-label="Loại sự kiện" className="w-[150px]" value={type} onChange={(event) => setType(event.target.value as ReproductionEventType | '')}>
            {TYPE_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </Select>
          <button type="button" aria-label="Khoảng thời gian" aria-expanded={picker} onClick={() => setPicker((value) => !value)} className={`${inputCls} flex w-[190px] cursor-pointer items-center gap-1.5 text-left`}>
            <span className="min-w-0 flex-1 whitespace-nowrap">{label}</span><Icon name="calendar-event" className="text-muted" />
          </button>
          {picker && (
            <div className="absolute right-0 top-12 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-white p-3 shadow-md">
              <input type="date" aria-label="Từ ngày" className={`${inputCls} w-[150px]`} value={custom ? custom.from : auto.from} onChange={(event) => setCustom({ from: event.target.value, to: custom?.to ?? '' })} />
              <input type="date" aria-label="Đến ngày" className={`${inputCls} w-[150px]`} value={custom ? custom.to : ''} onChange={(event) => setCustom({ from: custom ? custom.from : auto.from, to: event.target.value })} />
              <button type="button" className="cursor-pointer text-xs font-semibold text-brand" onClick={() => { setCustom({ from: '', to: '' }); setPicker(false) }}>Tất cả</button>
              <button type="button" className="cursor-pointer text-xs font-semibold text-muted" onClick={() => { setCustom(null); setPicker(false) }}>Mặc định</button>
            </div>
          )}
        </div>
      }
    >
      <Table scroll>
        <thead><tr><Th>Thời điểm ↓</Th><Th>Sự kiện</Th><Th>Chi tiết</Th><Th>Nguồn dữ liệu</Th><Th>Người ghi</Th><Th>Thao tác</Th></tr></thead>
        <tbody>
          {rows.map((event) => {
            const voided = event.status === 'VOIDED'
            const stamp = formatDateTime(event.occurredAt)
            return (
              <tr key={event.id} className={voided ? 'bg-page text-muted' : ''}>
                <Td className="whitespace-nowrap font-medium">{stamp}</Td>
                <Td><div className="flex flex-wrap items-center gap-1.5"><EventBadge type={event.type} />{voided ? <span className="text-[11px]">Đã hủy</span> : event.corrected && <span className="whitespace-nowrap text-[11px] text-muted">Đã sửa</span>}</div></Td>
                <Td className={voided ? 'line-through' : ''}>{event.details || event.summary}{voided && event.voidReason && <div className="text-[11px] no-underline">Lý do hủy: {event.voidReason}</div>}</Td>
                <Td>{SOURCE_LABEL[event.dataSource ?? 'DIRECT_OBSERVATION']}</Td>
                <Td className="whitespace-nowrap">{event.recorder}</Td>
                <Td className="whitespace-nowrap font-semibold text-brand">
                  {canManage && !voided && (
                    <>
                      <button type="button" aria-label={`Sửa ${stamp}`} className="cursor-pointer font-semibold" onClick={() => open(event, 'correct')}>Sửa</button>
                      <span className="mx-1 text-muted">·</span>
                      <button type="button" aria-label={`Hủy ${stamp}`} className="cursor-pointer font-semibold" onClick={() => open(event, 'void')}>Hủy</button>
                    </>
                  )}
                </Td>
              </tr>
            )
          })}
          {!rows.length && <tr><Td colSpan={6} className="py-8 text-center text-muted">Chưa có sự kiện sinh sản trong khoảng đã chọn.</Td></tr>}
        </tbody>
      </Table>
    </Card>
  )
}
