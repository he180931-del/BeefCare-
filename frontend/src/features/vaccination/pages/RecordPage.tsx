import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Button, Card, EmptyBlock, ErrorBlock, Field, Foot, Info, inputCls, LoadingBlock, Note, PageHeader, Radio, Select, Table, Td, Th } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useSession } from '../../../app/session/sessionContext'
import { CareWriterOnly, DOSE_INVALID, FieldError, ROUTE_LABEL, UnitInput, parseDoseAmount, parseNum, profilePath } from '../components/vaccinationParts'
import { addDays, fmtDate } from '../domain/vaccinationFormat'
import { ROUTE_OTHER_MAX, VaccinationValidationError, type FieldErrors } from '../domain/vaccinationRules'
import { useVaccinationCommands, useVaccinationRecordContext } from '../hooks/useVaccinationUseCase'
import type { RecordContext, VaccinationAnimal, VaccinationSource, VaccineRoute } from '../types'

export default function RecordPage() {
  const [params] = useSearchParams()
  const doseIds = (params.get('doses') ?? '').split(',').map(Number).filter(Boolean)
  const cattleCodes = (params.get('cattle') ?? '').split(',').filter(Boolean)
  const back = params.get('back') ?? '/tiem-phong'
  const { data, loading, error, refetch } = useVaccinationRecordContext({ doseIds, cattleCodes }, params.toString())
  const title = data?.title ?? 'Ghi nhận tiêm'
  return (
    <CareWriterOnly title="Ghi nhận tiêm">
      <Layout title={title}>
        {loading && !data ? <LoadingBlock />
          : error || !data ? <ErrorBlock message={userFacingError(error, 'Không tải được thông tin ghi nhận tiêm.')} onRetry={refetch} />
          : data.rows.length === 0 ? <EmptyBlock title="Chưa chọn bò nào để ghi nhận" sub="Quay lại lịch tiêm phòng và chọn các mũi cần ghi nhận." action={<Link to={back} className="text-brand">Quay lại</Link>} />
          : <RecordForm ctx={data} back={back} />}
      </Layout>
    </CareWriterOnly>
  )
}


