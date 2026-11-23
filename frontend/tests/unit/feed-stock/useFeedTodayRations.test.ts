import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedTodayRations } from '../../../src/features/feed-stock/hooks/useFeedTodayRations'

const api = vi.hoisted(() => ({ listFeedFeedingRecords: vi.fn(), listFeedRationPens: vi.fn(), listFeedRations: vi.fn() }))
vi.mock('../../../src/features/feed-stock/api/feedFeedingApi', () => ({ listFeedFeedingRecords: api.listFeedFeedingRecords }))
vi.mock('../../../src/features/feed-stock/api/feedRationApi', () => ({ listFeedRationPens: api.listFeedRationPens, listFeedRations: api.listFeedRations }))

describe('useFeedTodayRations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFeedRations.mockResolvedValue([{ id: 3 }])
    api.listFeedRationPens.mockResolvedValue([{ id: 8, status: 'ACTIVE', headcount: 12 }])
    api.listFeedFeedingRecords.mockResolvedValue([{ id: 5, feedingDate: '2026-11-21' }])
  })

  it('loads rations, pens, and records for the requested business date', async () => {
    const { result } = renderHook(() => useFeedTodayRations('2026-11-21'))
    await waitFor(() => expect(result.current.today?.pens).toHaveLength(1))
    expect(result.current.today?.rations).toEqual([{ id: 3 }])
    expect(api.listFeedFeedingRecords).toHaveBeenCalledWith({ from: '2026-11-21', to: '2026-11-21' })
  })
})
