import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, ErrorBlock, Field, Foot, Info, LoadingBlock, Note, PageHeader } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { PROVINCES, TIME_ZONES } from '../data/provinces'
import { Avatar, farmWorkspaceError, FieldError, formatDate, pageInputCls, PageSelect, serviceLabel } from '../components/WorkspaceUi'
import { useFarmId } from '../components/useFarmId'
import type { FarmDetails, FarmInfoInput } from '../types'
import { validateFarmInfo, type FormErrors } from '../validation'

const toForm = (farm: FarmDetails): FarmInfoInput => ({
  name: farm.name, province: farm.province ?? '', commune: farm.commune ?? '', detailedAddress: farm.detailedAddress ?? '',
  contactPerson: farm.contactPerson, contactPhone: farm.contactPhone, registrationCertificateInfo: farm.registrationCertificateInfo,
  timeZone: farm.timeZone || 'Asia/Ho_Chi_Minh', morningShiftStart: farm.morningShiftStart, operatingNotes: farm.operatingNotes,
  mainBreedIds: farm.mainBreedIds, expectedVersion: farm.version,
})

const daysLeft = (farm: FarmDetails) => farm.daysRemaining ?? (farm.serviceUntil ? Math.max(0, Math.ceil((Date.parse(`${farm.serviceUntil.slice(0, 10)}T23:59:59+07:00`) - Date.now()) / 86_400_000)) : null)

