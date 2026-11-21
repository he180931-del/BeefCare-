import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEntryList, type EntryListPageFilters } from '../../../src/features/herd-entry/hooks/useEntryList'

const { listView } = vi.hoisted(() => ({ listView: vi.fn() }))

vi.mock('../../../src/features/herd-entry/api', () => ({
  herdEntryApi: { listView },
}))

function Probe({ filters }: { filters: EntryListPageFilters }) {
  const result = useEntryList(filters)
  return <div>{result.loading ? 'loading' : result.rows.map((row) => row.id).join(',')}</div>
}

const filters = (overrides: Partial<EntryListPageFilters> = {}): EntryListPageFilters => ({
  tab: 'Tất cả', type: '', from: '2026-07-01', to: '2026-11-21', ...overrides,
})

describe('useEntryList', () => {
  it('normalizes type and seller filters for the backend list query', async () => {
    listView.mockResolvedValueOnce({
      rows: [{ id: 'PN-1', date: '2026-10-01', status: 'Đã nhập', source: 'Seller 7' }],
      tiles: { postedVouchers: 1 }, counts: { ALL: 1 },
    })

    render(<Probe filters={filters({ type: 'Mua ngoài', source: { id: '7', name: 'Seller 7' } })} />)
    await waitFor(() => expect(screen.getByText('PN-1')).toBeInTheDocument())

    expect(listView).toHaveBeenCalledWith({ type: 'PURCHASE', from: '2026-07-01', to: '2026-11-21', sellerId: 7 })
  })

  it('keeps client-side status filtering after the query resolves without filtering seller names', async () => {
    listView.mockResolvedValueOnce({
      rows: [
        { id: 'keep', date: '2026-08-01', status: 'Nháp', source: 'Seller 1' },
        { id: 'drop-status', date: '2026-08-01', status: 'Đã nhập', source: 'Seller 1' },
        { id: 'drop-source', date: '2026-08-01', status: 'Nháp', source: 'Seller 2' },
      ],
      tiles: {}, counts: { ALL: 3 },
    })

    render(<Probe filters={filters({ tab: 'Nháp', source: { id: 's1', name: 'Seller 1' } })} />)
    await waitFor(() => expect(screen.getByText('keep,drop-source')).toBeInTheDocument())

    expect(screen.queryByText('drop-status')).not.toBeInTheDocument()
    expect(screen.getByText('keep,drop-source')).toBeInTheDocument()
  })
})
