import { useCallback, useEffect, useRef, useState } from 'react'

/** Tải dữ liệu: const { data, loading, error, refetch } = useQuery(() => api.list(), [deps]) */
export function useQuery(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(() => {
    let active = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fetcherRef.current().then(
      (data) => active && setState({ data, loading: false, error: null }),
      (error) => active && setState({ data: null, loading: false, error }),
    )
    return () => {
      active = false
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps)
  return { ...state, refetch: run }
}

/** Ghi dữ liệu: const { mutate, loading } = useMutation((payload) => api.create(payload)) */
export function useMutation(mutator) {
  const [loading, setLoading] = useState(false)
  const mutate = useCallback(
    async (payload) => {
      setLoading(true)
      try {
        return await mutator(payload)
      } finally {
        setLoading(false)
      }
    },
    [mutator],
  )
  return { mutate, loading }
}
