import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BackendError } from '../../../shared/api/backendClient'
import { pageLoader, safeReturnTo, writeCurrentFarmId, type SelectFarmState } from '../../../app/session/currentFarm'
import { STORAGE_BLOCKED } from '../components/enterFarm'
import { useDemoState } from '../../../demo/demoModules'
import { useQuery } from '../../../shared/hooks/useQuery'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { FarmCard, farmAction, unavailableFarmMessage } from '../components/FarmCard'
import { farmWorkspaceError } from '../components/WorkspaceUi'
import type { FarmSummary } from '../types'
export const farmEnterFailure = (error: unknown) => { if (error instanceof BackendError && error.status === 403) return { message: error.code === 'MSG-FE02-04' ? unavailableFarmMessage(String(error.params.farm ?? 'Trang trại'), String(error.params.status ?? '')) : 'Bạn không có quyền thực hiện thao tác này. Danh sách trang trại đã được tải lại.', reloadList: true }; return { message: farmWorkspaceError(error, 'Chưa vào được trang trại. Vui lòng thử lại.'), reloadList: false } }
export function useFarmSelect() {
  const navigate = useNavigate(); const location = useLocation(); const demo = useDemoState(); const query = useQuery(async () => { if (demo === 'load-error') throw new Error('Không tải được danh sách trang trại.'); return demo === 'empty' ? [] : farmWorkspaceApi.listFarms() }, [demo])
  const farms = query.data ?? []; const [entering, setEntering] = useState<number | null>(null); const [enterMessage, setEnterMessage] = useState(''); const autoOpened = useRef(false); const selectState = location.state as SelectFarmState | null; const fromSignIn = selectState?.fromSignIn === true; const returnTo = safeReturnTo(selectState?.returnTo)
  const open = async (farm: FarmSummary, automatic = false) => { setEnterMessage(''); setEntering(farm.id); try { const current = await farmWorkspaceApi.selectFarm(farm.id); const target = farmAction(current).to; if (!target) { setEnterMessage(unavailableFarmMessage(current.name, current.serviceStatus)); query.refetch(); return }; if (current.serviceStatus !== 'ACTIVE') { navigate(target); return }; if (!writeCurrentFarmId(current.id)) { setEnterMessage(STORAGE_BLOCKED); return }; const destination = returnTo ?? target; if (automatic) pageLoader.replace(destination); else pageLoader.load(destination) } catch (error) { const failure = farmEnterFailure(error); setEnterMessage(failure.message); if (failure.reloadList) query.refetch() } finally { setEntering(null) } }
  useEffect(() => { if (!fromSignIn || autoOpened.current || !query.data) return; autoOpened.current = true; const [only, ...others] = query.data; if (only && others.length === 0 && only.serviceStatus === 'ACTIVE') void open(only, true) }, [fromSignIn, query.data])
  const registerFarm = async () => { const profile = await farmWorkspaceApi.getProfile().catch(() => null); navigate(profile && !profile.ownerRegistrationCompleted ? '/owner-registration' : '/dang-ky-trai') }
  return { navigate, query, farms, entering, enterMessage, open, registerFarm }
}
