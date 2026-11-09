import { useEffect, useMemo, useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { DateInput, Field, KV, Note, Select, Table, Td, Textarea, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { penApi, type MoveCattle, type PenMoveCheckResult } from '../api/penApi'
import { CRITERION_LABELS, dmy, todayIso, type CriterionType } from '../domain/penRules'
import { cx, TH } from './parts'
import type { Pen } from '../../../types'

const OUTCOME_TEXT = { MET: 'Đạt', NOT_MET: 'Không đạt', NOT_APPLICABLE: 'Không áp dụng' } as const
const OUTCOME_TONE = { MET: 'text-brand', NOT_MET: 'text-err-fg', NOT_APPLICABLE: 'text-muted' } as const

/** Per-cattle blocking errors of the reception check (R-04-08, R-04-10, R-04-12). */
function cattleErrorText(error: { code?: string; params?: Record<string, unknown> }, code: string): string {
  switch (error.code) {
    case 'MSG-COM-13': return `${code} đã xuất đàn hoặc bị hủy, chỉ được xem.`
    case 'MSG-COM-17': return `${code} đang trên phiếu xuất (chết / mất tích) chờ duyệt nên không chuyển được.`
    case 'MSG-FE04-09': return `Ngày chuyển của ${code} phải từ ${dmy(String(error.params?.start_date ?? ''))} đến hôm nay.`
    case 'MSG-COM-05': return `Thông tin của ${code} đã thay đổi. Vui lòng tải lại rồi thử lại.`
    default: return `${code} không chuyển được (${error.code ?? 'lỗi'}).`
  }
}

/**
 * Move Pen popup (UC-FE04-05) opened from SCR-17 for the selected cattle. The reception check (A6) is re-run on every
 * destination / date change; the backend checks everything again on confirm (R-04-12) and moves all or nothing.
 */
export default function MoveDialog({ from, cattle, pens, onClose, onMoved, today = todayIso() }: { from: Pen; cattle: MoveCattle[]; pens: Pen[]; onClose: () => void; onMoved: (message: string) => void; today?: string }) {
  const destinations = pens.filter((p) => p.status === 'ACTIVE' && p.code !== from.code)
  const [toCode, setToCode] = useState('')
  const [date, setDate] = useState(today)
  const [reason, setReason] = useState('')
  const [warnings, setWarnings] = useState<Record<string, string>>({})
  const [check, setCheck] = useState<PenMoveCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [tried, setTried] = useState(false)
  const to = destinations.find((p) => p.code === toCode)

  useEffect(() => {
    if (!to || !date) { setCheck(null); return }
    let active = true
    setChecking(true)
    setCheckError('')
    penApi.checkMove(cattle, from, to, date)
      .then((result) => { if (active) setCheck(result) })
      .catch((e: unknown) => { if (active) { setCheck(null); setCheckError(userFacingError(e, 'Không kiểm tra được điều kiện nhận bò.')) } })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [to, date, cattle, from])

  const rows = check?.cattle ?? []
  const moving = rows.filter((r) => !r.alreadyInDestination)
  const rowErrors = moving.filter((r) => r.error)
  const needWarning = moving.filter((r) => !r.error && r.warningReasonRequired)
  const latestStart = rows.map((r) => r.currentFromDate).filter((d): d is string => !!d).sort().at(-1)
  const dateError = !date ? 'Vui lòng nhập Ngày chuyển.' : date > today || (latestStart != null && date < latestStart)
    ? `Ngày chuyển phải từ ${latestStart ? dmy(latestStart) : '…'} đến hôm nay.`
    : ''
  const reasonError = !reason.trim() ? 'Vui lòng nhập Lý do.' : reason.trim().length > 500 ? 'Lý do tối đa 500 ký tự.' : ''
  const missingWarnings = needWarning.filter((r) => !(warnings[r.cattleCode] ?? '').trim())
  const blockText = check?.blocked
    ? `${to?.code ?? ''} không nhận được ${check.movingCount} con: chuồng đã ngưng hoặc chỉ còn ${check.destinationActive ? check.freePlaces : 0} chỗ trống.`
    : ''
  const canConfirm = !!to && !!check && !checking && !saving && !check.blocked && rowErrors.length === 0 && moving.length > 0
    && !dateError && !reasonError && missingWarnings.length === 0

  const criteriaRows = useMemo(() => {
    const types = new Set<string>()
    rows.forEach((r) => r.results.forEach((res) => types.add(res.criterion)))
    return [...types]
  }, [rows])

  const confirm = async () => {
    setTried(true)
    if (!canConfirm || !to) return
    setSaving(true)
    setSaveError('')
    try {
      const result = await penApi.move({ cattle, from, to, moveDate: date, reason: reason.trim(), warningReasons: warnings })
      onMoved(`Đã chuyển ${result.moved} con sang ${to.code}.`)
    } catch (e) {
      setSaveError(userFacingError(e, 'Không chuyển được chuồng. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Chuyển chuồng – ${cattle.length} con`} topTitle="Chuyển chuồng" sub={cattle.map((c) => c.code).join(', ')} width={760} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KV k="Chuồng hiện tại">{from.code} – {from.name} · {from.count}/{from.capacity}</KV>
        <Field label="Chuồng đích *">
          <Select value={toCode} onChange={(e) => setToCode(e.target.value)} aria-label="Chuồng đích">
            <option value="">Chọn chuồng đích</option>
            {destinations.map((p) => <option key={p.code} value={p.code}>{`${p.code} – ${p.name} · ${p.count}/${p.capacity}`}</option>)}
          </Select>
          {tried && !to && <span className="text-[11px] text-err-fg">Vui lòng chọn Chuồng đích.</span>}
        </Field>
        <Field label="Ngày chuyển *">
          <DateInput value={date} onChange={setDate} />
          {dateError && (tried || date > today || !!latestStart) && <span className="text-[11px] text-err-fg">{dateError}</span>}
        </Field>
        <KV k="Người thực hiện">Bạn (người đang đăng nhập)</KV>
        <div className="sm:col-span-2">
          <Field label="Lý do *">
            <Textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder='Nhập "Correction" khi chuyển ngược để sửa nhầm' />
            {tried && reasonError && <span className="text-[11px] text-err-fg">{reasonError}</span>}
          </Field>
        </div>
      </div>

      <p className="m-0 text-[14px] font-semibold text-[#212121]">Kiểm tra nhận bò</p>
      {checking && <Note>Đang kiểm tra…</Note>}
      {checkError && <Note tone="err">{checkError}</Note>}
      {blockText && <Note tone="err">{blockText}</Note>}
      {rowErrors.map((r) => <Note key={r.cattleCode} tone="err">{cattleErrorText(r.error!, r.cattleCode)}</Note>)}
      {rows.filter((r) => r.alreadyInDestination).map((r) => <Note key={r.cattleCode} tone="warn">{`${r.cattleCode} đã ở ${to?.code ?? ''} và sẽ được bỏ qua.`}</Note>)}

      {check && to && (
        <Table stack={false}>
          <thead>
            <tr>
              <Th className={cx(TH, 'w-[260px]')}>Kiểm tra</Th>
              {moving.map((r) => <Th key={r.cattleCode} className={TH}>{r.cattleCode}</Th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td className={TH}>{`Chuồng đích ACTIVE và còn ${check.freePlaces} chỗ`}</Td>
              {moving.map((r) => (
                <Td key={r.cattleCode} className={cx(TH, check.blocked ? OUTCOME_TONE.NOT_MET : OUTCOME_TONE.MET)}>{check.blocked ? 'Không đạt' : 'Đạt'}</Td>
              ))}
            </tr>
            {criteriaRows.map((criterion) => (
              <tr key={criterion}>
                <Td className={TH}>{CRITERION_LABELS[criterion as CriterionType] ?? criterion}</Td>
                {moving.map((r) => {
                  const res = r.results.find((x) => x.criterion === criterion)
                  const outcome = res?.outcome ?? 'NOT_APPLICABLE'
                  return (
                    <Td key={r.cattleCode} className={cx(TH, OUTCOME_TONE[outcome])} title={res?.expected ? `Yêu cầu ${res.expected}${res.actual ? ` · thực tế ${res.actual}` : ''}` : undefined}>
                      {OUTCOME_TEXT[outcome]}
                    </Td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {needWarning.map((r) => (
        <Field key={r.cattleCode} label={`Lý do cảnh báo – ${r.cattleCode} *`}>
          <Note tone="warn">{`${r.cattleCode} không đạt tiêu chí nhận bò của ${to?.code ?? ''}. Nhập lý do để tiếp tục.`}</Note>
          <Textarea
            rows={2}
            maxLength={500}
            value={warnings[r.cattleCode] ?? ''}
            onChange={(e) => setWarnings((current) => ({ ...current, [r.cattleCode]: e.target.value }))}
          />
          {tried && !(warnings[r.cattleCode] ?? '').trim() && <span className="text-[11px] text-err-fg">Vui lòng nhập Lý do cảnh báo.</span>}
        </Field>
      ))}

      <ModalFooter>
        <div className="mr-auto min-w-0 flex-1" role="status" aria-live="polite">
          {saveError && <span className="text-sm text-err-fg">{saveError}</span>}
        </div>
        <ModalButton onClick={onClose} disabled={saving}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!canConfirm} onClick={confirm}>{saving ? 'Đang chuyển…' : 'Xác nhận chuyển'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
