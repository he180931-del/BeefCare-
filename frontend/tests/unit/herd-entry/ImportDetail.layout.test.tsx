import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HerdEntry } from '../../../src/features/herd-entry/types'

const state = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../../src/app/layouts/FarmPlatformLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../src/app/session/sessionContext', () => ({ useSession: () => ({ role: 'TECHNICIAN' }) }))
vi.mock('../../../src/features/herd-entry/api/index', () => ({
  herdEntryApi: { get: state.get },
  entryPaymentVoidEnabled: false,
  entryLineCorrectionEnabled: false,
  entryHistoryDemoEnabled: true,
  voidEntryPayment: vi.fn(),
}))
import ImportDetail from '../../../src/features/herd-entry/pages/ImportDetail'

const row: HerdEntry = {
  id: 'PN-1', status: 'Đã nhập', date: '2026-10-20', count: 2, weight: 320, total: 1000,
  detail: {
    cows: [
      { code: 'BC-01', tag: 'VN01', breed: 'Lai Sind', weight: 320, amount: 1000, barn: 'A1', current: 'ACTIVE · A1', weightBasis: 'ESTIMATED' },
      { code: 'BC-02', tag: 'VN02', breed: 'Lai Sind', weight: 99, amount: 999, barn: 'A1', current: 'VOIDED · A1', lineStatus: 'VOID' },
    ],
    docs: [], history: [],
  },
}

beforeEach(() => state.get.mockReset().mockResolvedValue(structuredClone(row)))

describe('ImportDetail presentation', () => {
  it('localizes FE05 status, marks estimated weight, excludes void lines from totals, and shows empty documents', async () => {
    render(<MemoryRouter initialEntries={['/herd-entry/PN-1']}><Routes><Route path="/herd-entry/:id" element={<ImportDetail />} /></Routes></MemoryRouter>)

    expect(await screen.findByText('Đang nuôi · A1')).toBeInTheDocument()
    expect(screen.getByText('Nhập nhầm – đã hủy · A1')).toBeInTheDocument()
    expect(screen.getByText('320 kg UT')).toBeInTheDocument()
    expect(screen.getAllByText('1 con').length).toBeGreaterThan(0)
    expect(screen.getByText('Chưa có chứng từ')).toBeInTheDocument()
  })
})
