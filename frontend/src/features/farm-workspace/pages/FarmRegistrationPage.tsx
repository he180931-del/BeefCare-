import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { Button, Card, Field, Foot, inputCls, Note, Select } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { BreedMultiSelect } from '../components/BreedMultiSelect'
import SetupLayout from '../components/SetupLayout'
import { farmWorkspaceError, FieldError, Stepper } from '../components/WorkspaceUi'
import { HERD_SIZES, PROVINCES } from '../data/provinces'
import type { ExpectedHerdSize, FarmRegistrationInput } from '../types'
import { validateFarmRegistration, type FormErrors } from '../validation'

const initialForm: FarmRegistrationInput = {
  name: '', province: '', commune: '', detailedAddress: '', contactPerson: '', contactPhone: '',
  registrationCertificateInfo: '', expectedHerdSize: '' as ExpectedHerdSize, mainBreedCodes: [],
}

/** SCR-10 (UC-FE02-01), bước 2 của đăng ký chủ trại. */
export default function FarmRegistrationPage() {
  const navigate = useNavigate()
  const ownerProfile = useQuery(() => farmWorkspaceApi.getProfile(), [])
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<FormErrors<FarmRegistrationInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const profile = ownerProfile.data
    if (profile) setForm((current) => ({ ...current, contactPerson: current.contactPerson || profile.fullName, contactPhone: current.contactPhone || profile.phone }))
  }, [ownerProfile.data])
  const set = <K extends keyof FarmRegistrationInput>(key: K, value: FarmRegistrationInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next = validateFarmRegistration(form)
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true); setError(null)
    try {
      const farm = await farmWorkspaceApi.registerFarm(form)
      navigate(`/goi-dich-vu?farmId=${farm.id}`, { replace: true, state: { notice: `Đã đăng ký trại ${farm.name}. Chọn gói dịch vụ để kích hoạt.` } })
    } catch (reason) { setError(farmWorkspaceError(reason, 'Không thể đăng ký trang trại lúc này.')) }
    finally { setSaving(false) }
  }
  return (
    <SetupLayout
      narrow step={2} eyebrow="Thiết lập trại" heading="Mỗi trại một hồ sơ rõ ràng."
      lines={['Thông tin, quyền truy cập và dịch vụ được quản lý riêng cho từng trại.']}
    >
      <Stepper current={2} />
      <Card title="Đăng ký trang trại">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <Note tone="err">{error}</Note>}
          <Field label="Tên trại *" id="farm-name"><input id="farm-name" autoComplete="organization" maxLength={150} placeholder="Trại Tản Lĩnh" value={form.name} onChange={(event) => set('name', event.target.value)} className={inputCls} /><FieldError>{errors.name}</FieldError></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tỉnh/Thành *" id="farm-province"><Select className="[&_select]:!bg-white" id="farm-province" value={form.province} onChange={(event) => set('province', event.target.value)}><option value="">Chọn tỉnh/thành</option>{PROVINCES.map((name) => <option key={name} value={name}>{name}</option>)}</Select><FieldError>{errors.province}</FieldError></Field>
            <Field label="Xã/Phường *" id="farm-commune"><input id="farm-commune" autoComplete="address-level2" maxLength={150} placeholder="Xã Tản Lĩnh, Ba Vì" value={form.commune} onChange={(event) => set('commune', event.target.value)} className={inputCls} /><FieldError>{errors.commune}</FieldError></Field>
          </div>
          <Field label="Địa chỉ chi tiết (không bắt buộc)" id="farm-address"><input id="farm-address" autoComplete="street-address" maxLength={255} placeholder="Thôn Bơn, xã Tản Lĩnh" value={form.detailedAddress} onChange={(event) => set('detailedAddress', event.target.value)} className={inputCls} /><FieldError>{errors.detailedAddress}</FieldError></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Người liên hệ" id="farm-contact-person"><input id="farm-contact-person" maxLength={100} value={form.contactPerson} onChange={(event) => set('contactPerson', event.target.value)} className={inputCls} /><FieldError>{errors.contactPerson}</FieldError></Field>
            <Field label="Điện thoại liên hệ" id="farm-contact-phone"><input id="farm-contact-phone" type="tel" value={form.contactPhone} onChange={(event) => set('contactPhone', event.target.value)} className={inputCls} /><FieldError>{errors.contactPhone}</FieldError></Field>
          </div>
          <Field label="Thông tin giấy chứng nhận" id="farm-certificate"><input id="farm-certificate" maxLength={255} placeholder="Số 01/GCN-TT – UBND huyện Ba Vì" value={form.registrationCertificateInfo} onChange={(event) => set('registrationCertificateInfo', event.target.value)} className={inputCls} /><FieldError>{errors.registrationCertificateInfo}</FieldError></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quy mô dự kiến *" id="farm-herd-size"><Select className="[&_select]:!bg-white" id="farm-herd-size" value={form.expectedHerdSize} onChange={(event) => set('expectedHerdSize', event.target.value as ExpectedHerdSize)}><option value="">Chọn quy mô</option>{HERD_SIZES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><FieldError>{errors.expectedHerdSize}</FieldError></Field>
            <Field label="Giống chủ lực" id="farm-breeds" hint="Chọn nhiều từ danh mục giống có sẵn · giống được chọn bật sẵn cho trại"><BreedMultiSelect id="farm-breeds" value={form.mainBreedCodes ?? []} onChange={(codes) => set('mainBreedCodes', codes)} /></Field>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button size="lg" onClick={() => navigate(-1)}><Icon name="arrow-left" size={16} className="mr-1.5" />Quay lại</Button>
            <Button type="submit" variant="primary" size="lg" disabled={saving}><Icon name="circle-plus" size={16} className="mr-1.5" />{saving ? 'Đang tạo trại…' : 'Tạo trang trại và tiếp tục'}</Button>
          </div>
        </form>
      </Card>
      <Foot>Trường có * bắt buộc. Địa chỉ chi tiết bổ sung thôn/xóm; người liên hệ và điện thoại là đầu mối của trại; giấy chứng nhận, quy mô và giống giúp hoàn thiện hồ sơ.</Foot>
    </SetupLayout>
  )
}
