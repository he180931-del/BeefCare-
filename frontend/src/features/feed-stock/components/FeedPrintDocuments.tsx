import { useSession } from '../../../app/session/sessionContext'
import type { ReactNode } from 'react'
import { businessDate, toFarmLocal } from '../../../shared/lib/date/farmTime'
import { Badge } from '../../../shared/ui'
import { effectiveRationForPen } from '../domain/feedTodayRations'
import { comparePlannedActual, feedingRecordPrintState, feedingRecordStatusLabel, rationPrintState, revisionActionLabel } from '../domain/feedPrint'
import { planForSession, SESSION_NAMES, sessionTimeFor } from '../domain/feedPlan'
import { formatDate, formatKg, formatNumber, formatVnd } from '../domain/feedLabels'
import type { FeedFeedingRecord } from '../types/feedFeeding'
import type { FeedRation, FeedRationPenOption } from '../types/feedRation'

type PrintDocumentProps = { farmName?: string; children: ReactNode }

function PrintDocument({ farmName, children }: PrintDocumentProps) {
  const session = useSession()
  return (
    <article className="feed-print-document mx-auto max-w-[980px] rounded-2xl border border-field bg-white p-6 text-ink shadow-sm sm:p-8">
      <div className="feed-print-document-header mb-6 flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand pb-4">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">BeefCare · {farmName ?? session?.farmName ?? 'Trang trại'}</p>
      </div>
      {children}
    </article>
  )
}

function DocumentTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <>
      {eyebrow && <p className="m-0 mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{eyebrow}</p>}
      <h1 className="m-0 mt-1 text-2xl font-bold text-ink">{title}</h1>
      {subtitle && <p className="m-0 mt-1 text-sm text-muted">{subtitle}</p>}
    </>
  )
}

function MetaGrid({ items }: { items: Array<[string, React.ReactNode]> }) {
  return <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">{items.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="m-0 mt-0.5 font-medium text-ink">{value}</dd></div>)}</dl>
}

function PrintSignatures() {
  return (
    <div className="feed-print-signatures mt-12 hidden grid-cols-2 gap-12 border-t border-rule pt-4 text-center text-xs text-muted">
      <div className="feed-print-signature-placeholder"><p className="m-0 font-semibold text-ink">Người lập / ghi sổ</p><div className="mt-12 border-b border-rule" /><p className="m-0 mt-2">Ký và ghi rõ họ tên</p></div>
      <div className="feed-print-signature-placeholder"><p className="m-0 font-semibold text-ink">Người kiểm tra</p><div className="mt-12 border-b border-rule" /><p className="m-0 mt-2">Ký và ghi rõ họ tên</p></div>
    </div>
  )
}

const costLabel = (cost: number | null) => cost === null ? 'Chưa có giá vốn' : formatVnd(cost)
const dateTimeLabel = (value: string | null | undefined) => value ? toFarmLocal(value).replace('T', ' ') : 'Chưa ghi'
const statusTone = (status: string) => status === 'VALID' || status === 'EFFECTIVE' ? 'ok' : status === 'VOIDED' || status === 'CANCELLED' ? 'err' : 'warn'
const recordAuditText = (record: FeedFeedingRecord | null) => record ? `${record.recordedBy ?? 'Chưa ghi'} · ${dateTimeLabel(record.recordedAt)}` : '—'
const recordNotesText = (record: FeedFeedingRecord | null) => {
  if (!record) return '—'
  const voidReason = record.voidReason ?? [...record.revisions].reverse().find((revision) => revision.action === 'VOIDED')?.reason
  return [record.leftoverKg === null ? null : `Thừa ${formatKg(record.leftoverKg)}`, record.note, voidReason ? `Lý do hủy: ${voidReason}` : null].filter(Boolean).join(' · ') || 'Không có'
}

