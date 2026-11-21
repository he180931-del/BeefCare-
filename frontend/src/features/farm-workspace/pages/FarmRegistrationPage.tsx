import { useFarmRegistration } from '../hooks/useFarmRegistration'
import { Button, Card, Field, Foot, Icon, inputCls, Modal, ModalButton, Note, Select } from '../../../shared/ui'
import { BreedMultiSelect } from '../components/BreedMultiSelect'
import SetupLayout from '../components/SetupLayout'
import { FieldError, Stepper } from '../components/WorkspaceUi'
import { HERD_SIZES, PROVINCES } from '../constants/provinces'
import type { ExpectedHerdSize } from '../types'

/** SCR-10 (UC-FE02-01), bước 2 của đăng ký chủ trại. */
export default function FarmRegistrationPage() {
  const { form, set, errors, error, saving, profileRequired, back, openOwnerProfile, submit } = useFarmRegistration()
  // SCR-10 #11 "Quay lại" returns to SCR-07 / SCR-09: the previous page of the app when there is one (SCR-07 during
  // onboarding, SCR-09 otherwise); a page opened straight from a link ("default" location) goes to Select Farm instead
  // of leaving BeefCare.
  return (
    <SetupLayout
      narrow step={2} eyebrow="Thiết lập trại" heading="Mỗi trại một hồ sơ rõ ràng."
      lines={['Thông tin, quyền truy cập và dịch vụ được quản lý riêng cho từng trại.']}
    >
      <Stepper current={2} />
      <Card title="Đăng ký trang trại">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <Note tone="err">{error}</Note>}
          <Field label="Tên trại *" id="farm-name"><input id="farm-name" aria-invalid={errors.name ? true : undefined} autoComplete="organization" maxLength={150} placeholder="Trại Tản Lĩnh" value={form.name} onChange={(event) => set('name', event.target.value)} className={inputCls} /><FieldError>{errors.name}</FieldError></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tỉnh/Thành *" id="farm-province"><Select className="[&_select]:!bg-white" id="farm-province" aria-invalid={errors.province ? true : undefined} value={form.province} onChange={(event) => set('province', event.target.value)}><option value="">Chọn tỉnh/thành</option>{PROVINCES.map((name) => <option key={name} value={name}>{name}</option>)}</Select><FieldError>{errors.province}</FieldError></Field>
            <Field label="Xã/Phường *" id="farm-commune"><input id="farm-commune" aria-invalid={errors.commune ? true : undefined} autoComplete="address-level2" maxLength={150} placeholder="Xã Tản Lĩnh, Ba Vì" value={form.commune} onChange={(event) => set('commune', event.target.value)} className={inputCls} /><FieldError>{errors.commune}</FieldError></Field>
          </div>
          <Field label="Địa chỉ chi tiết (không bắt buộc)" id="farm-address"><input id="farm-address" aria-invalid={errors.detailedAddress ? true : undefined} autoComplete="street-address" maxLength={255} placeholder="Thôn Bơn, xã Tản Lĩnh" value={form.detailedAddress} onChange={(event) => set('detailedAddress', event.target.value)} className={inputCls} /><FieldError>{errors.detailedAddress}</FieldError></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Người liên hệ" id="farm-contact-person"><input id="farm-contact-person" aria-invalid={errors.contactPerson ? true : undefined} maxLength={100} value={form.contactPerson} onChange={(event) => set('contactPerson', event.target.value)} className={inputCls} /><FieldError>{errors.contactPerson}</FieldError></Field>
            <Field label="Điện thoại liên hệ" id="farm-contact-phone"><input id="farm-contact-phone" aria-invalid={errors.contactPhone ? true : undefined} type="tel" value={form.contactPhone} onChange={(event) => set('contactPhone', event.target.value)} className={inputCls} /><FieldError>{errors.contactPhone}</FieldError></Field>
          </div>
          <Field label="Thông tin giấy chứng nhận" id="farm-certificate"><input id="farm-certificate" aria-invalid={errors.registrationCertificateInfo ? true : undefined} maxLength={255} placeholder="Số 01/GCN-TT – UBND huyện Ba Vì" value={form.registrationCertificateInfo} onChange={(event) => set('registrationCertificateInfo', event.target.value)} className={inputCls} /><FieldError>{errors.registrationCertificateInfo}</FieldError></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quy mô dự kiến" id="farm-herd-size"><Select className="[&_select]:!bg-white" id="farm-herd-size" aria-invalid={errors.expectedHerdSize ? true : undefined} value={form.expectedHerdSize ?? ''} onChange={(event) => set('expectedHerdSize', event.target.value as ExpectedHerdSize | '')}><option value="">Chọn quy mô</option>{HERD_SIZES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><FieldError>{errors.expectedHerdSize}</FieldError></Field>
            <Field label="Giống chủ lực" id="farm-breeds" hint="Chọn nhiều từ danh mục giống có sẵn · giống được chọn bật sẵn cho trại"><BreedMultiSelect id="farm-breeds" value={form.mainBreedCodes ?? []} onChange={(codes) => set('mainBreedCodes', codes)} /></Field>
          </div>
          {/* Both buttons on the right, as in Figma 2473:6863. */}
          <div className="flex flex-wrap justify-end gap-3">
            <Button size="lg" onClick={back}><Icon name="arrow-left" size={16} />Quay lại</Button>
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
