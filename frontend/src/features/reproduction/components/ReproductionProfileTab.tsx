import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Foot, Icon, type IconName, Note, Panel } from '../../../shared/ui'
import { resolveReproductionSource } from '../api/reproductionBackend'
import { ReproductionOptionsProvider } from './reproductionOptions'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { canRecordCare } from '../../authorization'
import { useSession } from '../../../app/session/sessionContext'
import {
  ACTION_FOR_MODAL, MODAL_FOR_ACTION, actionsForStatus, formatDate, isDueSoon, primaryActionFor, type ReproductionAction,
} from '../domain/reproductionRules'
import type { ReproductionFemale, ReproductionRole } from '../types'
import ReproductionActionDialog, { type ReproductionDialogTarget } from './ReproductionActionDialog'
import { CalfHistoryCard, EligibilityCard, LastBreedingCard, PregnancyCard, WindowCard } from './ReproductionCards'
import ReproductionTimeline, { type TimelineRecord } from './ReproductionTimeline'
import { nowLocal } from './reproductionFields'
import { useReproductionUseCases } from '../hooks/useReproductionUseCases'

const ACTION_LABEL: Record<ReproductionAction, string> = {
  RECORD_ESTRUS: 'Ghi động dục', RECORD_BREEDING: 'Ghi phối giống', RECORD_PREGNANCY_CHECK: 'Ghi khám thai',
  RECORD_PREGNANCY_UPDATE: 'Ghi diễn biến thai', RECORD_CALVING: 'Ghi sự kiện đẻ',
}
const ACTION_ICON: Record<ReproductionAction, IconName> = {
  RECORD_ESTRUS: 'flame', RECORD_BREEDING: 'dna', RECORD_PREGNANCY_CHECK: 'heartbeat', RECORD_PREGNANCY_UPDATE: 'clipboard-list', RECORD_CALVING: 'baby-carriage',
}
const CAPTION: Record<string, string> = {
  IN_ESTRUS: 'Tab Sinh sản khi bò Đang động dục. Nút ghi hiện theo trạng thái (Chủ trại, Quản lý): Ghi động dục, Ghi phối giống; "Thêm" chứa Ghi khám thai và Ghi sự kiện đẻ khi thai không được theo dõi. Điều kiện xét phối và cửa sổ phối chỉ để tham khảo.',
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
      <Button variant="onDark" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>Thêm<Icon name="chevron-down" size={16} /></Button>
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
  // Khối nổi bật của tab (docs/BeefCare-Bento-Grid.md §3): trạng thái hiện tại cạnh các nút ghi; nút chính nền trắng.
  return (
    <Panel
      tone="emphasis"
      title={<span className="flex flex-wrap items-center gap-2.5 text-base font-semibold">Trạng thái sinh sản<StatusBadge profile={profile} />{profile.indicators.overdueForConception && <Badge tone="warn">Quá hạn phối</Badge>}</span>}
      actions={(shown.length > 0 || showMore) && (
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {shown.map((action) => (
            <Button key={action} variant={action === primary ? 'onDarkPrimary' : 'onDark'} onClick={() => onAction(action)}><Icon name={ACTION_ICON[action]} size={16} />{ACTION_LABEL[action]}</Button>
          ))}
          {showMore && <MoreMenu onPick={onAction} />}
        </div>
      )}
    >
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 @min-[640px]:grid-cols-4">
        <DarkKV k="Số lần phối (chu kỳ này)">{profile.servicesInCurrentCycle}</DarkKV>
        <DarkKV k="Số lần đẻ">{profile.parity}</DarkKV>
        <DarkKV k="Lần đẻ gần nhất"><span className="whitespace-nowrap">{formatDate(profile.lastCalvingAt)}</span></DarkKV>
        <DarkKV k="Cân gần nhất"><span className="whitespace-nowrap">{profile.latestWeightKg == null ? '—' : `${profile.latestWeightKg} kg · thực tế`}</span></DarkKV>
        {profile.status === 'PREGNANT' && <>
          <DarkKV k="Khoảng cách lứa gần nhất">{dash(ind.lastCalvingIntervalDays, 'ngày')}</DarkKV>
          <DarkKV k="Phối / đậu thai">{ind.conceptionDetail ?? ind.conceptionSummary}</DarkKV>
        </>}
      </dl>
      {hasCalvings ? (
        <dl className="m-0 grid grid-cols-2 gap-3 rounded-xl bg-white/8 px-3.5 py-2.5 @min-[640px]:grid-cols-5">
          <DarkKV k="Tuổi đẻ lứa đầu" strong>{dash(ind.ageAtFirstCalvingMonths, 'tháng')}</DarkKV>
          <DarkKV k="Khoảng cách lứa gần nhất" strong>{dash(ind.lastCalvingIntervalDays, 'ngày')}</DarkKV>
          <DarkKV k="Ngày sau đẻ" strong>{dash(ind.daysSinceLastCalving, 'ngày')}</DarkKV>
          <DarkKV k="Ngày không mang thai" strong>{dash(ind.daysOpen, 'ngày')}</DarkKV>
          <DarkKV k="Thụ thai" strong>{ind.conceptionSummary}</DarkKV>
        </dl>
      ) : <p className="m-0 rounded-xl bg-white/8 px-3.5 py-2.5 text-xs text-white">Chưa có chỉ số sinh sản: bò chưa đẻ lứa nào.</p>}
    </Panel>
  )
}

