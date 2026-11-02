import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Note, Table, Td, Th } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { reproductionApi } from '../api/reproductionApi'
import { useModalParam } from '../../../components/Modal'
import { useSession } from '../../authorization'
import { ACTION_FOR_MODAL, MODAL_FOR_ACTION, actionsForStatus, primaryActionFor, windowBar, type ReproductionAction } from '../domain/reproductionRules'
import type { ReproductionFemale, ReproductionRole } from '../types'
import ReproductionActionDialog, { type ReproductionDialogTarget } from './ReproductionActionDialog'

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'info' | 'outline' }> = {
  AWAITING_BREEDING: { label: 'Chờ phối', tone: 'outline' }, IN_ESTRUS: { label: 'Động dục', tone: 'warn' },
  BRED: { label: 'Đã phối · chờ khám thai', tone: 'info' }, PREGNANT: { label: 'Mang thai', tone: 'ok' },
  POST_CALVING: { label: 'Sau sinh', tone: 'outline' },
}
const eventLabel: Record<string, string> = { ESTRUS: 'Động dục', BREEDING: 'Phối giống', PREGNANCY_CHECK: 'Khám thai', PREGNANCY_UPDATE: 'Diễn biến thai', CALVING: 'Sự kiện đẻ' }
const actionLabel: Record<ReproductionAction, string> = {
  RECORD_ESTRUS: 'Ghi động dục', RECORD_BREEDING: 'Ghi phối giống', RECORD_PREGNANCY_CHECK: 'Ghi khám thai',
  RECORD_PREGNANCY_UPDATE: 'Ghi diễn biến thai', RECORD_CALVING: 'Ghi sự kiện đẻ',
}
const dateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const dateOnly = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('vi-VN') : '—'
const dayCount = (value: string | null) => value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)) : null

