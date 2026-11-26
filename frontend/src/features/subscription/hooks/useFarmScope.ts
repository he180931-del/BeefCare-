import { useSearchParams } from 'react-router-dom'
import { activeFarmId, parseFarmId, requireFarm } from '../../../app/session/currentFarm'

/**
 * The farm an Owner's service pages work on: `?farm=` (from Select Farm, farm registration or a notification), else the
 * farm this page load works in (the one the feature APIs use); never a guessed one, since the route's `RequireFarm`
 * opens Select Farm without either. `to()` builds an internal link that keeps `?farm=`, so the next steps stay on the
 * same farm.
 */
export function useFarmScope() {
  const [params] = useSearchParams()
  const farmId = requireFarm(parseFarmId(params.get('farm')) ?? activeFarmId)
  const to = (path: string, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams(extra)
    q.set('farm', String(farmId))
    return `${path}?${q.toString()}`
  }
  return { farmId, to }
}