/** Cặp nhãn – giá trị trên khối xanh đậm: nhãn #d9e8df (≈ 9:1 trên nền), giá trị trắng. */
function DarkKV({ k, strong, children }: { k: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-[3px] text-[11px] text-side-text">{k}</dt>
      <dd className={`m-0 text-[13px] text-white ${strong ? 'font-semibold' : 'font-medium'}`}>{children}</dd>
    </div>
  )
}

export default function ReproductionProfileTab({ cattleCode, role: roleProp }: { cattleCode: string; role?: ReproductionRole }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useSession()
  const role: ReproductionRole = roleProp ?? (session?.role === 'OWNER' || session?.role === 'MANAGER' ? session.role : 'TECHNICIAN')
  const [modal, openModal, closeModal] = useModalParam()
  const [localDialog, setLocalDialog] = useState<ReproductionDialogTarget | null>(null)
  // GBR-08, D41: the Owner and a Manager record and correct; a Technician only views.
  const canManage = canRecordCare(role)
  const {
    profile, profileLoading: loading, profileError,
    setProfile, recordEvent, correctEvent, voidEvent, correctCalving, voidCalving, voidCalf,
  } = useReproductionUseCases({ cattleCode, role, scope: 'profile' })
  const error = profileError instanceof Error ? profileError.message : profileError ? 'Không tải được hồ sơ sinh sản.' : ''
  const notice = (location.state as { reproductionNotice?: string } | null)?.reproductionNotice
  // ?m=ghi-dong-duc etc. lets the profile header open a recording dialog; only the Owner or a Manager gets it.
  const modalAction = modal ? ACTION_FOR_MODAL[modal] : undefined
  const dialog: ReproductionDialogTarget | null = localDialog ?? (canManage && modalAction ? { mode: 'record', action: modalAction } : null)
  const [params, setParams] = useSearchParams()
  const setDialog = (next: ReproductionDialogTarget | null) => {
    setLocalDialog(next && next.mode !== 'record' ? next : null)
    if (next?.mode === 'record') openModal(MODAL_FOR_ACTION[next.action])
    else if (!next && params.has('r')) {
      // Opened from the timeline (?m=correct|void&r=<id>): clear both so the dialog does not reopen.
      const rest = new URLSearchParams(params)
      rest.delete('m')
      rest.delete('r')
      setParams(rest)
    } else if (!next && modal) closeModal()
  }

  // FE-16 R-16-07: the timeline opens ?tab=repro&m=correct|void&r=<record id>; same convention as the growth and
  // vaccination tabs. Only the Owner or a Manager gets the dialog; an unknown id opens nothing.
  useEffect(() => {
    const action = params.get('m')
    const id = params.get('r')
    if (!profile || !canManage || localDialog || !id || (action !== 'correct' && action !== 'void')) return
    const event = profile.events.find((item) => String(item.id) === id)
    if (!event) return
    const calving = event.type === 'CALVING' ? profile.calvings.find((item) => item.id === event.id) : undefined
    setLocalDialog({ mode: 'revise', record: calving ? { kind: 'calving', calving } : { kind: 'event', event }, action })
  }, [profile, canManage, params])

  const run = (action: ReproductionAction) => {
    if (action === 'RECORD_CALVING') navigate(`/cattle/${encodeURIComponent(cattleCode)}/sinh-san/de`)
    else setDialog({ mode: 'record', action })
  }
  const revise = (record: TimelineRecord, action: 'correct' | 'void') => setDialog({ mode: 'revise', record, action })

  if (loading && !profile) return <Panel><p role="status" className="m-0 text-sm text-muted">Đang tải hồ sơ sinh sản…</p></Panel>
  if (!profile) return <Panel>{error && <Note tone="err">{error}</Note>}<p className="m-0 text-sm text-muted">Chưa có dữ liệu sinh sản cho {cattleCode}.</p></Panel>

  const sourceId = modal ? null : params.get('r')
  if (sourceId != null) {
    const source = resolveReproductionSource(profile.events, sourceId, params.get('type'))
    return source
      ? <ReproductionTimeline profile={profile} source={source} canManage={false} onRevise={revise} />
      : <Note tone="warn">Không tìm thấy bản ghi sinh sản này.</Note>
  }

  const status = profile.status
  const showEligibility = !!profile.eligibility && (status === 'AWAITING_BREEDING' || status === 'IN_ESTRUS' || status === 'POST_CALVING')
  const showWindow = status === 'IN_ESTRUS' && !!profile.breedingWindow
  const hasCalvings = profile.calvings.some((calving) => calving.status === 'VALID')

  const pair = showEligibility && showWindow
  // Lưới Bento theo vùng nội dung (docs/BeefCare-Bento-Grid.md §2): 1 cột, 8 cột từ 640 px, 12 cột từ 1.024 px. Các cặp khối
  // chỉ đứng cạnh nhau từ 880 px (laptop 1.280 px có sidebar) để bảng và dải giờ không bị ép.
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-8 @min-[1024px]:grid-cols-12 @min-[1024px]:gap-6 [&>*]:col-span-full [&>*]:min-w-0">
      {notice && <Note tone="ok">{notice}</Note>}
      {error && <Note tone="err">{error}</Note>}
      {!canManage && <Note tone="info">Kỹ thuật viên chỉ xem hồ sơ và dòng thời gian sinh sản.</Note>}
      {profile.herdStatus !== 'ACTIVE' && <Note tone="warn">Bò đã rời đàn hoặc đang chờ xác nhận xuất; hồ sơ sinh sản chỉ xem.</Note>}

      {!profile.applicable ? (
        <Panel title="Trạng thái sinh sản"><Note>Không theo dõi sinh sản cho bò này theo giai đoạn hoặc mục đích nuôi. Nếu đã có khám thai hoặc sự kiện đẻ thực tế, hãy ghi từ "Thêm". Dòng thời gian vẫn được giữ.</Note></Panel>
      ) : (
        <>
          <StatusCard profile={profile} canManage={canManage} onAction={run} />
          {showEligibility && <div className={pair ? '@min-[880px]:col-span-4! @min-[1024px]:col-span-6!' : undefined}><EligibilityCard profile={profile} /></div>}
          {showWindow && <div className={pair ? '@min-[880px]:col-span-4! @min-[1024px]:col-span-6!' : undefined}><WindowCard profile={profile} /></div>}
          {status === 'BRED' && <LastBreedingCard profile={profile} />}
          {status === 'PREGNANT' && <>
            <div className="@min-[880px]:col-span-5! @min-[1024px]:col-span-8!"><PregnancyCard profile={profile} /></div>
            <div className="@min-[880px]:col-span-3! @min-[1024px]:col-span-4!"><CalfHistoryCard profile={profile} /></div>
          </>}
          {status === 'POST_CALVING' && hasCalvings && <CalfHistoryCard profile={profile} />}
        </>
      )}

      <ReproductionTimeline profile={profile} canManage={canManage && profile.herdStatus === 'ACTIVE'} onRevise={revise} />

      {profile.revisions.length > 0 && (
        <Panel title="Lịch sử chỉnh sửa" sub="Giá trị cũ được giữ lại trong lịch sử.">
          <div className="flex flex-col gap-2">{profile.revisions.map((revision) => <div key={revision.id} className="rounded-lg border border-field p-3 text-xs"><b>{revision.changedBy}</b> · {revision.changedAt.slice(0, 16).replace('T', ' ')} · {revision.reason}</div>)}</div>
        </Panel>
      )}
      {status && CAPTION[status] && <Foot>{CAPTION[status]}</Foot>}
      </div>

      {dialog && (
        <ReproductionOptionsProvider cattleCode={cattleCode}>
        <ReproductionActionDialog
          target={dialog} profile={profile} onClose={() => setDialog(null)}
          onRecord={async (command) => { await recordEvent(command) }}
          onCorrectEvent={async (id, patch, reason) => { await correctEvent(id, patch, reason) }}
          onVoidEvent={async (id, reason) => { await voidEvent(id, reason) }}
          onCorrectCalving={async (id, patch, reason) => { await correctCalving(id, patch, reason) }}
          onVoidCalving={async (id, reason) => { await voidCalving(id, reason) }}
          onVoidCalf={async (calvingId, calfId, reason) => { await voidCalf(calvingId, calfId, reason) }}
        />
        </ReproductionOptionsProvider>
      )}
    </div>
  )
}
