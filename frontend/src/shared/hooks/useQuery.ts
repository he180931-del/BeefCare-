import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

/** Loads data for a page. A newer request (or `setData`) wins: the answer of an older, stale request is ignored. */
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
  // Screens wire `onRetry={query.refetch}` and `await query.refetch()` after a command: a failure stays in `error` (shown by
  // the screen) and never becomes an unhandled rejection. Resolves the data, or undefined when loading failed.
  const refetch = useCallback((): Promise<T | undefined> => run().catch(() => undefined), [run])
  return { ...state, refetch, setData }
}
