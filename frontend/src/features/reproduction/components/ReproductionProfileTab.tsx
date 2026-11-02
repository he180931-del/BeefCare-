import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Foot, KV, Note } from '../../../components/ui'
import { Icon, type IconName } from '../../../components/Icon'
import { backendMode } from '../../../api/backendTransport'
import { reproductionApi } from '../api/reproductionApi'
import { useModalParam } from '../../../components/Modal'
import { useSession } from '../../authorization'
import {
  ACTION_FOR_MODAL, MODAL_FOR_ACTION, actionsForStatus, formatDate, isDueSoon, primaryActionFor, type ReproductionAction,
} from '../domain/reproductionRules'
import type { ReproductionFemale, ReproductionRole } from '../types'
import ReproductionActionDialog, { type ReproductionDialogTarget } from './ReproductionActionDialog'
import { CalfHistoryCard, EligibilityCard, LastBreedingCard, PregnancyCard, WindowCard } from './ReproductionCards'
import ReproductionTimeline, { type TimelineRecord } from './ReproductionTimeline'
import { nowLocal } from './reproductionFields'

const ACTION_LABEL: Record<ReproductionAction, string> = {
  RECORD_ESTRUS: 'Ghi động dục', RECORD_BREEDING: 'Ghi phối giống', RECORD_PREGNANCY_CHECK: 'Ghi khám thai',
  RECORD_PREGNANCY_UPDATE: 'Ghi diễn biến thai', RECORD_CALVING: 'Ghi sự kiện đẻ',
}
const ACTION_ICON: Record<ReproductionAction, IconName> = {
  RECORD_ESTRUS: 'flame', RECORD_BREEDING: 'dna', RECORD_PREGNANCY_CHECK: 'heartbeat', RECORD_PREGNANCY_UPDATE: 'clipboard-list', RECORD_CALVING: 'baby-carriage',
}
const CAPTION: Record<string, string> = {
  IN_ESTRUS: 'Tab Sinh sản khi bò Đang động dục. Nút ghi hiện theo trạng thái (chỉ Quản lý): Ghi động dục, Ghi phối giống; "Thêm" chứa Ghi khám thai và Ghi sự kiện đẻ khi thai không được theo dõi. Điều kiện xét phối và cửa sổ phối chỉ để tham khảo.',
  BRED: 'Tab Sinh sản khi bò Đã phối – chờ khám thai. Nút chính là Ghi khám thai; vẫn có Ghi động dục (nếu bò động dục lại) và Ghi sự kiện đẻ. Dải chỉ số sinh sản tính riêng cho từng bò, hiện "—" khi chưa áp dụng.',
  PREGNANT: 'Tab Sinh sản khi bò Đang mang thai (hiện "Sắp đẻ" khi trong thời gian chuẩn bị đẻ của trại). Nút chính là Ghi sự kiện đẻ; có thêm Ghi khám thai và Ghi diễn biến thai. Lịch sử sinh bê liên kết tới hồ sơ bê đã đăng ký, hoặc ghi "Bê nháp".',
}

function StatusBadge({ profile }: { profile: ReproductionFemale }) {
  if (profile.status === 'IN_ESTRUS') return <Badge tone="info" icon="flame">Đang động dục</Badge>
  if (profile.status === 'BRED') return <Badge tone="info" icon="clock">Đã phối – chờ khám thai</Badge>
  if (profile.status === 'PREGNANT') return isDueSoon(profile, nowLocal()) ? <Badge tone="warn" icon="heartbeat">Mang thai · Sắp đẻ</Badge> : <Badge tone="ok" icon="heartbeat">Mang thai</Badge>
  if (profile.status === 'POST_CALVING') return <Badge icon="baby-carriage">Sau sinh</Badge>
  return <Badge tone="outline" icon="clock">Chờ phối</Badge>
}

