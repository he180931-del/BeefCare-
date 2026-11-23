import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalogueError } from '../api/catalogueError'
import { Badge, Button, DateInput, ErrorBlock, Field, Foot, Icon, LoadingBlock, Note, Panel, Select } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { useSession } from '../../../app/session/sessionContext'
import { useCatalogueParametersUseCase } from '../hooks/useCatalogueUseCase'
import { HeaderActions } from '../components/CatalogueShell'
import { TextInput, UnitInput, fieldError } from '../components/fields'
import { useCanEdit } from '../hooks/useCanEdit'
import { VersionHistoryDialog } from '../components/VersionHistoryDialog'
import { FieldErrors, formatDate, numberToText, parseNumber, todayIso, type FieldErrorMap } from '../domain/catalogueRules'
import { BCS_SCALES, DEFAULT_PARAMETERS, PARAMETER_GROUPS, effectiveVersion, rangeHint, versionSavedMessage, type ParameterFieldDef } from '../domain/parameterRules'
import { validateParameterVersion } from '../validation/parameterValidation'
import { NUMERIC_PARAMETER_KEYS, type BcsScale, type NumericParameterKey, type ParameterValues } from '../types'

type ParameterDraft = Record<NumericParameterKey, string> & { bcsScale: BcsScale }

const toDraft = (p: ParameterValues): ParameterDraft => ({
  ...(Object.fromEntries(NUMERIC_PARAMETER_KEYS.map((k) => [k, numberToText(p[k])])) as Record<NumericParameterKey, string>),
  bcsScale: p.bcsScale,
})
const fromDraft = (d: ParameterDraft): ParameterValues => ({
  ...(Object.fromEntries(NUMERIC_PARAMETER_KEYS.map((k) => [k, parseNumber(d[k])])) as Record<NumericParameterKey, number | null>),
  bcsScale: d.bcsScale,
})

