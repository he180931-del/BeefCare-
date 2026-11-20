import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useQuery } from '../../../src/shared/hooks/useQuery'

describe('useQuery', () => {
  it('keeps a failed retry in error instead of rejecting, so onRetry={query.refetch} never leaks a rejection', async () => {
    let fail = true
    const { result } = renderHook(() => useQuery(async () => { if (fail) throw new Error('boom'); return 'ok' }))
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
    await act(async () => { await expect(result.current.refetch()).resolves.toBeUndefined() })
    expect((result.current.error as Error).message).toBe('boom')
    fail = false
    await act(async () => { await expect(result.current.refetch()).resolves.toBe('ok') })
    expect(result.current).toMatchObject({ data: 'ok', error: null, loading: false })
  })
})
