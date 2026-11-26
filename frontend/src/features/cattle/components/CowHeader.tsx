import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Icon, type IconName } from '../../../shared/ui'
import { useCanRecordCare } from '../../authorization'
import { Chip, chipIcon } from './parts'
import CowPhoto from './CowPhoto'
import { isFemale } from '../domain/profileRules'
import type { CattleViewModel as CowSeed } from '../types'

/**
 * Các tab của SCR-19. D79: Lịch sử chuồng (SCR-20) và Thẻ QR (SCR-21) là khối gập cuối tab Tổng quan, không còn là tab;
 * còn 6 tab (5 với bò đực) để vừa một hàng trên điện thoại.
 */
export const COW_TABS: ReadonlyArray<readonly [string, string, IconName]> = [
  ['', 'Tổng quan', 'id'],
  ['timeline', 'Dòng thời gian', 'timeline-event'],
  ['growth', 'Tăng trưởng & BCS', 'scale'],
  ['vaccine', 'Tiêm phòng', 'vaccine'],
  ['health', 'Sức khỏe', 'stethoscope'],
  ['repro', 'Sinh sản', 'dna'],
]

/** Liên kết cũ ?tab=barns / ?tab=qr (dòng thời gian, đánh dấu trang) mở tab Tổng quan và mở sẵn khối tương ứng. */
export const OVERVIEW_SECTIONS = ['barns', 'qr'] as const
export type OverviewSection = (typeof OVERVIEW_SECTIONS)[number]

/** SCR-19: the Reproduction tab is shown for females only. */
export const cowTabs = (cow: CowSeed) => COW_TABS.filter(([value]) => value !== 'repro' || isFemale(cow))

/**
 * Huy hiệu trạng thái đàn (§3.2, SCR-19 #4). D78: bò đang nuôi bình thường không hiện huy hiệu nào –
 * chỉ Chờ xuất, Đã xuất và Nhập nhầm – đã hủy mới cần báo.
 */
export function HerdStatusChip({ cow }: { cow: CowSeed }) {
  if (cow.status === 'VOIDED') return <Chip tone="err">Nhập nhầm – đã hủy</Chip>
  if (cow.status === 'EXITED') return <Chip>{cow.exitStatusLabel ?? 'Đã xuất đàn'}</Chip>
  if (cow.exitPending || cow.status === 'EXIT_PENDING') return <Chip tone="warn">Chờ xuất</Chip>
  return null
}

// Nút chính bên phải thay đổi theo tab; hộp thoại ?m= do tab chăm sóc tương ứng mở, tiêm phòng có trang ghi nhận riêng.
const TAB_ACTIONS: Record<string, { label: string; modal?: string; page?: (code: string) => string }> = {
  growth: { label: 'Ghi nhận cân & BCS', modal: 'record' },
  vaccine: {
    label: 'Ghi nhận tiêm',
    page: (code) => `/tiem-phong/ghi-nhan?cattle=${encodeURIComponent(code)}&back=${encodeURIComponent(`/cattle/${code}?tab=vaccine`)}`,
  },
  health: { label: 'Mở ca sức khỏe', modal: 'open-case' },
}

/**
 * Mô tả dòng 2 của header: "Số tai X · giống · giới · tuổi · Chuồng X · 342 kg* (18/10)".
 * D78: cân gần nhất nằm ngay tiêu đề; "*" là cân ước tính, ngày cân trong ngoặc khi có.
 */
export const cowDesc = (cow: CowSeed): string =>
  [
    cow.tag ? `Số tai ${cow.tag}` : 'Gắn tai sau',
    cow.breed,
    cow.sex,
    // Không rõ ngày sinh thì bỏ hẳn phần tuổi, không để "—" giữa dòng.
    cow.headerAge !== false && cow.ageLong !== '—' && cow.ageLong,
    cow.barn && `Chuồng ${cow.barn}`,
    cow.weight != null && `${cow.weight} kg${cow.weightEst ? '*' : ''}${cow.weightDate && cow.weightDate !== '—' ? ` (${cow.weightDate})` : ''}`,
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
  const active = cow.status === 'ACTIVE'
  // Chủ trại và Quản lý ghi nhận chăm sóc (GBR-08, D41); Kỹ thuật viên không thấy nút này.
  const canRecord = useCanRecordCare()
  const action = canWrite && canRecord ? TAB_ACTIONS[tab] : undefined
  // D79: khi đổi tab, chỉ cuộn ngang thanh tab cho tab đang chọn lọt vào tầm nhìn – không bao giờ cuộn dọc cả trang.
  const tabsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const bar = tabsRef.current
    const current = bar?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!bar || !current) return
    const box = bar.getBoundingClientRect()
    const item = current.getBoundingClientRect()
    if (item.left < box.left || item.right > box.right) bar.scrollLeft += item.left - box.left
  }, [tab])
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-[18px] rounded-2xl border border-field bg-white p-4">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <CowPhoto key={cow.code} code={cow.code} photoUrl={cow.photoUrl} />
          {canWrite && (
            <Button small variant="link" className="min-h-8 px-1" onClick={() => onOpenModal('photo')}>
              {cow.photoUrl ? 'Đổi ảnh' : 'Thêm ảnh'}
            </Button>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="text-[22px] font-bold leading-[normal] text-[#212121]">
            {cow.name ? `${cow.code}  “${cow.name}”` : cow.code}
          </div>
          <div className="text-xs leading-[normal] text-muted">{cowDesc(cow)}</div>
          <div className="flex flex-wrap gap-1.5">
            <HerdStatusChip cow={cow} />
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
      {/* D79: một hàng tab; màn hẹp cuộn ngang thay vì xuống nhiều hàng, tab đang chọn luôn được cuộn vào tầm nhìn. */}
      <nav ref={tabsRef} aria-label="Các tab hồ sơ bò" className="-mx-1 flex items-start gap-x-1 overflow-x-auto px-1 [scrollbar-width:none]">
        {cowTabs(cow).map(([v, l, icon]) => (
          <button
            key={v}
            type="button"
            aria-current={v === tab ? 'page' : undefined}
            onClick={() => onTab(v)}
            className="flex shrink-0 cursor-pointer flex-col items-start gap-1.5 whitespace-nowrap px-3 text-[13px] leading-[normal]"
          >
            <span className={`flex items-center gap-1.5 ${v === tab ? 'font-semibold text-[#212121]' : 'text-muted'}`}><Icon name={icon} size={14} />{l}</span>
            <span className={`h-[3px] w-full rounded-[2px] ${v === tab ? 'bg-brand' : ''}`} />
          </button>
        ))}
      </nav>
    </div>
  )
}