export default function ParametersPage({ historyOpen = false }: { historyOpen?: boolean }) {
  const session = useSession()
  const canEdit = useCanEdit()
  const navigate = useNavigate()
  const [modalName, , closeModal] = useModalParam()
  const { data, error, loading, refetch, saveParameterVersion } = useCatalogueParametersUseCase()
  const [baseVersion, setBaseVersion] = useState<number | null>(null)
  const [edited, setEdited] = useState<Partial<ParameterDraft>>({})
  const [source, setSource] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso())
  const [errors, setErrors] = useState<FieldErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const current = data?.find((v) => v.status === 'CURRENT')
  const baseline = effectiveVersion(data ?? [], effectiveFrom)
  const draft = data ? { ...toDraft(baseline?.parameters ?? DEFAULT_PARAMETERS), ...edited } : null
  useEffect(() => {
    if (!data || baseVersion !== null) return
    setBaseVersion(data.reduce((latest, version) => Math.max(latest, version.versionNo), 0))
  }, [data, baseVersion])

  const clearError = (key: string) => setErrors((e) => {
    if (!(key in e)) return e
    const { [key]: _removed, ...rest } = e
    return rest
  })
  const setValue = (key: NumericParameterKey, value: string) => {
    setEdited((fields) => ({ ...fields, [key]: value }))
    clearError(key)
  }
  const changeEffectiveDate = (date: string) => {
    setEffectiveFrom(date)
    clearError('effectiveFrom')
  }

  async function submit() {
    if (!draft || baseVersion === null || !canEdit || saving || loading) return
    const parameters = fromDraft(draft)
    const command = { parameters, gestationLengthDays: parameters.gestationLengthDays, effectiveFrom, sourceNote: source, baseVersion }
    const validation = validateParameterVersion(command, todayIso())
    setErrors(validation)
    setFormError(null)
    setNotice(null)
    if (Object.keys(validation).length) {
      if (Object.keys(validation).join() === 'sourceNote') document.getElementById('param-source')?.focus()
      return
    }
    setSaving(true)
    try {
      const saved = await saveParameterVersion(command, session?.fullName)
      setNotice(versionSavedMessage(saved.versionNo, saved.effectiveFrom)) // MSG-FE18-05
      setBaseVersion(saved.versionNo)
      setEdited({})
      setSource('')
      setEffectiveFrom(todayIso())
      refetch()
    } catch (e) {
      setNotice(null)
      if (e instanceof FieldErrors) {
        setErrors(e.fields)
        if (Object.keys(e.fields).join() === 'sourceNote') document.getElementById('param-source')?.focus()
      } else {
        setFormError(catalogueError(e, 'Không lưu được phiên bản. Vui lòng thử lại.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const closeHistory = () => (historyOpen ? navigate('/danh-muc/tham-so') : closeModal())
  const showHistory = historyOpen || modalName === 'lich-su'

  const actions = (
    <HeaderActions>
      <Button className="inline-flex items-center gap-1.5" onClick={() => navigate('/danh-muc/tham-so/lich-su')}>
        <Icon name="history" size={16} />
        Lịch sử phiên bản
      </Button>
      {canEdit && <Button variant="primary" disabled={saving || loading || !draft} onClick={() => void submit()}>Lưu phiên bản mới</Button>}
    </HeaderActions>
  )

  if (error) return <>{actions}<ErrorBlock message={catalogueError(error, 'Không tải được tham số trại.')} onRetry={refetch} /></>
  if (!data || !draft) return <>{actions}<LoadingBlock /></>

  const scheduled = data.find((v) => v.status === 'SCHEDULED')

  const renderField = (f: ParameterFieldDef) => (
    <Field key={f.key} label={f.optional ? f.label : `${f.label} *`} id={`param-${f.key}`} hint={fieldError(errors[f.key], rangeHint(f))}>
      <UnitInput id={`param-${f.key}`} unit={f.unit} value={draft[f.key]} readOnly={!canEdit} invalid={Boolean(errors[f.key])} onChange={(v) => setValue(f.key, v)} />
    </Field>
  )

  return (
    <>
      {actions}
      {notice && <Note tone="ok"><span role="status">{notice}</span></Note>}
      {formError && <Note tone="err"><span role="alert">{formError}</span></Note>}
      {/* Phiên bản đang áp dụng là thông tin trạng thái tích cực (§3): nền xanh nhạt, luôn kèm nhãn chữ. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-ok-bg bg-ok-bg px-4 py-3">
        {current ? (
          <>
            <Badge tone="ok" className="border-white! bg-white!">{`v${current.versionNo} · đang áp dụng`}</Badge>
            <span className="text-xs text-ink">Áp dụng từ {formatDate(current.effectiveFrom)} · Nguồn: {current.sourceNote} · lưu bởi {current.savedBy}</span>
          </>
        ) : <Badge tone="info">Chưa có phiên bản đang áp dụng</Badge>}
        <span className="text-[11px] text-label lg:ml-auto">Gợi ý chỉ hỗ trợ quyết định, không tự tạo sự kiện hay đổi trạng thái</span>
      </div>
      {scheduled && <Note tone="info">{`Đã lên lịch phiên bản v${scheduled.versionNo}, áp dụng từ ${formatDate(scheduled.effectiveFrom)}.`}</Note>}

      {/* 6+6 khi vùng nội dung từ 880 px (laptop 1.280 px có sidebar), hẹp hơn mỗi nhóm một hàng. */}
      <div className="@container">
      <div className="grid items-stretch gap-4 @min-[880px]:grid-cols-2 @min-[1024px]:gap-6">
        {PARAMETER_GROUPS.map((g) => (
          <Panel key={g.id} title={<span className="text-base">{g.title}</span>} sub={g.sub}>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${g.minCol}px, 1fr))` }}>
              {g.hasBcs && (
                <Field label="Thang BCS *" id="param-bcs" hint={fieldError(errors.bcsScale)}>
                  <Select id="param-bcs" value={draft.bcsScale} disabled={!canEdit} onChange={(e) => {
                    const bcsScale = e.target.value as BcsScale
                    setEdited((fields) => ({ ...fields, bcsScale }))
                    clearError('bcsScale')
                  }}>
                    {BCS_SCALES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </Select>
                </Field>
              )}
              {g.fields.map(renderField)}
            </div>
          </Panel>
        ))}
      </div>
      </div>

      {canEdit && (
        <Panel title={<span className="text-base">Lưu phiên bản mới</span>} sub="Bắt buộc ghi nguồn; phiên bản cũ vẫn được giữ để tra cứu">
          <form
            noValidate
            className="flex flex-wrap items-start gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <div className="min-w-[240px] flex-[3]">
              <Field label="Ghi chú nguồn *" id="param-source" hint={fieldError(errors.sourceNote, 'Tối đa 255 ký tự')}>
                <TextInput id="param-source" value={source} placeholder="Ví dụ: Phỏng vấn chủ trại 20/09/2026" invalid={Boolean(errors.sourceNote)} onChange={(v) => { setSource(v); clearError('sourceNote') }} />
              </Field>
            </div>
            <div className="min-w-[180px] flex-1">
              <Field label="Áp dụng từ *" id="param-effective" hint={fieldError(errors.effectiveFrom, 'Từ hôm nay trở đi')}>
                <DateInput id="param-effective" value={effectiveFrom} onChange={changeEffectiveDate} />
              </Field>
            </div>
            <Button type="submit" variant="primary" className="mt-[26px]" disabled={saving}>Lưu phiên bản mới</Button>
          </form>
        </Panel>
      )}

      <Foot>Chủ trại và Quản lý có thể lưu phiên bản tham số mới kèm nguồn và ngày áp dụng. Giá trị ngoài khoảng cho phép được báo dưới ô nhập.</Foot>
      {showHistory && <VersionHistoryDialog versions={data} onClose={closeHistory} />}
    </>
  )
}
