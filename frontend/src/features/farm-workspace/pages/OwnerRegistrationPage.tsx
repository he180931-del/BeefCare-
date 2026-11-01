import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { validateOwnerProfile, type FormErrors } from '../validation'
import type { CompleteOwnerProfileInput, FarmWorkspaceProfile } from '../types'
import { Button, Field, inputCls, Note } from '../../../components/ui'
import { farmWorkspaceError, FormErrors as ErrorSummary, OnboardingSteps, StandaloneFrame } from '../components/WorkspaceUi'
import { useQuery } from '../../../hooks/useApi'

export default function OwnerRegistrationPage() {
  const navigate = useNavigate()
  const query = useQuery(() => farmWorkspaceApi.getProfile(), [])
  const [form, setForm] = useState<CompleteOwnerProfileInput>({ fullName: '', phone: '', termsAccepted: false })
  const [errors, setErrors] = useState<FormErrors<CompleteOwnerProfileInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (query.data) setForm({ fullName: query.data.fullName, phone: query.data.phone, termsAccepted: query.data.ownerRegistrationCompleted })
  }, [query.data])
  const profile = query.data as FarmWorkspaceProfile | null
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validateOwnerProfile(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true); setError(null)
    try { await farmWorkspaceApi.completeOwnerRegistration(form); navigate('/dang-ky-trai', { replace: true }) }
    catch (reason) { setError(farmWorkspaceError(reason, 'Không thể lưu hồ sơ lúc này.')) }
    finally { setSaving(false) }
  }
  return <StandaloneFrame title="Hoàn tất hồ sơ chủ trại" subtitle="Hoàn tất thông tin cá nhân trước khi đăng ký trang trại.">
    <OnboardingSteps current={1} />
    {query.loading && !query.data && <Note>Đang tải hồ sơ…</Note>}
    {Boolean(query.error) && <Note tone="err">Không tải được hồ sơ tài khoản. Hãy thử tải lại trang.</Note>}
    <form onSubmit={submit} className="flex flex-col gap-5">
      {error && <Note tone="err">{error}</Note>}
      <div className="rounded-xl bg-page p-4 text-sm"><span className="block text-xs text-subtle">Email đăng nhập</span><strong>{profile?.email ?? 'Đang tải…'}</strong><div className="mt-1 text-xs text-subtle">{profile?.emailVerified ? 'Email đã xác minh' : 'Trạng thái xác minh sẽ được kiểm tra với tài khoản'}</div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ và tên *" id="owner-full-name"><input id="owner-full-name" autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className={inputCls} maxLength={100} /></Field>
        <Field label="Số điện thoại liên hệ" id="owner-phone" hint="Không bắt buộc · 10 số bắt đầu bằng 0 hoặc +84."><input id="owner-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={inputCls} /></Field>
      </div>
      <ErrorSummary errors={errors as Record<string, string | undefined>} />
      <label className="flex items-start gap-2 text-xs leading-5 text-subtle"><input type="checkbox" className="mt-1 accent-brand" checked={form.termsAccepted} onChange={(event) => setForm({ ...form, termsAccepted: event.target.checked })} /><span>Tôi đồng ý với Điều khoản sử dụng và Chính sách dữ liệu.</span></label>
      <div className="flex justify-end border-t border-rule pt-4"><Button type="submit" variant="primary" size="lg" disabled={saving || query.loading}>{saving ? 'Đang lưu…' : 'Hoàn tất và tiếp tục'}</Button></div>
    </form>
  </StandaloneFrame>
}
