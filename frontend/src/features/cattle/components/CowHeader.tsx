import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui'
import { Icon, type IconName } from '../../../components/Icon'
import { useSession } from '../../authorization'
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

// Nút chính bên phải thay đổi theo tab; hộp thoại ?m= do tab chăm sóc tương ứng mở, tiêm phòng có trang ghi nhận riêng.
const TAB_ACTIONS: Record<string, { label: string; modal?: string; page?: (code: string) => string }> = {
  growth: { label: 'Ghi nhận cân & BCS', modal: 'record' },
  vaccine: {
    label: 'Ghi nhận tiêm',
    page: (code) => `/tiem-phong/ghi-nhan?cattle=${encodeURIComponent(code)}&back=${encodeURIComponent(`/cattle/${code}?tab=vaccine`)}`,
  },
  health: { label: 'Mở ca sức khỏe', modal: 'open-case' },
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
  const [copied, setCopied] = useState('')
  // SCR-19 #6: mã nội bộ không hiển thị; chỉ sao chép để gửi hỗ trợ (GBR-23).
  const copyInternalId = () => {
    const id = String(cow.internalId ?? '')
    const done = () => setCopied('Đã sao chép mã nội bộ.')
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(id).then(done, () => setCopied('Không sao chép được mã nội bộ.'))
    else done()
  }
  const hasActiveTag = cow.qrHistory.some((q) => q.status === 'ACTIVE')
  const voided = cow.status === 'VOIDED'
  const exited = cow.status === 'EXITED'
  const active = cow.status === 'ACTIVE'
  // Chỉ Quản lý ghi nhận chăm sóc; Chủ trại vẫn cập nhật được hồ sơ nhưng không thấy nút này.
  const canRecord = (useSession()?.role ?? 'MANAGER') === 'MANAGER'
  const action = canWrite && canRecord ? TAB_ACTIONS[tab] : undefined
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-[18px] rounded-md border border-edge bg-white p-4">
        {cow.photoUrl
          ? <img src={String(cow.photoUrl)} alt={`Ảnh ${cow.code}`} className="size-16 shrink-0 rounded-full object-cover" />
          : <div className="size-16 shrink-0 rounded-full bg-ok-bg" aria-hidden="true" />}
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="text-[22px] font-bold leading-[normal] text-[#212121]">
            {cow.name ? `${cow.code}  “${cow.name}”` : cow.code}
          </div>
          <div className="text-xs leading-[normal] text-muted">{cowDesc(cow)}</div>
          <div className="flex flex-wrap gap-1.5">
            {voided ? <Chip tone="err">Đã hủy</Chip> : exited ? <Chip>{cow.exitStatusLabel ?? 'Đã xuất đàn'}</Chip> : <Chip tone="ok" icon="circle-check">Đang hoạt động</Chip>}
            {active && cow.headerBadges.map(([label, tone]) => (
              <Chip key={label} tone={tone} icon={chipIcon(label)}>{label}</Chip>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        {canWrite && (
          <div className="flex flex-wrap gap-2.5">
            {action && <Button variant="primary" className="leading-[normal]" onClick={() => (action.page ? nav(action.page(cow.code)) : onOpenModal(action.modal ?? ''))}><Icon name="circle-plus" size={16} />{action.label}</Button>}
            <Button className="gap-1.5 leading-[normal]" onClick={() => onOpenModal('update')}><Icon name="edit" />Cập nhật hồ sơ</Button>
            <Button className="gap-1.5 leading-[normal]" onClick={() => onOpenModal('qr-reissue')}><Icon name="qrcode" />{hasActiveTag ? 'Cấp lại QR' : 'Cấp QR'}</Button>
          </div>
        )}
        <div className="flex flex-col items-end gap-1">
          <Button small className="leading-[normal]" onClick={copyInternalId} title="Sao chép mã nội bộ để gửi hỗ trợ">⋯ Sao chép mã nội bộ</Button>
          {copied && <span className="text-[11px] text-muted" role="status">{copied}</span>}
        </div>
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
