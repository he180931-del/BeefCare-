import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntryCalf, HerdEntry, Pen } from '../../../src/types'

const state = vi.hoisted(() => ({
  calves: [] as EntryCalf[],
  saved: [] as Array<{ id?: string; record: Partial<HerdEntry>; cattleRows?: unknown[]; documents?: File[] }>,
  saveError: null as Error | null,
}))

const pens: Pen[] = [
  { code: 'A3', name: 'A3 – Bê theo mẹ', count: 5, capacity: 20, status: 'ACTIVE', cows: [] },
]

vi.mock('../../../src/features/herd-entry/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/features/herd-entry/api/index')>()
  return {
    ...actual,
    entryExcelBackendEnabled: true,
    herdEntryApi: {
      ...actual.herdEntryApi,
      list: async () => [],
    },
    pens: {
      ...actual.pens,
      list: async () => structuredClone(pens),
    },
    listEntryPens: async () => structuredClone(pens),
    listPendingEntryCalves: async () => structuredClone(state.calves),
    listEntrySellers: async () => [],
    saveHerdEntry: async (input: (typeof state.saved)[number]) => {
      if (state.saveError) throw state.saveError
      state.saved.push(input)
      return { ...input.record, id: input.id ?? 'PN-2026-0101', status: input.record.status ?? 'Nháp' } as HerdEntry
    },
  }
})

import ImportNew from '../../../src/features/herd-entry/pages/ImportNew'

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/herd-entry/new?kind=calf']}>
      <ImportNew />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.calves = [{
    name: 'Bê số 7', tag: 'CALF-0007', mother: 'DAM-001', father: 'Không rõ', born: '2026-10-28',
    sex: 'Cái', weight: 34, estimated: false, purpose: 'Chưa xác định', picked: false, barn: '',
    calfOutcomeId: 17, penId: 3, purposeId: 2,
  }]
  state.saved = []
  state.saveError = null
})

describe('Phiếu nhập bê sinh tại trại', () => {
  it('loads a pending calf, keeps purchase UI hidden, and maps selected calf identifiers', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('1. Thông tin phiếu')
    const selectCalf = screen.getByRole('checkbox', { name: 'Chọn CALF-0007' })
    expect(selectCalf).not.toBeChecked()
    expect(screen.queryByText('Nguồn / chủ bò cũ *')).not.toBeInTheDocument()
    expect(screen.queryByText('4. Thanh toán')).not.toBeInTheDocument()

    await user.click(selectCalf)
    expect(selectCalf).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))

    await waitFor(() => expect(state.saved).toHaveLength(1))
    const saved = state.saved[0]
    expect(saved.record).toMatchObject({ type: 'Bê sinh tại trại', status: 'Nháp', total: null, debt: null, count: 1 })
    expect(saved.record.draft).toMatchObject({ calves: [expect.objectContaining({ tag: 'CALF-0007', picked: true, barn: 'A3' })] })
    expect(saved.record.detail).toBeUndefined()
    expect(saved.cattleRows).toEqual([expect.objectContaining({
      tag: 'CALF-0007', calfOutcomeId: 17, penId: 3, purposeId: 2, born: '2026-10-28', date: '2026-10-28', stage: 'Bê',
    })])
  })

  it('shows a save failure without an unhandled rejection and keeps the form available', async () => {
    const user = userEvent.setup()
    state.saveError = new Error('Backend temporarily unavailable')
    renderPage()

    await screen.findByText('1. Thông tin phiếu')
    const selectCalf = screen.getByRole('checkbox', { name: 'Chọn CALF-0007' })
    await user.click(selectCalf)
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))

    expect(await screen.findByText('Backend temporarily unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu nháp phiếu' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Chọn CALF-0007' })).toBeChecked()
  })
})
