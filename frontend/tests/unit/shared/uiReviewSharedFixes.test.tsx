import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../../../src/app/layouts/FarmPlatformLayout'
import { DateInput, Radio, Segmented } from '../../../src/shared/ui'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'

/** Small shared fixes agreed in the 19/11 UI review (group D): they show on FE-02/03/17/19 screens and elsewhere. */
describe('shared UI fixes from the UI review', () => {
  it('Segmented tells assistive technology which option is selected', () => {
    render(<Segmented value="b" onChange={vi.fn()} options={[{ value: 'a', label: 'Tất cả' }, { value: 'b', label: 'Quản lý' }]} />)
    expect(screen.getByRole('button', { name: 'Quản lý' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Tất cả' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('a date field the user can edit is white like the other fields; only a read-only one is grey', () => {
    const { container, rerender } = render(<DateInput value="2026-11-19" onChange={vi.fn()} />)
    expect(container.firstElementChild?.firstElementChild).toHaveClass('bg-white')
    expect(container.firstElementChild?.firstElementChild).not.toHaveClass('read-only:bg-page')
    rerender(<DateInput value="2026-11-19" readOnly />)
    expect(container.firstElementChild?.firstElementChild).toHaveClass('!bg-page')
  })

  it('a radio shows a focus ring when reached with the keyboard', () => {
    render(<Radio checked={false} name="x" onChange={vi.fn()}>Áp dụng ngay</Radio>)
    const dot = screen.getByRole('radio', { name: 'Áp dụng ngay' }).nextElementSibling
    expect(dot).toHaveClass('peer-focus-visible:ring-2')
  })

  it('the top bar never shows a sample farm name for a tab that has not entered a farm', () => {
    const session: Session = { role: 'OWNER', fullName: 'Chủ Trại Mới', email: 'new@example.test', farmId: null, farmName: null, logout: vi.fn() }
    render(<SessionContext.Provider value={session}><MemoryRouter><Layout title="Gói dịch vụ"><p>Nội dung</p></Layout></MemoryRouter></SessionContext.Provider>)
    expect(screen.queryByText('Trại bò Yên Bài – Ba Vì')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chọn trại/ })).toHaveAttribute('aria-haspopup', 'menu')
  })
})
