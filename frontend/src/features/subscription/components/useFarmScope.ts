import { useSearchParams } from 'react-router-dom'
import { backendFarmId, backendMode } from '../../../api/backendTransport'
import { useSession } from '../../authorization/sessionContext'

export const DEFAULT_FARM_ID = 1 // Trại bò Yên Bài – Ba Vì trong mock

/**
 * Trại đang xem. Mock có sẵn 3 trại (1 Yên Bài, 2 Tản Lĩnh chưa mua, 3 Suối Hai tạm ngưng) chọn bằng `?farm=`;
 * `to()` dựng đường dẫn nội bộ và giữ `?farm=` để các bước sau vẫn cùng trại.
 */
export function useFarmScope(defaultFarm = DEFAULT_FARM_ID) {
  const session = useSession()
  const [params] = useSearchParams()
  const raw = Number(params.get('farm'))
  const selected = backendMode === 'backend' ? session?.farmId ?? Number(backendFarmId) : defaultFarm
  const farmId = Number.isInteger(raw) && raw > 0 ? raw : selected
  const to = (path: string, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams(extra)
    if (backendMode === 'backend' || farmId !== DEFAULT_FARM_ID) q.set('farm', String(farmId))
    const s = q.toString()
    return s ? `${path}?${s}` : path
  }
  return { farmId, to }
}
