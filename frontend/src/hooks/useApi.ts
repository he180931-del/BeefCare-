import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
export function useQuery<T>(fetcher: () => Promise<T>, deps: DependencyList = []) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: unknown }>({ data: null, loading: true, error: null })
  const fetcherRef = useRef(fetcher); fetcherRef.current = fetcher
  const requestId = useRef(0)
  const run = useCallback(async (): Promise<T> => {
    const currentRequest = ++requestId.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fetcherRef.current()
      if (currentRequest === requestId.current) setState({ data, loading: false, error: null })
      return data
    } catch (error) {
      if (currentRequest === requestId.current) setState({ data: null, loading: false, error })
      throw error
    }
  }, [])
  const setData = useCallback((data: T) => {
    requestId.current += 1
    setState({ data, loading: false, error: null })
  }, [])
  useEffect(() => {
    void run().catch(() => undefined)
    return () => { requestId.current += 1 }
  }, deps)
  return { ...state, refetch: run, setData }
}
export function useMutation<TPayload, TResult>(mutator: (payload: TPayload) => Promise<TResult>) {
  const [loading, setLoading] = useState(false); const [error, setError] = useState<unknown>(null)
  const mutate = useCallback(async (payload: TPayload) => { setLoading(true); setError(null); try { return await mutator(payload) } catch (nextError) { setError(nextError); throw nextError } finally { setLoading(false) } }, [mutator])
  return { mutate, loading, error }
}
