import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CalfHistoryCard } from '../../../src/features/reproduction/components/ReproductionCards'
import ReproductionTimeline, { TIMELINE_ROWS } from '../../../src/features/reproduction/components/ReproductionTimeline'
import type { ReproductionFemale } from '../../../src/features/reproduction/types'

// D79: tab Sinh sản gọn – lịch sử sinh bê chỉ lứa gần nhất, dòng thời gian 5 sự kiện mới nhất.
const calving = (id: string, birthAt: string, weightKg: number) => ({
  id, status: 'VALID', birthAt,
  calves: [{ id: `${id}-1`, number: 1, outcome: 'LIVE', sex: 'FEMALE', weightKg, status: 'VALID', registrationStatus: 'DRAFT' }],
})
const event = (n: number) => ({
  id: `E${n}`, type: 'ESTRUS', status: 'VALID', corrected: false, recorder: 'Quản lý A',
  occurredAt: `2026-10-${String(n).padStart(2, '0')}T08:00`, details: `Động dục lần ${n}`, summary: '',
})
const profile = (patch: Partial<Record<string, unknown>>) => ({ calvings: [], events: [], ...patch }) as unknown as ReproductionFemale

describe('Lịch sử sinh bê chỉ hiện lứa gần nhất', () => {
  it('lứa mới nhất trước; "Xem n lứa trước" mở các lứa còn lại', async () => {
    render(<MemoryRouter><CalfHistoryCard profile={profile({ calvings: [calving('C1', '2024-03-01T08:00', 20), calving('C3', '2026-05-01T08:00', 24), calving('C2', '2025-04-01T08:00', 22)] })} /></MemoryRouter>)
    expect(screen.getByText('Bê 1: Sống · Cái · 24 kg')).toBeInTheDocument()
    expect(screen.queryByText('Bê 1: Sống · Cái · 22 kg')).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Xem 2 lứa trước' }))
    expect(screen.getByText('Bê 1: Sống · Cái · 22 kg')).toBeInTheDocument()
    expect(screen.getByText('Bê 1: Sống · Cái · 20 kg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chỉ lứa gần nhất' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('bò mới đẻ một lứa thì không có nút mở thêm', () => {
    render(<MemoryRouter><CalfHistoryCard profile={profile({ calvings: [calving('C1', '2026-05-01T08:00', 24)] })} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /lứa trước/ })).not.toBeInTheDocument()
  })
})

describe('Dòng thời gian sinh sản hiện 5 sự kiện mới nhất', () => {
  const seven = profile({ events: [1, 2, 3, 4, 5, 6, 7].map(event) })

  it('ẩn sự kiện cũ, "Xem thêm" mở đủ, "Thu gọn" về lại', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ReproductionTimeline profile={seven} canManage={false} onRevise={vi.fn()} /></MemoryRouter>)
    expect(TIMELINE_ROWS).toBe(5)
    expect(screen.getByText('Động dục lần 7')).toBeInTheDocument()
    expect(screen.getByText('Động dục lần 3')).toBeInTheDocument()
    expect(screen.queryByText('Động dục lần 2')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xem thêm 2 sự kiện' }))
    expect(screen.getByText('Động dục lần 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thu gọn' }))
    expect(screen.queryByText('Động dục lần 1')).not.toBeInTheDocument()
  })

  it('mở từ dòng thời gian hồ sơ (một bản ghi nguồn) thì không gập', () => {
    render(<MemoryRouter><ReproductionTimeline profile={seven} source={event(2) as never} canManage={false} onRevise={vi.fn()} /></MemoryRouter>)
    expect(screen.getByText('Động dục lần 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Xem thêm/ })).not.toBeInTheDocument()
  })
})
