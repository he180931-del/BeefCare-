import { Badge, Card, ErrorBlock, Foot, Info, LoadingBlock } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { reproductionApi } from '../api/reproductionApi'
import { daysBetween, formatDate, formatDateTime, formatShort } from '../domain/reproductionRules'

const STATUS: Record<string, string> = { AWAITING_BREEDING: 'Chờ phối', IN_ESTRUS: 'Đang động dục', BRED: 'Đã phối – chờ khám thai', PREGNANT: 'Mang thai', POST_CALVING: 'Sau sinh' }
const EVENT: Record<string, string> = { ESTRUS: 'Động dục', BREEDING: 'Phối giống', PREGNANCY_CHECK: 'Khám thai', PREGNANCY_UPDATE: 'Diễn biến', CALVING: 'Sự kiện đẻ' }

export default function ReproductionTechnicianTab({ cattleCode }: { cattleCode: string }) {
  const { data: profile, loading, error, refetch } = useQuery(() => reproductionApi.getProfile(cattleCode), [cattleCode])
  if (loading && !profile) return <LoadingBlock />
  if (error || !profile) return <ErrorBlock message={userFacingError(error, 'Không tải được hồ sơ sinh sản.')} onRetry={refetch} />
  if (!profile.applicable) return <Card title="Trạng thái sinh sản"><p className="m-0 text-sm text-muted">Không theo dõi sinh sản cho bò này theo giai đoạn hoặc mục đích nuôi.</p></Card>

  const preg = profile.openPregnancy
  const breeding = profile.events.find((event) => event.id === preg?.linkedBreedingId)
  const events = profile.events.filter((event) => event.status === 'VALID').slice(0, 3)
  const nowText = new Date().toISOString().slice(0, 16)
  return (
    <div className="flex flex-col gap-3">
      <Card title={preg ? `Thai kỳ lần ${preg.pregnancyNumber}` : 'Trạng thái sinh sản'} actions={<Badge tone={preg ? 'warn' : 'info'}>{profile.status ? STATUS[profile.status] : '—'}</Badge>}>
        {preg ? (
          <Info cols={2} items={[
            ['Ngày phối', breeding ? `${formatDate(breeding.occurredAt)} · ${breeding.method === 'ARTIFICIAL_INSEMINATION' ? 'TTNT' : 'Tự nhiên'}` : '—'],
            ['Dự kiến đẻ', formatDate(preg.expectedCalvingAt)],
            ['Số ngày mang thai', breeding ? `${daysBetween(breeding.occurredAt, nowText)} ngày` : '—'],
            ['Số lần đẻ', String(profile.parity)],
          ]} />
        ) : (
          <Info cols={2} items={[
            ['Số lần phối', String(profile.servicesInCurrentCycle)],
            ['Lần đẻ gần nhất', formatDate(profile.lastCalvingAt)],
            ['Cân gần nhất', profile.latestWeightKg == null ? '—' : `${profile.latestWeightKg} kg · thực tế`],
            ['Điều kiện phối', profile.eligibility ? (profile.eligibility.status === 'MET' ? 'Đạt 3/3' : 'Chưa đạt') : '—'],
          ]} />
        )}
      </Card>
      {profile.breedingWindow && profile.status === 'IN_ESTRUS' && (
        <Card title="Cửa sổ phối gợi ý">
          <Info cols={2} items={[['Động dục lúc', formatShort(profile.statusAt)], ['Khung phối', `${profile.breedingWindow.from.slice(11, 16)} – ${profile.breedingWindow.to.slice(11, 16)}`]]} />
        </Card>
      )}
      <div className="text-[10px] font-semibold uppercase text-brand">Dòng thời gian sinh sản</div>
      {events.map((event) => (
        <div key={event.id} className="rounded-lg border border-edge bg-white p-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted"><span>{formatDateTime(event.occurredAt)}</span><Badge tone="outline">{EVENT[event.type]}</Badge></div>
          <div className="mt-1 text-[13px] font-semibold">{event.details || event.summary}</div>
          {event.type === 'ESTRUS' && <div className="mt-1 text-[10px] text-muted">Ghi bởi {event.recorder}</div>}
        </div>
      ))}
      {profile.calvings.some((calving) => calving.status === 'VALID') && <>
        <div className="text-[10px] font-semibold uppercase text-brand">Lịch sử sinh bê</div>
        {profile.calvings.filter((calving) => calving.status === 'VALID').map((calving, index, list) => (
          <div key={calving.id} className="rounded-lg border border-edge bg-white p-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted"><span>{formatDateTime(calving.birthAt)}</span><Badge tone="ok">Lần {list.length - index}</Badge></div>
            <div className="mt-1 text-[13px] font-semibold">{calving.calves.map((calf) => `Bê ${calf.number}: ${calf.outcome === 'LIVE' ? 'Sống' : 'Chết lúc sinh'}${calf.sex === 'UNKNOWN' ? '' : ` · ${calf.sex === 'FEMALE' ? 'Cái' : 'Đực'}`}${calf.weightKg ? ` · ${calf.weightKg} kg` : ''}${calf.earTag ? ` · ${calf.earTag}` : ''}`).join('; ')}</div>
          </div>
        ))}
      </>}
      <Foot>Kỹ thuật viên chỉ xem; báo Quản lý để ghi nhận.</Foot>
    </div>
  )
}
