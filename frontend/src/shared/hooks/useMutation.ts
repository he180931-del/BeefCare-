import { useCallback, useState } from 'react'

/** Runs one command and exposes its loading/error state; the caller still receives the result or the error. */
export function useMutation<TPayload, TResult>(mutator: (payload: TPayload) => Promise<TResult>) {
  const [loading, setLoading] = useState(false); const [error, setError] = useState<unknown>(null)
  const mutate = useCallback(async (payload: TPayload) => { setLoading(true); setError(null); try { return await mutator(payload) } catch (nextError) { setError(nextError); throw nextError } finally { setLoading(false) } }, [mutator])
  return { mutate, loading, error }
}
