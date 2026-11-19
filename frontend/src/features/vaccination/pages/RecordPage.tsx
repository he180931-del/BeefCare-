import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, Card, DateInput, EmptyBlock, ErrorBlock, Field, Foot, Info, LoadingBlock, Note, PageHeader, Radio, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { vaccinationApi } from '../api/vaccinationApi'
import { FieldError, ManagerOnly, ROUTE_LABEL, UnitInput, parseNum, profilePath } from '../components/vaccinationParts'
import { addDays, fmtDate } from '../domain/vaccinationFormat'
import { VaccinationValidationError, type FieldErrors } from '../domain/vaccinationRules'
import type { RecordContext, VaccinationAnimal, VaccinationSource, VaccineRoute } from '../types'

export default function RecordPage() {
  const [params] = useSearchParams()
  const doseIds = (params.get('doses') ?? '').split(',').map(Number).filter(Boolean)
  const cattleCodes = (params.get('cattle') ?? '').split(',').filter(Boolean)
  const back = params.get('back') ?? '/tiem-phong'
  const { data, loading, error, refetch } = useQuery(() => vaccinationApi.recordContext({ doseIds, cattleCodes }), [params.toString()])
  const title = data?.title ?? 'Ghi nhận tiêm'
  return (
    <ManagerOnly title="Ghi nhận tiêm">
      <Layout title={title}>
        {loading && !data ? <LoadingBlock />
          : error || !data ? <ErrorBlock message={userFacingError(error, 'Không tải được thông tin ghi nhận tiêm.')} onRetry={refetch} />
          : data.rows.length === 0 ? <EmptyBlock title="Chưa chọn bò nào để ghi nhận" sub="Quay lại lịch tiêm phòng và chọn các mũi cần ghi nhận." action={<Link to={back} className="text-brand">Quay lại</Link>} />
          : <RecordForm ctx={data} back={back} />}
      </Layout>
    </ManagerOnly>
  )
}

type RowState = { decision: 'VACCINATE' | 'DEFER'; reason: string; date: string }

