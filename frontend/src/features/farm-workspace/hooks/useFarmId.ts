import { useParams, useSearchParams } from 'react-router-dom'
import { activeFarmId, parseFarmId, requireFarm } from '../../../app/session/currentFarm'

/**
 * The farm named in the address (`:farmId` or `?farmId=`), else the farm this page load works in (the one the feature
 * APIs use). The route is wrapped in
 * `RequireFarm`, which opens Select Farm when neither exists, so there is never a default farm.
 */
export function useFarmId(): number {
  const params = useParams<{ farmId: string }>()
  const [search] = useSearchParams()
  return requireFarm(parseFarmId(params.farmId) ?? parseFarmId(search.get('farmId')) ?? activeFarmId)
}
