import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialCows } from '../../../src/data/cowsData'

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

describe('backend cattle QR reissue', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubEnv('VITE_BEEFCARE_FARM_ID', '9')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('keeps the backend-issued code visible until the user closes the modal', async () => {
    const onSaved = vi.fn()
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname === '/api/csrf') return response({ token: 'csrf' })
      if (url.pathname.endsWith('/qr-tags')) return response({ tagCode: 'QR-BACKEND-NEW' })
      throw new Error(`Unexpected request ${url.pathname}`)
    })
    const { default: QrReissueModal } = await import('../../../src/features/cattle/components/QrReissueModal')
    const cow = { ...initialCows[0], backendId: 42, backendVersion: 7 }
    render(<QrReissueModal cow={cow} onClose={() => undefined} onSaved={onSaved} />)

    const user = userEvent.setup()
    // R-05-12: thay thẻ phải chọn lý do; không có lý do mặc định.
    await user.click(screen.getByRole('button', { name: 'Xác nhận thẻ mới' }))
    expect(screen.getByText('Vui lòng chọn Lý do thay.')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Lý do thay thẻ' }), 'LOST')
    await user.click(screen.getByRole('button', { name: 'Xác nhận thẻ mới' }))
    await waitFor(() => expect(screen.getByDisplayValue('QR-BACKEND-NEW')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'In thẻ thử' })).toBeEnabled()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