export function FeedRationPrintDocument({ ration, pens, farmName }: { ration: FeedRation; pens: FeedRationPenOption[]; farmName?: string }) {
  const state = rationPrintState(ration)
  const assignedPens = ration.penIds.map((id) => pens.find((pen) => pen.id === id)).filter((pen): pen is FeedRationPenOption => Boolean(pen))
  const currentHeadcount = assignedPens.reduce((sum, pen) => sum + pen.headcount, 0)
  const dailyKg = ration.components.reduce((sum, component) => sum + component.dailyKg, 0)
  const dailyCost = ration.components.every((component) => component.estimatedDailyCost !== null)
    ? ration.components.reduce((sum, component) => sum + (component.estimatedDailyCost ?? 0), 0)
    : null
  return (
    <PrintDocument farmName={farmName}>
      <DocumentTitle eyebrow="Bản in tra cứu · phiên bản đã lưu" title={`Khẩu phần ${ration.rationCode} · v${ration.versionNo}`} subtitle={ration.name} />
      <div className="mt-4 flex flex-wrap items-center gap-2"><Badge tone={statusTone(ration.status) as 'ok' | 'warn' | 'err'}>{state.label}</Badge><span className="text-xs text-muted">{state.detail}</span></div>
      <MetaGrid items={[
        ['Mã / phiên bản', `${ration.rationCode} · v${ration.versionNo}`],
        ['Nhóm đàn', ration.herdGroup || 'Không khai báo'],
        ['Chuồng áp dụng', assignedPens.length ? assignedPens.map((pen) => `${pen.code} · ${pen.name}`).join('; ') : 'Không có dữ liệu chuồng'],
        ['Hiệu lực', `${formatDate(ration.effectiveFrom)}${ration.effectiveTo ? ` – ${formatDate(ration.effectiveTo)}` : ' trở đi'}`],
        ['Số bữa / giờ', `${ration.sessionsPerDay} bữa · ${ration.sessionTimes?.slice(0, ration.sessionsPerDay).join(' · ') || 'Chưa có giờ'}`],
        ['Cơ sở / nguồn', ration.basis || 'Không khai báo'],
        ['Đầu con hiện tại', assignedPens.length ? `${formatNumber(currentHeadcount, 0)} con · số hiện tại theo chuồng (tham khảo)` : 'Chưa có dữ liệu hiện tại'],
        ['Tổng kế hoạch / con / ngày', `${formatKg(dailyKg)} · chi phí ${costLabel(dailyCost)}`],
      ]} />
      <p className="mt-5 border-l-4 border-brand bg-[#eef4ef] px-3 py-2 text-xs text-muted">Đầu con hiện tại là số đang có ở chuồng lúc xem bản in, không phải ảnh chụp đầu con khi phiên bản được lưu.</p>
      <h2 className="mt-7 text-base font-bold text-ink">Thành phần khẩu phần</h2>
      {ration.components.length ? <div className="mt-3 overflow-x-auto"><table className="feed-print-table w-full text-left text-xs"><thead><tr><th>Mã</th><th>Thức ăn</th>{Array.from({ length: ration.sessionsPerDay }, (_, index) => <th key={index}>Cữ {SESSION_NAMES[index + 1]}<br />kg/con</th>)}<th>Ngày<br />kg/con</th><th>Chi phí ngày</th></tr></thead><tbody>{ration.components.map((component) => <tr key={component.feedItemId}><td className="whitespace-nowrap font-semibold">{component.feedCode}</td><td>{component.feedName}</td>{Array.from({ length: ration.sessionsPerDay }, (_, index) => <td key={index}>{formatNumber(index === 0 ? component.session1Kg : index === 1 ? component.session2Kg : component.session3Kg, 3)} kg</td>)}<td className="whitespace-nowrap">{formatKg(component.dailyKg, 3)}</td><td className="whitespace-nowrap">{costLabel(component.estimatedDailyCost)}</td></tr>)}</tbody><tfoot><tr><td colSpan={2} className="font-bold">Tổng</td>{Array.from({ length: ration.sessionsPerDay }, (_, index) => <td key={index} className="font-bold">{formatNumber(ration.components.reduce((sum, component) => sum + (index === 0 ? component.session1Kg : index === 1 ? component.session2Kg : component.session3Kg), 0), 3)} kg</td>)}<td className="font-bold">{formatKg(dailyKg, 3)}</td><td className="font-bold">{costLabel(dailyCost)}</td></tr></tfoot></table></div> : <p className="mt-3 border border-warn-fg bg-warn-bg p-3 text-xs">Dữ liệu đã lưu không có thành phần khẩu phần. Không thể suy ra lượng hoặc chi phí.</p>}
      <PrintSignatures />
    </PrintDocument>
  )
}

