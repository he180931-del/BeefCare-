import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, Card, DateInput, ErrorBlock, Field, Foot, LoadingBlock, Note, Select } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { useCatalogueApi } from '../api/useCatalogueApi'
import { HeaderActions } from '../components/CatalogueShell'
import { TextInput, UnitInput, fieldError } from '../components/fields'
import { useCanEdit } from '../components/useCanEdit'
import { VersionHistoryDialog } from '../components/VersionHistoryDialog'
import { FieldErrors, formatDate, numberToText, parseNumber, todayIso, type FieldErrorMap } from '../domain/catalogueRules'
import { BCS_SCALES, DEFAULT_PARAMETERS, PARAMETER_GROUPS, rangeHint, validateParameterVersion, versionSavedMessage, type ParameterFieldDef } from '../domain/parameterRules'
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
  const catalogueApi = useCatalogueApi()
  const canEdit = useCanEdit()
  const navigate = useNavigate()
  const [modalName, , closeModal] = useModalParam()
  const { data, error, refetch } = useQuery(() => catalogueApi.listParameterVersions(), [])
  const [draft, setDraft] = useState<ParameterDraft | null>(null)
  const [baseVersion, setBaseVersion] = useState(0)
  const [source, setSource] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso())
  const [errors, setErrors] = useState<FieldErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const current = data?.find((v) => v.status === 'CURRENT')
  useEffect(() => {
    if (!data || draft) return
    setBaseVersion(data.reduce((latest, version) => Math.max(latest, version.versionNo), 0))
    setDraft(toDraft(current?.parameters ?? DEFAULT_PARAMETERS))
  }, [data, current, draft])

  const clearError = (key: string) => setErrors((e) => {
    if (!(key in e)) return e
    const { [key]: _removed, ...rest } = e
    return rest
  })
  const setValue = (key: NumericParameterKey, value: string) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
    clearError(key)
  }

  async function submit() {
    if (!draft || !canEdit || saving) return
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
      const saved = await catalogueApi.saveParameterVersion(command, session?.fullName)
      setNotice(versionSavedMessage(saved.versionNo, saved.effectiveFrom)) // MSG-FE18-05
      setBaseVersion(saved.versionNo)
      setDraft(toDraft(saved.status === 'SCHEDULED' ? current?.parameters ?? DEFAULT_PARAMETERS : saved.parameters))
      setSource('')
      setEffectiveFrom(todayIso())
      refetch()
    } catch (e) {
      setNotice(null)
      if (e instanceof FieldErrors) {
        setErrors(e.fields)
        if (Object.keys(e.fields).join() === 'sourceNote') document.getElementById('param-source')?.focus()
      } else {
        setFormError(userFacingError(e, 'Không lưu được phiên bản. Vui lòng thử lại.'))
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
      {canEdit && <Button variant="primary" disabled={saving || !draft} onClick={() => void submit()}>Lưu phiên bản mới</Button>}
    </HeaderActions>
  )

  if (error) return <>{actions}<ErrorBlock message={userFacingError(error, 'Không tải được tham số trại.')} onRetry={refetch} /></>
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-edge bg-white px-3.5 py-2.5">
        {current ? (
          <>
            <Badge tone="ok">{`v${current.versionNo} · đang áp dụng`}</Badge>
            <span className="text-xs text-ink">Áp dụng từ {formatDate(current.effectiveFrom)} · Nguồn: {current.sourceNote} · lưu bởi {current.savedBy}</span>
          </>
        ) : <Badge tone="info">Chưa có phiên bản đang áp dụng</Badge>}
        <span className="text-[11px] text-muted lg:ml-auto">Gợi ý chỉ hỗ trợ quyết định, không tự tạo sự kiện hay đổi trạng thái</span>
      </div>
      {scheduled && <Note tone="info">{`Đã lên lịch phiên bản v${scheduled.versionNo}, áp dụng từ ${formatDate(scheduled.effectiveFrom)}.`}</Note>}

      <div className="grid items-stretch gap-3.5 lg:grid-cols-2">
        {PARAMETER_GROUPS.map((g) => (
          <Card key={g.id} title={g.title} sub={g.sub}>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${g.minCol}px, 1fr))` }}>
              {g.hasBcs && (
                <Field label="Thang BCS *" id="param-bcs" hint={fieldError(errors.bcsScale)}>
                  <Select id="param-bcs" value={draft.bcsScale} disabled={!canEdit} onChange={(e) => { setDraft({ ...draft, bcsScale: e.target.value as BcsScale }); clearError('bcsScale') }}>
                    {BCS_SCALES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </Select>
                </Field>
              )}
              {g.fields.map(renderField)}
            </div>
          </Card>
        ))}
      </div>

      {canEdit && (
        <Card title="Lưu phiên bản mới" sub="Bắt buộc ghi nguồn; phiên bản cũ vẫn được giữ để tra cứu">
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
                <DateInput id="param-effective" value={effectiveFrom} onChange={(v) => { setEffectiveFrom(v); clearError('effectiveFrom') }} />
              </Field>
            </div>
            <Button type="submit" variant="primary" className="mt-[26px]" disabled={saving}>Lưu phiên bản mới</Button>
          </form>
        </Card>
      )}

      <Foot>Chủ trại và Quản lý có thể lưu phiên bản tham số mới kèm nguồn và ngày áp dụng. Giá trị ngoài khoảng cho phép được báo dưới ô nhập.</Foot>
      {showHistory && <VersionHistoryDialog versions={data} onClose={closeHistory} />}
    </>
  )
}
