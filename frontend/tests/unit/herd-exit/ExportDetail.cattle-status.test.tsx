import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ExitStatus } from '../../../src/features/herd-exit/types'

const voucher = vi.hoisted(() => ({ status: 'Đã hủy' as ExitStatus }))

beforeEach(() => { voucher.status = 'Đã hủy' })

vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/features/herd-exit/hooks/useExitDetail', () => ({ useExitDetail: () => ({
  loading: false, canCancel: false, refetch: vi.fn(), reload: vi.fn(), viewDocument: vi.fn(),
  record: { id: 'PX-VOIDED', status: voucher.status, type: 'Bán', count: 3, detail: { cows: [
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

it('shows exited cattle on a confirmed local voucher when current status is missing', () => {
  voucher.status = 'Đã xuất'
  render(<MemoryRouter initialEntries={['/herd-exit/PX-VOIDED']}><Routes><Route path="/herd-exit/:id" element={<ExportDetail />} /></Routes></MemoryRouter>)
  expect(within(screen.getByRole('row', { name: /BC-UNKNOWN/ })).getByText('Đã xuất')).toBeInTheDocument()
})

it('keeps an explicit active status on a confirmed voucher', () => {
  voucher.status = 'Đã xuất'
  render(<MemoryRouter initialEntries={['/herd-exit/PX-VOIDED']}><Routes><Route path="/herd-exit/:id" element={<ExportDetail />} /></Routes></MemoryRouter>)
  expect(within(screen.getByRole('row', { name: /BC-ACTIVE/ })).getByText('Đang nuôi')).toBeInTheDocument()
})