function LineSummary({ lines }: { lines: FeedFeedingRecord['lines'] }) {
  if (!lines.length) return <span className="text-muted">Không có dòng thức ăn</span>
  return <div className="space-y-1">{lines.map((line) => {
    const comparison = comparePlannedActual(line.plannedKg, line.actualKg, line.inRation)
    const variance = comparison.state === 'actual-only' ? 'Ngoài khẩu phần · chỉ thực tế' : `${comparison.varianceKg! > 0 ? '+' : ''}${formatNumber(comparison.varianceKg!)} kg${comparison.variancePct === null ? '' : ` (${comparison.variancePct! > 0 ? '+' : ''}${formatNumber(comparison.variancePct!, 2)}%)`}`
    return <div key={`${line.feedItemId}-${line.feedCode}`}><span className="font-semibold">{line.feedCode}</span> · {line.feedName ?? 'Chưa có tên'} · KH {comparison.state === 'actual-only' ? '—' : formatKg(line.plannedKg)} → TT {formatKg(line.actualKg)} · {variance}{line.inRation === false ? ' · ngoài khẩu phần' : ''}{line.totalCost === null ? ' · Chưa có giá vốn' : ` · ${formatVnd(line.totalCost)}`}</div>
  })}</div>
}

export function FeedFeedingRecordPrintDocument({ record, farmName }: { record: FeedFeedingRecord; farmName?: string }) {
  const hasRation = Boolean(record.rationCode)
  const state = feedingRecordPrintState(record, hasRation)
  const isFuture = record.feedingDate > businessDate()
  const voidReason = record.voidReason ?? [...record.revisions].reverse().find((revision) => revision.action === 'VOIDED')?.reason
  const costKnown = record.lines.every((line) => line.totalCost !== null)
  const variance = record.plannedTotalKg > 0 ? record.actualTotalKg - record.plannedTotalKg : null
  return (
    <PrintDocument farmName={farmName}>
      <DocumentTitle eyebrow="Bản in tra cứu · bản ghi đã lưu" title={`Bản ghi cho ăn #${record.id}`} subtitle={`${record.penCode ?? `Chuồng ${record.penId}`} · ${formatDate(record.feedingDate)} · cữ ${SESSION_NAMES[record.sessionNo] ?? record.sessionNo}`} />
      <div className="mt-4 flex flex-wrap items-center gap-2"><Badge tone={statusTone(record.status) as 'ok' | 'warn' | 'err'}>{isFuture ? 'Ngày tương lai' : feedingRecordStatusLabel(record)}</Badge>{isFuture && <span className="text-xs text-warn-fg">Ngày tương lai · không thể coi là dữ liệu cho ăn đã hoàn thành.</span>}{state === 'voided' && <span className="text-xs text-err-fg">Không tính là bản ghi hợp lệ; lượng đã ghi được hoàn theo nghiệp vụ hủy.</span>}{state === 'missing' && <span className="text-xs text-warn-fg">Bản ghi không ở trạng thái hợp lệ; không tính vào nhật ký chính thức.</span>}{!hasRation && <span className="text-xs text-warn-fg">Không có khẩu phần hiệu lực · chỉ nhập lượng thực tế.</span>}</div>
      {voidReason && <p className="mt-3 border-l-4 border-err-fg bg-err-bg px-3 py-2 text-xs text-err-fg"><strong>Lý do hủy:</strong> {voidReason}</p>}
      <MetaGrid items={[
        ['Chuồng', `${record.penCode ?? `Chuồng ${record.penId}`}${record.penName ? ` · ${record.penName}` : ''}`],
        ['Ngày / cữ / giờ', `${formatDate(record.feedingDate)} · ${SESSION_NAMES[record.sessionNo] ?? record.sessionNo} · ${record.time ?? 'Chưa ghi giờ'}`],
        ['Khẩu phần', hasRation ? `${record.rationCode} · v${record.rationVersion ?? '—'}` : 'Không có khẩu phần hiệu lực'],
        ['Số con lúc cho ăn', `${formatNumber(record.headCount, 0)} con · số ghi nhận chính thức của bản ghi`],
        ['Người cho ăn', record.fedBy ?? 'Chưa ghi'],
        ['Người ghi / thời điểm', `${record.recordedBy ?? 'Chưa ghi'} · ${dateTimeLabel(record.recordedAt)}`],
      ]} />
      <h2 className="mt-7 text-base font-bold text-ink">Planned / actual theo dòng</h2>
      <div className="mt-3 overflow-x-auto"><table className="feed-print-table w-full text-left text-xs"><thead><tr><th>Mặt hàng</th><th>Trong khẩu phần</th><th>Kế hoạch</th><th>Thực tế</th><th>Chênh lệch</th><th>Đơn giá</th><th>Chi phí</th></tr></thead><tbody>{record.lines.map((line) => { const comparison = comparePlannedActual(line.plannedKg, line.actualKg, line.inRation); return <tr key={line.feedItemId}><td><strong>{line.feedCode}</strong><br />{line.feedName ?? 'Chưa có tên'}</td><td>{line.inRation === true ? 'Có' : line.inRation === false ? 'Không · ngoài khẩu phần' : 'Không rõ'}</td><td>{comparison.state === 'actual-only' ? '—' : formatKg(line.plannedKg)}</td><td>{formatKg(line.actualKg)}</td><td>{comparison.state === 'actual-only' ? 'Chỉ thực tế' : `${comparison.varianceKg! > 0 ? '+' : ''}${formatNumber(comparison.varianceKg!)} kg${comparison.variancePct === null ? '' : ` · ${comparison.variancePct! > 0 ? '+' : ''}${formatNumber(comparison.variancePct!, 2)}%`}`}</td><td>{line.unitCost === null ? 'Chưa có giá vốn' : formatVnd(line.unitCost)}</td><td>{line.totalCost === null ? 'Chưa có giá vốn' : formatVnd(line.totalCost)}</td></tr> })}</tbody><tfoot><tr><td className="font-bold">Tổng</td><td /><td className="font-bold">{formatKg(record.plannedTotalKg)}</td><td className="font-bold">{formatKg(record.actualTotalKg)}</td><td className="font-bold">{variance === null ? 'Chỉ thực tế' : `${variance > 0 ? '+' : ''}${formatNumber(variance)} kg`}</td><td /><td className="font-bold">{costKnown ? formatVnd(record.lines.reduce((sum, line) => sum + (line.totalCost ?? 0), 0)) : 'Chưa có giá vốn'}</td></tr></tfoot></table></div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><span className="font-semibold">Thức ăn thừa:</span> {record.leftoverKg === null ? 'Chưa ghi' : formatKg(record.leftoverKg)}</div><div><span className="font-semibold">Ghi chú:</span> {record.note || 'Không có'}</div></div>
      {record.revisions.length > 0 && <section className="mt-7"><h2 className="text-base font-bold text-ink">Lịch sử sửa / hủy</h2><p className="mt-1 text-xs text-muted">Bản in chỉ hiển thị audit facts hiện có. Hợp đồng hiện tại không cung cấp snapshot số trước/sau.</p><table className="feed-print-table mt-3 w-full text-left text-xs"><thead><tr><th>Thao tác</th><th>Lý do</th><th>Người thực hiện</th><th>Thời điểm</th></tr></thead><tbody>{record.revisions.map((revision, index) => <tr key={`${revision.changedAt}-${index}`}><td>{revisionActionLabel(revision.action)}</td><td>{revision.reason}</td><td>{revision.actorName ?? 'Chưa có'}</td><td>{dateTimeLabel(revision.changedAt)}</td></tr>)}</tbody></table></section>}
      <PrintSignatures />
    </PrintDocument>
  )
}

