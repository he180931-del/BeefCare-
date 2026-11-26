import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { mapBackendCattle } from '../../../src/features/cattle/api/cattleMapper'
import OverviewTab from '../../../src/features/cattle/components/OverviewTab'
import { entryDeclarationLines, type BackendDeclaration } from '../../../src/features/cattle/domain/entryDeclarations'

// D82, SCR-19 #11: "Khai báo khi nhập" đọc lại khai báo trước nhập đàn; "Không rõ" không bao giờ thành "Không".
const VACCINATION: BackendDeclaration = {
  category: 'VACCINATION', status: 'KNOWN', informationSource: 'Sổ người bán',
  vaccines: [{ name: 'LMLM', date: '2026-09-15' }, { name: 'Tụ huyết trùng (trại cũ)', date: null }],
}
const DISEASE: BackendDeclaration = { category: 'DISEASE', status: 'KNOWN', description: 'Viêm phổi tháng 3, đã khỏi' }
const REPRODUCTION: BackendDeclaration = { category: 'REPRODUCTION', status: 'KNOWN', earlierCalvings: 2, pregnantAtEntry: 'YES', estMonthsPregnant: 4 }

describe('entryDeclarationLines', () => {
  it('ghép nội dung theo thứ tự Tiêm phòng, Bệnh đã biết, Sinh sản', () => {
    expect(entryDeclarationLines([REPRODUCTION, DISEASE, VACCINATION])).toEqual([
      { label: 'Tiêm phòng', value: 'LMLM (15/09/2026); Tụ huyết trùng (trại cũ) (không rõ ngày) · nguồn: Sổ người bán' },
      { label: 'Bệnh đã biết', value: 'Viêm phổi tháng 3, đã khỏi' },
      { label: 'Sinh sản', value: '2 lứa đã đẻ · mang thai ~4 tháng khi nhập' },
    ])
  })

  it('"Không rõ" giữ là "Không rõ", "Không" là "Không"', () => {
    expect(entryDeclarationLines([
      { category: 'VACCINATION', status: 'UNKNOWN' },
      { category: 'DISEASE', status: 'NONE' },
      { category: 'REPRODUCTION', status: 'KNOWN', earlierCalvings: 0, pregnantAtEntry: 'UNKNOWN' },
    ])).toEqual([
      { label: 'Tiêm phòng', value: 'Không rõ' },
      { label: 'Bệnh đã biết', value: 'Không' },
      { label: 'Sinh sản', value: '0 lứa đã đẻ · không rõ mang thai' },
    ])
  })

  it('không có khai báo (bò sinh tại trại) thì không có mục', () => {
    expect(entryDeclarationLines(null)).toBeUndefined()
    expect(entryDeclarationLines([])).toBeUndefined()
  })
})

describe('Thông tin cá thể → Xem thêm', () => {
  const cow = (declarations: BackendDeclaration[] | null) => mapBackendCattle(
    { id: 9, displayCode: 'BC-009', herdStatus: 'ACTIVE', sex: 'FEMALE', entry: { source: 'EXTERNAL', entryDate: '2026-11-20', declarations } },
    null, [], [], {}, '2026-11-26',
  )
  const open = async (declarations: BackendDeclaration[] | null) => {
    render(<MemoryRouter><OverviewTab cow={cow(declarations)} canWrite={false} onOpenModal={vi.fn()} /></MemoryRouter>)
    await userEvent.setup().click(screen.getByRole('button', { name: /^Xem thêm/ }))
  }

  it('hiện khai báo khi nhập', async () => {
    await open([VACCINATION, DISEASE, REPRODUCTION])
    const section = screen.getByRole('region', { name: 'Khai báo khi nhập' })
    expect(within(section).getByText('Viêm phổi tháng 3, đã khỏi')).toBeInTheDocument()
    expect(within(section).getByText('2 lứa đã đẻ · mang thai ~4 tháng khi nhập')).toBeInTheDocument()
  })

  it('không có khai báo thì không có mục', async () => {
    await open(null)
    expect(screen.queryByRole('region', { name: 'Khai báo khi nhập' })).not.toBeInTheDocument()
  })
})
