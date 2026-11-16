import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import SearchSelect, { searchKey } from '../../../src/features/platform-admin/components/SearchSelect'

const OPTIONS = [
  { value: 'ACCOUNT_SUSPENDED', label: 'Tạm ngưng tài khoản', keywords: 'ACCOUNT_SUSPENDED' },
  { value: 'FARM_SERVICE_SUSPENDED', label: 'Tạm ngưng dịch vụ trại', keywords: 'FARM_SERVICE_SUSPENDED' },
  { value: 'PAYMENT_CONFIRMED', label: 'Xác nhận thanh toán', keywords: 'PAYMENT_CONFIRMED' },
  { value: 'FARM_REGISTERED', label: 'Đăng ký trang trại', keywords: 'FARM_REGISTERED' },
]

function Harness({ onChange = vi.fn() }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('')
  return <>
    <SearchSelect aria-label="Lọc theo hành động" options={OPTIONS} value={value} onChange={(v) => { setValue(v); onChange(v) }} emptyText="Không có hành động phù hợp" clearLabel="Bỏ lọc hành động" />
    <button type="button">khác</button>
  </>
}
const field = () => screen.getByRole('combobox', { name: 'Lọc theo hành động' })
const optionNames = () => screen.queryAllByRole('option').map((o) => o.firstChild?.textContent)
afterEach(cleanup)

describe('SearchSelect (bộ lọc gõ để tìm)', () => {
  it('ignores accents, case and underscores', () => {
    expect(searchKey('Đăng ký trang trại')).toBe('dang ky trang trai')
    expect(searchKey('FARM_SERVICE_SUSPENDED')).toBe('farm service suspended')
  })

  it('opens with "Tất cả" and every option, narrows by unaccented words or by code', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(field())
    expect(optionNames()).toEqual(['Tất cả', ...OPTIONS.map((o) => o.label)])
    await user.type(field(), 'tam ngung')
    expect(optionNames()).toEqual(['Tạm ngưng tài khoản', 'Tạm ngưng dịch vụ trại'])
    await user.clear(field())
    await user.type(field(), 'payment')
    expect(optionNames()).toEqual(['Xác nhận thanh toán'])
    // Codes are searchable keywords only; the suggestion shows the label alone.
    expect(screen.getByRole('option').textContent).toBe('Xác nhận thanh toán')
    await user.clear(field())
    await user.type(field(), 'dang ky')
    expect(optionNames()).toEqual(['Đăng ký trang trại'])
    await user.type(field(), ' khong co')
    expect(screen.getByText('Không có hành động phù hợp')).toBeInTheDocument()
  })

  it('picks with the keyboard, restores the choice on Esc / leaving and never filters by free text', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.type(field(), 'dich vu')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('FARM_SERVICE_SUSPENDED')
    expect(field()).toHaveValue('Tạm ngưng dịch vụ trại')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.clear(field())
    await user.type(field(), 'gõ dở')
    await user.keyboard('{Escape}')
    expect(field()).toHaveValue('Tạm ngưng dịch vụ trại')
    await user.type(field(), 'xyz')
    await user.click(screen.getByRole('button', { name: 'khác' }))
    expect(field()).toHaveValue('Tạm ngưng dịch vụ trại')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('clears the filter with the × button', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(field())
    await user.click(screen.getByRole('option', { name: /Xác nhận thanh toán/ }))
    expect(field()).toHaveValue('Xác nhận thanh toán')
    await user.click(screen.getByRole('button', { name: 'Bỏ lọc hành động' }))
    expect(onChange).toHaveBeenLastCalledWith('')
    expect(field()).toHaveValue('')
  })
})

describe('SearchSelect: bàn phím (review)', () => {
  it('tabbing in does not open the list; ↓ opens it and keeps the highlighted option scrolled into view', async () => {
    const user = userEvent.setup()
    const scrolled: Element[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this) }
    try {
      render(<Harness />)
      await user.tab()
      expect(field()).toHaveFocus()
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
      const activeId = field().getAttribute('aria-activedescendant')!
      expect(document.getElementById(activeId)).toHaveTextContent('Xác nhận thanh toán')
      expect(scrolled.at(-1)).toBe(document.getElementById(activeId))
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })
})
