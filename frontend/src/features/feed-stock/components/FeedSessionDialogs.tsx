import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { Button, Checkbox, Field, Note, Radio, Select, Table, Td, Textarea, Th, inputCls } from '../../../components/ui'
import { useSession } from '../../authorization'
import { userFacingError } from '../../../api/userFacingError'
import { correctFeedSessionDemo, recordFeedSessionDemo, voidFeedSessionDemo } from '../api/feedFeedingApi'
import { effectiveRationForPen } from '../data/feedTodayRations'
import { planForSession, SESSION_NAMES, sessionTimeFor, shortPersonName } from '../domain/feedPlan'
import { formatDate, formatKg, formatNumber } from '../domain/feedLabels'
import type { FeedStockRow } from '../types'
import type { FeedFeedingDraftInput, FeedFeedingLineInput, FeedFeedingRecord } from '../types/feedFeeding'
import type { FeedRation, FeedRationPenOption } from '../types/feedRation'

export type FeedingData = { records: FeedFeedingRecord[]; rations: FeedRation[]; pens: FeedRationPenOption[]; feeds: FeedStockRow[] }
type FormLine = { feedItemId: string; plannedKg: string; actualKg: string; inRation: boolean }

const sessionLabel = (sessionNo: number) => `Cữ ${SESSION_NAMES[sessionNo] ?? sessionNo}`
const KNOWN_PEOPLE = ['Trần Quốc Long', 'Lê Thị Mai']

function buildLines(pen: FeedRationPenOption | undefined, ration: FeedRation | null, sessionNo: number): FormLine[] {
  return planForSession(ration, pen, sessionNo).map((line) => ({ feedItemId: String(line.feedItemId), plannedKg: String(line.plannedKg), actualKg: '0', inRation: true }))
}

