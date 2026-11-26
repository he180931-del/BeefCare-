import { useEffect, useRef, useState } from 'react'
import { listCowsPage } from '../api/cattleApi'
import type { CattlePage } from '../api/cattleBackendApi'

export function useTechnicianHerdQuery({ q = '', filter = 'all', page = 0 }: { q?: string; filter?: string; page?: number } = {}) {
  const search = q.trim()
  const key = JSON.stringify([search, filter])
  const previousKey = useRef('')
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<{ key: string; data: CattlePage | null; loading: boolean; error: unknown }>({ key, data: null, loading: true, error: null })
  useEffect(() => {
    let cancelled = false
    const requestedPage = previousKey.current === key ? page : 0
    previousKey.current = key
    const selection = filter === 'fattening' ? { herdGroup: 'FATTENING' } : filter === 'calf' ? { herdGroup: 'CALVES' } : filter === 'cow' ? { sex: 'FEMALE' } : {}
    setState(old => ({ key, data: old.key === key ? old.data : null, loading: true, error: null }))
    void listCowsPage({ herdStatus: 'ACTIVE', size: 25, page: requestedPage, ...(search ? { q: search } : {}), ...selection }).then(result => {
      if (cancelled) return
      setState(old => {
        const rows = requestedPage > 0 && old.key === key ? [...(old.data?.items ?? []), ...result.items] : result.items
        const items = [...new Map(rows.map(cow => [cow.code, cow])).values()]
        return { key, data: { ...result, items }, loading: false, error: null }
      })
    }).catch(error => { if (!cancelled) setState(old => ({ ...old, loading: false, error })) })
    return () => { cancelled = true }
  }, [key, page, retry])
  return { data: state.key === key ? state.data : null, loading: state.key !== key || state.loading, error: state.key === key ? state.error : null, refetch: () => setRetry(value => value + 1) }
}
