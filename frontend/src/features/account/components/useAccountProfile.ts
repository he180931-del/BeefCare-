import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { accountApi } from '../api/accountApi'
import { validateProfile } from '../domain/profileRules'
import type { AccountIdentity, AccountProfile, ProfileErrors } from '../types'

const FALLBACK_IDENTITY: AccountIdentity = { email: 'manager@beefcare.local', fullName: 'Trần Quốc Long', role: 'MANAGER', farmName: 'Trại bò Yên Bài – Ba Vì', farmId: 1 }

/** Người đang đăng nhập; ngoài phiên (vd. test từng trang) dùng Quản lý của trại mẫu. */
export function useAccountIdentity(): AccountIdentity {
  const session = useSession()
  return useMemo(
    () => session ? { email: session.email, fullName: session.fullName, role: session.role, farmName: session.farmName, farmId: session.farmId } : FALLBACK_IDENTITY,
    [session?.email, session?.fullName, session?.role, session?.farmName, session?.farmId],
  )
}

export function useAccountProfile() {
  const identity = useAccountIdentity()
  const query = useQuery(() => accountApi.getProfile(identity), [identity.email])
  const permissions = useQuery(
    () => identity.farmId != null && ['OWNER', 'MANAGER', 'TECHNICIAN'].includes(identity.role)
      ? accountApi.getFarmPermissions(identity, identity.farmId)
      : Promise.resolve(null),
    [identity.email, identity.farmId, identity.role],
  )
  return { identity, permissions, ...query }
}

/** Biểu mẫu hồ sơ cá nhân (họ tên, điện thoại); nút "Lưu hồ sơ" ở đầu trang gửi biểu mẫu qua thuộc tính `form`. */
export function useProfileForm(profile: AccountProfile | null, identity: AccountIdentity, onSaved: (profile: AccountProfile, message: string) => void) {
  const [values, setValues] = useState({ fullName: '', phone: '' })
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (profile) setValues({ fullName: profile.fullName, phone: profile.phone }) }, [profile])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next = validateProfile(values)
    setErrors(next); setError(null)
    if (Object.keys(next).length) return
    setSaving(true)
    try { onSaved(await accountApi.updateProfile(identity, values), 'Hồ sơ của bạn đã được cập nhật.') }
    catch (reason) { setError(userFacingError(reason, 'Không lưu được hồ sơ. Vui lòng thử lại.')) }
    finally { setSaving(false) }
  }
  return { values, setValues, errors, error, saving, submit }
}
