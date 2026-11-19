import { useParams, useSearchParams } from 'react-router-dom'
import { backendFarmId } from '../../../api/backendTransport'

/** Mã trại từ đường dẫn hoặc `?farmId=`; mặc định là trại cấu hình (backendFarmId). */
export function useFarmId() {
  const params = useParams<{ farmId: string }>()
  const [search] = useSearchParams()
  const id = Number(params.farmId ?? search.get('farmId') ?? backendFarmId)
  return Number.isInteger(id) && id > 0 ? id : Number(backendFarmId)
}