export default function ReproductionProfileTab({ cattleCode, role: roleProp }: { cattleCode: string; role?: ReproductionRole }) {
  const navigate = useNavigate()
  const session = useSession()
  const role: ReproductionRole = roleProp ?? (session?.role === 'OWNER' || session?.role === 'MANAGER' ? session.role : 'TECHNICIAN')
  const [modal, openModal, closeModal] = useModalParam()
  const [profile, setProfile] = useState<ReproductionFemale | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [localDialog, setLocalDialog] = useState<ReproductionDialogTarget | null>(null)
  const canManage = role === 'MANAGER'
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

  const run = async (action: ReproductionAction) => {
    if (action === 'RECORD_CALVING') {
      navigate(`/cattle/${encodeURIComponent(cattleCode)}/sinh-san/de`)
      return
    }
    setDialog({ mode: 'record', action })
  }
  const saveRecord = async (command: Parameters<typeof reproductionApi.recordEvent>[1]) => {
    const result = await reproductionApi.recordEvent(cattleCode, command, role)
    setProfile(result)
  }
  const correctEvent = async (eventId: string, patch: Parameters<typeof reproductionApi.correctEvent>[2], reason: string) => {
    setProfile(await reproductionApi.correctEvent(cattleCode, eventId, patch, reason, role))
  }
  const voidEvent = async (eventId: string, reason: string) => setProfile(await reproductionApi.voidEvent(cattleCode, eventId, reason, role))
  const correctCalving = async (id: string, patch: Parameters<typeof reproductionApi.correctCalving>[2], reason: string) => {
    setProfile(await reproductionApi.correctCalving(cattleCode, id, patch, reason, role))
  }
  const voidCalving = async (id: string, reason: string) => setProfile(await reproductionApi.voidCalving(cattleCode, id, reason, role))

  if (loading && !profile) return <Card><p className="m-0 text-sm text-muted">Đang tải hồ sơ sinh sản…</p></Card>
  if (!profile) return <Card>{error && <Note tone={backendMode === 'backend' ? 'warn' : 'err'}>{error}</Note>}<p className="m-0 text-sm text-muted">Chưa có dữ liệu sinh sản cho {cattleCode}.</p></Card>

  const status = profile.status ? STATUS[profile.status] : null
  const lastEvent = profile.events.find((event) => event.status === 'VALID')
  const managerActions = canManage && profile.herdStatus === 'ACTIVE' ? actionsForStatus(profile.status) : []
  const moreActions = canManage && profile.herdStatus === 'ACTIVE' && ['YOUNG_STOCK', 'ADULT'].includes(profile.lifeStage)
    ? (['RECORD_PREGNANCY_CHECK', 'RECORD_CALVING'] as ReproductionAction[]).filter((action) => !managerActions.includes(action))
    : []
  const indicatorItems = [
    ['Số lứa đẻ', profile.parity], ['Số lần phối chu kỳ hiện tại', profile.servicesInCurrentCycle],
    ['Tuổi lứa đẻ đầu', profile.indicators.ageAtFirstCalvingMonths == null ? '—' : `${profile.indicators.ageAtFirstCalvingMonths} tháng`],
    ['Khoảng cách lứa gần nhất', profile.indicators.lastCalvingIntervalDays == null ? '—' : `${profile.indicators.lastCalvingIntervalDays} ngày`],
    ['Ngày từ lần đẻ gần nhất', profile.indicators.daysSinceLastCalving == null ? '—' : `${profile.indicators.daysSinceLastCalving} ngày`],
    ['Ngày trống', profile.indicators.daysOpen == null ? '—' : `${profile.indicators.daysOpen} ngày`],
    ['Kết quả thụ thai', profile.indicators.conceptionSummary],
  ]
  const openCalving = () => navigate(`/cattle/${encodeURIComponent(cattleCode)}/sinh-san/de`)

  return (
    <div className="flex flex-col gap-4">
      {error && <Note tone={backendMode === 'backend' ? 'warn' : 'err'}>{error}</Note>}
      {backendMode === 'backend' && <Note tone="warn">Hồ sơ sinh sản chưa nối API. Dữ liệu minh họa không được dùng trong chế độ backend.</Note>}
      {!canManage && <Note tone="info">{role === 'TECHNICIAN' ? 'Kỹ thuật viên chỉ xem hồ sơ và dòng thời gian sinh sản.' : 'Chủ trại xem hồ sơ sinh sản ở chế độ chỉ đọc.'}</Note>}
      {profile.herdStatus !== 'ACTIVE' && <Note tone="warn">Bò đã rời đàn hoặc đang chờ xác nhận xuất; hồ sơ sinh sản chỉ xem.</Note>}

      <Card title="Trạng thái sinh sản" sub={`${profile.cattleCode} · ${profile.earTag || 'Chưa có số tai'} · ${profile.breed} · Chuồng ${profile.penCode}`} actions={<>{status && <Badge tone={status.tone}>{status.label}</Badge>}{profile.indicators.overdueForConception && <Badge tone="warn">Quá hạn phối</Badge>}</>}>
        {!profile.applicable ? <Note tone="grey">Không theo dõi sinh sản cho bò này theo giai đoạn hoặc mục đích nuôi. Dòng thời gian vẫn được giữ.</Note> : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <div><div className="text-[11px] text-muted">Sự kiện mới nhất</div><div className="mt-1 text-sm font-medium">{lastEvent?.summary ?? 'Chưa ghi nhận'}</div><div className="mt-1 text-[11px] text-muted">{dateTime(lastEvent?.occurredAt)}</div></div>
              <div><div className="text-[11px] text-muted">Cân gần nhất</div><div className="mt-1 text-sm font-medium">{profile.latestWeightKg == null ? '—' : `${profile.latestWeightKg} kg`}</div></div>
              <div><div className="text-[11px] text-muted">Đẻ gần nhất</div><div className="mt-1 text-sm font-medium">{dateOnly(profile.lastCalvingAt)}</div></div>
              <div><div className="text-[11px] text-muted">Thai kỳ</div><div className="mt-1 text-sm font-medium">{profile.openPregnancy ? `Lứa ${profile.openPregnancy.pregnancyNumber}` : 'Không có thai kỳ đang mở'}</div></div>
              <div><div className="text-[11px] text-muted">Ngày đẻ dự kiến</div><div className="mt-1 text-sm font-medium">{dateOnly(profile.openPregnancy?.expectedCalvingAt)}{profile.openPregnancy?.expectedDateBasis && <span className="ml-1 text-[11px] text-muted">({profile.openPregnancy.expectedDateBasis})</span>}</div></div>
              <div><div className="text-[11px] text-muted">Số ngày mang thai</div><div className="mt-1 text-sm font-medium">{profile.openPregnancy ? `${dayCount(profile.openPregnancy.confirmedAt) ?? '—'} ngày từ lần khám xác nhận` : '—'}</div></div>
            </div>
            <div className="flex min-w-[220px] flex-col gap-2">
              {managerActions.map((action) => <Button key={action} variant={action === primaryActionFor(profile.status) ? 'primary' : 'default'} onClick={() => void run(action)}>{actionLabel[action]}</Button>)}
              {moreActions.length > 0 && <details className="rounded-md border border-edge px-3 py-2 text-xs"><summary className="cursor-pointer font-semibold">Thêm thao tác</summary><div className="mt-2 flex flex-col gap-2">{moreActions.map((action) => <Button key={action} size="sm" onClick={() => action === 'RECORD_CALVING' ? openCalving() : void run(action)}>{actionLabel[action]}</Button>)}</div></details>}
            </div>
          </div>
        )}
      </Card>

      {profile.eligibility && <Card title="Điều kiện phối giống" sub="Chỉ để tham khảo, không chặn việc ghi sự kiện đã xảy ra." actions={<Badge tone={profile.eligibility.status === 'MET' ? 'ok' : 'warn'}>{profile.eligibility.status === 'MET' ? 'Đạt' : 'Chưa đạt'}</Badge>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Eligibility label="Tuổi tối thiểu" value={`${profile.eligibility.actualAgeMonths} / ${profile.eligibility.requiredAgeMonths} tháng`} met={profile.eligibility.minimumAgeMet} />
          <Eligibility label="Cân nặng tối thiểu" value={`${profile.eligibility.actualWeightKg ?? '—'} / ${profile.eligibility.requiredWeightKg} kg`} met={profile.eligibility.minimumWeightMet} />
          <Eligibility label="Ca sức khỏe đang mở" value={profile.openHealthCase ? 'Có ca mở' : 'Không có ca mở'} met={!profile.openHealthCase} />
        </div>
      </Card>}

      {profile.breedingWindow && profile.status === 'IN_ESTRUS' && <Card title="Cửa sổ phối giống" sub="Được tính từ thời điểm động dục; không phải bằng chứng đã phối."><div className="flex flex-wrap items-center gap-3"><Badge tone="warn">Động dục</Badge><span className="text-sm">{dateTime(profile.breedingWindow.from)} – {dateTime(profile.breedingWindow.to)}</span></div>
        {(() => { const bar = windowBar(profile.breedingWindow, new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)); return <div className="mt-3" aria-hidden="true"><div className="relative h-2.5 rounded-full bg-chip"><div className="absolute h-full rounded-full bg-brand" style={{ left: `${bar.left}%`, width: `${bar.width}%` }} /><div className="absolute -top-1 h-[18px] w-0.5 bg-err-fg" style={{ left: `${bar.now}%` }} /></div><div className="mt-1 flex justify-between text-[10px] text-muted">{['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'].map((tick) => <span key={tick}>{tick}</span>)}</div></div> })()}
        <p className="m-0 mt-2 text-[11px] text-muted">Vạch đỏ: bây giờ</p></Card>}

      {profile.openPregnancy && <Card title="Thai kỳ hiện tại" sub="Kết quả khám thai thực tế mở thai kỳ; thời điểm dự kiến luôn đi kèm căn cứ.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReadValue label="Mã thai kỳ" value={`Lứa ${profile.openPregnancy.pregnancyNumber}`} />
          <ReadValue label="Phối liên quan" value={profile.events.find((event) => event.id === profile.openPregnancy?.linkedBreedingId)?.summary ?? 'Không liên kết'} />
          <ReadValue label="Xác nhận có thai" value={dateTime(profile.openPregnancy.confirmedAt)} />
          <ReadValue label="Ngày đẻ dự kiến" value={`${dateOnly(profile.openPregnancy.expectedCalvingAt)} · ${profile.openPregnancy.expectedDateBasis ?? 'Chưa đủ dữ liệu'}`} />
        </div>
      </Card>}

      <Card title="Chỉ số sinh sản" sub="Các số liệu lịch sử trong dữ liệu minh họa; kết quả thiếu dữ liệu được để trống.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{indicatorItems.map(([label, value]) => <ReadValue key={String(label)} label={String(label)} value={String(value)} />)}</div>
      </Card>

      <Card title="Dòng thời gian sinh sản" sub="Sự kiện VOIDED vẫn được giữ và không tham gia tính trạng thái." actions={<span className="text-[11px] text-muted">{profile.events.length} sự kiện</span>}>
        <Table wide>
          <thead><tr><Th>Thời điểm</Th><Th>Sự kiện</Th><Th>Chi tiết</Th><Th>Nguồn · người ghi</Th><Th>Trạng thái</Th><Th /></tr></thead>
          <tbody>
            {profile.events.map((event) => <tr key={event.id} className={event.status === 'VOIDED' ? 'bg-page text-muted' : ''}>
              <Td>{dateTime(event.occurredAt)}</Td><Td><div className="font-semibold">{eventLabel[event.type]}</div><div className="text-[11px] text-muted">{event.summary}{event.corrected ? ' · Đã chỉnh sửa' : ''}</div></Td>
              <Td>{event.details || '—'}{event.voidReason && <div className="mt-1 text-[11px] text-err-fg">Lý do hủy: {event.voidReason}</div>}</Td>
              <Td>{event.dataSource ? ({ DIRECT_OBSERVATION: 'Quan sát trực tiếp', FARM_NOTEBOOK: 'Sổ trại', EXTERNAL_REPORT: 'Báo cáo ngoài' }[event.dataSource]) : '—'}<div className="mt-1 text-[11px] text-muted">{event.recorder}</div></Td>
              <Td><Badge tone={event.status === 'VALID' ? 'ok' : 'outline'}>{event.status === 'VALID' ? 'Hợp lệ' : 'Đã hủy'}</Badge></Td>
              <Td>{canManage && event.status === 'VALID' && <div className="flex gap-1"><Button size="sm" onClick={() => setDialog(event.type === 'CALVING' ? { mode: 'correct-calving', calving: profile.calvings.find((calving) => calving.id === event.id)! } : { mode: 'correct-event', event })}>Sửa</Button><Button size="sm" variant="danger" onClick={() => setDialog(event.type === 'CALVING' ? { mode: 'void-calving', calving: profile.calvings.find((calving) => calving.id === event.id)! } : { mode: 'void-event', event })}>Hủy</Button></div>}</Td>
            </tr>)}
            {!profile.events.length && <tr><Td colSpan={6} className="py-8 text-center text-muted">Chưa có sự kiện sinh sản.</Td></tr>}
          </tbody>
        </Table>
      </Card>

      <Card title="Lịch sử đẻ và kết quả bê" sub="Bê sống có thể để trạng thái chờ xác nhận hoặc được đăng ký ngay.">
        <Table wide>
          <thead><tr><Th>Ngày đẻ</Th><Th>Kết quả bê</Th><Th>Đăng ký</Th><Th>Diễn biến · bò mẹ</Th><Th /></tr></thead>
          <tbody>
            {profile.calvings.map((calving) => <tr key={calving.id} className={calving.status === 'VOIDED' ? 'bg-page text-muted' : ''}>
              <Td>{dateTime(calving.birthAt)}</Td><Td>{calving.calves.map((calf) => <div key={calf.id}>Bê {calf.number}: {calf.outcome === 'LIVE' ? `Sống · ${calf.sex === 'FEMALE' ? 'Cái' : 'Đực'}` : 'Thai chết lưu'}{calf.weightKg != null ? ` · ${calf.weightKg} kg${calf.weightBasis === 'ESTIMATED' ? ' ước tính' : ''}` : ''}</div>)}</Td>
              <Td>{calving.calves.map((calf) => <div key={calf.id}>{calf.outcome === 'STILLBORN' ? '—' : calf.registrationStatus === 'REGISTERED' ? `Đã đăng ký${calf.earTag ? ` · ${calf.earTag}` : ''}` : `Nháp · REM-09${calf.earTag ? ` · ${calf.earTag}` : ''}`}</div>)}</Td>
              <Td>{calving.course} · {calving.damCondition}{calving.retainedPlacenta ? ' · Nhau chưa ra sau 12 giờ' : ''}<div className="mt-1 text-[11px] text-muted">Ghi bởi {calving.recorder}{calving.corrected ? ' · Đã chỉnh sửa' : ''}</div>{calving.voidReason && <div className="text-[11px] text-err-fg">Lý do hủy: {calving.voidReason}</div>}</Td>
              <Td>{canManage && calving.status === 'VALID' && <div className="flex gap-1"><Button size="sm" onClick={() => setDialog({ mode: 'correct-calving', calving })}>Sửa</Button><Button size="sm" variant="danger" onClick={() => setDialog({ mode: 'void-calving', calving })}>Hủy</Button></div>}</Td>
            </tr>)}
            {!profile.calvings.length && <tr><Td colSpan={5} className="py-8 text-center text-muted">Chưa có sự kiện đẻ được ghi.</Td></tr>}
          </tbody>
        </Table>
      </Card>

      {profile.revisions.length > 0 && <Card title="Lịch sử chỉnh sửa"><div className="flex flex-col gap-2">{profile.revisions.map((revision) => <div key={revision.id} className="rounded border border-edge p-3 text-xs"><b>{revision.changedBy}</b> · {dateTime(revision.changedAt)} · {revision.reason}</div>)}</div></Card>}

      {dialog && <ReproductionActionDialog
        target={dialog} profile={profile} onClose={() => setDialog(null)} onRecord={saveRecord}
        onCorrectEvent={correctEvent} onVoidEvent={voidEvent} onCorrectCalving={correctCalving} onVoidCalving={voidCalving}
      />}
    </div>
  )
}

function Eligibility({ label, value, met }: { label: string; value: string; met: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-md border border-edge p-3"><div><div className="text-[11px] text-muted">{label}</div><div className="mt-1 text-sm font-medium">{value}</div></div><Badge tone={met ? 'ok' : 'warn'}>{met ? 'Đạt' : 'Chưa đạt'}</Badge></div>
}

function ReadValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-edge p-3"><div className="text-[11px] text-muted">{label}</div><div className="mt-1 text-sm font-medium">{value}</div></div>
}

