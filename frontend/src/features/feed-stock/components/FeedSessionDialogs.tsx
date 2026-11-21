import { toFarmLocal } from '../../../shared/lib/date/farmTime'
import { useEffect, useState } from 'react'
import { Button, Checkbox, Field, Icon, inputCls, Modal, ModalButton, ModalFooter, Note, Radio, Select, Table, Td, Textarea, Th } from '../../../shared/ui'
import { useSession } from '../../../app/session/sessionContext'
import { userFacingError } from '../../../shared/api/userFacingError'
import { effectiveRationForPen } from '../domain/feedTodayRations'
import { planForSession, SESSION_NAMES, sessionTimeFor, shortPersonName } from '../domain/feedPlan'
import { formatDate, formatKg, formatNumber } from '../domain/feedLabels'
import { feedFeedingServerBacked, useFeedFeedingCommands, useFeedFeedingSession } from '../hooks/useFeedFeeding'
import type { FeedStockRow } from '../types'
import type { FeedFeedingDraftInput, FeedFeedingLineInput, FeedFeedingRecord } from '../types/feedFeeding'
import type { FeedRation, FeedRationPenOption } from '../types/feedRation'

export type FeedingData = { records: FeedFeedingRecord[]; rations: FeedRation[]; pens: FeedRationPenOption[]; feeds: FeedStockRow[] }
type FormLine = { feedItemId: string; plannedKg: string; actualKg: string; inRation: boolean }

const sessionLabel = (sessionNo: number) => `Cữ ${SESSION_NAMES[sessionNo] ?? sessionNo}`

function buildLines(pen: FeedRationPenOption | undefined, ration: FeedRation | null, sessionNo: number, prefill = false): FormLine[] {
  return planForSession(ration, pen, sessionNo).map((line) => ({ feedItemId: String(line.feedItemId), plannedKg: String(line.plannedKg), actualKg: prefill ? String(line.plannedKg) : '0', inRation: true }))
}

