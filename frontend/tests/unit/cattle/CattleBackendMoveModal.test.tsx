import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

describe('Cattle profile backend move pen flow', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubEnv('VITE_BEEFCARE_FARM_ID', '9')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('shows the move action for ACTIVE backend cattle and posts a real pen move', async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = []
    const profile = { id: 42, displayCode: 'BC-BACKEND-MOVE', name: 'Bông', sex: 'FEMALE', breedName: 'Brahman', birthDate: '2024-01-01', purposeName: 'Vỗ béo', lifeStage: 'ADULT', herdStatus: 'ACTIVE', herdGroup: 'FATTENING', version: 7, penId: 11, penCode: 'A1', penName: 'Chuồng A1', penSince: '2026-01-01', latestWeightKg: 320, weightBasis: 'MEASURED', canUpdate: true }
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://backend.test')
      requests.push({ path: url.pathname, init })
      if (url.pathname === '/api/farms/9/cattle/resolve') return response({ cattleId: 42 })
      if (url.pathname === '/api/farms/9/cattle/42') return response(profile)
      if (url.pathname === '/api/farms/9/cattle/42/pen-history') return response({ current: { penId: 11, penCode: 'A1', penName: 'Chuồng A1', since: '2026-01-01' }, history: [] })
      if (url.pathname === '/api/farms/9/pens') return response({ pens: [
        { id: 11, code: 'A1', name: 'Chuồng A1', capacity: 5, headcount: 1, status: 'ACTIVE' },
        { id: 12, code: 'B1', name: 'Chuồng B1', capacity: 5, headcount: 0, status: 'ACTIVE' },
      ] })
      if (url.pathname.endsWith('/qr-tags') || url.pathname.endsWith('/timeline')) return response([])
      if (url.pathname === '/api/csrf') return response({ token: 'csrf' })
      if (url.pathname === '/api/farms/9/pen-moves/check') return response({
        toPenId: 12, toPenCode: 'B1', destinationActive: true, capacity: 5, headcount: 0, freePlaces: 5,
        movingCount: 1, blocked: false, cattle: [{ cattleId: 42, cattleCode: 'BC-BACKEND-MOVE', currentPenId: 11, currentPenCode: 'A1', alreadyInDestination: false, allMet: true, warningReasonRequired: true, results: [] }],
      })
      if (url.pathname === '/api/farms/9/pen-moves') return response({ moved: [{ cattleId: 42, toPenCode: 'B1' }] })
      throw new Error(`Unexpected backend request ${url.pathname}`)
    })

    const { default: CowProfile } = await import('../../../src/features/cattle/pages/CowProfile')
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/cattle/BC-BACKEND-MOVE']}><Routes><Route path="/cattle/:code" element={<CowProfile />} /></Routes></MemoryRouter>)

    expect((await screen.findAllByText('BC-BACKEND-MOVE')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Lịch sử chuồng' }))
    await user.click(screen.getByRole('button', { name: 'Chuyển chuồng' }))
    expect(screen.getByRole('heading', { name: /Chuyển chuồng/ })).toBeInTheDocument()
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'B1')
    await user.type(screen.getAllByRole('textbox')[1], 'Đủ điều kiện')
    // R-04-05: khi có tiêu chí không đạt, lý do cảnh báo là trường riêng; thiếu thì chưa cho xác nhận.
    const confirm = screen.getByRole('button', { name: 'Xác nhận chuyển chuồng' })
    expect(confirm).toBeDisabled()
    await user.type(await screen.findByRole('textbox', { name: 'Lý do cảnh báo' }), 'Chủ trại đồng ý ghép tạm')
    await user.click(confirm)

    await waitFor(() => expect(requests.some((request) => request.path === '/api/farms/9/pen-moves')).toBe(true))
    const moveRequest = requests.find((request) => request.path === '/api/farms/9/pen-moves')
    const checkRequest = requests.find((request) => request.path === '/api/farms/9/pen-moves/check')
    expect(checkRequest).toBeTruthy()
    expect(requests.findIndex((request) => request.path === '/api/farms/9/pen-moves/check')).toBeLessThan(requests.findIndex((request) => request.path === '/api/farms/9/pen-moves'))
    expect(JSON.parse(String(checkRequest?.init?.body))).toMatchObject({ cattleIds: [42], toPenId: 12 })
    expect(JSON.parse(String(moveRequest?.init?.body))).toMatchObject({ cattleIds: [42], toPenId: 12, moveDate: new Date().toISOString().slice(0, 10), reason: 'Đủ điều kiện', warningReasons: { 42: 'Chủ trại đồng ý ghép tạm' }, cattleVersions: { 42: 7 } })
  })

  it('shows a backend blocking message and does not post the move', async () => {
    const requests: string[] = []
    const profile = { id: 42, displayCode: 'BC-BACKEND-BLOCKED', name: 'Bông', sex: 'FEMALE', breedName: 'Brahman', birthDate: '2024-01-01', purposeName: 'Vỗ béo', lifeStage: 'ADULT', herdStatus: 'ACTIVE', herdGroup: 'FATTENING', version: 7, penId: 11, penCode: 'A1', penName: 'Chuồng A1', penSince: '2026-01-01', latestWeightKg: 320, weightBasis: 'MEASURED', canUpdate: true }
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://backend.test')
      requests.push(url.pathname)
      if (url.pathname === '/api/farms/9/cattle/resolve') return response({ cattleId: 42 })
      if (url.pathname === '/api/farms/9/cattle/42') return response(profile)
      if (url.pathname === '/api/farms/9/cattle/42/pen-history') return response({ current: { penId: 11, penCode: 'A1', penName: 'Chuồng A1', since: '2026-01-01' }, history: [] })
      if (url.pathname === '/api/farms/9/pens') return response({ pens: [{ id: 11, code: 'A1', name: 'Chuồng A1', capacity: 5, headcount: 1, status: 'ACTIVE' }, { id: 12, code: 'B1', name: 'Chuồng B1', capacity: 1, headcount: 1, status: 'ACTIVE' }] })
      if (url.pathname.endsWith('/qr-tags') || url.pathname.endsWith('/timeline')) return response([])
      if (url.pathname === '/api/csrf') return response({ token: 'csrf' })
      if (url.pathname === '/api/farms/9/pen-moves/check') return response({
        toPenId: 12, toPenCode: 'B1', destinationActive: true, capacity: 1, headcount: 1, freePlaces: 0,
        movingCount: 1, blocked: true, block: { text: 'Chuồng B1 đã đủ sức chứa' }, cattle: [],
      })
      throw new Error(`Unexpected backend request ${url.pathname}`)
    })

    const { default: CowProfile } = await import('../../../src/features/cattle/pages/CowProfile')
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/cattle/BC-BACKEND-BLOCKED']}><Routes><Route path="/cattle/:code" element={<CowProfile />} /></Routes></MemoryRouter>)
    await screen.findAllByText('BC-BACKEND-BLOCKED')
    await user.click(screen.getByRole('button', { name: 'Lịch sử chuồng' }))
    await user.click(screen.getByRole('button', { name: 'Chuyển chuồng' }))
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'B1')
    await user.type(screen.getAllByRole('textbox')[1], 'Đủ điều kiện')
    expect(await screen.findByText('Chuồng B1 đã đủ sức chứa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xác nhận chuyển chuồng' })).toBeDisabled()
    expect(requests).not.toContain('/api/farms/9/pen-moves')
  })
})
