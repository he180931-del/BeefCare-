import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui'
import { Icon, type IconName } from '../../../components/Icon'
import { Chip, chipIcon } from './parts'
import type { CowSeed } from '../../../data/cowsData'

export const COW_TABS: ReadonlyArray<readonly [string, string, IconName]> = [
  ['', 'Tổng quan', 'id'],
  ['timeline', 'Dòng thời gian', 'timeline-event'],
  ['growth', 'Tăng trưởng & BCS', 'scale'],
  ['vaccine', 'Tiêm phòng', 'vaccine'],
  ['health', 'Sức khỏe', 'stethoscope'],
  ['repro', 'Sinh sản', 'dna'],
  ['barns', 'Lịch sử chuồng', 'fence'],
  ['qr', 'Thẻ QR', 'qrcode'],
]

// Nút chính bên phải thay đổi theo tab; trang ghi nhận do tính năng tương ứng sở hữu.
const TAB_ACTIONS: Record<string, { label: string; to: string }> = {
  growth: { label: 'Ghi nhận cân & BCS', to: '/can-nang/ghi-nhan' },
  vaccine: { label: 'Ghi nhận tiêm', to: '/tiem-phong/ghi-nhan' },
  health: { label: 'Mở ca sức khỏe', to: '/suc-khoe/mo-ca' },
}

/** Mô tả dòng 2 của header: "Số tai X · giống · giới · tuổi · Chuồng X". */
export const cowDesc = (cow: CowSeed): string =>
  [
    cow.tag && `Số tai ${cow.tag}`,
    cow.breed,
    cow.sex,
    cow.headerAge !== false && cow.ageLong,
    cow.barn && `Chuồng ${cow.barn}`,
  ]
    .filter(Boolean)
    .join(' · ')

export default function CowHeader({ cow, tab, canWrite, onTab, onOpenModal }: { cow: CowSeed; tab: string; canWrite: boolean; onTab: (tab: string) => void; onOpenModal: (name: string) => void }) {
  const nav = useNavigate()
  const voided = cow.status === 'VOIDED'
  const exited = cow.status === 'EXITED'
  const active = cow.status === 'ACTIVE'
  const action = canWrite ? TAB_ACTIONS[tab] : undefined
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
            {voided ? <Chip tone="err">VOIDED</Chip> : exited ? <Chip>{cow.exitStatusLabel ?? 'EXITED'}</Chip> : <Chip tone="ok" icon="circle-check">ACTIVE</Chip>}
            {active && cow.headerBadges.map(([label, tone]) => (
              <Chip key={label} tone={tone} icon={chipIcon(label)}>{label}</Chip>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        {canWrite && (
          <div className="flex flex-wrap gap-2.5">
            {action && <Button variant="primary" className="leading-[normal]" onClick={() => nav(`${action.to}?cattle=${encodeURIComponent(cow.code)}`)}>{action.label}</Button>}
            <Button className="gap-1.5 leading-[normal]" onClick={() => onOpenModal('update')}><Icon name="edit" />Cập nhật hồ sơ</Button>
            <Button className="gap-1.5 leading-[normal]" onClick={() => onOpenModal('qr-reissue')}><Icon name="qrcode" />Cấp lại QR</Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-x-1">
        {COW_TABS.map(([v, l, icon]) => (
          <button
            key={v}
            type="button"
            onClick={() => onTab(v)}
            className="flex cursor-pointer flex-col items-start gap-1.5 px-3 text-[13px] leading-[normal]"
          >
            <span className={`flex items-center gap-1.5 ${v === tab ? 'font-semibold text-[#212121]' : 'text-muted'}`}><Icon name={icon} size={14} />{l}</span>
            <span className={`h-[3px] w-full rounded-[2px] ${v === tab ? 'bg-brand' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  )
}
