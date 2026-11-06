import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Card, Field, Foot, Note, PageHeader, Select, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { useSession } from '../../authorization'
import { reproductionApi } from '../api/reproductionApi'
import { REPRODUCTION_BREEDS, REPRODUCTION_PENS, REPRODUCTION_PURPOSES } from '../data/reproductionMock'
import { ReproductionValidationError, calvingIssues, formatDate } from '../domain/reproductionRules'
import type { CalvingCommand, DataSource, ReproductionFemale, ReproductionIssue, ReproductionRole } from '../types'
import {
  COURSE_OPTIONS, DAM_CONDITION_OPTIONS, DateTimeField, PersonInput, RadioField, RadioRow, ReadOnlyField, SOURCE_HINT, SOURCE_OPTIONS, nowLocal,
} from '../components/reproductionFields'

interface CalfForm {
  outcome: 'LIVE' | 'STILLBORN'
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN'
  weightText: string
  weightBasis: 'MEASURED' | 'ESTIMATED' | ''
  earTag: string
  penId: string
  breed: string
  registration: 'DRAFT' | 'REGISTER_NOW'
  purpose: string
}

const blankCalf = (profile: ReproductionFemale): CalfForm => ({
  outcome: 'LIVE', sex: 'FEMALE', weightText: '', weightBasis: '', earTag: '', penId: profile.penId, breed: profile.breed, registration: 'DRAFT', purpose: 'UNDECIDED',
})
const DUPLICATE = /đã dùng cho|đã được sử dụng/
const backLink = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded border border-edge bg-white px-4 py-[9px] text-[13px] font-semibold text-[#212121] no-underline'

function toCommand(form: { birthAt: string; pregnancyId: string; dataSource: DataSource; attendant: string; course: string; damCondition: string; retainedPlacenta: boolean }, calves: CalfForm[], profile: ReproductionFemale): CalvingCommand {
  return {
    birthAt: form.birthAt, pregnancyId: form.pregnancyId || null, dataSource: form.dataSource, attendant: form.attendant,
    course: form.course as CalvingCommand['course'], damCondition: form.damCondition as CalvingCommand['damCondition'], retainedPlacenta: form.retainedPlacenta,
    calves: calves.map((calf): CalvingCommand['calves'][number] => {
      const weight = calf.weightText.trim() === '' ? null : Number(calf.weightText)
      const base = { outcome: calf.outcome, sex: calf.sex, weightKg: weight, weightBasis: calf.weightBasis || null }
      if (calf.outcome === 'STILLBORN') return base
      const pen = REPRODUCTION_PENS.find((item) => item.id === calf.penId)
      return { ...base, earTag: calf.earTag.trim(), penId: calf.penId, penCode: pen?.code ?? profile.penCode, breed: calf.breed, registration: calf.registration, productionPurpose: calf.registration === 'REGISTER_NOW' ? calf.purpose : undefined }
    }),
  }
}

export default function CalvingPage({ role: roleProp }: { role?: ReproductionRole }) {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const role: ReproductionRole = roleProp ?? (session?.role === 'OWNER' || session?.role === 'MANAGER' ? session.role : 'TECHNICIAN')
  const [profile, setProfile] = useState<ReproductionFemale | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [issues, setIssues] = useState<ReproductionIssue[]>([])
  const [form, setForm] = useState({ birthAt: nowLocal(), pregnancyId: '', dataSource: 'DIRECT_OBSERVATION' as DataSource, attendant: '', course: 'NORMAL', damCondition: 'GOOD', retainedPlacenta: false })
  const [calves, setCalves] = useState<CalfForm[]>([])

  useEffect(() => {
    let active = true
    void reproductionApi.getProfile(code).then((result) => {
      if (!active) return
      setProfile(result)
      setForm((current) => ({ ...current, pregnancyId: result.openPregnancy?.id ?? '' }))
      setCalves([blankCalf(result)])
    }).catch((cause: unknown) => {
      if (active) setLoadError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ bò.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [code])

  const back = `/cattle/${encodeURIComponent(code)}?tab=repro`
  const canManage = role === 'MANAGER'
  const patchForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }))
  const patchCalf = (index: number, patch: Partial<CalfForm>) => setCalves((current) => current.map((calf, i) => i === index ? { ...calf, ...patch } : calf))
  const issueOf = (field: string, calf?: number) => issues.find((item) => item.field === field && item.calf === calf)?.message

  const banner = (() => {
    if (!issues.length) return ''
    const duplicate = issues.find((item) => item.calf !== undefined && item.field === 'earTag' && DUPLICATE.test(item.message))
    if (duplicate) return `Chưa lưu được: mã thẻ tai của Bê số ${(duplicate.calf ?? 0) + 1} đã được dùng. Sửa ô được đánh dấu đỏ rồi lưu lại.`
    return `Chưa lưu được: ${issues[0]?.message ?? ''} Sửa ô được đánh dấu đỏ rồi lưu lại.`
  })()

  const submit = async () => {
    if (!profile || !canManage) return
    const command = toCommand(form, calves, profile)
    const local = calvingIssues(command, { today: nowLocal(), existingEarTags: [], openPregnancyId: profile.openPregnancy?.id, openPregnancyConfirmedAt: profile.openPregnancy?.confirmedAt })
    if (local.length) { setIssues(local); return }
    setIssues([]); setSaving(true)
    try {
      const saved = await reproductionApi.recordCalving(code, command, role)
      const record = saved.calvings[0]
      const drafts = record?.calves.filter((calf) => calf.registrationStatus === 'PENDING_CONFIRMATION').length ?? 0
      const registered = record?.calves.filter((calf) => calf.registrationStatus === 'REGISTERED').map((calf) => calf.earTag).filter(Boolean) ?? []
      const notice = [
        `Đã ghi sự kiện đẻ của ${code} với ${record?.calves.length ?? 0} kết quả bê.`,
        drafts ? `${drafts} bê sống lưu nháp: Chủ trại hoặc Quản lý đăng ký ở phiếu nhập bê sinh tại trại.` : '',
        registered.length ? `Bê ${registered.join(', ')} đã được đăng ký vào đàn.` : '',
      ].filter(Boolean).join(' ')
      navigate(back, { state: { reproductionNotice: notice } })
    } catch (cause) {
      if (cause instanceof ReproductionValidationError) setIssues(cause.issues)
      else setIssues([{ message: cause instanceof Error ? cause.message : 'Không lưu được sự kiện đẻ.' }])
    } finally { setSaving(false) }
  }

  const preg = profile?.openPregnancy
  const subtitle = profile ? `${profile.cattleCode}${profile.name !== '—' ? ` “${profile.name}”` : ''} · ${profile.breed} · ${profile.penName}${preg ? ` · thai kỳ ${preg.pregnancyNumber}` : ''}` : undefined
  const errText = (message?: string) => message && <span className="text-[11px] text-err-fg">{message}</span>
  const invalid = (message?: string) => (message ? 'border-err-fg' : '')

  return (
    <Layout title="Hồ sơ bò › Ghi sự kiện đẻ" user={role === 'OWNER' ? 'owner' : 'manager'}>
      <div className="flex flex-col gap-4 leading-[normal]">
        <PageHeader title="Ghi sự kiện đẻ" sub={subtitle} badge={backendMode === 'backend' ? <Badge tone="warn">Chưa nối backend</Badge> : undefined}>
          <Link className={backLink} to={back}><Icon name="arrow-left" size={16} />Quay lại hồ sơ</Link>
        </PageHeader>
        {backendMode === 'backend' && <Note tone="warn">Sự kiện đẻ chưa tích hợp backend; biểu mẫu không lưu hoặc chuyển sang mock trong chế độ backend.</Note>}
        {role !== 'MANAGER' && <Note tone="info">Chỉ Quản lý được ghi sự kiện đẻ. Chủ trại và Kỹ thuật viên xem ở chế độ chỉ đọc.</Note>}
        {banner && <Note tone="err">{banner}</Note>}
        {loadError && <Note tone="err">{loadError}</Note>}
        {loading && <Card><p className="m-0 text-sm text-muted">Đang tải hồ sơ bò…</p></Card>}
        {profile && (
          <fieldset disabled={!canManage} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
            <Card title="Thông tin sự kiện đẻ">
              <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
                <ReadOnlyField label="Bò mẹ" value={`${profile.cattleCode} · Số tai ${profile.earTag || '—'} · ${profile.breed} · ${profile.penCode}`} />
                <Field label="Thai kỳ liên kết" id="calving-pregnancy" hint={'Hoặc "Không có thai được theo dõi"'}>
                  <Select id="calving-pregnancy" aria-label="Thai kỳ liên kết" value={form.pregnancyId} onChange={(event) => patchForm('pregnancyId', event.target.value)}>
                    {preg && <option value={preg.id}>Thai kỳ {preg.pregnancyNumber} · DK đẻ {formatDate(preg.expectedCalvingAt)}</option>}
                    <option value="">Không có thai được theo dõi</option>
                  </Select>
                </Field>
                <RadioField label="Sót nhau (quá 12 giờ)" name="Sót nhau" value={form.retainedPlacenta ? 'yes' : 'no'} onChange={(value) => patchForm('retainedPlacenta', value === 'yes')} options={[['no', 'Không'], ['yes', 'Có – gợi ý mở ca sức khỏe']]} />
                <div className="flex flex-col gap-1.5">
                  <DateTimeField label="Thời điểm đẻ *" value={form.birthAt} onChange={(value) => patchForm('birthAt', value)} />
                  {errText(issueOf('birthAt'))}
                </div>
                <Field label="Nguồn dữ liệu" id="calving-source" hint={SOURCE_HINT}>
                  <Select id="calving-source" aria-label="Nguồn dữ liệu" value={form.dataSource} onChange={(event) => patchForm('dataSource', event.target.value as DataSource)}>
                    {SOURCE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </Select>
                </Field>
                <Field label="Người đỡ đẻ" id="calving-attendant"><PersonInput id="calving-attendant" label="Người đỡ đẻ" value={form.attendant} onChange={(value) => patchForm('attendant', value)} /></Field>
                <RadioField label="Kiểu đẻ" name="Kiểu đẻ" value={form.course} onChange={(value) => patchForm('course', value)} options={COURSE_OPTIONS} />
                <RadioField label="Tình trạng bò mẹ sau đẻ" name="Tình trạng bò mẹ sau đẻ" value={form.damCondition} onChange={(value) => patchForm('damCondition', value)} options={DAM_CONDITION_OPTIONS} />
              </div>
              {form.retainedPlacenta && <Note tone="warn">Sót nhau quá 12 giờ: nên mở ca sức khỏe. Biểu mẫu này không tự tạo ca điều trị.</Note>}
            </Card>

            <Card
              title={`Kết quả bê (${calves.length})`}
              sub="Mỗi bê 1 khối; bê sống mới có phần đăng ký"
              actions={<Button disabled={calves.length >= 4} onClick={() => setCalves((current) => [...current, blankCalf(profile)])}><Icon name="circle-plus" size={16} />Thêm bê</Button>}
            >
              <div className="flex flex-col gap-3">
                {calves.map((calf, index) => {
                  const label = `Bê số ${index + 1}`
                  const live = calf.outcome === 'LIVE'
                  const tagError = issueOf('earTag', index)
                  const weightError = issueOf('weight', index)
                  const basisError = issueOf('weightBasis', index)
                  const purposes = REPRODUCTION_PURPOSES.filter((item) => !(item.value === 'SIRE' && calf.sex === 'FEMALE') && !(item.value === 'BREEDING' && calf.sex === 'MALE'))
                  return (
                    <section key={index} role="group" aria-label={label} className="flex flex-col gap-3 rounded-md border border-rule p-[15px]">
                      <div className="flex items-center gap-2">
                        <h4 className="m-0 flex-1 text-[13px] font-semibold">{label}</h4>
                        {calves.length > 1 && <button type="button" className="cursor-pointer text-xs font-semibold text-err-fg" onClick={() => setCalves((current) => current.filter((_, i) => i !== index))}>Xóa bê</button>}
                      </div>
                      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                        <RadioField label="Kết quả *" name={`${label} – Kết quả`} value={calf.outcome} options={[['LIVE', 'Sống'], ['STILLBORN', 'Chết lúc sinh']]}
                          onChange={(value) => patchCalf(index, value === 'LIVE' ? { outcome: 'LIVE', sex: calf.sex === 'UNKNOWN' ? 'FEMALE' : calf.sex } : { outcome: 'STILLBORN' })} />
                        <Field label="Giới tính">
                          <RadioRow name={`${label} – Giới tính`} value={calf.sex} onChange={(value) => patchCalf(index, { sex: value as CalfForm['sex'], purpose: value === 'FEMALE' && calf.purpose === 'SIRE' ? 'UNDECIDED' : value === 'MALE' && calf.purpose === 'BREEDING' ? 'UNDECIDED' : calf.purpose })}
                            options={[['MALE', 'Đực'], ['FEMALE', 'Cái'], ...(live ? [] : [['UNKNOWN', 'Không rõ'] as [string, string]])]} />
                          {errText(issueOf('sex', index))}
                        </Field>
                        <Field label="Cân sơ sinh" id={`calf-${index}-weight`}>
                          <div className="relative">
                            <input id={`calf-${index}-weight`} aria-label="Cân sơ sinh" type="number" min="1" max="80" step="0.1" aria-invalid={!!weightError} className={`${inputCls} pr-9 ${invalid(weightError)}`} value={calf.weightText} onChange={(event) => patchCalf(index, { weightText: event.target.value })} />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">kg</span>
                          </div>
                          {weightError ? errText(weightError) : <span className="text-[11px] text-muted">1 – 80 kg</span>}
                        </Field>
                        <Field label="Cơ sở cân">
                          <RadioRow name={`${label} – Cơ sở cân`} value={calf.weightBasis} onChange={(value) => patchCalf(index, { weightBasis: value as CalfForm['weightBasis'] })} options={[['MEASURED', 'Cân thực tế'], ['ESTIMATED', 'Ước tính']]} />
                          {errText(basisError)}
                        </Field>
                      </div>
                      {live && (
                        <>
                          <div className="text-xs font-semibold text-brand">Đăng ký bê</div>
                          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Field label="Mã thẻ tai / QR" id={`calf-${index}-tag`}>
                              <input id={`calf-${index}-tag`} aria-label="Mã thẻ tai / QR" aria-invalid={!!tagError} maxLength={50} className={`${inputCls} ${invalid(tagError)}`} value={calf.earTag} onChange={(event) => patchCalf(index, { earTag: event.target.value })} placeholder={calf.registration === 'DRAFT' ? 'Không bắt buộc với bê nháp' : ''} />
                              {tagError ? errText(tagError) : <span className="text-[11px] text-muted">Duy nhất trong trại</span>}
                            </Field>
                            <Field label="Chuồng ban đầu *" id={`calf-${index}-pen`}>
                              <Select id={`calf-${index}-pen`} aria-label="Chuồng ban đầu" value={calf.penId} onChange={(event) => patchCalf(index, { penId: event.target.value })}>
                                <option value="">Chọn chuồng</option>
                                {REPRODUCTION_PENS.map((pen) => <option key={pen.id} value={pen.id}>{pen.label}</option>)}
                              </Select>
                              {errText(issueOf('penId', index))}
                            </Field>
                            <Field label="Giống" id={`calf-${index}-breed`}>
                              <Select id={`calf-${index}-breed`} aria-label="Giống" value={calf.breed} onChange={(event) => patchCalf(index, { breed: event.target.value })}>
                                {REPRODUCTION_BREEDS.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
                              </Select>
                            </Field>
                            <Field label="Hình thức đăng ký *">
                              <RadioRow name={`${label} – Hình thức đăng ký`} value={calf.registration} onChange={(value) => patchCalf(index, { registration: value as CalfForm['registration'] })} options={[['DRAFT', 'Lưu bê nháp'], ['REGISTER_NOW', 'Đăng ký ngay']]} />
                              {errText(issueOf('registration', index))}
                            </Field>
                          </div>
                          {calf.registration === 'REGISTER_NOW' && (
                            <Field label="Mục đích nuôi *" id={`calf-${index}-purpose`} hint={'Giai đoạn của bê đăng ký ngay là "Bê chưa cai sữa"'}>
                              <Select id={`calf-${index}-purpose`} aria-label="Mục đích nuôi" value={calf.purpose} onChange={(event) => patchCalf(index, { purpose: event.target.value })}>
                                {purposes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                              </Select>
                              {errText(issueOf('purpose', index))}
                            </Field>
                          )}
                        </>
                      )}
                    </section>
                  )
                })}
              </div>
            </Card>
          </fieldset>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <Button onClick={() => navigate(back)}>Hủy</Button>
          <Button variant="primary" disabled={!canManage || !profile || saving || backendMode === 'backend'} onClick={() => void submit()}>{saving ? 'Đang lưu…' : 'Lưu sự kiện đẻ'}</Button>
        </div>
        <Foot>Trang ghi sự kiện đẻ (chỉ Quản lý). Mặc định liên kết thai kỳ đang mở. Bê sống mặc định "Lưu bê nháp" để đăng ký sau ở phiếu nhập bê sinh tại trại; chọn "Đăng ký ngay" thì cần mã thẻ, chuồng và mục đích nuôi. Có cân sơ sinh thì phải chọn cơ sở cân.</Foot>
      </div>
    </Layout>
  )
}
