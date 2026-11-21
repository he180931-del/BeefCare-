import { FARM_TIME_ZONE_ID, parseBusinessTime } from '../../../shared/lib/date/farmTime'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '../../../shared/hooks/useQuery'
import { useSession } from '../../../app/session/sessionContext'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { PROVINCES } from '../constants/provinces'
import { farmWorkspaceError } from '../components/WorkspaceUi'
import { useFarmId } from './useFarmId'
import { useRequestKey } from './useRequestKey'
import type { FarmDetails, FarmInfoInput } from '../types'
import { validateFarmInfo, type FormErrors } from '../validation/workspaceValidation'

const DAY = 86_400_000
export const FARM_INFO_SAVED = 'Đã cập nhật thông tin trại.'
export const farmInfoToForm = (farm: FarmDetails): FarmInfoInput => ({
  name: farm.name, province: farm.province ?? '', commune: farm.commune ?? '', detailedAddress: farm.detailedAddress ?? '',
  contactPerson: farm.contactPerson, contactPhone: farm.contactPhone, registrationCertificateInfo: farm.registrationCertificateInfo,
  timeZone: FARM_TIME_ZONE_ID, morningShiftStart: farm.morningShiftStart, operatingNotes: farm.operatingNotes,
  mainBreedIds: farm.mainBreedIds, expectedVersion: farm.version,
})
export const farmDaysLeft = (farm: FarmDetails) => farm.daysRemaining ?? (farm.serviceUntil ? Math.max(0, Math.floor((parseBusinessTime(farm.serviceUntil) - Date.now()) / DAY)) : null)

export function useFarmInformationForm() {
  const navigate = useNavigate(); const session = useSession(); const farmId = useFarmId()
  const query = useQuery(() => farmWorkspaceApi.getFarm(farmId), [farmId])
  const requestKey = useRequestKey(`farm-information-${farmId}`)
  const [form, setForm] = useState<FarmInfoInput | null>(null)
  const [errors, setErrors] = useState<FormErrors<FarmInfoInput>>({})
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (query.data) setForm(farmInfoToForm(query.data)) }, [query.data])
  const set = <K extends keyof FarmInfoInput>(key: K, value: FarmInfoInput[K]) => setForm(current => current ? { ...current, [key]: value } : current)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!form) return
    const next = validateFarmInfo(form); setErrors(next); if (Object.keys(next).length) return
    setSaving(true); setError(null); setNotice(null)
    try { await farmWorkspaceApi.updateFarm(farmId, form, { idempotencyKey: requestKey.keyFor(form) }); requestKey.clear(); query.refetch(); setNotice(FARM_INFO_SAVED) }
    catch (reason) { setError(farmWorkspaceError(reason, 'Không thể lưu thông tin trang trại.')) }
    finally { setSaving(false) }
  }
  const provinces = form?.province && !PROVINCES.some(name => name === form.province) ? [form.province, ...PROVINCES] : PROVINCES
  return { navigate, session, farmId, query, form, set, errors, error, notice, saving, submit, provinces, days: query.data ? farmDaysLeft(query.data) : null }
}
