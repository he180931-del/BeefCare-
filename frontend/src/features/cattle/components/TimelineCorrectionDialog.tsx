import { useId, useRef, useState, type FormEvent } from 'react'
import { backendFarmId, backendTransport } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Button, Field, Note, Select, inputCls } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { catalogueApi } from '../../farm-catalogue/api/catalogueApi'
import type { CattleEvent } from '../../../types'

type Options = ReadonlyArray<readonly [string, string]>
type FieldDefinition = {
  key: string
  label: string
  kind?: 'date' | 'datetime-local' | 'vaccine' | 'boolean'
  options?: Options
  max?: number
}

const occurredAt: FieldDefinition = { key: 'occurredAt', label: 'Thời điểm xảy ra', kind: 'datetime-local' }
const sourceFields: Record<string, { path: string; fields: FieldDefinition[] }> = {
  VACCINATION_RECORD: { path: '/vaccinations', fields: [
    { key: 'vaccineId', label: 'Vắc-xin', kind: 'vaccine' },
    { key: 'dose', label: 'Liều', max: 255 }, { key: 'route', label: 'Đường tiêm', max: 255 },
    { key: 'vaccinator', label: 'Người tiêm', max: 255 },
  ] },
  ESTRUS: { path: '/reproduction-events', fields: [
    occurredAt, { key: 'description', label: 'Biểu hiện', max: 500 }, { key: 'observer', label: 'Người quan sát', max: 255 },
  ] },
  BREEDING: { path: '/reproduction-events', fields: [
    occurredAt, { key: 'method', label: 'Phương pháp', options: [['AI', 'Thụ tinh nhân tạo'], ['NATURAL', 'Phối tự nhiên']] },
    { key: 'performedBy', label: 'Người thực hiện', max: 255 },
  ] },
  PREGNANCY_CHECK: { path: '/reproduction-events', fields: [
    occurredAt, { key: 'method', label: 'Phương pháp', options: [['ULTRASOUND', 'Siêu âm'], ['RECTAL', 'Khám trực tràng'], ['OTHER', 'Khác']] },
    { key: 'result', label: 'Kết quả', options: [['PREGNANT', 'Có thai'], ['NOT_PREGNANT', 'Không có thai'], ['INCONCLUSIVE', 'Chưa kết luận']] },
    { key: 'examiner', label: 'Người khám', max: 255 },
  ] },
  PREGNANCY_UPDATE: { path: '/pregnancy-updates', fields: [
    occurredAt, { key: 'details', label: 'Chi tiết', max: 500 },
  ] },
  CALVING_EVENT: { path: '/calvings', fields: [
    { key: 'birthTime', label: 'Thời điểm đẻ', kind: 'datetime-local' },
    { key: 'source', label: 'Nguồn ghi nhận', options: [['DIRECT_OBSERVATION', 'Quan sát trực tiếp'], ['FARM_NOTEBOOK', 'Sổ trại'], ['EXTERNAL_REPORT', 'Báo cáo bên ngoài']] },
    { key: 'course', label: 'Diễn biến', options: [['NORMAL', 'Bình thường'], ['ASSISTED', 'Có hỗ trợ'], ['CAESAREAN', 'Mổ đẻ']] },
    { key: 'damCondition', label: 'Tình trạng bò mẹ', options: [['GOOD', 'Tốt'], ['NEEDS_MONITORING', 'Cần theo dõi'], ['CRITICAL', 'Nguy kịch']] },
    { key: 'retainedPlacenta', label: 'Sót nhau', kind: 'boolean', options: [['true', 'Có'], ['false', 'Không']] },
    { key: 'attendant', label: 'Người hỗ trợ', max: 255 },
  ] },
}

type EditableEvent = CattleEvent & { sourceId: number; sourceType: string; revisionSource: NonNullable<CattleEvent['revisionSource']> }

export function hasTimelineCorrection(event: CattleEvent): event is EditableEvent {
  return event.sourceId != null && !!event.revisionSource && !!event.sourceType && Object.hasOwn(sourceFields, event.sourceType)
}

