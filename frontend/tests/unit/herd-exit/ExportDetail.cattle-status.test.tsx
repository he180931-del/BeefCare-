import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/features/herd-exit/hooks/useExitDetail', () => ({ useExitDetail: () => ({
  loading: false, canCancel: false, refetch: vi.fn(), reload: vi.fn(), viewDocument: vi.fn(),
  record: { id: 'PX-VOIDED', status: 'Đã hủy', type: 'Bán', count: 3, detail: { cows: [
    { code: 'BC-ACTIVE', current: 'ACTIVE' }, { code: 'BC-EXITED', current: 'EXITED' }, { code: 'BC-UNKNOWN' },
  ] } },
}) }))
import ExportDetail from '../../../src/features/herd-exit/pages/ExportDetail'

it('shows each current herd status on a voided voucher, including cattle that exited again later', () => {
  render(<MemoryRouter initialEntries={['/herd-exit/PX-VOIDED']}><Routes><Route path="/herd-exit/:id" element={<ExportDetail />} /></Routes></MemoryRouter>)
  expect(within(screen.getByRole('row', { name: /BC-ACTIVE/ })).getByText('Đang nuôi')).toBeInTheDocument()
  expect(within(screen.getByRole('row', { name: /BC-EXITED/ })).getByText('Đã xuất')).toBeInTheDocument()
  const unknown = within(screen.getByRole('row', { name: /BC-UNKNOWN/ }))
  expect(unknown.queryByText('Đã xuất')).not.toBeInTheDocument()
  expect(unknown.queryByText('Đang nuôi')).not.toBeInTheDocument()
})
