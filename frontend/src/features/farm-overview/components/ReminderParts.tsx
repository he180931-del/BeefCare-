import { useNavigate } from 'react-router-dom'
import { Button, Icon, type IconName, Info, Modal, ModalButton, ModalFooter, Note } from '../../../shared/ui'
import { dateKey, formatDayMonth, formatTime, weekdayOf } from '../domain/format'
import { dueLabel, pillLabel } from '../domain/reminderRules'
import type { ReminderItem, Urgency } from '../types'

export const URGENCY_STYLE: Record<Urgency, { heading: string; icon: IconName; marker: string; due: string; head: string }> = {
  OVERDUE: { heading: 'QUÁ HẠN', icon: 'alert-triangle', marker: 'bg-err-bg text-err-fg', due: 'text-err-fg', head: 'text-err-fg' },
  TODAY: { heading: 'HÔM NAY', icon: 'clock', marker: 'bg-warn-bg text-warn-fg', due: 'text-warn-fg', head: 'text-warn-fg' },
  UPCOMING: { heading: 'SẮP TỚI', icon: 'calendar-event', marker: 'bg-ok-bg text-ok-fg', due: 'text-muted', head: 'text-ok-fg' },
}

const codeLine = (i: ReminderItem) => i.code ?? i.group ?? ''
const BASIS_LABELS: Record<string, string> = {
  WEIGHING_INTERVAL_DAYS: 'Chu kỳ cân',
  BREEDING_WINDOW_START_HOURS: 'Bắt đầu cửa sổ phối',
  BREEDING_WINDOW_END_HOURS: 'Kết thúc cửa sổ phối',
  PREGNANCY_CHECK_DAYS: 'Thời gian đến hạn khám thai',
  PREGNANCY_RECHECK_DAYS: 'Thời gian đến hạn khám lại',
  CALVING_LEAD_DAYS: 'Thời gian chuẩn bị đẻ',
  VACCINATION_LEAD_DAYS: 'Thời gian nhắc tiêm',
  POST_CALVING_DAYS: 'Khoảng nghỉ sau đẻ',
  WEANING_AGE_MONTHS: 'Tuổi cai sữa',
  YOUNG_STOCK_AGE_MONTHS: 'Tuổi chuyển bò tơ',
  ADULT_AGE_MONTHS: 'Tuổi trưởng thành',
  TARGET_FINISHING_WEIGHT_KG: 'Cân xuất chuồng mục tiêu',
}
const basisUnit = (key: string) => key.endsWith('_DAYS') ? 'ngày' : key.endsWith('_HOURS') ? 'giờ' : key.endsWith('_MONTHS') ? 'tháng' : key.endsWith('_KG') ? 'kg' : ''
const basisLines = (values: ReminderItem['basisValues']) => Object.entries(values ?? {}).map(([key, value]) => {
  const label = BASIS_LABELS[key] ?? key
  const shown = typeof value === 'number' ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value) : value
  const unit = basisUnit(key)
  return `${label}: ${shown}${unit ? ` ${unit}` : ''}`
})
const sexLabel = (sex: string | null | undefined) => sex === 'FEMALE' ? 'Cái' : sex === 'MALE' ? 'Đực' : '—'

export function ReminderRow({ item, today, timeZone, onOpen }: { item: ReminderItem; today: string; timeZone?: string; onOpen: () => void }) {
  const navigate = useNavigate()
  const style = URGENCY_STYLE[item.urgency]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-3 last:border-b-0">
      <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full ${style.marker}`}><Icon name={style.icon} size={14} /></span>
      <span className={`w-[88px] shrink-0 text-[11px] font-bold ${style.due}`}>{dueLabel(item, today, timeZone)}</span>
      <button type="button" onClick={onOpen} className="min-w-[200px] flex-1 cursor-pointer border-0 bg-transparent p-0 text-left" aria-label={`Chi tiết: ${item.title}`}>
        <span className="block text-[13px] font-bold text-[#183528]">{item.title}</span>
        <span className="text-[10px] text-subtle">{codeLine(item) || 'Chưa có mã bò hoặc nhóm'}{item.pen && item.code ? ` · ${item.pen}` : ''}</span>
      </button>
      <span className="w-[124px] shrink-0 rounded-[10px] bg-chip px-3 py-1.5 text-center text-[10px] font-bold text-brand-dark">{pillLabel(item.type)}</span>
      {item.to && item.openLabel && <Button size="sm" className="w-[150px] shrink-0 justify-center" onClick={() => navigate(item.to!)}>{item.openLabel}</Button>}
    </div>
  )
}

/** Nhãn nhóm khi xem theo lịch: "T3 20/10". */
export const dayHeading = (item: ReminderItem, timeZone?: string) => (item.dueAt ? `${weekdayOf(dateKey(item.dueAt, timeZone))} ${formatDayMonth(item.dueAt, timeZone)}` : 'CHƯA CÓ HẠN')

export function ReminderDetailModal({ item, today, timeZone, technician, onClose }: { item: ReminderItem; today: string; timeZone?: string; technician: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const due = item.dueAt
    ? `${dueLabel(item, today, timeZone)} · ${formatDayMonth(item.dueAt, timeZone)}${item.windowEnd ? ` (đến ${formatTime(item.windowEnd, timeZone)})` : ''}`
    : 'Chưa xác định'
  const basisDetails = basisLines(item.basisValues)
  const basis = item.basis
    ? `${item.basis}${item.parameterVersion ? ` · tham số v${item.parameterVersion}` : ''}`
    : item.parameterVersion ? `Phiên bản tham số v${item.parameterVersion}` : basisDetails.length ? '' : 'Chưa có dữ liệu cơ sở'
  const basisText = [basis, ...basisDetails].filter(Boolean).join(' · ')
  const cattle = [item.code ?? item.group, item.breed, item.pen && `chuồng ${item.pen}`].filter(Boolean).join(' · ')
  const profile = item.profileTo ?? null
  return (
    <Modal title="Chi tiết nhắc việc" sub={item.title} width={560} onClose={onClose}>
      <Info cols={2} items={[
        ['Bò', cattle || '—'],
        ['Giới tính', sexLabel(item.sex)],
        ['Tuổi', item.ageMonths == null ? '—' : `${item.ageMonths} tháng`],
        ['Loại nhắc việc', item.rule],
        ['Hạn', due, item.urgency === 'OVERDUE'],
        ['Nguồn', item.source],
        ['Cơ sở', basisText],
      ]} />
      {item.basisMissing && <Note tone="warn">{`Chưa xác định hạn: thiếu ${item.basisMissing}.`}</Note>}
      <p className="m-0 mt-3 text-[11px] text-subtle">Xem nhắc việc không làm nhắc việc được xử lý (GBR-63).</p>
      <ModalFooter>
        <ModalButton onClick={onClose}>Đóng</ModalButton>
        {profile && <ModalButton onClick={() => navigate(profile)}>Mở hồ sơ bò</ModalButton>}
        {item.to && item.openLabel && (!technician || item.sourceTarget?.type === 'FEEDING_LOG') && <ModalButton variant="primary" onClick={() => navigate(item.to!)}>{item.openLabel}</ModalButton>}
      </ModalFooter>
    </Modal>
  )
}
