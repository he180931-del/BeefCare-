import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Checkbox, Field, Note, PageHeader, Select, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { reproductionApi } from '../api/reproductionApi'
import { validateCalving } from '../domain/reproductionRules'
import type { CalvingCommand, DataSource, ReproductionFemale, ReproductionRole } from '../types'

const SOURCES: Array<[DataSource, string]> = [['DIRECT_OBSERVATION', 'Quan sát trực tiếp'], ['FARM_NOTEBOOK', 'Sổ trại'], ['EXTERNAL_REPORT', 'Báo cáo bên ngoài']]
const PEN_OPTIONS = [
  { id: 'pen-a1', code: 'A1', name: 'Chuồng A1 · Sinh sản' },
  { id: 'pen-a2', code: 'A2', name: 'Chuồng A2 · Bò cái sinh sản' },
  { id: 'pen-b1', code: 'B1', name: 'Chuồng B1 · Sinh sản' },
  { id: 'pen-c1', code: 'C1', name: 'Chuồng C1 · Bò tơ' },
  { id: 'pen-d', code: 'D', name: 'Chuồng D · Sinh sản' },
]
const nowInput = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const makeCalf = (profile: ReproductionFemale): CalvingCommand['calves'][number] => ({
  outcome: 'LIVE', sex: 'FEMALE', weightKg: null, weightBasis: null,
  earTag: '', penId: profile.penId, penCode: profile.penCode, breed: profile.breed,
  registration: 'DRAFT', productionPurpose: 'UNDECIDED',
})

