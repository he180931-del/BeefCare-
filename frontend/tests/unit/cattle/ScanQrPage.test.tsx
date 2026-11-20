import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_FARM_KEY, pageLoader, readCurrentFarmId } from '../../../src/app/session/currentFarm'
import { initialCows } from '../../../src/data/cowsData'
import * as scan from '../../../src/features/cattle/api/scanApi'
import ScanQrPage from '../../../src/features/cattle/pages/ScanQrPage'
import { farmWorkspaceApi } from '../../../src/features/farm-workspace/api/farmWorkspaceApi'

afterEach(() => {
  sessionStorage.removeItem(CURRENT_FARM_KEY)
  vi.restoreAllMocks()
})

describe('FE-05 QR scan', () => {
  it('checks the destination farm only after confirmation and resumes in its role', async () => {
    vi.spyOn(scan, 'scanCode').mockResolvedValue({ kind: 'otherFarm', farmId: 12 })
    const select = vi.spyOn(farmWorkspaceApi, 'selectFarm').mockResolvedValue({
      id: 12, role: 'TECHNICIAN', name: 'Trại thử', version: 1, serviceStatus: 'ACTIVE',
    })
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/quet-qr']}><ScanQrPage /></MemoryRouter>)
    await user.type(screen.getByLabelText('Nhập mã thủ công'), 'QR-TRAI-12')
    await user.click(screen.getByRole('button', { name: 'Tra cứu' }))
    const switchButton = await screen.findByRole('button', { name: 'Chuyển trại và mở hồ sơ' })
    expect(select).not.toHaveBeenCalled()
    expect(readCurrentFarmId()).toBe(1) // still the farm this tab works in
    await user.click(switchButton)
    await waitFor(() => expect(load).toHaveBeenCalledWith('/kt/quet-qr?code=QR-TRAI-12'))
    expect(select).toHaveBeenCalledWith(12)
    expect(readCurrentFarmId()).toBe(12)
  })

  it('resolves the code again after switching and opens the authorized profile', async () => {
    const cow = initialCows[0]
    const resolve = vi.spyOn(scan, 'scanCode').mockResolvedValue({ kind: 'found', cow })
    render(<MemoryRouter initialEntries={['/kt/quet-qr?code=QR-TRAI-12']}><Routes>
      <Route path="/kt/quet-qr" element={<ScanQrPage />} />
      <Route path={`/kt/dan-bo/${cow.code}`} element={<p>Hồ sơ đã mở</p>} />
    </Routes></MemoryRouter>)
    expect(await screen.findByText('Hồ sơ đã mở')).toBeVisible()
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledWith('QR-TRAI-12')
  })
})