/** SCR-11: Chủ trại xem và sửa thông tin trại ở mọi trạng thái dịch vụ. */
export default function FarmInformationPage() {
  const navigate = useNavigate()
  const session = useSession()
  const farmId = useFarmId()
  const query = useQuery(() => farmWorkspaceApi.getFarm(farmId), [farmId])
  const [form, setForm] = useState<FarmInfoInput | null>(null)
  const [errors, setErrors] = useState<FormErrors<FarmInfoInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (query.data) setForm(toForm(query.data)) }, [query.data])
  const set = <K extends keyof FarmInfoInput>(key: K, value: FarmInfoInput[K]) => setForm((current) => current ? { ...current, [key]: value } : current)

  const farm = query.data
  const owner = (session?.role ?? farm?.role) === 'OWNER'
  if (query.loading && !farm) return <Layout title="Thông tin trại"><LoadingBlock /></Layout>
  if (query.error || !farm) return <Layout title="Thông tin trại"><ErrorBlock message={userFacingError(query.error, 'Không tải được thông tin trại. Hãy kiểm tra quyền truy cập hoặc kết nối.')} onRetry={query.refetch} /></Layout>

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form || !owner) return
    const next = validateFarmInfo(form)
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true); setError(null); setNotice(null)
    try { await farmWorkspaceApi.updateFarm(farmId, form); await query.refetch(); setNotice('Thông tin trang trại đã được cập nhật.') }
    catch (reason) { setError(farmWorkspaceError(reason, 'Không thể lưu thông tin trang trại.')) }
    finally { setSaving(false) }
  }
  const text = (key: 'name' | 'commune' | 'detailedAddress' | 'contactPerson' | 'contactPhone' | 'registrationCertificateInfo', id: string, label: string, max: number, type = 'text'): ReactNode => (
    <Field label={label} id={id}><input id={id} type={type} maxLength={max} value={form?.[key] ?? ''} onChange={(event) => set(key, event.target.value)} className={pageInputCls} disabled={!owner} /><FieldError>{errors[key]}</FieldError></Field>
  )
  const provinces = form?.province && !PROVINCES.some((name) => name === form.province) ? [form.province, ...PROVINCES] : PROVINCES
  const days = daysLeft(farm)
  return (
    <Layout title="Thông tin trại">
      <PageHeader title="Thông tin trại"><Button variant="primary" type="submit" form="farm-info-form" disabled={!owner || saving || !form}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</Button></PageHeader>
      {!owner && <Note tone="warn">Thông tin trang trại chỉ dành cho Chủ trại. Quyền truy cập cũng được máy chủ kiểm tra.</Note>}
      {error && <Note tone="err">{error}</Note>}{notice && <Note tone="ok">{notice}</Note>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_376px]">
        <form id="farm-info-form" onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-5">
          <Card title="Đăng ký & liên hệ">
            {text('name', 'farm-info-name', 'Tên trại *', 150)}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tỉnh/Thành *" id="farm-info-province"><PageSelect id="farm-info-province" value={form?.province ?? ''} onChange={(event) => set('province', event.target.value)} disabled={!owner}><option value="">Chọn tỉnh/thành</option>{provinces.map((name) => <option key={name} value={name}>{name}</option>)}</PageSelect><FieldError>{errors.province}</FieldError></Field>
              {text('commune', 'farm-info-commune', 'Xã/Phường *', 150)}
            </div>
            {text('detailedAddress', 'farm-info-address', 'Địa chỉ chi tiết', 255)}
            <div className="grid gap-3 sm:grid-cols-2">
              {text('contactPerson', 'farm-info-contact', 'Người liên hệ', 100)}
              {text('contactPhone', 'farm-info-phone', 'Điện thoại liên hệ', 20, 'tel')}
            </div>
            {text('registrationCertificateInfo', 'farm-info-certificate', 'Thông tin giấy chứng nhận', 255)}
          </Card>
          <Card title="Thông tin vận hành">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Múi giờ" id="farm-time-zone"><PageSelect id="farm-time-zone" value={form?.timeZone ?? ''} onChange={(event) => set('timeZone', event.target.value)} disabled={!owner}>{(TIME_ZONES.some(([value]) => value === form?.timeZone) ? TIME_ZONES : [...TIME_ZONES, [form?.timeZone ?? '', form?.timeZone ?? '']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</PageSelect><FieldError>{errors.timeZone}</FieldError></Field>
              <Field label="Giờ bắt đầu ca sáng" id="farm-morning-shift"><input id="farm-morning-shift" type="time" value={form?.morningShiftStart ?? ''} onChange={(event) => set('morningShiftStart', event.target.value)} className={pageInputCls} disabled={!owner} /><FieldError>{errors.morningShiftStart}</FieldError></Field>
            </div>
            <Field label="Ghi chú vận hành" id="farm-operating-notes"><textarea id="farm-operating-notes" rows={3} maxLength={1000} value={form?.operatingNotes ?? ''} onChange={(event) => set('operatingNotes', event.target.value)} className={`${pageInputCls} h-auto py-2`} disabled={!owner} /><FieldError>{errors.operatingNotes}</FieldError></Field>
          </Card>
        </form>
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="Trạng thái dịch vụ" actions={<Badge tone={farm.serviceStatus === 'ACTIVE' ? 'ok' : farm.serviceStatus === 'SUSPENDED' ? 'err' : 'warn'}>{serviceLabel(farm.serviceStatus)}</Badge>}>
            <Info cols={2} items={[
              ['Kỳ hiện tại đến', farm.serviceUntil ? formatDate(farm.serviceUntil) : '—'],
              ['Mở gia hạn từ', farm.renewalOpensAt ? formatDate(farm.renewalOpensAt) : '—'],
              ['Tạm ngưng', farm.serviceStatus === 'SUSPENDED' ? `Có${farm.suspendedAt ? ` · ${formatDate(farm.suspendedAt)}` : ''}` : 'Không'],
              ['Còn lại', days == null ? '—' : `${days} ngày`],
            ]} />
            <Button block onClick={() => navigate(`/goi-dich-vu?farmId=${farmId}`)}>Xem gói dịch vụ</Button>
          </Card>
          <Card title="Chủ sở hữu">
            <div className="flex items-center gap-3">
              <Avatar name={farm.ownerName ?? session?.fullName ?? '?'} />
              <div><div className="text-[13px] font-semibold text-[#212121]">{farm.ownerName ?? session?.fullName ?? 'Chưa có dữ liệu từ máy chủ'}</div><div className="text-xs text-muted">{farm.ownerEmail ?? 'Chưa có dữ liệu từ máy chủ'}</div></div>
            </div>
          </Card>
        </div>
      </div>
      <Foot>Múi giờ áp dụng cho lịch nhắc và thời điểm ghi nhận; giờ bắt đầu ca là mốc cho lịch vận hành; ghi chú lưu quy trình thường lệ của trại.</Foot>
    </Layout>
  )
}
