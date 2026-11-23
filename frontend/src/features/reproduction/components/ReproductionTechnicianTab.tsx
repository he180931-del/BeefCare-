import { Link, useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Badge, ErrorBlock, Foot, LoadingBlock, Note, Panel } from '../../../shared/ui'
import { reproductionError } from '../api/reproductionError'
import { resolveReproductionSource } from '../api/reproductionBackend'
import { daysBetween, eligibilityScore, formatDate, formatDateTime, formatShort, isDueSoon } from '../domain/reproductionRules'
import type { ReproductionFemale } from '../types'
import { nowLocal } from './reproductionFields'
import ReproductionTimeline, { EventBadge } from './ReproductionTimeline'
import { useReproductionUseCases } from '../hooks/useReproductionUseCases'

function StatusBadge({ profile }: { profile: ReproductionFemale }) {
  if (profile.status === 'PREGNANT') return isDueSoon(profile, nowLocal()) ? <Badge tone="warn" icon="baby-carriage">Sắp đẻ</Badge> : <Badge tone="ok" icon="heartbeat">Mang thai</Badge>
  if (profile.status === 'IN_ESTRUS') return <Badge tone="info" icon="flame">Đang động dục</Badge>
  if (profile.status === 'BRED') return <Badge tone="info" icon="clock">Đã phối – chờ khám thai</Badge>
  if (profile.status === 'POST_CALVING') return <Badge icon="baby-carriage">Sau sinh</Badge>
  return <Badge tone="outline">Chờ phối</Badge>
}

/** Cặp nhãn – giá trị 2 cột; `dark` cho khối nổi bật xanh đậm (nhãn #d9e8df, giá trị trắng). */
function Pairs({ items, dark }: { items: Array<[string, ReactNode]>; dark?: boolean }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className={`mb-[3px] text-[11px] ${dark ? 'text-side-text' : 'text-label'}`}>{label}</dt>
          <dd className={`m-0 text-[13px] font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const eventCard = 'rounded-2xl border border-field bg-white p-4'

// Technician phone tab: read-only status, suggested window and the latest reproduction records (frames 2617:12112, 2617:12205);
// Bento (Figma Tab 18 ⑤b): trạng thái là khối xanh đậm, cửa sổ phối nền xanh nhạt, sự kiện là thẻ trắng bo 16 px.
export default function ReproductionTechnicianTab({ cattleCode }: { cattleCode: string }) {
  const [params] = useSearchParams()
  const { profile, profileLoading: loading, profileError: error, refetchProfile: refetch } = useReproductionUseCases({ cattleCode, scope: 'profile' })
  if (loading && !profile) return <LoadingBlock />
  if (error || !profile) return <ErrorBlock message={reproductionError(error, 'Không tải được hồ sơ sinh sản.')} onRetry={refetch} />
  const sourceId = params.get('r')
  if (sourceId != null) {
    const source = resolveReproductionSource(profile.events, sourceId, params.get('type'))
    return source?.status === 'VALID'
      ? <ReproductionTimeline profile={profile} source={source} canManage={false} onRevise={() => undefined} />
      : <Note tone="warn">Không tìm thấy bản ghi sinh sản này.</Note>
  }
  if (!profile.applicable) return <Panel title="Trạng thái sinh sản"><p className="m-0 text-sm text-muted">Không theo dõi sinh sản cho bò này theo giai đoạn hoặc mục đích nuôi.</p></Panel>

  const preg = profile.openPregnancy
  const breeding = profile.events.find((event) => event.id === preg?.linkedBreedingId)
  const events = profile.events.filter((event) => event.status === 'VALID' && event.type !== 'CALVING').slice(0, 2)
  const calvings = profile.calvings.filter((calving) => calving.status === 'VALID')
  return (
    <div className="flex flex-col gap-3">
      <Panel tone="emphasis" title={<span className="text-base font-semibold">{preg ? `Thai kỳ lần ${preg.pregnancyNumber}` : 'Trạng thái sinh sản'}</span>} actions={<StatusBadge profile={profile} />}>
        {preg ? (
          <Pairs dark items={[
            ['Ngày phối', breeding ? `${formatDate(breeding.occurredAt)} · ${breeding.method === 'ARTIFICIAL_INSEMINATION' ? 'TTNT' : 'Tự nhiên'}` : '—'],
            ['Dự kiến đẻ', formatDate(preg.expectedCalvingAt)],
            ['Số ngày mang thai', breeding ? `${daysBetween(breeding.occurredAt, nowLocal())} ngày` : '—'],
            ['Số lần đẻ', String(profile.parity)],
          ]} />
        ) : (
          <Pairs dark items={[
            ['Số lần phối', String(profile.servicesInCurrentCycle)],
            ['Lần đẻ gần nhất', formatDate(profile.lastCalvingAt)],
            ['Cân gần nhất', profile.latestWeightKg == null ? '—' : `${profile.latestWeightKg} kg · thực tế`],
            ['Điều kiện phối', profile.eligibility ? eligibilityScore(profile.eligibility).label : '—'],
          ]} />
        )}
      </Panel>
      {profile.breedingWindow && profile.status === 'IN_ESTRUS' && (
        <Panel tone="ok" title={<span className="text-base font-semibold">Cửa sổ phối gợi ý</span>}>
          <Pairs items={[['Động dục lúc', formatShort(profile.statusAt)], ['Khung phối', `${profile.breedingWindow.from.slice(11, 16)} – ${profile.breedingWindow.to.slice(11, 16)}`]]} />
        </Panel>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-brand">DÒNG THỜI GIAN SINH SẢN</span>
        <Link className="-my-3 py-3 text-[11px] font-semibold text-brand no-underline" to={`/kt/dan-bo/${encodeURIComponent(cattleCode)}?tab=timeline`}>Xem tất cả</Link>
      </div>
      {events.map((event) => (
        <div key={event.id} className={eventCard}>
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted"><span className="whitespace-nowrap">{formatDateTime(event.occurredAt)}</span><EventBadge type={event.type} /></div>
          <div className="mt-1 text-[13px] font-semibold">{event.details || event.summary}</div>
          {event.type === 'ESTRUS' && <div className="mt-1 text-[10px] text-muted">Ghi bởi {event.recorder}</div>}
        </div>
      ))}
      {calvings.length > 0 && <>
        <span className="text-[10px] font-semibold text-brand">LỊCH SỬ SINH BÊ</span>
        {calvings.map((calving, index) => (
          <div key={calving.id} className={eventCard}>
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted"><span className="whitespace-nowrap">{formatDateTime(calving.birthAt)}</span><Badge tone="ok">Lần {calvings.length - index + (profile.parity - calvings.length)}</Badge></div>
            <div className="mt-1 text-[13px] font-semibold">{calving.calves.filter((calf) => calf.status !== 'VOIDED').map((calf) => `Bê ${calf.number}: ${calf.outcome === 'LIVE' ? 'Sống' : 'Chết lúc sinh'}${calf.sex === 'UNKNOWN' ? '' : ` · ${calf.sex === 'FEMALE' ? 'Cái' : 'Đực'}`}${calf.weightKg ? ` · ${calf.weightKg} kg` : ''}${calf.earTag ? ` · ${calf.earTag}` : ''}`).join('; ')}</div>
          </div>
        ))}
      </>}
      <Foot>Kỹ thuật viên chỉ xem; báo Quản lý để ghi nhận.</Foot>
    </div>
  )
}
