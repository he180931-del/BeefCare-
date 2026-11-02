import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import Modal, { ModalButton, ModalFooter, useModalParam } from '../../../components/Modal'
import { Badge, Button, Card, DateInput, ErrorBlock, Field, Foot, Info, LoadingBlock, Note, PageHeader, Select, Table, Td, Textarea, Th, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { vaccinationApi } from '../api/vaccinationApi'
import MultiSelect from '../components/MultiSelect'
import { FieldError, ManagerOnly, ROUTE_LABEL, parseNum } from '../components/vaccinationParts'
import { fmtDate } from '../domain/vaccinationFormat'
import { VaccinationValidationError, type FieldErrors } from '../domain/vaccinationRules'
import type { ScheduleCard, ScheduleCommand, ScheduleDetail, ScheduleTarget, VaccinationOptions } from '../types'

const TITLE = 'Quản lý lịch tiêm'
const EMPTY_TARGET: ScheduleTarget = { penCodes: [], herdGroups: [], lifeStages: [], excluded: [], added: [] }

export default function ManageSchedulePage() {
  return <ManagerOnly title={TITLE}><Layout title={TITLE}><Loader /></Layout></ManagerOnly>
}

function Loader() {
  const [params, setParams] = useSearchParams()
  const cards = useQuery(() => vaccinationApi.listSchedules(), [])
  const options = useQuery(() => vaccinationApi.options(), [])
  const idParam = params.get('id')
  const id: number | 'new' | undefined = idParam === 'new' ? 'new' : Number(idParam) || cards.data?.[0]?.schedule.id || (cards.data ? 'new' : undefined)
  const detail = useQuery(() => (typeof id === 'number' ? vaccinationApi.getSchedule(id) : Promise.resolve(null)), [id])

  const failed = cards.error ?? options.error ?? detail.error
  if (failed) return <ErrorBlock message={userFacingError(failed, 'Không tải được lịch tiêm.')} onRetry={() => { cards.refetch(); options.refetch(); detail.refetch() }} />
  // detail còn giữ kết quả của lịch trước (hoặc null) trong một nhịp sau khi đổi id: chỉ vào form khi đã đúng lịch.
  if (!cards.data || !options.data || id === undefined || (id !== 'new' && detail.data?.schedule.id !== id)) return <LoadingBlock />
  const select = (value: string) => { const next = new URLSearchParams(params); next.set('id', value); next.delete('m'); setParams(next) }
  return <Editor key={String(id)} detail={id === 'new' ? null : detail.data} options={options.data} cards={cards.data} selectedId={id} onSelect={select} />
}

function Editor({ detail, options, cards, selectedId, onSelect }: { detail: ScheduleDetail | null; options: VaccinationOptions; cards: ScheduleCard[]; selectedId: number | 'new'; onSelect: (id: string) => void }) {
  const navigate = useNavigate()
  const [modal, openModal, closeModal] = useModalParam()
  const s = detail?.schedule
  const [name, setName] = useState(s?.name ?? '')
  const [vaccineId, setVaccineId] = useState(String(s?.vaccineId ?? options.vaccines[0].id))
  const [firstDue, setFirstDue] = useState(s?.firstDueDate ?? options.now.slice(0, 10))
  const [doseCount, setDoseCount] = useState(String(s?.doseCount ?? 1))
  const [interval, setInterval] = useState(s?.intervalDays ? String(s.intervalDays) : '')
  const [booster, setBooster] = useState(s?.boosterIntervalMonths ? String(s.boosterIntervalMonths) : '')
  const [target, setTarget] = useState<ScheduleTarget>(s?.target ?? EMPTY_TARGET)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addError, setAddError] = useState('')

  const preview = useQuery(() => vaccinationApi.previewTarget(target), [JSON.stringify(target)])
  const matches = preview.data ?? []
  const command: ScheduleCommand = { name, vaccineId: Number(vaccineId), firstDueDate: firstDue, doseCount: parseNum(doseCount), intervalDays: parseNum(interval), boosterIntervalMonths: parseNum(booster), target, expectedVersion: s?.version }
  const plan = useQuery(
    () => (detail ? Promise.resolve(detail.plannedRows) : vaccinationApi.previewPlan(command, matches.length)),
    [detail, firstDue, doseCount, interval, booster, matches.length],
  )
  const vaccine = options.vaccines.find((v) => String(v.id) === vaccineId)
  const groupLabel = (v: string) => options.herdGroups.find((g) => g.value === v)?.label ?? v
  const shown = showAll ? matches : matches.slice(0, 3)

  const set = <K extends keyof ScheduleTarget>(key: K, value: ScheduleTarget[K]) => setTarget({ ...target, [key]: value })
  const remove = (code: string) => setTarget({ ...target, excluded: [...target.excluded, code], added: target.added.filter((c) => c !== code) })
  const add = async () => {
    const code = (adding ?? '').trim().toUpperCase()
    const found = (await vaccinationApi.previewTarget({ ...EMPTY_TARGET, penCodes: ['__none'], added: [code] })).find((c) => c.code === code)
    if (!found) return setAddError('Không tìm thấy bò đang nuôi có mã này.')
    setTarget({ ...target, added: target.added.includes(code) ? target.added : [...target.added, code], excluded: target.excluded.filter((c) => c !== code) })
    setAdding(null)
    setAddError('')
  }

  const save = async () => {
    setSaving(true)
    setErrors({})
    try {
      const result = s ? await vaccinationApi.updateSchedule(s.id, command) : await vaccinationApi.createSchedule(command)
      navigate('/tiem-phong', { state: { notice: result.message } })
    } catch (error) {
      if (error instanceof VaccinationValidationError) setErrors(error.fields)
      else setErrors({ form: userFacingError(error, 'Không lưu được lịch tiêm. Vui lòng thử lại.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={TITLE} sub={s ? `${s.name} · đang chạy từ ${fmtDate(s.firstDueDate)}` : 'Tạo lịch tiêm mới cho một nhóm bò'}>
        {s && <Button onClick={() => openModal('stop')}>Dừng lịch</Button>}
        <Button variant="primary" disabled={saving} onClick={() => void save()}>Lưu lịch</Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="ms-pick" className="text-xs font-medium text-ink">Lịch đang chạy</label>
        <Select id="ms-pick" className="w-[320px] max-w-full" value={String(selectedId)} onChange={(e) => onSelect(e.target.value)}>
          {cards.map((c) => <option key={c.schedule.id} value={c.schedule.id}>{c.schedule.name}</option>)}
          <option value="new">+ Lịch mới</option>
        </Select>
      </div>
      {errors.form && <Note tone="err">{errors.form}</Note>}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,720fr)_minmax(0,376fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Thông tin lịch">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên lịch *" id="ms-name"><input id="ms-name" className={inputCls} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /><FieldError>{errors.name}</FieldError></Field>
              <Field label="Vắc-xin (danh mục trại) *" id="ms-vaccine">
                <Select id="ms-vaccine" value={vaccineId} onChange={(e) => setVaccineId(e.target.value)}>{options.vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>
                <FieldError>{errors.vaccineId}</FieldError>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Ngày bắt đầu *" id="ms-first"><DateInput id="ms-first" value={firstDue} onChange={setFirstDue} /><FieldError>{errors.firstDueDate}</FieldError></Field>
              <Field label="Số mũi *" id="ms-count" hint="1 – 10"><input id="ms-count" type="number" className={inputCls} value={doseCount} onChange={(e) => setDoseCount(e.target.value)} /><FieldError>{errors.doseCount}</FieldError></Field>
              <Field label="Cách giữa mũi" id="ms-gap" hint={parseNum(doseCount) && parseNum(doseCount)! > 1 ? 'Bắt buộc khi có từ 2 mũi · ngày' : 'ngày'}><input id="ms-gap" type="number" className={inputCls} value={interval} onChange={(e) => setInterval(e.target.value)} /><FieldError>{errors.intervalDays}</FieldError></Field>
              <Field label="Nhắc lại sau" id="ms-booster" hint="Không bắt buộc · tháng"><input id="ms-booster" type="number" className={inputCls} value={booster} onChange={(e) => setBooster(e.target.value)} /><FieldError>{errors.boosterIntervalMonths}</FieldError></Field>
            </div>
          </Card>
          <Card title="Nhóm bò áp dụng" sub="Các điều kiện kết hợp với nhau (VÀ)" actions={<Badge tone={matches.length ? 'ok' : 'err'}>{matches.length} con khớp</Badge>}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Chuồng" id="ms-pens"><MultiSelect id="ms-pens" label="Chuồng" options={options.pens.map((p) => ({ value: p.code, label: p.label }))} value={target.penCodes} onChange={(v) => set('penCodes', v)} /></Field>
              <Field label="Nhóm đàn" id="ms-groups"><MultiSelect id="ms-groups" label="Nhóm đàn" options={options.herdGroups} value={target.herdGroups} onChange={(v) => set('herdGroups', v)} /></Field>
              <Field label="Giai đoạn" id="ms-stages"><MultiSelect id="ms-stages" label="Giai đoạn" options={options.lifeStages} value={target.lifeStages} onChange={(v) => set('lifeStages', v)} /></Field>
            </div>
            {matches.length === 0 ? (
              <Note tone="warn">Không có bò đang nuôi nào khớp với nhóm đã chọn.</Note>
            ) : (
              <Table stack={false} scroll>
                <thead><tr><Th>Bò</Th><Th>Chuồng</Th><Th>Nhóm đàn</Th><Th>{''}</Th></tr></thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.code}>
                      <Td><span className="font-medium">{c.code}</span><span className="block text-[11px] text-muted">{c.breed} · {c.sex}</span></Td>
                      <Td>{c.penName}</Td>
                      <Td>{groupLabel(c.herdGroup)}</Td>
                      <Td><Button variant="link" aria-label={`Bỏ ${c.code} ra`} onClick={() => remove(c.code)}>Bỏ ra</Button></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {matches.length > 3 && <Button variant="link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Thu gọn' : `Xem tất cả ${matches.length} con →`}</Button>}
              <div className="flex-1" />
              {adding === null ? (
                <Button size="sm" onClick={() => setAdding('')}>+ Thêm bò</Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input aria-label="Mã bò cần thêm" placeholder="VD: BC-000150" className={`${inputCls} !h-9 w-40`} value={adding} onChange={(e) => { setAdding(e.target.value); setAddError('') }} />
                  <Button size="sm" onClick={() => void add()}>Thêm</Button>
                  <Button size="sm" variant="link" onClick={() => { setAdding(null); setAddError('') }}>Hủy</Button>
                  <FieldError>{addError}</FieldError>
                </div>
              )}
            </div>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Vắc-xin tham chiếu" sub="Lấy từ danh mục, chỉ xem">
            <Info cols={2} items={[['Phòng bệnh', vaccine?.disease ?? '—'], ['Liều tham chiếu', vaccine ? `${vaccine.referenceDose} ${vaccine.doseUnit}` : '—'], ['Đường tiêm', vaccine ? ROUTE_LABEL[vaccine.route] : '—'], ['Ngưng sử dụng thịt', vaccine ? `${vaccine.withdrawalDays} ngày` : '—']]} />
          </Card>
          <Card title="Các mũi theo lịch">
            <div className="flex flex-col gap-2">
              {(plan.data ?? []).map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-2 rounded-md border border-rule p-3">
                  <div><div className="text-[13px] font-semibold">{r.label}</div><div className="text-xs text-muted">{fmtDate(r.date)} · {r.count} con</div></div>
                  <Badge tone={r.tone} icon={r.tone === 'warn' ? 'alert-triangle' : undefined}>{r.badge}</Badge>
                </div>
              ))}
            </div>
            <Note tone="info">Sửa lịch chỉ áp dụng cho các mũi chưa tiêm. Dừng lịch cần nhập lý do.</Note>
          </Card>
        </div>
      </div>
      <Foot>Màn tạo, sửa hoặc dừng lịch tiêm (chỉ Quản lý). Tên lịch không trùng với lịch đang chạy; "Cách giữa mũi" bắt buộc khi có từ 2 mũi. Danh sách bò khớp được tính lại khi đổi điều kiện; có thể bỏ ra hoặc thêm từng con.</Foot>
      {modal === 'stop' && s && <StopModal name={s.name} version={s.version} onClose={closeModal} />}
    </div>
  )
}

function StopModal({ name, version, onClose }: { name: string; version: number; onClose: () => void }) {
  const navigate = useNavigate()
  const [id] = useSearchParams()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<FieldErrors>({})
  const scheduleId = Number(id.get('id')) || 1
  const submit = async () => {
    try {
      const result = await vaccinationApi.stopSchedule(scheduleId, { reason, expectedVersion: version })
      navigate('/tiem-phong', { state: { notice: result.message } })
    } catch (e) {
      setError(e instanceof VaccinationValidationError ? e.fields : { form: userFacingError(e, 'Không dừng được lịch. Vui lòng thử lại.') })
    }
  }
  return (
    <Modal title="Dừng lịch tiêm" sub={name} width={560} onClose={onClose}>
      <Note tone="warn">Dừng lịch {name}? Các mũi chưa tiêm hoặc đang hoãn sẽ bị hủy. Các mũi đã tiêm vẫn được giữ.</Note>
      <Field label="Lý do *" id="st-reason" hint="Tối đa 500 ký tự">
        <Textarea id="st-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <FieldError>{error.reason}</FieldError>
      </Field>
      {error.form && <Note tone="err">{error.form}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="danger" onClick={() => void submit()}>Dừng lịch</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
