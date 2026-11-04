import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { FormScreen } from '../../../src/features/forms/pages/FormScreens'

describe('FormScreen', () => {
  it('shows exact missing-field feedback after submit', async () => {
    const user = userEvent.setup()
    render(<FormScreen screen={screenById('SCR-55')!} state="success" />)
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng nhập Ngày phát hiện và Triệu chứng chính.')
  })

  it('places pregnancy detail beside its controller only when active', async () => {
    const user = userEvent.setup()
    render(<FormScreen screen={screenById('SCR-65')!} state="success" />)
    expect(screen.queryByRole('spinbutton', { name: 'Số tháng mang thai' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tình trạng thai kỳ' }), 'pregnant')
    expect(screen.getByRole('spinbutton', { name: 'Số tháng mang thai' })).toBeInTheDocument()
  })

  it('keeps warning and actions in one compact footer', () => {
    render(<FormScreen screen={screenById('SCR-48')!} state="success" />)
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('Các trường có dấu * là bắt buộc')
    expect(footer).toContainElement(screen.getByRole('button', { name: 'Lưu thông tin' }))
  })
})
