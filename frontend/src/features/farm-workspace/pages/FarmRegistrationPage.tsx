import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, inputCls, Note } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { STARTER_BREEDS } from '../data/starterBreeds'
import { farmWorkspaceError, FormErrors as ErrorSummary, OnboardingSteps, StandaloneFrame } from '../components/WorkspaceUi'
import { validateFarmRegistration, type FormErrors } from '../validation'
import type { ExpectedHerdSize, FarmRegistrationInput } from '../types'
import { useQuery } from '../../../hooks/useApi'

const initialForm: FarmRegistrationInput = {
  name: '', province: '', commune: '', detailedAddress: '', contactPerson: '', contactPhone: '',
  registrationCertificateInfo: '', expectedHerdSize: '' as ExpectedHerdSize, mainBreedCodes: [],
}

export default function FarmRegistrationPage() {
  const navigate = useNavigate()
  const ownerProfile = useQuery(() => farmWorkspaceApi.getProfile(), [])
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<FormErrors<FarmRegistrationInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const selectedBreeds = form.mainBreedCodes ?? []
  useEffect(() => {
    const profile = ownerProfile.data
    if (!profile) return
    setForm((current) => ({ ...current, contactPerson: current.contactPerson || profile.fullName, contactPhone: current.contactPhone || profile.phone }))
  }, [ownerProfile.data])
  const set = <K extends keyof FarmRegistrationInput>(key: K, value: FarmRegistrationInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validateFarmRegistration(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true); setError(null)
    try {
      const farm = await farmWorkspaceApi.registerFarm(form)
      navigate(`/goi-dich-vu?farmId=${farm.id}`, { replace: true, state: { notice: 'Đã tạo trang trại. Chọn gói dịch vụ để kích hoạt.' } })
    } catch (reason) { setError(farmWorkspaceError(reason, 'Không thể đăng ký trang trại lúc này.')) }
    finally { setSaving(false) }
  }
  return <StandaloneFrame title="Đăng ký trang trại" subtitle="Khai báo thông tin cơ bản để tạo không gian làm việc riêng cho đàn bò của bạn.">
    <OnboardingSteps current={2} />
    {backendMode === 'local' && <Note tone="info">Dữ liệu mô phỏng. Trại mới chỉ được lưu trong phiên hiện tại.</Note>}
    {error && <Note tone="err">{error}</Note>}
    <form onSubmit={submit} className="flex flex-col gap-5">
      <section className="flex flex-col gap-4">
        <h2 className="m-0 text-sm font-bold">Thông tin đăng ký</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên trang trại *" id="farm-name"><input id="farm-name" autoComplete="organization" maxLength={150} value={form.name} onChange={(event) => set('name', event.target.value)} className={inputCls} /></Field>
          <Field label="Tỉnh / thành phố *" id="farm-province" hint="Nhập tên tỉnh hoặc thành phố hiện tại."><input id="farm-province" autoComplete="address-level1" maxLength={150} value={form.province} onChange={(event) => set('province', event.target.value)} className={inputCls} /></Field>
          <Field label="Xã / phường *" id="farm-commune"><input id="farm-commune" autoComplete="address-level2" maxLength={150} value={form.commune} onChange={(event) => set('commune', event.target.value)} className={inputCls} /></Field>
          <Field label="Địa chỉ chi tiết" id="farm-address"><input id="farm-address" autoComplete="street-address" maxLength={255} value={form.detailedAddress} onChange={(event) => set('detailedAddress', event.target.value)} className={inputCls} /></Field>
          <Field label="Người liên hệ" id="farm-contact-person"><input id="farm-contact-person" maxLength={100} value={form.contactPerson} onChange={(event) => set('contactPerson', event.target.value)} className={inputCls} /></Field>
          <Field label="Số điện thoại liên hệ" id="farm-contact-phone"><input id="farm-contact-phone" type="tel" value={form.contactPhone} onChange={(event) => set('contactPhone', event.target.value)} className={inputCls} /></Field>
          <Field label="Thông tin giấy đăng ký" id="farm-certificate" hint="Số, nơi cấp, ngày cấp (nếu có)."><input id="farm-certificate" maxLength={255} value={form.registrationCertificateInfo} onChange={(event) => set('registrationCertificateInfo', event.target.value)} className={inputCls} /></Field>
          <Field label="Quy mô đàn dự kiến *" id="farm-herd-size"><select id="farm-herd-size" value={form.expectedHerdSize} onChange={(event) => set('expectedHerdSize', event.target.value as ExpectedHerdSize)} className={inputCls}><option value="">Chọn quy mô</option><option value="UNDER_50">Dưới 50 con</option><option value="50_149">50–149 con</option><option value="150_300">150–300 con</option><option value="OVER_300">Trên 300 con</option></select></Field>
        </div>
      </section>
      <section className="flex flex-col gap-3 border-t border-rule pt-4">
        <div><h2 className="m-0 text-sm font-bold">Giống bò chính</h2><p className="mb-0 mt-1 text-xs text-subtle">Có thể chọn nhiều giống; để trống nếu chưa xác định.</p></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{STARTER_BREEDS.map((breed) => <label key={breed.code} className="flex items-center gap-2 rounded-lg border border-field px-3 py-2.5 text-xs"><input type="checkbox" checked={selectedBreeds.includes(breed.code)} onChange={(event) => set('mainBreedCodes', event.target.checked ? [...selectedBreeds, breed.code] : selectedBreeds.filter((code) => code !== breed.code))} className="accent-brand" />{breed.name}</label>)}</div>
      </section>
      <ErrorSummary errors={errors as Record<string, string | undefined>} />
      <div className="flex flex-wrap justify-between gap-3 border-t border-rule pt-4"><Button onClick={() => navigate(-1)}>Quay lại</Button><Button type="submit" variant="primary" size="lg" disabled={saving}>{saving ? 'Đang tạo trại…' : 'Tạo trại và tiếp tục'}</Button></div>
    </form>
  </StandaloneFrame>
}
