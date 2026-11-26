import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Icon, type IconName, Modal, ModalButton, ModalFooter, Note, Panel } from '../../../shared/ui'
import { resolveReproductionSource } from '../api/reproductionBackend'
import { ReproductionOptionsProvider } from './reproductionOptions'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { canRecordCare } from '../../authorization'
import { useSession } from '../../../app/session/sessionContext'
import {
  ACTION_FOR_MODAL, MODAL_FOR_ACTION, actionsForStatus, addDaysText, daysBetween, declaredPregnancyText, formatDate, isDueSoon, primaryActionFor,
  type ReproductionAction,
} from '../domain/reproductionRules'
import type { ReproductionFemale, ReproductionRole } from '../types'
import ReproductionActionDialog, { type ReproductionDialogTarget } from './ReproductionActionDialog'
import { CalfHistoryCard, EligibilityCard, LastBreedingCard, PregnancyCard } from './ReproductionCards'
import ReproductionTimeline, { type TimelineRecord } from './ReproductionTimeline'
import { nowLocal } from './reproductionFields'
import FoldTitle from './FoldTitle'
import { useReproductionUseCases } from '../hooks/useReproductionUseCases'

const ACTION_LABEL: Record<ReproductionAction, string> = {
  RECORD_ESTRUS: 'Ghi động dục', RECORD_BREEDING: 'Ghi phối giống', RECORD_PREGNANCY_CHECK: 'Ghi khám thai',
  RECORD_PREGNANCY_UPDATE: 'Ghi diễn biến thai', RECORD_CALVING: 'Ghi sự kiện đẻ',
}
const ACTION_ICON: Record<ReproductionAction, IconName> = {
  RECORD_ESTRUS: 'flame', RECORD_BREEDING: 'dna', RECORD_PREGNANCY_CHECK: 'heartbeat', RECORD_PREGNANCY_UPDATE: 'clipboard-list', RECORD_CALVING: 'baby-carriage',
}