function fieldValue(field: FieldDefinition, source: EditableEvent['revisionSource']): string {
  const value = source.values[field.key] ?? (field.key === 'occurredAt' || field.key === 'birthTime' ? source.occurredAt : null)
  if (value == null) return ''
  if (field.kind !== 'datetime-local') return String(value)
  const date = new Date(String(value))
  if (!Number.isFinite(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export default function TimelineCorrectionDialog({ event, onClose, onSaved }: {
  event: EditableEvent; onClose: () => void; onSaved: () => void
}) {
  const [action, setAction] = useState<'correction' | 'void'>('correction')
  const [reason, setReason] = useState('')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const reasonId = useId()
  const lastCommand = useRef<{ signature: string; key: string } | null>(null)
  const { revisionSource } = event
  const config = sourceFields[event.sourceType]
  const vaccination = event.sourceType === 'VACCINATION_RECORD'
  const onFarm = revisionSource.values.source === 'ON_FARM'
  const fields: FieldDefinition[] = !vaccination ? config.fields : [
    ...config.fields,
    ...(onFarm ? [
      { key: 'administeredAt', label: 'Thời điểm tiêm', kind: 'datetime-local' as const },
      { key: 'batchNo', label: 'Số lô', max: 50 },
    ] : [{ key: 'vaccinationDate', label: 'Ngày tiêm', kind: 'date' as const }]),
  ]
  const vaccines = useQuery(async () => vaccination ? catalogueApi.listVaccines({ status: 'ACTIVE' }) : [], [vaccination])
  const currentVaccine = String(revisionSource.values.vaccineId ?? '')
  const vaccineOptions: Options = [
    ...(currentVaccine && !vaccines.data?.some((item) => String(item.id) === currentVaccine)
      ? [[currentVaccine, String(revisionSource.values.vaccine ?? 'Vắc-xin hiện tại')] as const] : []),
    ...(vaccines.data ?? []).map((item) => [String(item.id), item.name] as const),
  ]

  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault()
    if (busy) return
    if (!reason.trim()) return setError('Vui lòng nhập lý do.')
    const changes: Record<string, unknown> = {}
    if (action === 'correction') {
      for (const field of fields) {
        const edit = edits[field.key]?.trim()
        if (edit === undefined || edit === fieldValue(field, revisionSource)) continue
        if (!edit && (vaccination || field.kind || field.options)) return setError(`Vui lòng nhập ${field.label.toLowerCase()}.`)
        if (field.kind === 'datetime-local') {
          const date = new Date(edit)
          if (!Number.isFinite(date.getTime())) return setError('Thời điểm không hợp lệ.')
          changes[field.key] = date.toISOString()
        } else {
          changes[field.key] = field.kind === 'vaccine' ? Number(edit) : field.kind === 'boolean' ? edit === 'true' : edit
        }
      }
      if (!Object.keys(changes).length) return setError('Vui lòng thay đổi ít nhất một trường.')
    }
    const payload = { expectedVersion: revisionSource.version, reason: reason.trim(), ...changes }
    const signature = JSON.stringify([action, payload])
    setError('')
    setBusy(true)
    try {
      if (lastCommand.current?.signature !== signature) lastCommand.current = { signature, key: crypto.randomUUID() }
      await backendTransport.command(backendTransport.farmPath(backendFarmId, `${config.path}/${event.sourceId}/${action}`), payload, { key: lastCommand.current.key })
      onSaved()
    } catch (failure) {
      setError(userFacingError(failure, 'Không cập nhật được bản ghi.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Sửa hoặc hủy bản ghi" sub={event.title} onClose={() => { if (!busy) onClose() }}>
      <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
        <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <Field label="Thao tác">
            <Select aria-label="Thao tác" value={action} onChange={(e) => setAction(e.target.value === 'void' ? 'void' : 'correction')}>
              <option value="correction">Sửa bản ghi</option>
              <option value="void">Hủy bản ghi</option>
            </Select>
          </Field>
          {action === 'void' ? <Note tone="warn">Bản ghi đã hủy sẽ được lưu trong lịch sử chỉnh sửa.</Note> : fields.map((field) => {
            const value = edits[field.key] ?? fieldValue(field, revisionSource)
            const update = (next: string) => setEdits((previous) => ({ ...previous, [field.key]: next }))
            const options = field.kind === 'vaccine' ? vaccineOptions : field.options
            return <Field key={field.key} label={field.label}>
              {options ? <Select aria-label={field.label} value={value} onChange={(e) => update(e.target.value)}>
                {!value && <option value="">Chưa chọn</option>}
                {value && !options.some(([code]) => code === value) && <option value={value}>{value}</option>}
                {options.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </Select> : <input aria-label={field.label} className={inputCls} type={field.kind ?? 'text'} value={value} maxLength={field.max} onChange={(e) => update(e.target.value)} />}
            </Field>
          })}
          {vaccination && action === 'correction' && Boolean(vaccines.error) && <Note tone="warn">Không tải được danh mục vắc-xin. Bạn vẫn có thể sửa các trường khác.</Note>}
          <Field id={reasonId} label="Lý do *">
            <textarea id={reasonId} aria-label="Lý do" className={inputCls} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </fieldset>
        {error && <Note tone="err">{error}</Note>}
        <ModalFooter>
          <ModalButton disabled={busy} onClick={onClose}>Đóng</ModalButton>
          <Button type="submit" size="lg" variant={action === 'void' ? 'danger' : 'primary'} disabled={busy}>{action === 'void' ? 'Xác nhận hủy bản ghi' : 'Lưu chỉnh sửa'}</Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
