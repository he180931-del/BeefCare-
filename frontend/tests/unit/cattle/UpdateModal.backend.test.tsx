import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialCows } from '../../../src/data/cowsData'

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

describe('backend cattle update modal', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubEnv('VITE_BEEFCARE_FARM_ID', '9')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('does not seed demo reason/date and posts the current date for a backend cattle', async () => {
    const profileUpdates: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname === '/api/farms/9/catalogues/production-purposes') return response([])
      if (url.pathname === '/api/csrf') return response({ token: 'csrf' })
      if (url.pathname.endsWith('/profile')) {
        profileUpdates.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return response({ id: 42, version: 8 })
      }
      throw new Error(`Unexpected backend request ${url.pathname}`)
    })

    const { default: UpdateModal } = await import('../../../src/features/cattle/components/UpdateModal')
    const cow = { ...initialCows[0], code: 'BC-000142', name: 'Bò backend', tag: 'TAG-BACKEND', description: 'Mô tả backend', purposeId: 31, lifeStage: 'ADULT', backendId: 42, backendVersion: 7, canUpdate: true }
    const user = userEvent.setup()
    render(<UpdateModal cow={cow} onClose={() => undefined} onSaved={() => undefined} />)

    const today = new Date().toISOString().slice(0, 10)
    expect(screen.getByLabelText('Chọn ngày')).toHaveValue(today)
    expect(screen.getAllByRole('textbox')[1]).toHaveValue('')
    expect(screen.queryByText(/Đủ 13 tháng/)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox'), 'YOUNG_STOCK')
    await user.type(screen.getAllByRole('textbox')[1], 'Đủ điều kiện theo backend')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(profileUpdates).toHaveLength(1))
    expect(profileUpdates[0]).toMatchObject({ effectiveDate: today, reason: 'Đủ điều kiện theo backend', lifeStage: 'YOUNG_STOCK', expectedVersion: 7 })
  })
})
