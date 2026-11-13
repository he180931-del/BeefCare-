import { pageLoader, writeCurrentFarmId } from '../../../api/currentFarm'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { farmAction, unavailableFarmMessage } from './FarmCard'

export const STORAGE_BLOCKED = 'Trình duyệt đang chặn lưu dữ liệu của trang nên chưa ghi nhớ được trại đã chọn. Cho phép lưu dữ liệu cho trang này rồi thử lại.'

/**
 * SCR-09 step 4, reused by SCR-15 after joining (D28): recheck access and service, keep the farm for this tab and load the
 * role's farm home (SCR-48 Owner/Manager, SCR-74 Technician) so the session is read again. Returns a message instead when
 * the farm cannot be opened now.
 */
export async function enterFarm(farmId: number): Promise<string | null> {
  const current = await farmWorkspaceApi.selectFarm(farmId)
  const target = farmAction(current).to
  if (!target) return unavailableFarmMessage(current.name, current.serviceStatus)
  if (!writeCurrentFarmId(current.id)) return STORAGE_BLOCKED
  pageLoader.load(target)
  return null
}
