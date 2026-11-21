import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedRationList } from '../../../src/features/feed-stock/hooks/useFeedRationList'

const api = vi.hoisted(() => ({ listFeedRations: vi.fn(), listFeedRationPens: vi.fn(), cancelFeedRationVersion: vi.fn(), stopFeedRation: vi.fn() }))
vi.mock('../../../src/features/feed-stock/api/feedRationApi', () => api)

describe('useFeedRationList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFeedRations.mockResolvedValue([{ id: 7, status: 'SCHEDULED' }])
    api.listFeedRationPens.mockResolvedValue([{ id: 3 }])
    api.cancelFeedRationVersion.mockResolvedValue({ id: 7, status: 'CANCELLED' })
    api.stopFeedRation.mockResolvedValue({ id: 7, status: 'EFFECTIVE' })
  })

  it('loads list data and routes lifecycle commands through the hook', async () => {
    const { result } = renderHook(() => useFeedRationList())
    await waitFor(() => expect(result.current.rows).toEqual([{ id: 7, status: 'SCHEDULED' }]))
    expect(result.current.pens).toEqual([{ id: 3 }])

    await act(async () => { await result.current.cancel({ id: 7, versionNo: 2, version: 4, options: { key: 'cancel-key' } }) })
    await act(async () => { await result.current.stop({ id: 7, endDate: '2026-12-01', version: 5, options: { key: 'stop-key' } }) })
    expect(api.cancelFeedRationVersion).toHaveBeenCalledWith(7, 2, 4, { key: 'cancel-key' })
    expect(api.stopFeedRation).toHaveBeenCalledWith(7, '2026-12-01', 5, { key: 'stop-key' })
  })
})
