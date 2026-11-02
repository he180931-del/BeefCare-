import { Link } from 'react-router-dom'
import { Badge, Card, KV, Table, Td, Th } from '../../../components/ui'
import {
  METHOD_TEXT, addDaysText, daysBetween, expectedCalvingDate, formatDate, formatDateTime, isDueSoon, windowBar,
} from '../domain/reproductionRules'
import type { CalvingRecord, ReproductionEvent, ReproductionFemale } from '../types'
import { nowLocal } from './reproductionFields'

const grid4 = 'grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4'
const hhmm = (value: string) => value.slice(11, 16)

export function EligibilityCard({ profile }: { profile: ReproductionFemale }) {
  const e = profile.eligibility
  if (!e) return null
  const met = e.status === 'MET'
  const met3 = [e.minimumAgeMet, e.minimumWeightMet, e.noOpenHealthCase].filter(Boolean).length
  const rows: Array<[string, string, boolean]> = [
    [`Tuổi ≥ ${e.requiredAgeMonths} tháng`, `${e.actualAgeMonths} tháng`, e.minimumAgeMet],
    [`Cân ≥ ${e.requiredWeightKg} kg`, e.actualWeightKg == null ? 'Chưa có cân' : `${e.actualWeightKg} kg`, e.minimumWeightMet],
    ['Không có ca bệnh mở', e.noOpenHealthCase ? 'Không có' : 'Có ca mở', e.noOpenHealthCase],
  ]
  return (
    <Card title="Điều kiện xét phối" sub="Tham khảo, không chặn ghi phối" actions={<Badge tone={met ? 'ok' : 'err'}>{met ? 'Đạt 3/3' : `Chưa đạt ${met3}/3`}</Badge>}>
      <Table stack={false}>
        <thead><tr><Th>Tiêu chí</Th><Th>Giá trị</Th><Th>Kết quả</Th></tr></thead>
        <tbody>
          {rows.map(([criterion, value, ok]) => (
            <tr key={criterion}>
              <Td className="font-medium">{criterion}</Td>
              <Td className="whitespace-nowrap">{value}</Td>
              <Td><Badge tone={ok ? 'ok' : 'err'} icon={ok ? 'circle-check' : undefined}>{ok ? 'Đạt' : 'Chưa đạt'}</Badge></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

export function WindowCard({ profile }: { profile: ReproductionFemale }) {
  const window = profile.breedingWindow
  if (!window) return null
  const now = nowLocal()
  const bar = windowBar(window, now)
  const today = window.from.slice(0, 10) === now.slice(0, 10)
  const range = `${hhmm(window.from)} – ${hhmm(window.to)}`
  return (
    <Card title="Cửa sổ phối gợi ý" sub="Tính từ thời điểm động dục + tham số của trại">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <KV k="Thời điểm động dục"><span className="whitespace-nowrap">{formatDateTime(profile.statusAt)}</span></KV>
        <KV k="Khung phối gợi ý"><span className="whitespace-nowrap">{today ? `${range} hôm nay` : `${formatDateTime(window.from).slice(0, 5)} ${range}`}</span></KV>
      </div>
      <div className="mt-4" aria-hidden="true">
        <div className="relative h-2.5 rounded-full bg-chip">
          <div className="absolute h-full rounded-full bg-brand" style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />
          <div className="absolute -top-1 h-[18px] w-0.5 bg-err-fg" style={{ left: `${bar.now}%` }} />
        </div>
        <div className="relative mt-1.5 h-3 text-[10px] text-muted">
          {[4, 8, 12, 16, 20, 24].map((hour) => <span key={hour} className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0" style={{ left: `${(hour / 24) * 100}%`, ...(hour === 24 ? { transform: 'translateX(-100%)' } : {}) }}>{String(hour).padStart(2, '0')}:00</span>)}
        </div>
      </div>
      <p className="m-0 mt-2 text-[11px] text-muted">Vạch đỏ: bây giờ ({hhmm(now)})</p>
    </Card>
  )
}

const latestValid = (profile: ReproductionFemale, type: ReproductionEvent['type']) =>
  profile.events.filter((event) => event.type === type && event.status === 'VALID').sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]

export function LastBreedingCard({ profile }: { profile: ReproductionFemale }) {
  const breeding = latestValid(profile, 'BREEDING')
  if (!breeding) return null
  const days = daysBetween(breeding.occurredAt, nowLocal())
  const due = days >= 30
  const checks = profile.events.filter((event) => event.type === 'PREGNANCY_CHECK' && event.status === 'VALID' && event.linkedBreedingId === breeding.id).length
  const sire = [breeding.sireLabel, breeding.semenCode].filter(Boolean).join(' · ') || '—'
  return (
    <Card
      title="Lần phối gần nhất"
      sub={due ? 'Đủ 30 ngày sau phối · có thể khám thai' : `Còn ${30 - days} ngày đến lúc có thể khám thai`}
      actions={<Badge tone={due ? 'warn' : 'outline'}>{due ? 'Đến hạn khám thai' : 'Chưa đến hạn khám'}</Badge>}
    >
      <div className={grid4}>
        <KV k="Thời điểm phối"><span className="whitespace-nowrap">{formatDateTime(breeding.occurredAt)}</span></KV>
        <KV k="Phương pháp">{breeding.method ? METHOD_TEXT[breeding.method as keyof typeof METHOD_TEXT] : '—'}</KV>
        <KV k="Giống tinh · mã lô">{sire}</KV>
        <KV k="Người thực hiện">{breeding.performer || '—'}</KV>
        <KV k="Ngày dự kiến đẻ (tạm tính)"><span className="whitespace-nowrap">{formatDate(expectedCalvingDate(breeding.occurredAt))}</span></KV>
        <KV k="Số ngày sau phối">{days} ngày</KV>
        <KV k="Số lần khám">{checks}</KV>
        <KV k="Có thể khám từ"><span className="whitespace-nowrap">{formatDate(addDaysText(breeding.occurredAt, 30))}</span></KV>
      </div>
    </Card>
  )
}

const BASIS_TEXT = { CONFIRMED: 'đã xác nhận', TENTATIVE: 'tạm tính', ESTIMATED: 'ước tính' } as const
const BASIS_RULE = { CONFIRMED: 'Ngày phối + 283 ngày', TENTATIVE: 'Ngày phối + 283 ngày', ESTIMATED: 'Ngày khám + 283 ngày − số tháng × 30' } as const

export function PregnancyCard({ profile }: { profile: ReproductionFemale }) {
  const preg = profile.openPregnancy
  if (!preg) return null
  const now = nowLocal()
  const breeding = profile.events.find((event) => event.id === preg.linkedBreedingId)
  const basis = preg.expectedDateBasis
  const left = preg.expectedCalvingAt ? daysBetween(now, preg.expectedCalvingAt) : null
  const carried = breeding ? daysBetween(breeding.occurredAt, now) : preg.estimatedMonths != null ? preg.estimatedMonths * 30 + daysBetween(preg.confirmedAt, now) : null
  const soon = isDueSoon(profile, now)
  return (
    <Card
      title="Thai kỳ hiện tại"
      sub={left == null ? 'Chưa tính được ngày dự kiến đẻ' : left >= 0 ? `Còn ${left} ngày đến ngày dự kiến đẻ` : `Quá ngày dự kiến đẻ ${-left} ngày`}
      actions={soon ? <Badge tone="warn" icon="baby-carriage">Sắp đẻ</Badge> : undefined}
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
        <KV k="Thai kỳ">Lần {preg.pregnancyNumber}</KV>
        <KV k="Lần phối liên kết">{breeding ? `${formatDate(breeding.occurredAt)} · ${breeding.method === 'ARTIFICIAL_INSEMINATION' ? 'TTNT' : 'Tự nhiên'}${breeding.semenCode ? ` · ${breeding.semenCode}` : ''}` : 'Không liên kết'}</KV>
        <KV k="Ngày khám xác nhận"><span className="whitespace-nowrap">{formatDate(preg.confirmedAt)}</span></KV>
        <KV k="Ngày dự kiến đẻ">
          {preg.expectedCalvingAt && basis ? <Badge tone={basis === 'CONFIRMED' ? 'ok' : 'info'}>{`${formatDate(preg.expectedCalvingAt)} · ${BASIS_TEXT[basis]}`}</Badge> : <span className="text-muted">Chưa tính được</span>}
        </KV>
        <KV k="Cơ sở tính">{basis ? BASIS_RULE[basis] : 'Chưa đủ dữ liệu'}</KV>
        <KV k="Số ngày mang thai">{carried == null ? '—' : `${carried} ngày`}</KV>
      </div>
    </Card>
  )
}

const calfLine = (calving: CalvingRecord) => calving.calves.filter((calf) => calf.status !== 'VOIDED').map((calf) => (
  { key: calf.id, text: `Bê ${calf.number}: ${calf.outcome === 'LIVE' ? 'Sống' : 'Chết lúc sinh'}${calf.sex === 'UNKNOWN' ? '' : ` · ${calf.sex === 'FEMALE' ? 'Cái' : 'Đực'}`}${calf.weightKg != null ? ` · ${calf.weightKg} kg` : ''}`, calf }
))

export function CalfHistoryCard({ profile }: { profile: ReproductionFemale }) {
  const calvings = profile.calvings.filter((calving) => calving.status === 'VALID')
  return (
    <Card title="Lịch sử sinh bê">
      <Table stack={false}>
        <thead><tr><Th>Ngày đẻ</Th><Th>Kết quả bê</Th><Th>Đăng ký</Th></tr></thead>
        <tbody>
          {calvings.map((calving) => (
            <tr key={calving.id}>
              <Td className="whitespace-nowrap font-medium">{formatDate(calving.birthAt)}</Td>
              <Td>{calfLine(calving).map((line) => <div key={line.key}>{line.text}</div>)}</Td>
              <Td className="whitespace-nowrap">
                {calfLine(calving).map(({ calf, key }) => (
                  <div key={key}>
                    {calf.outcome === 'STILLBORN' ? '—' : calf.registrationStatus === 'REGISTERED' && calf.earTag
                      ? <Link className="font-medium text-brand" to={`/cattle/${encodeURIComponent(calf.earTag)}`}>{calf.earTag}</Link>
                      : 'Bê nháp'}
                  </div>
                ))}
              </Td>
            </tr>
          ))}
          {!calvings.length && <tr><Td colSpan={3} className="py-6 text-center text-muted">Chưa có lần đẻ nào.</Td></tr>}
        </tbody>
      </Table>
    </Card>
  )
}
