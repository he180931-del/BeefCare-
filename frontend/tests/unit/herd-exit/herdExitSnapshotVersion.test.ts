import { describe, expect, it, vi } from 'vitest'
import { createHerdExitBackendApi, type BackendTransport } from '../../../src/features/herd-exit/api/herdExitBackendApi'
import { BackendError } from '../../../src/shared/api/backendClient'

const code = 'PX-2026-0061'
const root = '/api/farms/1/exit-vouchers'
const record = { backendId: 61, type: 'Bán' as const, status: 'Nháp' as const, date: '2026-10-29' }
const payment = { date: '2026-10-29', amount: 100, method: 'Tiền mặt', ref: '' }
function setup() {
  const dto = { id: 61, code, version: 9, status: 'DRAFT', exitType: 'SALE', exitDate: record.date }
  const get = vi.fn(async (path: string): Promise<unknown> => path === root ? { vouchers: [dto] } : path === `${root}/61` ? dto : [])
  const command = vi.fn<BackendTransport['command']>().mockResolvedValue({ voucher: { ...dto, version: 4 } })
  const api = createHerdExitBackendApi({ farmId: 1, transport: { get, command, farmPath: (id, suffix = '') => `/api/farms/${id}${suffix}` } })
  return { api, get, command }
}
const commands = {
  save: (api: ReturnType<typeof setup>['api'], version: number | undefined) => api.save({ id: code, expectedVersion: version, record }),
  void: (api: ReturnType<typeof setup>['api'], version: number | undefined) => api.voidVoucher(code, { reason: 'Sai nguồn', expectedVersion: version, backendId: 61 }),
  payment: (api: ReturnType<typeof setup>['api'], version: number | undefined) => api.recordPayment(code, payment, { voucherVersion: version, backendId: 61 }),
  dismiss: (api: ReturnType<typeof setup>['api'], version: number | undefined) => api.dismissVoucher(code, 'Sai đề xuất', version, 61),
}

describe('exit snapshot version contract', () => {
  it.each(Object.entries(commands))('%s sends form version 3 against server 9 without replacing it', async (name, run) => {
    const { api, get, command } = setup()
    const error = new BackendError(409, { code: 'MSG-COM-05' })
    command.mockRejectedValueOnce(error)
    await expect(run(api, 3)).rejects.toBe(error)
    expect(command).toHaveBeenCalledTimes(1)
    expect(command.mock.calls[0][1]).toMatchObject(name === 'payment' ? { voucherVersion: 3 } : { expectedVersion: 3 })
    expect(get.mock.calls.some(([path]) => path === root || path === `${root}/61`)).toBe(false)
    if (name === 'void') expect(command.mock.calls[0][1]).toMatchObject({ penOverrides: {}, warningReasons: {} })
  })

  it.each(Object.entries(commands))('%s accepts the first revision 0', async (name, run) => {
    const { api, command } = setup()
    await run(api, 0)
    expect(command.mock.calls[0][1]).toMatchObject(name === 'payment' ? { voucherVersion: 0 } : { expectedVersion: 0 })
  })

  it.each(Object.entries(commands))('%s rejects missing metadata before any request', async (_name, run) => {
    const { api, get, command } = setup()
    await expect(run(api, undefined)).rejects.toThrow('Thiếu phiên bản hợp lệ')
    expect(get).not.toHaveBeenCalled()
    expect(command).not.toHaveBeenCalled()
  })

  it('uses resolve only for an absent backendId, never its server version', async () => {
    const { api, get, command } = setup()
    await api.dismissVoucher(code, 'Sai', 3)
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith(root)
    expect(command.mock.calls[0][1]).toMatchObject({ expectedVersion: 3 })
  })

  it('preserves the explicit checks version on confirm and validates missing checks metadata', async () => {
    const { api, get, command } = setup()
    await expect(api.confirm(code, undefined)).rejects.toThrow('Thiếu phiên bản hợp lệ')
    expect(get).not.toHaveBeenCalled()
    await api.confirm(code, 0)
    expect(command.mock.calls[0][1]).toMatchObject({ acknowledged: true, expectedVersion: 0 })
  })

  it('creates without a prior version and confirms with the just-saved version', async () => {
    const { api, command } = setup()
    await api.save({ expectedVersion: 9, record: { ...record, status: 'Đã xuất' } })
    expect(command.mock.calls[0][1]).toMatchObject({ expectedVersion: null })
    expect(command.mock.calls[1][1]).toMatchObject({ acknowledged: true, expectedVersion: 4 })
  })

  it('leaves absent voucher/checks versions undefined and prevents confirmation after an incomplete save response', async () => {
    const { api, get, command } = setup()
    get.mockImplementation(async (path) => path === root ? { vouchers: [{ id: 61, code }] } : path.endsWith('/attachments') ? [] : { id: 61, code })
    expect((await api.get(code)).version).toBeUndefined()
    expect((await api.checks(code)).version).toBeUndefined()
    command.mockResolvedValue({ voucher: { id: 61, code, status: 'DRAFT' } })
    expect((await api.save({ record })).version).toBeUndefined()
    command.mockClear()
    await expect(api.save({ record: { ...record, status: 'Đã xuất' } })).rejects.toThrow('Thiếu phiên bản hợp lệ')
    expect(command).toHaveBeenCalledTimes(1)
  })

  it('retains version 0 in response mapping', async () => {
    const { api, command } = setup()
    command.mockResolvedValue({ voucher: { id: 61, code, version: 0, status: 'DRAFT' } })
    expect((await api.save({ record })).version).toBe(0)
  })

  it('keeps identical command keys stable and changes keys with the snapshot version', async () => {
    for (const run of Object.values(commands)) {
      const { api, command } = setup()
      await run(api, 3); await run(api, 3); await run(api, 4)
      expect(command.mock.calls[0][2]?.key).toBe(command.mock.calls[1][2]?.key)
      expect(command.mock.calls[0][2]?.key).not.toBe(command.mock.calls[2][2]?.key)
    }
  })
})