function MoreMenu({ onPick }: { onPick: (action: ReproductionAction) => void }) {
  const [open, setOpen] = useState(false)
  const items: Array<[ReproductionAction, string]> = [['RECORD_PREGNANCY_CHECK', 'Ghi khám thai'], ['RECORD_CALVING', 'Ghi sự kiện đẻ (không theo dõi thai kỳ)']]
  return (
    <div className="relative">
      <Button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>Thêm<Icon name="chevron-down" size={16} /></Button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+4px)] z-10 flex min-w-[260px] flex-col rounded-lg border border-edge bg-white py-1 shadow-md">
          {items.map(([action, label]) => (
            <button key={action} type="button" role="menuitem" className="cursor-pointer px-3 py-2 text-left text-xs hover:bg-page" onClick={() => { setOpen(false); onPick(action) }}>{label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusCard({ profile, canManage, onAction }: { profile: ReproductionFemale; canManage: boolean; onAction: (action: ReproductionAction) => void }) {
  const primary = primaryActionFor(profile.status)
  const active = canManage && profile.herdStatus === 'ACTIVE'
  const shown = active ? actionsForStatus(profile.status).sort((a, b) => Number(a === primary) - Number(b === primary)) : []
  const showMore = active && ['YOUNG_STOCK', 'ADULT'].includes(profile.lifeStage)
  const hasCalvings = profile.calvings.some((calving) => calving.status === 'VALID')
  const ind = profile.indicators
  const dash = (value: number | null, unit: string) => (value == null ? '—' : `${value} ${unit}`)
  return (
    <Card
      title="Trạng thái sinh sản"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <StatusBadge profile={profile} />
          {profile.indicators.overdueForConception && <Badge tone="warn">Quá hạn phối</Badge>}
          {shown.map((action) => (
            <Button key={action} variant={action === primary ? 'primary' : 'default'} onClick={() => onAction(action)}><Icon name={ACTION_ICON[action]} size={16} />{ACTION_LABEL[action]}</Button>
          ))}
          {showMore && <MoreMenu onPick={onAction} />}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        <KV k="Số lần phối (chu kỳ này)">{profile.servicesInCurrentCycle}</KV>
        <KV k="Số lần đẻ">{profile.parity}</KV>
        <KV k="Lần đẻ gần nhất"><span className="whitespace-nowrap">{formatDate(profile.lastCalvingAt)}</span></KV>
        <KV k="Cân gần nhất"><span className="whitespace-nowrap">{profile.latestWeightKg == null ? '—' : `${profile.latestWeightKg} kg · thực tế`}</span></KV>
        {profile.status === 'PREGNANT' && <>
          <KV k="Khoảng cách lứa gần nhất">{dash(ind.lastCalvingIntervalDays, 'ngày')}</KV>
          <KV k="Phối / đậu thai">{ind.conceptionDetail ?? ind.conceptionSummary}</KV>
        </>}
      </div>
      {hasCalvings ? (
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-md bg-page p-3 md:grid-cols-5">
          <KV k="Tuổi đẻ lứa đầu">{dash(ind.ageAtFirstCalvingMonths, 'tháng')}</KV>
          <KV k="Khoảng cách lứa gần nhất">{dash(ind.lastCalvingIntervalDays, 'ngày')}</KV>
          <KV k="Ngày sau đẻ">{dash(ind.daysSinceLastCalving, 'ngày')}</KV>
          <KV k="Ngày không mang thai">{dash(ind.daysOpen, 'ngày')}</KV>
          <KV k="Thụ thai">{ind.conceptionSummary}</KV>
        </div>
      ) : <div className="mt-3"><Note>Chưa có chỉ số sinh sản: bò chưa đẻ lứa nào.</Note></div>}
    </Card>
  )
}

export default function ReproductionProfileTab({ cattleCode, role: roleProp }: { cattleCode: string; role?: ReproductionRole }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useSession()
  const role: ReproductionRole = roleProp ?? (session?.role === 'OWNER' || session?.role === 'MANAGER' ? session.role : 'TECHNICIAN')
  const [modal, openModal, closeModal] = useModalParam()
  const [profile, setProfile] = useState<ReproductionFemale | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [localDialog, setLocalDialog] = useState<ReproductionDialogTarget | null>(null)
  const canManage = role === 'MANAGER'
  const notice = (location.state as { reproductionNotice?: string } | null)?.reproductionNotice
  // ?m=ghi-dong-duc etc. lets the profile header open a recording dialog; only a Manager gets it.
  const modalAction = modal ? ACTION_FOR_MODAL[modal] : undefined
  const dialog: ReproductionDialogTarget | null = localDialog ?? (canManage && modalAction ? { mode: 'record', action: modalAction } : null)
  const setDialog = (next: ReproductionDialogTarget | null) => {
    setLocalDialog(next && next.mode !== 'record' ? next : null)
    if (next?.mode === 'record') openModal(MODAL_FOR_ACTION[next.action])
    else if (!next && modal) closeModal()
  }

  const refresh = async () => {
    setError('')
    try { setProfile(await reproductionApi.getProfile(cattleCode)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ sinh sản.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [cattleCode])

  const run = (action: ReproductionAction) => {
    if (action === 'RECORD_CALVING') navigate(`/cattle/${encodeURIComponent(cattleCode)}/sinh-san/de`)
    else setDialog({ mode: 'record', action })
  }
  const revise = (record: TimelineRecord, action: 'correct' | 'void') => setDialog({ mode: 'revise', record, action })

  if (loading && !profile) return <Card><p className="m-0 text-sm text-muted">Đang tải hồ sơ sinh sản…</p></Card>
  if (!profile) return <Card>{error && <Note tone={backendMode === 'backend' ? 'warn' : 'err'}>{error}</Note>}<p className="m-0 text-sm text-muted">Chưa có dữ liệu sinh sản cho {cattleCode}.</p></Card>

  const status = profile.status
  const showEligibility = !!profile.eligibility && (status === 'AWAITING_BREEDING' || status === 'IN_ESTRUS' || status === 'POST_CALVING')
  const showWindow = status === 'IN_ESTRUS' && !!profile.breedingWindow
  const hasCalvings = profile.calvings.some((calving) => calving.status === 'VALID')

  return (
    <div className="flex flex-col gap-4">
      {notice && <Note tone="ok">{notice}</Note>}
      {error && <Note tone={backendMode === 'backend' ? 'warn' : 'err'}>{error}</Note>}
      {backendMode === 'backend' && <Note tone="warn">Hồ sơ sinh sản chưa nối API. Dữ liệu minh họa không được dùng trong chế độ backend.</Note>}
      {!canManage && <Note tone="info">{role === 'TECHNICIAN' ? 'Kỹ thuật viên chỉ xem hồ sơ và dòng thời gian sinh sản.' : 'Chủ trại xem hồ sơ sinh sản ở chế độ chỉ đọc.'}</Note>}
      {profile.herdStatus !== 'ACTIVE' && <Note tone="warn">Bò đã rời đàn hoặc đang chờ xác nhận xuất; hồ sơ sinh sản chỉ xem.</Note>}

      {!profile.applicable ? (
        <Card title="Trạng thái sinh sản"><Note>Không theo dõi sinh sản cho bò này theo giai đoạn hoặc mục đích nuôi. Nếu đã có khám thai hoặc sự kiện đẻ thực tế, hãy ghi từ "Thêm". Dòng thời gian vẫn được giữ.</Note></Card>
      ) : (
        <>
          <StatusCard profile={profile} canManage={canManage} onAction={run} />
          {(showEligibility || showWindow) && (
            <div className={`grid gap-4 ${showEligibility && showWindow ? 'lg:grid-cols-2' : ''}`}>
              {showEligibility && <EligibilityCard profile={profile} />}
              {showWindow && <WindowCard profile={profile} />}
            </div>
          )}
          {status === 'BRED' && <LastBreedingCard profile={profile} />}
          {status === 'PREGNANT' && (
            <div className="grid gap-4 lg:grid-cols-[7fr_4fr]"><PregnancyCard profile={profile} /><CalfHistoryCard profile={profile} /></div>
          )}
          {status === 'POST_CALVING' && hasCalvings && <CalfHistoryCard profile={profile} />}
        </>
      )}

      <ReproductionTimeline profile={profile} canManage={canManage && profile.herdStatus === 'ACTIVE'} onRevise={revise} />

      {profile.revisions.length > 0 && (
        <Card title="Lịch sử chỉnh sửa" sub="Giá trị cũ được giữ lại trong lịch sử.">
          <div className="flex flex-col gap-2">{profile.revisions.map((revision) => <div key={revision.id} className="rounded border border-edge p-3 text-xs"><b>{revision.changedBy}</b> · {revision.changedAt.slice(0, 16).replace('T', ' ')} · {revision.reason}</div>)}</div>
        </Card>
      )}
      {status && CAPTION[status] && <Foot>{CAPTION[status]}</Foot>}

      {dialog && (
        <ReproductionActionDialog
          target={dialog} profile={profile} onClose={() => setDialog(null)}
          onRecord={async (command) => setProfile(await reproductionApi.recordEvent(cattleCode, command, role))}
          onCorrectEvent={async (id, patch, reason) => setProfile(await reproductionApi.correctEvent(cattleCode, id, patch, reason, role))}
          onVoidEvent={async (id, reason) => setProfile(await reproductionApi.voidEvent(cattleCode, id, reason, role))}
          onCorrectCalving={async (id, patch, reason) => setProfile(await reproductionApi.correctCalving(cattleCode, id, patch, reason, role))}
          onVoidCalving={async (id, reason) => setProfile(await reproductionApi.voidCalving(cattleCode, id, reason, role))}
          onVoidCalf={async (calvingId, calfId, reason) => setProfile(await reproductionApi.voidCalf(cattleCode, calvingId, calfId, reason, role))}
        />
      )}
    </div>
  )
}
