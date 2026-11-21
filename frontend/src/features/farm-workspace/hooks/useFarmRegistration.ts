import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BackendError } from '../../../shared/api/backendClient'
import { farmWorkspaceError } from '../components/WorkspaceUi'
import { useFarmWorkspaceUseCase } from './useFarmWorkspaceUseCase'
import { useRequestKey } from './useRequestKey'
import type { FarmRegistrationInput } from '../types'
import { validateFarmRegistration, type FormErrors } from '../validation/workspaceValidation'

export const initialFarmRegistration: FarmRegistrationInput = { name: '', province: '', commune: '', detailedAddress: '', contactPerson: '', contactPhone: '', registrationCertificateInfo: '', expectedHerdSize: '', mainBreedCodes: [] }
export function useFarmRegistration() {
  const navigate = useNavigate(); const location = useLocation(); const { profile: ownerProfile, registerFarm } = useFarmWorkspaceUseCase({ loadProfile: true })
  const requestKey = useRequestKey('farm-registration'); const [form, setForm] = useState(initialFarmRegistration)
  const [errors, setErrors] = useState<FormErrors<FarmRegistrationInput>>({}); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [profileRequired, setProfileRequired] = useState(false)
  useEffect(() => { const profile = ownerProfile.data; if (!profile) return; if (!profile.ownerRegistrationCompleted) setProfileRequired(true); setForm(current => ({ ...current, contactPerson: current.contactPerson || profile.fullName, contactPhone: current.contactPhone || profile.phone })) }, [ownerProfile.data])
  const set = <K extends keyof FarmRegistrationInput>(key: K, value: FarmRegistrationInput[K]) => setForm(current => ({ ...current, [key]: value }))
  const openOwnerProfile = () => navigate('/owner-registration', { replace: true })
  const back = () => location.key === 'default' ? navigate('/chon-trai') : navigate(-1)
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const next = validateFarmRegistration(form); setErrors(next); if (Object.keys(next).length) return; setSaving(true); setError(null); try { const farm = await registerFarm(form, { idempotencyKey: requestKey.keyFor(form) }); requestKey.clear(); navigate(`/dang-ky-goi?farm=${farm.id}`, { replace: true, state: { notice: `Đã đăng ký trại ${farm.name}. Hãy chọn gói để kích hoạt.` } }) } catch (reason) { if (reason instanceof BackendError && reason.code?.toUpperCase() === 'MSG-FE02-02') setProfileRequired(true); else setError(farmWorkspaceError(reason, 'Không lưu được dữ liệu. Vui lòng thử lại.')) } finally { setSaving(false) } }
  return { form, set, errors, error, saving, profileRequired, ownerProfile, back, openOwnerProfile, submit }
}
