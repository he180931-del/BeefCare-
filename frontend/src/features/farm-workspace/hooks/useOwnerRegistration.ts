import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '../../../shared/hooks/useQuery'
import { useSession } from '../../../app/session/sessionContext'
import { notifyOwnerRegistrationCompleted } from '../../../app/session/sessionLifecycle'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { farmWorkspaceError } from '../components/WorkspaceUi'
import type { CompleteOwnerProfileInput } from '../types'
import { validateOwnerProfile, type FormErrors } from '../validation/workspaceValidation'
export function useOwnerRegistration() {
  const navigate = useNavigate(); const session = useSession(); const query = useQuery(() => farmWorkspaceApi.getProfile(), [])
  const [form, setForm] = useState<CompleteOwnerProfileInput>({ fullName: '', phone: '', termsAccepted: false }); const [errors, setErrors] = useState<FormErrors<CompleteOwnerProfileInput>>({}); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false)
  useEffect(() => { if (query.data) setForm({ fullName: session?.fullName ?? query.data.fullName, phone: query.data.phone, termsAccepted: query.data.termsAccepted === true || query.data.ownerRegistrationCompleted }) }, [query.data, session?.fullName])
  const set = <K extends keyof CompleteOwnerProfileInput>(key: K, value: CompleteOwnerProfileInput[K]) => setForm(current => ({ ...current, [key]: value }))
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const next = validateOwnerProfile(form); setErrors(next); if (Object.keys(next).length) return; setSaving(true); setError(null); try { await farmWorkspaceApi.completeOwnerRegistration(form); notifyOwnerRegistrationCompleted(); navigate('/dang-ky-trai', { replace: true }) } catch (reason) { setError(farmWorkspaceError(reason, 'Không thể lưu hồ sơ lúc này.')) } finally { setSaving(false) } }
  return { session, query, profile: query.data, form, set, errors, error, saving, email: session?.email ?? query.data?.email, submit }
}