export default function CalvingPage({ role = 'TECHNICIAN' }: { role?: ReproductionRole }) {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ReproductionFemale | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [birthAt, setBirthAt] = useState(nowInput)
  const [pregnancyId, setPregnancyId] = useState('')
  const [dataSource, setDataSource] = useState<DataSource>('DIRECT_OBSERVATION')
  const [attendant, setAttendant] = useState('')
  const [course, setCourse] = useState<CalvingCommand['course']>('NORMAL')
  const [damCondition, setDamCondition] = useState<CalvingCommand['damCondition']>('GOOD')
  const [retainedPlacenta, setRetainedPlacenta] = useState(false)
  const [calves, setCalves] = useState<CalvingCommand['calves']>([])

  useEffect(() => {
    let active = true
    void reproductionApi.getProfile(code).then((result) => {
      if (!active) return
      setProfile(result)
      setPregnancyId(result.openPregnancy?.id ?? '')
      setCalves([makeCalf(result)])
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ bò.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [code])

  const updateCalf = (index: number, patch: Partial<CalvingCommand['calves'][number]>) => setCalves((current) => current.map((calf, i) => i === index ? { ...calf, ...patch } : calf))
  const backToProfile = `/cattle/${encodeURIComponent(code)}?tab=repro`
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile) return
    const command: CalvingCommand = { birthAt, pregnancyId: pregnancyId || null, dataSource, attendant, course, damCondition, retainedPlacenta, calves }
    const localTags = profile.calvings.flatMap((record) => record.calves.map((calf) => calf.earTag ?? ''))
    const errors = validateCalving(command, { today: nowInput(), existingEarTags: localTags, openPregnancyId: profile.openPregnancy?.id, openPregnancyConfirmedAt: profile.openPregnancy?.confirmedAt })
    if (errors.length) { setError(errors[0]); return }
    setError(''); setSaving(true)
    try {
      await reproductionApi.recordCalving(code, command, role)
      navigate(backToProfile)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được sự kiện đẻ.')
    } finally { setSaving(false) }
  }

  const canManage = role === 'MANAGER'
  const defaultTitle = profile ? `Ghi sự kiện đẻ · ${profile.cattleCode}` : 'Ghi sự kiện đẻ'
  return (
    <Layout title="Ghi sự kiện đẻ" user={role === 'OWNER' ? 'owner' : 'manager'}>
      <form className="flex flex-col gap-4 leading-[normal]" onSubmit={(event) => void submit(event)}>
        <PageHeader title={defaultTitle} sub="Ghi một lần sinh và kết quả riêng cho từng bê." badge={backendMode === 'local' ? <Badge tone="info">Dữ liệu minh họa</Badge> : <Badge tone="warn">Chưa nối backend</Badge>}>
          <Button type="button" onClick={() => navigate(backToProfile)}>Hủy</Button>
          <Button type="submit" variant="primary" disabled={!canManage || !profile || saving || backendMode === 'backend'}>{saving ? 'Đang lưu…' : 'Lưu sự kiện đẻ'}</Button>
        </PageHeader>
        {backendMode === 'backend' && <Note tone="warn">Sự kiện đẻ chưa tích hợp backend; biểu mẫu không lưu hoặc chuyển sang mock trong chế độ backend.</Note>}
        {role !== 'MANAGER' && <Note tone="info">Chỉ Quản lý được ghi sự kiện đẻ. Chủ trại và Kỹ thuật viên xem ở chế độ chỉ đọc.</Note>}
        {error && <Note tone={backendMode === 'backend' ? 'warn' : 'err'}>{error}</Note>}
        {loading && <Card><p className="m-0 text-sm text-muted">Đang tải hồ sơ bò…</p></Card>}
        {profile && <>
          <Card title="Thông tin bò mẹ" sub="Thông tin được lấy từ hồ sơ; không chỉnh sửa ở biểu mẫu này.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ReadValue label="Bò mẹ" value={`${profile.cattleCode}${profile.name !== '—' ? ` · ${profile.name}` : ''}`} />
              <ReadValue label="Số tai · Giống" value={`${profile.earTag || 'Chưa có số tai'} · ${profile.breed}`} />
              <ReadValue label="Chuồng hiện tại" value={`${profile.penCode} · ${profile.penName}`} />
              <ReadValue label="Thai kỳ liên quan" value={profile.openPregnancy ? `Lứa ${profile.openPregnancy.pregnancyNumber} · Dự kiến ${profile.openPregnancy.expectedCalvingAt ? new Date(profile.openPregnancy.expectedCalvingAt).toLocaleDateString('vi-VN') : '—'}` : 'Không có thai kỳ đang mở'} />
            </div>
          </Card>

          <Card title="Thông tin sự kiện đẻ" sub="Có thể ghi sự kiện không gắn thai kỳ nếu thai chưa từng được theo dõi.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Thời điểm đẻ *" id="calving-birth-at"><input id="calving-birth-at" aria-label="Thời điểm đẻ" type="datetime-local" max={nowInput()} className={inputCls} value={birthAt} onChange={(event) => setBirthAt(event.target.value)} /></Field>
              <Field label="Thai kỳ liên quan" id="calving-pregnancy"><Select id="calving-pregnancy" value={pregnancyId} onChange={(event) => setPregnancyId(event.target.value)}><option value="">Không theo dõi thai kỳ</option>{profile.openPregnancy && <option value={profile.openPregnancy.id}>Lứa {profile.openPregnancy.pregnancyNumber} · {dateLabel(profile.openPregnancy.expectedCalvingAt)}</option>}</Select></Field>
              <Field label="Nguồn dữ liệu" id="calving-source"><Select id="calving-source" value={dataSource} onChange={(event) => setDataSource(event.target.value as DataSource)}>{SOURCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
              <Field label="Người đỡ đẻ" id="calving-attendant"><input id="calving-attendant" className={inputCls} maxLength={100} value={attendant} onChange={(event) => setAttendant(event.target.value)} placeholder="Thành viên hoặc người ngoài trại" /></Field>
              <Field label="Diễn biến đẻ *" id="calving-course"><Select id="calving-course" value={course} onChange={(event) => setCourse(event.target.value as CalvingCommand['course'])}><option value="NORMAL">Bình thường</option><option value="ASSISTED">Có trợ giúp</option><option value="CAESAREAN">Mổ lấy thai</option></Select></Field>
              <Field label="Tình trạng bò mẹ sau sinh *" id="calving-dam-condition"><Select id="calving-dam-condition" value={damCondition} onChange={(event) => setDamCondition(event.target.value as CalvingCommand['damCondition'])}><option value="GOOD">Ổn định</option><option value="MONITORING">Cần theo dõi</option><option value="CRITICAL">Nguy kịch</option></Select></Field>
              <div className="sm:col-span-2 lg:col-span-3"><Checkbox checked={retainedPlacenta} onChange={(event) => setRetainedPlacenta(event.target.checked)}>Nhau chưa ra sau 12 giờ</Checkbox>{retainedPlacenta && <div className="mt-2"><Note tone="warn">Đánh dấu giữ lại nhau gợi ý mở ca sức khỏe; biểu mẫu này không tự tạo ca điều trị.</Note></div>}</div>
            </div>
          </Card>

          <Card title="Kết quả bê" sub="Thêm từng bê; tối đa 4 kết quả cho một lần đẻ." actions={<Button size="sm" disabled={calves.length >= 4} onClick={() => setCalves((current) => [...current, makeCalf(profile)])}>+ Thêm bê</Button>}>
            <div className="flex flex-col gap-4">
              {calves.map((calf, index) => <section key={index} className="rounded-md border border-edge p-4">
                <div className="mb-3 flex items-center gap-2"><h3 className="m-0 text-sm font-semibold">Bê {index + 1}</h3><Badge>{calf.outcome === 'LIVE' ? 'Sống' : 'Thai chết lưu'}</Badge><span className="flex-1" />{calves.length > 1 && <Button size="sm" onClick={() => setCalves((current) => current.filter((_, i) => i !== index))}>Xóa bê</Button>}</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Kết quả *" id={`calf-${index}-outcome`}><Select id={`calf-${index}-outcome`} value={calf.outcome} onChange={(event) => updateCalf(index, event.target.value === 'LIVE' ? { outcome: 'LIVE', sex: 'FEMALE', penId: profile.penId, penCode: profile.penCode, breed: profile.breed, registration: 'DRAFT', productionPurpose: 'UNDECIDED' } : { outcome: 'STILLBORN', registration: undefined, productionPurpose: undefined })}><option value="LIVE">Sống</option><option value="STILLBORN">Thai chết lưu</option></Select></Field>
                  <Field label="Giới tính *" id={`calf-${index}-sex`}><Select id={`calf-${index}-sex`} disabled={calf.outcome === 'STILLBORN'} value={calf.sex} onChange={(event) => updateCalf(index, { sex: event.target.value as CalvingCommand['calves'][number]['sex'] })}><option value="MALE">Đực</option><option value="FEMALE">Cái</option>{calf.outcome === 'STILLBORN' && <option value="UNKNOWN">Không rõ</option>}</Select></Field>
                  <Field label="Cân nặng (kg)" id={`calf-${index}-weight`}><input id={`calf-${index}-weight`} type="number" min="1" max="80" step="0.1" className={inputCls} value={calf.weightKg ?? ''} onChange={(event) => updateCalf(index, { weightKg: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
                  <Field label="Cơ sở cân" id={`calf-${index}-weight-basis`}><Select id={`calf-${index}-weight-basis`} disabled={calf.weightKg == null} value={calf.weightBasis ?? ''} onChange={(event) => updateCalf(index, { weightBasis: event.target.value as 'MEASURED' | 'ESTIMATED' | null })}><option value="">Chọn</option><option value="MEASURED">Đã cân</option><option value="ESTIMATED">Ước tính</option></Select></Field>
                  {calf.outcome === 'LIVE' && <>
                    <Field label="Số tai / QR" id={`calf-${index}-tag`}><input id={`calf-${index}-tag`} maxLength={50} className={inputCls} value={calf.earTag ?? ''} onChange={(event) => updateCalf(index, { earTag: event.target.value })} placeholder="Có thể bổ sung sau" /></Field>
                    <Field label="Chuồng nuôi đầu tiên *" id={`calf-${index}-pen`}><Select id={`calf-${index}-pen`} value={calf.penId ?? ''} onChange={(event) => { const pen = PEN_OPTIONS.find((item) => item.id === event.target.value); updateCalf(index, { penId: event.target.value, penCode: pen?.code }) }}><option value="">Chọn chuồng ACTIVE</option>{PEN_OPTIONS.map((pen) => <option key={pen.id} value={pen.id}>{pen.code} · {pen.name}</option>)}</Select></Field>
                    <Field label="Giống bò" id={`calf-${index}-breed`}><Select id={`calf-${index}-breed`} value={calf.breed ?? profile.breed} onChange={(event) => updateCalf(index, { breed: event.target.value })}><option value="Zebu đỏ">Zebu đỏ</option><option value="Lai Sind">Lai Sind</option><option value="Brahman đỏ">Brahman đỏ</option></Select></Field>
                    <Field label="Đăng ký bê *" id={`calf-${index}-registration`}><Select id={`calf-${index}-registration`} value={calf.registration ?? 'DRAFT'} onChange={(event) => updateCalf(index, { registration: event.target.value as 'DRAFT' | 'REGISTER_NOW' })}><option value="DRAFT">Lưu bê nháp</option><option value="REGISTER_NOW">Đăng ký ngay</option></Select></Field>
                    {calf.registration === 'REGISTER_NOW' && <Field label="Mục đích nuôi *" id={`calf-${index}-purpose`}><Select id={`calf-${index}-purpose`} value={calf.productionPurpose ?? 'UNDECIDED'} onChange={(event) => updateCalf(index, { productionPurpose: event.target.value })}><option value="UNDECIDED">Chưa xác định</option>{calf.sex === 'FEMALE' && <option value="BREEDING">Sinh sản</option>}<option value="FATTENING">Vỗ béo</option>{calf.sex === 'MALE' && <option value="SIRE">Đực giống</option>}</Select></Field>}
                  </>}
                </div>
              </section>)}
              {calves.some((calf) => calf.outcome === 'STILLBORN') && <Note tone="info">Thai chết lưu không có mã thẻ, chuồng nuôi hoặc lựa chọn đăng ký.</Note>}
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3"><Link className="text-xs font-semibold text-brand" to={backToProfile}>← Quay lại hồ sơ sinh sản</Link><span className="flex-1" /><Button type="button" onClick={() => navigate(backToProfile)}>Hủy</Button><Button type="submit" variant="primary" disabled={!canManage || saving || backendMode === 'backend'}>{saving ? 'Đang lưu…' : 'Lưu sự kiện đẻ'}</Button></div>
        </>}
      </form>
    </Layout>
  )
}

function ReadValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-edge p-3"><div className="text-[11px] text-muted">{label}</div><div className="mt-1 text-sm font-medium">{value}</div></div>
}
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : 'chưa có ngày dự kiến'

