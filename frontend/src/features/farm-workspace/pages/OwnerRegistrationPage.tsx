import { useOwnerRegistration } from '../hooks/useOwnerRegistration'
import { Button, Card, Field, Foot, inputCls, Note } from '../../../shared/ui'
import SetupLayout from '../components/SetupLayout'
import { FieldError, Stepper } from '../components/WorkspaceUi'

/** SCR-07, bước 1 của đăng ký chủ trại. */
export default function OwnerRegistrationPage() {
  const { query, profile, form, set, errors, error, saving, email, submit } = useOwnerRegistration()
  return (
    <SetupLayout
      narrow step={1} eyebrow="Thiết lập trại" heading="Mỗi trại một hồ sơ rõ ràng."
      lines={['Thông tin, quyền truy cập và dịch vụ được quản lý riêng cho từng trại.']}
    >
      <Stepper current={1} />
      {Boolean(query.error) && <Note tone="err">Không tải được hồ sơ tài khoản. Hãy thử tải lại trang.</Note>}
      <Card title="Hoàn tất hồ sơ chủ trại">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <Note tone="err">{error}</Note>}
          <Field label="Thư điện tử đăng nhập" id="owner-email"><input id="owner-email" readOnly value={email ? `${email} · ${profile?.emailVerified === false ? 'chưa xác minh' : `đã xác minh${profile?.googleSignInLinked ? ' qua Google' : ''}`}` : 'Đang tải…'} className={inputCls} /></Field>
          <Field label="Họ và tên *" id="owner-full-name"><input id="owner-full-name" autoComplete="name" value={form.fullName} onChange={(event) => set('fullName', event.target.value)} className={inputCls} maxLength={100} /><FieldError>{errors.fullName}</FieldError></Field>
          <Field label="Số điện thoại liên hệ" id="owner-phone"><input id="owner-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} className={inputCls} /><FieldError>{errors.phone}</FieldError></Field>
          {!query.data?.termsAccepted && !query.data?.ownerRegistrationCompleted && <div>
            <label className="flex items-center gap-2 text-[13px] text-ink"><input type="checkbox" className="size-4 accent-brand" checked={form.termsAccepted} onChange={(event) => set('termsAccepted', event.target.checked)} />Tôi đồng ý với <a href="/terms" className="font-bold text-brand underline">Điều khoản sử dụng</a> và <a href="/data-policy" className="font-bold text-brand underline">Chính sách dữ liệu</a> của BeefCare</label>
            <FieldError>{errors.termsAccepted}</FieldError>
          </div>}
          <div className="flex justify-end"><Button type="submit" variant="primary" size="lg" disabled={saving || query.loading}>{saving ? 'Đang lưu…' : 'Hoàn tất và đăng ký trang trại'}</Button></div>
        </form>
      </Card>
      <Foot>Thư điện tử đã xác minh được khóa; họ và tên và số điện thoại giúp nhận diện người chịu trách nhiệm.</Foot>
    </SetupLayout>
  )
}
