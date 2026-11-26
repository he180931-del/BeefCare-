import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ScopeTable } from '../../../src/features/platform-finance/components/ReportParts'
import type { ScopeTotals } from '../../../src/features/platform-finance/types'

const farm = (id: number, farmName: string, sub: number, expense = 0): ScopeTotals =>
  ({ scope: 'FARM', farmId: id, farmName, subscriptionReceipts: sub, otherIncome: 0, expense }) as ScopeTotals
const scopes: ScopeTotals[] = [
  ...Array.from({ length: 6 }, (_, i) => farm(i + 1, `Trại ${i + 1}`, 1000 * (i + 1))),
  farm(7, 'Nông trại Đồng Xanh', 0, 500),
  { scope: 'PLATFORM', farmName: 'Toàn nền tảng', subscriptionReceipts: 21000, otherIncome: 0, expense: 500 } as ScopeTotals,
]

function Harness() {
  const [page, setPage] = useState(1)
  const [key, setKey] = useState('a')
  return <><button onClick={() => setKey('b')}>Chạy lại báo cáo</button><ScopeTable resetKey={key} scopes={scopes} page={page} onPageChange={setPage} onFarm={() => {}} /></>
}

describe('ScopeTable filter and pagination', () => {
  it('paginates farms and keeps the platform total row', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText('Hiển thị 1–5 / 7 trại')).toBeInTheDocument()
    expect(screen.getByText('Toàn nền tảng')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^(Trang )?2$/ }))
    expect(screen.getByText('Hiển thị 6–7 / 7 trại')).toBeInTheDocument()
  })

  it('filters by farm name (accent-insensitive) only after pressing Tìm, and by net', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Tìm trại'), 'dong xanh')
    expect(screen.getByText('Trại 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tìm' }))
    expect(screen.queryByText('Trại 1')).not.toBeInTheDocument()
    expect(screen.getByText('Nông trại Đồng Xanh')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xóa lọc' }))
    await user.selectOptions(screen.getByLabelText('Dòng tiền ròng'), 'NEGATIVE')
    await user.click(screen.getByRole('button', { name: 'Tìm' }))
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBe(3)

    await user.type(screen.getByLabelText('Tìm trại'), 'zzz')
    await user.click(screen.getByRole('button', { name: 'Tìm' }))
    expect(screen.getByText('Không có trại khớp bộ lọc.')).toBeInTheDocument()
  })

  it('filters by subscription and expense presence and sorts by net', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.selectOptions(screen.getByLabelText('Khoản chi'), 'YES')
    await user.click(screen.getByRole('button', { name: 'Tìm' }))
    expect(screen.getByText('Nông trại Đồng Xanh')).toBeInTheDocument()
    expect(screen.queryByText('Trại 1')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xóa lọc' }))
    await user.selectOptions(screen.getByLabelText('Thu từ gói đăng ký'), 'NO')
    await user.selectOptions(screen.getByLabelText('Sắp xếp'), 'NET_DESC')
    await user.click(screen.getByRole('button', { name: 'Tìm' }))
    expect(screen.getByText('Nông trại Đồng Xanh')).toBeInTheDocument()
    expect(screen.queryByText('Trại 6')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xóa lọc' }))
    await user.selectOptions(screen.getByLabelText('Sắp xếp'), 'NET_DESC')
    await user.click(screen.getByRole('button', { name: 'Tìm' }))
    const firstFarm = within(screen.getByRole('table')).getAllByRole('row')[1]
    expect(firstFarm).toHaveTextContent('Trại 6')
  })

  it('clears its own filters when the report above is run again', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Tìm trại'), 'dong xanh')
    await user.click(screen.getByRole('button', { name: 'Tìm' }))
    expect(screen.queryByText('Trại 1')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chạy lại báo cáo' }))
    expect(screen.getByText('Trại 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Tìm trại')).toHaveValue('')
  })
})
