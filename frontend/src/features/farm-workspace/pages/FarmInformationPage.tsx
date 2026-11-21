import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, Button, Card, ErrorBlock, Field, Foot, Info, LoadingBlock, Note, PageHeader } from '../../../shared/ui'
import { homePathFor } from '../../authorization'
import { roleInFarm, useSession } from '../../../app/session/sessionContext'
import { Avatar, FieldError, formatDate, lastServiceDay, pageInputCls, PageSelect, serviceLabel } from '../components/WorkspaceUi'
import { serviceView } from '../domain/statusViews'
import { useFarmInformationForm } from '../hooks/useFarmInformationForm'
import { useFarmId } from '../hooks/useFarmId'

/**
 * SCR-11 (UC-FE02-03): only the Owner views and updates farm information, in every service status (GBR-07, GBR-14).
 * Another role is sent to its own home without loading the farm (decision 08/11/2026, TC-02-17).
 */
export default function FarmInformationPage() {
  const session = useSession()
  const farmId = useFarmId()
  const role = session ? roleInFarm(session, farmId) : 'OWNER'
  if (role !== 'OWNER') return <Navigate to={homePathFor(role)} replace />
  return <FarmInformationForm />
}

function FarmInformationForm() {
  const { navigate, session, farmId, query, form, set, errors, error, notice, saving, submit, provinces, days } = useFarmInformationForm()

  const farm = query.data
  if (query.loading && !farm) return <Layout title="Thông tin trại"><LoadingBlock /></Layout>
  if (query.error || !farm) return <Layout title="Thông tin trại"><ErrorBlock message={userFacingError(query.error, 'Không tải được thông tin trại. Hãy kiểm tra quyền truy cập hoặc kết nối.')} onRetry={query.refetch} /></Layout>

  const text = (key: 'name' | 'commune' | 'detailedAddress' | 'contactPerson' | 'contactPhone' | 'registrationCertificateInfo', id: string, label: string, max: number, type = 'text'): ReactNode => (
    <Field label={label} id={id}><input id={id} type={type} maxLength={max} aria-invalid={errors[key] ? true : undefined} value={form?.[key] ?? ''} onChange={(event) => set(key, event.target.value)} className={pageInputCls} /><FieldError>{errors[key]}</FieldError></Field>
  )
  // A saved province stays visible even if it is absent from the current list.
  return (
    <Layout title="Thông tin trại">
      <PageHeader title="Thông tin trại"><Button variant="primary" type="submit" form="farm-info-form" disabled={saving || !form}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</Button></PageHeader>
      {error && <Note tone="err">{error}</Note>}{notice && <Note tone="ok">{notice}</Note>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_376px]">
        <form id="farm-info-form" onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-5">
          <Card title="Đăng ký & liên hệ">
            {text('name', 'farm-info-name', 'Tên trại *', 150)}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tỉnh/Thành *" id="farm-info-province"><PageSelect id="farm-info-province" aria-invalid={errors.province ? true : undefined} value={form?.province ?? ''} onChange={(event) => set('province', event.target.value)}><option value="">Chọn tỉnh/thành</option>{provinces.map((name) => <option key={name} value={name}>{name}</option>)}</PageSelect><FieldError>{errors.province}</FieldError></Field>
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
              {/* Read-only (D39), so it looks like a locked field instead of an editable white one. */}
              <Field label="Múi giờ" id="farm-time-zone"><input id="farm-time-zone" value="UTC+7 (giờ Việt Nam)" readOnly className={`${pageInputCls} read-only:bg-chip read-only:text-muted`} /></Field>
              <Field label="Giờ bắt đầu ca sáng" id="farm-morning-shift"><input id="farm-morning-shift" aria-invalid={errors.morningShiftStart ? true : undefined} type="time" value={form?.morningShiftStart ?? ''} onChange={(event) => set('morningShiftStart', event.target.value)} className={pageInputCls} /><FieldError>{errors.morningShiftStart}</FieldError></Field>
            </div>
            <Field label="Ghi chú vận hành" id="farm-operating-notes"><textarea id="farm-operating-notes" aria-invalid={errors.operatingNotes ? true : undefined} rows={3} maxLength={1000} value={form?.operatingNotes ?? ''} onChange={(event) => set('operatingNotes', event.target.value)} className={`${pageInputCls} h-auto resize-none py-2`} /><FieldError>{errors.operatingNotes}</FieldError></Field>
          </Card>
        </form>
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="Trạng thái dịch vụ" actions={<Badge tone={serviceView(farm.serviceStatus).tone}>{serviceLabel(farm.serviceStatus)}</Badge>}>
            <Info cols={2} items={[
              ['Kỳ hiện tại đến', farm.serviceUntil ? lastServiceDay(farm.serviceUntil) : '—'],
              ['Mở gia hạn từ', farm.renewalOpensAt ? formatDate(farm.renewalOpensAt) : '—'],
              ['Tạm ngưng', farm.serviceStatus === 'SUSPENDED' ? `Có${farm.suspendedAt ? ` · ${formatDate(farm.suspendedAt)}` : ''}` : 'Không'],
              ['Còn lại', days == null ? '—' : `${days} ngày`],
            ]} />
            <Button block onClick={() => navigate(`/goi-dich-vu?farm=${farmId}`)}>Xem gói dịch vụ</Button>
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
