import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackendError } from '../../../api/backendClient'
import { Icon } from '../../../components/Icon'
import Modal, { ModalButton } from '../../../components/Modal'
import { Button, Card, Field, Foot, inputCls, Note, Select } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { BreedMultiSelect } from '../components/BreedMultiSelect'
import SetupLayout from '../components/SetupLayout'
import { farmWorkspaceError, FieldError, Stepper } from '../components/WorkspaceUi'
import { HERD_SIZES, PROVINCES } from '../data/provinces'
import { useRequestKey } from '../hooks/useRequestKey'
import type { ExpectedHerdSize, FarmRegistrationInput } from '../types'
import { validateFarmRegistration, type FormErrors } from '../validation'

const initialForm: FarmRegistrationInput = {
  name: '', province: '', commune: '', detailedAddress: '', contactPerson: '', contactPhone: '',
  registrationCertificateInfo: '', expectedHerdSize: '', mainBreedCodes: [],
}

const OWNER_PROFILE_REQUIRED = 'MSG-FE02-02'

/** SCR-10 (UC-FE02-01), bước 2 của đăng ký chủ trại. */
export default function FarmRegistrationPage() {
  const navigate = useNavigate()
  const ownerProfile = useQuery(() => farmWorkspaceApi.getProfile(), [])
  const requestKey = useRequestKey('farm-registration')
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<FormErrors<FarmRegistrationInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [profileRequired, setProfileRequired] = useState(false)
  useEffect(() => {
    const profile = ownerProfile.data
    if (!profile) return
    // E1 (R-02-01): chưa hoàn tất hồ sơ Chủ trại → MSG-FE02-02 rồi mở SCR-07.
    if (!profile.ownerRegistrationCompleted) setProfileRequired(true)
    setForm((current) => ({ ...current, contactPerson: current.contactPerson || profile.fullName, contactPhone: current.contactPhone || profile.phone }))
  }, [ownerProfile.data])
  const set = <K extends keyof FarmRegistrationInput>(key: K, value: FarmRegistrationInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const openOwnerProfile = () => navigate('/owner-registration', { replace: true })
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next = validateFarmRegistration(form)
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true); setError(null)
    try {
      // Cùng dữ liệu → cùng khóa: bấm lại sau lỗi mạng hoặc tải lại trang không tạo trại thứ hai (R-02-02).
      const farm = await farmWorkspaceApi.registerFarm(form, { idempotencyKey: requestKey.keyFor(form) })
      requestKey.clear()
      // Bước 3 của onboarding: SCR-58 chọn gói cho đúng trại vừa tạo (MSG-FE02-01).
      navigate(`/dang-ky-goi?farm=${farm.id}`, { replace: true, state: { notice: `Đã đăng ký trại ${farm.name}. Hãy chọn gói để kích hoạt.` } })
    } catch (reason) {
      if (reason instanceof BackendError && reason.code?.toUpperCase() === OWNER_PROFILE_REQUIRED) setProfileRequired(true)
      else setError(farmWorkspaceError(reason, 'Không lưu được dữ liệu. Vui lòng thử lại.'))
    }
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
            <Field label="Quy mô dự kiến" id="farm-herd-size"><Select className="[&_select]:!bg-white" id="farm-herd-size" value={form.expectedHerdSize ?? ''} onChange={(event) => set('expectedHerdSize', event.target.value as ExpectedHerdSize | '')}><option value="">Chọn quy mô</option>{HERD_SIZES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><FieldError>{errors.expectedHerdSize}</FieldError></Field>
            <Field label="Giống chủ lực" id="farm-breeds" hint="Chọn nhiều từ danh mục giống có sẵn · giống được chọn bật sẵn cho trại"><BreedMultiSelect id="farm-breeds" value={form.mainBreedCodes ?? []} onChange={(codes) => set('mainBreedCodes', codes)} /></Field>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button size="lg" onClick={() => navigate(-1)}><Icon name="arrow-left" size={16} />Quay lại</Button>
            <Button type="submit" variant="primary" size="lg" disabled={saving || profileRequired}><Icon name="circle-plus" size={16} />{saving ? 'Đang tạo trại…' : 'Tạo trại và tiếp tục'}</Button>
          </div>
        </form>
      </Card>
      <Foot>Trường có * bắt buộc. Địa chỉ chi tiết bổ sung thôn/xóm; người liên hệ và điện thoại là đầu mối của trại; giấy chứng nhận, quy mô và giống giúp hoàn thiện hồ sơ.</Foot>
      {profileRequired && (
        <Modal title="Chưa hoàn tất hồ sơ Chủ trại" width={560} onClose={openOwnerProfile}>
          <p className="m-0 text-sm text-ink">Vui lòng hoàn tất hồ sơ Chủ trại trước khi đăng ký trại.</p>
          <div className="flex justify-end"><ModalButton variant="primary" onClick={openOwnerProfile}>Hoàn tất hồ sơ</ModalButton></div>
        </Modal>
      )}
    </SetupLayout>
  )
}