function MoreMenu({ onPick, shown = [] }: { onPick: (action: ReproductionAction) => void; shown?: ReproductionAction[] }) {
  const [open, setOpen] = useState(false)
  // Không lặp thao tác đã có nút riêng (ví dụ Ghi khám thai khi bò có khai báo mang thai – D82).
  const items = ([['RECORD_PREGNANCY_CHECK', 'Ghi khám thai'], ['RECORD_CALVING', 'Ghi sự kiện đẻ (không theo dõi thai kỳ)']] as Array<[ReproductionAction, string]>)
    .filter(([action]) => !shown.includes(action))
  return (
    <div className="relative">
      <Button variant="onDark" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>Thêm<Icon name="chevron-down" size={16} /></Button>
      {open && (
        // Menu nằm trong khối xanh đậm (chữ trắng): đặt màu chữ riêng để không trắng trên nền trắng.
        <div role="menu" className="absolute left-0 top-[calc(100%+4px)] z-10 flex min-w-[260px] flex-col rounded-xl border border-edge bg-white py-1 text-ink shadow-md">
          {items.map(([action, label]) => (
            <button key={action} type="button" role="menuitem" className="cursor-pointer px-3 py-2 text-left text-xs hover:bg-page" onClick={() => { setOpen(false); onPick(action) }}>{label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_TEXT: Record<string, string> = {
  AWAITING_BREEDING: 'Chờ phối', IN_ESTRUS: 'Đang động dục', BRED: 'Đã phối – chờ khám thai', PREGNANT: 'Mang thai', POST_CALVING: 'Sau sinh',
}

/**
 * Khối nổi bật của tab (Bento §3): chỉ trả lời "bò đang ở đâu" và "việc tiếp theo"; nút ghi ở cuối khối. Các chỉ số sinh
 * sản nằm ở dải riêng bên dưới để khối này không thành bảng số (D68).
 */
function StatusCard({ profile, canManage, onAction, className }: { profile: ReproductionFemale; canManage: boolean; onAction: (action: ReproductionAction) => void; className?: string }) {
  // D82: bò khai mang thai lúc nhập, chưa khám – việc đầu tiên là khám thai, không phải phối.
  const declared = profile.declaredPregnancy
  const primary = declared ? 'RECORD_PREGNANCY_CHECK' : primaryActionFor(profile.status)
  const active = canManage && profile.herdStatus === 'ACTIVE'
  const actions = actionsForStatus(profile.status)
  const available = declared && !actions.includes('RECORD_PREGNANCY_CHECK') ? ['RECORD_PREGNANCY_CHECK' as const, ...actions] : actions
  const shown = active ? available.sort((a, b) => Number(b === primary) - Number(a === primary)) : []
  const showMore = active && ['YOUNG_STOCK', 'ADULT'].includes(profile.lifeStage)
  const now = nowLocal()
  const soon = isDueSoon(profile, now)
  const title = profile.status ? (soon ? 'Mang thai · Sắp đẻ' : STATUS_TEXT[profile.status]) : '—'
  return (
    <Panel tone="emphasis" className={`justify-between gap-4 ${className ?? ''}`}>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 flex flex-wrap items-center gap-2 text-xs font-normal text-side-text">Trạng thái sinh sản{profile.indicators.overdueForConception && <Badge tone="warn">Quá hạn phối</Badge>}</h2>
        <p className="m-0 text-[26px] font-bold leading-tight text-white">{title}</p>
        {profile.statusAt && <p className="m-0 text-xs text-side-text">Từ {formatDate(profile.statusAt)}</p>}
      </div>
      <NextStep profile={profile} now={now} />
      {(shown.length > 0 || showMore) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {shown.map((action) => (
            <Button key={action} variant={action === primary ? 'onDarkPrimary' : 'onDark'} onClick={() => onAction(action)}><Icon name={ACTION_ICON[action]} size={16} />{ACTION_LABEL[action]}</Button>
          ))}
          {showMore && <MoreMenu onPick={onAction} shown={shown} />}
        </div>
      )}
    </Panel>
  )
}

const WARN_ACTIONS: ReproductionAction[] = ['RECORD_BREEDING', 'RECORD_ESTRUS']

/** D82: popup cảnh báo điều kiện (không phải lỗi nhập liệu) – bò được khai mang thai lúc nhập nhưng chưa khám thai. */
function DeclaredPregnancyWarning({ profile, onCheck, onProceed, onClose }: { profile: ReproductionFemale; onCheck: () => void; onProceed: () => void; onClose: () => void }) {
  const d = profile.declaredPregnancy
  if (!d) return null
  const months = d.months ? ` ~${d.months} tháng` : ''
  return (
    <Modal title="Bò có khai báo mang thai" width={560} onClose={onClose}>
      <p role="alert" className="m-0 text-sm leading-relaxed text-ink">
        {profile.cattleCode} được khai báo mang thai{months} khi nhập ngày {formatDate(d.entryDate)}, chưa khám thai. Nên khám thai trước khi phối.
      </p>
      <ModalFooter>
        <ModalButton onClick={onProceed}>Vẫn ghi</ModalButton>
        <ModalButton variant="primary" onClick={onCheck}>Ghi khám thai</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/** "Việc tiếp theo" theo trạng thái: một câu và, khi có, một thanh tiến độ (sau đẻ, mang thai). */
function NextStep({ profile, now }: { profile: ReproductionFemale; now: string }) {
  const box = (label: string, text: ReactNode, progress?: number) => (
    <div className="flex flex-col gap-2 rounded-xl bg-white/8 px-4 py-3">
      <p className="m-0 text-[11px] text-side-text">{label}</p>
      <p className="m-0 text-sm font-semibold text-white">{text}</p>
      {progress !== undefined && (
        <div className="h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
          <span className="block h-full rounded-full bg-[#9fd3b2]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
    </div>
  )
  if (profile.declaredPregnancy) {
    const d = profile.declaredPregnancy
    return box('Khai báo khi nhập', `${declaredPregnancyText(d)} · nhập ${formatDate(d.entryDate)}. Ghi khám thai để xác nhận.`)
  }
  if (profile.status === 'IN_ESTRUS' && profile.breedingWindow) {
    const w = profile.breedingWindow
    const today = w.from.slice(0, 10) === now.slice(0, 10)
    const range = `${w.from.slice(11, 16)} – ${w.to.slice(11, 16)}${today ? ' hôm nay' : ` ngày ${formatDate(w.from)}`}`
    return box('Cửa sổ phối gợi ý', now > w.to ? `Đã qua ${range}; vẫn ghi phối được nếu bò còn chịu đực` : `Nên phối ${range}`)
  }
  if (profile.status === 'POST_CALVING') {
    const need = profile.eligibility?.requiredPostpartumDays ?? 45
    const days = profile.eligibility?.daysSinceCalving ?? profile.indicators.daysSinceLastCalving ?? 0
    const ready = profile.lastCalvingAt ? formatDate(addDaysText(profile.lastCalvingAt, need)) : '—'
    return box('Hồi phục sau đẻ', days >= need ? 'Đủ ngày hồi phục – có thể phối lại' : `Ngày ${days} / ${need} · có thể phối lại từ ${ready}`, (days / need) * 100)
  }
  if (profile.status === 'BRED') {
    const breeding = profile.events.filter((e) => e.type === 'BREEDING' && e.status === 'VALID').sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
    if (!breeding) return null
    const days = daysBetween(breeding.occurredAt, now)
    return box('Việc tiếp theo', days >= 30 ? `Đã phối ${days} ngày – khám thai được rồi` : `Đã phối ${days} ngày · khám thai từ ${formatDate(addDaysText(breeding.occurredAt, 30))}`)
  }
  if (profile.status === 'PREGNANT' && profile.openPregnancy?.expectedCalvingAt) {
    const left = daysBetween(now, profile.openPregnancy.expectedCalvingAt)
    const text = left >= 0 ? `Dự kiến đẻ ${formatDate(profile.openPregnancy.expectedCalvingAt)} · còn ${left} ngày` : `Quá ngày dự kiến đẻ ${-left} ngày`
    return box(isDueSoon(profile, now) ? 'Chuẩn bị chuồng đẻ' : 'Việc tiếp theo', text, ((283 - Math.max(0, left)) / 283) * 100)
  }
  if (profile.status === 'AWAITING_BREEDING') return box('Việc tiếp theo', 'Theo dõi lên giống; ghi phối khi bò chịu đực')
  return null
}

/**
 * Dải chỉ số sinh sản (nền trắng, phụ): chỉ hiện chỉ số đã có giá trị, không hiện "—" (D68). D79: gập sẵn – chỉ số dùng
 * khi phân tích, không phải thao tác hằng ngày; dòng tóm tắt vẫn có số lứa và lần đẻ gần nhất.
 */
function IndicatorStrip({ profile, className }: { profile: ReproductionFemale; className?: string }) {
  const [open, setOpen] = useState(false)
  const ind = profile.indicators
  const items: Array<[string, string | null]> = [
    ['Số lứa đẻ', profile.parity ? String(profile.parity) : null],
    ['Lần đẻ gần nhất', profile.lastCalvingAt ? formatDate(profile.lastCalvingAt) : null],
    ['Tuổi đẻ lứa đầu', ind.ageAtFirstCalvingMonths == null ? null : `${ind.ageAtFirstCalvingMonths} tháng`],
    ['Khoảng cách lứa gần nhất', ind.lastCalvingIntervalDays == null ? null : `${ind.lastCalvingIntervalDays} ngày`],
    ['Số lần phối (chu kỳ này)', profile.servicesInCurrentCycle ? String(profile.servicesInCurrentCycle) : null],
    ['Thụ thai', profile.parity || profile.servicesInCurrentCycle ? ind.conceptionDetail ?? ind.conceptionSummary : null],
  ]
  const shown = items.filter((item): item is [string, string] => item[1] != null)
  if (!shown.length) return null
  const note = shown.slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')
  return (
    <Panel className={className} title={<FoldTitle title="Chỉ số sinh sản" open={open} onToggle={() => setOpen((v) => !v)} />}>
      {open ? (
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
          {shown.map(([k, v]) => (
            <div key={k} className="min-w-0"><dt className="mb-[3px] text-[11px] text-label">{k}</dt><dd className="m-0 text-[13px] font-semibold text-ink">{v}</dd></div>
          ))}
        </dl>
      ) : <p className="m-0 text-[12px] text-muted">{note}</p>}
    </Panel>
  )
}

/** Lịch sử chỉnh sửa hồ sơ sinh sản (D79): chỉ cần khi soát lại, nên gập sẵn kèm số lần sửa. */
function RevisionHistory({ profile }: { profile: ReproductionFemale }) {
  const [open, setOpen] = useState(false)
  return (
    <Panel title={<FoldTitle title="Lịch sử chỉnh sửa" open={open} onToggle={() => setOpen((v) => !v)} />}>
      {open
        ? <div className="flex flex-col gap-2">{profile.revisions.map((revision) => <div key={revision.id} className="rounded-lg border border-field p-3 text-xs"><b>{revision.changedBy}</b> · {revision.changedAt.slice(0, 16).replace('T', ' ')} · {revision.reason}</div>)}</div>
        : <p className="m-0 text-[12px] text-muted">{profile.revisions.length} lần chỉnh sửa</p>}
    </Panel>
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
    recordEvent, correctEvent, voidEvent, correctCalving, voidCalving, voidCalf,
  } = useReproductionUseCases({ cattleCode, role, scope: 'profile' })
  const error = profileError instanceof Error ? profileError.message : profileError ? 'Không tải được hồ sơ sinh sản.' : ''
  const notice = (location.state as { reproductionNotice?: string } | null)?.reproductionNotice
  // ?m=ghi-dong-duc etc. lets the profile header open a recording dialog; only the Owner or a Manager gets it.
  const modalAction = modal ? ACTION_FOR_MODAL[modal] : undefined
  const dialog: ReproductionDialogTarget | null = localDialog ?? (canManage && modalAction ? { mode: 'record', action: modalAction } : null)
  const [params, setParams] = useSearchParams()
  // D82: đã xác nhận "Vẫn ghi" cho thao tác nào – cảnh báo khai báo mang thai chỉ hỏi một lần mỗi lần mở popup.
  const [acknowledged, setAcknowledged] = useState<ReproductionAction | null>(null)
  const setDialog = (next: ReproductionDialogTarget | null) => {
    if (!next) setAcknowledged(null)
    // Ghi theo URL (?m=…) không cần giữ cục bộ; riêng khám thai "quan sát" (D67) cần giữ cờ điền sẵn.
    setLocalDialog(next && (next.mode !== 'record' || next.observed) ? next : null)
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
  // D82 (NT-19): ghi phối / động dục cho bò khai mang thai chưa khám – cảnh báo trước, vẫn cho ghi.
  const warnDeclared = !!profile.declaredPregnancy && dialog?.mode === 'record' && WARN_ACTIONS.includes(dialog.action) && acknowledged !== dialog.action
  const showEligibility = !!profile.eligibility && (status === 'AWAITING_BREEDING' || status === 'IN_ESTRUS' || status === 'POST_CALVING')
  const hasCalvings = profile.calvings.some((calving) => calving.status === 'VALID')
  const context = showEligibility ? <EligibilityCard profile={profile} />
    : status === 'BRED' ? <LastBreedingCard profile={profile} onConfirmObserved={canManage && profile.herdStatus === 'ACTIVE' ? () => setDialog({ mode: 'record', action: 'RECORD_PREGNANCY_CHECK', observed: true }) : undefined} />
      : status === 'PREGNANT' ? <PregnancyCard profile={profile} /> : null

  // Lưới Bento (docs/BeefCare-Bento-Grid.md §2): hàng đầu 7 + 5 từ 880 px – trạng thái và khối ngữ cảnh của trạng thái đó;
  // dưới là dải chỉ số, lịch sử sinh bê và dòng thời gian, mỗi khối một hàng (D68).
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @min-[880px]:grid-cols-12 @min-[1024px]:gap-6 [&>*]:col-span-full [&>*]:min-w-0">
      {notice && <Note tone="ok">{notice}</Note>}
      {error && <Note tone="err">{error}</Note>}
      {!canManage && <Note tone="info">Chế độ chỉ xem.</Note>}
      {profile.herdStatus !== 'ACTIVE' && <Note tone="warn">Bò đã rời đàn hoặc đang chờ xác nhận xuất; hồ sơ sinh sản chỉ xem.</Note>}

      {!profile.applicable ? (
        <Panel title="Trạng thái sinh sản"><Note>Không theo dõi sinh sản cho bò này theo giai đoạn hoặc mục đích nuôi. Nếu đã có khám thai hoặc sự kiện đẻ thực tế, hãy ghi từ "Thêm". Dòng thời gian vẫn được giữ.</Note></Panel>
      ) : (
        <>
          <StatusCard profile={profile} canManage={canManage} onAction={run} className={context ? '@min-[880px]:col-span-7!' : undefined} />
          {context && <div className="flex @min-[880px]:col-span-5! [&>*]:flex-1">{context}</div>}
          {/* Hàng 2: chỉ số (5) cạnh lịch sử sinh bê (7) khi bò đã đẻ; chưa đẻ thì chỉ số chiếm cả hàng. */}
          <IndicatorStrip profile={profile} className={hasCalvings ? '@min-[880px]:col-span-5!' : undefined} />
          {hasCalvings && <div className="flex @min-[880px]:col-span-7! [&>*]:flex-1"><CalfHistoryCard profile={profile} /></div>}
        </>
      )}

      <ReproductionTimeline profile={profile} canManage={canManage && profile.herdStatus === 'ACTIVE'} onRevise={revise} />

      {profile.revisions.length > 0 && <RevisionHistory profile={profile} />}
      </div>

      {dialog && warnDeclared && (
        <DeclaredPregnancyWarning
          profile={profile}
          onCheck={() => { setAcknowledged(null); setDialog({ mode: 'record', action: 'RECORD_PREGNANCY_CHECK' }) }}
          onProceed={() => setAcknowledged(dialog.mode === 'record' ? dialog.action : null)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog && !warnDeclared && (
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