/** Popup "Record Feeding Session" (UC-FE23-08): one pen, one session, stock is deducted on save. */
export function FeedRecordDialog({ data, date, penId, sessionNo, onClose, onSaved }: {
  data: FeedingData
  date: string
  penId?: number
  sessionNo?: number
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const session = useSession()
  const activePens = data.pens.filter((pen) => pen.status === 'ACTIVE')
  const [pen, setPen] = useState<number | ''>(penId ?? '')
  const [sessionValue, setSessionValue] = useState(sessionNo ?? 1)
  const selectedPen = data.pens.find((row) => row.id === pen)
  const ration = selectedPen ? effectiveRationForPen(data.rations, selectedPen.id, date) : null
  const [time, setTime] = useState(sessionTimeFor(data.rations, sessionNo ?? 1))
  const [fedBy, setFedBy] = useState(session?.fullName ?? KNOWN_PEOPLE[0])
  const [leftover, setLeftover] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<FormLine[]>(() => buildLines(data.pens.find((row) => row.id === penId), penId ? effectiveRationForPen(data.rations, penId, date) : null, sessionNo ?? 1))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const rescope = (nextPen: number | '', nextSession: number) => {
    const nextPenRow = data.pens.find((row) => row.id === nextPen)
    const nextRation = nextPenRow ? effectiveRationForPen(data.rations, nextPenRow.id, date) : null
    setPen(nextPen)
    setSessionValue(nextSession)
    setTime(sessionTimeFor(data.rations, nextSession))
    setLines(buildLines(nextPenRow, nextRation, nextSession))
    setError('')
  }
  const updateLine = (index: number, key: keyof FormLine, value: string) => { setLines((current) => current.map((line, i) => i === index ? { ...line, [key]: value } : line)); setError('') }
  const plannedTotal = lines.reduce((sum, line) => sum + (Number(line.plannedKg) || 0), 0)
  const actualTotal = lines.reduce((sum, line) => sum + (Number(line.actualKg) || 0), 0)
  const sessionsOfPen = Math.max(ration?.sessionsPerDay ?? 3, 1)
  const duplicate = selectedPen && data.records.find((record) => record.status === 'VALID' && record.penId === selectedPen.id && record.feedingDate === date && record.sessionNo === sessionValue)

  const submit = async () => {
    if (saving) return
    if (!selectedPen) return setError('Chuồng là bắt buộc.')
    if (duplicate) return setError(`${selectedPen.code} đã có bản ghi ${sessionLabel(sessionValue).toLocaleLowerCase('vi')} ngày ${formatDate(date)}.`)
    if (!fedBy.trim()) return setError('Người cho ăn là bắt buộc.')
    if (!time) return setError('Nhập giờ cho ăn.')
    if (!lines.length || lines.some((line) => !line.feedItemId)) return setError('Chọn thức ăn cho từng dòng.')
    for (const line of lines) {
      const feed = data.feeds.find((row) => row.feedItemId === Number(line.feedItemId))
      if (feed && Number(line.actualKg) > feed.onHandKg) return setError(`${feed.name}: chỉ còn ${formatNumber(feed.onHandKg)} kg trong kho.`)
    }
    if (leftover && (!Number.isFinite(Number(leftover)) || Number(leftover) < 0)) return setError('Thức ăn thừa phải là số không âm.')
    setSaving(true)
    setError('')
    try {
      const payload: FeedFeedingDraftInput = {
        penId: selectedPen.id, feedingDate: date, sessionNo: sessionValue, time, fedBy, leftoverKg: leftover ? Number(leftover) : null, note,
        rationCode: ration?.rationCode ?? null, rationVersion: ration?.versionNo ?? null,
        lines: lines.map((line): FeedFeedingLineInput => ({ feedItemId: Number(line.feedItemId), plannedKg: Number(line.plannedKg), actualKg: Number(line.actualKg), inRation: line.inRation })),
      }
      await recordFeedSessionDemo(payload)
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
        <Field label="Giờ cho ăn" id="feeding-form-time"><input id="feeding-form-time" type="time" disabled={saving} value={time} onChange={(event) => setTime(event.target.value)} className={inputCls} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Khẩu phần áp dụng" id="feeding-form-ration"><input id="feeding-form-ration" readOnly value={ration ? `${ration.rationCode} · ${ration.name}` : selectedPen ? 'Chưa có khẩu phần hiệu lực' : ''} className={inputCls} /></Field>
        <Field label="Người cho ăn" id="feeding-form-fedby">
          <input id="feeding-form-fedby" list="feeding-people" maxLength={100} disabled={saving} value={fedBy} onChange={(event) => setFedBy(event.target.value)} className={inputCls} />
          <datalist id="feeding-people">{KNOWN_PEOPLE.map((name) => <option key={name} value={name} />)}</datalist>
        </Field>
      </div>
      {selectedPen && !ration && <Note tone="warn">Chuồng {selectedPen.code} chưa có khẩu phần hiệu lực vào ngày {formatDate(date)}. Chỉ nhập thức ăn thực tế.</Note>}
      <h3 className="m-0 text-[13px] font-semibold">Thức ăn đã cho (kế hoạch = khẩu phần × {selectedPen?.headcount ?? 0} con)</h3>
      <Table scroll stack={false}>
        <thead><tr><Th>Thức ăn</Th><Th>Kế hoạch</Th><Th>Thực tế *</Th><Th>Tồn kho hiện có</Th><Th aria-label="Xóa" /></tr></thead>
        <tbody>
          {lines.map((line, index) => {
            const feed = data.feeds.find((row) => row.feedItemId === Number(line.feedItemId))
            const perHead = selectedPen?.headcount && Number(line.plannedKg) ? Number(line.plannedKg) / selectedPen.headcount : null
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
                    <input aria-label={`Lượng thực tế dòng ${index + 1}`} type="number" min="0" step="0.1" disabled={saving} value={line.actualKg} onChange={(event) => updateLine(index, 'actualKg', event.target.value)} className={`${inputCls} pr-9`} />
                    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">kg</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{feed ? formatKg(feed.onHandKg, 1) : '—'}</Td>
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
      <button type="button" disabled={saving} onClick={() => setLines((current) => [...current, { feedItemId: '', plannedKg: '0', actualKg: '0', inRation: false }])} className="mx-auto inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-brand">
        <Icon name="circle-plus" size={16} />Thêm thức ăn ngoài khẩu phần
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Thức ăn thừa (kg)" id="feeding-form-leftover"><input id="feeding-form-leftover" type="number" min="0" step="0.1" disabled={saving} value={leftover} onChange={(event) => setLeftover(event.target.value)} className={inputCls} /></Field>
        <Field label="Ghi chú" id="feeding-form-note"><input id="feeding-form-note" maxLength={500} disabled={saving} value={note} onChange={(event) => setNote(event.target.value)} className={inputCls} /></Field>
      </div>
      <Note tone="info">Lưu sẽ trừ kho {formatNumber(actualTotal)} kg{selectedPen?.headcount ? ` (${formatNumber(actualTotal / selectedPen.headcount)} kg/con)` : ''}.</Note>
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton disabled={saving || !lines.length} onClick={() => setLines((current) => current.map((line) => ({ ...line, actualKg: line.plannedKg })))}>Điền theo kế hoạch</ModalButton>
        <ModalButton disabled={saving} onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang ghi…' : 'Lưu & trừ kho'}</ModalButton>
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
        await voidFeedSessionDemo(record.id, reason)
        onSaved(`Đã hủy bản ghi ${record.penCode} (${SESSION_NAMES[record.sessionNo] ?? record.sessionNo}). Đã hoàn ${formatNumber(record.actualTotalKg)} kg vào kho.`)
      } else {
        await correctFeedSessionDemo(record.id, {
          expectedVersion: record.version,
          reason,
          lines: record.lines.map((line, index): FeedFeedingLineInput => ({ feedItemId: line.feedItemId, plannedKg: line.plannedKg, actualKg: Number(values[index]) || 0, inRation: line.inRation === true })),
        })
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
      sub={`${record.penName ?? record.penCode} · ${sessionLabel(record.sessionNo)} ${formatDate(record.feedingDate)} ${record.time ?? ''} · ghi bởi ${shortPersonName(record.recordedBy ?? record.fedBy)}${record.recordedAt ? ` lúc ${record.recordedAt.slice(11, 16)}` : ''}`}
      topTitle="Thức ăn › Nhật ký cho ăn"
      width={700}
      onClose={onClose}
    >
      {error && <div role="alert" className="rounded-md bg-err-bg px-3 py-2.5 text-xs text-err-fg">{error}</div>}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <span className="text-xs font-medium">Thao tác *</span>
        <Radio name="feeding-action" checked={action === 'correct'} onChange={() => setAction('correct')}>Sửa số lượng</Radio>
        <Radio name="feeding-action" checked={action === 'void'} onChange={() => setAction('void')}>Hủy bản ghi</Radio>
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
                    <input aria-label={`Giá trị mới ${line.feedCode}`} type="number" min="0" step="0.1" disabled={saving} value={values[index]} onChange={(event) => { setValues((current) => current.map((value, i) => i === index ? event.target.value : value)); setError('') }} className={`${inputCls} pr-9`} />
                    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">kg</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{diffs[index] === 0 ? '0' : `${diffs[index] > 0 ? 'trừ thêm' : 'hoàn lại'} ${formatNumber(Math.abs(diffs[index]))} kg`}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Field label="Lý do *" id="feeding-correct-reason"><Textarea id="feeding-correct-reason" maxLength={500} value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} /></Field>
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

/** "Ghi nhanh theo khẩu phần": fills the selected empty sessions with the planned quantities for review, then records them. */
export function FeedQuickFillDialog({ data, date, missing, onClose, onSaved }: {
  data: FeedingData
  date: string
  missing: Array<{ pen: FeedRationPenOption; sessionNo: number }>
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const session = useSession()
  const key = (item: { pen: FeedRationPenOption; sessionNo: number }) => `${item.pen.id}:${item.sessionNo}`
  const [selected, setSelected] = useState(() => new Set(missing.map(key)))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const rows = missing.map((item) => {
    const ration = effectiveRationForPen(data.rations, item.pen.id, date)
    const plan = planForSession(ration, item.pen, item.sessionNo)
    return { ...item, ration, plan, total: Math.round(plan.reduce((sum, line) => sum + line.plannedKg, 0) * 10) / 10 }
  })

  const submit = async () => {
    const chosen = rows.filter((row) => selected.has(key(row)))
    if (!chosen.length) return setError('Chọn ít nhất một cữ để ghi.')
    setSaving(true)
    setError('')
    let done = 0
    const failures: string[] = []
    for (const row of chosen) {
      try {
        await recordFeedSessionDemo({
          penId: row.pen.id, feedingDate: date, sessionNo: row.sessionNo, time: sessionTimeFor(data.rations, row.sessionNo), fedBy: session?.fullName ?? KNOWN_PEOPLE[0],
          leftoverKg: null, note: '', rationCode: row.ration?.rationCode ?? null, rationVersion: row.ration?.versionNo ?? null,
          lines: row.plan.map((line) => ({ feedItemId: line.feedItemId, plannedKg: line.plannedKg, actualKg: line.plannedKg, inRation: true })),
        })
        done += 1
      } catch (saveError) {
        failures.push(`${row.pen.code} (${SESSION_NAMES[row.sessionNo]}): ${userFacingError(saveError, 'không ghi được')}`)
      }
    }
    setSaving(false)
    if (failures.length) setError(`Đã ghi ${done} cữ. Chưa ghi được: ${failures.join('; ')}`)
    if (done > 0 && !failures.length) onSaved(`Đã ghi ${done} cữ theo khẩu phần. Tồn kho đã được trừ theo lượng kế hoạch.`)
    else if (done > 0) onSaved(`Đã ghi ${done} cữ theo khẩu phần; ${failures.length} cữ chưa ghi được: ${failures.join('; ')}`)
  }

  return (
    <Modal title="Ghi nhanh theo khẩu phần" sub={`Ngày ${formatDate(date)} · điền lượng kế hoạch vào các cữ chưa ghi để kiểm tra rồi lưu`} topTitle="Thức ăn › Nhật ký cho ăn" width={700} onClose={onClose}>
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
      <Note tone="info">Cữ thiếu tồn kho sẽ không ghi được; hãy ghi riêng từng cữ và nhập lượng thực tế.</Note>
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton disabled={saving} onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="primary" disabled={saving || !rows.length} onClick={() => void submit()}>{saving ? 'Đang ghi…' : `Ghi ${selected.size} cữ theo kế hoạch`}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

