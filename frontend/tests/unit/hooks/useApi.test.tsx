import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuery } from '../../../src/hooks/useApi'

describe('useQuery', () => {
  it('refetch chỉ hoàn tất sau khi dữ liệu mới đã được tải và cập nhật', async () => {
    let resolveRefresh!: (value: number) => void
    const pendingRefresh = new Promise<number>((resolve) => { resolveRefresh = resolve })
    const fetcher = vi.fn()
      .mockResolvedValueOnce(1)
      .mockImplementationOnce(() => pendingRefresh)

    const { result } = renderHook(() => useQuery(fetcher, []))
    await waitFor(() => expect(result.current.data).toBe(1))

    let refresh!: Promise<number>
    act(() => { refresh = result.current.refetch() as unknown as Promise<number> })
    let settled = false
    void Promise.resolve(refresh).then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)

    resolveRefresh(2)
    await act(async () => { expect(await refresh).toBe(2) })
    expect(result.current.data).toBe(2)
  })
})
