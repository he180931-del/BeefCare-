import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
export function useQuery<T>(fetcher: () => Promise<T>, deps: DependencyList = []) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: unknown }>({ data: null, loading: true, error: null })
  const fetcherRef = useRef(fetcher); fetcherRef.current = fetcher
  const run = useCallback(() => { let active = true; setState((s) => ({ ...s, loading: true, error: null })); fetcherRef.current().then((data) => active && setState({ data, loading: false, error: null }), (error: unknown) => active && setState({ data: null, loading: false, error })); return () => { active = false } }, [])
  useEffect(run, deps)
  return { ...state, refetch: run }
}
export function useMutation<TPayload, TResult>(mutator: (payload: TPayload) => Promise<TResult>) {
  const [loading, setLoading] = useState(false); const [error, setError] = useState<unknown>(null)
  const mutate = useCallback(async (payload: TPayload) => { setLoading(true); setError(null); try { return await mutator(payload) } catch (nextError) { setError(nextError); throw nextError } finally { setLoading(false) } }, [mutator])
  return { mutate, loading, error }
}
