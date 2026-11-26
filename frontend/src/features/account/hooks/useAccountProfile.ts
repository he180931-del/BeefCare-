import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useQuery } from '../../../shared/hooks/useQuery'
import { useSession } from '../../../app/session/sessionContext'
import { useAccountUseCase } from './useAccountUseCase'
import { validateProfile } from '../validation/profileValidation'
import type { AccountIdentity, AccountProfile, ProfileErrors } from '../types'

import { demoSessionUser } from '../../../demo/demoModules'

const NO_IDENTITY: AccountIdentity = { email: '', fullName: '', role: 'MANAGER', farmName: null, farmId: null }

/** Người đang đăng nhập; ngoài phiên (vd. test từng trang) dùng Quản lý mẫu, bản production không có. */
export function useAccountIdentity(): AccountIdentity {
  const session = useSession()
  return useMemo(
    () => {
      const person = session ?? demoSessionUser('MANAGER')
      return person ? { email: person.email, fullName: person.fullName, role: person.role, farmName: person.farmName, farmId: person.farmId } : NO_IDENTITY
    },
    [session?.email, session?.fullName, session?.role, session?.farmName, session?.farmId],
  )
}

export function useAccountProfile() {
  const identity = useAccountIdentity()
  const account = useAccountUseCase()
  const query = useQuery(() => account.getProfile(identity), [account, identity.email])
  const permissions = useQuery(
    () => identity.farmId != null && ['OWNER', 'MANAGER', 'TECHNICIAN'].includes(identity.role)
      ? account.getFarmPermissions(identity, identity.farmId)
      : Promise.resolve(null),
    [account, identity.email, identity.farmId, identity.role],
  )
  return { identity, permissions, ...query }
}

/** Biểu mẫu hồ sơ cá nhân (họ tên, điện thoại); nút "Lưu hồ sơ" ở đầu trang gửi biểu mẫu qua thuộc tính `form`. */
export function useProfileForm(profile: AccountProfile | null, identity: AccountIdentity, onSaved: (profile: AccountProfile, message: string) => void) {
  const account = useAccountUseCase()
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
    try { onSaved(await account.updateProfile(identity, values), 'Hồ sơ của bạn đã được cập nhật.') }
    catch (reason) { setError(userFacingError(reason, 'Không lưu được hồ sơ. Vui lòng thử lại.')) }
    finally { setSaving(false) }
  }
  return { values, setValues, errors, error, saving, submit }
}