function RecordForm({ ctx, back }: { ctx: RecordContext; back: string }) {
  const navigate = useNavigate()
  const session = useSession()
  const { recordVaccinations } = useVaccinationCommands()
  const { options, rows } = ctx
  const first = options.vaccines.find((v) => v.id === ctx.vaccineId) ?? options.vaccines[0]
  const names = options.members.map((m) => m.name)
  const [vaccineId, setVaccineId] = useState(String(first.id))
  const [administeredAt, setAdministeredAt] = useState(options.now)
  // Vắc-xin không có liều tham chiếu (0): ô Liều để trống, liều không bắt buộc (spec FE-09 §3.3).
  const [amount, setAmount] = useState(first.referenceDose > 0 ? String(first.referenceDose) : '')
  const [route, setRoute] = useState<VaccineRoute>(first.route)
  const [routeOther, setRouteOther] = useState('')
  const [withdrawal, setWithdrawal] = useState(String(first.withdrawalDays))
  const [vaccinator, setVaccinator] = useState(names.includes(session?.fullName ?? '') ? session!.fullName : names[0])
  const [other, setOther] = useState('')
  const [source, setSource] = useState<VaccinationSource>('ON_FARM')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [rowErrors, setRowErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  const vaccine = options.vaccines.find((v) => String(v.id) === vaccineId) ?? first
  const vaccinated = rows.length
  const onFarm = source === 'ON_FARM'
  // Để trống ô ngưng thịt nghĩa là 0 ngày; giá trị không đọc được thành NaN để bước kiểm báo lỗi.
  const days = withdrawal.trim() === '' ? 0 : parseNum(withdrawal) ?? Number.NaN
  const endDate = onFarm && days && days > 0 ? fmtDate(addDays(administeredAt.slice(0, 10), days)) : 'Không áp dụng'
  const doseRows = rows.map((r) => r.dose)
  const scheduleLine = doseRows.every((d) => d && d.scheduleId === doseRows[0]?.scheduleId) && doseRows[0] ? doseRows[0].scheduleName : '—'
  const doseLine = doseRows.every((d) => d && d.doseText === doseRows[0]?.doseText) && doseRows[0] ? doseRows[0].doseText.replace('mũi ', '').replace('/', ' / ') : '—'

  const pickVaccine = (id: string) => {
    setVaccineId(id)
    const v = options.vaccines.find((x) => String(x.id) === id)
    if (v) { setAmount(v.referenceDose > 0 ? String(v.referenceDose) : ''); setRoute(v.route); setRouteOther(''); setWithdrawal(String(v.withdrawalDays)) }
  }

  const submit = async () => {
    const dose = parseDoseAmount(amount, vaccine.doseUnit)
    if (dose.invalid) { setErrors({ dose: DOSE_INVALID }); return }
    const animals: VaccinationAnimal[] = rows.map((r) => {
      return { cattleCode: r.cattle.code, scheduledDoseId: r.dose?.id, expectedDoseVersion: r.dose?.version }
    })
    setSaving(true)
    setErrors({})
    setRowErrors({})
    try {
      const result = await recordVaccinations({
        vaccineId: Number(vaccineId), source, administeredAt, dose: dose.amount ? `${dose.amount} ${vaccine.doseUnit}` : undefined, route, routeOther: route === 'OTHER' ? routeOther : undefined,
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
          <Field label="Vắc-xin *" id="rv-vaccine">
            <Select id="rv-vaccine" value={vaccineId} onChange={(e) => pickVaccine(e.target.value)}>{options.vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>
            <FieldError>{errors.vaccineId}</FieldError>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Thời điểm tiêm *" id="rv-at">
              <input id="rv-at" type="datetime-local" className={inputCls} value={administeredAt} onChange={(e) => setAdministeredAt(e.target.value)} />
              <FieldError>{errors.administeredAt}</FieldError>
            </Field>
            <Field label="Liều" id="rv-dose">
              <UnitInput id="rv-dose" type="text" inputMode="decimal" unit={vaccine.doseUnit} aria-invalid={!!errors.dose} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <FieldError>{errors.dose}</FieldError>
            </Field>
            <Field label="Đường tiêm" id="rv-route">
              <Select id="rv-route" value={route} onChange={(e) => setRoute(e.target.value as VaccineRoute)}>{(Object.keys(ROUTE_LABEL) as VaccineRoute[]).map((r) => <option key={r} value={r}>{ROUTE_LABEL[r]}</option>)}</Select>
              {route === 'OTHER' && <input aria-label="Đường tiêm khác" placeholder="Nhập đường tiêm *" className={inputCls} maxLength={ROUTE_OTHER_MAX} value={routeOther} onChange={(e) => setRouteOther(e.target.value)} />}
              <FieldError>{errors.routeOther}</FieldError>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ngưng sử dụng thịt" id="rv-wd" hint="Lấy từ danh mục, có thể sửa; để trống là 0 ngày">
              <UnitInput id="rv-wd" unit="ngày" min={0} max={365} step={1} disabled={!onFarm} value={onFarm ? withdrawal : '0'} onChange={(e) => setWithdrawal(e.target.value)} />
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
          <Info cols={2} items={[['Lịch', scheduleLine], ['Mũi', doseLine], ['Sẽ ghi nhận', `${vaccinated} con`]]} />
          {errors.form && <Note tone="err">{errors.form}</Note>}
          <Button variant="primary" block disabled={saving} onClick={() => void submit()}>Lưu {vaccinated} mũi tiêm</Button>
          <Button block onClick={() => navigate(back)}>Hủy</Button>
        </Card>
      </div>
      <Card title={`Bò được chọn (${rows.length})`} sub="Con nào chưa tiêm được thì quay lại và bỏ chọn, hoặc sửa lịch để bỏ con đó ra khỏi lịch.">
        <Table stack={false} scroll>
          <thead><tr><Th>Bò</Th><Th>Chuồng</Th><Th>Mũi</Th></tr></thead>
          <tbody>
            {rows.map(({ cattle, dose }) => {
              return (
                <tr key={cattle.code}>
                  <Td>
                    <Link to={profilePath(cattle.code)} className="font-medium text-ink no-underline hover:underline">{cattle.name ? `${cattle.code} “${cattle.name}”` : cattle.code}</Link>
                    <span className="block text-[11px] text-muted">{cattle.breed} · {cattle.sex}</span>
                  </Td>
                  <Td>{cattle.penName}</Td>
                  <Td>
                    {dose ? `${dose.scheduleShort} · ${dose.doseText}` : 'Ngoài lịch'}
                    <FieldError>{rowErrors[cattle.code]}</FieldError>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
      <Foot>Màn ghi tiêm cho 1 con hoặc nhiều con (Chủ trại, Quản lý). Vắc-xin, liều, đường tiêm và số ngày ngưng được điền sẵn từ danh mục. "Nhập lịch sử" dùng cho mũi tiêm trước khi bò về trại: không tính ngày ngưng.</Foot>
    </div>
  )
}
