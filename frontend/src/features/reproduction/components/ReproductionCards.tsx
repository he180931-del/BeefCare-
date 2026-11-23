import { Link } from 'react-router-dom'
import { Badge, Button, Icon, KV, Panel, Table, Td, Th } from '../../../shared/ui'
import {
  METHOD_TEXT, NO_WEIGHING, addDaysText, daysBetween, eligibilityScore, expectedCalvingDate, formatDate, formatDateTime, hasNoWeighing, isDueSoon,
} from '../domain/reproductionRules'
import type { CalvingRecord, ReproductionEvent, ReproductionFemale } from '../types'
import { nowLocal } from './reproductionFields'

const grid4 = 'grid grid-cols-2 gap-x-4 gap-y-3'
const hhmm = (value: string) => value.slice(11, 16)

/**
 * Điều kiện xét phối dạng danh sách gọn (D68). Màu khối theo mức độ: xanh nhạt khi đạt hết; vàng nhạt khi chỉ còn điều
 * kiện "chờ được" (chưa cân lại, chưa đủ ngày sau đẻ); đỏ nhạt khi chưa đạt tuổi, cân hoặc đang có ca bệnh mở.
 */
export function EligibilityCard({ profile }: { profile: ReproductionFemale }) {
  const e = profile.eligibility
  if (!e) return null
  const score = eligibilityScore(e)
  const noWeighing = hasNoWeighing(e)
  const onlyWeighing = noWeighing && score.failed.length === 1
  const hardFail = !e.minimumAgeMet || !e.noOpenHealthCase || (!e.minimumWeightMet && !noWeighing)
  const tone = score.failed.length === 0 ? 'ok' : hardFail ? 'err' : 'warn'
  // [tiêu chí, giá trị, đạt, "chờ được" – chưa cân lại hoặc chưa đủ ngày sau đẻ: tô vàng thay vì đỏ]
  const rows: Array<[string, string, boolean, boolean?]> = [
    [`Tuổi ≥ ${e.requiredAgeMonths} tháng`, `${e.actualAgeMonths} tháng`, e.minimumAgeMet],
    // Chốt 15/11/2026: chưa có bản ghi cân VALID → "Chưa có lần cân" (cân lúc nhập đàn không tính).
    [`Cân ≥ ${e.requiredWeightKg} kg`, noWeighing ? NO_WEIGHING : `${e.actualWeightKg} kg`, e.minimumWeightMet, noWeighing],
    ['Không có ca bệnh mở', e.noOpenHealthCase ? 'Không có' : 'Có ca mở', e.noOpenHealthCase],
    // D67: bò đã từng đẻ – đủ số ngày hồi phục tử cung trước khi phối lại.
    ...(e.postpartumMet === undefined ? [] : [[`Sau đẻ ≥ ${e.requiredPostpartumDays} ngày`, `${e.daysSinceCalving} ngày`, e.postpartumMet, true] as [string, string, boolean, boolean]]),
  ]
  return (
    <Panel tone={tone} title={<span className="text-sm font-semibold">Điều kiện xét phối</span>} sub="Tham khảo, không chặn ghi phối"
      actions={<Badge tone={tone} icon={tone === 'ok' ? 'circle-check' : undefined}>{onlyWeighing ? 'Cần cân lại' : score.label}</Badge>}>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map(([criterion, value, ok, soft]) => (
          <li key={criterion} className="flex items-center gap-2 border-t border-black/5 py-2 text-[13px] first:border-t-0 first:pt-0 last:pb-0">
            <Icon name={ok ? 'circle-check' : 'alert-triangle'} size={16} className={ok ? 'text-ok-fg' : soft ? 'text-warn-fg' : 'text-err-fg'} />
            <span className="flex-1 text-ink">{criterion}</span>
            <span className={ok ? 'text-label' : 'font-semibold text-ink'}>{value}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function WindowCard({ profile }: { profile: ReproductionFemale }) {
  const window = profile.breedingWindow
  if (!window) return null
  const now = nowLocal()
  const today = window.from.slice(0, 10) === now.slice(0, 10)
  const passed = now > window.to
  const range = `${hhmm(window.from)} – ${hhmm(window.to)}`
  return (
    <Panel tone="ok" title="Cửa sổ phối gợi ý">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <KV k="Thời điểm động dục"><span className="whitespace-nowrap">{formatDateTime(profile.statusAt)}</span></KV>
        <KV k="Khung phối gợi ý"><span className="whitespace-nowrap">{today ? `${range} hôm nay` : `${formatDateTime(window.from).slice(0, 5)} ${range}`}</span></KV>
      </div>
      {/* D67: thời điểm bò chịu đực thay đổi theo từng con, nên chỉ gợi ý bằng chữ, không vẽ thanh giờ. */}
      <p className="m-0 mt-3 text-xs text-label">{passed ? 'Đã qua khung gợi ý; vẫn ghi phối được nếu bò còn chịu đực.' : 'Gợi ý theo tham số trại; thời điểm chịu đực thay đổi theo từng con.'}</p>
    </Panel>
  )
}

const latestValid = (profile: ReproductionFemale, type: ReproductionEvent['type']) =>
  profile.events.filter((event) => event.type === type && event.status === 'VALID').sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]

/** D67: số ngày sau phối không thấy lên giống lại thì chủ trại có thể xác nhận có thai bằng quan sát. */
export const OBSERVED_PREGNANCY_DAYS = 21

export function LastBreedingCard({ profile, onConfirmObserved }: { profile: ReproductionFemale; onConfirmObserved?: () => void }) {
  const breeding = latestValid(profile, 'BREEDING')
  if (!breeding) return null
  const days = daysBetween(breeding.occurredAt, nowLocal())
  const due = days >= 30
  const sire = [breeding.sireLabel, breeding.semenCode].filter(Boolean).join(' · ') || '—'
  return (
    <Panel
      tone={due ? 'warn' : 'default'}
      title="Lần phối gần nhất"
      sub={due ? 'Đủ 30 ngày sau phối · có thể khám thai' : `Còn ${30 - days} ngày đến lúc có thể khám thai`}
      actions={<Badge tone={due ? 'warn' : 'outline'}>{due ? 'Đến hạn khám thai' : 'Chưa đến hạn khám'}</Badge>}
    >
      <div className={grid4}>
        <KV k="Thời điểm phối"><span className="whitespace-nowrap">{formatDateTime(breeding.occurredAt)}</span></KV>
        <KV k="Phương pháp">{breeding.method ? METHOD_TEXT[breeding.method as keyof typeof METHOD_TEXT] : '—'}</KV>
        <KV k="Giống tinh · mã lô">{sire}</KV>
        <KV k="Ngày dự kiến đẻ (tạm tính)"><span className="whitespace-nowrap">{breeding.expectedCalvingAt === null ? 'Chưa cấu hình thời gian mang thai' : formatDate(breeding.expectedCalvingAt ?? expectedCalvingDate(breeding.occurredAt))}</span></KV>
        <KV k="Số ngày sau phối">{days} ngày</KV>
        <KV k="Có thể khám từ"><span className="whitespace-nowrap">{formatDate(addDaysText(breeding.occurredAt, 30))}</span></KV>
      </div>
      {onConfirmObserved && days >= OBSERVED_PREGNANCY_DAYS && (
        <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-3">
          <Button type="button" size="sm" variant="primary" onClick={onConfirmObserved}><Icon name="circle-check" size={14} />Xác nhận có thai (quan sát)</Button>
          <span className="text-xs text-label">Không thấy lên giống lại {days} ngày sau phối – ghi như một lần khám thai bằng quan sát.</span>
        </div>
      )}
    </Panel>
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
    <Panel
      tone={soon ? 'warn' : 'default'}
      title="Thai kỳ hiện tại"
      sub={left == null ? 'Chưa tính được ngày dự kiến đẻ' : left >= 0 ? `Còn ${left} ngày đến ngày dự kiến đẻ` : `Quá ngày dự kiến đẻ ${-left} ngày`}
      actions={soon ? <Badge tone="warn" icon="baby-carriage">Sắp đẻ</Badge> : undefined}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <KV k="Thai kỳ">Lần {preg.pregnancyNumber}</KV>
        <KV k="Lần phối liên kết">{breeding ? `${formatDate(breeding.occurredAt)} · ${breeding.method === 'ARTIFICIAL_INSEMINATION' ? 'TTNT' : 'Tự nhiên'}${breeding.semenCode ? ` · ${breeding.semenCode}` : ''}` : 'Không liên kết'}</KV>
        <KV k="Ngày khám xác nhận"><span className="whitespace-nowrap">{formatDate(preg.confirmedAt)}</span></KV>
        <KV k="Ngày dự kiến đẻ">
          {preg.expectedCalvingAt && basis ? <Badge tone={basis === 'CONFIRMED' ? 'ok' : 'info'}>{`${formatDate(preg.expectedCalvingAt)} · ${BASIS_TEXT[basis]}`}</Badge> : <span className="text-muted">Chưa tính được</span>}
        </KV>
        <KV k="Cơ sở tính">{basis ? BASIS_RULE[basis] : 'Chưa đủ dữ liệu'}</KV>
        <KV k="Số ngày mang thai">{carried == null ? '—' : `${carried} ngày`}</KV>
      </div>
    </Panel>
  )
}

const calfLine = (calving: CalvingRecord) => calving.calves.filter((calf) => calf.status !== 'VOIDED').map((calf) => (
  { key: calf.id, text: `Bê ${calf.number}: ${calf.outcome === 'LIVE' ? 'Sống' : 'Chết lúc sinh'}${calf.sex === 'UNKNOWN' ? '' : ` · ${calf.sex === 'FEMALE' ? 'Cái' : 'Đực'}`}${calf.weightKg != null ? ` · ${calf.weightKg} kg` : ''}`, calf }
))

export function CalfHistoryCard({ profile }: { profile: ReproductionFemale }) {
  const calvings = profile.calvings.filter((calving) => calving.status === 'VALID')
  return (
    <Panel title="Lịch sử sinh bê">
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
                    {calf.outcome === 'STILLBORN' ? '—' : calf.registrationStatus === 'REGISTERED' && (calf.cattleCode || calf.earTag)
                      ? <Link className="font-medium text-brand" to={`/cattle/${encodeURIComponent(calf.cattleCode || calf.earTag || '')}`}>{calf.cattleCode || calf.earTag}</Link>
                      : 'Bê nháp'}
                  </div>
                ))}
              </Td>
            </tr>
          ))}
          {!calvings.length && <tr><Td colSpan={3} className="py-6 text-center text-muted">Chưa có lần đẻ nào.</Td></tr>}
        </tbody>
      </Table>
    </Panel>
  )
}
