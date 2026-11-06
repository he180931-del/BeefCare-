import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../../../components/Icon'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Button, Info, Note } from '../../../components/ui'
import { dateKey, formatDayMonth, formatTime, weekdayOf } from '../domain/format'
import { dueLabel, pillLabel } from '../domain/reminderRules'
import type { ReminderItem, Urgency } from '../types'

export const URGENCY_STYLE: Record<Urgency, { heading: string; icon: IconName; marker: string; due: string; head: string }> = {
  OVERDUE: { heading: 'QUÁ HẠN', icon: 'alert-triangle', marker: 'bg-err-bg text-err-fg', due: 'text-err-fg', head: 'text-err-fg' },
  TODAY: { heading: 'HÔM NAY', icon: 'clock', marker: 'bg-warn-bg text-warn-fg', due: 'text-warn-fg', head: 'text-warn-fg' },
  UPCOMING: { heading: 'SẮP TỚI', icon: 'calendar-event', marker: 'bg-ok-bg text-ok-fg', due: 'text-muted', head: 'text-ok-fg' },
}

const codeLine = (i: ReminderItem) => i.code ?? i.group ?? ''

export function ReminderRow({ item, today, onOpen }: { item: ReminderItem; today: string; onOpen: () => void }) {
  const navigate = useNavigate()
  const style = URGENCY_STYLE[item.urgency]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-3 last:border-b-0">
      <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full ${style.marker}`}><Icon name={style.icon} size={14} /></span>
      <span className={`w-[88px] shrink-0 text-[11px] font-bold ${style.due}`}>{dueLabel(item, today)}</span>
      <button type="button" onClick={onOpen} className="min-w-[200px] flex-1 cursor-pointer border-0 bg-transparent p-0 text-left" aria-label={`Chi tiết: ${item.title}`}>
        <span className="block text-[13px] font-bold text-[#183528]">{item.title}</span>
        <span className="text-[10px] text-subtle">{codeLine(item)}{item.pen && item.code ? ` · ${item.pen}` : ''}</span>
      </button>
      <span className="w-[124px] shrink-0 rounded-[10px] bg-chip px-3 py-1.5 text-center text-[10px] font-bold text-brand-dark">{pillLabel(item.type)}</span>
      <Button size="sm" className="w-[150px] shrink-0 justify-center" onClick={() => navigate(item.to)}>{item.openLabel}</Button>
    </div>
  )
}

/** Nhãn nhóm khi xem theo lịch: "T3 20/10". */
export const dayHeading = (item: ReminderItem) => (item.dueAt ? `${weekdayOf(dateKey(item.dueAt))} ${formatDayMonth(item.dueAt)}` : 'CHƯA CÓ HẠN')

export function ReminderDetailModal({ item, today, technician, onClose }: { item: ReminderItem; today: string; technician: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const due = item.dueAt
    ? `${dueLabel(item, today)} · ${formatDayMonth(item.dueAt)}${item.windowEnd ? ` (đến ${formatTime(item.windowEnd)})` : ''}`
    : 'Chưa xác định'
  const cattle = [item.code ?? item.group, item.breed, item.pen && `chuồng ${item.pen}`].filter(Boolean).join(' · ')
  const profile = item.code && !item.code.startsWith('Bê của') ? (technician ? `/kt/dan-bo/${item.code}` : `/cattle/${item.code}`) : null
  return (
    <Modal title="Chi tiết nhắc việc" sub={item.title} width={560} onClose={onClose}>
      <Info cols={2} items={[
        ['Bò', cattle || '—'],
        ['Loại nhắc việc', item.rule],
        ['Hạn', due, item.urgency === 'OVERDUE'],
        ['Nguồn', item.source],
        ['Cơ sở', item.basis ? `${item.basis}${item.parameterVersion ? ` · tham số v${item.parameterVersion}` : ''}` : '—'],
      ]} />
      {item.basisMissing && <Note tone="warn">{`Chưa xác định hạn: thiếu ${item.basisMissing}.`}</Note>}
      <p className="m-0 mt-3 text-[11px] text-subtle">Xem nhắc việc không làm nhắc việc được xử lý (GBR-63).</p>
      <ModalFooter>
        <ModalButton onClick={onClose}>Đóng</ModalButton>
        {profile && <ModalButton onClick={() => navigate(profile)}>Mở hồ sơ bò</ModalButton>}
        {!technician && <ModalButton variant="primary" onClick={() => navigate(item.to)}>{item.openLabel === 'Mở hồ sơ' ? 'Mở nguồn' : item.openLabel}</ModalButton>}
      </ModalFooter>
    </Modal>
  )
}