type DayLogProps = { date: string; records: FeedFeedingRecord[]; rations: FeedRation[]; pens: FeedRationPenOption[]; farmName?: string }

export function FeedDayLogPrintDocument({ date, records, rations, pens, farmName }: DayLogProps) {
  const isFuture = date > businessDate()
  const activePens = pens.filter((pen) => pen.status === 'ACTIVE')
  const maxSessions = Math.max(2, ...rations.map((ration) => ration.sessionsPerDay))
  const rows = activePens.flatMap((pen) => Array.from({ length: maxSessions }, (_, index) => {
    const sessionNo = index + 1
    const ration = effectiveRationForPen(rations, pen.id, date)
    const candidates = records.filter((record) => record.penId === pen.id && record.feedingDate === date && record.sessionNo === sessionNo)
    const record = candidates.find((item) => item.status === 'VALID') ?? candidates[0] ?? null
    return { pen, sessionNo, ration, record, plan: planForSession(ration, pen, sessionNo) }
  }))
  const validCount = rows.filter((row) => row.record?.status === 'VALID').length
  return (
    <PrintDocument farmName={farmName}>
      <DocumentTitle eyebrow="Bản in tra cứu · nhật ký ngày" title={`Nhật ký cho ăn ngày ${formatDate(date)}`} subtitle="Tổng hợp theo chuồng và cữ; chỉ bản ghi VALID là dữ liệu cho ăn hợp lệ." />
      <MetaGrid items={[
        ['Ngày', formatDate(date)],
        ['Bản ghi hợp lệ', `${validCount} / ${rows.length} cữ trong phạm vi chuồng đang hoạt động`],
        ['Đầu con hiển thị', 'Số hiện tại theo chuồng · tham khảo, không phải snapshot lúc cho ăn'],
        ['Phạm vi', activePens.length ? activePens.map((pen) => pen.code).join(', ') : 'Không có chuồng đang hoạt động'],
      ]} />
      {!isFuture && records.length === 0 && <p className="mt-3 border-l-4 border-warn-fg bg-warn-bg px-3 py-2 text-xs text-warn-fg">Không có bản ghi cho ngày này. Bản in không xác nhận đã cho ăn.</p>}
      {!isFuture && records.length > 0 && validCount === 0 && <p className="mt-3 border-l-4 border-err-fg bg-err-bg px-3 py-2 text-xs text-err-fg">Không có bản ghi hợp lệ trong ngày. Các dữ liệu hiện có đều đã hủy hoặc không ở trạng thái hợp lệ.</p>}
      <div className={`mt-3 border-l-4 px-3 py-2 text-xs ${isFuture ? 'border-warn-fg bg-warn-bg text-warn-fg' : 'border-brand bg-[#eef4ef] text-muted'}`}>{isFuture ? 'Ngày tương lai — chưa thể ghi nhận; bản in không xác nhận dữ liệu cho ăn.' : 'Các ô “Chưa có bản ghi hợp lệ”, “Không có khẩu phần hiệu lực” và “Đã hủy” được giữ nguyên để ngày in không tạo cảm giác đã cho ăn khi dữ liệu chưa có.'}</div>
      <div className="mt-6 overflow-x-auto"><table className="feed-print-table w-full text-left text-xs"><thead><tr><th>Chuồng · đầu con hiện tại</th><th>Khẩu phần</th><th>Cữ / giờ</th><th>Thức ăn · kế hoạch → thực tế · chênh lệch</th><th>Trạng thái</th><th>Người cho ăn</th><th>Người ghi / thời điểm</th><th>Thừa / ghi chú</th></tr></thead><tbody>{rows.map(({ pen, sessionNo, ration, record, plan }) => { const state = feedingRecordPrintState(record, Boolean(ration)); const planned = plan.reduce((sum, line) => sum + line.plannedKg, 0); return <tr key={`${pen.id}-${sessionNo}`}><td><strong>{pen.code}</strong><br />{pen.name}<br /><span className="text-muted">Hiện tại: {formatNumber(pen.headcount, 0)} con</span>{record && <><br /><span className="text-muted">Lúc cho ăn: {formatNumber(record.headCount, 0)} con · theo bản ghi</span></>}</td><td>{ration ? `${ration.rationCode} · v${ration.versionNo}` : 'Không có khẩu phần hiệu lực'}</td><td>Cữ {SESSION_NAMES[sessionNo] ?? sessionNo}<br />{sessionTimeFor(rations, sessionNo)}</td><td>{isFuture ? <span>Ngày tương lai · chưa có dữ liệu cho ăn</span> : record?.status === 'VALID' ? <LineSummary lines={record.lines} /> : state === 'no-ration' ? <span>— · không có kế hoạch hoặc bản ghi</span> : state === 'voided' ? <span>Bản ghi đã hủy · không tính</span> : <span>{planned > 0 ? `KH ${formatKg(planned)} → TT — · Chưa có bản ghi hợp lệ` : 'Không có kế hoạch'}</span>}</td><td>{isFuture ? 'Ngày tương lai' : state === 'valid' ? 'Hợp lệ' : state === 'voided' ? 'Đã hủy' : state === 'no-ration' ? 'Không có khẩu phần hiệu lực' : 'Chưa có bản ghi hợp lệ'}</td><td>{record?.status === 'VALID' ? record.fedBy ?? 'Chưa ghi' : '—'}</td><td>{recordAuditText(record)}</td><td>{recordNotesText(record)}</td></tr> })}</tbody></table></div>
      <p className="mt-4 text-xs text-muted">Tổng thực tế hợp lệ trong ngày: {formatKg(rows.reduce((sum, row) => sum + (row.record?.status === 'VALID' ? row.record.actualTotalKg : 0), 0))}. Chi phí chỉ hiển thị tại dòng có giá vốn do hợp đồng cung cấp.</p>
      <PrintSignatures />
    </PrintDocument>
  )
}

