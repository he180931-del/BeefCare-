import { Link } from 'react-router-dom'
import { Badge, Card, ErrorBlock, Foot, Info, LoadingBlock } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { reproductionApi } from '../api/reproductionApi'
import { daysBetween, eligibilityScore, formatDate, formatDateTime, formatShort, isDueSoon } from '../domain/reproductionRules'
import type { ReproductionFemale } from '../types'
import { nowLocal } from './reproductionFields'
import { EventBadge } from './ReproductionTimeline'

function StatusBadge({ profile }: { profile: ReproductionFemale }) {
  if (profile.status === 'PREGNANT') return isDueSoon(profile, nowLocal()) ? <Badge tone="warn" icon="baby-carriage">Sắp đẻ</Badge> : <Badge tone="ok" icon="heartbeat">Mang thai</Badge>
  if (profile.status === 'IN_ESTRUS') return <Badge tone="info" icon="flame">Đang động dục</Badge>
  if (profile.status === 'BRED') return <Badge tone="info" icon="clock">Đã phối – chờ khám thai</Badge>
  if (profile.status === 'POST_CALVING') return <Badge icon="baby-carriage">Sau sinh</Badge>
  return <Badge tone="outline">Chờ phối</Badge>
}

// Technician phone tab: read-only status, suggested window and the latest reproduction records (frames 2617:12112, 2617:12205).
export default function ReproductionTechnicianTab({ cattleCode }: { cattleCode: string }) {
  const { data: profile, loading, error, refetch } = useQuery(() => reproductionApi.getProfile(cattleCode), [cattleCode])
  if (loading && !profile) return <LoadingBlock />
  if (error || !profile) return <ErrorBlock message={userFacingError(error, 'Không tải được hồ sơ sinh sản.')} onRetry={refetch} />
  if (!profile.applicable) return <Card title="Trạng thái sinh sản"><p className="m-0 text-sm text-muted">Không theo dõi sinh sản cho bò này theo giai đoạn hoặc mục đích nuôi.</p></Card>

  const preg = profile.openPregnancy
  const breeding = profile.events.find((event) => event.id === preg?.linkedBreedingId)
  const events = profile.events.filter((event) => event.status === 'VALID' && event.type !== 'CALVING').slice(0, 2)
  const calvings = profile.calvings.filter((calving) => calving.status === 'VALID')
  return (
    <div className="flex flex-col gap-3">
      <Card title={preg ? `Thai kỳ lần ${preg.pregnancyNumber}` : 'Trạng thái sinh sản'} actions={<StatusBadge profile={profile} />}>
        {preg ? (
          <Info cols={2} items={[
            ['Ngày phối', breeding ? `${formatDate(breeding.occurredAt)} · ${breeding.method === 'ARTIFICIAL_INSEMINATION' ? 'TTNT' : 'Tự nhiên'}` : '—'],
            ['Dự kiến đẻ', formatDate(preg.expectedCalvingAt)],
            ['Số ngày mang thai', breeding ? `${daysBetween(breeding.occurredAt, nowLocal())} ngày` : '—'],
            ['Số lần đẻ', String(profile.parity)],
          ]} />
        ) : (
          <Info cols={2} items={[
            ['Số lần phối', String(profile.servicesInCurrentCycle)],
            ['Lần đẻ gần nhất', formatDate(profile.lastCalvingAt)],
            ['Cân gần nhất', profile.latestWeightKg == null ? '—' : `${profile.latestWeightKg} kg · thực tế`],
            ['Điều kiện phối', profile.eligibility ? eligibilityScore(profile.eligibility).label : '—'],
          ]} />
        )}
      </Card>
      {profile.breedingWindow && profile.status === 'IN_ESTRUS' && (
        <Card title="Cửa sổ phối gợi ý">
          <Info cols={2} items={[['Động dục lúc', formatShort(profile.statusAt)], ['Khung phối', `${profile.breedingWindow.from.slice(11, 16)} – ${profile.breedingWindow.to.slice(11, 16)}`]]} />
        </Card>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-brand">DÒNG THỜI GIAN SINH SẢN</span>
        <Link className="text-[11px] font-semibold text-brand no-underline" to={`/kt/dan-bo/${encodeURIComponent(cattleCode)}?tab=timeline`}>Xem tất cả</Link>
      </div>
      {events.map((event) => (
        <div key={event.id} className="rounded-lg border border-edge bg-white p-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted"><span className="whitespace-nowrap">{formatDateTime(event.occurredAt)}</span><EventBadge type={event.type} /></div>
          <div className="mt-1 text-[13px] font-semibold">{event.details || event.summary}</div>
          {event.type === 'ESTRUS' && <div className="mt-1 text-[10px] text-muted">Ghi bởi {event.recorder}</div>}
        </div>
      ))}
      {calvings.length > 0 && <>
        <span className="text-[10px] font-semibold text-brand">LỊCH SỬ SINH BÊ</span>
        {calvings.map((calving, index) => (
          <div key={calving.id} className="rounded-lg border border-edge bg-white p-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted"><span className="whitespace-nowrap">{formatDateTime(calving.birthAt)}</span><Badge tone="ok">Lần {calvings.length - index + (profile.parity - calvings.length)}</Badge></div>
            <div className="mt-1 text-[13px] font-semibold">{calving.calves.filter((calf) => calf.status !== 'VOIDED').map((calf) => `Bê ${calf.number}: ${calf.outcome === 'LIVE' ? 'Sống' : 'Chết lúc sinh'}${calf.sex === 'UNKNOWN' ? '' : ` · ${calf.sex === 'FEMALE' ? 'Cái' : 'Đực'}`}${calf.weightKg ? ` · ${calf.weightKg} kg` : ''}${calf.earTag ? ` · ${calf.earTag}` : ''}`).join('; ')}</div>
          </div>
        ))}
      </>}
      <Foot>Kỹ thuật viên chỉ xem; báo Quản lý để ghi nhận.</Foot>
    </div>
  )
}
