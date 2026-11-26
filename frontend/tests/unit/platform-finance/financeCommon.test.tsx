import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { FlashNote, useFlash } from '../../../src/features/platform-finance/components/common'

function SamePageFlashHarness() {
  const navigate = useNavigate()
  const [flash] = useFlash()
  return (
    <>
      <FlashNote flash={flash} />
      <button type="button" onClick={() => navigate('/same', { state: { flash: { tone: 'ok', text: 'Đã ghi sổ.' } } })}>
        Hoàn tất
      </button>
    </>
  )
}

describe('platform finance flash navigation', () => {
  it('thay thông báo cũ khi điều hướng tới cùng trang với kết quả thao tác mới', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={[{ pathname: '/same', state: { flash: { tone: 'ok', text: 'Đã lưu nháp.' } } }]}>
        <SamePageFlashHarness />
      </MemoryRouter>,
    )

    expect(screen.getByText('Đã lưu nháp.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hoàn tất' }))
    expect(await screen.findByText('Đã ghi sổ.')).toBeInTheDocument()
    expect(screen.queryByText('Đã lưu nháp.')).toBeNull()
  })
})
