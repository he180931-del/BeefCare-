import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ServiceChangeDialog from '../../../src/features/platform-service/components/ServiceChangeDialog'
import { platformServiceApi } from '../../../src/features/platform-service/api/platformServiceApi'
import type { FarmOverview, FarmServicePreview } from '../../../src/features/platform-service/types'

const farm: FarmOverview = {
  farmId: 7, farmName: 'Trại Unit', ownerName: 'Chủ trại', ownerEmail: 'owner@example.test', serviceStatus: 'ACTIVE',
  coverageEnd: '2027-01-01', suspended: false, suspendedSince: null, suspendedBy: null, suspendReason: null,
  herdSize: 3, periodStart: '2026-01-01', periodEnd: '2027-01-01', version: 4,
}

const preview: FarmServicePreview = {
  farmId: farm.farmId, farmName: farm.farmName, ownerName: farm.ownerName, ownerEmail: farm.ownerEmail, herdSize: farm.herdSize,
  serviceStatus: 'ACTIVE', suspendedSince: null, suspendedBy: null, suspendReason: null,
  periodStart: farm.periodStart, periodEnd: farm.periodEnd, coverageEnd: farm.coverageEnd, statusAfterRestore: 'ACTIVE', version: farm.version,
}

describe('ServiceChangeDialog reason boundaries', () => {
  let getFarmService: ReturnType<typeof vi.spyOn<typeof platformServiceApi, 'getFarmService'>>
  let suspendFarm: ReturnType<typeof vi.spyOn<typeof platformServiceApi, 'suspendFarm'>>

  beforeEach(() => {
    getFarmService = vi.spyOn(platformServiceApi, 'getFarmService')
    suspendFarm = vi.spyOn(platformServiceApi, 'suspendFarm')
    getFarmService.mockResolvedValue(preview)
    suspendFarm.mockResolvedValue({ farmName: farm.farmName, serviceStatus: 'SUSPENDED' } as never)
    vi.stubGlobal('crypto', { randomUUID: () => 'unit-test-idempotency-key' })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('TC-02-28: rejects a blank reason and 501 characters without submitting', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onDone = vi.fn()
    const { rerender } = render(<ServiceChangeDialog farm={farm} mode="suspend" onClose={onClose} onDone={onDone} />)
    await screen.findByRole('textbox', { name: /Lý do tạm ngưng/ })

    await user.click(screen.getByRole('button', { name: 'Tạm ngưng dịch vụ' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Lý do tạm ngưng là bắt buộc.')
    expect(suspendFarm).not.toHaveBeenCalled()

    rerender(<ServiceChangeDialog farm={farm} mode="suspend" onClose={onClose} onDone={onDone} />)
    fireEvent.change(screen.getByRole('textbox', { name: /Lý do tạm ngưng/ }), { target: { value: 'x'.repeat(501) } })
    await user.click(screen.getByRole('button', { name: 'Tạm ngưng dịch vụ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Lý do tạm ngưng tối đa 500 ký tự.')
    expect(suspendFarm).not.toHaveBeenCalled()
  })

  it('accepts the inclusive 500-character reason boundary', async () => {
    const user = userEvent.setup()
    render(<ServiceChangeDialog farm={farm} mode="suspend" onClose={vi.fn()} onDone={vi.fn()} />)
    const reason = await screen.findByRole('textbox', { name: /Lý do tạm ngưng/ })
    fireEvent.change(reason, { target: { value: 'x'.repeat(500) } })
    await user.click(screen.getByRole('button', { name: 'Tạm ngưng dịch vụ' }))

    await waitFor(() => expect(suspendFarm).toHaveBeenCalledOnce())
    expect(suspendFarm).toHaveBeenCalledWith(farm.farmId, { reason: 'x'.repeat(500), version: farm.version }, { idempotencyKey: 'unit-test-idempotency-key' })
  })
})
