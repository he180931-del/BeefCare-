import { Button } from '../../components/ui'
import { Chip } from './parts'

export const COW_TABS = [
  ['', 'Tổng quan'],
  ['timeline', 'Dòng thời gian'],
  ['growth', 'Tăng trưởng & BCS'],
  ['vaccine', 'Tiêm phòng'],
  ['health', 'Sức khỏe'],
  ['repro', 'Sinh sản'],
  ['barns', 'Lịch sử chuồng'],
  ['qr', 'Thẻ QR'],
]

/** Mô tả dòng 2 của header: "Số tai X · giống · giới · tuổi · Chuồng X". */
export const cowDesc = (cow) =>
  [
    cow.tag && `Số tai ${cow.tag}`,
    cow.breed,
    cow.sex,
    cow.headerAge !== false && cow.ageLong,
    cow.barn && `Chuồng ${cow.barn}`,
  ]
    .filter(Boolean)
    .join(' · ')

export default function CowHeader({ cow, tab, onTab, onOpenModal }) {
  const voided = cow.status === 'VOIDED'
  const exited = cow.status === 'EXITED'
  const active = cow.status === 'ACTIVE'
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-[18px] rounded-md border border-edge bg-white p-4">
        <div className="size-16 shrink-0 rounded-full bg-ok-bg" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="text-[22px] font-bold leading-[normal] text-[#212121]">
            {cow.name ? `${cow.code}  “${cow.name}”` : cow.code}
          </div>
          <div className="text-xs leading-[normal] text-muted">{cowDesc(cow)}</div>
          <div className="flex flex-wrap gap-1.5">
            {voided ? <Chip tone="err">VOIDED</Chip> : exited ? <Chip>EXITED</Chip> : <Chip tone="ok">ACTIVE</Chip>}
            {active && cow.headerBadges.map(([label, tone]) => (
              <Chip key={label} tone={tone}>{label}</Chip>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        {active && (
          <div className="flex flex-wrap gap-2.5">
            <Button className="leading-[normal]" onClick={() => onOpenModal('update')}>Cập nhật hồ sơ</Button>
            <Button className="leading-[normal]" onClick={() => onOpenModal('qr-reissue')}>Cấp lại QR</Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-1">
        {COW_TABS.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onTab(v)}
            className="flex cursor-pointer flex-col items-start gap-1.5 px-3 text-[13px] leading-[normal]"
          >
            <span className={v === tab ? 'font-semibold text-[#212121]' : 'text-muted'}>{l}</span>
            <span className={`h-[3px] w-full rounded-[2px] ${v === tab ? 'bg-brand' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  )
}