/** Popup "Record Feeding Session" (UC-FE23-08): one pen, one session, stock is deducted on save. */
export function FeedRecordDialog({ data, date, penId, sessionNo, prefillFromPlan = false, onClose, onSaved }: {
  data: FeedingData
  date: string
  penId?: number
  sessionNo?: number
  prefillFromPlan?: boolean
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const session = useSession()
  const commands = useFeedFeedingCommands()
  const activePens = data.pens.filter((pen) => pen.status === 'ACTIVE')
  const [pen, setPen] = useState<number | ''>(penId ?? '')
  const [sessionValue, setSessionValue] = useState(sessionNo ?? 1)
  const selectedPen = data.pens.find((row) => row.id === pen)
  const localRation = selectedPen ? effectiveRationForPen(data.rations, selectedPen.id, date) : null
  const planQuery = useFeedFeedingSession({ penId: pen === '' ? undefined : pen, date, sessionNo: sessionValue })
  const serverPlan = planQuery.data && planQuery.data.penId === pen && planQuery.data.feedingDate === date && planQuery.data.sessionNo === sessionValue
    ? planQuery.data
    : null
  const [time, setTime] = useState(sessionTimeFor(data.rations, sessionNo ?? 1))
  const people = planQuery.peopleSuggestions(session?.fullName)
  const [fedBy, setFedBy] = useState(session?.fullName ?? people[0] ?? '')
  const [leftover, setLeftover] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<FormLine[]>(() => feedFeedingServerBacked ? [] : buildLines(data.pens.find((row) => row.id === penId), penId ? effectiveRationForPen(data.rations, penId, date) : null, sessionNo ?? 1, prefillFromPlan))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!serverPlan) return
    setTime(serverPlan.feedingTime.slice(0, 5))
    setLines(serverPlan.lines.map((line) => ({ feedItemId: String(line.feedItemId), plannedKg: String(line.plannedKg), actualKg: prefillFromPlan ? String(line.plannedKg) : '0', inRation: true })))
    setError('')
  }, [serverPlan, prefillFromPlan])

  const rescope = (nextPen: number | '', nextSession: number) => {
    commands.resetCommandKey()
    const nextPenRow = data.pens.find((row) => row.id === nextPen)
    const nextRation = nextPenRow ? effectiveRationForPen(data.rations, nextPenRow.id, date) : null
    setPen(nextPen)
    setSessionValue(nextSession)
    setTime(sessionTimeFor(data.rations, nextSession))
    setLines(feedFeedingServerBacked ? [] : buildLines(nextPenRow, nextRation, nextSession, prefillFromPlan))
    setError('')
  }
  const updateLine = (index: number, key: keyof FormLine, value: string) => { commands.resetCommandKey(); setLines((current) => current.map((line, i) => i === index ? { ...line, [key]: value } : line)); setError('') }
  const plannedTotal = lines.reduce((sum, line) => sum + (Number(line.plannedKg) || 0), 0)
  const actualTotal = lines.reduce((sum, line) => sum + (Number(line.actualKg) || 0), 0)
  const ration = feedFeedingServerBacked ? serverPlan?.ration : localRation
  const sessionsOfPen = Math.max(serverPlan?.ration?.sessionsPerDay ?? localRation?.sessionsPerDay ?? 3, 1)
  const duplicate = feedFeedingServerBacked
    ? serverPlan?.existingRecordId != null
    : selectedPen && data.records.find((record) => record.status === 'VALID' && record.penId === selectedPen.id && record.feedingDate === date && record.sessionNo === sessionValue)
  const headCount = serverPlan?.headCount ?? selectedPen?.headcount ?? 0
  const stockForLine = (line: FormLine) => {
    const feedItemId = Number(line.feedItemId)
    return serverPlan?.lines.find((row) => row.feedItemId === feedItemId)?.stockKg ?? data.feeds.find((row) => row.feedItemId === feedItemId)?.onHandKg
  }
  const outOfStockLines = lines.filter((line) => stockForLine(line) !== undefined && stockForLine(line)! <= 0)
  const zeroOutOfStockLines = outOfStockLines.filter((line) => Number(line.actualKg) === 0)
  const outOfStockNames = [...new Set(outOfStockLines.map((line) => {
    const feedItemId = Number(line.feedItemId)
    return data.feeds.find((row) => row.feedItemId === feedItemId)?.name ?? String(feedItemId)
  }))]
  const missingOutOfStockNote = zeroOutOfStockLines.length > 0 && !note.trim()

  const submit = async () => {
    if (saving) return
    if (!selectedPen) return setError('Chuồng là bắt buộc.')
    if (duplicate) return setError(`${selectedPen.code} đã có bản ghi ${sessionLabel(sessionValue).toLocaleLowerCase('vi')} ngày ${formatDate(date)}.`)
    if (!time) return setError('Nhập giờ cho ăn.')
    if (feedFeedingServerBacked && (!serverPlan || planQuery.loading || planQuery.error)) return setError(planQuery.error ? userFacingError(planQuery.error, 'Không thể tải kế hoạch cữ cho ăn.') : 'Đang tải kế hoạch cữ cho ăn. Vui lòng thử lại.')
    if (!lines.length || lines.some((line) => !line.feedItemId)) return setError('Chọn thức ăn cho từng dòng.')
    for (const line of lines) {
      const feed = data.feeds.find((row) => row.feedItemId === Number(line.feedItemId))
      const available = serverPlan?.lines.find((row) => row.feedItemId === Number(line.feedItemId))?.available ?? feed?.available ?? true
      const stockKg = serverPlan?.lines.find((row) => row.feedItemId === Number(line.feedItemId))?.stockKg ?? feed?.onHandKg
      const actual = Number(line.actualKg)
      if (!Number.isFinite(actual) || actual < 0 || Math.abs(actual * 10 - Math.round(actual * 10)) > 1e-7) return setError('Lượng thực tế phải là số không âm, tối đa một chữ số thập phân.')
      if (!available && actual > 0) return setError(`${feed?.name ?? line.feedItemId} đã ngừng hoạt động; không thể ghi lượng thực tế.`)
      if (stockKg !== undefined && actual > stockKg) return setError(`${feed?.name ?? line.feedItemId}: chỉ còn ${formatNumber(stockKg)} kg trong kho.`)
    }
    if (missingOutOfStockNote) return setError(`${outOfStockNames.join(', ')} đã hết hàng. Nhập lý do vào Ghi chú trước khi lưu.`)
    if (leftover && (!Number.isFinite(Number(leftover)) || Number(leftover) < 0)) return setError('Thức ăn thừa phải là số không âm.')
    setSaving(true)
    setError('')
    try {
      const payload: FeedFeedingDraftInput = {
        penId: selectedPen.id, feedingDate: date, sessionNo: sessionValue, time, fedBy, leftoverKg: leftover ? Number(leftover) : null, note,
        rationCode: ration?.rationCode ?? null, rationVersion: ration?.versionNo ?? null,
        lines: lines.map((line): FeedFeedingLineInput => ({ feedItemId: Number(line.feedItemId), plannedKg: Number(line.plannedKg), actualKg: Number(line.actualKg), inRation: line.inRation })),
      }
      await commands.record({ input: payload })
      commands.resetCommandKey()
      onSaved(`Đã ghi cữ cho ăn của ${selectedPen.code} (${SESSION_NAMES[sessionValue] ?? sessionValue}). Đã trừ ${formatNumber(actualTotal)} kg khỏi kho.`)
    } catch (saveError) {
      setError(userFacingError(saveError, 'Không thể ghi cữ cho ăn.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Ghi cữ cho ăn" sub={`Ngày ${formatDate(date)} · ghi ở mức chuồng · lưu là trừ kho`} topTitle="Thức ăn › Nhật ký cho ăn" width={760} onClose={onClose}>
      {error && <div role="alert" className="rounded-md bg-err-bg px-3 py-2.5 text-xs text-err-fg">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Chuồng *" id="feeding-form-pen">
          <Select id="feeding-form-pen" disabled={saving} value={pen} onChange={(event) => rescope(event.target.value ? Number(event.target.value) : '', sessionValue)}>
            <option value="">Chọn chuồng</option>
            {activePens.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.headcount} con</option>)}
          </Select>
        </Field>
        <Field label="Cữ *" id="feeding-form-session">
          <Select id="feeding-form-session" disabled={saving} value={sessionValue} onChange={(event) => rescope(pen, Number(event.target.value))}>
            {Array.from({ length: sessionsOfPen }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{sessionLabel(value)}</option>)}
          </Select>
        </Field>
        <Field label="Giờ cho ăn" id="feeding-form-time"><input id="feeding-form-time" type="time" disabled={saving} value={time} onChange={(event) => { commands.resetCommandKey(); setTime(event.target.value) }} className={inputCls} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Khẩu phần áp dụng" id="feeding-form-ration"><input id="feeding-form-ration" readOnly value={ration ? `${ration.rationCode} · ${ration.name}` : selectedPen ? 'Chưa có khẩu phần hiệu lực' : ''} className={inputCls} /></Field>
        <Field label="Người cho ăn" id="feeding-form-fedby">
          <input id="feeding-form-fedby" list="feeding-people" maxLength={100} disabled={saving} value={fedBy} onChange={(event) => { commands.resetCommandKey(); setFedBy(event.target.value) }} className={inputCls} />
          <datalist id="feeding-people">{people.map((name) => <option key={name} value={name} />)}</datalist>
        </Field>
      </div>
      {selectedPen && feedFeedingServerBacked && planQuery.loading && <p role="status" className="m-0 text-xs text-muted">Đang tải kế hoạch và tồn kho…</p>}
      {Boolean(planQuery.error) && feedFeedingServerBacked && <div role="alert" className="rounded-md bg-err-bg px-3 py-2.5 text-xs text-err-fg">{userFacingError(planQuery.error, 'Không thể tải kế hoạch cữ cho ăn.')}</div>}
      {selectedPen && serverPlan?.existingRecordId != null && <Note tone="warn">Chuồng {selectedPen.code} đã có bản ghi hợp lệ cho cữ này trong ngày {formatDate(date)}.</Note>}
      {selectedPen && !planQuery.loading && !planQuery.error && (feedFeedingServerBacked ? serverPlan !== null && serverPlan.ration == null : !localRation) && <Note tone="warn">Chuồng {selectedPen.code} chưa có khẩu phần hiệu lực vào ngày {formatDate(date)}. Chỉ nhập thức ăn thực tế.</Note>}
      {outOfStockLines.length > 0 && <Note tone="warn">{outOfStockNames.join(', ')} đã hết hàng. Nếu ghi lượng thực tế 0 kg, hãy nêu lý do trong Ghi chú.</Note>}
      <h3 className="m-0 text-[13px] font-semibold">Thức ăn đã cho (kế hoạch = khẩu phần × {headCount} con)</h3>
      <Table scroll stack={false}>
        <thead><tr><Th>Thức ăn</Th><Th>Kế hoạch</Th><Th>Thực tế *</Th><Th>Tồn kho hiện có</Th><Th aria-label="Xóa" /></tr></thead>
        <tbody>
          {lines.map((line, index) => {
            const feed = data.feeds.find((row) => row.feedItemId === Number(line.feedItemId))
            const planLine = serverPlan?.lines.find((row) => row.feedItemId === Number(line.feedItemId))
            const stockKg = planLine?.stockKg ?? feed?.onHandKg
            const available = planLine?.available ?? feed?.available !== false
            const perHead = headCount && Number(line.plannedKg) ? Number(line.plannedKg) / headCount : null
            return (
              <tr key={`${index}-${line.feedItemId}`}>
                <Td className="min-w-[160px]">
                  {line.inRation
                    ? <><div className="font-medium">{feed?.name ?? '—'}</div><div className="text-[11px] text-muted">{feed?.code}{perHead ? ` · ${formatNumber(perHead, 3)} kg/con` : ''}</div></>
                    : (
                      <Select aria-label={`Thức ăn dòng ${index + 1}`} disabled={saving} value={line.feedItemId} onChange={(event) => updateLine(index, 'feedItemId', event.target.value)}>
                        <option value="">Chọn thức ăn</option>
                        {data.feeds.filter((row) => row.available !== false).map((row) => <option key={row.feedItemId} value={row.feedItemId}>{row.code} · {row.name}</option>)}
                      </Select>
                    )}
                </Td>
                <Td className="whitespace-nowrap">{formatKg(Number(line.plannedKg) || 0)}</Td>
                <Td>
                  <div className="relative w-[140px]">
                    <input aria-label={`Lượng thực tế dòng ${index + 1}`} type="number" min="0" step="0.1" disabled={saving || !available} value={line.actualKg} onChange={(event) => updateLine(index, 'actualKg', event.target.value)} className={`${inputCls} pr-9`} />
                    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">kg</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{stockKg === undefined ? '—' : formatKg(stockKg, 1)}</Td>
                <Td>{!line.inRation && <Button variant="link" size="sm" disabled={saving} aria-label={`Xóa thức ăn dòng ${index + 1}`} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>Xóa</Button>}</Td>
              </tr>
            )
          })}
          {!lines.length && <tr><Td colSpan={5} className="text-muted">Chưa có khẩu phần cho cữ này. Thêm thức ăn thực tế để tiếp tục.</Td></tr>}
        </tbody>
        <tfoot>
          <tr><Td className="font-semibold">Tổng cữ</Td><Td className="whitespace-nowrap font-semibold">{formatKg(plannedTotal)}</Td><Td className="whitespace-nowrap font-semibold">{formatKg(actualTotal)}</Td><Td /><Td /></tr>
        </tfoot>
      </Table>
      <button type="button" disabled={saving} onClick={() => { commands.resetCommandKey(); setLines((current) => [...current, { feedItemId: '', plannedKg: '0', actualKg: '0', inRation: false }]) }} className="mx-auto inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-brand">
        <Icon name="circle-plus" size={16} />Thêm thức ăn ngoài khẩu phần
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Thức ăn thừa (kg)" id="feeding-form-leftover"><input id="feeding-form-leftover" type="number" min="0" step="0.1" disabled={saving} value={leftover} onChange={(event) => { commands.resetCommandKey(); setLeftover(event.target.value) }} className={inputCls} /></Field>
        <Field label={zeroOutOfStockLines.length > 0 ? 'Ghi chú *' : 'Ghi chú'} id="feeding-form-note" hint={zeroOutOfStockLines.length > 0 ? 'Bắt buộc khi ghi thực tế 0 kg do hết hàng.' : undefined}>
          <input id="feeding-form-note" maxLength={500} disabled={saving} value={note} aria-required={zeroOutOfStockLines.length > 0} aria-invalid={missingOutOfStockNote} onChange={(event) => { commands.resetCommandKey(); setNote(event.target.value) }} className={inputCls} />
        </Field>
      </div>
      <Note tone="info">Lưu sẽ trừ kho {formatNumber(actualTotal)} kg{selectedPen?.headcount ? ` (${formatNumber(actualTotal / selectedPen.headcount)} kg/con)` : ''}.</Note>
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton disabled={saving || !lines.length} onClick={() => { commands.resetCommandKey(); setLines((current) => current.map((line) => ({ ...line, actualKg: line.plannedKg }))) }}>Điền theo kế hoạch</ModalButton>
        <ModalButton disabled={saving} onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving || (feedFeedingServerBacked && (planQuery.loading || !serverPlan)) || Boolean(duplicate)} onClick={() => void submit()}>{saving ? 'Đang ghi…' : 'Lưu & trừ kho'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/** Popup "Correct / Void Feeding Record" (UC-FE23-09): stock moves by the difference, or all of it returns on void. */
export function FeedCorrectDialog({ data, record, initialAction, onClose, onSaved }: {
  data: FeedingData
  record: FeedFeedingRecord
  initialAction: 'correct' | 'void'
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const commands = useFeedFeedingCommands()
  const [action, setAction] = useState(initialAction)
  const [values, setValues] = useState(() => record.lines.map((line) => String(line.actualKg)))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const diffs = record.lines.map((line, index) => Math.round(((Number(values[index]) || 0) - line.actualKg) * 10) / 10)
  const changed = diffs.some((diff) => diff !== 0)

  const submit = async () => {
    if (saving) return
    if (reason.trim().length < 5) return setError(action === 'void' ? 'Nhập lý do hủy, tối thiểu 5 ký tự.' : 'Nhập lý do sửa, tối thiểu 5 ký tự.')
    if (reason.trim().length > 500) return setError('Lý do tối đa 500 ký tự.')
    for (const [index, line] of record.lines.entries()) {
      const feed = data.feeds.find((row) => row.feedItemId === line.feedItemId)
      if (action === 'correct' && feed && diffs[index] > feed.onHandKg) return setError(`${feed.name}: chỉ còn ${formatNumber(feed.onHandKg)} kg trong kho.`)
    }
    setSaving(true)
    setError('')
    try {
      if (action === 'void') {
        await commands.voidRecord({ id: record.id, reason, expectedVersion: record.version })
        commands.resetCommandKey()
        onSaved(`Đã hủy bản ghi ${record.penCode} (${SESSION_NAMES[record.sessionNo] ?? record.sessionNo}). Đã hoàn ${formatNumber(record.actualTotalKg)} kg vào kho.`)
      } else {
        await commands.correct({ id: record.id, input: {
          expectedVersion: record.version,
          reason,
          lines: record.lines.map((line, index): FeedFeedingLineInput => ({ feedItemId: line.feedItemId, plannedKg: line.plannedKg, actualKg: Number(values[index]) || 0, inRation: line.inRation === true })),
        } })
        commands.resetCommandKey()
        onSaved(`Đã sửa bản ghi ${record.penCode} (${SESSION_NAMES[record.sessionNo] ?? record.sessionNo}). Tồn kho điều chỉnh theo chênh lệch.`)
      }
    } catch (saveError) {
      setError(userFacingError(saveError, action === 'void' ? 'Không thể hủy bản ghi.' : 'Không thể sửa bản ghi.'))
    } finally {
      setSaving(false)
    }
  }

  const effectNote = action === 'void'
    ? `Hủy bản ghi hoàn lại kho toàn bộ ${formatNumber(record.actualTotalKg)} kg đã trừ của cữ.`
    : changed
      ? `Kho điều chỉnh theo chênh lệch: ${record.lines.flatMap((line, index) => {
        if (diffs[index] === 0) return []
        const feed = data.feeds.find((row) => row.feedItemId === line.feedItemId)
        const left = feed ? `, còn ${formatNumber(feed.onHandKg - diffs[index])} kg` : ''
        return [`${line.feedName ?? line.feedCode} ${diffs[index] > 0 ? 'trừ thêm' : 'hoàn lại'} ${formatNumber(Math.abs(diffs[index]))} kg${left}`]
      }).join('; ')}.`
      : 'Chưa có thay đổi về số lượng.'

  return (
    <Modal
      title="Sửa bản ghi cho ăn"
      sub={`${record.penName ?? record.penCode} · ${sessionLabel(record.sessionNo)} ${formatDate(record.feedingDate)} ${record.time ?? ''} · ghi bởi ${shortPersonName(record.recordedBy ?? record.fedBy)}${record.recordedAt ? ` lúc ${toFarmLocal(record.recordedAt).slice(11, 16)}` : ''}`}
      topTitle="Thức ăn › Nhật ký cho ăn"
      width={700}
      onClose={onClose}
    >
      {error && <div role="alert" className="rounded-md bg-err-bg px-3 py-2.5 text-xs text-err-fg">{error}</div>}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <span className="text-xs font-medium">Thao tác *</span>
        <Radio name="feeding-action" checked={action === 'correct'} onChange={() => { commands.resetCommandKey(); setAction('correct') }}>Sửa số lượng</Radio>
        <Radio name="feeding-action" checked={action === 'void'} onChange={() => { commands.resetCommandKey(); setAction('void') }}>Hủy bản ghi</Radio>
      </div>
      {action === 'correct' && (
        <Table scroll stack={false}>
          <thead><tr><Th>Thức ăn</Th><Th>Đã ghi</Th><Th>Giá trị mới</Th><Th>Chênh lệch kho</Th></tr></thead>
          <tbody>
            {record.lines.map((line, index) => (
              <tr key={line.feedItemId} className={diffs[index] !== 0 ? 'bg-warn-bg' : undefined}>
                <Td className="font-medium">{line.feedName ?? line.feedCode}</Td>
                <Td className="whitespace-nowrap">{formatKg(line.actualKg)}</Td>
                <Td>
                  <div className="relative w-[140px]">
                    <input aria-label={`Giá trị mới ${line.feedCode}`} type="number" min="0" step="0.1" disabled={saving} value={values[index]} onChange={(event) => { commands.resetCommandKey(); setValues((current) => current.map((value, i) => i === index ? event.target.value : value)); setError('') }} className={`${inputCls} pr-9`} />
                    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">kg</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{diffs[index] === 0 ? '0' : `${diffs[index] > 0 ? 'trừ thêm' : 'hoàn lại'} ${formatNumber(Math.abs(diffs[index]))} kg`}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Field label="Lý do *" id="feeding-correct-reason"><Textarea id="feeding-correct-reason" maxLength={500} value={reason} onChange={(event) => { commands.resetCommandKey(); setReason(event.target.value); setError('') }} /></Field>
      <Note tone="info">{effectNote}</Note>
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton disabled={saving} onClick={onClose}>Đóng</ModalButton>
        {action === 'void'
          ? <ModalButton variant="danger" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang hủy…' : 'Xác nhận hủy bản ghi'}</ModalButton>
          : <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</ModalButton>}
      </ModalFooter>
    </Modal>
  )
}

/** "Ghi nhanh theo khẩu phần": opens a normal record form with one selected session prefilled for review. */
export function FeedQuickFillDialog({ data, date, missing, onClose, onSaved }: {
  data: FeedingData
  date: string
  missing: Array<{ pen: FeedRationPenOption; sessionNo: number }>
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const key = (item: { pen: FeedRationPenOption; sessionNo: number }) => `${item.pen.id}:${item.sessionNo}`
  const [selected, setSelected] = useState(() => new Set(missing.map(key)))
  const [error, setError] = useState('')
  const [queue, setQueue] = useState<Array<{ pen: FeedRationPenOption; sessionNo: number }>>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [completed, setCompleted] = useState(0)
  const rows = missing.map((item) => {
    const ration = effectiveRationForPen(data.rations, item.pen.id, date)
    const plan = planForSession(ration, item.pen, item.sessionNo)
    return { ...item, ration, plan, total: Math.round(plan.reduce((sum, line) => sum + line.plannedKg, 0) * 10) / 10 }
  })

  const review = () => {
    const chosen = rows.filter((row) => selected.has(key(row)))
    if (!chosen.length) return setError('Chọn ít nhất một cữ để ghi.')
    setError('')
    setQueue(chosen)
    setActiveIndex(0)
    setCompleted(0)
  }

  const active = queue[activeIndex]
  if (active) return <FeedRecordDialog
    key={key(active)}
    data={data}
    date={date}
    penId={active.pen.id}
    sessionNo={active.sessionNo}
    prefillFromPlan
    onClose={() => { setQueue([]); setActiveIndex(0) }}
    onSaved={() => {
      const nextCompleted = completed + 1
      setCompleted(nextCompleted)
      if (activeIndex + 1 < queue.length) setActiveIndex(activeIndex + 1)
      else onSaved(`Đã ghi ${nextCompleted} cữ theo khẩu phần sau khi quản lý xác nhận từng cữ. Tồn kho đã trừ theo lượng thực tế.`)
    }}
  />

  return (
    <Modal title="Ghi nhanh theo khẩu phần" sub={`Ngày ${formatDate(date)} · chọn các cữ sẽ mở lần lượt từng biểu mẫu để kiểm tra và xác nhận`} topTitle="Thức ăn › Nhật ký cho ăn" width={700} onClose={onClose}>
      {error && <div role="alert" className="rounded-md bg-err-bg px-3 py-2.5 text-xs text-err-fg">{error}</div>}
      {rows.length === 0 ? <Note tone="info">Mọi cữ hôm nay đã được ghi.</Note> : (
        <Table scroll stack={false}>
          <thead><tr><Th aria-label="Chọn" /><Th>Chuồng</Th><Th>Cữ</Th><Th>Thức ăn theo kế hoạch</Th><Th>Tổng</Th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={key(row)}>
                <Td><Checkbox aria-label={`Chọn ${row.pen.code} ${sessionLabel(row.sessionNo)}`} checked={selected.has(key(row))} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(key(row))) next.delete(key(row)); else next.add(key(row)); return next })} /></Td>
                <Td className="whitespace-nowrap font-medium">{row.pen.name}<div className="text-[11px] font-normal text-muted">{row.pen.headcount} con · {row.ration?.rationCode}</div></Td>
                <Td className="whitespace-nowrap">{sessionLabel(row.sessionNo)}</Td>
                <Td>{row.plan.map((line) => `${data.feeds.find((feed) => feed.feedItemId === line.feedItemId)?.name ?? line.feedItemId} ${formatNumber(line.plannedKg)}`).join(' · ')}</Td>
                <Td className="whitespace-nowrap">{formatKg(row.total)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Note tone="info">Mỗi cữ mở trong một biểu mẫu riêng theo thứ tự đã chọn. Biểu mẫu lấy kế hoạch mới nhất từ máy chủ; kiểm tra tồn kho và lượng thực tế trước khi lưu.</Note>
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="primary" disabled={!rows.length} onClick={review}>Kiểm tra {selected.size} cữ đã chọn</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