function RecordForm({ ctx, back }: { ctx: RecordContext; back: string }) {
  const navigate = useNavigate()
  const session = useSession()
  const { options, rows } = ctx
  const first = options.vaccines.find((v) => v.id === ctx.vaccineId) ?? options.vaccines[0]
  const names = options.members.map((m) => m.name)
  const [vaccineId, setVaccineId] = useState(String(first.id))
  const [batchNo, setBatchNo] = useState('')
  const [administeredAt, setAdministeredAt] = useState(options.now)
  const [amount, setAmount] = useState(String(first.referenceDose))
  const [route, setRoute] = useState<VaccineRoute>(first.route)
  const [withdrawal, setWithdrawal] = useState(String(first.withdrawalDays))
  const [vaccinator, setVaccinator] = useState(names.includes(session?.fullName ?? '') ? session!.fullName : names[0])
  const [other, setOther] = useState('')
  const [source, setSource] = useState<VaccinationSource>('ON_FARM')
  const [state, setState] = useState<Record<string, RowState>>({})
  const [errors, setErrors] = useState<FieldErrors>({})
  const [rowErrors, setRowErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  const vaccine = options.vaccines.find((v) => String(v.id) === vaccineId) ?? first
  const rowOf = (code: string): RowState => state[code] ?? { decision: 'VACCINATE', reason: '', date: '' }
  const patch = (code: string, p: Partial<RowState>) => setState({ ...state, [code]: { ...rowOf(code), ...p } })
  const deferred = rows.filter((r) => rowOf(r.cattle.code).decision === 'DEFER').length
  const vaccinated = rows.length - deferred
  const onFarm = source === 'ON_FARM'
  const days = parseNum(withdrawal)
  const endDate = onFarm && days && days > 0 ? fmtDate(addDays(administeredAt.slice(0, 10), days)) : 'Không áp dụng'
  const doseRows = rows.map((r) => r.dose)
  const scheduleLine = doseRows.every((d) => d && d.scheduleId === doseRows[0]?.scheduleId) && doseRows[0] ? doseRows[0].scheduleName : '—'
  const doseLine = doseRows.every((d) => d && d.doseText === doseRows[0]?.doseText) && doseRows[0] ? doseRows[0].doseText.replace('mũi ', '').replace('/', ' / ') : '—'

  const pickVaccine = (id: string) => {
    setVaccineId(id)
    const v = options.vaccines.find((x) => String(x.id) === id)
    if (v) { setAmount(String(v.referenceDose)); setRoute(v.route); setWithdrawal(String(v.withdrawalDays)) }
  }

  const submit = async () => {
    const animals: VaccinationAnimal[] = rows.map((r) => {
      const s = rowOf(r.cattle.code)
      return { cattleCode: r.cattle.code, scheduledDoseId: r.dose?.id, expectedDoseVersion: r.dose?.version, decision: s.decision, deferralReason: s.reason, newExpectedDate: s.date || undefined }
    })
    setSaving(true)
    setErrors({})
    setRowErrors({})
    try {
      const result = await vaccinationApi.recordVaccinations({
        vaccineId: Number(vaccineId), source, administeredAt, batchNo, dose: amount.trim() ? `${amount.trim()} ${vaccine.doseUnit}` : undefined, route,
        withdrawalDays: onFarm ? days : 0, vaccinator: vaccinator === '__other' ? other : vaccinator, animals,
      })
      navigate(back, { state: { notice: [result.message, ...result.skipped.map((s) => s.message)].join(' ') } })
    } catch (error) {
      if (error instanceof VaccinationValidationError) { setErrors(error.fields); setRowErrors(error.rows) }
      else setErrors({ form: userFacingError(error, 'Không lưu được dữ liệu. Vui lòng thử lại.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ctx.title} sub={`Ghi cho ${rows.length} bò đã chọn${rows.some((r) => r.dose) ? ' ở lịch tiêm phòng' : ''}`} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,720fr)_minmax(0,376fr)]">
        <Card title="Thông tin mũi tiêm">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vắc-xin *" id="rv-vaccine">
              <Select id="rv-vaccine" value={vaccineId} onChange={(e) => pickVaccine(e.target.value)}>{options.vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>
              <FieldError>{errors.vaccineId}</FieldError>
            </Field>
            <Field label={onFarm ? 'Số lô *' : 'Số lô'} id="rv-batch" hint={onFarm ? 'Bắt buộc khi tiêm tại trại' : 'Không bắt buộc với nhập lịch sử'}>
              <input id="rv-batch" className={inputCls} maxLength={50} value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
              <FieldError>{errors.batchNo}</FieldError>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Thời điểm tiêm *" id="rv-at">
              <input id="rv-at" type="datetime-local" className={inputCls} value={administeredAt} onChange={(e) => setAdministeredAt(e.target.value)} />
              <FieldError>{errors.administeredAt}</FieldError>
            </Field>
            <Field label="Liều" id="rv-dose"><UnitInput id="rv-dose" unit={vaccine.doseUnit} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Đường tiêm" id="rv-route">
              <Select id="rv-route" value={route} onChange={(e) => setRoute(e.target.value as VaccineRoute)}>{(Object.keys(ROUTE_LABEL) as VaccineRoute[]).map((r) => <option key={r} value={r}>{ROUTE_LABEL[r]}</option>)}</Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ngưng sử dụng thịt" id="rv-wd" hint="Lấy từ danh mục, có thể sửa">
              <UnitInput id="rv-wd" unit="ngày" disabled={!onFarm} value={onFarm ? withdrawal : '0'} onChange={(e) => setWithdrawal(e.target.value)} />
              <FieldError>{errors.withdrawalDays}</FieldError>
            </Field>
            <Field label="Hết ngưng" id="rv-end"><input id="rv-end" readOnly value={endDate} className={`${inputCls} bg-page text-muted`} /></Field>
            <Field label="Người tiêm" id="rv-by" hint="Hoặc nhập tên người ngoài">
              <Select id="rv-by" value={vaccinator} onChange={(e) => setVaccinator(e.target.value)}>
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
                <option value="__other">Người ngoài…</option>
              </Select>
              {vaccinator === '__other' && <input aria-label="Tên người ngoài" className={inputCls} maxLength={100} value={other} onChange={(e) => setOther(e.target.value)} />}
              <FieldError>{errors.vaccinator}</FieldError>
            </Field>
          </div>
          <Field label="Nguồn dữ liệu *">
            <div role="radiogroup" aria-label="Nguồn dữ liệu" className="flex flex-wrap gap-x-5 gap-y-2">
              <Radio name="rv-source" checked={onFarm} onChange={() => setSource('ON_FARM')}>Tiêm tại trại</Radio>
              <Radio name="rv-source" checked={!onFarm} onChange={() => setSource('HISTORICAL')}>Nhập lịch sử</Radio>
            </div>
          </Field>
        </Card>
        <Card title="Tổng kết">
          <Info cols={2} items={[['Lịch', scheduleLine], ['Mũi', doseLine], ['Sẽ ghi nhận', `${vaccinated} con`], ['Hoãn', `${deferred} con`]]} />
          {errors.form && <Note tone="err">{errors.form}</Note>}
          <Button variant="primary" block disabled={saving} onClick={() => void submit()}>Lưu {vaccinated} mũi tiêm</Button>
          <Button block onClick={() => navigate(back)}>Hủy</Button>
        </Card>
      </div>
      <Card title={`Bò được chọn (${rows.length})`} sub='Mặc định "Tiêm"; chọn "Hoãn" thì phải nhập lý do'>
        <Table stack={false} scroll>
          <thead><tr><Th>Bò</Th><Th>Chuồng</Th><Th>Kết quả</Th><Th>Lý do hoãn · ngày mới</Th></tr></thead>
          <tbody>
            {rows.map(({ cattle }) => {
              const s = rowOf(cattle.code)
              return (
                <tr key={cattle.code}>
                  <Td>
                    <Link to={profilePath(cattle.code)} className="font-medium text-ink no-underline hover:underline">{cattle.name ? `${cattle.code} “${cattle.name}”` : cattle.code}</Link>
                    <span className="block text-[11px] text-muted">{cattle.breed} · {cattle.sex}</span>
                  </Td>
                  <Td>{cattle.penName}</Td>
                  <Td>
                    <Select aria-label={`Kết quả ${cattle.code}`} value={s.decision} onChange={(e) => patch(cattle.code, { decision: e.target.value as RowState['decision'] })}>
                      <option value="VACCINATE">Tiêm</option>
                      <option value="DEFER">Hoãn</option>
                    </Select>
                  </Td>
                  <Td>
                    {s.decision === 'DEFER' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input aria-label={`Lý do hoãn ${cattle.code}`} placeholder="Lý do hoãn" className={`${inputCls} min-w-[200px] flex-1`} value={s.reason} onChange={(e) => patch(cattle.code, { reason: e.target.value })} />
                        <DateInput id={`rv-new-${cattle.code}`} value={s.date} onChange={(v) => patch(cattle.code, { date: v })} />
                        <FieldError>{rowErrors[cattle.code]}</FieldError>
                      </div>
                    ) : '—'}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
      <Foot>Màn ghi tiêm cho 1 con hoặc nhiều con (chỉ Quản lý). Vắc-xin, liều, đường tiêm và số ngày ngưng được điền sẵn từ danh mục. "Nhập lịch sử" dùng cho mũi tiêm trước khi bò về trại: không bắt buộc số lô và không tính ngày ngưng.</Foot>
    </div>
  )
}
