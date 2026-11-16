import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const TODAY = '2026-11-16'
const from = { id: 11, code: 'A', name: 'Chuồng A', capacity: 5, headcount: 2, status: 'ACTIVE' }
const to = { id: 12, code: 'B', name: 'Chuồng B', capacity: 5, headcount: 0, status: 'ACTIVE' }
const cattle = [{ id: 41, code: 'BC-0041', version: 0 }, { id: 42, code: 'BC-0042', version: 7 }]
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function openBatchMove(conflict: boolean) {
  const save = vi.fn()
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://backend.test').pathname
    if (path === '/api/farms/9/pens/11') return json({ ...from, cattle })
    if (path === '/api/csrf') return json({ token: 'csrf' })
    if (path === '/api/farms/9/pen-moves/check') {
      return json({ destinationActive: true, capacity: 5, freePlaces: 5, movingCount: 2, blocked: false,
        cattle: cattle.map((cow) => ({ cattleId: cow.id, cattleCode: cow.code, currentPenCode: 'A',
          currentFromDate: TODAY, allMet: true, results: [] })),
      })
    }
    if (path === '/api/farms/9/pen-moves') {
      save(JSON.parse(String(init?.body)))
      return conflict
        ? json({ code: 'MSG-COM-05', params: { cattle_code: 'BC-0042', pen_code: 'C', actual: 8, expected: 7 } }, 409)
        : json({ moved: cattle.map((cow) => ({ cattleId: cow.id })), skipped: [] })
    }
    throw new Error(`Unexpected request: ${path}`)
  })

  const [{ default: MoveDialog }, { penApi, mapBackendPen }] = await Promise.all([
    import('../../../src/features/pen-management/components/MoveDialog'),
    import('../../../src/features/pen-management/api/penApi'),
  ])
  const loaded = await penApi.detail(mapBackendPen(from))
  const onMoved = vi.fn()
  const onReload = vi.fn()
  render(<MemoryRouter><MoveDialog from={loaded} cattle={loaded.cattleInPen} pens={[loaded, mapBackendPen(to)]}
    today={TODAY} onClose={vi.fn()} onMoved={onMoved} onReload={onReload} /></MemoryRouter>)
  const user = userEvent.setup()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Chuồng đích' }), 'B')
  await user.type(screen.getByRole('textbox'), 'Tách đàn')
  const button = screen.getByRole('button', { name: 'Xác nhận chuyển' })
  await waitFor(() => expect(button).toBeEnabled())
  await user.click(button)
  return { save, onMoved, onReload, user }
}

describe('FE-04 backend batch move (TC-04-28)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubEnv('VITE_BEEFCARE_FARM_ID', '9')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('sends every cattle version from the pen detail, including version zero', async () => {
    const { save, onMoved } = await openBatchMove(false)
    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ cattleIds: [41, 42], cattleVersions: { 41: 0, 42: 7 } }))
    expect(onMoved).toHaveBeenCalledWith('Đã chuyển 2 con sang B.')
  })

  it('names the changed cattle and requires a reload before confirming again', async () => {
    const { save, onMoved, onReload, user } = await openBatchMove(true)
    expect(await screen.findByText(/Thông tin bò BC-0042 đã thay đổi. Chuồng hiện tại: C/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xác nhận chuyển' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tải lại danh sách bò' }))
    expect(onReload).toHaveBeenCalledOnce()
    expect(onMoved).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledOnce()
  })
})
