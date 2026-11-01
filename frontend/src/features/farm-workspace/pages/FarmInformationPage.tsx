import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Field, inputCls, Note, PageHeader } from '../../../components/ui'
import Layout from '../../../components/Layout'
import { backendFarmId, backendMode } from '../../../api/backendTransport'
import { useQuery } from '../../../hooks/useApi'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { validateFarmInfo, type FormErrors } from '../validation'
import type { FarmInfoInput } from '../types'
import { farmWorkspaceError, formatDate, serviceLabel } from '../components/WorkspaceUi'

function farmIdFromUrl(param?: string, searchFarmId?: string) {
  const value = param ?? searchFarmId ?? backendFarmId
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : Number(backendFarmId)
}

export default function FarmInformationPage() {
  const params = useParams<{ farmId: string }>()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const farmId = farmIdFromUrl(params.farmId, search.get('farmId') ?? undefined)
  const query = useQuery(() => farmWorkspaceApi.getFarm(farmId), [farmId])
  const [form, setForm] = useState<FarmInfoInput | null>(null)
  const [errors, setErrors] = useState<FormErrors<FarmInfoInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!query.data) return
    setForm({
      name: query.data.name, province: query.data.province ?? '', commune: query.data.commune ?? '', detailedAddress: query.data.detailedAddress ?? '',
      contactPerson: query.data.contactPerson, contactPhone: query.data.contactPhone, registrationCertificateInfo: query.data.registrationCertificateInfo,
      timeZone: query.data.timeZone || 'Asia/Ho_Chi_Minh', morningShiftStart: query.data.morningShiftStart,
      operatingNotes: query.data.operatingNotes, mainBreedIds: query.data.mainBreedIds, expectedVersion: query.data.version,
    })
  }, [query.data])
  const set = <K extends keyof FarmInfoInput>(key: K, value: FarmInfoInput[K]) => setForm((current) => current ? { ...current, [key]: value } : current)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form) return
    const nextErrors = validateFarmInfo(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true); setError(null); setNotice(null)
    try { await farmWorkspaceApi.updateFarm(farmId, form); await query.refetch(); setNotice('Đã lưu thông tin trang trại.') }
    catch (reason) { setError(farmWorkspaceError(reason, 'Không thể lưu thông tin trang trại.')) }
    finally { setSaving(false) }
  }
  const farm = query.data
  const owner = farm?.role === 'OWNER'
  return <Layout title="Thông tin trại">
    <PageHeader title="Thông tin trang trại" sub="Cập nhật thông tin đăng ký và cách vận hành của trại." />
    {backendMode === 'local' && <Note tone="info">Đây là dữ liệu mô phỏng, không gửi lên máy chủ.</Note>}
    {query.loading && !farm && <Note>Đang tải thông tin trại…</Note>}
    {Boolean(query.error) && <Note tone="err">Không tải được thông tin trại. Hãy kiểm tra quyền truy cập hoặc kết nối.</Note>}
    {error && <Note tone="err">{error}</Note>}{notice && <Note tone="ok">{notice}</Note>}
    {farm && <>
      {!owner && <Note tone="warn">Thông tin trang trại chỉ dành cho Chủ trại. Quyền truy cập cũng được máy chủ kiểm tra.</Note>}
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Card title="Thông tin đăng ký và liên hệ">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tên trang trại *" id="farm-info-name"><input id="farm-info-name" value={form?.name ?? ''} onChange={(event) => set('name', event.target.value)} className={inputCls} disabled={!owner} maxLength={150} /></Field>
            <Field label="Tỉnh / thành phố *" id="farm-info-province"><input id="farm-info-province" value={form?.province ?? ''} onChange={(event) => set('province', event.target.value)} className={inputCls} disabled={!owner} maxLength={150} /></Field>
            <Field label="Xã / phường *" id="farm-info-commune"><input id="farm-info-commune" value={form?.commune ?? ''} onChange={(event) => set('commune', event.target.value)} className={inputCls} disabled={!owner} maxLength={150} /></Field>
            <Field label="Địa chỉ chi tiết" id="farm-info-address"><input id="farm-info-address" value={form?.detailedAddress ?? ''} onChange={(event) => set('detailedAddress', event.target.value)} className={inputCls} disabled={!owner} maxLength={255} /></Field>
            <Field label="Người liên hệ" id="farm-info-contact"><input id="farm-info-contact" value={form?.contactPerson ?? ''} onChange={(event) => set('contactPerson', event.target.value)} className={inputCls} disabled={!owner} maxLength={100} /></Field>
            <Field label="Điện thoại liên hệ" id="farm-info-phone"><input id="farm-info-phone" type="tel" value={form?.contactPhone ?? ''} onChange={(event) => set('contactPhone', event.target.value)} className={inputCls} disabled={!owner} /></Field>
            <Field label="Thông tin giấy đăng ký" id="farm-info-certificate"><input id="farm-info-certificate" value={form?.registrationCertificateInfo ?? ''} onChange={(event) => set('registrationCertificateInfo', event.target.value)} className={inputCls} disabled={!owner} maxLength={255} /></Field>
            <div className="flex min-w-0 flex-col gap-1.5"><span className="text-xs font-medium text-ink">Quy mô đàn dự kiến</span><span className="rounded-xl border border-field bg-page px-2.5 py-3 text-sm text-subtle">{farm.expectedHerdSize || 'Chưa có dữ liệu từ máy chủ'}</span></div>
          </div>
        </Card>
        <Card title="Thông tin vận hành">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Múi giờ" id="farm-time-zone"><input id="farm-time-zone" value={form?.timeZone ?? ''} onChange={(event) => set('timeZone', event.target.value)} className={inputCls} disabled={!owner} /></Field>
            <Field label="Bắt đầu ca sáng" id="farm-morning-shift"><input id="farm-morning-shift" type="time" value={form?.morningShiftStart ?? ''} onChange={(event) => set('morningShiftStart', event.target.value)} className={inputCls} disabled={!owner} /></Field>
            <Field label="Ghi chú vận hành" id="farm-operating-notes"><textarea id="farm-operating-notes" value={form?.operatingNotes ?? ''} onChange={(event) => set('operatingNotes', event.target.value)} className={inputCls} rows={3} maxLength={1000} disabled={!owner} /></Field>
          </div>
          <div className="flex justify-end"><Button type="submit" variant="primary" size="lg" disabled={!owner || saving || !form}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</Button></div>
        </Card>
      </form>
      <Card title="Tình trạng dịch vụ" actions={<Badge tone={farm.serviceStatus === 'ACTIVE' ? 'ok' : farm.serviceStatus === 'SUSPENDED' ? 'err' : 'warn'}>{serviceLabel(farm.serviceStatus)}</Badge>}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          <div><span className="block text-faint">Kỳ hiện tại đến</span><strong>{farm.serviceUntil ? formatDate(farm.serviceUntil) : '—'}</strong></div>
          <div><span className="block text-faint">Gia hạn từ ngày</span><strong>{farm.renewalOpensAt ? formatDate(farm.renewalOpensAt) : '—'}</strong></div>
          <div><span className="block text-faint">Tạm ngưng</span><strong>{farm.serviceStatus === 'SUSPENDED' ? `Có · ${farm.suspendedAt ? formatDate(farm.suspendedAt) : 'Chưa có ngày từ API'}` : 'Không'}</strong></div>
          <div><span className="block text-faint">Số ngày còn lại</span><strong>{farm.daysRemaining == null ? '—' : farm.daysRemaining}</strong></div>
          <div><span className="block text-faint">Chủ trại</span><strong>{farm.ownerEmail ?? 'Chưa có dữ liệu từ máy chủ'}</strong></div>
        </div>
        <div><Button variant="link" onClick={() => navigate(`/goi-dich-vu?farmId=${farmId}`)}>Xem gói dịch vụ →</Button></div>
        {backendMode === 'backend' && farm.serviceUntil == null && <p className="m-0 text-[11px] text-subtle">Máy chủ hiện chưa trả ngày kết thúc, ngày mở gia hạn, số ngày còn lại, ngày tạm ngưng hoặc email Chủ trại.</p>}
      </Card>
      <Note tone="grey">Giống chính: {farm.mainBreedCodes.length ? farm.mainBreedCodes.join(', ') : farm.mainBreedIds.length ? `${farm.mainBreedIds.length} giống (API chỉ trả mã định danh)` : 'Chưa có dữ liệu'}</Note>
    </>}
    {!query.loading && !farm && !query.error && <Note>Chưa có thông tin trại để hiển thị.</Note>}
    {Object.keys(errors).length > 0 && <Note tone="err">{Object.values(errors).join(' ')}</Note>}
  </Layout>
}
